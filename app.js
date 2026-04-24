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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function isValidDate(str) { return /^\d{4}-\d{2}-\d{2}$/.test(str); }
function isValidEmail(str) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim().toLowerCase()); }
function storageKey() { return currentUser ? `life-tracker-events-${currentUser.uid}` : null; }

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

// ── Auth switch ───────────────────────────────────────
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

signinShowPwd?.addEventListener("change", () => {
  signinPassword.type = signinShowPwd.checked ? "text" : "password";
});
regShowPwd?.addEventListener("change", () => {
  regPassword.type = regShowPwd.checked ? "text" : "password";
  regConfirm.type  = regShowPwd.checked ? "text" : "password";
});

regPassword?.addEventListener("input", () => {
  const v = regPassword.value;
  reqLen.classList.toggle("met",   v.length >= 8);
  reqUpper.classList.toggle("met", /[A-Z]/.test(v));
  reqLower.classList.toggle("met", /[a-z]/.test(v));
  reqNum.classList.toggle("met",   /[0-9]/.test(v));
});

signinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) { setAuthMsg("Firebase not configured.", true); return; }
  const email = signinEmail.value.trim().toLowerCase();
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

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) { setAuthMsg("Firebase not configured.", true); return; }
  const email    = regEmail.value.trim().toLowerCase();
  const password = regPassword.value;
  const confirm  = regConfirm.value;
  if (!isValidEmail(email))    { setAuthMsg("Enter a valid email address.", true); return; }
  if (password.length < 8)     { setAuthMsg("Password must be at least 8 characters.", true); return; }
  if (!/[A-Z]/.test(password)) { setAuthMsg("Password must include an uppercase letter.", true); return; }
  if (!/[a-z]/.test(password)) { setAuthMsg("Password must include a lowercase letter.", true); return; }
  if (!/[0-9]/.test(password)) { setAuthMsg("Password must include a number.", true); return; }
  if (password !== confirm)    { setAuthMsg("Passwords do not match.", true); return; }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    registerForm.reset();
    setAuthMsg("");
  } catch (err) {
    const code = err?.code || "";
    setAuthMsg(code.includes("email-already-in-use") ? "An account with that email already exists." : "Unable to create account right now.", true);
  }
});

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

signoutBtn?.addEventListener("click", async () => {
  if (auth) { try { await signOut(auth); } catch { /* ignore */ } }
});

// ── Tab switching ─────────────────────────────────────
let activeTab = "log";
const tabPanels = {
  log:      document.getElementById("tab-log"),
  stadiums: document.getElementById("tab-stadiums"),
  scorers:  document.getElementById("tab-scorers"),
  teams:    document.getElementById("tab-teams"),
};

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
    Object.entries(tabPanels).forEach(([key, el]) => { if (el) el.hidden = key !== tab; });
    if (tab === "stadiums") renderStadiumsTab();
    if (tab === "scorers")  renderScorersTab();
    if (tab === "teams")    renderTeamsTab();
  });
});

// ── Sports events storage ─────────────────────────────
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
      date:      isValidDate(e.date) ? e.date : null,
      sport:     typeof e.sport === "string" ? e.sport : "other",
      homeTeam:  typeof e.homeTeam === "string" ? e.homeTeam : "",
      awayTeam:  typeof e.awayTeam === "string" ? e.awayTeam : "",
      homeScore: typeof e.homeScore === "number" ? e.homeScore : null,
      awayScore: typeof e.awayScore === "number" ? e.awayScore : null,
      stadium:   typeof e.stadium === "string" ? e.stadium : "",
      city:      typeof e.city === "string" ? e.city : "",
      side:      ["home","away","neutral"].includes(e.side) ? e.side : "neutral",
      // scorers: array of {name, team, minute} — or empty array
      scorers:     Array.isArray(e.scorers) ? e.scorers : [],
      competition: typeof e.competition === "string" ? e.competition : "",
      penalties:   e.penalties && typeof e.penalties.home === "number" ? e.penalties : null,
      notes:       typeof e.notes === "string" ? e.notes : "",
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

