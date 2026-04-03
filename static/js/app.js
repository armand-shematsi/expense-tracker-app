/* ─────────────────────────────────────────────────────────────────
   Expense Tracker — Frontend JavaScript
   All communication with Flask API via fetch().
───────────────────────────────────────────────────────────────── */

const API = "/api/expenses";

// ── Category config ───────────────────────────────────────────────
const CATEGORY_CONFIG = {
  Food:          { emoji: "🍔", color: "#7c3aed" },
  Transport:     { emoji: "🚗", color: "#06b6d4" },
  Bills:         { emoji: "💡", color: "#f59e0b" },
  Shopping:      { emoji: "🛍️", color: "#ec4899" },
  Health:        { emoji: "🏥", color: "#22c55e" },
  Entertainment: { emoji: "🎬", color: "#f97316" },
  Education:     { emoji: "📚", color: "#3b82f6" },
  Other:         { emoji: "📦", color: "#8b5cf6" },
};

function catEmoji(cat)  { return (CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other).emoji; }
function catColor(cat)  { return (CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other).color; }

// ── DOM refs ──────────────────────────────────────────────────────
const totalSpentEl   = document.getElementById("totalSpent");
const monthlySpentEl = document.getElementById("monthlySpent");
const topCategoryEl  = document.getElementById("topCategory");
const txCountEl      = document.getElementById("txCount");
const expenseBody    = document.getElementById("expenseBody");
const emptyRow       = document.getElementById("emptyRow");
const categoryFilter = document.getElementById("categoryFilter");
const modalOverlay   = document.getElementById("modalOverlay");
const modalTitle     = document.getElementById("modalTitle");
const expenseForm    = document.getElementById("expenseForm");
const expenseIdInput = document.getElementById("expenseId");
const fTitle         = document.getElementById("fTitle");
const fAmount        = document.getElementById("fAmount");
const fDate          = document.getElementById("fDate");
const fCategory      = document.getElementById("fCategory");
const fNotes         = document.getElementById("fNotes");
const toastEl        = document.getElementById("toast");

// ── Chart instance ────────────────────────────────────────────────
let chartInstance = null;

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = "info") {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = `toast ${type} show`;
  toastTimer = setTimeout(() => { toastEl.className = "toast"; }, 3200);
}

// ── Animated counter ──────────────────────────────────────────────
function animateValue(el, target, prefix = "$") {
  const start = parseFloat(el.dataset.raw || "0");
  const duration = 600;
  const startTime = performance.now();
  const isDecimal = prefix === "$";

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = start + (target - start) * eased;
    el.textContent = isDecimal
      ? "$" + current.toFixed(2)
      : Math.round(current).toString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  el.dataset.raw = target;
}

// ── Format date for display ───────────────────────────────────────
function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Fetch & render all ────────────────────────────────────────────
async function loadAll() {
  const cat = categoryFilter.value;
  const [expenses, summary] = await Promise.all([
    fetch(`${API}?category=${encodeURIComponent(cat)}`).then(r => r.json()),
    fetch(`${API}/summary`).then(r => r.json()),
  ]);

  renderTable(expenses);
  renderSummary(summary);
  renderChart(summary.by_category);
}

