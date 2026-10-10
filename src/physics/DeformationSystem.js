// Deliberately artistic, dimensionless deformation. No material/ballistic solver.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export function noise(x, y, seed = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
export function fractureRadius(angle, hit) {
  return hit.holeRadius * (1 + .15 * Math.sin(angle * 7 + hit.seed) + .09 * Math.sin(angle * 11 - hit.seed * 2) + .07 * Math.sin(angle * 3 + 1));
}
export function isRemoved(x, y, hits) {
  return hits.some(hit => {
    if (!hit.hole || hit.progress < .32) return false;
    const dx = x - hit.x, dy = y - hit.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const growth = smooth((hit.progress - .32) / .68);
    const edge = fractureRadius(a, hit) * growth;
    // Narrow irregular radial tears, grown outward from the open aperture.
    const tear = Math.pow(Math.max(0, Math.cos(a * 5 + hit.seed)), 34) * hit.holeRadius * .48 * growth;
    return r < edge + tear;
  });
}
export function sampleSurface(x, y, width, height, thickness, hits, back = false) {
  let z = back ? -thickness / 2 : thickness / 2;
  let dx = 0, dy = 0, heat = 0, strain = 0, fresh = 0;
  const edgeFade = smooth(Math.min((width / 2 - Math.abs(x)) / .36, (height / 2 - Math.abs(y)) / .36));
  for (const hit of hits) {
    const rx = x - hit.x, ry = y - hit.y, r = Math.hypot(rx, ry), angle = Math.atan2(ry, rx);
    const p = smooth(hit.progress), q = r / hit.radius;
    const bowl = Math.exp(-q * q * 2.6);
    const bow = Math.exp(-q * q * .43) * .14;
    const rim = Math.exp(-Math.pow((q - .92) / .22, 2)) * .11;
    let dent = hit.depth * (bowl + bow - rim);
    if (hit.hole) {
      const boundary = fractureRadius(angle, hit);
      const lip = Math.exp(-Math.pow((r - boundary) / (hit.radius * .16), 2));
      const petal = .36 + .64 * Math.pow(.5 + .5 * Math.sin(angle * 7 + hit.seed), 2);
      dent += hit.depth * lip * petal * (((hit.pushSign ?? -1) < 0 ? back : !back) ? .72 : .54);
      const radial = lip * .065 * petal * p * edgeFade;
      dx += Math.cos(angle) * radial; dy += Math.sin(angle) * radial;
      fresh = Math.max(fresh, lip * p);
    }
    // The original outer frame stays held, while the interior bends and stretches.
    z += (hit.pushSign ?? -1) * dent * p * edgeFade;
    dx += hit.shearX * bowl * p * edgeFade;
    dy += hit.shearY * bowl * p * edgeFade;
    heat = Math.max(heat, Math.exp(-q * q * (hit.type === 'jet' ? 3.1 : 4.8)) * p);
    strain = Math.max(strain, bowl * p);
  }
  return { x: x + dx, y: y + dy, z, heat, strain, fresh };
}
export function makeGrid(width, height, seed, nx = 72) {
  const ny = Math.max(32, Math.round(nx * height / width));
  const points = [], triangles = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const border = i === 0 || j === 0 || i === nx || j === ny;
    points.push({x: (i / nx - .5) * width + (border ? 0 : (noise(i, j, seed) - .5) * width / nx * .48), y: (j / ny - .5) * height + (border ? 0 : (noise(j, i, seed + 5) - .5) * height / ny * .48)});
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    if ((i + j) % 2) triangles.push([a,b,c],[b,d,c]);
    else triangles.push([a,b,d],[a,d,c]);
  }
  return {points, triangles};
}
export function activeTopology(grid, hits, sectionX = null) {
  const faces = [], edges = new Map();
  for (const tri of grid.triangles) {
    const x = tri.reduce((s, i) => s + grid.points[i].x / 3, 0);
    const y = tri.reduce((s, i) => s + grid.points[i].y / 3, 0);
    if (isRemoved(x, y, hits) || (sectionX !== null && x > sectionX)) continue;
    faces.push(tri);
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edges.has(key)) edges.delete(key); else edges.set(key, [a,b]);
    }
  }
  return {faces, boundary: [...edges.values()]};
}
export function createImpact({x, y, power, thickness, type, incidence, seed, previous = [], direction}) {
  const stress = previous.reduce((s,h) => s + Math.exp(-(Math.hypot(x-h.x,y-h.y)**2) / (h.radius*h.radius)) * .055, 0);
  const ricochet = type !== 'jet' && incidence < .43;
  const threshold = thickness * .9 + (type === 'ball' ? .58 : type === 'jet' ? .20 : .29) - Math.min(.22, stress);
  const hole = !ricochet && power * Math.max(.45, incidence) > threshold;
  const radius = (type === 'ball' ? 1.05 : type === 'jet' ? .59 : .81) * (.65 + power * .64);
  return {x,y,type,seed,progress:0,hole,ricochet,radius,pushSign:direction?.z > 0 ? 1 : -1,
    holeRadius: (type === 'jet' ? .15 : type === 'ball' ? .30 : .22) + power * (type === 'jet' ? .10 : .27),
    depth: (.16 + power * .77) * (ricochet ? .25 : 1) * (type === 'jet' ? .68 : 1),
    shearX: clamp(direction?.x || 0, -1, 1) * .16,
    shearY: clamp(direction?.y || 0, -1, 1) * .16};
}
