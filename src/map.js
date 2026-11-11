// A flat map opened level by level with single touches.
// World -> continent -> country, and for a few countries -> state or province.
import {
  geoEquirectangular, geoAzimuthalEqualArea, geoAlbersUsa, geoConicConformal, geoMercator,
  geoPath, geoContains, geoBounds, geoCentroid, geoTransform,
} from "d3-geo";
import { feature, neighbors } from "topojson-client";
import atlas from "world-atlas/countries-50m.json";
import rows from "./countries.json";
import usaStates from "./data/states-usa.json";
import canadaStates from "./data/states-canada.json";
import indiaStates from "./data/states-india.json";
import { WATERS, OCEANS } from "./data/waters.js";
import { flags, flagsReady } from "./shared/flags.js";
import { createVoice } from "./shared/voice.js";
import { inBounds, patchesFor } from "./shared/geo.js";

// ---- Settings -------------------------------------------------------------
const COLORS = {
  page: "#ecebe6",
  ocean: "#cfdbe0",
  land: "#f4f0e6",        // a country on its own continent page, behind its flag
  otherLand: "#dedcd4",   // land that belongs to a different page; silent
  noContinent: "#f6f6f3", // Antarctica and a few remote islands
  outline: "#8b9498",
  worldBorder: "rgba(255, 255, 255, 0.6)",
  pressed: "rgba(0, 0, 0, 0.36)",
  leader: "#8b9498",
  landName: "#2f373c",
  waterName: "#4d6370",
};
// `frame` is the west, south, east, north of what the page shows.
const CONTINENTS = {
  "north-america": { name: "North America", color: "#d3bf9c", centre: [-96, 45], frame: [-162, 8, -56, 72] },
  "south-america": { name: "South America", color: "#a9b99b", centre: [-60, -21], frame: [-82, -56, -34, 13] },
  "europe":        { name: "Europe",        color: "#b7abc9", centre: [14, 53],  frame: [-24, 35, 42, 71] },
  "africa":        { name: "Africa",        color: "#dcc48d", centre: [18, 2],   frame: [-18, -35, 52, 37.5] },
  "asia":          { name: "Asia",          color: "#cfa399", centre: [88, 32],  frame: [27, -10, 146, 58] },
  "oceania":       { name: "Oceania",       color: "#9dbab4", centre: [152, -22], frame: [112, -47, 204, 18] },
};
// Countries that open one level further.
const STATE_PAGES = {
  usa:    { country: "United States", parent: "north-america", topo: usaStates,
            projection: () => geoAlbersUsa() },
  canada: { country: "Canada", parent: "north-america", topo: canadaStates,
            projection: () => geoConicConformal().parallels([49, 77]).rotate([96, 0]) },
  india:  { country: "India", parent: "asia", topo: indiaStates,
            projection: () => geoMercator() },
};
const STATE_COLORS = ["#d3bf9c", "#a9b99b", "#b7abc9", "#dcc48d", "#cfa399", "#9dbab4"];
// Names written on the world map, each centred on [longitude, latitude].
const WORLD_LABELS = [
  { text: "North America", at: [-101, 50] },
  { text: "South America", at: [-59, -6] },
  { text: "Europe", at: [16, 50] },
  { text: "Africa", at: [19, 10] },
  { text: "Asia", at: [88, 47] },
  { text: "Oceania", at: [134, -21] },
  { text: "Antarctica", at: [25, -79] },
  { text: "Greenland", at: [-41, 73] },
  { text: "Pacific Ocean", at: [-140, 0], water: true },
  { text: "Pacific Ocean", at: [165, 22], water: true },
  { text: "Atlantic Ocean", at: [-37, 30], water: true },
  { text: "Indian Ocean", at: [78, -28], water: true },
  { text: "Arctic Ocean", at: [-140, 80], water: true },
  { text: "Southern Ocean", at: [95, -61], water: true },
];
// Countries whose flag is shown on the world map, where it fits inside the border.
const WORLD_FLAGS = ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Russia", "China", "India",
  "Australia", "South Africa", "Egypt", "Nigeria", "Saudi Arabia", "Kazakhstan", "Indonesia", "Algeria"];
