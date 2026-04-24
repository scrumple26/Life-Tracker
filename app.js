import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// ── Firebase init ─────────────────────────────────────
const config = window.LIFE_TRACKER_FIREBASE_CONFIG || {};
const firebaseReady = !!(config.apiKey && config.authDomain && config.projectId);
let auth = null;
if (firebaseReady) {
  const app = initializeApp(config);
  auth = getAuth(app);
}

// ── State ─────────────────────────────────────────────
let currentUser = null;

// ── DOM refs ─────────────────────────────────────────
const authPanel   = document.getElementById("auth-panel");
const appShell    = document.getElementById("app");
const signinForm  = document.getElementById("signin-form");
const registerForm= document.getElementById("register-form");
const authMsg     = document.getElementById("auth-msg");
const forgotBtn   = document.getElementById("forgot-btn");
const signoutBtn  = document.getElementById("signout-btn");
const userLabel   = document.getElementById("user-label");

const signinEmail    = document.getElementById("signin-email");
const signinPassword = document.getElementById("signin-password");
const signinShowPwd  = document.getElementById("signin-show-pwd");

const regEmail   = document.getElementById("reg-email");
const regPassword= document.getElementById("reg-password");
const regConfirm = document.getElementById("reg-confirm");
const regShowPwd = document.getElementById("reg-show-pwd");

const reqLen   = document.getElementById("req-len");
const reqUpper = document.getElementById("req-upper");
const reqLower = document.getElementById("req-lower");
const reqNum   = document.getElementById("req-num");

// ── Utilities ─────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim().toLowerCase());
}

function storageKey() {
  return currentUser ? `life-tracker-events-${currentUser.uid}` : null;
}

// ── Auth message ──────────────────────────────────────
function setAuthMsg(text, isError = false) {
  authMsg.textContent = text;
  authMsg.className = "auth-msg" + (isError ? " error" : text ? " success" : "");
}

// ── Auth state ────────────────────────────────────────
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      authPanel.hidden = true;
      appShell.hidden = false;
      userLabel.textContent = user.email;
      initApp();
    } else {
      authPanel.hidden = false;
      appShell.hidden = true;
      currentUser = null;
    }
  });
} else {
  setAuthMsg("Firebase is not configured. Add your config in firebase-config.js.", true);
}

// ── Auth switch (Sign In / Create Account) ────────────
document.querySelectorAll(".auth-switch-btn, .auth-link-btn[data-switch]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode || btn.dataset.switch;
    const isSignin = mode === "signin";
    signinForm.hidden = !isSignin;
    registerForm.hidden = isSignin;
    document.querySelectorAll(".auth-switch-btn").forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    setAuthMsg("");
  });
});

// ── Show password toggles ─────────────────────────────
signinShowPwd?.addEventListener("change", () => {
  signinPassword.type = signinShowPwd.checked ? "text" : "password";
});
regShowPwd?.addEventListener("change", () => {
  regPassword.type = regShowPwd.checked ? "text" : "password";
  regConfirm.type  = regShowPwd.checked ? "text" : "password";
});

// ── Password strength hints ───────────────────────────
regPassword?.addEventListener("input", () => {
  const v = regPassword.value;
  reqLen.classList.toggle("met",   v.length >= 8);
  reqUpper.classList.toggle("met", /[A-Z]/.test(v));
  reqLower.classList.toggle("met", /[a-z]/.test(v));
  reqNum.classList.toggle("met",   /[0-9]/.test(v));
});

// ── Sign in ───────────────────────────────────────────
signinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) { setAuthMsg("Firebase not configured.", true); return; }
  const email    = signinEmail.value.trim().toLowerCase();
  const password = signinPassword.value;
  if (!email || !password) { setAuthMsg("Enter email and password.", true); return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    signinForm.reset();
    setAuthMsg("");
  } catch (err) {
    const code = err?.code || "";
    if (code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("wrong-password")) {
      setAuthMsg("Invalid email or password.", true);
    } else if (code.includes("too-many-requests")) {
      setAuthMsg("Too many attempts. Try again in a bit.", true);
    } else {
      setAuthMsg("Unable to sign in right now.", true);
    }
  }
});

