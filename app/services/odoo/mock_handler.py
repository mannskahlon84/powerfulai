from datetime import datetime, date
from typing import Any, Dict, List, Optional
import copy


class MockOdooHandler:
    """
    Stateful in-memory mock Odoo API handler simulating hr.employee and hr.leave models.
    Preloaded with Qatar Labour Law compliant leave balances (21/28 days Annual Leave,
    14 days Sick Leave, 50 days Maternity Leave).
    """
    def __init__(self):
        self._employees: Dict[int, Dict[str, Any]] = {
            1: {
                "id": 1,
                "name": "Alice Vance",
                "email": "alice.vance@company.qa",
                "department": "Engineering",
                "job_title": "Senior Full-Stack Engineer",
                "manager_id": 3,
                "remaining_leaves": {
                    "Annual Leave": 21.0,  # 3 weeks under Qatar Labour Law (< 5 yrs)
                    "Sick Leave": 14.0,    # 2 weeks full pay under Qatar Labour Law
                    "Maternity Leave": 50.0 # 50 days under Qatar Labour Law
                }
            },
            2: {
                "id": 2,
                "name": "Bob Martin",
                "email": "bob.martin@company.qa",
                "department": "People & Talent",
                "job_title": "Senior HR Specialist",
                "manager_id": 3,
                "remaining_leaves": {
                    "Annual Leave": 28.0,  # 4 weeks under Qatar Labour Law (>= 5 yrs)
                    "Sick Leave": 14.0,
                    "Maternity Leave": 0.0
                }
            },
            3: {
                "id": 3,
                "name": "Elena Rostova",
                "email": "elena.rostova@company.qa",
                "department": "Leadership",
                "job_title": "VP of Engineering",
                "manager_id": None,
                "remaining_leaves": {
                    "Annual Leave": 28.0,
                    "Sick Leave": 14.0,
                    "Maternity Leave": 50.0
                }
            },
            4: {
                "id": 4,
                "name": "Tariq Al-Thani",
                "email": "tariq.althani@company.qa",
                "department": "Product",
                "job_title": "Senior Product Manager",
                "manager_id": 3,
                "remaining_leaves": {
                    "Annual Leave": 21.0,
                    "Sick Leave": 14.0,
                    "Maternity Leave": 0.0
                }
            }
        }
        
        self._leaves: Dict[int, Dict[str, Any]] = {
            101: {
                "id": 101,
                "employee_id": 1,
                "employee_name": "Alice Vance",
                "leave_type": "Annual Leave",
                "start_date": "2026-06-01",
                "end_date": "2026-06-05",
                "reason": "Summer holiday in Doha",
                "state": "approved",
                "created_at": "2026-05-15T10:00:00"
            },
            102: {
                "id": 102,
                "employee_id": 2,
                "employee_name": "Bob Martin",
                "leave_type": "Sick Leave",
                "start_date": "2026-07-10",
                "end_date": "2026-07-11",
                "reason": "Flu recovery (Medical certificate provided)",
                "state": "approved",
                "created_at": "2026-07-10T08:30:00"
            }
        }
        self._next_leave_id = 103

    def get_all_employees(self) -> List[Dict[str, Any]]:
        return list(copy.deepcopy(self._employees).values())

    def get_employee(self, employee_id: int) -> Optional[Dict[str, Any]]:
        emp = self._employees.get(employee_id)
        return copy.deepcopy(emp) if emp else None

    def search_employees(self, domain: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        """
        Simulate Odoo search domain on hr.employee.
        Supports simple string filtering by name or department.
        """
        all_emps = self.get_all_employees()
        if not domain:
            return all_emps
        results = []
        for emp in all_emps:
            match = True
            for condition in domain:
                if len(condition) == 3:
                    field, op, value = condition
                    emp_val = str(emp.get(field, "")).lower()
                    val = str(value).lower()
                    if op in ("ilike", "=") and val not in emp_val:
                        match = False
                        break
            if match:
                results.append(emp)
        return results

    def get_leave_balance(self, employee_id: int) -> Dict[str, float]:
        emp = self._employees.get(employee_id)
        if not emp:
            return {}
        return copy.deepcopy(emp["remaining_leaves"])

    def get_leaves(self, employee_id: Optional[int] = None, state: Optional[str] = None) -> List[Dict[str, Any]]:
        leaves = list(copy.deepcopy(self._leaves).values())
        if employee_id is not None:
            leaves = [l for l in leaves if l["employee_id"] == employee_id]
        if state is not None:
            leaves = [l for l in leaves if l["state"].lower() == state.lower()]
        return sorted(leaves, key=lambda x: x["id"], reverse=True)

    def get_leave_by_id(self, leave_id: int) -> Optional[Dict[str, Any]]:
        leave = self._leaves.get(leave_id)
        return copy.deepcopy(leave) if leave else None

    def create_leave_request_draft(
        self,
        employee_id: int,
        leave_type: str,
        start_date: str,
        end_date: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        GUARDRAIL: All write actions creating a leave request MUST start in 'draft' state.
        """
        emp = self._employees.get(employee_id)
        if not emp:
            raise ValueError(f"Employee with ID {employee_id} not found in Odoo.")

        leave_id = self._next_leave_id
        self._next_leave_id += 1

        new_leave = {
            "id": leave_id,
            "employee_id": employee_id,
            "employee_name": emp["name"],
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason,
            "state": "draft",  # Always DRAFT!
            "created_at": datetime.now().isoformat()
        }
        self._leaves[leave_id] = new_leave
        return copy.deepcopy(new_leave)

    def approve_leave_request(self, leave_id: int, approved_by: str = "HR Manager") -> Dict[str, Any]:
        """
        Human-in-the-Loop action: Transitions DRAFT leave request to APPROVED
        and deducts requested days from employee's leave balance.
        """
        leave = self._leaves.get(leave_id)
        if not leave:
            raise ValueError(f"Leave Request {leave_id} not found.")
        
        if leave["state"] == "approved":
            return copy.deepcopy(leave)

        # Calculate number of days
        try:
            d1 = date.fromisoformat(leave["start_date"][:10])
            d2 = date.fromisoformat(leave["end_date"][:10])
            days = max(1.0, float((d2 - d1).days + 1))
        except Exception:
            days = 1.0

        emp = self._employees.get(leave["employee_id"])
        if emp and leave["leave_type"] in emp["remaining_leaves"]:
            emp["remaining_leaves"][leave["leave_type"]] = max(
                0.0, emp["remaining_leaves"][leave["leave_type"]] - days
            )

        leave["state"] = "approved"
        leave["approved_by"] = approved_by
        leave["approved_at"] = datetime.now().isoformat()
        return copy.deepcopy(leave)

    def reject_leave_request(self, leave_id: int, reason: str = "") -> Dict[str, Any]:
        """
        Human-in-the-Loop action: Transitions DRAFT leave request to REJECTED.
        """
        leave = self._leaves.get(leave_id)
        if not leave:
            raise ValueError(f"Leave Request {leave_id} not found.")

        leave["state"] = "rejected"
        leave["rejection_reason"] = reason
        leave["rejected_at"] = datetime.now().isoformat()
        return copy.deepcopy(leave)


# Global singleton instance for local state
mock_odoo_handler = MockOdooHandler()
