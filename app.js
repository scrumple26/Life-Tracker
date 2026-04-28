import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// ── Firebase init ─────────────────────────────────────
const config = window.LIFE_TRACKER_FIREBASE_CONFIG || {};
const firebaseReady = !!(config.apiKey && config.authDomain && config.projectId);
let auth    = null;
let db      = null;
let storage = null;
if (firebaseReady) {
  const app = initializeApp(config);
  auth    = getAuth(app);
  db      = getFirestore(app);
  storage = getStorage(app);
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
function userDocRef() { return currentUser && db ? doc(db, "lifeTrackerData", currentUser.uid) : null; }

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
  photos:   document.getElementById("tab-photos"),
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
    if (tab === "photos")   renderPhotosTab();
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
      address:   typeof e.address === "string" ? e.address : (typeof e.city === "string" ? e.city : ""),
      side:      ["home","away","neutral"].includes(e.side) ? e.side : "neutral",
      // scorers: array of {name, team, minute} — or empty array
      scorers:     Array.isArray(e.scorers) ? e.scorers : [],
      competition: typeof e.competition === "string" ? e.competition : "",
      penalties:   e.penalties && typeof e.penalties.home === "number" ? e.penalties : null,
      homeLineup:  Array.isArray(e.homeLineup) ? e.homeLineup : [],
      awayLineup:  Array.isArray(e.awayLineup) ? e.awayLineup : [],
      notes:       typeof e.notes === "string" ? e.notes : "",
      photos:    Array.isArray(e.photos) ? e.photos.filter((s) => typeof s === "string") : [],
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
  const ref = userDocRef();
  if (ref) setDoc(ref, { events }, { merge: true }).catch(() => {});
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
function lineupLine(e) {
  const hCount = e.homeLineup?.length || 0;
  const aCount = e.awayLineup?.length || 0;
  if (!hCount && !aCount) return "";
  const parts = [];
  if (hCount) parts.push(`${hCount} ${esc(e.homeTeam || "Home")}`);
  if (aCount) parts.push(`${aCount} ${esc(e.awayTeam || "Away")}`);
  return `<span class="event-meta">🏃 ${parts.join(" · ")}</span>`;
}

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
        <span class="event-meta">${e.stadium ? esc(e.stadium) : "Venue unknown"}${e.address ? ` · ${esc(e.address)}` : ""} · ${resultLine(e)}${e.penalties ? ` (pens ${e.penalties.home}–${e.penalties.away})` : ""}</span>
        ${scorerLine(e)}
        ${lineupLine(e)}
        ${e.notes ? `<span class="event-notes">${esc(e.notes)}</span>` : ""}
        ${e.photos?.length ? `<span class="event-meta event-photo-count">📷 ${e.photos.length} photo${e.photos.length !== 1 ? "s" : ""}</span>` : ""}
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
const logHomeLocCity    = document.getElementById("log-home-loc-city");
const logHomeLocState   = document.getElementById("log-home-loc-state");
const logHomeLocCountry = document.getElementById("log-home-loc-country");
const logAwayLocCity    = document.getElementById("log-away-loc-city");
const logAwayLocState   = document.getElementById("log-away-loc-state");
const logAwayLocCountry = document.getElementById("log-away-loc-country");
const logStadium   = document.getElementById("log-stadium");
const logAddress   = document.getElementById("log-address");
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

const lineupHomeNameInput = document.getElementById("lineup-home-name");
const lineupHomePosInput  = document.getElementById("lineup-home-pos");
const lineupHomeAddBtn    = document.getElementById("lineup-home-add-btn");
const lineupHomeStaged    = document.getElementById("lineup-home-staged");
const lineupHomeLabel     = document.getElementById("lineup-home-label");
const lineupAwayNameInput = document.getElementById("lineup-away-name");
const lineupAwayPosInput  = document.getElementById("lineup-away-pos");
const lineupAwayAddBtn    = document.getElementById("lineup-away-add-btn");
const lineupAwayStaged    = document.getElementById("lineup-away-staged");
const lineupAwayLabel     = document.getElementById("lineup-away-label");

if (logDate) logDate.value = today();

logDateUnknown?.addEventListener("change", () => {
  if (logDate) {
    logDate.disabled = logDateUnknown.checked;
    if (logDateUnknown.checked) logDate.value = "";
  }
});

// staged scorers, lineups and photos for current form
let stagedScorers    = [];
let stagedHomeLineup = [];
let stagedAwayLineup = [];
let stagedPhotoFiles = [];  // new File objects pending upload
let stagedPhotoUrls  = [];  // existing URLs already saved (when editing)
const photoObjectURLs = new Map(); // File -> object URL (for preview)
let editingEventId   = null;

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
  stagedHomeLineup = [];
  stagedAwayLineup = [];
  stagedPhotoUrls = [];
  stagedPhotoFiles.forEach((f) => { const u = photoObjectURLs.get(f); if (u) URL.revokeObjectURL(u); });
  stagedPhotoFiles = [];
  photoObjectURLs.clear();
  renderStagedScorers();
  renderStagedLineup("home");
  renderStagedLineup("away");
  renderStagedPhotos();
  updateSoccerFields();
  const pasteInput  = document.getElementById("lineup-paste-input");
  const pasteStatus = document.getElementById("lineup-paste-status");
  const pasteSection = document.getElementById("lineup-paste-section");
  if (pasteInput)  pasteInput.value = "";
  if (pasteStatus) pasteStatus.textContent = "";
  if (pasteSection) pasteSection.hidden = true;
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
  if (logStadium)   logStadium.value   = ev.stadium         || "";
  if (logAddress)   logAddress.value   = ev.address || ev.city || "";
  if (logCompetition) logCompetition.value = ev.competition || "";

  // pre-fill team locations from saved data
  const locs = loadTeamLocs();
  const homeLoc = ev.homeTeam ? locs[ev.homeTeam.toLowerCase().trim()] : null;
  const awayLoc = ev.awayTeam ? locs[ev.awayTeam.toLowerCase().trim()] : null;
  if (logHomeLocCity)    logHomeLocCity.value    = homeLoc?.city    || "";
  if (logHomeLocState)   logHomeLocState.value   = homeLoc?.state   || "";
  if (logHomeLocCountry) logHomeLocCountry.value = homeLoc?.country || "";
  if (logAwayLocCity)    logAwayLocCity.value    = awayLoc?.city    || "";
  if (logAwayLocState)   logAwayLocState.value   = awayLoc?.state   || "";
  if (logAwayLocCountry) logAwayLocCountry.value = awayLoc?.country || "";
  if (logNotes)     logNotes.value     = ev.notes     || "";

  const hasPens = !!ev.penalties;
  if (logPenaltiesCheck) logPenaltiesCheck.checked = hasPens;
  if (penaltiesWrap) penaltiesWrap.hidden = !hasPens;
  if (logPenHome) logPenHome.value = ev.penalties?.home ?? "";
  if (logPenAway) logPenAway.value = ev.penalties?.away ?? "";

  stagedScorers    = Array.isArray(ev.scorers)     ? [...ev.scorers]     : [];
  stagedHomeLineup = Array.isArray(ev.homeLineup)  ? [...ev.homeLineup]  : [];
  stagedAwayLineup = Array.isArray(ev.awayLineup)  ? [...ev.awayLineup]  : [];
  stagedPhotoUrls  = Array.isArray(ev.photos)      ? [...ev.photos]      : [];
  stagedPhotoFiles.forEach((f) => { const u = photoObjectURLs.get(f); if (u) URL.revokeObjectURL(u); });
  stagedPhotoFiles = [];
  photoObjectURLs.clear();
  renderStagedScorers();
  renderStagedLineup("home");
  renderStagedLineup("away");
  renderStagedPhotos();
  updateSoccerFields();
  updatePenaltyLabels();
  updateLineupLabels();
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
function updateLineupLabels() {
  if (lineupHomeLabel) lineupHomeLabel.textContent = (logHomeTeam?.value.trim() || "Home") + " Lineup";
  if (lineupAwayLabel) lineupAwayLabel.textContent = (logAwayTeam?.value.trim() || "Away") + " Lineup";
}
logHomeTeam?.addEventListener("input", () => { updatePenaltyLabels(); updateLineupLabels(); });
logAwayTeam?.addEventListener("input", () => { updatePenaltyLabels(); updateLineupLabels(); });

function autoFillTeamLoc(teamName, cityEl, stateEl, countryEl) {
  if (!teamName) return;
  const locs = loadTeamLocs();
  const loc  = locs[teamName.toLowerCase().trim()];
  if (!loc) return;
  if (cityEl    && !cityEl.value)    cityEl.value    = loc.city    || "";
  if (stateEl   && !stateEl.value)   stateEl.value   = loc.state   || "";
  if (countryEl && !countryEl.value) countryEl.value = loc.country || "";
}

logHomeTeam?.addEventListener("blur", () =>
  autoFillTeamLoc(logHomeTeam.value, logHomeLocCity, logHomeLocState, logHomeLocCountry));
logAwayTeam?.addEventListener("blur", () =>
  autoFillTeamLoc(logAwayTeam.value, logAwayLocCity, logAwayLocState, logAwayLocCountry));

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

function renderStagedLineup(side) {
  const staged = side === "home" ? stagedHomeLineup : stagedAwayLineup;
  const listEl = side === "home" ? lineupHomeStaged : lineupAwayStaged;
  if (!listEl) return;
  if (!staged.length) { listEl.innerHTML = ""; return; }
  listEl.innerHTML = staged.map((p, i) => `
    <li class="lineup-chip">
      <span>${esc(p.name)}${p.position ? ` <em>(${esc(p.position)})</em>` : ""}</span>
      <button type="button" class="chip-remove" data-lineup-side="${side}" data-lineup-idx="${i}" aria-label="Remove">&times;</button>
    </li>`
  ).join("");
}

lineupHomeAddBtn?.addEventListener("click", () => {
  const name = lineupHomeNameInput?.value.trim() || "";
  if (!name) { lineupHomeNameInput?.focus(); return; }
  const position = lineupHomePosInput?.value.trim() || "";
  stagedHomeLineup.push({ name, position });
  if (lineupHomeNameInput) lineupHomeNameInput.value = "";
  if (lineupHomePosInput)  lineupHomePosInput.value  = "";
  lineupHomeNameInput?.focus();
  renderStagedLineup("home");
});

lineupAwayAddBtn?.addEventListener("click", () => {
  const name = lineupAwayNameInput?.value.trim() || "";
  if (!name) { lineupAwayNameInput?.focus(); return; }
  const position = lineupAwayPosInput?.value.trim() || "";
  stagedAwayLineup.push({ name, position });
  if (lineupAwayNameInput) lineupAwayNameInput.value = "";
  if (lineupAwayPosInput)  lineupAwayPosInput.value  = "";
  lineupAwayNameInput?.focus();
  renderStagedLineup("away");
});

lineupHomeStaged?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-lineup-idx]");
  if (!btn) return;
  const idx = parseInt(btn.dataset.lineupIdx, 10);
  if (btn.dataset.lineupSide === "home") { stagedHomeLineup.splice(idx, 1); renderStagedLineup("home"); }
  else { stagedAwayLineup.splice(idx, 1); renderStagedLineup("away"); }
});
lineupAwayStaged?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-lineup-idx]");
  if (!btn) return;
  const idx = parseInt(btn.dataset.lineupIdx, 10);
  if (btn.dataset.lineupSide === "home") { stagedHomeLineup.splice(idx, 1); renderStagedLineup("home"); }
  else { stagedAwayLineup.splice(idx, 1); renderStagedLineup("away"); }
});

