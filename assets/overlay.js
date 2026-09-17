// OBS stream overlay. Read-only view of the draft state.
//
// Everything is laid out from the layout percentages in state.overlay.layout so
// one config works at any resolution, and so the band can be pushed clear of
// whatever overlay the streamer already runs.

var params = new URLSearchParams(location.search);
var forcedView = params.get("view");
var urlScale = parseFloat(params.get("scale") || "0") || 0;
var forceTop = params.get("pos") === "top";
var rolesParam = params.get("roles");
var root = document.getElementById("root");

// ?cfg=<base64 layout> lets someone run a fixed layout without the panel.
var cfgOverride = null;
try {
  var rawCfg = params.get("cfg");
  if (rawCfg) {
    cfgOverride = JSON.parse(decodeURIComponent(escape(
      atob(rawCfg.replace(/-/g, "+").replace(/_/g, "/")))));
  }
} catch (e) { cfgOverride = null; }

var HERO_BY_ID = {};
HEROES.forEach(function (h) { HERO_BY_ID[h.id] = h; });

var ROLE_ORDER = ["tank", "bruiser", "healer", "support", "melee", "ranged"];
var ROLE_SHORT = {
  tank: "Tank", bruiser: "Bruiser", healer: "Healer",
  support: "Supp", melee: "Melee", ranged: "Ranged",
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function portrait(id, colorClass, badge, mod) {
  var h = HERO_BY_ID[id];
  if (!h) return "";
  return '<div class="portrait ' + colorClass + (mod ? " " + mod : "") +
    '" title="' + esc(h.name) + '">' +
    '<img src="heroes/' + h.img + '" alt="' + esc(h.name) + '">' +
    (badge ? '<span class="pg">' + esc(badge) + "</span>" : "") +
    "</div>";
}

// --- What goes in each lane --------------------------------------------------
function availableHeroes(state, statusMap, sort) {
  var list = HEROES.filter(function (h) { return statusMap[h.id].state === "available"; });
  if (sort === "role") {
    list.sort(function (a, b) {
      var d = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  }
  return list;
}

// Everything that is gone, in the order a viewer reads it.
function deadHeroes(state) {
  var out = [];
  globalBans(state).forEach(function (id) {
    out.push({ id: id, cls: "c-global", badge: null, mod: null });
  });
  state.seriesBans.forEach(function (b) {
    out.push({ id: b.hero, cls: "c-series", badge: null, mod: null });
  });
  state.games.forEach(function (g) {
    g.picks.forEach(function (p) {
      out.push({ id: p.hero, cls: "c-used-" + p.team, badge: "G" + g.n, mod: "is-used" });
    });
  });
  currentGame(state).bans.forEach(function (b) {
    out.push({ id: b.hero, cls: "c-gameban", badge: null, mod: null });
  });
  return out;
}

// --- Head content ------------------------------------------------------------
function rolesHtml(t, showRoles) {
  if (!showRoles) return "";
  var html = ROLE_ORDER.map(function (r) {
    var n = t.byRole[r] || 0;
    var cls = n === 0 ? " out" : n <= 3 ? " low" : "";
    return '<span class="role r-' + r + cls + '"><span class="dot"></span>' +
      "<b>" + n + "</b> " + esc(ROLE_SHORT[r]) + "</span>";
  }).join("");
  return '<div class="roles">' + html + "</div>";
}

function turnHtml(state) {
  var step = currentStep(state);
  if (!step) {
    return '<div class="turn"><span class="turn-label">Game ' +
      currentGame(state).n + '</span><span class="turn-team">Draft complete</span></div>';
  }
  var ord = stepOrdinal(state, step);
  return '<div class="turn">' +
    '<span class="turn-label">' +
      (step.phase === "series" ? "Series ban" : "On the clock") + "</span>" +
    '<span class="turn-team t-' + step.team + '">' + esc(state.teams[step.team]) + "</span>" +
    '<span class="turn-action ' + step.kind + '">' + step.kind.toUpperCase() +
    " " + ord.at + "/" + ord.of + "</span></div>";
}

function deadLegend(state, t) {
  var bits = [];
  if (t.counts.global) bits.push(['c-global', 'Auto', t.counts.global]);
  if (t.counts.seriesban) bits.push(['c-series', 'Series', t.counts.seriesban]);
  if (t.counts.used) bits.push(['c-used-A', 'Played', t.counts.used]);
  if (t.counts.gameban) bits.push(['c-gameban', 'Banned', t.counts.gameban]);
  if (!bits.length) return '<span class="lbl">Nothing gone yet</span>';
  return '<div class="legend">' + bits.map(function (b) {
    return '<span class="legend-item ' + b[0] + '"><span class="dot"></span>' +
      b[1] + " " + b[2] + "</span>";
  }).join("") + "</div>";
}

// --- Auto-fit ----------------------------------------------------------------
// Pick the biggest portrait size that still fits every hero inside the segments
// we actually have, then split the list between them by column count.
var GRID_GAP = 4;

function fitLane(lane, items, maxRows, pmax, pmin) {
  var grids = [].slice.call(lane.querySelectorAll(".seg-grid"));
  var widths = grids.map(function (g) { return g.clientWidth; });
  var total = items.length;

  function colsAt(p) {
    return widths.map(function (w) {
      return Math.max(0, Math.floor((w + GRID_GAP) / (p + GRID_GAP)));
    });
  }

  var size = pmin, cols = colsAt(pmin);
  for (var p = pmax; p >= pmin; p--) {
    var c = colsAt(p);
    var sum = c.reduce(function (a, b) { return a + b; }, 0);
    if (!sum) continue;
    if (Math.ceil(total / sum) <= maxRows) { size = p; cols = c; break; }
  }

  var sumCols = cols.reduce(function (a, b) { return a + b; }, 0) || 1;
  var offset = 0;
  grids.forEach(function (g, i) {
    var cap = cols[i] * maxRows;
    // Share the list out in proportion to how wide each segment is.
    var want = i === grids.length - 1
      ? total - offset
      : Math.min(cap, Math.round(total * cols[i] / sumCols));
    var slice = items.slice(offset, offset + Math.max(0, want));
    offset += slice.length;
    g.style.gridTemplateColumns = "repeat(" + Math.max(1, cols[i]) + ", " + size + "px)";
    g.style.gridAutoRows = size + "px";
    g.innerHTML = slice.join("");
  });
  return size;
}

// --- Band --------------------------------------------------------------------
function segHtml(headHtml, tail) {
  return '<div class="seg' + (tail ? " tail" : "") + '">' +
    (headHtml ? '<div class="seg-head">' + headHtml + "</div>" : "") +
    '<div class="seg-grid"></div></div>';
}

function renderBand(state, t, L) {
  var seg = bandSegments(L);
  var o = state.overlay;
  var showRoles = rolesParam === "0" ? false : (rolesParam === "1" ? true : o.showRoles);
  var cg = currentGame(state);
  var modeLabel = state.mode === "metamadness" ? "Meta Madness" : "Competitive";

  var avail = availableHeroes(state, t.status, o.avSort);
  var dead = deadHeroes(state);

  var availHead =
    '<span class="big">' + t.counts.available + "</span>" +
    '<span class="lbl">Still available</span>' +
    rolesHtml(t, showRoles);
  var availTail =
    '<span class="meta"><b>' + esc(modeLabel) + "</b> · Game " + cg.n +
    (cg.map ? " · " + esc(cg.map) : "") + "</span>" + turnHtml(state);

  var outHead = '<span class="lbl">Out of the pool</span>' + deadLegend(state, t);

  // With no camera gap there is only one segment, so the head that would have
  // sat on the far side has to fold into it or the map and clock vanish.
  var split = seg.left > 0 && seg.right > 0;
  var mainHead = split ? availHead : availHead + '<span class="spacer"></span>' + availTail;

  var lanes = "";
  if (o.showAvailable !== false) {
    lanes += '<div class="lane available">' +
      segHtml(mainHead, false) +
      '<div class="cam-gap"></div>' +
      segHtml(split ? availTail : "", true) +
      "</div>";
  }
  if (o.showOut !== false) {
    lanes += '<div class="lane out">' +
      segHtml(outHead, false) +
      '<div class="cam-gap"></div>' +
      segHtml("", true) +
      "</div>";
  }

  var band = document.createElement("div");
  band.className = "band";
  band.style.left = L.left + "%";
  band.style.right = L.right + "%";
  if (forceTop) band.style.top = L.top + "%";
  else band.style.bottom = L.bottom + "%";
  band.innerHTML = lanes;

  // Size the three columns of every lane before anything is measured.
  [].forEach.call(band.querySelectorAll(".lane"), function (lane) {
    var kids = lane.children;                       // seg, gap, seg
    kids[0].style.flex = "0 0 " + seg.left + "%";
    kids[1].style.flex = "0 0 " + seg.gap + "%";
    kids[2].style.flex = "0 0 " + seg.right + "%";
    if (seg.left <= 0) kids[0].classList.add("empty");
    if (seg.right <= 0) kids[2].classList.add("empty");
  });

  root.appendChild(band);

  // Now that the segments have real widths, fill them.
  var availLane = band.querySelector(".lane.available");
  if (availLane) {
    fitLane(availLane, avail.map(function (h) {
      return portrait(h.id, o.avSort === "role" ? "r-" + h.role : "c-free", null, "live");
    }), L.rows, L.pmax, 20);
  }
  var outLane = band.querySelector(".lane.out");
  if (outLane) {
    fitLane(outLane, dead.map(function (d) {
      return portrait(d.id, d.cls, d.badge, d.mod);
    }), L.outRows, L.outPmax, 16);
  }
}

// --- Grid view ---------------------------------------------------------------
function renderGridView(state, t, L) {
  var cg = currentGame(state);
  var modeLabel = state.mode === "metamadness" ? "Meta Madness" : "Competitive";

  var cells = HEROES.map(function (h) {
    var st = t.status[h.id];
    var avail = st.state === "available";
    var cls = avail ? ("r-" + h.role) :
      st.state === "global" ? "c-global" :
      st.state === "seriesban" ? "c-series" :
      st.state === "gameban" ? "c-gameban" : "c-used-" + st.team;
    return '<div class="gv-cell' + (avail ? " avail" : "") + '">' +
      portrait(h.id, cls, st.state === "used" ? "G" + st.game : null,
               avail ? "live" : (st.state === "used" ? "is-used" : null)) +
      '<span class="gv-name">' + esc(h.name) + "</span></div>";
  }).join("");

  var legend = '<div class="legend">' +
    '<span class="legend-item c-global"><span class="dot"></span>Auto ban</span>' +
    '<span class="legend-item c-series"><span class="dot"></span>Series ban</span>' +
    '<span class="legend-item c-gameban"><span class="dot"></span>Game ban</span>' +
    '<span class="legend-item c-used-A"><span class="dot"></span>' + esc(state.teams.A) + "</span>" +
    '<span class="legend-item c-used-B"><span class="dot"></span>' + esc(state.teams.B) + "</span>" +
    "</div>";

  var gv = document.createElement("div");
  gv.className = "gridview";
  gv.style.left = L.left + "%";
  gv.style.right = L.right + "%";
  gv.style.top = L.top + "%";
  gv.style.bottom = L.bottom + "%";
  gv.innerHTML =
    '<div class="gv-head">' +
      '<div><div class="gv-count">' + t.counts.available + "</div>" +
      '<div class="gv-count-label">Available</div></div>' +
      '<div><div class="gv-title">' + esc(state.teams.A) + " vs " + esc(state.teams.B) + "</div>" +
      '<div class="gv-sub">' + esc(modeLabel) + " · Game " + cg.n +
      (cg.map ? " · " + esc(cg.map) : "") + "</div></div>" +
      '<div class="gv-spacer"></div>' + legend +
    "</div>" +
    '<div class="gv-grid">' + cells + "</div>";
  root.appendChild(gv);
}

// --- Entry -------------------------------------------------------------------
function render(state) {
  var o = state.overlay || defaultOverlay();
  var L = cfgOverride || o.layout || layoutFromPreset("khaldor");
  var view = forcedView || o.view || "strip";
  var sc = urlScale || o.scale || 1;

  root.style.transform = sc === 1 ? "" : "scale(" + sc + ")";
  root.style.width = sc === 1 ? "" : (100 / sc) + "%";
  root.style.height = sc === 1 ? "" : (100 / sc) + "%";

  root.innerHTML = "";
  if (view === "hidden") { root.className = "overlay hidden"; return; }
  root.className = "overlay";

  var t = tally(state);
  if (view === "grid") renderGridView(state, t, L);
  else renderBand(state, t, L);
}

// Sample data so the overlay can be framed in OBS before a match starts.
function demoState() {
  var s = defaultState();
  s.teams = { A: "Blessed Rain", B: "Elongation Admirals" };
  ["Alarak", "Genji", "Tracer", "Illidan", "Nova", "Zeratul", "Kerrigan", "Maiev", "Murky", "Samuro"]
    .forEach(function (id, i) { s.seriesBans.push({ hero: id, team: i % 2 ? "B" : "A" }); });
  s.games[0].map = "Tomb of the Spider Queen";
  s.games[0].bans = [
    { hero: "Cassia", team: "A" }, { hero: "Greymane", team: "B" },
    { hero: "Jaina", team: "A" }, { hero: "Orphea", team: "B" },
  ];
  s.games[0].picks = [
    { hero: "Uther", team: "A" }, { hero: "Diablo", team: "B" },
    { hero: "Raynor", team: "B" }, { hero: "Sonya", team: "A" },
    { hero: "ETC", team: "A" }, { hero: "Malfurion", team: "B" },
  ];
  return s;
}

if (params.get("demo") === "1") {
  render(demoState());
} else {
  render(bus.read());
  bus.subscribe(function (incoming) { render(incoming); });
}
// Segment widths are percentage-based, so a resized Browser Source needs a refit.
window.addEventListener("resize", function () {
  render(params.get("demo") === "1" ? demoState() : bus.read());
});