const WORLD_FLAG_MAX = 58;  // px: widest a flag may be on the world map
// On the world map these say their own name instead of opening their continent.
const WORLD_OWN = ["Greenland"];
// How strongly a continent page is reshaped to give every country room.
// 0 keeps true shapes; nearer 1 shrinks big countries and empty sea further.
const SPREAD = 0.6;
const WORLD_SPREAD = 0.45; // the same, for the world page
const BIG_SHARE = 5;      // the most room a large country gets, counted in small countries
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const BOTH = { "Russia": ["europe", "asia"], "Turkey": ["asia", "europe"] };
const EUROPE_ENDS_AT = 60;  // on the world map, Russia west of this longitude is Europe
const TAP_SLOP = 30;        // px a finger may wander and still count as a touch
const PRESS_MS = 400;       // how long a touched place stays dark
const OPEN_WAIT_MS = 3000;  // longest wait for a name to finish before its page opens
const MIN_FLAG = 18;        // px: narrower than this, a flag inside the border is unreadable
const BADGE = [30, 22.5];   // px: flag marker for countries too small to hold their flag
const TINY_STATE = 22;      // px: states smaller than this get a round marker to touch
const SPEECH_RATE = 0.9;

// ---- Places ---------------------------------------------------------------
// One place per name: Somaliland is part of Somalia, and so on.
const places = [];
{
  const byName = new Map();
  feature(atlas, atlas.objects.countries).features.forEach((f, i) => {
    const row = rows[i];
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const coords of polys) {
      let { name, flag, continent, marker } = row;
      // French Guiana is drawn as part of France in the map file.
      if (name === "France") {
        const [lon, lat] = geoCentroid({ type: "Polygon", coordinates: coords });
        if (lon < -40 && lat < 12 && lat > 0) { name = "French Guiana"; flag = "gf"; continent = "south-america"; }
      }
      const key = name || `silent-${i}`;
      if (!byName.has(key)) {
        byName.set(key, { name, flag, marker, continents: BOTH[name] || (continent ? [continent] : []), coordinates: [] });
      }
      byName.get(key).coordinates.push(coords);
    }
  });
  for (const p of byName.values()) {
    p.shape = { type: "MultiPolygon", coordinates: p.coordinates };
    p.bounds = geoBounds(p.shape);
    p.patches = null; // worked out the first time the place needs a flag
    places.push(p);
  }
}
const placeNamed = name => places.find(p => p.name === name);

function placeAt(point) {
  for (const p of places) if (inBounds(p.bounds, point) && geoContains(p.shape, point)) return p;
  return null;
}

// ---- Water ----------------------------------------------------------------
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function waterAt([lon, lat]) {
  for (const w of WATERS) {
    const x = w.wrap && lon < 0 ? lon + 360 : lon;
    if (inRing(w.ring, x, lat)) return w.name;
  }
  if (lat >= OCEANS.arcticFrom) return "Arctic Ocean";
  if (lat <= OCEANS.southernFrom) return "Southern Ocean";
  if (inRing(OCEANS.indian, lon, lat)) return "Indian Ocean";
  if (inRing(OCEANS.atlantic, lon, lat)) return "Atlantic Ocean";
  return "Pacific Ocean";
}

// ---- Canvas ---------------------------------------------------------------
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const still = document.createElement("canvas"); // the current page, without any press shading
const stillCtx = still.getContext("2d");
const mask = document.createElement("canvas");
const maskCtx = mask.getContext("2d", { willReadFrequently: true });
const backButton = document.getElementById("back");
const voice = createVoice(document.getElementById("flag"), SPEECH_RATE);

let width = 0, height = 0, dpr = 1;
let pageCache = {};
let trail = ["world"]; // the pages opened so far; the last one is on screen
let page = null;
let pressed = null;    // { shade(ctx) } while a touched place is dark
let busy = false;      // true while a name is being spoken before its page opens

const trace = (c, projection, shape) => { c.beginPath(); geoPath(projection, c)(shape); };