// ── Labels ────────────────────────────────────────────
const SPORT_LABELS = {
  soccer:"Soccer", basketball:"Basketball", baseball:"Baseball",
  "american-football":"Football", hockey:"Hockey", tennis:"Tennis",
  rugby:"Rugby", mma:"MMA/Boxing", other:"Other",
};
function sportLabel(s) { return SPORT_LABELS[s] || "Other"; }
function sideLabel(s)  { return s === "home" ? "Home fan" : s === "away" ? "Away fan" : "Neutral"; }
function resultLine(e) {
  if (e.homeScore == null || e.awayScore == null) return "Result unknown";
  if (e.homeScore > e.awayScore) return `${esc(e.homeTeam || "Home")} won`;
  if (e.awayScore > e.homeScore) return `${esc(e.awayTeam || "Away")} won`;
  return "Draw";
}

function scoreDisplay(e) {
  const h = e.homeScore != null ? e.homeScore : "?";
  const a = e.awayScore != null ? e.awayScore : "?";
  return `${h}–${a}`;
}

// ── Event card HTML ───────────────────────────────────
function scorerLine(e) {
  if (e.sport !== "soccer" || !e.scorers.length) return "";
  const items = e.scorers.map((s) => {
    const teamName = s.team === "home" ? esc(e.homeTeam) : esc(e.awayTeam);
    const min = s.minute ? ` ${esc(s.minute)}'` : "";
    return `${esc(s.name)} <span class="scorer-team">(${teamName}${min})</span>`;
  }).join(" &nbsp;·&nbsp; ");
  return `<span class="event-meta scorer-meta">⚽ ${items}</span>`;
}

function eventItemHTML(e) {
  return `
    <li class="event-item">
      <div class="event-info">
        <span class="event-title">${esc(e.homeTeam || "?")} ${scoreDisplay(e)} ${esc(e.awayTeam || "?")}</span>
        <span class="event-meta">${sportLabel(e.sport)}${e.competition ? ` · ${esc(e.competition)}` : ""} · ${e.date ? formatDate(e.date) : '<span class="unknown-badge">Date unknown</span>'} · ${sideLabel(e.side)}</span>
        <span class="event-meta">${e.stadium ? esc(e.stadium) : "Venue unknown"}${e.city ? `, ${esc(e.city)}` : ""} · ${resultLine(e)}${e.penalties ? ` (pens ${e.penalties.home}–${e.penalties.away})` : ""}</span>
        ${scorerLine(e)}
        ${e.notes ? `<span class="event-notes">${esc(e.notes)}</span>` : ""}
      </div>
      <div class="event-actions">
        <button class="btn btn-sm" type="button"
          data-action="edit-event" data-id="${esc(e.id)}" aria-label="Edit event">Edit</button>
        <button class="btn btn-sm btn-danger" type="button"
          data-action="delete" data-id="${esc(e.id)}" aria-label="Delete event">✕</button>
      </div>
    </li>`;
}

// ── Log Event tab ─────────────────────────────────────
const logDate        = document.getElementById("log-date");
const logDateUnknown = document.getElementById("log-date-unknown");
const logSport     = document.getElementById("log-sport");
const logSide      = document.getElementById("log-side");
const logHomeTeam  = document.getElementById("log-home-team");
const logAwayTeam  = document.getElementById("log-away-team");
const logHomeScore = document.getElementById("log-home-score");
const logAwayScore = document.getElementById("log-away-score");
const logStadium   = document.getElementById("log-stadium");
const logCity      = document.getElementById("log-city");
const logCompetition    = document.getElementById("log-competition");
const logPenaltiesCheck = document.getElementById("log-penalties-check");
const penaltiesWrap     = document.getElementById("penalties-wrap");
const logPenHome        = document.getElementById("log-pen-home");
const logPenAway        = document.getElementById("log-pen-away");
const penaltiesHomeLabel = document.getElementById("penalties-home-label");
const penaltiesAwayLabel = document.getElementById("penalties-away-label");
const logNotes          = document.getElementById("log-notes");
const scorersWrap       = document.getElementById("scorers-wrap");
const recentList   = document.getElementById("recent-list");
const recentEmpty  = document.getElementById("recent-empty");

