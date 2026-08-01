// HR AI Assistant Dashboard Interactive Script — Light Theme & WOW-Factor Edition

let currentPendingAction = null;
let totalAuditCalls = 0;
let employeeProfiles = {
    "1": { name: "Alice Vance", initials: "AV", bg: "from-indigo-500 to-purple-600", role: "Senior Engineer" },
    "2": { name: "Bob Martin", initials: "BM", bg: "from-emerald-500 to-teal-600", role: "HR Specialist" },
    "3": { name: "Elena Rostova", initials: "ER", bg: "from-rose-500 to-pink-600", role: "VP Engineering" },
    "4": { name: "Tariq Al-Thani", initials: "TA", bg: "from-amber-500 to-orange-600", role: "Product Manager" }
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }
    // 2. Load stored theme preference (default to Light Theme)
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.getElementById("theme-icon-sun").classList.remove("hidden");
        document.getElementById("theme-icon-moon").classList.add("hidden");
    } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
        document.getElementById("theme-icon-sun").classList.add("hidden");
        document.getElementById("theme-icon-moon").classList.remove("hidden");
    }

    // 3. Set initial employee badge
    handleEmployeeChange();

    // 4. Pre-load Odoo and RAG data
    loadOdooData();
    loadRagPolicies();
});

// Toggle Light / Dark Mode
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
        html.classList.remove("dark");
        html.classList.add("light");
        localStorage.setItem("theme", "light");
        document.getElementById("theme-icon-sun").classList.add("hidden");
        document.getElementById("theme-icon-moon").classList.remove("hidden");
    } else {
        html.classList.add("dark");
        html.classList.remove("light");
        localStorage.setItem("theme", "dark");
        document.getElementById("theme-icon-sun").classList.remove("hidden");
        document.getElementById("theme-icon-moon").classList.add("hidden");
    }
}

// Handle Employee Switcher
function handleEmployeeChange() {
    const select = document.getElementById("employee-select");
    const empId = select.value || "1";
    const emp = employeeProfiles[empId] || employeeProfiles["1"];

    // Update Top Avatar
    const avatar = document.getElementById("active-emp-avatar");
    avatar.textContent = emp.initials;
    avatar.className = `w-7 h-7 rounded-full bg-gradient-to-br ${emp.bg} text-white font-bold text-xs flex items-center justify-center shadow-sm transition-all transform scale-105`;

    // Update Chat Chip
    const chip = document.getElementById("current-emp-chip");
    if (chip) {
        chip.textContent = `Testing as: ${emp.name} (${emp.role})`;
    }
}

// Tab switching
function switchTab(tabId) {
    const tabs = ['chat', 'odoo', 'rag'];
    tabs.forEach(t => {
        const section = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === tabId) {
            section.classList.remove('hidden');
            btn.classList.add('bg-indigo-50', 'text-indigo-700', 'border', 'border-indigo-200/80', 'dark:bg-indigo-900/40', 'dark:text-indigo-300', 'dark:border-indigo-700/50', 'shadow-sm');
            btn.classList.remove('text-slate-600', 'dark:text-slate-400');
        } else {
            section.classList.add('hidden');
            btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'border', 'border-indigo-200/80', 'dark:bg-indigo-900/40', 'dark:text-indigo-300', 'dark:border-indigo-700/50', 'shadow-sm');
            btn.classList.add('text-slate-600', 'dark:text-slate-400');
        }
    });

    if (tabId === 'odoo') {
        loadOdooData();
    } else if (tabId === 'rag') {
        loadRagPolicies();
    }
}

// Send quick prompt from interactive chat buttons
function sendQuickPrompt(text) {
    const input = document.getElementById("chat-input");
    input.value = text;
    document.getElementById("chat-submit-btn").click();
}

// Quick Test for Leave Proposal Guardrail
function testQuickLeaveProposal() {
    switchTab('chat');
    sendQuickPrompt("I want to request Annual Leave from 2026-08-10 to 2026-08-14 for a family summer trip.");
}

