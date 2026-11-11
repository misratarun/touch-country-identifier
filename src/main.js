import { geoOrthographic, geoPath, geoContains, geoArea, geoCentroid, geoDistance, geoBounds } from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-50m.json";
import atlasLow from "world-atlas/countries-110m.json";
import rows from "./countries.json";

// ---- Settings -------------------------------------------------------------
const COLORS = {
  ocean: "#cfdbe0",
  land: "#a9b79a",     // shown only until a flag has loaded, or where there is no flag
  outline: "#7d878c",  // thin line around every country, so white flags don't melt into the sea
  rim: "#b9c6cb",
  pressed: "rgba(0, 0, 0, 0.4)", // laid over a touched country
  soften: "rgba(236, 235, 230, 1)",
};
const FLAG_SOFTEN = 0;        // 0 = true flag colours; 0.2 = slightly washed out, calmer
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const MAX_TILT = 75;          // degrees north/south the globe can tilt
const TAP_SLOP = 10;          // px a finger may wander and still count as a tap
const PRESS_MS = 350;         // how long a touched country stays dark
const SETTLE_MS = 140;        // pause after movement before full detail returns
const SPEECH_RATE = 0.9;
const START_VIEW = [95, -40]; // centred on North America

// ---- Flags ----------------------------------------------------------------
// Each flag is loaded once and kept as a small picture that is quick to stretch.
const flagSvgs = import.meta.glob("../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true, query: "?raw", import: "default",
});
const flags = {}; // code -> { url, image, small }
const flagsReady = Promise.all(Object.entries(flagSvgs).map(([file, svg]) => new Promise(done => {
  const code = file.match(/([\w-]+)\.svg$/)[1];
  // A stated size makes every browser willing to draw the SVG onto a canvas.
  const sized = /<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace("<svg", '<svg width="640" height="480"');
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    const small = document.createElement("canvas");
    small.width = 160; small.height = 120;
    small.getContext("2d").drawImage(image, 0, 0, 160, 120);
    flags[code] = { url, image, small };
    done();
  };
  image.onerror = done;
  image.src = url;
})));

// ---- Countries (for touch) ------------------------------------------------
const shapes = feature(atlas, atlas.objects.countries).features;
const countries = shapes.map((shape, i) => ({
  shape,
  name: rows[i].name,
  flag: rows[i].flag,
  area: geoArea(shape),
  centre: geoCentroid(shape),
  bounds: geoBounds(shape),
}));
// Quick reject before the exact test. Bounds that wrap the date line have west > east.
function inBounds([[w, s], [e, n]], [lon, lat]) {
  if (lat < s - 0.01 || lat > n + 0.01) return false;
  return w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w - 0.01 || lon <= e + 0.01;
}
const speaking = countries.filter(c => c.name);
const TINY = 3e-5;    // about 1,200 km²: cannot be hit with a fingertip even zoomed in
const SMALL = 2.5e-4; // about 10,000 km²: islands that are easy to miss
const tiny = speaking.filter(c => c.area < TINY);
const small = speaking.filter(c => c.area < SMALL);

// ---- Flag patches (for drawing) -------------------------------------------
// A country is split into patches of land that sit together. Each patch gets
// the whole flag stretched across it, so Alaska and Hawaii each show a US flag
// instead of sharing one flag stretched across the Pacific.
const RAD = Math.PI / 180;
function ringReach(centre, ring) {
  const step = Math.max(1, Math.floor(ring.length / 40));
  let reach = 0;
  for (let i = 0; i < ring.length; i += step) reach = Math.max(reach, geoDistance(centre, ring[i]));
  return reach;
}
function patchesFor(feat, flag) {
  const g = feat.geometry;
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map(coordinates => {
    const poly = { type: "Polygon", coordinates };
    const centre = geoCentroid(poly);
    return { coordinates, centre, area: geoArea(poly), reach: ringReach(centre, coordinates[0]) };
  }).sort((a, b) => b.area - a.area);
  const patches = [];
  for (const p of polys) {
    let home = patches.find(k => geoDistance(k.centre, p.centre) < k.join);
    if (!home) {
      home = { flag, centre: p.centre, join: p.reach * 1.3 + 4 * RAD, radius: 0, coordinates: [] };
      patches.push(home);
    }
    home.coordinates.push(p.coordinates);
    home.radius = Math.max(home.radius, geoDistance(home.centre, p.centre) + p.reach);
  }
  return patches.map(k => ({
    flag: k.flag, centre: k.centre, radius: k.radius + 1 * RAD,
    shape: { type: "MultiPolygon", coordinates: k.coordinates },
  }));
}
const flagByMapName = {};
atlas.objects.countries.geometries.forEach((g, i) => { flagByMapName[g.properties.name] = rows[i].flag; });
const fullPatches = shapes.flatMap((f, i) => patchesFor(f, rows[i].flag));
// A lighter outline is drawn while the globe is moving, so it keeps up with the finger.
const lightPatches = feature(atlasLow, atlasLow.objects.countries).features
  .flatMap(f => patchesFor(f, flagByMapName[f.properties.name] || null));

