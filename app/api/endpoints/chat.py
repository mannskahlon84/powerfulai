from fastapi import APIRouter, HTTPException
from app.core.schemas import AgentRequest, AgentResponse
from app.agent.hr_agent import hr_agent

router = APIRouter(prefix="/chat", tags=["AI Assistant & Tool Calling"])


@router.post("", response_model=AgentResponse, summary="Interact with the HR AI Assistant")
async def chat_with_hr_agent(request: AgentRequest):
    """
    Send a natural language message to the HR AI Assistant.
    The agent uses intentional tool calling:
    - **Read-Only**: HR policies (`search_hr_policies`), employee profiles (`get_employee_profile`),
      and leave balances (`get_leave_balance`).
    - **Write-Guarded DRAFT**: Submitting a leave request (`propose_leave_request`) creates a record
      in 'draft' state and returns `action_required = True` for Human-in-the-Loop approval.
    """
    try:
        response = hr_agent.run(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", summary="List Intentional Agent Tools and Guardrails")
async def list_agent_tools():
    """
    Returns the list of available intentional tools and their security access levels.
    """
    return {
        "tools": [
            {
                "name": "search_hr_policies",
                "description": "Semantic RAG search across Qatar Labour Law and HR policy documents.",
                "access_type": "READ_ONLY",
                "parameters": ["query", "category"]
            },
            {
                "name": "get_employee_profile",
                "description": "Lookup employee name, department, job title, and manager in Odoo.",
                "access_type": "READ_ONLY",
                "parameters": ["employee_id"]
            },
            {
                "name": "get_leave_balance",
                "description": "Retrieve remaining leave entitlements (Annual, Sick, Maternity) for an employee.",
                "access_type": "READ_ONLY",
                "parameters": ["employee_id"]
            },
            {
                "name": "get_leave_history",
                "description": "List historical and pending leave requests in Odoo.",
                "access_type": "READ_ONLY",
                "parameters": ["employee_id"]
            },
            {
                "name": "propose_leave_request",
                "description": "Create a new leave request in Odoo. ALWAYS defaults to DRAFT state and requires HITL UI approval.",
                "access_type": "WRITE_GUARDED_DRAFT",
                "parameters": ["employee_id", "leave_type", "start_date", "end_date", "reason"]
            }
        ]
    }