// ── Lineup paste parser ───────────────────────────────
document.getElementById("lineup-paste-toggle")?.addEventListener("click", () => {
  const section = document.getElementById("lineup-paste-section");
  if (!section) return;
  section.hidden = !section.hidden;
  if (!section.hidden) document.getElementById("lineup-paste-input")?.focus();
});

document.getElementById("lineup-paste-btn")?.addEventListener("click", () => {
  const textarea = document.getElementById("lineup-paste-input");
  const status   = document.getElementById("lineup-paste-status");
  const raw = textarea?.value || "";

  const homeEntries = [];
  const awayEntries = [];
  let currentSide = null; // "home" | "away"
  let isSubs = false;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (/^HOME\b/.test(upper)) { currentSide = "home"; isSubs = false; continue; }
    if (/^AWAY\b/.test(upper)) { currentSide = "away"; isSubs = false; continue; }
    if (/^SUBS?\b|^---/.test(upper)) { isSubs = true; continue; }
    if (!currentSide) continue;

    // Strip leading numbers: "1.", "#1", "(1)", "1)" etc.
    const stripped = line.replace(/^[(#]?\d+[.):\s]+/, "").trim();
    if (!stripped) continue;

    const [rawName, rawPos = ""] = stripped.split("|").map((s) => s.trim());
    const name = rawName.trim();
    if (!name) continue;

    let position = rawPos;
    if (isSubs) position = position ? `${position} (Sub)` : "Sub";

    const target = currentSide === "home" ? homeEntries : awayEntries;
    target.push({ name, position });
  }

  if (!homeEntries.length && !awayEntries.length) {
    if (status) { status.textContent = "Nothing parsed — check the format."; status.className = "lineup-paste-status error"; }
    return;
  }

  if (homeEntries.length) { stagedHomeLineup = homeEntries; renderStagedLineup("home"); }
  if (awayEntries.length) { stagedAwayLineup = awayEntries; renderStagedLineup("away"); }

  const parts = [];
  if (homeEntries.length) parts.push(`${homeEntries.length} home`);
  if (awayEntries.length) parts.push(`${awayEntries.length} away`);
  if (status) { status.textContent = `Loaded: ${parts.join(", ")}. Scroll down to review.`; status.className = "lineup-paste-status ok"; }
});

// ── Photo upload (form) ───────────────────────────────
function renderStagedPhotos() {
  const container = document.getElementById("photo-previews");
  if (!container) return;
  const existingHtml = stagedPhotoUrls.map((url, i) => `
    <div class="photo-thumb">
      <img src="${esc(url)}" alt="Photo ${i + 1}" loading="lazy" />
      <button type="button" class="photo-thumb-remove" data-ptype="existing" data-pidx="${i}" aria-label="Remove photo">&times;</button>
    </div>`).join("");
  const newHtml = stagedPhotoFiles.map((f, i) => `
    <div class="photo-thumb photo-thumb-new">
      <img src="${esc(photoObjectURLs.get(f) || "")}" alt="New photo ${i + 1}" />
      <button type="button" class="photo-thumb-remove" data-ptype="new" data-pidx="${i}" aria-label="Remove photo">&times;</button>
    </div>`).join("");
  container.innerHTML = existingHtml + newHtml;
}

const logPhotosInput = document.getElementById("log-photos");
logPhotosInput?.addEventListener("change", () => {
  const files = Array.from(logPhotosInput.files || []);
  const remaining = 10 - stagedPhotoUrls.length - stagedPhotoFiles.length;
  for (const f of files.slice(0, remaining)) {
    if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" is too large (max 10 MB).`); continue; }
    stagedPhotoFiles.push(f);
    photoObjectURLs.set(f, URL.createObjectURL(f));
  }
  logPhotosInput.value = "";
  renderStagedPhotos();
});

document.getElementById("photo-previews")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".photo-thumb-remove");
  if (!btn) return;
  const idx = parseInt(btn.dataset.pidx, 10);
  if (btn.dataset.ptype === "existing") {
    stagedPhotoUrls.splice(idx, 1);
  } else {
    const f = stagedPhotoFiles[idx];
    if (f) { const u = photoObjectURLs.get(f); if (u) URL.revokeObjectURL(u); photoObjectURLs.delete(f); }
    stagedPhotoFiles.splice(idx, 1);
  }
  renderStagedPhotos();
});

