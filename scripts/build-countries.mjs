// Builds src/countries.json: one row per shape in the map file, with the name
// to speak and the flag to show. Run with `npm run countries` after editing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import iso from "i18n-iso-countries";
import { createRequire } from "node:module";
const world = createRequire(import.meta.url)("world-countries");

const atlas = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));

// Map-file name -> name as it should be said aloud.
const SPOKEN = {
  "United States of America": "United States",
  "Vatican": "Vatican City",
  "Marshall Is.": "Marshall Islands",
  "N. Mariana Is.": "Northern Mariana Islands",
  "U.S. Virgin Is.": "U.S. Virgin Islands",
  "S. Geo. and the Is.": "South Georgia",
  "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
  "Pitcairn Is.": "Pitcairn Islands",
  "Falkland Is.": "Falkland Islands",
  "Cayman Is.": "Cayman Islands",
  "British Virgin Is.": "British Virgin Islands",
  "Turks and Caicos Is.": "Turks and Caicos Islands",
  "Timor-Leste": "East Timor",
  "eSwatini": "Eswatini",
  "S. Sudan": "South Sudan",
  "Solomon Is.": "Solomon Islands",
  "São Tomé and Principe": "Sao Tome and Principe",
  "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "Cook Is.": "Cook Islands",
  "Curaçao": "Curacao",
  "W. Sahara": "Western Sahara",
  "Macedonia": "North Macedonia",
  "St. Pierre and Miquelon": "Saint Pierre and Miquelon",
  "Wallis and Futuna Is.": "Wallis and Futuna",
  "St-Martin": "Saint Martin",
  "St-Barthélemy": "Saint Barthelemy",
  "Fr. Polynesia": "French Polynesia",
  "Fr. S. Antarctic Lands": "French Southern Lands",
  "Åland": "Aland Islands",
  "Eq. Guinea": "Equatorial Guinea",
  "Dominican Rep.": "Dominican Republic",
  "Faeroe Is.": "Faroe Islands",
  "Czechia": "Czech Republic",
  "Côte d'Ivoire": "Ivory Coast",
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
  "Congo": "Republic of the Congo",
  "Central African Rep.": "Central African Republic",
  "Cabo Verde": "Cape Verde",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Heard I. and McDonald Is.": "Heard Island",
  "Antigua and Barb.": "Antigua and Barbuda",
  "Macao": "Macau",
};

// Shapes with no country code of their own. `as` folds a shape into another
// country; `silent` leaves it as land that says nothing.
const SPECIAL = {
  "Kosovo": { iso2: "xk" },
  "Somaliland": { as: "Somalia" },
  "N. Cyprus": { as: "Cyprus" },
  "Indian Ocean Ter.": { as: "Australia" },
  "Ashmore and Cartier Is.": { as: "Australia" },
  "Siachen Glacier": { silent: true },
};

// Which continent page a country sits on. Antarctica and a few remote islands
// have none: they are not behind any continent.
const CONTINENT = Object.fromEntries(world.map(c => [c.cca2.toLowerCase(),
  c.region === "Americas" ? (c.subregion === "South America" ? "south-america" : "north-america")
  : { Europe: "europe", Africa: "africa", Asia: "asia", Oceania: "oceania" }[c.region] || null]));
Object.assign(CONTINENT, { xk: "europe", gs: null, tf: null, hm: null, io: null, sh: null });

// Dependent territories that are too small to hold a flag get no flag marker,
// which keeps crowded pages readable. They still speak when touched.
const SOVEREIGN = Object.fromEntries(world.map(c => [c.cca2.toLowerCase(), !!c.independent || !!c.unMember]));
Object.assign(SOVEREIGN, { xk: true, tw: true, ps: true, va: true, pr: true });

const geoms = atlas.objects.countries.geometries;
const byName = Object.fromEntries(geoms.map(g => [g.properties.name, g]));
const rows = [];
const problems = [];

geoms.forEach((g, index) => {
  const mapName = g.properties.name;
  const special = SPECIAL[mapName] || {};
  if (special.silent) { rows.push({ index, name: null, flag: null, continent: null, marker: false }); return; }
  const src = special.as ? byName[special.as] : g;
  const srcName = src.properties.name;
  const iso2 = (SPECIAL[srcName]?.iso2 || iso.numericToAlpha2(src.id) || "").toLowerCase();
  if (!iso2 || !existsSync(`node_modules/flag-icons/flags/4x3/${iso2}.svg`)) problems.push(mapName);
  rows.push({ index, name: SPOKEN[srcName] || srcName, flag: iso2 || null, continent: CONTINENT[iso2] ?? null, marker: !!SOVEREIGN[iso2] });
});

writeFileSync("src/countries.json", JSON.stringify(rows, null, 0).replace(/\},/g, "},\n") + "\n");
console.log(`${rows.length} shapes written.`, problems.length ? "No flag for: " + problems.join(", ") : "Every shape has a flag.");
const lost = rows.filter(r => r.name && !r.continent).map(r => r.name);
console.log("On no continent page:", lost.join(", "));
const odd = rows.filter(r => r.name && /[.]|[^\x00-\x7f]/.test(r.name)).map(r => r.name);
if (odd.length) console.log("Names that still look abbreviated:", odd.join(", "));
