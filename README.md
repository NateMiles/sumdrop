# Sum Drop

A mobile puzzle game about filling dice to the brim. Built with TypeScript, Vite and Capacitor, so the same code runs in a browser and ships as a native iOS and Android app.

## How it plays

- Tap (or hold, slide, release) a column to drop the next die.
- The dots on the dice touching a die pour into it. Fill it **exactly** to its own value and it pops.
- **Splash:** same-color dice touching a popping die pop with it.
- After pops, dice fall. If that fills another die exactly, the cascade continues as a chain, and each chain step multiplies the points.
- Every few drops a new row rises from the bottom, and the gap between rises keeps shrinking. The game ends when the board fills.

## Levels and worlds

The game opens on a world map. **First Light** is a 3-level tutorial on tiny boards, **Gem Grotto** (world 1) has 12 levels, and **Cat Nap Alley** (world 2) has 8 harder levels with bigger pieces and faster rising rows. Each level has a goal (clear N pieces, clear N of one size, reach a score, make a chain, or clear the board), a drop limit, and 1 to 3 stars: meeting the goal is 1 star, and the final score (with a bonus for drops left) earns the other two. Beating a level unlocks the next. Endless mode is the original rising-rows game, in the gem look.

Each world has a **theme** (`src/themes/`): its piece art, the icon for one unit of need, and its words ("Tuck in 5 gingers", "still awake"). The rules, swap, night light and chains are shared by every world. Gem Grotto and the tutorial use the gem theme (a gem's number of sides is its size), Cat Nap Alley uses the cat theme, and Endless uses the default (gem) theme. Each theme also picks the backdrop and the name of the chain-preview boost (Lantern, Night light). To add a world, add a theme next to `cats.ts`, register it in `src/themes/index.ts`, and point the world at it in `WORLDS`.

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
| `src/themes/` | World themes: piece art and words. `gems.ts` is Gem Grotto, `cats.ts` is Cat Nap Alley. |
| `src/ui/cats.ts` | The cat drawings used by the cat theme. |
| `src/ui/board.ts` | Canvas renderer and animation playback (tiles, liquid fill, preview, particles, banners). |
| `src/ui/audio.ts` | Synthesized sound effects (no audio files). |
| `src/ui/platform.ts` | Haptics and saved settings through Capacitor plugins, with web fallbacks. |
| `src/main.ts` | World map, level intro and end cards, HUD, input and the game loop. Saves stars per level. |
| `tests/` | Unit tests for the rules and game. |
| `scripts/balance.ts` | Bot playtests for tuning Endless difficulty. |
| `scripts/levels.ts` | Bot playtests for tuning each level. |
| `ios/`, `android/` | Generated native projects (portrait only). |
