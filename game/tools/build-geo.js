const path = process.argv[2], out = process.argv[3];
const M = p => require(require.resolve(p, { paths: [path] }));
const topo = M('world-atlas/countries-50m.json');
const { feature } = M('topojson-client');
const iso = M('i18n-iso-countries');
const fallback = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO', 'Indian Ocean Ter.': 'IO', 'Ashmore and Cartier Is.': 'AU', 'Siachen Glacier': 'IN' };
const fc = feature(topo, topo.objects.countries);
const byCode = {};
const r = v => Math.round(v * 100) / 100;
for (const f of fc.features) {
  let code = f.id ? iso.numericToAlpha2(f.id) : null;
  if (!code) code = fallback[f.properties.name];
  if (!code) { console.error('skip', f.id, f.properties.name); continue; }
  const g = f.geometry; if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const rings = byCode[code] || (byCode[code] = []);
  for (const poly of polys) {
    const ring = poly[0]; const flat = [];
    let lx = null, ly = null;
    for (const [x, y] of ring) { const a = r(x), b = r(y); if (a === lx && b === ly) continue; flat.push(a, b); lx = a; ly = b; }
    if (flat.length < 8) continue;
    let jumps = 0;
    for (let k = 2; k < flat.length; k += 2) if (Math.abs(flat[k] - flat[k - 2]) > 180) jumps++;
    if (jumps >= 2) {
      // Ring crosses the 180th meridian: store two continuous copies, one per side.
      const east = flat.map((v, k) => k % 2 === 0 && v < 0 ? r(v + 360) : v);
      rings.push(east, east.map((v, k) => k % 2 === 0 ? r(v - 360) : v));
    } else rings.push(flat);
  }
}
const list = Object.entries(byCode).filter(([, r]) => r.length).map(([c, p]) => ({ c, p }));
require('fs').writeFileSync(out, JSON.stringify(list));
console.log(list.length, 'countries', (require('fs').statSync(out).size / 1024 | 0) + 'KB');
