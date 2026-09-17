// Draft Control panel. Owns the state; the overlay only reads it.

var state = bus.read();
var override = null;          // { team, kind } forced onto the next click
var filters = { search: "", role: null, hideUnavailable: false };

var $ = function (id) { return document.getElementById(id); };
var grid = $("grid");

function commit() {
  bus.write(state);
}

// Has anything actually been recorded? Used to skip pointless confirm dialogs.
function seriesTouched() {
  if (state.seriesBans.length) return true;
  return state.games.some(function (g) {
    return g.bans.length || g.picks.length || g.map;
  });
}

// --- Hero grid --------------------------------------------------------------
var heroNodes = {};

function buildGrid() {
  var frag = document.createDocumentFragment();
  HEROES.forEach(function (h) {
    var el = document.createElement("div");
    el.className = "hero";
    el.dataset.id = h.id;
    el.dataset.role = h.role;
    el.innerHTML =
      '<img src="heroes/' + h.img + '" alt="" loading="lazy">' +
      '<span class="hname">' + h.name + "</span>" +
      '<span class="htag"></span>';
    el.addEventListener("click", function () { onHeroClick(h.id); });
    heroNodes[h.id] = el;
    frag.appendChild(el);
  });
  grid.appendChild(frag);
}

var TAGS = {
  global: "AUTO",
  seriesban: "SERIES",
  gameban: "BAN",
  used: "PLAYED",
};

function renderGrid(status) {
  var q = filters.search.toLowerCase();
  HEROES.forEach(function (h) {
    var el = heroNodes[h.id];
    var st = status[h.id];
    var avail = st.state === "available";

    el.className = "hero" + (avail ? "" : " unavailable s-" + st.state) +
      (st.team ? " team-" + st.team : "");

    var tag = el.lastElementChild;
    if (avail) {
      tag.textContent = "";
    } else if (st.state === "used") {
      tag.textContent = "G" + st.game;
    } else {
      tag.textContent = TAGS[st.state];
    }
    el.title = avail ? h.name + " — " + ROLE_LABELS[h.role] : describe(h, st);

    var hidden =
      (q && h.name.toLowerCase().indexOf(q) === -1) ||
      (filters.role && h.role !== filters.role) ||
      (filters.hideUnavailable && !avail);
    el.style.display = hidden ? "none" : "";
  });
}

function describe(h, st) {
  var who = st.team ? state.teams[st.team] : null;
  if (st.state === "global") return h.name + " — globally banned (Meta Madness)";
  if (st.state === "seriesban") return h.name + " — series ban by " + who;
  if (st.state === "gameban") return h.name + " — banned this game by " + who;
  if (st.state === "used") return h.name + " — played by " + who + " in game " + st.game;
  return h.name;
}

// --- Actions ----------------------------------------------------------------
function onHeroClick(id) {
  var ok = applyHero(state, id, override);
  if (!ok) {
    var st = heroStatus(state)[id];
    toast(st.state === "available" ? "Draft complete — start the next game." : "That hero is already gone.");
    return;
  }
  override = null;
  commit();
}

function toast(msg) {
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 2200);
}

// --- Status bar -------------------------------------------------------------
function renderStatus() {
  var bar = $("statusBar");
  var step = currentStep(state);
  var game = currentGame(state);

  if (!step) {
    bar.className = "status done";
    $("statusPhase").textContent = "Game " + game.n;
    $("statusTeam").textContent = "Draft complete";
    $("statusAction").textContent = "";
    $("statusAction").className = "status-action";
    $("statusCount").textContent = game.picks.length + " picks locked";
    $("statusHint").textContent = 'Hit "Next game" to clear this game’s bans. Played heroes stay locked.';
    return;
  }

  var eff = override || step;
  bar.className = "status turn-" + eff.team;
  $("statusPhase").textContent = step.phase === "series" ? "Series bans" : "Game " + game.n;
  $("statusTeam").textContent = state.teams[eff.team];
  $("statusAction").textContent = eff.kind.toUpperCase();
  $("statusAction").className = "status-action " + eff.kind;

  var ord = stepOrdinal(state, step);
  $("statusCount").textContent = override ? "manual" : ord.at + " of " + ord.of;
  $("statusHint").textContent = override
    ? "Override active — the next click is recorded as " + state.teams[override.team] +
      " " + override.kind + "ing, then it returns to the script."
    : "Click a hero portrait to record it.";
}

// --- Scoreboard -------------------------------------------------------------
function renderScores(t) {
  $("cAvailable").textContent = t.counts.available;
  $("cGlobal").textContent = t.counts.global;
  $("cSeries").textContent = t.counts.seriesban;
  $("cGame").textContent = t.counts.gameban;
  $("cUsed").textContent = t.counts.used;

  var box = $("roleBreakdown");
  box.innerHTML = "";
  Object.keys(ROLE_LABELS).forEach(function (r) {
    var n = t.byRole[r] || 0;
    var pill = document.createElement("div");
    pill.className = "role-pill" + (n <= 3 ? " starved" : "");
    pill.innerHTML = "<b>" + n + "</b><span>" + ROLE_LABELS[r] + "</span>";
    box.appendChild(pill);
  });
}

// --- Maps -------------------------------------------------------------------
var mapOwner = null;

function buildMaps() {
  var list = $("mapList");
  MAP_POOL.forEach(function (m) {
    var b = document.createElement("button");
    b.className = "map-chip";
    b.textContent = m;
    b.addEventListener("click", function () {
      setMap(state, m, mapOwner);
      commit();
    });
    list.appendChild(b);
  });
}

