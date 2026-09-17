# Putting the draft tracker on stream

Two pages, one shared state:

| Page | What it is | Where it goes |
|---|---|---|
| `index.html` | **Draft Control** — you click heroes here | An OBS *Custom Browser Dock* (or a second monitor) |
| `overlay.html` | **Stream Overlay** — transparent, goes over the gameplay | An OBS *Browser Source* |

---

## The one thing to get right

The two pages talk to each other through browser storage. **They only sync if they are
running in the same browser.**

OBS has its own built-in browser, completely separate from your Chrome. So if you open the
control panel in Chrome and the overlay as a Browser Source in OBS, **they will not see each
other** and the overlay will never update.

The fix is to run *both* inside OBS. It takes about a minute.

---

## Setup

### 1. The overlay (Browser Source)

1. In your scene: **+ → Browser**, name it `Draft Overlay`.
2. **URL:** `https://sadvarsco.github.io/overlay.html`
3. **Width** `1920`, **Height** `1080`.
4. Leave *Shutdown source when not visible* **unchecked** — otherwise it forgets the draft
   every time you cut away from the scene.
5. OK. The bar sits along the bottom of the frame; everything else is transparent.

> Framing it before a match? Use `overlay.html?demo=1` to fill it with sample data, then
> switch the URL back.

### 2. The control panel (Custom Browser Dock)

1. **Docks → Custom Browser Docks…**
2. **Dock Name:** `Draft Control` · **URL:** `https://sadvarsco.github.io/`
3. **Apply**, then close. A panel appears inside OBS — drag it wherever you like, or float it
   onto a second monitor.

That's it. Clicking a hero in the dock updates the overlay live.

### 3. Check it

Click any hero in the dock. The "heroes left" number on the overlay should drop
immediately. If it doesn't, the two are in different browsers — see step 2.

---

## Overlay URL options

Append these to `overlay.html`:

| Option | Does what |
|---|---|
| `?view=strip` | Force the compact bar and ignore the panel's view buttons |
| `?view=grid` | Force the full-roster grid |
| `?view=hidden` | Force it off |
| `?pos=top` | Anchor the bar to the top instead of the bottom |
| `?scale=1.25` | Scale the whole overlay up (or down: `0.8`) |
| `?roles=0` | Hide the "11 Tank / 15 Bruiser / …" breakdown |
| `?demo=1` | Sample data for framing the source |

Combine with `&`, e.g. `overlay.html?view=strip&pos=top&scale=0.9`.

**A useful pattern:** make *two* Browser Sources — one pinned to `?view=strip` for your
in-game scene, one pinned to `?view=grid` for a "draft" scene. Each scene shows the right
one automatically and you never touch the view buttons mid-broadcast.

Otherwise, leave the URL plain and use the **Strip / Grid / Hide** buttons in the panel.

---

## The two views

**Strip** — a ~166px bar. Heroes left, the mode and map, the role breakdown, then every dead
hero grouped as *Auto-banned · Series bans · Already played · Banned this game*, and who's on
the clock. Portraits shrink automatically as the series goes on, so game 5 of a Bo5 still
fits. Safe to leave up during gameplay.

**Grid** — the full 90-hero roster. Available heroes in colour, everything else dimmed with a
coloured ring showing why. Covers most of the frame; use it during the draft.

---

## Running it offline

GitHub Pages is the easy path, but the whole thing is static files. To run it from disk,
serve the folder (don't open the files directly — `file://` breaks browser storage):

```bash
python -m http.server 8140
```

Then point OBS at `http://localhost:8140/overlay.html` and
`http://localhost:8140/index.html`.

---

## Known limit

Control panel and overlay must be in the same browser, which means the operator has to be on
the streaming machine. Driving the overlay from a *different* computer would need a small
relay server — not built, but the sync layer in `assets/draft.js` is isolated enough that it
could be swapped in without touching anything else.
