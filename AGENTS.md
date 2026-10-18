# しばメカ・スノーネオン

## Stack

Vite, TypeScript (strict), and three.js. Runtime dependencies are `three` and its official addons only. Combat, combo, score, damage, and wave flow live in `src/game` and do not import three. Vitest covers them. The HUD, cracks, and end screen are HTML/CSS. Sound is synthesized with Web Audio. Models and the street are built in code. No image files, audio files, paid assets, or paid services.

## Commands

- `npm ci` — install from the lockfile
- `npm test` — run Vitest
- `npm run dev` — play locally at `/shiba-mecha/`
- `npm run build` — typecheck and build `dist`
- `npm run preview` — serve the production build

## Core fantasy

Shooting is automatic. The player only aims. The left half of the screen grows a stick where the thumb lands and moves the mech. The right half drags the reticle. When the reticle overlaps an enemy, the mech fires, and the overlap is generous. A combo makes the shots thicker. A pack, then one large enemy, then a flash, then the next pack. Three hits crack the screen and end the run. One tap retries. The best score is kept in `localStorage`.

## Draw budgets

- At most 20 enemies at once
- Effect particles come from a pool of 300; snow is one separate particle system
- At most 2 lights
- Bloom stays low-resolution
- Pixel ratio is capped at 1.5
- No shadow maps

## Pages

`vite` `base` is `/shiba-mecha/`. GitHub Actions runs `npm ci`, `npm test`, and `npm run build` on pull requests and on `main`. A push to `main` deploys `dist` with `actions/upload-pages-artifact` and `actions/deploy-pages`.

## Merge gates

One theme per pull request. Squash-merge only after `npm test` passes, the slice has been played at 390×844, and CI is green. Never force-push. Never commit secrets.
