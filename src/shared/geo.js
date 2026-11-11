import { geoArea, geoCentroid, geoDistance } from "d3-geo";

const RAD = Math.PI / 180;

// Quick reject before an exact test. Bounds that wrap the date line have west > east.
export function inBounds([[w, s], [e, n]], [lon, lat]) {
  if (lat < s - 0.01 || lat > n + 0.01) return false;
  return w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w - 0.01 || lon <= e + 0.01;
}

function ringReach(centre, ring) {
  const step = Math.max(1, Math.floor(ring.length / 40));
  let reach = 0;
  for (let i = 0; i < ring.length; i += step) reach = Math.max(reach, geoDistance(centre, ring[i]));
  return reach;
}

// Splits a country into patches of land that sit together, so that land far
// from the rest (Alaska, Hawaii) can be given its own flag.
export function patchesFor(geometry, flag) {
  const polys = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).map(coordinates => {
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
