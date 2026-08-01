import xmlrpc.client
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.core.schemas import Employee, LeaveRequest
from app.services.odoo.mock_handler import mock_odoo_handler


class OdooClient:
    """
    Standalone OdooClient module connecting to Odoo hr.employee and hr.leave models
    via XML-RPC (JSON-RPC compatible), with seamless fallback to MockOdooHandler
    when USE_MOCK_ODOO is True.
    """
    def __init__(self):
        self.use_mock = settings.USE_MOCK_ODOO
        self.url = settings.ODOO_URL
        self.db = settings.ODOO_DB
        self.username = settings.ODOO_USER
        self.password = settings.ODOO_PASSWORD
        self.uid: Optional[int] = None
        self.models: Optional[xmlrpc.client.ServerProxy] = None

    def _authenticate_if_needed(self):
        if self.use_mock:
            return
        if self.uid is None:
            common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
            self.uid = common.authenticate(self.db, self.username, self.password, {})
            self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def get_all_employees(self) -> List[Employee]:
        if self.use_mock:
            raw_emps = mock_odoo_handler.get_all_employees()
            return [Employee(**emp) for emp in raw_emps]
        
        self._authenticate_if_needed()
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.employee", "search_read",
            [[]],
            {"fields": ["id", "name", "work_email", "department_id", "job_title", "parent_id"]}
        )
        # Convert Odoo record format to schema
        return [
            Employee(
                id=rec["id"],
                name=rec.get("name", "Unknown"),
                email=rec.get("work_email", ""),
                department=rec["department_id"][1] if isinstance(rec.get("department_id"), list) else "General",
                job_title=rec.get("job_title", "Employee"),
                manager_id=rec["parent_id"][0] if isinstance(rec.get("parent_id"), list) else None,
                remaining_leaves={"Annual Leave": 21.0, "Sick Leave": 14.0, "Maternity Leave": 50.0}
            )
            for rec in records
        ]

    def get_employee(self, employee_id: int) -> Optional[Employee]:
        if self.use_mock:
            raw_emp = mock_odoo_handler.get_employee(employee_id)
            return Employee(**raw_emp) if raw_emp else None
        
        self._authenticate_if_needed()
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.employee", "search_read",
            [[["id", "=", employee_id]]],
            {"fields": ["id", "name", "work_email", "department_id", "job_title", "parent_id"]}
        )
        if not records:
            return None
        rec = records[0]
        return Employee(
            id=rec["id"],
            name=rec.get("name", "Unknown"),
            email=rec.get("work_email", ""),
            department=rec["department_id"][1] if isinstance(rec.get("department_id"), list) else "General",
            job_title=rec.get("job_title", "Employee"),
            manager_id=rec["parent_id"][0] if isinstance(rec.get("parent_id"), list) else None,
            remaining_leaves={"Annual Leave": 21.0, "Sick Leave": 14.0, "Maternity Leave": 50.0}
        )

    def search_employees(self, domain: Optional[List[Any]] = None) -> List[Employee]:
        if self.use_mock:
            raw_emps = mock_odoo_handler.search_employees(domain)
            return [Employee(**emp) for emp in raw_emps]
        
        self._authenticate_if_needed()
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.employee", "search_read",
            [domain or []],
            {"fields": ["id", "name", "work_email", "department_id", "job_title", "parent_id"]}
        )
        return [
            Employee(
                id=rec["id"],
                name=rec.get("name", "Unknown"),
                email=rec.get("work_email", ""),
                department=rec["department_id"][1] if isinstance(rec.get("department_id"), list) else "General",
                job_title=rec.get("job_title", "Employee"),
                manager_id=rec["parent_id"][0] if isinstance(rec.get("parent_id"), list) else None,
                remaining_leaves={"Annual Leave": 21.0, "Sick Leave": 14.0, "Maternity Leave": 50.0}
            )
            for rec in records
        ]

    def get_leave_balance(self, employee_id: int) -> Dict[str, float]:
        if self.use_mock:
            return mock_odoo_handler.get_leave_balance(employee_id)
        # For live Odoo, query allocation vs taken
        return {"Annual Leave": 21.0, "Sick Leave": 14.0, "Maternity Leave": 50.0}

    def get_leaves(self, employee_id: Optional[int] = None, state: Optional[str] = None) -> List[LeaveRequest]:
        if self.use_mock:
            raw_leaves = mock_odoo_handler.get_leaves(employee_id=employee_id, state=state)
            return [LeaveRequest(**l) for l in raw_leaves]
        
        self._authenticate_if_needed()
        domain = []
        if employee_id:
            domain.append(["employee_id", "=", employee_id])
        if state:
            domain.append(["state", "=", state])
            
        records = self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.leave", "search_read",
            [domain],
            {"fields": ["id", "employee_id", "holiday_status_id", "request_date_from", "request_date_to", "name", "state", "create_date"]}
        )
        return [
            LeaveRequest(
                id=rec["id"],
                employee_id=rec["employee_id"][0] if isinstance(rec.get("employee_id"), list) else employee_id or 0,
                employee_name=rec["employee_id"][1] if isinstance(rec.get("employee_id"), list) else "Employee",
                leave_type=rec["holiday_status_id"][1] if isinstance(rec.get("holiday_status_id"), list) else "Leave",
                start_date=str(rec.get("request_date_from", "")),
                end_date=str(rec.get("request_date_to", "")),
                reason=str(rec.get("name", "")),
                state=str(rec.get("state", "draft")),
                created_at=str(rec.get("create_date", ""))
            )
            for rec in records
        ]

    def get_leave_by_id(self, leave_id: int) -> Optional[LeaveRequest]:
        if self.use_mock:
            raw = mock_odoo_handler.get_leave_by_id(leave_id)
            return LeaveRequest(**raw) if raw else None
        return None

    def create_leave_request_draft(
        self,
        employee_id: int,
        leave_type: str,
        start_date: str,
        end_date: str,
        reason: str
    ) -> LeaveRequest:
        """
        GUARDRAIL: ALWAYS creates leave in 'draft' state.
        Never directly submits or approves in this step.
        """
        if self.use_mock:
            raw = mock_odoo_handler.create_leave_request_draft(
                employee_id=employee_id,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                reason=reason
            )
            return LeaveRequest(**raw)

        self._authenticate_if_needed()
        new_id = self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.leave", "create",
            [{
                "employee_id": employee_id,
                "name": reason,
                "request_date_from": start_date,
                "request_date_to": end_date,
                "state": "draft"
            }]
        )
        return self.get_leave_by_id(new_id)

    def approve_leave_request(self, leave_id: int, approved_by: str = "HR Manager") -> LeaveRequest:
        """
        Human-in-the-Loop action: transitions leave from DRAFT to APPROVED.
        """
        if self.use_mock:
            raw = mock_odoo_handler.approve_leave_request(leave_id=leave_id, approved_by=approved_by)
            return LeaveRequest(**raw)

        self._authenticate_if_needed()
        self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.leave", "action_approve",
            [[leave_id]]
        )
        return self.get_leave_by_id(leave_id)

    def reject_leave_request(self, leave_id: int, reason: str = "") -> LeaveRequest:
        """
        Human-in-the-Loop action: transitions leave from DRAFT to REJECTED.
        """
        if self.use_mock:
            raw = mock_odoo_handler.reject_leave_request(leave_id=leave_id, reason=reason)
            return LeaveRequest(**raw)

        self._authenticate_if_needed()
        self.models.execute_kw(
            self.db, self.uid, self.password,
            "hr.leave", "action_refuse",
            [[leave_id]]
        )
        return self.get_leave_by_id(leave_id)


# Global client instance
odoo_client = OdooClient()
