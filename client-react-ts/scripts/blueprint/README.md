# Logo blueprint sheets

Generates the five construction sheets shown on `/design` (logo blueprint) from the real
logo paths in `src/components/BrandLogo/logoSvgs.ts`. Every dimension is computed from the path
geometry and then verified against a raster of the logo (each tick must land within 0.5 px of the
real ink edge; labels/lines are checked for overlaps and for touching the logo).

Output: `src/assets/blueprint/0N-*.svg` (IBM Plex Mono subset embedded) + `0N-*.png` (2x).

```sh
cd scripts/blueprint
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python run.py            # all sheets; or e.g. `run.py 1 3`
BV_CHECKS=/tmp/bp-checks .venv/bin/python run.py   # also write 16x zoom crops of every tick
```

Needs Cairo (cairosvg) — on macOS `brew install cairo`. Env: `BV_LOGO_TS` (input), `BV_OUT` (output dir).
Fonts in `fonts/` are IBM Plex Mono (SIL Open Font License 1.1).
Re-run after changing `logoSvgs.ts`; the report prints `issues: 0` per sheet when everything checks out.