// ── Register ──────────────────────────────────────────
registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) { setAuthMsg("Firebase not configured.", true); return; }
  const email    = regEmail.value.trim().toLowerCase();
  const password = regPassword.value;
  const confirm  = regConfirm.value;
  if (!isValidEmail(email))          { setAuthMsg("Enter a valid email address.", true); return; }
  if (password.length < 8)           { setAuthMsg("Password must be at least 8 characters.", true); return; }
  if (!/[A-Z]/.test(password))       { setAuthMsg("Password must include an uppercase letter.", true); return; }
  if (!/[a-z]/.test(password))       { setAuthMsg("Password must include a lowercase letter.", true); return; }
  if (!/[0-9]/.test(password))       { setAuthMsg("Password must include a number.", true); return; }
  if (password !== confirm)          { setAuthMsg("Passwords do not match.", true); return; }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    registerForm.reset();
    setAuthMsg("");
  } catch (err) {
    const code = err?.code || "";
    if (code.includes("email-already-in-use")) {
      setAuthMsg("An account with that email already exists.", true);
    } else {
      setAuthMsg("Unable to create account right now.", true);
    }
  }
});

// ── Forgot password ───────────────────────────────────
forgotBtn?.addEventListener("click", async () => {
  if (!auth) { setAuthMsg("Firebase not configured.", true); return; }
  const email = signinEmail?.value.trim().toLowerCase() || "";
  if (!isValidEmail(email)) { setAuthMsg("Enter your email above, then click Forgot password.", true); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    setAuthMsg(`Password reset email sent to ${email}.`);
  } catch {
    setAuthMsg("Unable to send reset email.", true);
  }
});

// ── Sign out ──────────────────────────────────────────
signoutBtn?.addEventListener("click", async () => {
  if (auth) { try { await signOut(auth); } catch { /* ignore */ } }
});

// ── Tab switching ─────────────────────────────────────
let activeTab = "log";
const tabLog      = document.getElementById("tab-log");
const tabStadiums = document.getElementById("tab-stadiums");

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === activeTab) return;
    activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    tabLog.hidden      = tab !== "log";
    tabStadiums.hidden = tab !== "stadiums";
    if (tab === "stadiums") renderStadiumsTab();
  });
});

// ── Sports events storage ─────────────────────────────
const STORAGE_VERSION = "life-tracker-events-v1";

function loadEvents() {
  try {
    const key = storageKey();
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.id === "string").map((e) => ({
      id:        String(e.id),
      date:      isValidDate(e.date) ? e.date : today(),
      sport:     typeof e.sport === "string" ? e.sport : "other",
      homeTeam:  typeof e.homeTeam === "string" ? e.homeTeam : "",
      awayTeam:  typeof e.awayTeam === "string" ? e.awayTeam : "",
      homeScore: typeof e.homeScore === "number" ? e.homeScore : 0,
      awayScore: typeof e.awayScore === "number" ? e.awayScore : 0,
      stadium:   typeof e.stadium === "string" ? e.stadium : "",
      city:      typeof e.city === "string" ? e.city : "",
      side:      ["home","away","neutral"].includes(e.side) ? e.side : "neutral",
      scorers:   typeof e.scorers === "string" ? e.scorers : "",
      notes:     typeof e.notes === "string" ? e.notes : "",
      lat:       typeof e.lat === "number" ? e.lat : null,
      lng:       typeof e.lng === "number" ? e.lng : null,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
    }));
  } catch { return []; }
}

function saveEvents(events) {
  const key = storageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(events));
}

function newId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Sport / side labels ───────────────────────────────
const SPORT_LABELS = {
  soccer: "Soccer", basketball: "Basketball", baseball: "Baseball",
  "american-football": "Football", hockey: "Hockey", tennis: "Tennis",
  rugby: "Rugby", mma: "MMA/Boxing", other: "Other",
};
const SIDE_LABELS = { home: "Home fan", away: "Away fan", neutral: "Neutral" };

function sportLabel(s) { return SPORT_LABELS[s] || "Other"; }
function sideLabel(s)  { return SIDE_LABELS[s] || "Neutral"; }
function resultLine(e) {
  if (e.homeScore > e.awayScore) return `${esc(e.homeTeam)} won`;
  if (e.awayScore > e.homeScore) return `${esc(e.awayTeam)} won`;
  return "Draw";
}