// A box drawn along lines of latitude and longitude, as points on the screen.
function boxRing(projection, [w, s, e, n]) {
  const pts = [];
  for (let lon = w; lon <= e; lon += 2) pts.push(projection([lon, s]));
  for (let lat = s; lat <= n; lat += 2) pts.push(projection([e, lat]));
  for (let lon = e; lon >= w; lon -= 2) pts.push(projection([lon, n]));
  for (let lat = n; lat >= s; lat -= 2) pts.push(projection([w, lat]));
  return pts;
}
function boxPoints([w, s, e, n]) {
  const coordinates = [];
  for (let lon = w; lon <= e; lon += 2) coordinates.push([lon, s], [lon, n]);
  for (let lat = s; lat <= n; lat += 2) coordinates.push([w, lat], [e, lat]);
  coordinates.push([e, n]);
  return { type: "MultiPoint", coordinates };
}

// ---- The largest whole flag that fits inside a shape -----------------------
// The shape is drawn small, then every position is tried for the biggest 4:3
// box that lies completely on land. Returns the box in screen px, or null.
function flagBoxInside(projection, shape, { avoid = [], maxWidth = Infinity } = {}) {
  const [[bx0, by0], [bx1, by1]] = geoPath(projection).bounds(shape);
  const x0 = Math.max(0, bx0), y0 = Math.max(0, by0), x1 = Math.min(width, bx1), y1 = Math.min(height, by1);
  const bw = x1 - x0, bh = y1 - y0;
  if (!(bw > 0 && bh > 0)) return null;                                    // off the page
  if (bw < 4 || bh < 4) return { middle: { x: x0 + bw / 2, y: y0 + bh / 2 }, w: 0, h: 0 }; // a speck
  const s = Math.min(1, 120 / Math.max(bw, bh));
  const W = Math.max(2, Math.ceil(bw * s)), H = Math.max(2, Math.ceil(bh * s));
  mask.width = W; mask.height = H;
  maskCtx.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
  trace(maskCtx, projection, shape);
  maskCtx.fillStyle = "#000"; maskCtx.fill();
  for (const r of avoid) maskCtx.clearRect(r.x, r.y, r.w, r.h); // keep clear of written names
  const alpha = maskCtx.getImageData(0, 0, W, H).data;

  const sums = new Int32Array((W + 1) * (H + 1));
  let cx = 0, cy = 0, count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const on = alpha[(y * W + x) * 4 + 3] > 250 ? 1 : 0;
      if (on) { cx += x; cy += y; count++; }
      sums[(y + 1) * (W + 1) + x + 1] = on + sums[y * (W + 1) + x + 1] + sums[(y + 1) * (W + 1) + x] - sums[y * (W + 1) + x];
    }
  }
  if (!count) return { middle: { x: x0 + bw / 2, y: y0 + bh / 2 }, w: 0, h: 0 }; // too thin to fill a dot
  cx /= count; cy /= count;
  const filled = (x, y, w, h) =>
    sums[(y + h) * (W + 1) + x + w] - sums[y * (W + 1) + x + w] - sums[(y + h) * (W + 1) + x] + sums[y * (W + 1) + x];
  // Of the boxes of this height that fit, the one nearest the middle of the land.
  const fit = h => {
    const w = Math.max(1, Math.round(h * 4 / 3));
    let best = null, bestD = Infinity;
    for (let y = 0; y + h <= H; y++) {
      for (let x = 0; x + w <= W; x++) {
        if (filled(x, y, w, h) !== w * h) continue;
        const d = (x + w / 2 - cx) ** 2 + (y + h / 2 - cy) ** 2;
        if (d < bestD) { bestD = d; best = { x, y, w, h }; }
      }
    }
    return best;
  };
  let lo = 1, hi = Math.min(H, Math.floor(W * 3 / 4), Math.floor(maxWidth * s * 0.75 / 0.88)), best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, f = fit(mid);
    if (f) { best = f; lo = mid + 1; } else hi = mid - 1;
  }
  const middle = { x: x0 + cx / s, y: y0 + cy / s };
  if (!best) return { middle, w: 0, h: 0 };
  // Pull in a little so the flag sits clear of the border.
  const w = best.w / s * 0.88, h = best.h / s * 0.88;
  return { middle, x: x0 + (best.x + best.w / 2) / s - w / 2, y: y0 + (best.y + best.h / 2) / s - h / 2, w, h };
}