const scorerNameInput  = document.getElementById("scorer-name");
const scorerTeamSide   = document.getElementById("scorer-team-side");
const scorerMinInput   = document.getElementById("scorer-minute");
const scorerAddBtn     = document.getElementById("scorer-add-btn");
const scorersStaged    = document.getElementById("scorers-staged");

if (logDate) logDate.value = today();

logDateUnknown?.addEventListener("change", () => {
  if (logDate) {
    logDate.disabled = logDateUnknown.checked;
    if (logDateUnknown.checked) logDate.value = "";
  }
});

// staged scorers for current form
let stagedScorers = [];
let editingEventId = null; // non-null when editing an existing event

const logForm       = document.getElementById("log-form");
const logSubmitBtn  = logForm?.querySelector("button[type='submit']");
const editCancelBtn = document.createElement("button");
editCancelBtn.type = "button";
editCancelBtn.className = "btn btn-full";
editCancelBtn.textContent = "Cancel Edit";
editCancelBtn.hidden = true;
editCancelBtn.addEventListener("click", cancelEdit);
logSubmitBtn?.insertAdjacentElement("afterend", editCancelBtn);

function cancelEdit() {
  editingEventId = null;
  if (logSubmitBtn) logSubmitBtn.textContent = "Log Event";
  editCancelBtn.hidden = true;
  logForm?.reset();
  if (logDate) logDate.value = today();
  if (logDate) logDate.disabled = false;
  if (logDateUnknown) logDateUnknown.checked = false;
  if (penaltiesWrap) penaltiesWrap.hidden = true;
  if (logPenaltiesCheck) logPenaltiesCheck.checked = false;
  stagedScorers = [];
  renderStagedScorers();
  updateSoccerFields();
}

function loadEventIntoForm(ev) {
  editingEventId = ev.id;
  if (logSubmitBtn) logSubmitBtn.textContent = "Save Changes";
  editCancelBtn.hidden = false;

  // scroll to form
  logForm?.scrollIntoView({ behavior: "smooth", block: "start" });

  // switch to Log tab if not already there
  if (activeTab !== "log") {
    document.querySelector(".tab-btn[data-tab='log']")?.click();
  }

  if (logDate) { logDate.disabled = false; logDate.value = ev.date || ""; }
  if (logDateUnknown) logDateUnknown.checked = !ev.date;
  if (ev.date === null && logDate) logDate.disabled = true;
  if (logSport) logSport.value = ev.sport || "soccer";
  if (logSide)  logSide.value  = ev.side  || "neutral";
  if (logHomeTeam)  logHomeTeam.value  = ev.homeTeam  || "";
  if (logAwayTeam)  logAwayTeam.value  = ev.awayTeam  || "";
  if (logHomeScore) logHomeScore.value = ev.homeScore != null ? ev.homeScore : "";
  if (logAwayScore) logAwayScore.value = ev.awayScore != null ? ev.awayScore : "";
  if (logStadium)   logStadium.value   = ev.stadium   || "";
  if (logCity)      logCity.value      = ev.city      || "";
  if (logCompetition) logCompetition.value = ev.competition || "";
  if (logNotes)     logNotes.value     = ev.notes     || "";

  const hasPens = !!ev.penalties;
  if (logPenaltiesCheck) logPenaltiesCheck.checked = hasPens;
  if (penaltiesWrap) penaltiesWrap.hidden = !hasPens;
  if (logPenHome) logPenHome.value = ev.penalties?.home ?? "";
  if (logPenAway) logPenAway.value = ev.penalties?.away ?? "";

  stagedScorers = Array.isArray(ev.scorers) ? [...ev.scorers] : [];
  renderStagedScorers();
  updateSoccerFields();
  updatePenaltyLabels();
}

