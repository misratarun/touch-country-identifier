import { flags } from "./flags.js";

// Speaks names one after another and keeps the corner flag in step with the voice.
// say({ name, flag, keepFlag }) resolves when that name has finished.
export function createVoice(flagEl, rate = 0.9) {
  const synth = window.speechSynthesis;
  const live = new Set(); // keeps utterances alive so iOS still fires their events
  let voice = null;

  function pickVoice() {
    const voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
    voice = voices.find(v => v.default) || voices.find(v => /en[-_]US/i.test(v.lang))
         || voices.find(v => /en[-_]CA/i.test(v.lang)) || voices[0] || null;
  }
  if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

  function showFlag(item) {
    const f = item.flag && flags[item.flag];
    if (f) { flagEl.src = f.url; flagEl.hidden = false; }
    else if (!item.keepFlag) flagEl.hidden = true;
  }

  function say(item) {
    return new Promise(resolve => {
      if (!synth) { showFlag(item); resolve(); return; }
      const u = new SpeechSynthesisUtterance(item.name);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = "en-US"; }
      u.rate = rate;
      // The flag changes when its own name starts, so it never runs ahead of the voice.
      if (!synth.speaking && !synth.pending) showFlag(item);
      u.onstart = () => showFlag(item);
      u.onend = u.onerror = () => { live.delete(u); resolve(); };
      live.add(u);
      synth.speak(u); // names queue: each waits for the one before it
    });
  }

  return { say, hideFlag: () => { flagEl.hidden = true; } };
}
