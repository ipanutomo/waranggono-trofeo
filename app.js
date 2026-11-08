/*************************************************************
 * WARANGGONO TROFEO 2026 — FRONTEND APP
 *************************************************************/

// ============ KONFIGURASI ============
const PUBLIC_API_URL = "https://script.google.com/macros/s/AKfycbxCZrDtGoDDMSwpmkBkm9LqdRIelP_sssJ1qnkFLxcAhD15jSsIV_dMzCewShd3vJRU/exec";
const ADMIN_STORAGE_KEY = "trofeo.adminApiUrl";

// ============ STATE ============
let state = {
  adminApiUrl: localStorage.getItem(ADMIN_STORAGE_KEY) || "",
  data: null,
  loading: false,
  filter: "all",
  adminTab: "teams",
  autoRefreshTimer: null
};
const isAdminMode = () => !!state.adminApiUrl;

// ============ UTIL ============
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function el(id) { return document.getElementById(id); }

// ============ API ============
async function fetchPublic() {
  const r = await fetch(PUBLIC_API_URL + "?action=all&t=" + Date.now());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Gagal ambil data");
  return j.data;
}

async function fetchAdmin() {
  if (!isAdminMode()) throw new Error("Mode admin belum aktif");
  const r = await fetch(state.adminApiUrl + "?action=all&t=" + Date.now());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Gagal ambil data admin");
  return j.data;
}

async function postAdmin(action, body) {
  if (!isAdminMode()) throw new Error("Mode admin belum aktif");
  const payload = JSON.stringify({ action: action, ...body });
  const r = await fetch(state.adminApiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: payload
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Gagal simpan");
  return j.data;
}

// ============ RENDER: HERO / STATS ============
function renderHeader() {
  const c = state.data.config || {};
  const name = c.tournament_name || "Waranggono Trofeo 2026";
  document.title = name + " — Jadwal & Klasemen";
  el("tournamentName").textContent = name;
  const statusMap = {
    penyisihan: "PENYISIHAN · ROUND ROBIN",
    semifinal: "SEMIFINAL",
    final: "FINAL",
    selesai: "SELESAI"
  };
  el("headerTag").textContent = statusMap[c.status] || String(c.status || "").toUpperCase();
}

function renderHero() {
  const c = state.data.config || {};
  const matches = state.data.matches || [];
  const teams = state.data.teams || [];
  const totalGroupMatches = matches.filter(m => m.group).length;
  const groups = [...new Set(teams.map(t => t.group))].filter(Boolean).sort();

  el("heroTitle").textContent =
    c.status === "selesai" ? "Turnamen Selesai" :
    c.status === "final" ? "Pertandingan Final" :
    c.status === "semifinal" ? "Fase Semifinal" :
    "Fase Penyisihan Grup";
  el("heroSub").textContent =
    `${groups.length} grup · ${teams.length} tim · 1 lapangan · Juara grup lolos ke semifinal`;

  el("statTotal").textContent = String(totalGroupMatches);
  el("statGroups").textContent = String(groups.length);
  el("statDuration").textContent = (c.match_duration || 35) + "'";
  el("statEnd").textContent = c.target_end || "15:55";
  el("startTime").textContent = c.kickoff_first || "08:00";
}

// ============ RENDER: FILTER ============
function renderFilters() {
  const teams = state.data.teams || [];
  const groups = [...new Set(teams.map(t => t.group))].filter(Boolean).sort();
  const nav = el("filters");
  nav.innerHTML = `<button class="filter ${state.filter === "all" ? "active" : ""}" data-filter="all">Semua pertandingan</button>` +
    groups.map(g => `<button class="filter ${state.filter === g ? "active" : ""}" data-filter="${g}">Grup ${g}</button>`).join("");
  nav.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      renderFilters();
      renderSchedule();
    });
  });
}

