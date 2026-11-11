# Touch Country Identifier

A calm globe for iPad, with every country painted in its own flag. Turn it with one finger and zoom with two. Touch a country and it darkens briefly, like a pressed button on an AAC device. Then its name is spoken and its flag appears in a fixed corner.

> **Status:** First version works in a browser. Not yet tried on an iPad, and not yet installable offline.
> Daily progress: [DEVLOG.md](DEVLOG.md)

## Try it

```bash
npm install
npm run dev
```

Open the "Network" address it prints in Safari on an iPad that is on the same wifi.

## What it does

**Touch a place → hear its name.** That's the whole app. A parent or teacher does the teaching. The app has no quiz, scoring, prompts, praise sounds or levels.

Finger touches a country → finger lifts without sliding → country darkens briefly → name is spoken (waits its turn) → flag shows in the corner

## Design choices

| Topic | Choice |
| --- | --- |
| Model | Behave like an AAC button grid: predictable, the same every time. |
| Flags on the land | Each country's flag is stretched across its own shape. Land far from the rest of its country, such as Alaska, gets its own copy. |
| Movement | The globe moves only under a finger. It never spins by itself and stops the moment the finger lifts. North always stays up. |
| Zoom | Two-finger pinch, limited to between 1× and 10×. |
| When it speaks | When a finger lifts without having slid. A slide turns the globe and says nothing. |
| Press feedback | The country darkens briefly, then goes back to normal. |
| Fast taps | Names queue, and each waits for the previous one to finish. None get cut off. |
| Coverage | Every country speaks, and they all behave the same way. |
| Flag | Shown in one fixed corner. It appears when its name starts playing and stays until the next name. |
| Text on screen | None. |
| Ocean | Tapping the ocean is silent, like the empty space between buttons. |
| Stimulation | Flags in their true colours on a plain pale sea. No stars, glow or shading, and no sounds except names. `FLAG_SOFTEN` in `src/main.js` washes the colours out if needed. |
| Small countries | Zoom in to reach them. Zoomed well in, a tiny country wins over the bigger one around it, and a tap that just misses a small island still counts. |
| Voice | The device's built-in voice for now. Clips recorded from the user's own AAC app come later. |

## Voice clips are not included

The spoken names should be in the same voice the user already hears on their own AAC app. So the clips are recorded from that app and kept out of this repo. Many AAC voices are commercially licensed, which is another reason not to republish them.

This step comes after the globe itself. The planned recording process, all in one screen recording:

1. Turn on the iPad's screen recording with the microphone off.
2. Tap every country button the AAC app already has, leaving about 2 seconds of silence after each name.
3. For countries without a button, paste or type their names into the app's message bar and have them spoken. Universal Clipboard lets you copy the list on a Mac and paste it on the iPad.
4. Move the recording to a Mac. A script splits it at the silences, then uses speech-to-text to recognize each name and match it to the country list.
5. A review page plays each clip with its country and flag, starting with any the script wasn't sure about. Only wrong or missing clips get re-recorded.

Clips are named by what they say, not by their position. So the recording can be in any order, and a wrong, skipped or repeated name doesn't throw off the rest. When a country appears twice, the button version wins, so it sounds exactly like the button the user already knows.

> The splitting script and review page are still to come.

## Tech

- **Build:** Vite and plain JavaScript. All app code is in `src/main.js`, with the tunable numbers at the top.
- **Globe:** `d3-geo` orthographic projection on a canvas, with Natural Earth shapes from `world-atlas`. It draws 1:110m shapes while moving and 1:50m shapes when still. Each flag is clipped to its country's outline and stretched over the on-screen box around it.
- **Names and flags:** `scripts/build-countries.mjs` writes `src/countries.json`, one row per map shape. Run `npm run countries` after changing a spoken name. Flags are from `flag-icons` (MIT).
- **Voice:** the browser's `speechSynthesis` for now.

Still to come:

- **Offline install:** `vite-plugin-pwa` with everything precached, then Safari → Share → Add to Home Screen. Guided Access (Settings → Accessibility) keeps the app on screen.
- **Recorded voice:** `ffmpeg` silence detection, then local speech-to-text (Whisper) fuzzy-matched to the country list, played through Web Audio in a first-in, first-out queue.
- **Canadian provinces and US states** when zoomed into those countries.