// ── Render helpers ────────────────────────────────────
function eventItemHTML(e) {
  const scorers = e.sport === "soccer" && e.scorers
    ? `<span class="event-meta">Goals: ${esc(e.scorers)}</span>` : "";
  const notes = e.notes
    ? `<span class="event-notes">${esc(e.notes)}</span>` : "";
  return `
    <li class="event-item">
      <div class="event-info">
        <span class="event-title">${esc(e.homeTeam)} ${e.homeScore}–${e.awayScore} ${esc(e.awayTeam)}</span>
        <span class="event-meta">${sportLabel(e.sport)} · ${formatDate(e.date)} · ${sideLabel(e.side)}</span>
        <span class="event-meta">${esc(e.stadium)}, ${esc(e.city)} · ${resultLine(e)}</span>
        ${scorers}${notes}
      </div>
      <button class="btn btn-sm btn-danger" type="button"
        data-action="delete" data-id="${esc(e.id)}" aria-label="Delete event">✕</button>
    </li>`;
}

// ── Log Event tab ─────────────────────────────────────
const logDate      = document.getElementById("log-date");
const logSport     = document.getElementById("log-sport");
const logSide      = document.getElementById("log-side");
const logHomeTeam  = document.getElementById("log-home-team");
const logAwayTeam  = document.getElementById("log-away-team");
const logHomeScore = document.getElementById("log-home-score");
const logAwayScore = document.getElementById("log-away-score");
const logStadium   = document.getElementById("log-stadium");
const logCity      = document.getElementById("log-city");
const logScorers   = document.getElementById("log-scorers");
const logNotes     = document.getElementById("log-notes");
const scorersWrap  = document.getElementById("scorers-wrap");
const recentList   = document.getElementById("recent-list");
const recentEmpty  = document.getElementById("recent-empty");

if (logDate) logDate.value = today();

logSport?.addEventListener("change", () => {
  if (scorersWrap) scorersWrap.hidden = logSport.value !== "soccer";
});

function renderRecentEvents() {
  const events = loadEvents();
  const recent = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (!recent.length) {
    recentList.innerHTML = "";
    recentEmpty.hidden = false;
    return;
  }
  recentEmpty.hidden = true;
  recentList.innerHTML = recent.map(eventItemHTML).join("");
}

document.getElementById("log-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const date      = logDate?.value || "";
  const sport     = logSport?.value || "other";
  const homeTeam  = logHomeTeam?.value.trim() || "";
  const awayTeam  = logAwayTeam?.value.trim() || "";
  const homeScore = parseInt(logHomeScore?.value || "0", 10);
  const awayScore = parseInt(logAwayScore?.value || "0", 10);
  const stadium   = logStadium?.value.trim() || "";
  const city      = logCity?.value.trim() || "";
  const side      = logSide?.value || "neutral";
  const scorers   = sport === "soccer" ? (logScorers?.value.trim() || "") : "";
  const notes     = logNotes?.value.trim() || "";

  if (!homeTeam || !awayTeam || !stadium || !city) {
    alert("Please fill in both teams, stadium, and city.");
    return;
  }
  if (!isValidDate(date)) {
    alert("Please enter a valid date.");
    return;
  }

  const ev = {
    id: newId(), date, sport, homeTeam, awayTeam,
    homeScore: isNaN(homeScore) ? 0 : homeScore,
    awayScore: isNaN(awayScore) ? 0 : awayScore,
    stadium, city, side, scorers, notes,
    lat: null, lng: null, createdAt: new Date().toISOString(),
  };

  const all = loadEvents();
  all.push(ev);
  saveEvents(all);

  if (logHomeTeam)  logHomeTeam.value  = "";
  if (logAwayTeam)  logAwayTeam.value  = "";
  if (logHomeScore) logHomeScore.value = "";
  if (logAwayScore) logAwayScore.value = "";
  if (logStadium)   logStadium.value   = "";
  if (logCity)      logCity.value      = "";
  if (logScorers)   logScorers.value   = "";
  if (logNotes)     logNotes.value     = "";

  renderRecentEvents();
  geocodePending();
});

// ── Delete events ─────────────────────────────────────
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='delete']");
  if (!btn || !currentUser) return;
  const id = String(btn.dataset.id || "");
  if (!id || !confirm("Delete this event?")) return;
  const updated = loadEvents().filter((ev) => ev.id !== id);
  saveEvents(updated);
  renderRecentEvents();
  if (activeTab === "stadiums") renderStadiumsTab();
});