function drawFlag(c, code, x, y, w, h, frame) {
  const f = flags[code];
  if (f) c.drawImage(f.image, x, y, w, h);
  else { c.fillStyle = "#fff"; c.fillRect(x, y, w, h); }
  c.lineWidth = frame ? 1.5 : 0.75;
  c.strokeStyle = frame ? "#fff" : "rgba(0, 0, 0, 0.3)";
  c.strokeRect(x, y, w, h);
  if (frame) { c.lineWidth = 0.75; c.strokeStyle = COLORS.outline; c.strokeRect(x - 1, y - 1, w + 2, h + 2); }
}

// ---- Reshaping a page so every country has room ---------------------------
// One screen axis is stretched where countries are crowded and squeezed where
// there is open sea or one large country. Order along the axis never changes.
// `spans` are [from, to, weight] in px. Returns the map and its reverse.
function axisMap(length, spans, strength) {
  const n = 120, bin = length / n;
  let d = new Float64Array(n);
  for (let [a, b, weight] of spans) {
    if (b < 0 || a > length) continue;
    if (b - a < bin * 3) { const mid = (a + b) / 2; a = mid - bin * 1.5; b = mid + bin * 1.5; }
    a = Math.max(0, a); b = Math.min(length, b);
    if (b <= a) continue;
    for (let i = Math.floor(a / bin); i < n && i * bin < b; i++) {
      const overlap = Math.min(b, (i + 1) * bin) - Math.max(a, i * bin);
      d[i] += weight * overlap / (b - a);
    }
  }
  for (let pass = 0; pass < 2; pass++) { // soften sharp changes
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) { sum += d[j]; count++; }
      out[i] = sum / count;
    }
    d = out;
  }
  const total = d.reduce((a, b) => a + b, 0);
  const knots = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    knots[i + 1] = knots[i] + (total ? strength * length * d[i] / total : 0) + (total ? 1 - strength : 1) * bin;
  }
  const forward = x => {
    if (x <= 0 || x >= length) return x;
    const i = Math.min(n - 1, Math.floor(x / bin));
    return knots[i] + (knots[i + 1] - knots[i]) * (x / bin - i);
  };
  const reverse = y => {
    if (y <= 0 || y >= length) return y;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (knots[mid] <= y) lo = mid; else hi = mid; }
    return (lo + (y - knots[lo]) / (knots[lo + 1] - knots[lo])) * bin;
  };
  return { forward, reverse };
}

// A projection followed by a reshaping of the screen.
function reshaped(projection, xs, ys) {
  const bend = geoTransform({ point(x, y) { this.stream.point(xs.forward(x), ys.forward(y)); } });
  return {
    stream: s => projection.stream(bend.stream(s)),
    project(point) { const p = projection(point); return p && [xs.forward(p[0]), ys.forward(p[1])]; },
    invert([x, y]) { return projection.invert([xs.reverse(x), ys.reverse(y)]); },
  };
}

