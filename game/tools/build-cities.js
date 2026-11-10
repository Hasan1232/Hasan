// Builds data/cities.json from the all-the-cities package (GeoNames, CC BY 4.0).
// Keeps each country's capital plus its largest cities.
// Usage: node tools/build-cities.js <dir containing node_modules> data/cities.json
const dir = process.argv[2], out = process.argv[3];
const cities = require(require.resolve('all-the-cities', { paths: [dir] }));
const byCountry = new Map();
for (const c of cities) {
  if (!c.country) continue;
  (byCountry.get(c.country) || byCountry.set(c.country, []).get(c.country)).push(c);
}
const r = v => Math.round(v * 100) / 100;
const rows = [];
for (const [cc, list] of byCountry) {
  list.sort((a, b) => b.population - a.population);
  const cap = list.find(c => c.featureCode === 'PPLC');
  const keep = new Set(cap ? [cap] : []);
  for (const c of list) {
    if (keep.size >= 6) break;
    if (c.population >= 150000 || keep.size === 0) keep.add(c);
  }
  for (const c of keep) {
    const [lon, lat] = c.loc.coordinates;
    rows.push([c.name, cc, r(lon), r(lat), c.population, c === cap ? 1 : 0]);
  }
}
require('fs').writeFileSync(out, JSON.stringify(rows));
console.log(rows.length, 'cities', (require('fs').statSync(out).size / 1024 | 0) + 'KB');
