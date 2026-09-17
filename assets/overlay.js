// OBS stream overlay. Read-only view of the draft state.

var params = new URLSearchParams(location.search);
var forcedView = params.get("view");
var scale = parseFloat(params.get("scale") || "1") || 1;
var pos = params.get("pos") === "top" ? "top" : "bottom";
var showRoles = params.get("roles") !== "0";
var root = document.getElementById("root");

var HERO_BY_ID = {};
HEROES.forEach(function (h) { HERO_BY_ID[h.id] = h; });

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function portrait(id, colorClass, badge, isUsed) {
  var h = HERO_BY_ID[id];
  if (!h) return "";
  return '<div class="portrait ' + colorClass + (isUsed ? " is-used" : "") +
    '" title="' + esc(h.name) + '">' +
    '<img src="heroes/' + h.img + '" alt="' + esc(h.name) + '">' +
    (badge ? '<span class="pg">' + esc(badge) + "</span>" : "") +
    "</div>";
}

function group(label, colorClass, items) {
  if (!items.length) return "";
  return '<div class="group ' + colorClass + '">' +
    '<div class="group-head"><span class="dot"></span>' + esc(label) +
    " · " + items.length + "</div>" +
    '<div class="group-row">' + items.join("") + "</div>" +
    "</div>";
}

// Split the draft into the buckets a viewer actually cares about.
function buckets(state) {
  var cg = currentGame(state);
  var out = { global: [], series: [], used: [], gameban: [] };

  globalBans(state).forEach(function (id) {
    out.global.push(portrait(id, "c-global", null, false));
  });
  state.seriesBans.forEach(function (b) {
    out.series.push(portrait(b.hero, "c-series", null, false));
  });
  state.games.forEach(function (g) {
    g.picks.forEach(function (p) {
      out.used.push(portrait(p.hero, "c-used-" + p.team, "G" + g.n, true));
    });
  });
  cg.bans.forEach(function (b) {
    out.gameban.push(portrait(b.hero, "c-gameban", null, false));
  });
  return out;
}

function rolesHtml(t) {
  if (!showRoles) return "";
  var html = Object.keys(ROLE_LABELS).map(function (r) {
    var n = t.byRole[r] || 0;
    var cls = n === 0 ? " out" : n <= 3 ? " low" : "";
    return '<span class="role' + cls + '"><b>' + n + "</b> " + esc(ROLE_LABELS[r]) + "</span>";
  }).join("");
  return '<div class="roles">' + html + "</div>";
}

function turnHtml(state) {
  var step = currentStep(state);
  if (!step) {
    return '<div class="strip-right">' +
      '<div class="turn-label">Game ' + currentGame(state).n + "</div>" +
      '<div class="turn-team">Draft complete</div></div>';
  }
  var ord = stepOrdinal(state, step);
  return '<div class="strip-right">' +
    '<div class="turn-label">' + (step.phase === "series" ? "Series ban" : "On the clock") + "</div>" +
    '<div class="turn-team t-' + step.team + '">' + esc(state.teams[step.team]) + "</div>" +
    '<div class="turn-action ' + step.kind + '">' + step.kind.toUpperCase() +
    " " + ord.at + "/" + ord.of + "</div></div>";
}

function renderStrip(state, t) {
  var b = buckets(state);
  var cg = currentGame(state);
  var modeLabel = state.mode === "metamadness" ? "Meta Madness" : "Competitive";

  var meta = "<b>" + esc(modeLabel) + "</b> · Game " + cg.n +
    (cg.map ? " · " + esc(cg.map) : "");

  // Shrink portraits as the dead-hero count climbs so the bar keeps its height.
  var dead = b.global.length + b.series.length + b.used.length + b.gameban.length;
  var density = dead > 55 ? " d-3" : dead > 40 ? " d-2" : " d-1";

  return '<div class="strip pos-' + pos + density + '">' +
    '<div class="strip-left">' +
      '<div class="count-big">' + t.counts.available + "</div>" +
      '<div class="count-label">Heroes left</div>' +
      '<div class="strip-meta">' + meta + "</div>" +
      rolesHtml(t) +
    "</div>" +
    '<div class="strip-body">' +
      group("Auto-banned", "c-global", b.global) +
      group("Series bans", "c-series", b.series) +
      group("Already played", "c-used-A", b.used) +
      group("Banned this game", "c-gameban", b.gameban) +
    "</div>" +
    turnHtml(state) +
  "</div>";
}