function updateSoccerFields() {
  const isSoccer = logSport?.value === "soccer";
  if (scorersWrap) scorersWrap.hidden = !isSoccer;
  if (!isSoccer && logPenaltiesCheck) {
    logPenaltiesCheck.checked = false;
    if (penaltiesWrap) penaltiesWrap.hidden = true;
  }
}
logSport?.addEventListener("change", updateSoccerFields);

logPenaltiesCheck?.addEventListener("change", () => {
  if (penaltiesWrap) penaltiesWrap.hidden = !logPenaltiesCheck.checked;
});

function updatePenaltyLabels() {
  if (penaltiesHomeLabel) penaltiesHomeLabel.textContent = logHomeTeam?.value.trim() || "Home";
  if (penaltiesAwayLabel) penaltiesAwayLabel.textContent = logAwayTeam?.value.trim() || "Away";
}
logHomeTeam?.addEventListener("input", updatePenaltyLabels);
logAwayTeam?.addEventListener("input", updatePenaltyLabels);

function renderStagedScorers() {
  if (!scorersStaged) return;
  if (!stagedScorers.length) { scorersStaged.innerHTML = ""; return; }
  scorersStaged.innerHTML = stagedScorers.map((s, i) => {
    const teamLabel = s.team === "home"
      ? (logHomeTeam?.value.trim() || "Home")
      : (logAwayTeam?.value.trim() || "Away");
    const min = s.minute ? ` ${s.minute}'` : "";
    return `<li class="scorer-chip">
      <span>⚽ ${esc(s.name)} <em>(${esc(teamLabel)}${min})</em></span>
      <button type="button" class="chip-remove" data-scorer-idx="${i}" aria-label="Remove">&times;</button>
    </li>`;
  }).join("");
}

scorerAddBtn?.addEventListener("click", () => {
  const name = scorerNameInput?.value.trim() || "";
  if (!name) { scorerNameInput?.focus(); return; }
  const team   = scorerTeamSide?.value || "home";
  const minute = scorerMinInput?.value.trim() || "";
  stagedScorers.push({ name, team, minute });
  if (scorerNameInput)  scorerNameInput.value  = "";
  if (scorerMinInput)   scorerMinInput.value   = "";
  scorerNameInput?.focus();
  renderStagedScorers();
});

scorersStaged?.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip-remove");
  if (!btn) return;
  const idx = parseInt(btn.dataset.scorerIdx, 10);
  stagedScorers.splice(idx, 1);
  renderStagedScorers();
});