function renderMaps() {
  var game = currentGame(state);
  var played = {};
  state.games.forEach(function (g) {
    if (g.map && g !== game) played[g.map] = true;
  });
  Array.prototype.forEach.call($("mapList").children, function (b) {
    b.className = "map-chip" +
      (game.map === b.textContent ? " active" : "") +
      (played[b.textContent] ? " played" : "");
  });
  Array.prototype.forEach.call(document.querySelectorAll(".owner-btn"), function (b) {
    b.classList.toggle("active", mapOwner === b.dataset.owner);
  });
}

// --- Games ------------------------------------------------------------------
function renderGames() {
  var sel = $("gameSelect");
  sel.innerHTML = "";
  state.games.forEach(function (g, i) {
    var o = document.createElement("option");
    o.value = i;
    o.textContent = "Game " + g.n + (g.map ? " — " + g.map : "");
    sel.appendChild(o);
  });
  sel.value = state.gameIdx;
}

// --- Chrome -----------------------------------------------------------------
function renderChrome() {
  Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function (b) {
    b.classList.toggle("active", b.dataset.mode === state.mode);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".view-btn"), function (b) {
    b.classList.toggle("active", b.dataset.view === state.overlay.view);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".ovr"), function (b) {
    var key = override ? override.team + "|" + override.kind : null;
    b.classList.toggle("active", !!key && b.dataset.ovr === key);
  });
  if ($("teamA") !== document.activeElement) $("teamA").value = state.teams.A;
  if ($("teamB") !== document.activeElement) $("teamB").value = state.teams.B;
}

function render() {
  var t = tally(state);
  renderChrome();
  renderStatus();
  renderScores(t);
  renderMaps();
  renderGames();
  renderGrid(t.status);
}

// --- Wiring -----------------------------------------------------------------
function wire() {
  Array.prototype.forEach.call(document.querySelectorAll(".mode-btn"), function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.mode === state.mode) return;
      if (seriesTouched() &&
          !confirm("Switch to " + b.textContent + "? This clears the current series.")) return;
      setMode(state, b.dataset.mode);
      commit();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".ovr"), function (b) {
    if (b.id === "clearOvr") return;
    b.addEventListener("click", function () {
      var parts = b.dataset.ovr.split("|");
      var same = override && override.team === parts[0] && override.kind === parts[1];
      override = same ? null : { team: parts[0], kind: parts[1] };
      render();
    });
  });
  $("clearOvr").addEventListener("click", function () { override = null; render(); });

  $("undoBtn").addEventListener("click", function () {
    if (!undo(state)) return toast("Nothing left to undo.");
    override = null;
    commit();
  });

  $("nextGameBtn").addEventListener("click", function () {
    nextGame(state);
    mapOwner = null;
    commit();
  });

  $("gameSelect").addEventListener("change", function (e) {
    state.gameIdx = parseInt(e.target.value, 10);
    commit();
  });

  $("resetBtn").addEventListener("click", function () {
    if (seriesTouched() &&
        !confirm("Reset the whole series? Every ban and pick is cleared.")) return;
    var mode = state.mode;
    var teams = state.teams;
    state = defaultState();
    state.teams = teams;
    setMode(state, mode);
    override = null;
    mapOwner = null;
    commit();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".owner-btn"), function (b) {
    b.addEventListener("click", function () {
      mapOwner = mapOwner === b.dataset.owner ? null : b.dataset.owner;
      if (mapOwner && currentGame(state).map) setMap(state, currentGame(state).map, mapOwner);
      render();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".view-btn"), function (b) {
    b.addEventListener("click", function () {
      state.overlay.view = b.dataset.view;
      commit();
    });
  });

  $("openOverlay").addEventListener("click", function () {
    window.open("overlay.html", "mm_overlay", "width=1600,height=400");
  });

  $("copyOverlay").addEventListener("click", function () {
    var url = new URL("overlay.html", location.href).href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        function () { toast("Overlay URL copied."); },
        function () { prompt("Copy this into an OBS Browser Source:", url); }
      );
    } else {
      prompt("Copy this into an OBS Browser Source:", url);
    }
  });

  ["teamA", "teamB"].forEach(function (id) {
    $(id).addEventListener("input", function (e) {
      state.teams[id === "teamA" ? "A" : "B"] = e.target.value || (id === "teamA" ? "Team A" : "Team B");
      commit();
    });
  });

  $("search").addEventListener("input", function (e) {
    filters.search = e.target.value.trim();
    renderGrid(heroStatus(state));
  });

  $("hideUnavailable").addEventListener("change", function (e) {
    filters.hideUnavailable = e.target.checked;
    renderGrid(heroStatus(state));
  });

  var rf = $("roleFilters");
  Object.keys(ROLE_LABELS).forEach(function (r) {
    var b = document.createElement("button");
    b.className = "role-filter";
    b.textContent = ROLE_LABELS[r];
    b.addEventListener("click", function () {
      filters.role = filters.role === r ? null : r;
      Array.prototype.forEach.call(rf.children, function (c) {
        c.classList.toggle("active", c === b && filters.role === r);
      });
      renderGrid(heroStatus(state));
    });
    rf.appendChild(b);
  });

  $("helpBtn").addEventListener("click", function () { $("helpModal").hidden = false; });
  $("closeHelp").addEventListener("click", function () { $("helpModal").hidden = true; });
  $("helpModal").addEventListener("click", function (e) {
    if (e.target === $("helpModal")) $("helpModal").hidden = true;
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "Escape") { $("helpModal").hidden = true; override = null; render(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (undo(state)) commit();
    }
    if (e.key === "/") { e.preventDefault(); $("search").focus(); }
  });

  // Another window (the overlay, or a second panel) changed the state.
  bus.subscribe(function (incoming, origin) {
    if (origin === "remote") {
      state = incoming;
      state.history = state.history || [];
    }
    render();
  });
}

buildGrid();
buildMaps();
wire();
render();