// Clear chat
function clearChat() {
    const container = document.getElementById("chat-messages");
    container.innerHTML = `
        <div class="flex items-start space-x-3.5 animate-msg">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                <i data-lucide="bot" class="w-5 h-5 text-white"></i>
            </div>
            <div class="glass-card bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-5 max-w-2xl text-sm leading-relaxed border border-slate-200/90 dark:border-slate-700 shadow-sm">
                <p class="font-semibold text-slate-900 dark:text-white mb-1">Chat Cleared.</p>
                <p class="text-slate-600 dark:text-slate-300">How can I assist you with Qatar Labour Law or Odoo HR today?</p>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

// Append User Message to Chat Feed
function appendUserMessage(text) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "flex items-start justify-end space-x-3 animate-msg";
    div.innerHTML = `
        <div class="bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-2xl rounded-tr-none p-4 max-w-xl text-sm leading-relaxed shadow-md shadow-indigo-500/15 font-medium">
            ${escapeHtml(text)}
        </div>
        <div class="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <i data-lucide="user" class="w-4 h-4 text-slate-200"></i>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (window.lucide) lucide.createIcons();
}

// Append Typing Indicator
function appendTypingIndicator() {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.id = "typing-indicator";
    div.className = "flex items-start space-x-3.5 animate-msg";
    div.innerHTML = `
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <i data-lucide="bot" class="w-5 h-5 text-white animate-pulse"></i>
        </div>
        <div class="glass-card bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2 border border-slate-200 dark:border-slate-700 shadow-sm">
            <span>Executing intentional agent tools...</span>
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style="animation-delay: 300ms"></span>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (window.lucide) lucide.createIcons();
}

// Remove Typing Indicator
function removeTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
}

// Append Agent Response
function appendAgentMessage(response) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "flex items-start space-x-3.5 animate-msg";

    // Tool Execution Badges
    let toolsHtml = "";
    if (response.tool_calls && response.tool_calls.length > 0) {
        const badges = response.tool_calls.map(t => {
            const isWrite = t.access_type === "WRITE_GUARDED_DRAFT";
            const badgeClass = isWrite
                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700";
            const iconName = isWrite ? "shield-alert" : "search";
            return `<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badgeClass} mr-1.5 mb-2 shadow-xs">
                <i data-lucide="${iconName}" class="w-3.5 h-3.5 inline"></i>
                <span>${t.tool_name}</span>
                <span class="opacity-75 font-mono text-[10px]">[${t.access_type}]</span>
            </span>`;
        }).join("");
        toolsHtml = `<div class="mb-3 flex flex-wrap">${badges}</div>`;
    }

    // Markdown content parsing
    const parsedText = marked.parse(response.response_text || "");

    div.innerHTML = `
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <i data-lucide="bot" class="w-5 h-5 text-white"></i>
        </div>
        <div class="glass-card bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-5 max-w-2xl text-sm leading-relaxed border border-slate-200/90 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200">
            ${toolsHtml}
            <div class="prose prose-slate dark:prose-invert prose-sm max-w-none">
                ${parsedText}
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (window.lucide) lucide.createIcons();
}