function renderRecentEvents() {
  const events = loadEvents();
  const recent = [...events].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
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
  const dateUnknown = logDateUnknown?.checked || false;
  const dateRaw     = logDate?.value || "";
  const date        = dateUnknown ? null : (isValidDate(dateRaw) ? dateRaw : null);
  const sport       = logSport?.value || "other";
  const homeTeam    = logHomeTeam?.value.trim() || "";
  const awayTeam    = logAwayTeam?.value.trim() || "";
  const homeScoreRaw = logHomeScore?.value;
  const awayScoreRaw = logAwayScore?.value;
  const homeScore   = homeScoreRaw !== "" && homeScoreRaw != null ? (parseInt(homeScoreRaw, 10) || 0) : null;
  const awayScore   = awayScoreRaw !== "" && awayScoreRaw != null ? (parseInt(awayScoreRaw, 10) || 0) : null;
  const stadium     = logStadium?.value.trim() || "";
  const city        = logCity?.value.trim() || "";
  const side        = logSide?.value || "neutral";
  const scorers     = sport === "soccer" ? [...stagedScorers] : [];
  const competition = sport === "soccer" ? (logCompetition?.value.trim() || "") : "";
  const hasPens     = sport === "soccer" && logPenaltiesCheck?.checked;
  const penalties   = hasPens
    ? { home: parseInt(logPenHome?.value || "0", 10) || 0, away: parseInt(logPenAway?.value || "0", 10) || 0 }
    : null;
  const notes       = logNotes?.value.trim() || "";

  if (!homeTeam && !awayTeam && !stadium) {
    alert("Add at least one team or a stadium so you can identify this event.");
    return;
  }

  const ev = {
    id: newId(), date, sport, homeTeam, awayTeam,
    homeScore: isNaN(homeScore) ? 0 : homeScore,
    awayScore: isNaN(awayScore) ? 0 : awayScore,
    stadium, city, side, scorers, competition, penalties, notes,
    lat: null, lng: null, createdAt: new Date().toISOString(),
  };

  const all = loadEvents();
  if (editingEventId) {
    const idx = all.findIndex((e) => e.id === editingEventId);
    if (idx !== -1) all[idx] = { ...all[idx], ...ev, id: editingEventId };
    else all.push(ev);
  } else {
    all.push(ev);
  }
  saveEvents(all);

  // reset form
  if (logHomeTeam)  logHomeTeam.value  = "";
  if (logAwayTeam)  logAwayTeam.value  = "";
  if (logHomeScore) logHomeScore.value = "";
  if (logAwayScore) logAwayScore.value = "";
  if (logStadium)   logStadium.value   = "";
  if (logCity)      logCity.value      = "";
  editingEventId = null;
  if (logSubmitBtn) logSubmitBtn.textContent = "Log Event";
  editCancelBtn.hidden = true;
  if (logDateUnknown) { logDateUnknown.checked = false; if (logDate) logDate.disabled = false; logDate.value = today(); }
  if (logCompetition)    logCompetition.value    = "";
  if (logPenaltiesCheck) { logPenaltiesCheck.checked = false; if (penaltiesWrap) penaltiesWrap.hidden = true; }
  if (logPenHome)        logPenHome.value        = "";
  if (logPenAway)        logPenAway.value        = "";
  if (logNotes)          logNotes.value          = "";
  stagedScorers = [];
  renderStagedScorers();

  renderRecentEvents();
  geocodePending();
});

// ── Delete events ─────────────────────────────────────
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest("button[data-action='edit-event']");
  if (editBtn && currentUser) {
    const id = String(editBtn.dataset.id || "");
    const ev = loadEvents().find((ev) => ev.id === id);
    if (ev) loadEventIntoForm(ev);
    return;
  }
  const btn = e.target.closest("button[data-action='delete']");
  if (!btn || !currentUser) return;
  const id = String(btn.dataset.id || "");
  if (!id || !confirm("Delete this event?")) return;
  const updated = loadEvents().filter((ev) => ev.id !== id);
  saveEvents(updated);
  renderRecentEvents();
  if (activeTab === "stadiums") renderStadiumsTab();
  if (activeTab === "scorers")  renderScorersTab();
  if (activeTab === "teams")    renderTeamsTab();
});

// ── My Stadiums tab ───────────────────────────────────
const filterSport  = document.getElementById("filter-sport");
const filterYear   = document.getElementById("filter-year");
const fullList     = document.getElementById("full-list");
const fullEmpty    = document.getElementById("full-empty");
const mapEmpty     = document.getElementById("map-empty");
const mapContainer = document.getElementById("events-map");

let stadiumMapInstance = null;
let stadiumMapReady    = false;

filterSport?.addEventListener("change", renderStadiumsTab);
filterYear?.addEventListener("change",  renderStadiumsTab);

