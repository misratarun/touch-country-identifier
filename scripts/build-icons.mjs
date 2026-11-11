// Draws the home-screen icon: a piece of the map in the app's own colours.
// Run with `npm run icons`; writes PNG files to public/icons/.
import { readFileSync, mkdirSync } from "node:fs";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import sharp from "sharp";

const atlas = JSON.parse(readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
const rows = JSON.parse(readFileSync("src/countries.json", "utf8"));
const atlas50 = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const continentOf = {};
atlas50.objects.countries.geometries.forEach((g, i) => { continentOf[g.properties.name] = rows[i].continent; });

const COLORS = { "north-america": "#d3bf9c", "south-america": "#a9b99b", europe: "#b7abc9",
                 africa: "#dcc48d", asia: "#cfa399", oceania: "#9dbab4" };
const SIZE = 1024;
// Centred on the Atlantic so four continents show.
const projection = geoEquirectangular().rotate([25, 0]).scale(SIZE / 3.1).translate([SIZE / 2, SIZE / 2 + 70]);
const path = geoPath(projection);
const land = feature(atlas, atlas.objects.countries).features
  .filter(f => f.properties.name !== "Antarctica")
  .map(f => `<path d="${path(f)}" fill="${COLORS[continentOf[f.properties.name]] || "#f6f6f3"}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="#cfdbe0"/>${land}</svg>`;

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [["icon-512", 512], ["icon-192", 192], ["apple-touch-icon", 180]]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}.png`);
  console.log(`public/icons/${name}.png`);
}
