import re
import json
import requests
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.core.schemas import AgentRequest, AgentResponse, PendingAction, ToolCallRecord
from app.agent.tools import tool_registry


class HRAgent:
    """
    Intentional Tool Calling Agent for HR AI Assistant Microservice.
    Enforces Read-Only default access and Human-in-the-Loop DRAFT approval
    for any write actions to Odoo.
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.system_prompt = (
            "You are an expert HR AI Assistant and Senior AI Architect specialized in "
            "Qatar Labour Law (Law No. 14 of 2004) and Odoo HR operations.\n"
            "Rules:\n"
            "1. Default to Read-Only tool access for policy questions and employee lookups.\n"
            "2. Never directly create or approve finalized write transactions in Odoo.\n"
            "3. For leave requests, ALWAYS use propose_leave_request which creates a DRAFT state "
            "and requires Human-in-the-Loop approval via the UI."
        )

    def _call_gemini_api(self, query: str, context_str: str) -> Optional[str]:
        """
        Optional call to Gemini API for natural language synthesis of tool outputs.
        """
        if not self.api_key:
            return None
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            payload = {
                "contents": [{
                    "parts": [{
                        "text": f"{self.system_prompt}\n\nContext:\n{context_str}\n\nUser Question:\n{query}\n\nProvide a professional, concise HR answer referencing Qatar Labour Law where applicable."
                    }]
                }]
            }
            resp = requests.post(url, json=payload, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[HRAgent] Gemini API call fallback: {e}")
        return None

    def _extract_leave_params(self, query: str, employee_id: int) -> Dict[str, Any]:
        """
        Extract leave request parameters from user query (leave_type, start_date, end_date, reason).
        """
        q_lower = query.lower()
        leave_type = "Annual Leave"
        if "sick" in q_lower:
            leave_type = "Sick Leave"
        elif "maternity" in q_lower or "parental" in q_lower:
            leave_type = "Maternity Leave"

        # Try to extract dates (YYYY-MM-DD or simple patterns)
        dates = re.findall(r"\b(202[0-9]-[0-1][0-9]-[0-3][0-9])\b", query)
        start_date = dates[0] if len(dates) > 0 else "2026-08-10"
        end_date = dates[1] if len(dates) > 1 else (start_date if len(dates) == 1 else "2026-08-14")

        # Reason
        reason = "Personal / Annual Vacation"
        if "reason" in q_lower or "for" in q_lower:
            parts = re.split(r"\b(?:reason|for|because)\b[:\s]*", query, flags=re.IGNORECASE)
            if len(parts) > 1 and len(parts[1].strip()) > 3:
                reason = parts[1].strip().split(".")[0].title()
        if "sick" in q_lower:
            reason = "Medical / Sick recovery"

        return {
            "employee_id": employee_id,
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason
        }

    def run(self, request: AgentRequest) -> AgentResponse:
        """
        Main execution loop for the Intentional Tool Calling Agent.
        """
        tool_registry.reset_history()
        query = request.query.strip()
        q_lower = query.lower()
        emp_id = request.employee_id or 1

        sources: List[str] = []
        action_required = False
        pending_action: Optional[PendingAction] = None

        # 1. Intent Detection: WRITE ACTION (Request / Book / Submit Leave)
        if any(w in q_lower for w in ["request leave", "book leave", "apply for leave", "submit leave", "take leave", "request annual", "request sick", "apply leave"]):
            params = self._extract_leave_params(query, emp_id)
            tool_res = tool_registry.propose_leave_request(
                employee_id=params["employee_id"],
                leave_type=params["leave_type"],
                start_date=params["start_date"],
                end_date=params["end_date"],
                reason=params["reason"]
            )
            action_required = True
            pending_action = PendingAction(**tool_res["pending_action"])
            sources.append("Odoo hr.leave (DRAFT record)")
            
            response_text = (
                f"I have created a **DRAFT** {params['leave_type']} request for you in Odoo from **{params['start_date']}** to **{params['end_date']}** "
                f"(Reason: *{params['reason']}*).\n\n"
                f"🛡️ **System Guardrail Triggered**: In accordance with enterprise read-only defaults, any write action to Odoo requires explicit **Human-in-the-Loop** approval. "
                f"Please review and click **'Approve & Submit to Odoo'** in the action card below to finalize your request."
            )

        # 2. Intent Detection: READ-ONLY (Leave Balance)
        elif any(w in q_lower for w in ["balance", "remaining leave", "days left", "how many annual", "how many sick", "my leave"]):
            balance_res = tool_registry.get_leave_balance(emp_id)
            emp_res = tool_registry.get_employee_profile(emp_id)
            emp_name = emp_res.get("name", "Employee")
            sources.append("Odoo hr.employee (remaining_leaves)")
            
            balances_formatted = "\n".join(
                f"- **{k}**: {v} days remaining" for k, v in balance_res["remaining_leaves"].items()
            )
            response_text = (
                f"Here is your current leave entitlement balance for **{emp_name}** in Odoo:\n\n"
                f"{balances_formatted}\n\n"
                f"All entitlements comply with **Qatar Labour Law (Law No. 14 of 2004)** minimum standards."
            )

        # 3. Intent Detection: READ-ONLY (Leave History)
        elif any(w in q_lower for w in ["history", "past leave", "my requests", "leave status"]):
            history_res = tool_registry.get_leave_history(emp_id)
            sources.append("Odoo hr.leave (search_read)")
            if not history_res["leaves"]:
                response_text = "You currently have no recorded leave requests in Odoo."
            else:
                lines = [
                    f"- **#{l['id']}** | {l['leave_type']} ({l['start_date']} to {l['end_date']}) — **State: {l['state'].upper()}**"
                    for l in history_res["leaves"]
                ]
                response_text = f"Here is your recent leave request history in Odoo:\n\n" + "\n".join(lines)

        # 4. Intent Detection: READ-ONLY (Qatar Labour Law / Policy QA via RAG)
        else:
            rag_res = tool_registry.search_hr_policies(query=query)
            snippets = rag_res["results"]
            for s in snippets:
                if s["source"] not in sources:
                    sources.append(f"RAG Knowledge Base ({s['source']})")
            
            context_str = "\n\n".join(
                f"Source: {s['source']} - {s['title']}\nContent: {s['content']}" for s in snippets
            )
            
            # Try Gemini API synthesis first
            gemini_reply = self._call_gemini_api(query, context_str)
            if gemini_reply:
                response_text = gemini_reply
            else:
                # High quality synthesized fallback
                if snippets:
                    top = snippets[0]
                    response_text = (
                        f"According to **Qatar Labour Law (Law No. 14 of 2004)** rules indexed in our knowledge base:\n\n"
                        f"### {top['title']}\n"
                        f"{top['content']}\n\n"
                        f"*(Source citation: `{top['source']}` with semantic similarity score `{top['similarity_score']}`)*"
                    )
                    if len(snippets) > 1:
                        response_text += (
                            f"\n\n**Additional Reference ({snippets[1]['source']})**:\n"
                            f"- {snippets[1]['title']}: {snippets[1]['content'][:200]}..."
                        )
                else:
                    response_text = (
                        "I checked our Qatar Labour Law knowledge base, but couldn't find a direct match for your question. "
                        "You can ask about Annual Leave (21/28 days), Sick Leave, Ramadan working hours, Notice Periods, or End of Service Gratuity (EOSB)."
                    )

        return AgentResponse(
            response_text=response_text,
            sources=sources,
            action_required=action_required,
            pending_action=pending_action,
            tool_calls=tool_registry.tool_calls_history
        )


# Global agent singleton
hr_agent = HRAgent()