function renderStadiumsTab() {
  const events = loadEvents();

  if (filterYear) {
    const years = [...new Set(events.map((e) => e.date.slice(0, 4)))].sort().reverse();
    const cur = filterYear.value;
    filterYear.innerHTML =
      `<option value="">All Years</option>` +
      years.map((y) => `<option value="${y}"${y === cur ? " selected" : ""}>${y}</option>`).join("");
  }

  let filtered = [...events];
  if (filterSport?.value) filtered = filtered.filter((e) => e.sport === filterSport.value);
  if (filterYear?.value)  filtered = filtered.filter((e) => e.date.startsWith(filterYear.value));
  filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (!filtered.length) {
    fullList.innerHTML = "";
    fullEmpty.hidden = false;
  } else {
    fullEmpty.hidden = true;
    fullList.innerHTML = filtered.map(eventItemHTML).join("");
  }

  renderStadiumMap(filtered);
}

function renderStadiumMap(events) {
  const withCoords = events.filter((e) => typeof e.lat === "number" && typeof e.lng === "number");
  const byStadium = new Map();
  withCoords.forEach((e) => {
    const key = `${e.stadium}|||${e.city}`;
    if (!byStadium.has(key)) byStadium.set(key, { stadium: e.stadium, city: e.city, lat: e.lat, lng: e.lng, events: [] });
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

  if (!stadiumMapReady) {
    stadiumMapInstance = window.L.map("events-map").setView([20, 0], 2);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(stadiumMapInstance);
    stadiumMapReady = true;
  } else {
    stadiumMapInstance.eachLayer((l) => { if (l instanceof window.L.Marker) stadiumMapInstance.removeLayer(l); });
  }

  const bounds = [];
  stadiums.forEach(({ stadium, city, lat, lng, events: evts }) => {
    const lines = [...evts].sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => `<b>${esc(e.homeTeam)} ${e.homeScore}–${e.awayScore} ${esc(e.awayTeam)}</b><br>${sportLabel(e.sport)} · ${formatDate(e.date)}`)
      .join("<hr style='margin:5px 0'>");
    window.L.marker([lat, lng]).addTo(stadiumMapInstance)
      .bindPopup(`<b>${esc(stadium)}</b><br><em>${esc(city)}</em><hr style='margin:5px 0'>${lines}`);
    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) stadiumMapInstance.setView(bounds[0], 14);
  else stadiumMapInstance.fitBounds(bounds, { padding: [40, 40] });
  window.requestAnimationFrame(() => stadiumMapInstance.invalidateSize());
}

// ── Scorers tab ───────────────────────────────────────
const scorersAllList  = document.getElementById("scorers-all-list");
const scorersAllEmpty = document.getElementById("scorers-all-empty");

function renderScorersTab() {
  const events = loadEvents();

  // Aggregate all scorers across all soccer events
  const byScorer = new Map();
  events.forEach((e) => {
    if (e.sport !== "soccer" || !e.scorers.length) return;
    e.scorers.forEach((s) => {
      const key = s.name.toLowerCase().trim();
      if (!byScorer.has(key)) {
        byScorer.set(key, { name: s.name, goals: 0, games: [] });
      }
      const entry = byScorer.get(key);
      entry.goals++;
      const teamName = s.team === "home" ? e.homeTeam : e.awayTeam;
      entry.games.push({
        date: e.date,
        match: `${e.homeTeam} ${e.homeScore}–${e.awayScore} ${e.awayTeam}`,
        team: teamName,
        minute: s.minute,
        stadium: e.stadium,
      });
    });
  });

  const scorers = [...byScorer.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  if (!scorers.length) {
    scorersAllList.innerHTML = "";
    scorersAllEmpty.hidden = false;
    return;
  }
  scorersAllEmpty.hidden = true;
  scorersAllList.innerHTML = scorers.map((s) => {
    const gameLines = [...s.games]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((g) => {
        const min = g.minute ? ` ${esc(g.minute)}'` : "";
        return `<li class="scorer-game-line">${esc(g.match)} · <em>${esc(g.team)}${min}</em> · ${formatDate(g.date)}</li>`;
      }).join("");
    return `
      <li class="scorer-entry">
        <div class="scorer-entry-head">
          <span class="scorer-entry-name">${esc(s.name)}</span>
          <span class="scorer-entry-count">${s.goals} ${s.goals === 1 ? "goal" : "goals"}</span>
        </div>
        <ul class="scorer-game-list">${gameLines}</ul>
      </li>`;
  }).join("");
}

// ── Team locations storage ────────────────────────────
function teamLocsKey() { return currentUser ? `life-tracker-team-locs-${currentUser.uid}` : null; }

function loadTeamLocs() {
  try {
    const key = teamLocsKey();
    if (!key) return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveTeamLocs(locs) {
  const key = teamLocsKey();
  if (key) localStorage.setItem(key, JSON.stringify(locs));
}

async function geocodeTeamLocation(city, state, country) {
  try {
    const q = encodeURIComponent([city, state, country].filter(Boolean).join(", "));
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

// ── Teams tab ─────────────────────────────────────────
const teamsList        = document.getElementById("teams-list");
const teamsEmpty       = document.getElementById("teams-empty");
const teamsListSection = document.getElementById("teams-list-section");
const teamsMapSection  = document.getElementById("teams-map-section");
const teamsMapEl       = document.getElementById("teams-map");
const teamsMapEmpty    = document.getElementById("teams-map-empty");

let teamsView = "list";
let teamsMapInstance = null;
let teamsMapReady    = false;

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    teamsView = btn.dataset.view;
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === teamsView));
    teamsListSection.hidden = teamsView !== "list";
    teamsMapSection.hidden  = teamsView !== "map";
    if (teamsView === "map") renderTeamsMap();
  });
});

function aggregateTeams() {
  const events = loadEvents();
  const locs   = loadTeamLocs();
  const byTeam = new Map();
  events.forEach((e) => {
    ["home", "away"].forEach((side) => {
      const name = side === "home" ? e.homeTeam : e.awayTeam;
      if (!name) return;
      const key = name.toLowerCase().trim();
      if (!byTeam.has(key)) byTeam.set(key, { key, name, games: [] });
      byTeam.get(key).games.push({ date: e.date, match: `${e.homeTeam} ${e.homeScore}–${e.awayScore} ${e.awayTeam}`, sport: e.sport, stadium: e.stadium });
    });
  });
  return [...byTeam.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ ...t, loc: locs[t.key] || null }));
}

