// Shared draft state + cross-window sync.
// Loaded by BOTH the control panel and the OBS overlay. The overlay never writes.

const STORAGE_KEY = "mm_draft_v2";
const CHANNEL_NAME = "mm_draft_v2";

const TEAM = { A: "A", B: "B" };

function newGame(n) {
  return { n, map: null, first: TEAM.A, bans: [], picks: [] };
}

function defaultState() {
  return {
    v: 2,
    mode: "metamadness",          // "metamadness" | "competitive"
    teams: { A: "Team A", B: "Team B" },
    seriesBanTarget: 10,          // Meta Madness: 10. Competitive: 0 by default.
    seriesBans: [],               // [{ hero, team }]
    games: [newGame(1)],
    gameIdx: 0,
    overlay: { view: "strip", scale: 1, showRoles: true },
    history: [],                  // snapshots for undo
  };
}

// --- Draft scripts -----------------------------------------------------------
// Meta Madness series bans: A1, B2, A2, B2, A2, B1 = 10.
const SERIES_BAN_SCRIPT = ["A", "B", "B", "A", "A", "B", "B", "A", "A", "B"];

// HOTS tournament draft, triple ban. F = drafts first, S = drafts second.
// Picks resolve 1-2-2-2-2-1, five each.
const GAME_SCRIPT = [
  ["ban", "F"], ["ban", "S"], ["ban", "F"], ["ban", "S"],
  ["pick", "F"], ["pick", "S"], ["pick", "S"], ["pick", "F"], ["pick", "F"],
  ["ban", "S"], ["ban", "F"],
  ["pick", "S"], ["pick", "S"], ["pick", "F"], ["pick", "F"], ["pick", "S"],
];

function seriesBanScript(state) {
  return SERIES_BAN_SCRIPT.slice(0, state.seriesBanTarget);
}

// Resolve the F/S placeholders against whichever team drafts first this game.
function gameScript(game) {
  const F = game.first;
  const S = F === TEAM.A ? TEAM.B : TEAM.A;
  return GAME_SCRIPT.map(function (pair) {
    return [pair[0], pair[1] === "F" ? F : S];
  });
}

// --- Derived ----------------------------------------------------------------
function currentGame(state) {
  return state.games[state.gameIdx];
}

function globalBans(state) {
  return state.mode === "metamadness" ? META_MADNESS_GLOBAL_BANS : [];
}

// Are we still in the pre-game series-ban phase?
function inSeriesBanPhase(state) {
  var g = currentGame(state);
  return state.gameIdx === 0
    && state.seriesBans.length < state.seriesBanTarget
    && g.bans.length === 0
    && g.picks.length === 0;
}

// The step the operator is expected to perform next.
// Returns null once the current game's draft is complete.
function currentStep(state) {
  if (inSeriesBanPhase(state)) {
    var script = seriesBanScript(state);
    var i = state.seriesBans.length;
    if (i < script.length) {
      return { phase: "series", kind: "ban", team: script[i], index: i, total: script.length };
    }
  }
  var game = currentGame(state);
  var gs = gameScript(game);
  var done = game.bans.length + game.picks.length;
  if (done >= gs.length) return null;
  return { phase: "game", kind: gs[done][0], team: gs[done][1], index: done, total: gs.length };
}

// How many of this same kind+team the current step is, e.g. "ban 2 of 3".
function stepOrdinal(state, step) {
  if (!step) return null;
  var prior, total;
  if (step.phase === "series") {
    var sb = seriesBanScript(state);
    prior = sb.slice(0, step.index).filter(function (t) { return t === step.team; }).length;
    total = sb.filter(function (t) { return t === step.team; }).length;
    return { at: prior + 1, of: total };
  }
  var gs = gameScript(currentGame(state));
  var match = function (p) { return p[0] === step.kind && p[1] === step.team; };
  prior = gs.slice(0, step.index).filter(match).length;
  total = gs.filter(match).length;
  return { at: prior + 1, of: total };
}

// Status of every hero, resolved in priority order. A hero picked in ANY game
// is dead for the rest of the series in both rulesets (global single-use).
function heroStatus(state) {
  var status = {};
  HEROES.forEach(function (h) {
    status[h.id] = { state: "available", team: null, game: null };
  });

  globalBans(state).forEach(function (id) {
    if (status[id]) status[id] = { state: "global", team: null, game: null };
  });
  state.seriesBans.forEach(function (b) {
    if (status[b.hero]) status[b.hero] = { state: "seriesban", team: b.team, game: null };
  });
  state.games.forEach(function (g) {
    g.picks.forEach(function (p) {
      if (status[p.hero]) status[p.hero] = { state: "used", team: p.team, game: g.n };
    });
  });
  // Per-game bans only apply to the game they were made in.
  var cg = currentGame(state);
  cg.bans.forEach(function (b) {
    if (status[b.hero] && status[b.hero].state === "available") {
      status[b.hero] = { state: "gameban", team: b.team, game: cg.n };
    }
  });
  return status;
}

