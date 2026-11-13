# Sum Drop

A mobile puzzle game about filling dice to the brim. Built with TypeScript, Vite and Capacitor, so the same code runs in a browser and ships as a native iOS and Android app.

## How it plays

- Tap (or hold, slide, release) a column to drop the next die.
- The dots on the dice touching a die pour into it. Fill it **exactly** to its own value and it pops.
- **Splash:** same-color dice touching a popping die pop with it.
- After pops, dice fall. If that fills another die exactly, the cascade continues as a chain, and each chain step multiplies the points.
- Every few drops a new row rises from the bottom, and the gap between rises keeps shrinking. The game ends when the board fills.

## Levels and worlds

The game opens on a world map. **First Nap** is a 3-level tutorial on tiny boards, then **Cat Nap Alley** has 12 levels. Each level has a goal (tuck in N cats, tuck in N of one size, reach a score, make a chain, or clear the board), a drop limit, and 1 to 3 stars: meeting the goal is 1 star, and the final score (with a bonus for drops left) earns the other two. Beating a level unlocks the next. Endless mode is the original rising-rows game.

Levels live in `src/core/levels.ts`. Boards are written as strings, bottom row last. After changing one, run `npm test` (checks every board is stable and settled) and `npm run levels` (bot win rates, for setting drop limits and star scores).

## Develop

```bash
npm install
npm run dev        # play in a browser at http://localhost:5173 (open on your phone via the LAN URL)
npm test           # rules unit tests (Vitest)
npm run typecheck
npm run sim        # balance check: random vs. lookahead bot over 200 seeded games
npm run levels     # level tuning: bot win rates and scores for every level
```

## Run on a phone

Prerequisites: Xcode for iOS (macOS only), Android Studio for Android.

```bash
npm run cap:ios      # builds the web app, syncs it, opens the Xcode project
npm run cap:android  # same for Android Studio
```

Then press Run in Xcode or Android Studio with a device or simulator selected. After changing web code, `npm run cap:sync` copies the new build into both native projects.

## Code map

| Path | What it is |
| --- | --- |
| `src/core/rules.ts` | Pure game rules: fill sums, pops and splash, gravity, cascades, drop preview. No DOM. |
| `src/core/game.ts` | Game state machine and difficulty `TUNING`. A `GameConfig` sets board size, starting board, cat queue, rising and drop limit. `drop()` returns an outcome the UI animates. |
| `src/core/level.ts` | Level goals, progress, stars and the leftover-drop bonus. |
| `src/core/levels.ts` | The worlds and hand-made levels. |
| `src/ui/board.ts` | Canvas renderer and animation playback (tiles, liquid fill, preview, particles, banners). |
| `src/ui/audio.ts` | Synthesized sound effects (no audio files). |
| `src/ui/platform.ts` | Haptics and saved settings through Capacitor plugins, with web fallbacks. |
| `src/main.ts` | World map, level intro and end cards, HUD, input and the game loop. Saves stars per level. |
| `tests/` | Unit tests for the rules and game. |
| `scripts/balance.ts` | Bot playtests for tuning Endless difficulty. |
| `scripts/levels.ts` | Bot playtests for tuning each level. |
| `ios/`, `android/` | Generated native projects (portrait only). |