function renderTeamsTab() {
  const teams = aggregateTeams();

  if (!teams.length) {
    teamsList.innerHTML = "";
    teamsEmpty.hidden = false;
  } else {
    teamsEmpty.hidden = true;
    teamsList.innerHTML = teams.map((t) => {
      const loc = t.loc;
      const locText = loc
        ? [loc.city, loc.state, loc.country].filter(Boolean).join(", ")
        : "";
      const locHtml = locText
        ? `<div class="team-location">
            <span class="team-loc-display">📍 ${esc(locText)}</span>
            <button class="btn btn-sm" type="button" data-action="edit-team-loc" data-team-key="${esc(t.key)}">Edit</button>
          </div>`
        : `<div class="team-location">
            <button class="btn btn-sm" type="button" data-action="edit-team-loc" data-team-key="${esc(t.key)}">+ Add location</button>
          </div>`;
      const formHtml = `
        <form class="team-loc-form" data-team-key="${esc(t.key)}" hidden>
          <div class="team-loc-inputs">
            <input class="team-loc-city" type="text" placeholder="City" maxlength="80" value="${esc(loc?.city || "")}" />
            <input class="team-loc-state" type="text" placeholder="State (optional)" maxlength="80" value="${esc(loc?.state || "")}" />
            <input class="team-loc-country" type="text" placeholder="Country" maxlength="80" value="${esc(loc?.country || "")}" />
          </div>
          <div class="team-loc-actions">
            <button type="submit" class="btn btn-sm btn-primary">Save</button>
            <button type="button" class="btn btn-sm" data-action="cancel-team-loc">Cancel</button>
          </div>
        </form>`;
      const gameLines = [...t.games]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((g) => `<li class="team-game-line">${esc(g.match)} · ${formatDate(g.date)} · ${esc(g.stadium)}</li>`)
        .join("");
      return `
        <li class="team-entry" data-team-key="${esc(t.key)}">
          <div class="team-entry-head">
            <span class="team-entry-name">${esc(t.name)}</span>
            <span class="team-entry-count">${t.games.length} ${t.games.length === 1 ? "game" : "games"}</span>
          </div>
          ${locHtml}${formHtml}
          <ul class="team-game-list">${gameLines}</ul>
        </li>`;
    }).join("");
  }

  if (teamsView === "map") renderTeamsMap();
}

