# X-Wing Skyfighter

Three.js arcade flight shooter in a single HTML file. True 6-DOF flight —
loops, inverted flight, vertical climbs — with mouse-aim steering.

## Setup

Requirements: Python 3 (any static file server works) and a modern desktop
browser. There is no build step; the game loads Three.js from a CDN, so the
first load needs an internet connection.

```
npm run serve   # alias for: python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html>.

`npm install` is only needed for the test suite (Playwright) — the game
itself has nothing to install.

## How to play

Click the game once to capture the mouse (`Esc` releases it). Without pointer
capture, the cursor's offset from screen center steers the ship.

- Shoot down enemy fighters to score — tougher types are worth more
  (100–300 points each).
- Watch your hull (top-left). Enemy fire, ramming, and scraping the terrain
  all deal damage. At 0 hull you eject — press `R` or `Enter` to redeploy.
- Collect the floating power-ups (green blips on the radar):

  | Power-up | Color | Effect |
  |---|---|---|
  | Hull | green | +30 hull |
  | Laser | red | upgrades laser tier |
  | Rapid | orange | rapid fire for 12 s |
  | Double | blue | twin lasers for 12 s |
  | Plasma | pink | plasma lasers for 10 s |
  | Missiles | purple | +5 missiles |
  | Shield | cyan | temporary shield for 8 s |

- The world wraps at the edges: fly off one side and you reappear on the
  opposite one. Altitude is capped at 800 u.
- Your best score persists between sessions (browser `localStorage`).

## Controls

| Action | Input |
|---|---|
| Steer (pitch + yaw) | Mouse (click to capture pointer) |
| Roll left / right | `A` / `D` |
| Barrel roll | double-tap `A` / `D` |
| Throttle up / down | `W` / `S` |
| Boost (hold) | `Space` |
| Airbrake (hold) | `Shift` |
| Fire lasers | left-click or `L` |
| Fire missile | `M` |
| Fire missile (AOE blast) | right-click or `N` |
| Invert Y axis | `I` |
| Sound on/off | `U` |
| Pause | `P` |
| Restart after death | `R` or `Enter` |

## Features

- Quaternion flight model: no attitude limits, coordinated auto-banking,
  auto-level assist, persistent throttle.
- Bloom post-processing, gradient sky with sun haze, height/slope-painted
  terrain, sprite clouds, engine glow, wingtip contrails.
- Radar (bottom-right) tracks enemies and power-ups relative to your heading.
- Synthesized WebAudio sound: engine, lasers, explosions, pickups, damage.
- Hull/throttle gauges, speed + altitude readouts, hit markers, damage vignette.

## Test

```
npm install     # once, fetches Playwright
npm test        # runs test.mjs
```

`probe.mjs` exercises edge cases (toroidal wrap, laser vs parked enemy,
altitude ceiling, power-up placement) and captures screenshots.
