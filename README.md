# Sum Drop

A mobile puzzle game about filling dice to the brim. Built with TypeScript, Vite and Capacitor, so the same code runs in a browser and ships as a native iOS and Android app.

## How it plays

- Tap (or hold, slide, release) a column to drop the next die.
- The dots on the dice touching a die pour into it. Fill it **exactly** to its own value and it pops.
- **Splash:** same-color dice touching a popping die pop with it.
- After pops, dice fall. If that fills another die exactly, the cascade continues as a chain, and each chain step multiplies the points.
- Every few drops a new row rises from the bottom, and the gap between rises keeps shrinking. The game ends when the board fills.

## Develop

```bash
npm install
npm run dev        # play in a browser at http://localhost:5173 (open on your phone via the LAN URL)
npm test           # rules unit tests (Vitest)
npm run typecheck
npm run sim        # balance check: random vs. lookahead bot over 200 seeded games
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
| `src/core/game.ts` | Game state machine and difficulty `TUNING`. `drop()` returns an outcome the UI animates. |
| `src/ui/board.ts` | Canvas renderer and animation playback (tiles, liquid fill, preview, particles, banners). |
| `src/ui/audio.ts` | Synthesized sound effects (no audio files). |
| `src/ui/platform.ts` | Haptics and saved settings through Capacitor plugins, with web fallbacks. |
| `src/main.ts` | Wires up the HUD, input and game loop. |
| `tests/` | Unit tests for the rules and game. |
| `scripts/balance.ts` | Bot playtests for tuning difficulty. |
| `ios/`, `android/` | Generated native projects (portrait only). |
