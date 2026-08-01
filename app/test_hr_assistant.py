import sys
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.rag.pipeline import rag_pipeline
from app.services.odoo.client import odoo_client
from app.agent.tools import tool_registry
from app.agent.hr_agent import hr_agent


def test_1_rag_pipeline_qatar_labour_law():
    print("\n--- Test 1: Qatar Labour Law RAG Pipeline ---")
    assert len(rag_pipeline.documents) > 0, "RAG pipeline should index policy sections"
    results = rag_pipeline.search_policy("how many annual leave days under Qatar labour law", top_k=2)
    assert len(results) > 0, "Search should return matching Qatar Labour Law sections"
    top_doc = results[0]
    print(f"Top RAG Match: '{top_doc.title}' (Score: {top_doc.similarity_score})")
    assert "21 days" in top_doc.content or "28 days" in top_doc.content or "Annual Leave" in top_doc.title, "Should mention Qatar annual leave entitlements"
    print("[PASSED] RAG Pipeline test PASSED!")


def test_2_odoo_mock_handler_and_client():
    print("\n--- Test 2: Standalone OdooClient & Mock Handler ---")
    employees = odoo_client.get_all_employees()
    assert len(employees) >= 4, "Should have at least 4 employees in Odoo"
    alice = odoo_client.get_employee(1)
    assert alice is not None and alice.name == "Alice Vance"
    balance = odoo_client.get_leave_balance(1)
    print(f"Alice Vance remaining leave balance: {balance}")
    assert balance["Annual Leave"] == 21.0, "Alice should start with 21.0 annual leave days"
    print("[PASSED] OdooClient test PASSED!")


def test_3_agent_guardrail_draft_state():
    print("\n--- Test 3: Intentional Agent Guardrail (DRAFT State Required) ---")
    res = tool_registry.propose_leave_request(
        employee_id=1,
        leave_type="Annual Leave",
        start_date="2026-08-10",
        end_date="2026-08-14",
        reason="Family Trip to London"
    )
    assert res["success"] is True
    assert res["state"] == "draft", "All write actions MUST output DRAFT state!"
    pending = res["pending_action"]
    assert pending["status"] == "DRAFT"
    leave_id = pending["payload"]["leave_id"]
    print(f"Created DRAFT Leave #{leave_id} via Guardrail!")

    # Verify state in Odoo
    leave = odoo_client.get_leave_by_id(leave_id)
    assert leave is not None and leave.state == "draft", "Odoo record must be in draft state"
    print("[PASSED] Agent Guardrail DRAFT State test PASSED!")
    return leave_id


def test_4_hitl_approval_workflow(leave_id: int):
    print("\n--- Test 4: Human-in-the-Loop (HITL) Approval & Balance Deduction ---")
    # Balance before approval
    bal_before = odoo_client.get_leave_balance(1)["Annual Leave"]
    
    # HITL approval action
    approved_leave = odoo_client.approve_leave_request(leave_id=leave_id, approved_by="Test HR Manager")
    assert approved_leave.state == "approved", "Leave should transition to approved"

    # Balance after approval (5 days deducted: Aug 10, 11, 12, 13, 14)
    bal_after = odoo_client.get_leave_balance(1)["Annual Leave"]
    print(f"Annual Leave balance before approval: {bal_before}, after approval: {bal_after}")
    assert bal_after == bal_before - 5.0, f"Expected {bal_before - 5.0} days remaining, got {bal_after}"
    print("[PASSED] HITL Approval and Balance Deduction test PASSED!")


def test_5_fastapi_endpoints():
    print("\n--- Test 5: FastAPI Endpoints Integration ---")
    client = TestClient(app)

    # Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

    # Chat endpoint read-only query
    chat_res = client.post("/api/v1/chat", json={
        "query": "What is the sick leave entitlement under Qatar Labour Law?",
        "employee_id": 1
    })
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert len(chat_data["sources"]) > 0, "Should include RAG sources"
    print(f"Chat Reply Snippet: {chat_data['response_text'][:100]}...")

    # Chat endpoint write-guarded query
    leave_res = client.post("/api/v1/chat", json={
        "query": "I want to request annual leave from 2026-09-01 to 2026-09-05 for vacation.",
        "employee_id": 1
    })
    assert leave_res.status_code == 200
    leave_data = leave_res.json()
    assert leave_data["action_required"] is True, "Should trigger action_required for leave request"
    assert leave_data["pending_action"]["status"] == "DRAFT"
    print("[PASSED] FastAPI Endpoints test PASSED!")


if __name__ == "__main__":
    print("======================================================")
    print("  RUNNING HR AI ASSISTANT PRODUCTION VERIFICATION     ")
    print("======================================================")
    test_1_rag_pipeline_qatar_labour_law()
    test_2_odoo_mock_handler_and_client()
    leave_id = test_3_agent_guardrail_draft_state()
    test_4_hitl_approval_workflow(leave_id)
    test_5_fastapi_endpoints()
    print("\n*** ALL 5 PRODUCTION VERIFICATION TESTS PASSED SUCCESSFULLY! ***")