// ── Render table ──────────────────────────────────────────────────
function renderTable(expenses) {
  // Remove existing expense rows
  Array.from(expenseBody.querySelectorAll(".expense-row")).forEach(r => r.remove());

  if (expenses.length === 0) {
    emptyRow.style.display = "";
    return;
  }
  emptyRow.style.display = "none";

  expenses.forEach((exp, i) => {
    const tr = document.createElement("tr");
    tr.className = "expense-row";
    tr.style.animationDelay = `${i * 40}ms`;
    tr.dataset.id = exp.id;
    tr.innerHTML = `
      <td>
        <div style="font-weight:500">${escHtml(exp.title)}</div>
        ${exp.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${escHtml(exp.notes.substring(0, 50))}${exp.notes.length > 50 ? "…" : ""}</div>` : ""}
      </td>
      <td>
        <span class="category-badge" style="background:${catColor(exp.category)}22;color:${catColor(exp.category)}">
          ${catEmoji(exp.category)} ${escHtml(exp.category)}
        </span>
      </td>
      <td style="color:var(--text-muted)">${fmtDate(exp.date)}</td>
      <td style="font-weight:700">$${parseFloat(exp.amount).toFixed(2)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon edit-btn" title="Edit" aria-label="Edit expense" data-id="${exp.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9d5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-btn" title="Delete" aria-label="Delete expense" data-id="${exp.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    `;
    expenseBody.appendChild(tr);
  });

  // Attach row-level listeners
  expenseBody.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(parseInt(btn.dataset.id)));
  });
  expenseBody.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteExpense(parseInt(btn.dataset.id)));
  });
}

// ── Render summary cards ──────────────────────────────────────────
function renderSummary(summary) {
  animateValue(totalSpentEl, summary.total);
  animateValue(monthlySpentEl, summary.monthly);
  topCategoryEl.textContent = summary.top_category === "N/A"
    ? "—"
    : `${catEmoji(summary.top_category)} ${summary.top_category}`;
  
  // Count from table
  fetch(API).then(r => r.json()).then(all => {
    animateValue(txCountEl, all.length, "");
  });
}

// ── Render chart ──────────────────────────────────────────────────
function renderChart(byCategory) {
  const chartTotal = document.getElementById("chartTotal");
  const chartLegend = document.getElementById("chartLegend");

  const labels  = byCategory.map(d => d.category);
  const data    = byCategory.map(d => d.total);
  const colors  = labels.map(l => catColor(l));
  const total   = data.reduce((a, b) => a + b, 0);

  chartTotal.textContent = total > 0
    ? "$" + total.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : "$0";

  // Legend
  chartLegend.innerHTML = byCategory.map(d => `
    <div class="legend-item">
      <div class="legend-left">
        <span class="legend-dot" style="background:${catColor(d.category)}"></span>
        ${catEmoji(d.category)} ${escHtml(d.category)}
      </div>
      <span class="legend-amount">$${parseFloat(d.total).toFixed(2)}</span>
    </div>
  `).join("");

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  if (byCategory.length === 0) {
    chartTotal.textContent = "$0";
    return;
  }

  const ctx = document.getElementById("categoryChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + "cc"),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: "72%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#13162a",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#e8eaf6",
          bodyColor: "#8b92b8",
          padding: 12,
          callbacks: {
            label: ctx => ` $${ctx.parsed.toFixed(2)}`
          }
        }
      },
      animation: { animateRotate: true, duration: 700, easing: "easeOutQuart" }
    }
  });
}

// ── Modal helpers ─────────────────────────────────────────────────
function openModal(title = "Add Expense") {
  modalTitle.textContent = title;
  modalOverlay.classList.add("active");
  setTimeout(() => fTitle.focus(), 280);
}

function closeModal() {
  modalOverlay.classList.remove("active");
  expenseForm.reset();
  expenseIdInput.value = "";
  [fTitle, fAmount, fDate, fCategory, fNotes].forEach(el => el.classList.remove("error"));
}

function openAddModal() {
  fDate.value = new Date().toISOString().split("T")[0];
  openModal("Add Expense");
}

async function openEditModal(id) {
  // Fetch the specific expense from the list already in the DOM
  const rows = [...expenseBody.querySelectorAll(".expense-row")];
  const row  = rows.find(r => parseInt(r.dataset.id) === id);
  if (!row) return;

  // Re-fetch full expense data from API
  const expenses = await fetch(API).then(r => r.json());
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;

  expenseIdInput.value = exp.id;
  fTitle.value    = exp.title;
  fAmount.value   = parseFloat(exp.amount).toFixed(2);
  fDate.value     = exp.date;
  fCategory.value = exp.category;
  fNotes.value    = exp.notes || "";
  openModal("Edit Expense");
}

// ── Validation ────────────────────────────────────────────────────
function validate() {
  let ok = true;
  [fTitle, fAmount, fDate, fCategory].forEach(el => {
    el.classList.remove("error");
    if (!el.value.trim()) { el.classList.add("error"); ok = false; }
  });
  if (fAmount.value && parseFloat(fAmount.value) <= 0) {
    fAmount.classList.add("error"); ok = false;
  }
  return ok;
}

// ── Save expense (add or update) ──────────────────────────────────
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) { showToast("Please fill in all required fields", "error"); return; }

  const id      = expenseIdInput.value;
  const payload = {
    title:    fTitle.value.trim(),
    amount:   parseFloat(fAmount.value),
    category: fCategory.value,
    date:     fDate.value,
    notes:    fNotes.value.trim(),
  };

  const url    = id ? `${API}/${id}` : API;
  const method = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || "Something went wrong", "error");
      return;
    }

    closeModal();
    showToast(id ? "Expense updated ✅" : "Expense added ✅", "success");
    await loadAll();
  } catch {
    showToast("Network error. Please try again.", "error");
  }
});

// ── Delete expense ────────────────────────────────────────────────
async function deleteExpense(id) {
  if (!confirm("Delete this expense?")) return;
  try {
    const res = await fetch(`${API}/${id}`, { method: "DELETE" });
    if (!res.ok) { showToast("Failed to delete", "error"); return; }
    showToast("Expense deleted 🗑️", "info");
    await loadAll();
  } catch {
    showToast("Network error", "error");
  }
}

// ── Escape HTML ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Event listeners ───────────────────────────────────────────────
document.getElementById("openAddModal").addEventListener("click", openAddModal);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
categoryFilter.addEventListener("change", loadAll);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("active")) closeModal();
});

// ── Init ──────────────────────────────────────────────────────────
loadAll();
