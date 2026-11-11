# Touch Country Identifier

A calm flat map for iPad, opened level by level with single touches. Touch a place and it darkens briefly, like a pressed button on an AAC device. Then its name is spoken and its flag appears in a fixed corner.

> **Status:** Works in a browser. Not yet tried on an iPad, and not yet installable offline.
> Daily progress: [DEVLOG.md](DEVLOG.md)

> **Two tracks.** This branch, `map-2d`, is the flat map and is where work continues. An earlier 3D globe (turn with one finger, pinch to zoom) is kept unchanged on the `globe-3d` branch and the `3d-globe` tag.

## Try it

```bash
npm install
npm run dev
```

Open the "Network" address it prints in Safari on an iPad that is on the same wifi.

## What it does

**Touch a place → hear its name.** A parent or teacher does the teaching. The app has no quiz, scoring, prompts, praise sounds or levels to win.

The map works like folders of buttons on an AAC device. To reach Iowa: touch North America, then the United States, then Iowa.

| Page | What a touch does |
| --- | --- |
| World | A continent says its name, then opens. Oceans, seas, Antarctica and Greenland say their names. |
| Continent | A country says its name and shows its flag. The United States, Canada and India say their names, then open. Water says its name. Land from other continents is pale and silent. |
| States or provinces | A state says its name. Neighbouring states never share a colour. |

## Design choices

| Topic | Choice |
| --- | --- |
| Model | Behave like an AAC button grid: predictable, the same every time. |
| Touch | One finger, one touch at a time. No pinching or dragging. |
| Press feedback | The touched place darkens briefly, then goes back to normal. |
| Fast taps | Names queue, and each waits for the previous one to finish. None get cut off. |
| World page | A flat rectangle that fills the whole screen, with the continents enlarged and open ocean and the poles squeezed. Each continent has its own muted colour. Continents, oceans, Greenland and Antarctica have their names written on them, and a few large countries show their flag. |
| Whole flags | On a continent page each flag is drawn complete, at the largest size that fits inside the country's border. Nothing is stretched or cut off. |
| Room for small countries | Continent pages are reshaped for clarity, not accuracy: crowded areas are stretched, and large countries and open sea are squeezed. The order of places never changes. |
| Countries still too small | They get a small flag marker beside them, nudged apart so none overlap. Only sovereign countries get a marker; small territories still speak when touched. |
| Smallest states | Delaware, Delhi, Prince Edward Island and similar get a round marker to touch. |
| Back button | Top-left on every page below the world. |
| Opening a page | A page opens only after its name has been spoken, and it changes without animation. |
| Corner flag | Shown in one fixed corner. It appears when its name starts playing and stays until the next name. |
| Stimulation | Muted colours on a plain pale sea. Nothing moves by itself, and there are no sounds except names. |
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

- **Build:** Vite and plain JavaScript. The app is `src/map.js`, with tunable numbers, written names and the list of world-page flags at the top.
- **Shared code:** `src/shared/` holds flag loading, the voice queue and geometry helpers.
- **Drawing:** `d3-geo` on a canvas. Each page is drawn once.
- **Flag placement:** the country is drawn small, then every position is tried for the largest 4:3 box that lies fully on land.
- **Reshaping:** each screen axis of a continent page is stretched where countries are crowded and squeezed elsewhere. `SPREAD` sets how strongly; 0 gives true shapes. The world page is reshaped the same way (`WORLD_SPREAD`), with every continent given an equal say.
- **Country data:** Natural Earth shapes from `world-atlas`. `npm run countries` writes `src/countries.json` with each shape's spoken name, flag and continent.
- **State data:** Natural Earth admin-1 (1:50m, public domain). `scripts/build-states.mjs` writes `src/data/states-*.json`; the script header gives the source file.
- **Water names:** rough outlines in `src/data/waters.js`.
- **Flags:** `flag-icons` (MIT).
- **Voice:** the browser's `speechSynthesis` for now.

Still to come:

- **Offline install:** `vite-plugin-pwa` with everything precached, then Safari → Share → Add to Home Screen. Guided Access (Settings → Accessibility) keeps the app on screen.
- **Recorded voice:** `ffmpeg` silence detection, then local speech-to-text (Whisper) fuzzy-matched to the name list, played through Web Audio in a first-in, first-out queue.
