from datetime import datetime
from typing import Any, Dict, List, Optional
from app.rag.pipeline import rag_pipeline
from app.services.odoo.client import odoo_client
from app.core.schemas import PendingAction, ToolCallRecord


class ToolRegistry:
    """
    Registry of Intentional Tools available to the HR AI Assistant.
    Enforces Read-Only default behavior and Human-in-the-Loop DRAFT state
    for any write actions to Odoo.
    """
    def __init__(self):
        self.tool_calls_history: List[ToolCallRecord] = []

    def reset_history(self):
        self.tool_calls_history = []

    def search_hr_policies(self, query: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        [READ-ONLY] Search Qatar Labour Law and HR policy documents for rules on
        working hours, annual leave, sick leave, maternity leave, notice period, or EOSB.
        """
        docs = rag_pipeline.search_policy(query=query, top_k=3, category=category)
        snippets = [
            {
                "title": d.title,
                "content": d.content,
                "source": d.source,
                "similarity_score": d.similarity_score
            }
            for d in docs
        ]
        summary = f"Found {len(snippets)} relevant Qatar Labour Law policy chunks."
        self.tool_calls_history.append(
            ToolCallRecord(
                tool_name="search_hr_policies",
                arguments={"query": query, "category": category},
                access_type="READ_ONLY",
                result_summary=summary
            )
        )
        return {
            "query": query,
            "results": snippets,
            "summary": summary
        }

    def get_employee_profile(self, employee_id: int) -> Dict[str, Any]:
        """
        [READ-ONLY] Lookup an employee's profile details (name, email, department, job_title) in Odoo.
        """
        emp = odoo_client.get_employee(employee_id)
        if not emp:
            summary = f"Employee {employee_id} not found."
            res = {"error": summary}
        else:
            summary = f"Retrieved profile for {emp.name} ({emp.job_title} in {emp.department})."
            res = emp.model_dump()

        self.tool_calls_history.append(
            ToolCallRecord(
                tool_name="get_employee_profile",
                arguments={"employee_id": employee_id},
                access_type="READ_ONLY",
                result_summary=summary
            )
        )
        return res

    def get_leave_balance(self, employee_id: int) -> Dict[str, Any]:
        """
        [READ-ONLY] Get the remaining leave balances (Annual Leave, Sick Leave, Maternity Leave)
        for an employee in Odoo.
        """
        balance = odoo_client.get_leave_balance(employee_id)
        emp = odoo_client.get_employee(employee_id)
        name = emp.name if emp else f"ID #{employee_id}"
        summary = f"Retrieved leave balances for {name}: {balance}"
        
        self.tool_calls_history.append(
            ToolCallRecord(
                tool_name="get_leave_balance",
                arguments={"employee_id": employee_id},
                access_type="READ_ONLY",
                result_summary=summary
            )
        )
        return {
            "employee_id": employee_id,
            "employee_name": name,
            "remaining_leaves": balance
        }

    def get_leave_history(self, employee_id: int) -> Dict[str, Any]:
        """
        [READ-ONLY] Get all past and pending leave requests for an employee in Odoo.
        """
        leaves = odoo_client.get_leaves(employee_id=employee_id)
        summary = f"Retrieved {len(leaves)} leave records for employee {employee_id}."
        
        self.tool_calls_history.append(
            ToolCallRecord(
                tool_name="get_leave_history",
                arguments={"employee_id": employee_id},
                access_type="READ_ONLY",
                result_summary=summary
            )
        )
        return {
            "employee_id": employee_id,
            "leave_count": len(leaves),
            "leaves": [l.model_dump() for l in leaves]
        }

    def propose_leave_request(
        self,
        employee_id: int,
        leave_type: str,
        start_date: str,
        end_date: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        [WRITE ACTION — GUARDED BY DRAFT STATE & HITL APPROVAL]
        Proposes a new leave request in Odoo.
        MUST be created in 'draft' state and requires Human-in-the-Loop approval via UI.
        """
        # Create draft record in Odoo
        draft_leave = odoo_client.create_leave_request_draft(
            employee_id=employee_id,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=reason
        )

        action_id = f"hitl-action-{draft_leave.id}-{int(datetime.now().timestamp())}"
        pending_action = PendingAction(
            action_id=action_id,
            action_type="CREATE_LEAVE_REQUEST",
            description=f"Submit {leave_type} request for {draft_leave.employee_name} from {start_date} to {end_date}",
            payload={
                "leave_id": draft_leave.id,
                "employee_id": draft_leave.employee_id,
                "employee_name": draft_leave.employee_name,
                "leave_type": draft_leave.leave_type,
                "start_date": draft_leave.start_date,
                "end_date": draft_leave.end_date,
                "reason": draft_leave.reason,
                "state": draft_leave.state
            },
            status="DRAFT",
            created_at=draft_leave.created_at
        )

        summary = f"Created DRAFT leave request #{draft_leave.id} for {draft_leave.employee_name}. Requires Human-in-the-Loop approval."
        
        self.tool_calls_history.append(
            ToolCallRecord(
                tool_name="propose_leave_request",
                arguments={
                    "employee_id": employee_id,
                    "leave_type": leave_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "reason": reason
                },
                access_type="WRITE_GUARDED_DRAFT",
                result_summary=summary
            )
        )

        return {
            "success": True,
            "state": "draft",
            "message": summary,
            "pending_action": pending_action.model_dump()
        }


# Global registry
tool_registry = ToolRegistry()