// ---- Page: the world ------------------------------------------------------
function worldPage() {
  // A plain rectangle of the world that fills the whole screen. The continents
  // are then given more of it, and open ocean and the poles less.
  const flat = geoEquirectangular().rotate([-11, 0]).fitSize([width, width / 2], { type: "Sphere" });
  const tall = height / (width / 2);
  const russia = placeNamed("Russia");
  const own = p => !p.continents.length || WORLD_OWN.includes(p.name); // says its own name here
  // Every continent gets the same say in how the screen is shared, however
  // many countries it has; within a continent, larger countries count for more.
  const across = [], down = [];
  const measure = geoPath(flat);
  const totals = {};
  const sized = [];
  for (const p of places) {
    if (own(p) || !p.name) continue;
    p.patches ??= patchesFor(p.shape, p.flag);
    const main = p.patches[0].shape;
    const [cx, cy] = measure.centroid(main), r = Math.sqrt(measure.area(main)) * 0.6;
    if (!Number.isFinite(cx)) continue;
    const id = p.continents[0];
    totals[id] = (totals[id] || 0) + r * r;
    sized.push({ id, cx, cy, r });
  }
  for (const { id, cx, cy, r } of sized) {
    const weight = r * r / totals[id];
    across.push([cx - r, cx + r, weight]);
    down.push([(cy - r) * tall, (cy + r) * tall, weight]);
  }
  const xs = axisMap(width, across, WORLD_SPREAD), stretch = axisMap(height, down, WORLD_SPREAD);
  const ys = { forward: y => stretch.forward(y * tall), reverse: y => stretch.reverse(y) / tall };
  const projection = reshaped(flat, xs, ys);
  const europeBox = [0, 30, EUROPE_ENDS_AT, 89];

  // Written names, and the space each one takes.
  const size = Math.max(0.7, Math.min(1.25, width / 1024));
  const labels = WORLD_LABELS.map(l => {
    const [x, y] = projection.project(l.at);
    const font = l.water ? `italic 500 ${13 * size}px ${FONT}` : `600 ${15 * size}px ${FONT}`;
    ctx.font = font;
    const w = ctx.measureText(l.text).width + 8, h = (l.water ? 13 : 15) * size + 8;
    return { ...l, x, y, font, box: { x: x - w / 2, y: y - h / 2, w, h } };
  });
  const avoid = labels.filter(l => !l.water).map(l => l.box);
  const worldFlags = WORLD_FLAGS.map(placeNamed).filter(Boolean).map(p => {
    p.patches ??= patchesFor(p.shape, p.flag);
    const box = flagBoxInside(projection, p.patches[0].shape, { avoid, maxWidth: WORLD_FLAG_MAX * size });
    return box && box.w >= MIN_FLAG ? { place: p, ...box } : null;
  }).filter(Boolean);

  // Russia is in two continents: run `draw` for only the part in one of them.
  function russiaPart(c, continent, draw) {
    const ring = boxRing(p => projection.project(p), europeBox);
    c.save();
    c.beginPath();
    if (continent === "asia") c.rect(0, 0, width, height);
    ring.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip("evenodd");
    draw();
    c.restore();
  }
  function fillContinent(c, id, style) {
    c.fillStyle = style;
    for (const p of places) {
      if (!p.continents.includes(id)) continue;
      const fill = () => { trace(c, projection, p.shape); c.fill(); };
      if (p === russia) russiaPart(c, id, fill);
      else if (p.continents[0] === id && !own(p)) fill();
    }
  }

  return {
    render(c) {
      c.fillStyle = COLORS.ocean; c.fillRect(0, 0, width, height);
      c.fillStyle = COLORS.noContinent;
      for (const p of places) if (own(p)) { trace(c, projection, p.shape); c.fill(); }
      for (const id of Object.keys(CONTINENTS)) fillContinent(c, id, CONTINENTS[id].color);
      c.lineWidth = 0.6; c.lineJoin = "round";
      for (const p of places) {
        trace(c, projection, p.shape);
        c.strokeStyle = own(p) ? COLORS.outline : COLORS.worldBorder;
        c.stroke();
      }
      for (const f of worldFlags) drawFlag(c, f.place.flag, f.x, f.y, f.w, f.h, false);
      c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
      for (const l of labels) {
        c.font = l.font;
        if (!l.water) { c.lineWidth = 3.5; c.strokeStyle = "rgba(255, 255, 255, 0.6)"; c.strokeText(l.text, l.x, l.y); }
        c.fillStyle = l.water ? COLORS.waterName : COLORS.landName;
        c.fillText(l.text, l.x, l.y);
      }
    },
    hit(x, y) {
      const point = projection.invert([x, y]);
      if (!point) return null;
      const p = placeAt(point);
      if (!p) return waterTarget(waterAt(point), x, y);
      if (!p.name) return null;
      if (own(p)) {
        return { say: { name: p.name }, shade: c => { trace(c, projection, p.shape); c.fillStyle = COLORS.pressed; c.fill(); } };
      }
      const id = p === russia ? (point[0] >= 0 && point[0] < EUROPE_ENDS_AT ? "europe" : "asia") : p.continents[0];
      return { say: { name: CONTINENTS[id].name }, open: id, shade: c => fillContinent(c, id, COLORS.pressed) };
    },
    debug: { projection: p => projection.project(p) },
  };
}