// ---- Drawing --------------------------------------------------------------
const canvas = document.getElementById("globe");
const ctx = canvas.getContext("2d");
const still = document.createElement("canvas"); // the last full-detail picture
const stillCtx = still.getContext("2d");
const projection = geoOrthographic().clipAngle(90).precision(1);

// The pen passes lines to whichever canvas is being drawn and notes how far
// they reach, which gives the box each flag is stretched into.
const pen = {
  ctx,
  x0: 0, y0: 0, x1: 0, y1: 0,
  reset() { this.x0 = this.y0 = Infinity; this.x1 = this.y1 = -Infinity; },
  see(x, y) {
    if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
  },
  moveTo(x, y) { this.see(x, y); this.ctx.moveTo(x, y); },
  lineTo(x, y) { this.see(x, y); this.ctx.lineTo(x, y); },
  closePath() { this.ctx.closePath(); },
  arc(x, y, r, a, b, ccw) { this.see(x - r, y - r); this.see(x + r, y + r); this.ctx.arc(x, y, r, a, b, ccw); },
};
const path = geoPath(projection, pen);

let width = 0, height = 0, dpr = 1, baseRadius = 1;
let rotation = [...START_VIEW];
let zoom = 1;
let pressedName = null;
let frame = 0;
let settleTimer = 0;
let stillValid = false;
let job = 0; // increases whenever a full-detail drawing in progress must be abandoned

function aim() {
  projection.scale(baseRadius * zoom).rotate([rotation[0], rotation[1], 0]);
}

// Draws the globe onto `c`. Pauses between countries so a slow full-detail
// drawing can be spread over several moments without freezing touches.
function* paint(c, patches, sharp) {
  const radius = baseRadius * zoom;
  const view = [-rotation[0], -rotation[1]];
  pen.ctx = c;
  c.clearRect(0, 0, width, height);
  c.beginPath(); path({ type: "Sphere" });
  c.fillStyle = COLORS.ocean; c.fill();
  c.lineWidth = 0.75; c.lineJoin = "round"; c.strokeStyle = COLORS.outline;

  let n = 0;
  for (const k of patches) {
    // Skip land on the far side or off the edge of the screen.
    const away = geoDistance(k.centre, view);
    if (away - k.radius > Math.PI / 2) continue;
    if (away < Math.PI / 2) {
      const p = projection(k.centre), r = k.radius * radius + 2;
      if (p[0] + r < 0 || p[0] - r > width || p[1] + r < 0 || p[1] - r > height) continue;
    }
    pen.ctx = c;
    pen.reset();
    c.beginPath(); path(k.shape);
    const w = pen.x1 - pen.x0, h = pen.y1 - pen.y0;
    if (!(w > 0 && h > 0)) continue;
    const f = k.flag && flags[k.flag];
    if (f && w >= 2 && h >= 2) {
      c.save();
      c.clip();
      c.drawImage(sharp && w > 200 ? f.image : f.small, pen.x0, pen.y0, w, h);
      if (FLAG_SOFTEN > 0) {
        c.globalAlpha = FLAG_SOFTEN; c.fillStyle = COLORS.soften; c.fillRect(pen.x0, pen.y0, w, h);
      }
      c.restore();
    } else {
      c.fillStyle = COLORS.land; c.fill();
    }
    c.stroke();
    if (++n % 6 === 0) yield;
  }

  pen.ctx = c;
  c.beginPath(); path({ type: "Sphere" });
  c.strokeStyle = COLORS.rim; c.lineWidth = 1; c.stroke();
}

function shadePressed() {
  if (!pressedName) return;
  pen.ctx = ctx;
  ctx.beginPath();
  for (const c of countries) if (c.name === pressedName) path(c.shape);
  ctx.fillStyle = COLORS.pressed; ctx.fill();
}

// Quick picture, drawn at once.
function drawLight() {
  aim();
  for (const _ of paint(ctx, lightPatches, false)) { /* run to the end */ }
  shadePressed();
}

// Show the finished full-detail picture.
function present() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(still, 0, 0);
  ctx.restore();
  shadePressed();
}

// Full-detail picture, drawn off screen in short bursts, then shown.
function drawFull() {
  const id = ++job;
  stillValid = false;
  aim();
  const steps = paint(stillCtx, fullPatches, true);
  const burst = () => {
    if (id !== job) return;
    const started = performance.now();
    while (performance.now() - started < 10) {
      if (steps.next().done) { stillValid = true; present(); return; }
    }
    setTimeout(burst, 0);
  };
  burst();
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  for (const [cv, c] of [[canvas, ctx], [still, stillCtx]]) {
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  baseRadius = Math.min(width, height) * 0.46;
  projection.translate([width / 2, height / 2]);
  drawLight();
  drawFull();
}

// Called while the globe is being turned or zoomed.
function requestDraw() {
  job++;               // abandon any full-detail drawing in progress
  stillValid = false;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(drawFull, SETTLE_MS);
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; drawLight(); });
}