// Update Agent Tool Audit Log in Sidebar
function updateToolAuditLog(toolCalls) {
    if (!toolCalls || toolCalls.length === 0) return;
    const list = document.getElementById("tool-audit-list");
    const countBadge = document.getElementById("audit-count");

    if (totalAuditCalls === 0) {
        list.innerHTML = "";
    }

    toolCalls.forEach(t => {
        totalAuditCalls++;
        const isWrite = t.access_type === "WRITE_GUARDED_DRAFT";
        const badgeColor = isWrite
            ? "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-950/50"
            : "text-indigo-700 border-indigo-200 bg-indigo-50 dark:text-indigo-300 dark:border-indigo-700 dark:bg-indigo-950/50";

        const item = document.createElement("div");
        item.className = "p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs transition hover:border-indigo-300";
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${t.tool_name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold border ${badgeColor}">${t.access_type}</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium">${escapeHtml(t.result_summary)}</p>
        `;
        list.prepend(item);
    });

    countBadge.textContent = `${totalAuditCalls} calls`;
}

// Handle Chat Form Submit
async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    const empSelect = document.getElementById("employee-select");
    const employeeId = parseInt(empSelect.value) || 1;

    input.value = "";
    appendUserMessage(text);
    appendTypingIndicator();

    try {
        const res = await fetch("/api/v1/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: text,
                employee_id: employeeId,
                session_id: "dashboard-session"
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Error communicating with agent");
        }

        const data = await res.json();
        removeTypingIndicator();
        appendAgentMessage(data);
        updateToolAuditLog(data.tool_calls);

        // Trigger Human-in-the-Loop Action Card if required
        if (data.action_required && data.pending_action) {
            showHITLApprovalCard(data.pending_action);
            loadOdooData(); // refresh live Odoo tables immediately
        }

    } catch (err) {
        removeTypingIndicator();
        appendAgentMessage({
            response_text: `⚠️ **Error**: ${err.message}`,
            tool_calls: []
        });
    }
}

// Show HITL Approval Card in Sidebar
function showHITLApprovalCard(pendingAction) {
    currentPendingAction = pendingAction;
    const card = document.getElementById("hitl-card-container");
    const payload = pendingAction.payload;

    document.getElementById("hitl-leave-id").textContent = `#${payload.leave_id}`;
    document.getElementById("hitl-emp-name").textContent = payload.employee_name;
    document.getElementById("hitl-leave-type").textContent = payload.leave_type;
    document.getElementById("hitl-dates").textContent = `${payload.start_date} to ${payload.end_date}`;
    document.getElementById("hitl-reason").textContent = payload.reason;

    card.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

// Process Human-in-the-Loop Approval or Rejection
async function processHITL(status) {
    if (!currentPendingAction) return;

    const leaveId = currentPendingAction.payload.leave_id;
    const actionId = currentPendingAction.action_id;

    try {
        const res = await fetch("/api/v1/odoo/hitl/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action_id: actionId,
                leave_id: leaveId,
                status: status,
                comment: `Processed (${status}) via Light Theme Dashboard`
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Failed to process HITL action");
        }

        const updatedLeave = await res.json();
        document.getElementById("hitl-card-container").classList.add("hidden");

        // Celebration confetti if approved!
        if (status === "APPROVED" && typeof confetti === "function") {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        const emoji = status === "APPROVED" ? "✅" : "❌";
        const msgText = status === "APPROVED"
            ? `**HITL Guardrail Approved**: Leave Request **#${updatedLeave.id}** has been **APPROVED** and committed to Odoo \`hr.leave\`. The requested days have been deducted from **${updatedLeave.employee_name}**'s entitlement.`
            : `**HITL Guardrail Rejected**: Leave Request **#${updatedLeave.id}** has been **REJECTED**. No balance was deducted.`;

        appendAgentMessage({
            response_text: `${emoji} ${msgText}`,
            tool_calls: [{
                tool_name: status === "APPROVED" ? "odoo.approve_leave_request" : "odoo.reject_leave_request",
                access_type: "WRITE_COMMIT",
                result_summary: `Leave #${updatedLeave.id} transitioned from DRAFT to ${status}`
            }]
        });

        currentPendingAction = null;
        loadOdooData();

    } catch (err) {
        alert("Error processing HITL approval: " + err.message);
    }
}

// Load Live Odoo Database Data
async function loadOdooData() {
    try {
        // 1. Employees
        const empRes = await fetch("/api/v1/odoo/employees");
        if (empRes.ok) {
            const employees = await empRes.json();
            renderEmployeesTable(employees);
        }
        // 2. Leaves
        const leavesRes = await fetch("/api/v1/odoo/leaves");
        if (leavesRes.ok) {
            const leaves = await leavesRes.json();
            renderLeavesTable(leaves);
        }
    } catch (err) {
        console.error("Error loading Odoo data:", err);
    }
}

// Render Employees Table with Visual Progress Bars
function renderEmployeesTable(employees) {
    const tbody = document.getElementById("odoo-employees-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    employees.forEach(emp => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition";
        const annLeave = emp.remaining_leaves?.["Annual Leave"] ?? 0;
        const sickLeave = emp.remaining_leaves?.["Sick Leave"] ?? 0;
        const totalAnn = 28;
        const percent = Math.min(100, Math.max(0, Math.round((annLeave / totalAnn) * 100)));
        const barColor = percent > 50 ? "bg-emerald-500" : (percent > 25 ? "bg-amber-500" : "bg-rose-500");

        tr.innerHTML = `
            <td class="py-3.5 px-6 font-mono text-slate-400 font-semibold">#${emp.id}</td>
            <td class="py-3.5 px-6 font-bold text-slate-900 dark:text-white">${escapeHtml(emp.name)}</td>
            <td class="py-3.5 px-6 text-indigo-600 dark:text-indigo-400 font-medium">${escapeHtml(emp.department)}</td>
            <td class="py-3.5 px-6 text-slate-700 dark:text-slate-300">${escapeHtml(emp.job_title)}</td>
            <td class="py-3.5 px-6">
                <div class="space-y-1.5 max-w-xs">
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-slate-700 dark:text-slate-300">${annLeave} days left</span>
                        <span class="text-slate-400 font-mono">${percent}%</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full ${barColor} progress-bar-inner rounded-full" style="width: ${percent}%;"></div>
                    </div>
                </div>
            </td>
            <td class="py-3.5 px-6">
                <span class="font-bold text-teal-600 dark:text-teal-400">${sickLeave} days</span>
            </td>
            <td class="py-3.5 px-6 text-right">
                <button onclick="selectEmployee(${emp.id})" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition">
                    Act as ${emp.name.split(" ")[0]}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Quick Employee Selector Action from Table
function selectEmployee(empId) {
    const select = document.getElementById("employee-select");
    select.value = str(empId);
    handleEmployeeChange();
    switchTab('chat');
}

// Render Leaves Table
function renderLeavesTable(leaves) {
    const tbody = document.getElementById("odoo-leaves-tbody");
    const countBadge = document.getElementById("leave-table-count");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (countBadge) countBadge.textContent = `${leaves.length} Records`;

    leaves.forEach(l => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition";

        let badgeClass = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
        let stateIcon = "circle";
        if (l.state === "draft") {
            badgeClass = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700";
            stateIcon = "clock";
        }
        if (l.state === "approved") {
            badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700";
            stateIcon = "check-circle";
        }
        if (l.state === "rejected") {
            badgeClass = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700";
            stateIcon = "x-circle";
        }

        let actionHtml = "";
        if (l.state === "draft") {
            actionHtml = `
                <div class="flex items-center justify-end space-x-2">
                    <button onclick="quickApproveLeave(${l.id})" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition">
                        Approve
                    </button>
                    <button onclick="quickRejectLeave(${l.id})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-semibold rounded-lg text-xs transition">
                        Reject
                    </button>
                </div>
            `;
        } else {
            actionHtml = `<span class="text-xs text-slate-400 italic">Finalized</span>`;
        }

        tr.innerHTML = `
            <td class="py-3.5 px-6 font-mono text-slate-500 font-semibold">#${l.id}</td>
            <td class="py-3.5 px-6 font-bold text-slate-900 dark:text-white">${escapeHtml(l.employee_name)}</td>
            <td class="py-3.5 px-6 text-indigo-600 dark:text-indigo-400 font-medium">${escapeHtml(l.leave_type)}</td>
            <td class="py-3.5 px-6 font-mono text-xs text-slate-700 dark:text-slate-300">${escapeHtml(l.start_date)}</td>
            <td class="py-3.5 px-6 font-mono text-xs text-slate-700 dark:text-slate-300">${escapeHtml(l.end_date)}</td>
            <td class="py-3.5 px-6 text-slate-500 dark:text-slate-400 italic">${escapeHtml(l.reason)}</td>
            <td class="py-3.5 px-6">
                <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border uppercase ${badgeClass}">
                    <i data-lucide="${stateIcon}" class="w-3.5 h-3.5"></i>
                    <span>${escapeHtml(l.state)}</span>
                </span>
            </td>
            <td class="py-3.5 px-6 text-right">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}

// Quick Approve / Reject from Table
async function quickApproveLeave(leaveId) {
    try {
        await fetch(`/api/v1/odoo/leaves/${leaveId}/approve`, { method: "POST" });
        if (typeof confetti === "function") {
            confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        }
        loadOdooData();
    } catch (err) {
        alert("Error approving leave: " + err.message);
    }
}

async function quickRejectLeave(leaveId) {
    try {
        await fetch(`/api/v1/odoo/leaves/${leaveId}/reject`, { method: "POST" });
        loadOdooData();
    } catch (err) {
        alert("Error rejecting leave: " + err.message);
    }
}

// Load RAG Policy Knowledge Base
async function loadRagPolicies() {
    try {
        const res = await fetch("/api/v1/rag/policies");
        if (res.ok) {
            const policies = await res.json();
            renderRagPolicies(policies);
        }
    } catch (err) {
        console.error("Error loading RAG policies:", err);
    }
}

// Test RAG Search
async function testRagSearch() {
    const input = document.getElementById("rag-search-input");
    const query = input.value.trim();
    if (!query) {
        loadRagPolicies();
        return;
    }

    try {
        const res = await fetch("/api/v1/rag/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, top_k: 6 })
        });
        if (res.ok) {
            const results = await res.json();
            renderRagPolicies(results, true);
        }
    } catch (err) {
        console.error("Error searching RAG policies:", err);
    }
}

// Render RAG Policy Cards with Interactive Modal Trigger
function renderRagPolicies(policies, isSearch = false) {
    const container = document.getElementById("rag-policies-container");
    if (!container) return;
    container.innerHTML = "";

    if (policies.length === 0) {
        container.innerHTML = `<p class="col-span-3 text-center text-slate-500 italic py-12">No matching Qatar Labour Law articles found.</p>`;
        return;
    }

    policies.forEach(p => {
        const card = document.createElement("div");
        card.className = "glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between shadow-sm hover:shadow-md transition cursor-pointer";
        card.onclick = () => openPolicyModal(p.title, p.content, `${p.source} (Category: ${p.category})`);

        let scoreBadge = "";
        if (isSearch && p.similarity_score !== null && p.similarity_score !== undefined) {
            scoreBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                Match: ${p.similarity_score}
            </span>`;
        }

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">${escapeHtml(p.source)}</span>
                    ${scoreBadge}
                </div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-2 leading-snug">${escapeHtml(p.title)}</h3>
                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line line-clamp-5">${escapeHtml(p.content)}</p>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Category: <strong class="text-slate-700 dark:text-slate-300">${escapeHtml(p.category)}</strong></span>
                <span class="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center space-x-1">
                    <span>Read Article</span>
                    <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                </span>
            </div>
        `;
        container.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

// Open Interactive Policy Preview Modal
function openPolicyModal(title, content, source) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-content").textContent = content;
    document.getElementById("modal-source").textContent = source;
    document.getElementById("policy-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

// Close Policy Modal
function closePolicyModal() {
    document.getElementById("policy-modal").classList.add("hidden");
}

// Utility to escape HTML
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
