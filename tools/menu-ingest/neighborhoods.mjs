// Seattle neighborhoods the daily job keeps covered (see seed.mjs). Each has one to three points, about a mile apart, so a
// dense neighborhood gets more than one search. Coordinates are approximate (a point only has to land in the right ~1 mile
// grid cell). Order = priority: where bars and restaurants are densest come first, so a budget that runs out mid-pass
// still covers the places people look for happy hours.
// Pure data and helpers, no network (tested in src/lib/food/neighborhoods.test.ts).

export const NEIGHBORHOODS = [
  { name: "Capitol Hill", points: [[47.6205, -122.3212], [47.6230, -122.3120]] },
  { name: "Pike/Pine", points: [[47.6140, -122.3190]] },
  { name: "Ballard", points: [[47.6685, -122.3845], [47.6780, -122.3760]] },
  { name: "Fremont", points: [[47.6510, -122.3500]] },
  { name: "Belltown", points: [[47.6148, -122.3450]] },
  { name: "Pike Place Market", points: [[47.6097, -122.3422]] },
  { name: "Downtown Seattle", points: [[47.6070, -122.3350]] },
  { name: "Seattle Waterfront", points: [[47.6055, -122.3400]] },
  { name: "Pioneer Square", points: [[47.6015, -122.3343]] },
  { name: "South Lake Union", points: [[47.6256, -122.3375]] },
  { name: "Denny Triangle", points: [[47.6190, -122.3370]] },
  { name: "University District", points: [[47.6615, -122.3135]] },
  { name: "Wallingford", points: [[47.6615, -122.3350]] },
  { name: "Queen Anne", points: [[47.6375, -122.3570], [47.6237, -122.3560]] },
  { name: "Green Lake", points: [[47.6800, -122.3290]] },
  { name: "Phinney Ridge", points: [[47.6760, -122.3540]] },
  { name: "Northgate", points: [[47.7063, -122.3254]] },
  { name: "First Hill", points: [[47.6090, -122.3240]] },
  { name: "Chinatown-International District", points: [[47.5985, -122.3250]] },
  { name: "Yesler Terrace", points: [[47.6020, -122.3180]] },
  { name: "Central District", points: [[47.6070, -122.3010]] },
  { name: "Madison Valley", points: [[47.6165, -122.2955]] },
  { name: "Harrison/Denny-Blaine", points: [[47.6240, -122.2900]] },
  { name: "Montlake", points: [[47.6400, -122.3050]] },
  { name: "Judkins Park", points: [[47.5950, -122.3000]] },
  { name: "Leschi", points: [[47.6000, -122.2850]] },
  { name: "SODO", points: [[47.5800, -122.3350]] },
  { name: "Interbay", points: [[47.6450, -122.3750]] },
  { name: "West Seattle", points: [[47.5612, -122.3868], [47.5810, -122.3860]] },
  { name: "Alki", points: [[47.5763, -122.4090]] },
  { name: "Delridge", points: [[47.5600, -122.3600]] },
  { name: "South Seattle", points: [[47.5790, -122.3110], [47.5480, -122.3190], [47.5600, -122.2860]] },
  { name: "Rainier Valley", points: [[47.5770, -122.2970], [47.5380, -122.2810]] },
  { name: "New Holly", points: [[47.5430, -122.2830]] },
  { name: "Seward Park", points: [[47.5500, -122.2570]] },
  { name: "Rainier Beach", points: [[47.5220, -122.2680]] },
  { name: "Sand Point", points: [[47.6850, -122.2630]] },
  { name: "View Ridge", points: [[47.6830, -122.2790]] },
  { name: "Matthews Beach", points: [[47.7000, -122.2760]] },
  { name: "Eastlake", points: [[47.6400, -122.3250]] },
  { name: "East Queen Anne", points: [[47.6340, -122.3500]] },
  { name: "North Queen Anne", points: [[47.6490, -122.3570]] },
  { name: "West Woodland", points: [[47.6700, -122.3590]] },
  { name: "Loyal Heights", points: [[47.6860, -122.3900]] },
  { name: "Licton Springs", points: [[47.7000, -122.3360]] },
  { name: "Madison Park", points: [[47.6350, -122.2780]] },
  { name: "Madrona", points: [[47.6120, -122.2860]] },
  { name: "North Admiral", points: [[47.5900, -122.3920]] },
  { name: "North Beacon Hill", points: [[47.5780, -122.3170]] },
  { name: "Hillman City", points: [[47.5440, -122.2870]] },
  { name: "Rainier View", points: [[47.5050, -122.2650]] },
];

/** Same ~1 mile grid LiveBites caches Google results on (src/lib/food/nearby.ts cellKeyFor). */
export const CELL_SIZE_DEG = 0.015;
export const cellKey = (lat, lng) => `${Math.floor(lat / CELL_SIZE_DEG)}:${Math.floor(lng / CELL_SIZE_DEG)}`;

/** Every point in priority order, one per grid cell (two points in the same cell would only repeat the same search). */
export function seedPoints(neighborhoods = NEIGHBORHOODS) {
  const seen = new Set();
  const out = [];
  for (const n of neighborhoods) {
    for (const [lat, lng] of n.points) {
      const key = cellKey(lat, lng);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ neighborhood: n.name, lat, lng, cell: key });
    }
  }
  return out;
}

/**
 * Whether a point still needs its Google searches: not when every wanted group was fetched within `refreshDays`.
 * `fetched` = rows of food_fetch_cells for that cell ({ fetch_group, fetched_at }).
 */
export function pointNeedsSeeding(fetched, groups, refreshDays, now = Date.now()) {
  const cutoff = now - refreshDays * 86400000;
  return groups.some((g) => !fetched.some((f) => f.fetch_group === g && new Date(f.fetched_at).getTime() >= cutoff));
}