function renderRecentEvents() {
  const events = loadEvents();
  const sorted = [...events].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!sorted.length) {
    recentList.innerHTML = "";
    recentEmpty.hidden = false;
    return;
  }
  recentEmpty.hidden = true;

  const byYear = new Map();
  for (const e of sorted) {
    const year = e.date ? e.date.slice(0, 4) : "Unknown";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(e);
  }

  const years = [...byYear.keys()].sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return b.localeCompare(a);
  });

  recentList.innerHTML = years.map((year, i) => {
    const evs = byYear.get(year);
    const open = i === 0 ? " open" : "";
    return `
      <details class="year-accordion"${open}>
        <summary class="year-accordion-head">
          <span class="year-label">${esc(year)}</span>
          <span class="year-count">${evs.length} game${evs.length !== 1 ? "s" : ""}</span>
          <span class="year-chevron" aria-hidden="true">▾</span>
        </summary>
        <ul class="event-list year-event-list">${evs.map(eventItemHTML).join("")}</ul>
      </details>`;
  }).join("");
}

document.getElementById("log-form")?.addEventListener("submit", async (e) => {
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
  const address     = logAddress?.value.trim() || "";
  const side        = logSide?.value || "neutral";
  const scorers     = sport === "soccer" ? [...stagedScorers] : [];
  const competition = sport === "soccer" ? (logCompetition?.value.trim() || "") : "";
  const hasPens     = sport === "soccer" && logPenaltiesCheck?.checked;
  const penalties   = hasPens
    ? { home: parseInt(logPenHome?.value || "0", 10) || 0, away: parseInt(logPenAway?.value || "0", 10) || 0 }
    : null;
  const notes       = logNotes?.value.trim() || "";

  if (!homeTeam && !awayTeam && !stadium && !address) {
    alert("Add at least one team or a stadium so you can identify this event.");
    return;
  }

  const evId = newId();
  const ev = {
    id: evId, date, sport, homeTeam, awayTeam,
    homeScore: isNaN(homeScore) ? 0 : homeScore,
    awayScore: isNaN(awayScore) ? 0 : awayScore,
    stadium, address, side, scorers, competition, penalties,
    homeLineup: [...stagedHomeLineup],
    awayLineup: [...stagedAwayLineup],
    notes, photos: [],
    lat: null, lng: null, createdAt: new Date().toISOString(),
  };

  // Upload photos to Firebase Storage
  if (storage && stagedPhotoFiles.length > 0) {
    const statusEl = document.getElementById("photo-upload-status");
    if (logSubmitBtn) { logSubmitBtn.disabled = true; logSubmitBtn.textContent = "Uploading photos…"; }
    if (statusEl) { statusEl.textContent = `Uploading ${stagedPhotoFiles.length} photo(s)…`; statusEl.hidden = false; }
    const uploadFolder = editingEventId || evId;
    const uploadedUrls = [];
    for (const file of stagedPhotoFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `photos/${currentUser.uid}/${uploadFolder}/${Date.now()}_${safeName}`;
        const snap = await uploadBytes(storageRef(storage, path), file);
        uploadedUrls.push(await getDownloadURL(snap.ref));
      } catch (err) {
        console.error("Photo upload failed:", err);
        if (err?.code === "storage/unauthorized") {
          alert("Photo upload failed: make sure Firebase Storage rules allow authenticated writes.\n\nThe event will be saved without these photos.");
          break;
        }
      }
    }
    ev.photos = [...stagedPhotoUrls, ...uploadedUrls];
    if (logSubmitBtn) { logSubmitBtn.disabled = false; logSubmitBtn.textContent = editingEventId ? "Save Changes" : "Log Event"; }
    if (statusEl) statusEl.hidden = true;
  } else {
    ev.photos = [...stagedPhotoUrls];
  }

  // Save team locations if provided
  const locs = loadTeamLocs();
  let locChanged = false;
  const teamsToSave = [
    { name: homeTeam, city: logHomeLocCity?.value.trim(), state: logHomeLocState?.value.trim(), country: logHomeLocCountry?.value.trim() },
    { name: awayTeam, city: logAwayLocCity?.value.trim(), state: logAwayLocState?.value.trim(), country: logAwayLocCountry?.value.trim() },
  ];
  for (const t of teamsToSave) {
    if (!t.name || (!t.city && !t.country)) continue;
    const key = t.name.toLowerCase().trim();
    const existing = locs[key];
    if (!existing || existing.city !== t.city || existing.state !== t.state || existing.country !== t.country) {
      locs[key] = { city: t.city || "", state: t.state || "", country: t.country || "", lat: null, lng: null };
      locChanged = true;
    }
  }
  if (locChanged) {
    saveTeamLocs(locs);
    // geocode new locations in background
    for (const t of teamsToSave) {
      if (!t.name || (!t.city && !t.country)) continue;
      const key = t.name.toLowerCase().trim();
      if (locs[key] && locs[key].lat === null) {
        geocodeTeamLocation(t.city, t.state, t.country).then((coords) => {
          if (coords) { locs[key].lat = coords.lat; locs[key].lng = coords.lng; saveTeamLocs(locs); }
        });
      }
    }
  }

  const all = loadEvents();
  if (editingEventId) {
    const idx = all.findIndex((e) => e.id === editingEventId);
    if (idx !== -1) {
      const old = all[idx];
      const locUnchanged = (old.stadium || "") === stadium && (old.address || old.city || "") === address;
      all[idx] = { ...old, ...ev, id: editingEventId, lat: locUnchanged ? old.lat : null, lng: locUnchanged ? old.lng : null };
    } else {
      all.push(ev);
    }
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
  if (logAddress)   logAddress.value   = "";
  editingEventId = null;
  if (logSubmitBtn) logSubmitBtn.textContent = "Log Event";
  editCancelBtn.hidden = true;
  if (logDateUnknown) { logDateUnknown.checked = false; if (logDate) logDate.disabled = false; logDate.value = today(); }
  if (logHomeLocCity)    logHomeLocCity.value    = "";
  if (logHomeLocState)   logHomeLocState.value   = "";
  if (logHomeLocCountry) logHomeLocCountry.value = "";
  if (logAwayLocCity)    logAwayLocCity.value    = "";
  if (logAwayLocState)   logAwayLocState.value   = "";
  if (logAwayLocCountry) logAwayLocCountry.value = "";
  if (logCompetition)    logCompetition.value    = "";
  if (logPenaltiesCheck) { logPenaltiesCheck.checked = false; if (penaltiesWrap) penaltiesWrap.hidden = true; }
  if (logPenHome)        logPenHome.value        = "";
  if (logPenAway)        logPenAway.value        = "";
  if (logNotes)          logNotes.value          = "";
  stagedScorers    = [];
  stagedHomeLineup = [];
  stagedAwayLineup = [];
  stagedPhotoUrls  = [];
  stagedPhotoFiles.forEach((f) => { const u = photoObjectURLs.get(f); if (u) URL.revokeObjectURL(u); });
  stagedPhotoFiles = [];
  photoObjectURLs.clear();
  renderStagedScorers();
  renderStagedLineup("home");
  renderStagedLineup("away");
  renderStagedPhotos();

  renderRecentEvents();
  if (activeTab === "photos") renderPhotosTab();
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
  if (activeTab === "photos")   renderPhotosTab();
});

