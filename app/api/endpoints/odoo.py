from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.schemas import Employee, LeaveRequest, ApprovalRequest
from app.services.odoo.client import odoo_client

router = APIRouter(prefix="/odoo", tags=["Odoo Integration & Human-in-the-Loop"])


@router.get("/employees", response_model=List[Employee], summary="List All Odoo Employees")
async def get_all_employees():
    """
    Fetch all employees from Odoo hr.employee with their remaining leave balances.
    """
    try:
        return odoo_client.get_all_employees()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/employees/{employee_id}", response_model=Employee, summary="Get Employee Details")
async def get_employee_by_id(employee_id: int):
    """
    Retrieve specific employee profile and remaining leaves from Odoo.
    """
    emp = odoo_client.get_employee(employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found in Odoo.")
    return emp


@router.get("/leaves", response_model=List[LeaveRequest], summary="List Leave Requests")
async def list_leave_requests(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    state: Optional[str] = Query(None, description="Filter by state (draft, approved, rejected)")
):
    """
    List leave requests from Odoo hr.leave, optionally filtered by employee ID or state.
    """
    try:
        return odoo_client.get_leaves(employee_id=employee_id, state=state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leaves/{leave_id}/approve", response_model=LeaveRequest, summary="[HITL] Approve Leave Request")
async def approve_leave(leave_id: int, approved_by: str = "HR Manager (HITL Dashboard)"):
    """
    Human-in-the-Loop Action: Approve a DRAFT leave request and commit to Odoo.
    Deducts the requested leave duration from the employee's remaining balance.
    """
    try:
        leave = odoo_client.get_leave_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail=f"Leave request #{leave_id} not found.")
        
        approved_leave = odoo_client.approve_leave_request(leave_id=leave_id, approved_by=approved_by)
        return approved_leave
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leaves/{leave_id}/reject", response_model=LeaveRequest, summary="[HITL] Reject Leave Request")
async def reject_leave(leave_id: int, reason: str = "Rejected via HITL Dashboard"):
    """
    Human-in-the-Loop Action: Reject a DRAFT leave request.
    """
    try:
        leave = odoo_client.get_leave_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail=f"Leave request #{leave_id} not found.")
        
        rejected_leave = odoo_client.reject_leave_request(leave_id=leave_id, reason=reason)
        return rejected_leave
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hitl/process", response_model=LeaveRequest, summary="[HITL] Process Approval Request")
async def process_approval_request(req: ApprovalRequest):
    """
    Unified Human-in-the-Loop endpoint used by the Web Dashboard to APPROVE or REJECT a pending DRAFT action.
    """
    if req.status.upper() == "APPROVED":
        return await approve_leave(leave_id=req.leave_id, approved_by=req.comment or "HR Manager")
    elif req.status.upper() == "REJECTED":
        return await reject_leave(leave_id=req.leave_id, reason=req.comment or "Rejected")
    else:
        raise HTTPException(status_code=400, detail=f"Invalid approval status: {req.status}")