// ============ RENDER: SCHEDULE ============
function renderSchedule() {
  const matches = (state.data.matches || []).slice().sort((a, b) => (a.match_no || 0) - (b.match_no || 0));
  const filtered = state.filter === "all" ? matches : matches.filter(m => m.group === state.filter);
  const wrap = el("schedule");

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty">Belum ada pertandingan.</div>';
    return;
  }
  wrap.innerHTML = filtered.map(m => {
    const finished = m.status === "finished" && m.score_home !== null && m.score_away !== null;
    const scoreHtml = finished
      ? `<span class="score">${m.score_home} - ${m.score_away}</span>`
      : `<em>VS</em>`;
    return `
      <article class="match">
        <div class="match-time"><strong>${esc(m.kickoff || "—")}</strong><small>WIB · MULAI</small></div>
        <div class="teams">
          <div class="match-meta">
            <span class="group">${m.group ? "GRUP " + esc(m.group) : (m.notes ? esc(m.notes) : "KNOCKOUT")}</span>
            <span class="match-no">MATCH ${String(m.match_no || 0).padStart(2, "0")}</span>
          </div>
          <div class="vs">
            <span class="team">${esc(m.team_home || "TBD")}</span>
            ${scoreHtml}
            <span class="team">${esc(m.team_away || "TBD")}</span>
          </div>
        </div>
        <div class="duration">
          <b>${finished ? "Selesai" : (m.status === "live" ? "Live" : "35 menit")}</b>
          <small>${finished ? esc(m.end_time || "") : "Selesai " + esc(m.end_time || "—")}</small>
        </div>
      </article>
    `;
  }).join("");
}