function renderGridView(state, t) {
  var cg = currentGame(state);
  var modeLabel = state.mode === "metamadness" ? "Meta Madness" : "Competitive";

  var cells = HEROES.map(function (h) {
    var st = t.status[h.id];
    var avail = st.state === "available";
    var cls = avail ? "c-used-A" :
      st.state === "global" ? "c-global" :
      st.state === "seriesban" ? "c-series" :
      st.state === "gameban" ? "c-gameban" : "c-used-" + st.team;
    var badge = st.state === "used" ? "G" + st.game : null;
    return '<div class="gv-cell' + (avail ? " avail" : "") + '">' +
      portrait(h.id, avail ? "c-used-A" : cls, badge, st.state === "used") +
      '<span class="gv-name">' + esc(h.name) + "</span></div>";
  }).join("");

  var legend =
    '<div class="legend">' +
    '<span class="legend-item c-global"><span class="dot"></span>Auto ban</span>' +
    '<span class="legend-item c-series"><span class="dot"></span>Series ban</span>' +
    '<span class="legend-item c-gameban"><span class="dot"></span>Game ban</span>' +
    '<span class="legend-item c-used-A"><span class="dot"></span>' + esc(state.teams.A) + "</span>" +
    '<span class="legend-item c-used-B"><span class="dot"></span>' + esc(state.teams.B) + "</span>" +
    "</div>";

  return '<div class="gridview">' +
    '<div class="gv-head">' +
      '<div><div class="count-big">' + t.counts.available + "</div>" +
      '<div class="count-label">Available</div></div>' +
      "<div><div class=\"gv-title\">" + esc(state.teams.A) + " vs " + esc(state.teams.B) + "</div>" +
      '<div class="gv-sub">' + esc(modeLabel) + " · Game " + cg.n +
      (cg.map ? " · " + esc(cg.map) : "") + "</div></div>" +
      '<div class="gv-spacer"></div>' +
      legend +
    "</div>" +
    '<div class="gv-grid">' + cells + "</div>" +
  "</div>";
}

function render(state) {
  var view = forcedView || state.overlay.view || "strip";
  root.style.transform = scale === 1 ? "" : "scale(" + scale + ")";
  root.style.width = scale === 1 ? "" : (100 / scale) + "%";
  root.style.height = scale === 1 ? "" : (100 / scale) + "%";

  if (view === "hidden") {
    root.className = "overlay hidden";
    root.innerHTML = "";
    return;
  }
  root.className = "overlay";
  var t = tally(state);
  root.innerHTML = view === "grid" ? renderGridView(state, t) : renderStrip(state, t);
}

// Sample data so the overlay can be framed in OBS before a match starts.
function demoState() {
  var s = defaultState();
  s.teams = { A: "Nexus Wolves", B: "Raven Court" };
  ["Abathur", "Alarak", "Cassia", "Genji", "Jaina", "Kerrigan", "Muradan"]
    .forEach(function (id, i) {
      s.seriesBans.push({ hero: id, team: i % 2 ? "B" : "A" });
    });
  s.games[0].map = "Cursed Hollow";
  s.games[0].bans = [{ hero: "Nova", team: "A" }, { hero: "Zeratul", team: "B" }];
  s.games[0].picks = [
    { hero: "Uther", team: "A" }, { hero: "Diablo", team: "B" },
    { hero: "Raynor", team: "B" }, { hero: "Sonya", team: "A" },
  ];
  return s;
}

if (params.get("demo") === "1") {
  render(demoState());
} else {
  render(bus.read());
  bus.subscribe(function (incoming) { render(incoming); });
}