function waterTarget(name, x, y) {
  return {
    say: { name, keepFlag: true },
    shade: c => { c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fillStyle = "rgba(0, 0, 0, 0.16)"; c.fill(); },
  };
}

// ---- Page: one continent --------------------------------------------------
function continentPage(id) {
  const def = CONTINENTS[id];
  const flat = geoAzimuthalEqualArea().rotate([-def.centre[0], -def.centre[1]]).clipAngle(88)
    .fitExtent([[14, 14], [width - 14, height - 14]], boxPoints(def.frame))
    .clipExtent([[-2, -2], [width + 2, height + 2]]);
  const members = places.filter(p => p.name && p.continents.includes(id));

  // Give each country a similar share of the screen, whatever its real size.
  const across = [], down = [];
  for (const p of members) {
    p.patches ??= patchesFor(p.shape, p.flag);
    const [[x0, y0], [x1, y1]] = geoPath(flat).bounds(p.patches[0].shape);
    if (!(x1 > 0 && x0 < width && y1 > 0 && y0 < height)) continue;
    // A large country counts for more than a small one, but far less than its real size.
    const big = Math.max(1, Math.min(BIG_SHARE, Math.sqrt((x1 - x0) * (y1 - y0)) / 45));
    const weight = p.marker ? big : 0.25;
    across.push([x0, x1, weight]); down.push([y0, y1, weight]);
  }
  const projection = reshaped(flat, axisMap(width, across, SPREAD), axisMap(height, down, SPREAD));
  const opens = Object.fromEntries(Object.entries(STATE_PAGES).filter(([, s]) => s.parent === id).map(([k, s]) => [s.country, k]));

  // Where each country's flag goes: whole, inside the border where it fits,
  // otherwise as a small marker beside it.
  const inside = []; // { place, x, y, w, h }
  const badges = []; // { place, x, y, w, h, ax, ay }
  for (const p of members) {
    p.patches ??= patchesFor(p.shape, p.flag);
    let drawn = false, anchor = null;
    for (const patch of p.patches) {
      const box = flagBoxInside(projection, patch.shape);
      if (!box) continue;
      if (box.w >= MIN_FLAG) { inside.push({ place: p, ...box }); drawn = true; }
      else anchor ??= box.middle; // patches come largest first
    }
    if (!drawn && p.marker && anchor && anchor.x > 0 && anchor.x < width && anchor.y > 0 && anchor.y < height) {
      badges.push({ place: p, w: BADGE[0], h: BADGE[1], x: anchor.x - BADGE[0] / 2, y: anchor.y - BADGE[1] / 2, ax: anchor.x, ay: anchor.y });
    }
  }
  // Nudge markers apart so no flag sits on top of another.
  const gap = 4;
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < badges.length; i++) {
      for (let j = i + 1; j < badges.length; j++) {
        const a = badges[i], b = badges[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) { const d = ox / 2 * (a.x <= b.x ? 1 : -1); a.x -= d; b.x += d; }
        else { const d = oy / 2 * (a.y <= b.y ? 1 : -1); a.y -= d; b.y += d; }
      }
    }
    for (const b of badges) {
      b.x = Math.max(4, Math.min(width - b.w - 4, b.x));
      b.y = Math.max(4, Math.min(height - b.h - 4, b.y));
    }
    if (!moved) break;
  }

  function target(p) {
    const badge = badges.find(b => b.place === p);
    return {
      say: { name: p.name, flag: p.flag },
      open: opens[p.name],
      shade: c => {
        c.fillStyle = COLORS.pressed;
        trace(c, projection, p.shape); c.fill();
        if (badge) c.fillRect(badge.x, badge.y, badge.w, badge.h);
      },
    };
  }

  return {
    parent: "world",
    render(c) {
      c.fillStyle = COLORS.ocean; c.fillRect(0, 0, width, height);
      c.lineWidth = 0.75; c.lineJoin = "round"; c.strokeStyle = COLORS.outline;
      for (const p of places) {
        if (members.includes(p)) continue;
        trace(c, projection, p.shape);
        c.fillStyle = COLORS.otherLand; c.fill(); c.stroke();
      }
      for (const p of members) {
        trace(c, projection, p.shape);
        c.fillStyle = COLORS.land; c.fill(); c.stroke();
      }
      for (const f of inside) drawFlag(c, f.place.flag, f.x, f.y, f.w, f.h, false);
      c.strokeStyle = COLORS.leader; c.lineWidth = 0.75;
      for (const b of badges) {
        const mx = b.x + b.w / 2, my = b.y + b.h / 2;
        if (Math.hypot(mx - b.ax, my - b.ay) < 8) continue;
        c.beginPath(); c.moveTo(b.ax, b.ay); c.lineTo(mx, my); c.stroke();
      }
      for (const b of badges) drawFlag(c, b.place.flag, b.x, b.y, b.w, b.h, true);
    },
    hit(x, y) {
      for (const b of badges) {
        if (x >= b.x - 5 && x <= b.x + b.w + 5 && y >= b.y - 5 && y <= b.y + b.h + 5) return target(b.place);
      }
      const point = projection.invert([x, y]);
      if (!point) return null;
      const p = placeAt(point);
      if (!p) return waterTarget(waterAt(point), x, y);
      return members.includes(p) ? target(p) : null; // land from another page is silent
    },
    debug: { inside, badges, projection: p => projection.project(p) },
  };
}