// ── My Stadiums tab ───────────────────────────────────
const filterSport = document.getElementById("filter-sport");
const filterYear  = document.getElementById("filter-year");
const fullList    = document.getElementById("full-list");
const fullEmpty   = document.getElementById("full-empty");
const mapEmpty    = document.getElementById("map-empty");
const mapContainer= document.getElementById("events-map");

let mapInstance = null;
let mapReady    = false;

filterSport?.addEventListener("change", renderStadiumsTab);
filterYear?.addEventListener("change",  renderStadiumsTab);

function renderStadiumsTab() {
  const events = loadEvents();

  // Populate year filter
  if (filterYear) {
    const years = [...new Set(events.map((e) => e.date.slice(0, 4)))].sort().reverse();
    const cur = filterYear.value;
    filterYear.innerHTML =
      `<option value="">All Years</option>` +
      years.map((y) => `<option value="${y}"${y === cur ? " selected" : ""}>${y}</option>`).join("");
  }

  // Filter
  let filtered = [...events];
  if (filterSport?.value) filtered = filtered.filter((e) => e.sport === filterSport.value);
  if (filterYear?.value)  filtered = filtered.filter((e) => e.date.startsWith(filterYear.value));
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Full list
  if (!filtered.length) {
    fullList.innerHTML = "";
    fullEmpty.hidden = false;
  } else {
    fullEmpty.hidden = true;
    fullList.innerHTML = filtered.map(eventItemHTML).join("");
  }

  renderMap(filtered);
}

function renderMap(events) {
  const withCoords = events.filter((e) => typeof e.lat === "number" && typeof e.lng === "number");

  // Group by stadium
  const byStadium = new Map();
  withCoords.forEach((e) => {
    const key = `${e.stadium}|||${e.city}`;
    if (!byStadium.has(key)) {
      byStadium.set(key, { stadium: e.stadium, city: e.city, lat: e.lat, lng: e.lng, events: [] });
    }
    byStadium.get(key).events.push(e);
  });
  const stadiums = [...byStadium.values()];

  if (!stadiums.length) {
    if (mapContainer) mapContainer.style.display = "none";
    if (mapEmpty) mapEmpty.hidden = false;
    return;
  }
  if (mapContainer) mapContainer.style.display = "";
  if (mapEmpty) mapEmpty.hidden = true;

  if (typeof window.L === "undefined") return;

  if (!mapReady) {
    mapInstance = window.L.map("events-map").setView([20, 0], 2);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance);
    mapReady = true;
  } else {
    mapInstance.eachLayer((l) => {
      if (l instanceof window.L.Marker) mapInstance.removeLayer(l);
    });
  }

  const bounds = [];
  stadiums.forEach(({ stadium, city, lat, lng, events: evts }) => {
    const lines = [...evts]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) =>
        `<b>${esc(e.homeTeam)} ${e.homeScore}–${e.awayScore} ${esc(e.awayTeam)}</b><br>` +
        `${sportLabel(e.sport)} · ${formatDate(e.date)}`
      ).join("<hr style='margin:5px 0'>");
    const popup = `<b>${esc(stadium)}</b><br><em>${esc(city)}</em><hr style='margin:5px 0'>${lines}`;
    window.L.marker([lat, lng]).addTo(mapInstance).bindPopup(popup);
    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) {
    mapInstance.setView(bounds[0], 14);
  } else {
    mapInstance.fitBounds(bounds, { padding: [40, 40] });
  }
  window.requestAnimationFrame(() => mapInstance.invalidateSize());
}

// ── Geocoding ─────────────────────────────────────────
async function geocodeStadium(stadium, city) {
  try {
    const q = encodeURIComponent(`${stadium} ${city}`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { Accept: "application/json", "User-Agent": "LifeTrackerApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

async function geocodePending() {
  if (!currentUser) return;
  const events  = loadEvents();
  const pending = events.filter((e) => e.stadium && e.city && e.lat === null);
  if (!pending.length) return;
  let changed = false;
  for (const ev of pending) {
    await new Promise((r) => setTimeout(r, 1200));
    const coords = await geocodeStadium(ev.stadium, ev.city);
    if (coords) { ev.lat = coords.lat; ev.lng = coords.lng; changed = true; }
  }
  if (changed) {
    saveEvents(events);
    if (activeTab === "stadiums") renderStadiumsTab();
  }
}

// ── App init (called once on sign-in) ─────────────────
function initApp() {
  renderRecentEvents();
  geocodePending();
}