// ---- Which country is under the finger ------------------------------------
function nearest(list, x, y, reach) {
  const view = [-rotation[0], -rotation[1]];
  let best = null, bestD = reach;
  for (const c of list) {
    if (geoDistance(c.centre, view) > Math.PI / 2 - 0.05) continue; // far side
    const p = projection(c.centre);
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function countryAt(x, y) {
  aim();
  const r = baseRadius * zoom;
  if (Math.hypot(x - width / 2, y - height / 2) > r) return null; // off the globe
  const point = projection.invert([x, y]);
  if (!point) return null;
  // Zoomed well in, a tiny country wins over the bigger one around it.
  if (zoom >= 6) { const t = nearest(tiny, x, y, 14); if (t) return t; }
  for (const c of countries) {
    if (inBounds(c.bounds, point) && geoContains(c.shape, point)) return c.name ? c : null;
  }
  // Missed into the sea: a small island right beside the finger still counts.
  return nearest(small, x, y, 22);
}

// ---- Voice and flag -------------------------------------------------------
const flagEl = document.getElementById("flag");
const synth = window.speechSynthesis;
const live = new Set(); // keeps utterances alive so iOS still fires their events
let voice = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  voice = voices.find(v => v.default) || voices.find(v => /en[-_]US/i.test(v.lang))
       || voices.find(v => /en[-_]CA/i.test(v.lang)) || voices[0] || null;
}
if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

function showFlag(c) {
  const f = c.flag && flags[c.flag];
  if (!f) return;
  flagEl.src = f.url;
  flagEl.hidden = false;
}

function say(c) {
  if (!synth) { showFlag(c); return; }
  const u = new SpeechSynthesisUtterance(c.name);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = "en-US"; }
  u.rate = SPEECH_RATE;
  // The flag appears when its own name starts, so it never runs ahead of the voice.
  const idle = !synth.speaking && !synth.pending;
  if (idle) showFlag(c);
  u.onstart = () => showFlag(c);
  u.onend = u.onerror = () => live.delete(u);
  live.add(u);
  synth.speak(u); // names queue: each waits for the one before it
}

// A press is painted over the finished picture, which keeps the darken instant.
let pressTimer = 0;
function paintPress(c) {
  pressedName = c ? c.name : null;
  if (stillValid) present(); else drawLight();
}
function press(c) {
  say(c);
  paintPress(c);
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => paintPress(null), PRESS_MS);
}

// ---- Touch: one finger turns, two fingers zoom, a still touch speaks -------
const fingers = new Map();
let tap = null;    // { id, x, y } while a touch could still be a tap
let pinch = null;  // { distance, zoom }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const spread = () => {
  const [a, b] = [...fingers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener("pointerdown", e => {
  if (fingers.size >= 2) return; // ignore a resting palm or third finger
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size === 1) {
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
  } else {
    tap = null;
    pinch = { distance: spread(), zoom };
  }
});

canvas.addEventListener("pointermove", e => {
  const f = fingers.get(e.pointerId);
  if (!f) return;
  const dx = e.clientX - f.x, dy = e.clientY - f.y;
  f.x = e.clientX; f.y = e.clientY;

  if (fingers.size === 2 && pinch) {
    zoom = clamp(pinch.zoom * spread() / Math.max(pinch.distance, 1), MIN_ZOOM, MAX_ZOOM);
    requestDraw();
    return;
  }
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP) tap = null;
  if (tap) return; // still inside the tap allowance: the globe stays put
  const degPerPx = 180 / Math.PI / (baseRadius * zoom);
  rotation[0] += dx * degPerPx;
  rotation[1] = clamp(rotation[1] - dy * degPerPx, -MAX_TILT, MAX_TILT);
  requestDraw();
});

function lift(e, cancelled) {
  if (!fingers.has(e.pointerId)) return;
  fingers.delete(e.pointerId);
  pinch = null;
  if (!cancelled && tap && tap.id === e.pointerId && fingers.size === 0) {
    const c = countryAt(tap.x, tap.y);
    if (c) press(c);
  }
  tap = null;
}
canvas.addEventListener("pointerup", e => lift(e, false));
canvas.addEventListener("pointercancel", e => lift(e, true));

// Mouse wheel zoom, for trying it on a computer.
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
  requestDraw();
}, { passive: false });

// Keep Safari's own zoom, menus and text selection out of the way.
for (const type of ["gesturestart", "gesturechange", "gestureend", "contextmenu", "dblclick", "selectstart"]) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}

window.addEventListener("resize", resize);
resize();
flagsReady.then(() => { drawLight(); drawFull(); });

// For checks from the browser console.
window.__globe = {
  countryAt, press, projection, countries, drawLight, drawFull, flagsReady,
  patches: { full: fullPatches.length, light: lightPatches.length },
  fullSync() { aim(); let n = 0; for (const _ of paint(stillCtx, fullPatches, true)) n++; stillValid = true; present(); return n; },
  view(r, z) { rotation = r; zoom = z; job++; drawLight(); drawFull(); },
  state: () => ({ rotation, zoom, stillValid }),
};
