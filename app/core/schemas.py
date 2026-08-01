from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Employee(BaseModel):
    """
    Employee model corresponding to Odoo hr.employee.
    """
    id: int
    name: str
    email: str
    department: str
    job_title: str
    manager_id: Optional[int] = None
    remaining_leaves: Dict[str, float] = Field(
        default_factory=lambda: {
            "Annual Leave": 21.0,
            "Sick Leave": 14.0,
            "Maternity Leave": 50.0,
        }
    )


class LeaveRequest(BaseModel):
    """
    Leave Request model corresponding to Odoo hr.leave.
    State must default to 'draft' when created by an AI Agent.
    """
    id: int
    employee_id: int
    employee_name: str
    leave_type: str
    start_date: str
    end_date: str
    reason: str
    state: str = "draft"  # possible states: draft, submitted, approved, rejected
    created_at: str


class PolicyDocument(BaseModel):
    """
    RAG Policy Document snippet returned by semantic retrieval.
    """
    id: str
    title: str
    category: str
    content: str
    source: str
    similarity_score: Optional[float] = None


class PendingAction(BaseModel):
    """
    Represents a write action intercepted by the agent guardrail.
    Must be approved by a human before committing to Odoo.
    """
    action_id: str
    action_type: str  # e.g. "CREATE_LEAVE_REQUEST"
    description: str
    payload: Dict[str, Any]
    status: str = "DRAFT"  # "DRAFT", "APPROVED", "REJECTED"
    created_at: str


class ToolCallRecord(BaseModel):
    """
    Record of a tool invoked by the intentional agent during a chat turn.
    """
    tool_name: str
    arguments: Dict[str, Any]
    access_type: str  # "READ_ONLY" or "WRITE_GUARDED_DRAFT"
    result_summary: str


class AgentRequest(BaseModel):
    """
    Incoming request to the HR AI Assistant chat endpoint.
    """
    query: str
    employee_id: Optional[int] = 1  # Default to employee 1 (Alice Vance) for demo
    session_id: Optional[str] = "default-session"


class AgentResponse(BaseModel):
    """
    Structured response returned by the HR AI Assistant.
    """
    response_text: str
    sources: List[str] = []
    action_required: bool = False
    pending_action: Optional[PendingAction] = None
    tool_calls: List[ToolCallRecord] = []


class ApprovalRequest(BaseModel):
    """
    Request from the Web Dashboard to approve or reject a DRAFT action.
    """
    action_id: str
    leave_id: int
    status: str  # "APPROVED" or "REJECTED"
    comment: Optional[str] = None