// ============ RENDER: STANDINGS ============
function renderStandings() {
  const wrap = el("standings");
  const standings = state.data.standings || {};
  const groups = Object.keys(standings).sort();
  if (!groups.length) {
    wrap.innerHTML = '<div class="empty">Klasemen belum tersedia.</div>';
    return;
  }
  wrap.innerHTML = groups.map(g => {
    const rows = standings[g] || [];
    return `
      <div class="standings-card">
        <h4>GRUP ${esc(g)}</h4>
        <div class="standings-table">
          <div class="st-row st-head">
            <span>#</span><span>Tim</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>Pts</span>
          </div>
          ${rows.map(t => `
            <div class="st-row ${t.rank === 1 ? "qualify" : ""}">
              <span>${t.rank}</span>
              <span class="st-team">${esc(t.team_name)}</span>
              <span>${t.played}</span>
              <span>${t.won}</span>
              <span>${t.drawn}</span>
              <span>${t.lost}</span>
              <span>${t.goal_diff > 0 ? "+" + t.goal_diff : t.goal_diff}</span>
              <span class="st-pts">${t.points}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// ============ RENDER: BRACKET ============
function renderBracket() {
  const b = state.data.bracket || {};
  const wrap = el("bracket");
  const items = [
    { key: "sf1", label: "Semifinal 1", m: b.sf1 },
    { key: "sf2", label: "Semifinal 2", m: b.sf2 },
    { key: "third", label: "Perebutan 3rd", m: b.third },
    { key: "final", label: "Final", m: b.final }
  ];
  wrap.innerHTML = items.map(it => {
    const m = it.m;
    const home = m && m.team_home ? esc(m.team_home) : "TBD";
    const away = m && m.team_away ? esc(m.team_away) : "TBD";
    const score = (m && m.status === "finished" && m.score_home !== null && m.score_away !== null)
      ? `<span class="score">${m.score_home} - ${m.score_away}</span>` : `<em>vs</em>`;
    const time = m && m.kickoff ? esc(m.kickoff) : "—";
    return `
      <div class="bracket-card">
        <div class="bracket-label">${it.label}</div>
        <div class="bracket-match">
          <span class="bracket-team">${home}</span>
          ${score}
          <span class="bracket-team">${away}</span>
        </div>
        <div class="bracket-time">${time}</div>
      </div>
    `;
  }).join("");

  // Champion
  const champ = state.data.champion;
  const champWrap = el("champion");
  if (champ && champ.winner_name) {
    champWrap.innerHTML = `<div class="champion-banner">🏆 Juara: <strong>${esc(champ.winner_name)}</strong></div>`;
  } else {
    champWrap.innerHTML = "";
  }
}

// ============ ADMIN: TOGGLE ============
function updateAdminUI() {
  const on = isAdminMode();
  // Tombol ⚙ hanya muncul saat BELUM setting admin URL
  el("adminBtn").style.display = on ? "none" : "inline-flex";
  // Tombol logout hanya muncul saat mode admin
  el("logoutBtn").style.display = on ? "inline-flex" : "none";
  // Panel admin
  el("adminPanel").style.display = on ? "block" : "none";
  // Notice publik disembunyikan saat admin
  el("publicNotice").style.display = on ? "none" : "flex";
}

function openSettingModal() {
  const cur = state.adminApiUrl || "";
  const url = prompt(
    "Masukkan URL API Admin (dari Apps Script Admin):\n\n" +
    "Contoh:\nhttps://script.google.com/macros/s/AKfy.../exec\n\n" +
    "URL saat ini: " + (cur ? cur.slice(0, 50) + "..." : "(kosong)"),
    cur
  );
  if (url === null) return; // cancel
  const trimmed = url.trim();
  if (!trimmed) {
    if (cur && confirm("Hapus URL admin dan kembali ke mode publik?")) {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      location.reload();
    }
    return;
  }
  if (!/^https:\/\/script\.google\.com\//.test(trimmed)) {
    alert("URL harus diawali https://script.google.com/");
    return;
  }
  // test ping
  fetch(trimmed + "?action=ping")
    .then(r => r.json())
    .then(j => {
      if (!j.ok) throw new Error("Ping gagal");
      localStorage.setItem(ADMIN_STORAGE_KEY, trimmed);
      location.reload();
    })
    .catch(() => alert("Gagal konek ke API admin. Cek URL."));
}

// ============ ADMIN: PANEL ============
function renderAdminPanel() {
  if (!isAdminMode()) return;
  const tabs = el("adminTabs");
  tabs.querySelectorAll(".admin-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === state.adminTab);
    btn.onclick = () => { state.adminTab = btn.dataset.tab; renderAdminPanel(); };
  });
  const content = el("adminContent");
  if (state.adminTab === "teams") content.innerHTML = adminTeamsHTML();
  else if (state.adminTab === "schedule") content.innerHTML = adminScheduleHTML();
  else if (state.adminTab === "scores") content.innerHTML = adminScoresHTML();
  else if (state.adminTab === "knockout") content.innerHTML = adminKnockoutHTML();
  else content.innerHTML = "";

  // bind events
  if (state.adminTab === "teams") bindAdminTeams();
  if (state.adminTab === "schedule") bindAdminSchedule();
  if (state.adminTab === "scores") bindAdminScores();
  if (state.adminTab === "knockout") bindAdminKnockout();
}

function adminTeamsHTML() {
  const teams = state.data.teams || [];
  return `<div class="admin-grid">${
    teams.map(t => `
      <label class="admin-field">
        <span>${esc(t.team_id)} (Grup ${esc(t.group)})</span>
        <input type="text" data-team-id="${esc(t.team_id)}" value="${esc(t.team_name)}" maxlength="32">
      </label>
    `).join("")
  }</div>
  <button class="btn primary" id="saveTeamsBtn">💾 Simpan Nama Tim</button>`;
}
function bindAdminTeams() {
  el("saveTeamsBtn").onclick = async () => {
    const inputs = document.querySelectorAll("[data-team-id]");
    const teams = Array.from(inputs).map(i => ({ team_id: i.dataset.teamId, team_name: i.value.trim() }));
    if (teams.some(t => !t.team_name)) { alert("Nama tim tidak boleh kosong"); return; }
    try {
      el("saveTeamsBtn").disabled = true;
      await postAdmin("updateTeams", { teams });
      await loadData();
      alert("Tersimpan");
    } catch (e) { alert("Gagal: " + e.message); }
    finally { el("saveTeamsBtn").disabled = false; }
  };
}

function adminScheduleHTML() {
  const matches = (state.data.matches || []).filter(m => m.group).sort((a,b) => (a.match_no||0)-(b.match_no||0));
  return `<table class="admin-table">
    <thead><tr><th>Match</th><th>Grup</th><th>Tim Home</th><th>Tim Away</th><th>Kickoff</th><th>Status</th></tr></thead>
    <tbody>${matches.map(m => `
      <tr data-match-id="${esc(m.match_id)}">
        <td>${esc(m.match_id)}</td>
        <td>${esc(m.group)}</td>
        <td><input type="text" data-field="team_home_id" value="${esc(m.team_home_id||"")}"></td>
        <td><input type="text" data-field="team_away_id" value="${esc(m.team_away_id||"")}"></td>
        <td><input type="time" data-field="kickoff" value="${esc(m.kickoff||"")}"></td>
        <td>
          <select data-field="status">
            ${["scheduled","live","finished","postponed","cancelled"].map(s =>
              `<option value="${s}" ${m.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </td>
      </tr>
    `).join("")}</tbody>
  </table>
  <button class="btn primary" id="saveScheduleBtn">💾 Simpan Jadwal</button>`;
}
function bindAdminSchedule() {
  el("saveScheduleBtn").onclick = async () => {
    const rows = document.querySelectorAll("[data-match-id]");
    try {
      el("saveScheduleBtn").disabled = true;
      for (const tr of rows) {
        const match_id = tr.dataset.matchId;
        const fields = {};
        tr.querySelectorAll("[data-field]").forEach(inp => {
          fields[inp.dataset.field] = inp.value;
        });
        await postAdmin("updateMatch", { match_id, ...fields });
      }
      await loadData();
      alert("Jadwal tersimpan");
    } catch (e) { alert("Gagal: " + e.message); }
    finally { el("saveScheduleBtn").disabled = false; }
  };
}

function adminScoresHTML() {
  const matches = (state.data.matches || []).sort((a,b) => (a.match_no||0)-(b.match_no||0));
  return `<table class="admin-table">
    <thead><tr><th>Match</th><th>Tim</th><th>Skor</th><th>Status</th></tr></thead>
    <tbody>${matches.map(m => `
      <tr data-match-id="${esc(m.match_id)}">
        <td>${esc(m.match_id)}${m.notes ? " · "+esc(m.notes) : ""}</td>
        <td>${esc(m.team_home||"TBD")} vs ${esc(m.team_away||"TBD")}</td>
        <td>
          <input type="number" min="0" data-field="score_home" value="${m.score_home ?? ""}" class="score-input">
          -
          <input type="number" min="0" data-field="score_away" value="${m.score_away ?? ""}" class="score-input">
        </td>
        <td>
          <select data-field="status">
            ${["scheduled","live","finished","postponed","cancelled"].map(s =>
              `<option value="${s}" ${m.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </td>
      </tr>
    `).join("")}</tbody>
  </table>
  <button class="btn primary" id="saveScoresBtn">💾 Simpan Skor</button>`;
}
function bindAdminScores() {
  el("saveScoresBtn").onclick = async () => {
    const rows = document.querySelectorAll("[data-match-id]");
    try {
      el("saveScoresBtn").disabled = true;
      for (const tr of rows) {
        const match_id = tr.dataset.matchId;
        const fields = {};
        tr.querySelectorAll("[data-field]").forEach(inp => {
          fields[inp.dataset.field] = inp.value === "" ? null : inp.value;
        });
        // kalau skor diisi tapi status masih scheduled, jadikan finished
        if (fields.score_home != null && fields.score_away != null && fields.status === "scheduled") {
          fields.status = "finished";
        }
        await postAdmin("updateMatch", { match_id, ...fields });
      }
      await loadData();
      alert("Skor tersimpan");
    } catch (e) { alert("Gagal: " + e.message); }
    finally { el("saveScoresBtn").disabled = false; }
  };
}

function adminKnockoutHTML() {
  return `<div class="admin-actions">
    <button class="btn primary" id="genSF">🏆 Generate Semifinal (A1 vs B2, C1 vs D2)</button>
    <button class="btn primary" id="genFinal">🥇 Generate Final & 3rd (dari winner SF)</button>
    <button class="btn danger" id="resetBracket">🗑️ Reset Bracket</button>
    <button class="btn danger" id="resetScores">🗑️ Reset Semua Skor Penyisihan</button>
  </div>`;
}
function bindAdminKnockout() {
  el("genSF").onclick = async () => {
    if (!confirm("Generate SF1 (A1 vs B2) & SF2 (C1 vs D2)?")) return;
    try { const r = await postAdmin("generateSF", {}); alert("OK: " + JSON.stringify(r)); await loadData(); }
    catch (e) { alert("Gagal: " + e.message); }
  };
  el("genFinal").onclick = async () => {
    if (!confirm("Generate Final & 3rd dari winner SF?")) return;
    try { const r = await postAdmin("generateFinal", {}); alert("OK: " + JSON.stringify(r)); await loadData(); }
    catch (e) { alert("Gagal: " + e.message); }
  };
  el("resetBracket").onclick = async () => {
    if (!confirm("Reset bracket (hapus tim & skor SF/Final/3RD)?")) return;
    try { await postAdmin("resetBracket", {}); await loadData(); alert("Bracket direset"); }
    catch (e) { alert("Gagal: " + e.message); }
  };
  el("resetScores").onclick = async () => {
    if (!confirm("Hapus SEMUA skor penyisihan? Tidak bisa dibatalkan!")) return;
    if (!confirm("Yakin? Klik OK untuk hapus.")) return;
    try { await postAdmin("resetScores", {}); await loadData(); alert("Skor direset"); }
    catch (e) { alert("Gagal: " + e.message); }
  };
}

// ============ LOAD & RENDER ============
async function loadData() {
  state.loading = true;
  try {
    const data = isAdminMode() ? await fetchAdmin() : await fetchPublic();
    state.data = data;
    renderAll();
    el("errorBanner").style.display = "none";
  } catch (e) {
    el("errorBanner").textContent = "Gagal memuat data: " + e.message;
    el("errorBanner").style.display = "block";
  } finally {
    state.loading = false;
  }
}

function renderAll() {
  renderHeader();
  renderHero();
  renderFilters();
  renderSchedule();
  renderStandings();
  renderBracket();
  updateAdminUI();
  if (isAdminMode()) renderAdminPanel();
}

// ============ AUTO REFRESH ============
function startAutoRefresh() {
  stopAutoRefresh();
  if (isAdminMode()) return; // matikan saat admin
  state.autoRefreshTimer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const data = await fetchPublic();
      state.data = data;
      renderAll();
    } catch (e) { /* silent */ }
  }, 60000); // 60 detik
}
function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", () => {
  // Tombol ⚙ Panitia (hanya tampil saat belum setting)
  el("adminBtn").addEventListener("click", () => {
    openSettingModal();
  });

  // Tombol 🚪 Keluar (hanya tampil saat mode admin)
  el("logoutBtn").addEventListener("click", () => {
    if (confirm("Keluar dari mode panitia?")) {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      location.reload();
    }
  });

  // 3x klik logo = buka modal setting (selalu bisa)
  let logoClicks = 0, logoTimer = null;
  el("logoBtn").addEventListener("click", () => {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoClicks = 0; }, 1500);
    if (logoClicks >= 3) {
      logoClicks = 0;
      if (isAdminMode()) {
        // Sudah admin mode — tawarkan logout
        if (confirm("Keluar dari mode panitia?")) {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          location.reload();
        }
      } else {
        openSettingModal();
      }
    }
  });

  loadData();
  startAutoRefresh();
});