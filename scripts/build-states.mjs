// Builds src/data/states-*.json: state and province outlines for the countries
// that can be opened one level further.
//
// Source: Natural Earth "Admin 1 – States, Provinces", 1:50m (public domain).
//   https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson
// Usage: node scripts/build-states.mjs path/to/ne_50m_admin_1_states_provinces.geojson
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { topology } from "topojson-server";

const source = process.argv[2];
if (!source) { console.error("Give the path to the Natural Earth admin-1 GeoJSON file."); process.exit(1); }
const all = JSON.parse(readFileSync(source, "utf8")).features;

const COUNTRIES = { USA: "usa", CAN: "canada", IND: "india" };
// Map-file name -> name as it should be said aloud.
const SPOKEN = {
  "Québec": "Quebec",
  "District of Columbia": "Washington D.C.",
  "Andaman and Nicobar": "Andaman and Nicobar Islands",
};

mkdirSync("src/data", { recursive: true });
for (const [code, file] of Object.entries(COUNTRIES)) {
  const features = all.filter(f => f.properties.adm0_a3 === code).map(f => ({
    type: "Feature",
    properties: { name: SPOKEN[f.properties.name] || f.properties.name },
    geometry: f.geometry,
  })).sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  const topo = topology({ states: { type: "FeatureCollection", features } }, 1e5);
  writeFileSync(`src/data/states-${file}.json`, JSON.stringify(topo));
  console.log(`${file}: ${features.length} regions`);
}
