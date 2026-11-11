# Devlog

Day-by-day progress on [Touch Country Identifier](README.md), newest first.

## Day 2: from flat map to globe

*10 Nov 2026*

**Done**

- Changed the plan from a fixed flat map to a globe that turns with one finger and zooms with two.
- Reordered the work so the app comes first. It uses the device's built-in voice for now; the recorded AAC voice becomes a later upgrade.
- Built the first version: globe, touch to hear the name, flag in the corner, names queue.
- Painted each country's flag across its own shape, so a country can be found by its flag.
- Kept it calm: the globe never moves by itself, north stays up, and zoom is limited.
- Made dragging smooth by drawing simpler shapes while the globe moves and full detail when it stops.

**Next**

- Try it on the iPad and adjust.
- Make it installable and usable offline.

## Day 1: design and voice plan

*26 Oct 2026*

**Done**

- Set the core interaction: touch a country, it darkens briefly, its name is spoken, and its flag appears in a fixed corner. No text, no scoring, no praise sounds. The ocean is silent.
- Decided that fast taps queue names instead of cutting them off, and that every country speaks.
- Chose a one-take recording process. Tap every AAC button first, then paste or type the countries that have no button. A script splits the recording at silences and names each clip with speech-to-text, so order and slips don't matter.
- Set up the public repo, keeping personal notes, raw recordings and licensed voice clips local.

**Next**

- Record the clips on the iPad.
- Write the script that splits and names them, plus a review page.
