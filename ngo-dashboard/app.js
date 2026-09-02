const API_BASE = window.API_BASE || "http://localhost:8000";
const TOKEN_KEY = "inteliscrap_ngo_token";

let token = localStorage.getItem(TOKEN_KEY) || null;
let dailyChart = null;
let materialChart = null;

const $ = (id) => document.getElementById(id);

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function setStatus(message) {
  $("login-status").textContent = message;
}

async function requestOtp(phone) {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phone, role: "ngo" }),
  });
  if (!res.ok) throw new Error("OTP request failed");
}

async function verifyOtp(phone, code) {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phone, otp_code: code }),
  });
  if (!res.ok) throw new Error("OTP verification failed");
  const data = await res.json();
  token = data.access_token;
  localStorage.setItem(TOKEN_KEY, token);
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

function renderSummary(data) {
  $("tonnage").textContent = data.total_tonnage_kg.toLocaleString();
  $("carbon").textContent = data.total_carbon_offset_kg_co2e.toLocaleString();
  $("income").textContent = data.total_collector_income_naira.toLocaleString();
  $("txn-count").textContent = data.transactions_count;
}

function renderDaily(data) {
  const ctx = $("daily-chart").getContext("2d");
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((p) => p.period),
      datasets: [
        {
          label: "Tonnage (kg)",
          data: data.map((p) => p.tonnage_kg),
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.12)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function renderByMaterial(data) {
  const ctx = $("material-chart").getContext("2d");
  if (materialChart) materialChart.destroy();
  materialChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((m) => m.material),
      datasets: [
        {
          label: "Tonnage (kg)",
          data: data.map((m) => m.tonnage_kg),
          backgroundColor: "#059669",
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

async function loadDashboard() {
  const [summary, daily, byMaterial] = await Promise.all([
    fetchJson("/api/v1/impact/summary"),
    fetchJson("/api/v1/impact/daily"),
    fetchJson("/api/v1/impact/by-material"),
  ]);
  renderSummary(summary);
  renderDaily(daily);
  renderByMaterial(byMaterial);
  $("login").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logout").classList.remove("hidden");
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Requesting OTP…");
  try {
    await requestOtp($("phone").value);
    $("otp-form").classList.remove("hidden");
    setStatus("OTP sent. Enter the code.");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

$("otp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Verifying…");
  try {
    await verifyOtp($("phone").value, $("otp").value);
    await loadDashboard();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

$("logout").addEventListener("click", () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

if (token) {
  loadDashboard().catch(() => {
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  });
}