// ── My Stadiums tab ───────────────────────────────────
const filterSport  = document.getElementById("filter-sport");
const filterYear   = document.getElementById("filter-year");
const fullList     = document.getElementById("full-list");
const fullEmpty    = document.getElementById("full-empty");
const mapEmpty     = document.getElementById("map-empty");
const mapContainer = document.getElementById("events-map");

let stadiumMapInstance  = null;
let stadiumMapReady     = false;
let stadiumLayerGroup   = null;

filterSport?.addEventListener("change", renderStadiumsTab);
filterYear?.addEventListener("change",  renderStadiumsTab);

function renderStadiumsTab() {
  const events = loadEvents();

  if (filterYear) {
    const years = [...new Set(events.filter((e) => e.date).map((e) => e.date.slice(0, 4)))].sort().reverse();
    const cur = filterYear.value;
    filterYear.innerHTML =
      `<option value="">All Years</option>` +
      years.map((y) => `<option value="${y}"${y === cur ? " selected" : ""}>${y}</option>`).join("");
  }

  let filtered = [...events];
  if (filterSport?.value) filtered = filtered.filter((e) => e.sport === filterSport.value);
  if (filterYear?.value)  filtered = filtered.filter((e) => e.date && e.date.startsWith(filterYear.value));
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

  // Group by rounded coordinates so same-location venues share one marker
  const byCoord = new Map();
  withCoords.forEach((e) => {
    const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    if (!byCoord.has(key)) byCoord.set(key, { lat: e.lat, lng: e.lng, venues: new Map() });
    const loc = byCoord.get(key);
    const vKey = `${e.stadium}|||${e.address || ""}`;
    if (!loc.venues.has(vKey)) loc.venues.set(vKey, { stadium: e.stadium, address: e.address || "", events: [] });
    loc.venues.get(vKey).events.push(e);
  });

  if (!byCoord.size) {
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
    stadiumLayerGroup = window.L.layerGroup().addTo(stadiumMapInstance);
    stadiumMapReady = true;
  } else {
    stadiumLayerGroup.clearLayers();
  }

  const bounds = [];
  byCoord.forEach(({ lat, lng, venues }) => {
    const venueBlocks = [...venues.values()].map(({ stadium, address, events: evts }) => {
      const lines = [...evts].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .map((e) => `<b>${esc(e.homeTeam)} ${scoreDisplay(e)} ${esc(e.awayTeam)}</b><br>${sportLabel(e.sport)} · ${e.date ? formatDate(e.date) : "Date unknown"}`)
        .join("<hr style='margin:4px 0'>");
      return `<b>${esc(stadium)}</b>${address ? `<br><em>${esc(address)}</em>` : ""}<hr style='margin:5px 0'>${lines}`;
    }).join("<hr style='margin:6px 0;border-color:#c8ecea'>");
    window.L.marker([lat, lng]).addTo(stadiumLayerGroup).bindPopup(venueBlocks, { maxHeight: 220 });
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
  const info   = loadScorerInfo();

  // Aggregate all scorers across all soccer events
  const byScorer = new Map();
  events.forEach((e) => {
    if (e.sport !== "soccer" || !e.scorers.length) return;
    e.scorers.forEach((s) => {
      const key = s.name.toLowerCase().trim();
      if (!byScorer.has(key)) {
        byScorer.set(key, { key, name: s.name, goals: 0, games: [] });
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

  const exportBtn = document.getElementById("export-scorers-btn");
  if (!scorers.length) {
    scorersAllList.innerHTML = "";
    scorersAllEmpty.hidden = false;
    if (exportBtn) exportBtn.hidden = true;
    return;
  }
  scorersAllEmpty.hidden = true;
  if (exportBtn) exportBtn.hidden = false;
  scorersAllList.innerHTML = scorers.map((s) => {
    const bp  = info[s.key] || null;
    const bpText = bp ? [bp.city, bp.state, bp.country].filter(Boolean).join(", ") : "";
    const birthplaceHtml = bpText
      ? `<div class="scorer-birthplace">
           <span class="scorer-bp-display">🌍 ${esc(bpText)}</span>
           <button class="btn btn-sm" type="button" data-action="edit-scorer-bp" data-scorer-key="${esc(s.key)}">Edit</button>
         </div>`
      : `<div class="scorer-birthplace">
           <button class="btn btn-sm" type="button" data-action="edit-scorer-bp" data-scorer-key="${esc(s.key)}">+ Add birthplace</button>
         </div>`;
    const formHtml = `
      <form class="scorer-bp-form team-loc-form" data-scorer-key="${esc(s.key)}" hidden>
        <div class="team-loc-inputs">
          <input class="scorer-bp-city" type="text" placeholder="City" maxlength="80" value="${esc(bp?.city || "")}" />
          <input class="scorer-bp-state" type="text" placeholder="State (optional)" maxlength="80" value="${esc(bp?.state || "")}" />
          <input class="scorer-bp-country" type="text" placeholder="Country" maxlength="80" value="${esc(bp?.country || "")}" />
        </div>
        <div class="team-loc-actions">
          <button type="submit" class="btn btn-sm btn-primary">Save</button>
          <button type="button" class="btn btn-sm" data-action="cancel-scorer-bp">Cancel</button>
        </div>
      </form>`;
    const gameLines = [...s.games]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((g) => {
        const min = g.minute ? ` ${esc(g.minute)}'` : "";
        return `<li class="scorer-game-line">${esc(g.match)} · <em>${esc(g.team)}${min}</em> · ${formatDate(g.date)}</li>`;
      }).join("");
    return `
      <li class="scorer-entry" data-scorer-key="${esc(s.key)}">
        <div class="scorer-entry-head">
          <span class="scorer-entry-name">${esc(s.name)}</span>
          <span class="scorer-entry-count">${s.goals} ${s.goals === 1 ? "goal" : "goals"}</span>
        </div>
        ${birthplaceHtml}${formHtml}
        <ul class="scorer-game-list">${gameLines}</ul>
      </li>`;
  }).join("");
}

function exportScorersCSV() {
  const events = loadEvents();
  const byScorer = new Map();
  events.forEach((e) => {
    if (e.sport !== "soccer" || !e.scorers.length) return;
    e.scorers.forEach((s) => {
      const key = s.name.toLowerCase().trim();
      if (!byScorer.has(key)) byScorer.set(key, { name: s.name, goals: 0, games: [] });
      const entry = byScorer.get(key);
      entry.goals++;
      entry.games.push({
        date: e.date,
        match: `${e.homeTeam} ${e.homeScore ?? "?"}–${e.awayScore ?? "?"} ${e.awayTeam}`,
        team: s.team === "home" ? e.homeTeam : e.awayTeam,
        minute: s.minute || "",
        stadium: e.stadium || "",
      });
    });
  });

  const scorers = [...byScorer.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Player", "Total Goals", "Match", "Team Scored For", "Minute", "Date", "Stadium"]];
  scorers.forEach((s) => {
    [...s.games].sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach((g) => {
      rows.push([s.name, s.goals, g.match, g.team, g.minute, g.date ? formatDate(g.date) : "", g.stadium]);
    });
  });

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "scorers.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById("export-scorers-btn")?.addEventListener("click", exportScorersCSV);

// ── Scorers view toggle + map ─────────────────────────
const scorersListSection = document.getElementById("scorers-list-section");
const scorersMapSection  = document.getElementById("scorers-map-section");
const scorersMapEl       = document.getElementById("scorers-map");
const scorersMapEmpty    = document.getElementById("scorers-map-empty");

let scorersView       = "list";
let scorersMapInstance = null;
let scorersMapReady    = false;
let scorersLayerGroup  = null;

document.querySelectorAll("[data-sview]").forEach((btn) => {
  btn.addEventListener("click", () => {
    scorersView = btn.dataset.sview;
    document.querySelectorAll("[data-sview]").forEach((b) => b.classList.toggle("active", b.dataset.sview === scorersView));
    scorersListSection.hidden = scorersView !== "list";
    scorersMapSection.hidden  = scorersView !== "map";
    if (scorersView === "map") renderScorersMap();
  });
});

// Birthplace form event delegation
scorersAllList?.addEventListener("click", (e) => {
  const editBtn   = e.target.closest("[data-action='edit-scorer-bp']");
  const cancelBtn = e.target.closest("[data-action='cancel-scorer-bp']");
  if (editBtn) {
    const key  = editBtn.dataset.scorerKey;
    const form = scorersAllList.querySelector(`.scorer-bp-form[data-scorer-key="${key}"]`);
    if (form) form.hidden = false;
  }
  if (cancelBtn) {
    const form = cancelBtn.closest(".scorer-bp-form");
    if (form) form.hidden = true;
  }
});

scorersAllList?.addEventListener("submit", async (e) => {
  const form = e.target.closest(".scorer-bp-form");
  if (!form) return;
  e.preventDefault();
  const key     = form.dataset.scorerKey;
  const city    = form.querySelector(".scorer-bp-city")?.value.trim() || "";
  const state   = form.querySelector(".scorer-bp-state")?.value.trim() || "";
  const country = form.querySelector(".scorer-bp-country")?.value.trim() || "";
  if (!city && !country) { form.hidden = true; return; }

  const info = loadScorerInfo();
  info[key] = { city, state, country, lat: null, lng: null };

  const coords = await geocodeTeamLocation(city, state, country);
  if (coords) { info[key].lat = coords.lat; info[key].lng = coords.lng; }
  saveScorerInfo(info);
  renderScorersTab();
});

function renderScorersMap() {
  const info    = loadScorerInfo();
  const events  = loadEvents();

  // Build scorer list with birthplace coords
  const byScorer = new Map();
  events.forEach((e) => {
    if (e.sport !== "soccer" || !e.scorers.length) return;
    e.scorers.forEach((s) => {
      const key = s.name.toLowerCase().trim();
      if (!byScorer.has(key)) byScorer.set(key, { key, name: s.name, goals: 0 });
      byScorer.get(key).goals++;
    });
  });

  const scorers = [...byScorer.values()]
    .map((s) => ({ ...s, bp: info[s.key] || null }))
    .filter((s) => s.bp?.lat != null);

  if (!scorers.length) {
    if (scorersMapEl)    scorersMapEl.style.display    = "none";
    if (scorersMapEmpty) scorersMapEmpty.hidden         = false;
    return;
  }
  if (scorersMapEl)    scorersMapEl.style.display    = "";
  if (scorersMapEmpty) scorersMapEmpty.hidden         = true;
  if (typeof window.L === "undefined") return;

  if (!scorersMapReady) {
    scorersMapInstance = window.L.map("scorers-map").setView([20, 0], 2);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(scorersMapInstance);
    scorersLayerGroup = window.L.layerGroup().addTo(scorersMapInstance);
    scorersMapReady = true;
  } else {
    scorersLayerGroup.clearLayers();
  }

  // Group scorers sharing the same coordinates
  const byLatLng = new Map();
  scorers.forEach((s) => {
    const coordKey = `${s.bp.lat.toFixed(5)},${s.bp.lng.toFixed(5)}`;
    if (!byLatLng.has(coordKey)) byLatLng.set(coordKey, { lat: s.bp.lat, lng: s.bp.lng, scorers: [] });
    byLatLng.get(coordKey).scorers.push(s);
  });

  const bounds = [];
  byLatLng.forEach(({ lat, lng, scorers: locScorers }) => {
    const first   = locScorers[0];
    const bpText  = [first.bp.city, first.bp.state, first.bp.country].filter(Boolean).join(", ");
    const lines   = locScorers.map((s) => `<b>${esc(s.name)}</b> — ${s.goals} ${s.goals === 1 ? "goal" : "goals"}`).join("<br>");
    const popup   = `<em>${esc(bpText)}</em><hr style='margin:5px 0'>${lines}`;
    const icon    = locScorers.length > 1 ? teamCountIcon(locScorers.length) : new window.L.Icon.Default();
    window.L.marker([lat, lng], { icon }).addTo(scorersLayerGroup).bindPopup(popup);
    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) scorersMapInstance.setView(bounds[0], 6);
  else scorersMapInstance.fitBounds(bounds, { padding: [40, 40] });
  window.requestAnimationFrame(() => scorersMapInstance.invalidateSize());
}

// ── Scorer info storage (birthplace) ─────────────────
function scorerInfoKey() { return currentUser ? `life-tracker-scorer-info-${currentUser.uid}` : null; }

function loadScorerInfo() {
  try {
    const key = scorerInfoKey();
    if (!key) return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveScorerInfo(info) {
  const key = scorerInfoKey();
  if (key) localStorage.setItem(key, JSON.stringify(info));
  const ref = userDocRef();
  if (ref) setDoc(ref, { scorerInfo: info }, { merge: true }).catch(() => {});
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
  const ref = userDocRef();
  if (ref) setDoc(ref, { teamLocs: locs }, { merge: true }).catch(() => {});
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

let teamsView        = "list";
let teamsMapInstance  = null;
let teamsMapReady     = false;
let teamsLayerGroup   = null;

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
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
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

function teamCountIcon(count) {
  return window.L.divIcon({
    className: "",
    iconSize:    [25, 41],
    iconAnchor:  [12, 41],
    popupAnchor: [1, -34],
    html: `<div style="position:relative;width:25px;height:41px">
      <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
           width="25" height="41" style="position:absolute;top:0;left:0" />
      <div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:18px;padding:0 4px;
                  border-radius:999px;background:#e53935;color:#fff;font-size:11px;font-weight:700;
                  display:flex;align-items:center;justify-content:center;
                  border:2px solid #fff;font-family:sans-serif;line-height:1;box-sizing:border-box">${count}</div>
    </div>`,
  });
}

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
    teamsLayerGroup = window.L.layerGroup().addTo(teamsMapInstance);
    teamsMapReady = true;
  } else {
    teamsLayerGroup.clearLayers();
  }

  // Group teams that share the same coordinates into one marker
  const byLatLng = new Map();
  teams.forEach((t) => {
    const key = `${t.loc.lat.toFixed(5)},${t.loc.lng.toFixed(5)}`;
    if (!byLatLng.has(key)) byLatLng.set(key, { lat: t.loc.lat, lng: t.loc.lng, teams: [] });
    byLatLng.get(key).teams.push(t);
  });

  const bounds = [];
  byLatLng.forEach(({ lat, lng, teams: locTeams }) => {
    const locText = [locTeams[0].loc.city, locTeams[0].loc.state, locTeams[0].loc.country].filter(Boolean).join(", ");
    const teamBlocks = locTeams.map((t) => {
      const gameLines = [...t.games].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .map((g) => `${esc(g.match)} · ${g.date ? formatDate(g.date) : "Date unknown"}`)
        .join("<br>");
      return `<b>${esc(t.name)}</b><hr style='margin:4px 0'>${gameLines}`;
    }).join("<hr style='margin:6px 0;border-color:#c8ecea'>");
    const popup = `<em>${esc(locText)}</em><hr style='margin:5px 0'>${teamBlocks}`;
    const icon = locTeams.length > 1 ? teamCountIcon(locTeams.length) : new window.L.Icon.Default();
    window.L.marker([lat, lng], { icon }).addTo(teamsLayerGroup).bindPopup(popup, { maxHeight: 220 });
    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) teamsMapInstance.setView(bounds[0], 10);
  else teamsMapInstance.fitBounds(bounds, { padding: [40, 40] });
  window.requestAnimationFrame(() => teamsMapInstance.invalidateSize());
}

// ── Geocoding ─────────────────────────────────────────
async function nominatimSearch(q) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { Accept: "application/json", "User-Agent": "LifeTrackerApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
  } catch { return null; }
}

async function geocodeStadium(stadium, address) {
  // Try "Stadium, Address" together first — returns the actual venue, not just city center
  if (stadium && address) {
    const coords = await nominatimSearch(`${stadium}, ${address}`);
    if (coords) return coords;
    await new Promise((r) => setTimeout(r, 1200));
  }
  // Fall back to address alone
  if (address) {
    const coords = await nominatimSearch(address);
    if (coords) return coords;
    if (stadium) await new Promise((r) => setTimeout(r, 1200));
  }
  // Last resort: stadium name alone
  return stadium ? nominatimSearch(stadium) : null;
}

async function geocodePending() {
  if (!currentUser) return;
  const events  = loadEvents();
  const pending = events.filter((e) => e.stadium && (e.address || e.city) && e.lat === null);
  if (!pending.length) return;
  let changed = false;
  for (const ev of pending) {
    await new Promise((r) => setTimeout(r, 1200));
    const coords = await geocodeStadium(ev.stadium, ev.address || ev.city || "");
    if (coords) { ev.lat = coords.lat; ev.lng = coords.lng; changed = true; }
  }
  if (changed) {
    saveEvents(events);
    if (activeTab === "stadiums") renderStadiumsTab();
    if (activeTab === "teams")    renderTeamsTab();
  }
}

// ── App init ──────────────────────────────────────────
async function initApp() {
  updateSoccerFields();

  // Merge Firestore data with whatever is already on this device, then persist the union
  const ref = userDocRef();
  if (ref) {
    try {
      const snap = await getDoc(ref);
      const evKey = storageKey();
      const tlKey = teamLocsKey();
      const siKey = scorerInfoKey();

      const localEvents     = loadEvents();
      const localTeamLocs   = loadTeamLocs();
      const localScorerInfo = loadScorerInfo();

      let mergedEvents     = localEvents;
      let mergedTeamLocs   = localTeamLocs;
      let mergedScorerInfo = localScorerInfo;

      if (snap.exists()) {
        const data = snap.data();

        // Merge events: union by id, keep the copy with the later createdAt on conflict
        if (Array.isArray(data.events)) {
          const byId = new Map();
          for (const e of data.events) {
            if (e && typeof e.id === "string") byId.set(e.id, e);
          }
          for (const e of localEvents) {
            const existing = byId.get(e.id);
            if (!existing) {
              byId.set(e.id, e);
            } else {
              const existingTs = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
              const localTs    = e.createdAt        ? new Date(e.createdAt).getTime()        : 0;
              if (localTs > existingTs) byId.set(e.id, e);
            }
          }
          mergedEvents = Array.from(byId.values());
        }

        // Merge teamLocs: union of all keys; prefer whichever copy has coordinates
        if (data.teamLocs && typeof data.teamLocs === "object") {
          mergedTeamLocs = { ...data.teamLocs };
          for (const [key, local] of Object.entries(localTeamLocs)) {
            const remote = mergedTeamLocs[key];
            if (!remote) {
              mergedTeamLocs[key] = local;
            } else {
              const localHasCoords  = local.lat  != null && local.lng  != null;
              const remoteHasCoords = remote.lat != null && remote.lng != null;
              if (localHasCoords || !remoteHasCoords) mergedTeamLocs[key] = local;
            }
          }
        }

        // Merge scorerInfo: union of all keys; prefer whichever copy has coordinates
        if (data.scorerInfo && typeof data.scorerInfo === "object") {
          mergedScorerInfo = { ...data.scorerInfo };
          for (const [key, local] of Object.entries(localScorerInfo)) {
            const remote = mergedScorerInfo[key];
            if (!remote) {
              mergedScorerInfo[key] = local;
            } else {
              const localHasCoords  = local.lat  != null && local.lng  != null;
              const remoteHasCoords = remote.lat != null && remote.lng != null;
              if (localHasCoords || !remoteHasCoords) mergedScorerInfo[key] = local;
            }
          }
        }
      }

      // Write merged result back to both localStorage and Firestore
      if (evKey) localStorage.setItem(evKey, JSON.stringify(mergedEvents));
      if (tlKey) localStorage.setItem(tlKey, JSON.stringify(mergedTeamLocs));
      if (siKey) localStorage.setItem(siKey, JSON.stringify(mergedScorerInfo));
      setDoc(ref, { events: mergedEvents, teamLocs: mergedTeamLocs, scorerInfo: mergedScorerInfo }, { merge: true }).catch(() => {});

    } catch { /* fall through to whatever is in localStorage */ }
  }

  renderRecentEvents();
  geocodePending();
}

// ── Photos tab ────────────────────────────────────────
let lightboxPhotos = [];
let lightboxIndex  = 0;

function renderPhotosTab() {
  const content  = document.getElementById("photos-content");
  const emptyMsg = document.getElementById("photos-empty");
  const events   = loadEvents().filter((e) => e.photos && e.photos.length > 0);

  if (!events.length) {
    if (content)  content.innerHTML = "";
    if (emptyMsg) emptyMsg.hidden   = false;
    return;
  }
  if (emptyMsg) emptyMsg.hidden = true;

  const byYear = new Map();
  for (const e of events) {
    const year = e.date ? e.date.slice(0, 4) : "Unknown";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(e);
  }

  const years = [...byYear.keys()].sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return b.localeCompare(a);
  });

  const allPhotos = [];

  const html = years.map((year, yi) => {
    const yearEvents = [...byYear.get(year)].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const byVenue = new Map();
    for (const e of yearEvents) {
      const venue = e.stadium || e.address || "Unknown Venue";
      if (!byVenue.has(venue)) byVenue.set(venue, []);
      byVenue.get(venue).push(e);
    }

    const venueHtml = [...byVenue.entries()].map(([venue, venueEvents]) => {
      const gridItems = venueEvents.flatMap((e) =>
        e.photos.map((url) => {
          const idx = allPhotos.length;
          const caption = `${e.homeTeam || "?"} ${scoreDisplay(e)} ${e.awayTeam || "?"}${e.date ? " · " + formatDate(e.date) : ""} · ${esc(venue)}`;
          allPhotos.push({ url, caption });
          return `<button class="photo-grid-item" type="button" data-photo-idx="${idx}" aria-label="View photo">
            <img src="${esc(url)}" alt="${esc(caption)}" loading="lazy" />
          </button>`;
        })
      ).join("");

      return `<div class="photos-venue-group">
        <p class="photos-venue-label">📍 ${esc(venue)}</p>
        <div class="photos-grid">${gridItems}</div>
      </div>`;
    }).join("");

    const total = yearEvents.reduce((s, e) => s + e.photos.length, 0);
    const open  = yi === 0 ? " open" : "";
    return `<details class="year-accordion"${open}>
      <summary class="year-accordion-head">
        <span class="year-label">${esc(year)}</span>
        <span class="year-count">${total} photo${total !== 1 ? "s" : ""}</span>
        <span class="year-chevron" aria-hidden="true">▾</span>
      </summary>
      <div class="photos-year-content">${venueHtml}</div>
    </details>`;
  }).join("");

  if (content) content.innerHTML = html;
  lightboxPhotos = allPhotos;
}

document.getElementById("photos-content")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".photo-grid-item");
  if (!btn) return;
  const idx = parseInt(btn.dataset.photoIdx, 10);
  if (idx >= 0 && idx < lightboxPhotos.length) openLightbox(idx);
});

// ── Lightbox ──────────────────────────────────────────
const lightboxEl      = document.getElementById("photo-lightbox");
const lightboxImg     = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose   = document.getElementById("lightbox-close");
const lightboxPrev    = document.getElementById("lightbox-prev");
const lightboxNext    = document.getElementById("lightbox-next");

function openLightbox(index) {
  showLightboxPhoto(index);
  lightboxEl.hidden = false;
  document.body.style.overflow = "hidden";
  lightboxClose?.focus();
}

function closeLightbox() {
  lightboxEl.hidden = true;
  document.body.style.overflow = "";
}

function showLightboxPhoto(index) {
  lightboxIndex = Math.max(0, Math.min(index, lightboxPhotos.length - 1));
  const p = lightboxPhotos[lightboxIndex];
  if (!p) return;
  lightboxImg.src = p.url;
  lightboxImg.alt = p.caption;
  if (lightboxCaption) lightboxCaption.textContent = p.caption;
  if (lightboxPrev) lightboxPrev.hidden = lightboxIndex === 0;
  if (lightboxNext) lightboxNext.hidden = lightboxIndex === lightboxPhotos.length - 1;
}

lightboxClose?.addEventListener("click", closeLightbox);
lightboxPrev?.addEventListener("click", () => showLightboxPhoto(lightboxIndex - 1));
lightboxNext?.addEventListener("click", () => showLightboxPhoto(lightboxIndex + 1));
lightboxEl?.addEventListener("click", (e) => { if (e.target === lightboxEl) closeLightbox(); });
document.addEventListener("keydown", (e) => {
  if (!lightboxEl || lightboxEl.hidden) return;
  if (e.key === "Escape")      closeLightbox();
  if (e.key === "ArrowLeft")   showLightboxPhoto(lightboxIndex - 1);
  if (e.key === "ArrowRight")  showLightboxPhoto(lightboxIndex + 1);
});