// ---- Page: the states or provinces of one country -------------------------
function statesPage(id) {
  const def = STATE_PAGES[id];
  const country = placeNamed(def.country);
  const geometries = def.topo.objects.states.geometries;
  const states = feature(def.topo, def.topo.objects.states).features;
  const projection = def.projection()
    .fitExtent([[28, 28], [width - 28, height - 28]], { type: "FeatureCollection", features: states });
  const path = geoPath(projection);

  // Neighbouring states never share a colour.
  const next = neighbors(geometries);
  const colour = [];
  states.forEach((_, i) => {
    const taken = new Set(next[i].map(j => colour[j]));
    colour[i] = STATE_COLORS.findIndex((_, k) => !taken.has(k));
    if (colour[i] < 0) colour[i] = i % STATE_COLORS.length;
  });

  const items = states.map((shape, i) => {
    const [[x0, y0], [x1, y1]] = path.bounds(shape);
    const [cx, cy] = path.centroid(shape);
    return { shape, name: shape.properties.name, color: STATE_COLORS[colour[i]], cx, cy,
             tiny: Math.min(x1 - x0, y1 - y0) < TINY_STATE, bounds: geoBounds(shape),
             box: [x0, y0, x1, y1],
             islands: shape.geometry.type === "MultiPolygon" && (x1 - x0) * (y1 - y0) < 14000 };
  });
  const tiny = items.filter(s => s.tiny && Number.isFinite(s.cx));
  const dot = (c, s) => { c.beginPath(); c.arc(s.cx, s.cy, 10, 0, Math.PI * 2); };

  function target(s) {
    return {
      say: { name: s.name, flag: country.flag },
      shade: c => {
        c.fillStyle = COLORS.pressed;
        trace(c, projection, s.shape); c.fill();
        if (s.tiny) { dot(c, s); c.fill(); }
      },
    };
  }

  return {
    parent: def.parent,
    render(c) {
      c.fillStyle = COLORS.ocean; c.fillRect(0, 0, width, height);
      c.lineJoin = "round"; c.lineWidth = 1; c.strokeStyle = "#fff";
      for (const s of items) { trace(c, projection, s.shape); c.fillStyle = s.color; c.fill(); c.stroke(); }
      // A round marker makes the smallest ones possible to touch.
      for (const s of tiny) {
        dot(c, s); c.fillStyle = s.color; c.fill();
        c.lineWidth = 1.5; c.strokeStyle = "#fff"; c.stroke();
        c.lineWidth = 0.75; c.strokeStyle = COLORS.outline;
        c.beginPath(); c.arc(s.cx, s.cy, 11, 0, Math.PI * 2); c.stroke();
      }
    },
    hit(x, y) {
      let near = null, nearD = 18;
      for (const s of tiny) {
        const d = Math.hypot(s.cx - x, s.cy - y);
        if (d < nearD) { near = s; nearD = d; }
      }
      if (near) return target(near);
      const point = projection.invert([x, y]);
      if (!point) return null;
      const s = items.find(k => inBounds(k.bounds, point) && geoContains(k.shape, point));
      if (s) return target(s);
      // A touch between the islands of a small island group still counts.
      const around = items.filter(k => k.islands && x >= k.box[0] - 8 && x <= k.box[2] + 8 && y >= k.box[1] - 8 && y <= k.box[3] + 8);
      return around.length === 1 ? target(around[0]) : null;
    },
    debug: { items, projection },
  };
}

