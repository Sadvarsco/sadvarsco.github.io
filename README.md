# Heroes of the Storm — Draft Tracker

Made because I was quite confused which heroes were available for picking.

Keeps track of who is banned, who has already been played, and who is still available across
a whole series — and puts that on stream as an overlay.

**Live:** https://sadvarsco.github.io/

| | |
|---|---|
| [`index.html`](index.html) | **Draft Control** — the panel you click |
| [`overlay.html`](overlay.html) | **Stream Overlay** — transparent, for OBS |
| [`classic.html`](classic.html) | the original single-page tracker, unchanged |

---

## Two rulesets

**Meta Madness** ([ruleset](https://heroeslounge.gg/meta-madness-ruleset))
- Ten heroes are banned in *every* game of *every* series: Anduin, Blaze, Brightwing,
  Chromie, Dehaka, Hanzo, Hogger, Johanna, Sylvanas, Valla.
- Ten more series bans on top, in a 1–2–2–2–2–1 order.
- Every hero picked is dead for the rest of the series.

**Competitive**
- No automatic bans — all 90 heroes start available.
- Standard triple-ban tournament draft.
- Same single-use rule: once picked, that hero is gone for the series.

In both modes the single-use rule is **global** — if either team plays a hero, nobody plays
them again that series. Bans made *inside* a game only apply to that game and clear when you
move on.

## Running a draft

The status bar tells you whose turn it is and whether it's a ban or a pick. Click a hero and
it advances.

- **Override** — draft goes off-script, force the next click onto a specific team/action.
- **Undo** (or `Ctrl+Z`) — step back one action.
- **Next game** — clears that game's bans, keeps every played hero locked out.
- **Map** — pick the map and it sets the draft order for you (the team that picks the map
  drafts second).
- Search with `/`, filter by role, or hide everything unavailable.

The role counts along the top are the quiet useful bit: watching *Healer* drop to 2 with two
games left is the thing people lose track of.

## On stream

The overlay has two lanes: **still available** (ringed by role, with role counts) and **out
of the pool** (dimmed, colour-keyed by why). Both split around your facecam so they sit
either side of you rather than over you.

**Fit to my stream…** in the panel positions it around whatever overlay you already run —
three presets (Khaldor is the default), sliders for every margin and the camera gap, and a
live preview. Portraits auto-size to fill the space you give them.

See **[OBS-SETUP.md](OBS-SETUP.md)**. Short version: `overlay.html` goes in a **Browser
Source**, and `index.html` goes in a **Custom Browser Dock** *inside OBS*. They have to be in
the same browser to stay in sync — that's the one gotcha. To hand someone a ready-made
source, use **Copy overlay URL with this layout**, which packs the whole configuration into
the link.

## Notes

- Heroes are alphabetical. Cho and Gall count as two separate heroes.
- Everything is static HTML/CSS/JS. No build step, no server, no accounts, nothing stored
  anywhere but your own browser.

Any updates / corrections / suggestions, leave me a comment.

Thank you Khaldor for your support of the Heroes of the Storm community.