function isAvailable(statusMap, id) {
  return !!statusMap[id] && statusMap[id].state === "available";
}

function tally(state) {
  var s = heroStatus(state);
  var counts = { available: 0, global: 0, seriesban: 0, gameban: 0, used: 0 };
  var byRole = {};
  HEROES.forEach(function (h) {
    var st = s[h.id].state;
    counts[st]++;
    if (st === "available") byRole[h.role] = (byRole[h.role] || 0) + 1;
  });
  return { counts: counts, byRole: byRole, status: s };
}

// --- Mutations --------------------------------------------------------------
function snapshot(state) {
  var copy = {};
  Object.keys(state).forEach(function (k) {
    if (k !== "history") copy[k] = state[k];
  });
  return JSON.parse(JSON.stringify(copy));
}

function pushHistory(state) {
  state.history.push(snapshot(state));
  if (state.history.length > 80) state.history.shift();
}

// Record a hero against a step. override = { kind, team, phase } to force it.
function applyHero(state, heroId, override) {
  var step = currentStep(state);
  var kind = (override && override.kind) || (step && step.kind);
  var team = (override && override.team) || (step && step.team);
  if (!kind || !team) return false;
  if (!isAvailable(heroStatus(state), heroId)) return false;

  pushHistory(state);
  var entry = { hero: heroId, team: team };
  var guidedSeries = !override && step && step.phase === "series";
  var forcedSeries = !!override && override.phase === "series";

  if (guidedSeries || forcedSeries) {
    state.seriesBans.push(entry);
  } else if (kind === "ban") {
    currentGame(state).bans.push(entry);
  } else {
    currentGame(state).picks.push(entry);
  }
  return true;
}

function undo(state) {
  var prev = state.history.pop();
  if (!prev) return false;
  var hist = state.history;
  Object.keys(state).forEach(function (k) {
    if (k !== "history") delete state[k];
  });
  Object.assign(state, prev);
  state.history = hist;
  return true;
}

function nextGame(state) {
  pushHistory(state);
  var prev = currentGame(state);
  var g = newGame(state.games.length + 1);
  // Loser's map choice is unknown here; carry forward and let the operator set it.
  g.first = prev.first === TEAM.A ? TEAM.B : TEAM.A;
  state.games.push(g);
  state.gameIdx = state.games.length - 1;
  return g;
}

function setMode(state, mode) {
  pushHistory(state);
  state.mode = mode;
  state.seriesBanTarget = mode === "metamadness" ? 10 : 0;
  state.seriesBans = [];
  state.games = [newGame(1)];
  state.gameIdx = 0;
}

// Picking the map means you draft SECOND (Meta Madness map draft rule).
function setMap(state, mapName, pickedBy) {
  pushHistory(state);
  var g = currentGame(state);
  g.map = g.map === mapName ? null : mapName;
  if (pickedBy) g.first = pickedBy === TEAM.A ? TEAM.B : TEAM.A;
}

// --- Sync bus ---------------------------------------------------------------
// localStorage is shared by every page on the same origin in the same browser,
// so an OBS Browser Source and an OBS Custom Browser Dock stay in sync for free.
var bus = (function () {
  var channel = null;
  try { channel = new BroadcastChannel(CHANNEL_NAME); } catch (e) { /* older CEF */ }
  var listeners = [];

  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (parsed.v !== 2) return defaultState();
      parsed.history = parsed.history || [];
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function write(state) {
    var payload = JSON.stringify(state);
    try { localStorage.setItem(STORAGE_KEY, payload); } catch (e) { /* private mode */ }
    if (channel) channel.postMessage(payload);
    listeners.forEach(function (fn) { fn(state, "self"); });
  }

  function subscribe(fn) {
    listeners.push(fn);
    if (channel) {
      channel.onmessage = function (ev) {
        try { fn(JSON.parse(ev.data), "remote"); } catch (e) { /* ignore */ }
      };
    }
    // storage events only fire in OTHER tabs, so this is the cross-tab fallback.
    window.addEventListener("storage", function (ev) {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try { fn(JSON.parse(ev.newValue), "remote"); } catch (e) { /* ignore */ }
      }
    });
    return fn;
  }

  return { read: read, write: write, subscribe: subscribe, STORAGE_KEY: STORAGE_KEY };
})();