// ---- Showing pages --------------------------------------------------------
function pageFor(id) {
  return pageCache[id] ??= id === "world" ? worldPage() : CONTINENTS[id] ? continentPage(id) : statesPage(id);
}

function present() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(still, 0, 0);
  ctx.restore();
  if (pressed) pressed.shade(ctx);
}

function show() {
  const id = trail[trail.length - 1];
  page = pageFor(id);
  stillCtx.clearRect(0, 0, width, height);
  page.render(stillCtx);
  backButton.hidden = trail.length < 2;
  present();
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
  pageCache = {};
  show();
}

// ---- Touch ----------------------------------------------------------------
let finger = null; // { id, x, y }
let pressTimer = 0;
const wait = ms => new Promise(done => setTimeout(done, ms));

async function touch(x, y) {
  if (busy) return;
  const t = page.hit(x, y);
  if (!t) return;
  const spoken = voice.say(t.say);
  pressed = t;
  present();
  clearTimeout(pressTimer);
  if (!t.open) {
    pressTimer = setTimeout(() => { pressed = null; present(); }, PRESS_MS);
    return;
  }
  // A group: say its name first, then open its page.
  busy = true;
  await Promise.all([wait(PRESS_MS), Promise.race([spoken, wait(OPEN_WAIT_MS)])]);
  pressed = null;
  trail.push(t.open);
  show();
  busy = false;
}

canvas.addEventListener("pointerdown", e => {
  if (finger) return; // one finger at a time; a resting palm is ignored
  finger = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
function lift(e, cancelled) {
  if (!finger || finger.id !== e.pointerId) return;
  const f = finger;
  finger = null;
  if (!cancelled && Math.hypot(e.clientX - f.x, e.clientY - f.y) <= TAP_SLOP) touch(f.x, f.y);
}
canvas.addEventListener("pointerup", e => lift(e, false));
canvas.addEventListener("pointercancel", e => lift(e, true));

backButton.addEventListener("click", () => {
  if (busy || trail.length < 2) return;
  trail.pop();
  clearTimeout(pressTimer);
  pressed = null;
  if (trail.length === 1) voice.hideFlag();
  show();
});

// Keep Safari's own zoom, menus and text selection out of the way.
for (const type of ["gesturestart", "gesturechange", "gestureend", "contextmenu", "dblclick", "selectstart"]) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}

window.addEventListener("resize", resize);
resize();
flagsReady.then(show);

// For checks from the browser console.
window.__map = {
  places, waterAt, flagsReady,
  page: () => page, trail: () => [...trail],
  go(ids) { trail = ["world", ...ids]; show(); },
  hitAt(lonLat) { const [x, y] = page.debug.projection(lonLat); return page.hit(x, y); },
};
