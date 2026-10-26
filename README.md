# Touch Country Identifier

A calm world map for iPad. Touch a country and it darkens briefly, like a pressed button on an AAC device. Then its name is spoken and its flag appears in a fixed corner.

> **Status:** In planning. No app code yet.
> Daily progress: [DEVLOG.html](DEVLOG.html)

## What it does

**Touch a place → hear its name.** That's the whole app. A parent or teacher does the teaching. The app has no quiz, scoring, prompts, praise sounds or levels.

Finger touches a country → country darkens briefly → name is spoken (waits its turn) → flag shows in the corner

## Design choices

| Topic | Choice |
| --- | --- |
| Model | Behave like an AAC button grid: predictable, the same every time. |
| Press feedback | The country darkens briefly, then goes back to normal. |
| Fast taps | Names queue, and each waits for the previous one to finish. None get cut off. The darken still happens instantly on every tap. |
| Coverage | Every country speaks, and they all behave the same way. |
| Flag | Shown in one fixed corner. It appears when its name starts playing and stays until the next name. |
| Text on screen | None. |
| Ocean | Tapping the ocean is silent, like the empty space between buttons. |
| Stimulation | Fixed muted colors. No animations except the darken, and no sounds except names. |
| Small countries | Larger invisible tap zones, so a fingertip can hit them on the first try. |
| Offline | Everything, audio included, downloads on install. After that, every tap responds instantly with or without a connection. |

## Voice clips are not included

The spoken names should be in the same voice the user already hears on their own AAC app. So the clips are recorded from that app and kept out of this repo. Many AAC voices are commercially licensed, which is another reason not to republish them.

The planned recording process, all in one screen recording:

1. Turn on the iPad's screen recording with the microphone off.
2. Tap every country button the AAC app already has, leaving about 2 seconds of silence after each name.
3. For countries without a button, paste or type their names into the app's message bar and have them spoken. Universal Clipboard lets you copy the list on a Mac and paste it on the iPad.
4. Move the recording to a Mac. A script splits it at the silences, then uses speech-to-text to recognize each name and match it to the country list.
5. A review page plays each clip with its country and flag, starting with any the script wasn't sure about. Only wrong or missing clips get re-recorded.

Clips are named by what they say, not by their position. So the recording can be in any order, and a wrong, skipped or repeated name doesn't throw off the rest. When a country appears twice, the button version wins, so it sounds exactly like the button the user already knows.

> The splitting script and review page are still to come.

## Planned tech

- **Build:** Vite, plain JavaScript and `vite-plugin-pwa`, with everything precached.
- **Map:** Natural Earth 1:50m shapes from `world-atlas`, drawn as SVG with `d3-geo` and `topojson-client`.
- **Clip naming:** `ffmpeg` silence detection, then local speech-to-text (Whisper) fuzzy-matched to the country list.
- **Audio:** Web Audio, with every clip decoded at startup and played through a first-in, first-out queue.
- **Flags:** `flag-icons` (MIT).
- **Install:** open in Safari → Share → Add to Home Screen. Guided Access (Settings → Accessibility) keeps the app on screen.