// Team location edit — event delegation
teamsList?.addEventListener("click", (e) => {
  const editBtn   = e.target.closest("[data-action='edit-team-loc']");
  const cancelBtn = e.target.closest("[data-action='cancel-team-loc']");
  if (editBtn) {
    const key  = editBtn.dataset.teamKey;
    const form = teamsList.querySelector(`.team-loc-form[data-team-key="${key}"]`);
    if (form) form.hidden = false;
  }
  if (cancelBtn) {
    const form = cancelBtn.closest(".team-loc-form");
    if (form) form.hidden = true;
  }
});

teamsList?.addEventListener("submit", async (e) => {
  const form = e.target.closest(".team-loc-form");
  if (!form) return;
  e.preventDefault();
  const key     = form.dataset.teamKey;
  const city    = form.querySelector(".team-loc-city")?.value.trim() || "";
  const state   = form.querySelector(".team-loc-state")?.value.trim() || "";
  const country = form.querySelector(".team-loc-country")?.value.trim() || "";
  if (!city && !country) { form.hidden = true; return; }

  const locs = loadTeamLocs();
  locs[key] = { city, state, country, lat: null, lng: null };

  const coords = await geocodeTeamLocation(city, state, country);
  if (coords) { locs[key].lat = coords.lat; locs[key].lng = coords.lng; }
  saveTeamLocs(locs);
  renderTeamsTab();
});

function renderTeamsMap() {
  const teams = aggregateTeams().filter((t) => t.loc?.lat != null);

  if (!teams.length) {
    if (teamsMapEl) teamsMapEl.style.display = "none";
    if (teamsMapEmpty) teamsMapEmpty.hidden = false;
    return;
  }
  if (teamsMapEl) teamsMapEl.style.display = "";
  if (teamsMapEmpty) teamsMapEmpty.hidden = true;
  if (typeof window.L === "undefined") return;

  if (!teamsMapReady) {
    teamsMapInstance = window.L.map("teams-map").setView([20, 0], 2);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(teamsMapInstance);
    teamsMapReady = true;
  } else {
    teamsMapInstance.eachLayer((l) => { if (l instanceof window.L.Marker) teamsMapInstance.removeLayer(l); });
  }

  const bounds = [];
  teams.forEach((t) => {
    const locText = [t.loc.city, t.loc.state, t.loc.country].filter(Boolean).join(", ");
    const gameLines = [...t.games].sort((a, b) => b.date.localeCompare(a.date))
      .map((g) => `${esc(g.match)} · ${formatDate(g.date)}`)
      .join("<br>");
    const popup = `<b>${esc(t.name)}</b><br><em>${esc(locText)}</em><hr style='margin:5px 0'>${gameLines}`;
    window.L.marker([t.loc.lat, t.loc.lng]).addTo(teamsMapInstance).bindPopup(popup);
    bounds.push([t.loc.lat, t.loc.lng]);
  });

  if (bounds.length === 1) teamsMapInstance.setView(bounds[0], 10);
  else teamsMapInstance.fitBounds(bounds, { padding: [40, 40] });
  window.requestAnimationFrame(() => teamsMapInstance.invalidateSize());
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
    if (activeTab === "teams")    renderTeamsTab();
  }
}

// ── App init ──────────────────────────────────────────
function initApp() {
  updateSoccerFields();
  renderRecentEvents();
  geocodePending();
}
