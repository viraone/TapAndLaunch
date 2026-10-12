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
  // Added 2026-10-11: the rest of Seattle, then the cities around it. A point that lands in a cell already covered costs nothing.
  { name: "Uptown", points: [[47.6235, -122.3555]] },
  { name: "Greenwood", points: [[47.6925, -122.3555]] },
  { name: "Roosevelt", points: [[47.6760, -122.3180]] },
  { name: "Ravenna", points: [[47.6760, -122.3030]] },
  { name: "University Village", points: [[47.6630, -122.2990]] },
  { name: "Columbia City", points: [[47.5595, -122.2865]] },
  { name: "Georgetown", points: [[47.5470, -122.3220]] },
  { name: "Beacon Hill", points: [[47.5680, -122.3120]] },
  { name: "Magnolia", points: [[47.6400, -122.3990]] },
  { name: "Westlake", points: [[47.6370, -122.3410]] },
  { name: "Mount Baker", points: [[47.5780, -122.2860]] },
  { name: "South Park", points: [[47.5300, -122.3190]] },
  { name: "Morgan Junction", points: [[47.5470, -122.3860]] },
  { name: "Fauntleroy", points: [[47.5230, -122.3920]] },
  { name: "Maple Leaf", points: [[47.6990, -122.3180]] },
  { name: "Wedgwood", points: [[47.6910, -122.2900]] },
  { name: "Laurelhurst", points: [[47.6590, -122.2750]] },
  { name: "Lake City", points: [[47.7190, -122.2950]] },
  { name: "Bitter Lake", points: [[47.7240, -122.3500]] },
  { name: "Crown Hill", points: [[47.7040, -122.3750]] },
  { name: "Bellevue", points: [[47.6101, -122.2015], [47.6180, -122.1250]] },
  { name: "Kirkland", points: [[47.6769, -122.2060]] },
  { name: "Redmond", points: [[47.6740, -122.1215]] },
  { name: "Mercer Island", points: [[47.5707, -122.2220]] },
  { name: "Shoreline", points: [[47.7557, -122.3415]] },
  { name: "Burien", points: [[47.4704, -122.3468]] },
  { name: "Renton", points: [[47.4829, -122.2171]] },
  { name: "Edmonds", points: [[47.8107, -122.3774]] },
  { name: "Lynnwood", points: [[47.8209, -122.3151]] },
  { name: "Bothell", points: [[47.7623, -122.2054]] },
  { name: "Issaquah", points: [[47.5301, -122.0326]] },
  { name: "Tukwila", points: [[47.4740, -122.2610]] },
  { name: "SeaTac", points: [[47.4435, -122.2961]] },
  // Added 2026-10-11 (second batch): the rest of the east side, the north and south suburbs, then Tacoma. Same rule as above: a point
  // only costs Google calls when its ~1 mile cell has not been searched yet, and the monthly ceiling in seed.mjs still applies.
  { name: "Totem Lake", points: [[47.7080, -122.1860]] },
  { name: "Juanita", points: [[47.7090, -122.2080]] },
  { name: "Overlake", points: [[47.6430, -122.1300]] },
  { name: "Medina / Clyde Hill", points: [[47.6330, -122.2200]] },
  { name: "Factoria", points: [[47.5700, -122.1500]] },
  { name: "Newcastle", points: [[47.5315, -122.1573]] },
  { name: "Sammamish", points: [[47.6163, -122.0356]] },
  { name: "Woodinville", points: [[47.7543, -122.1635]] },
  { name: "Kenmore", points: [[47.7573, -122.2447]] },
  { name: "Lake Forest Park", points: [[47.7568, -122.2807]] },
  { name: "Mountlake Terrace", points: [[47.7885, -122.3085]] },
  { name: "Mill Creek", points: [[47.8610, -122.2040]] },
  { name: "Mukilteo", points: [[47.9445, -122.3055]] },
  { name: "Everett", points: [[47.9790, -122.2021], [47.9120, -122.2100]] },
  { name: "Des Moines", points: [[47.4018, -122.3243]] },
  { name: "Kent", points: [[47.3809, -122.2348]] },
  { name: "Covington", points: [[47.3668, -122.1030]] },
  { name: "Maple Valley", points: [[47.3926, -122.0377]] },
  { name: "Auburn", points: [[47.3073, -122.2285]] },
  { name: "Federal Way", points: [[47.3223, -122.3126]] },
  { name: "Puyallup", points: [[47.1854, -122.2929]] },
  { name: "Fife", points: [[47.2392, -122.3570]] },
  { name: "Downtown Tacoma", points: [[47.2529, -122.4443]] },
  { name: "Hilltop Tacoma", points: [[47.2480, -122.4470]] },
  { name: "Tacoma Dome", points: [[47.2390, -122.4260]] },
  { name: "Proctor", points: [[47.2690, -122.4830]] },
  { name: "Point Ruston", points: [[47.3000, -122.5100]] },
  { name: "South Tacoma", points: [[47.2210, -122.4700]] },
  { name: "University Place", points: [[47.2370, -122.5530]] },
  { name: "Lakewood", points: [[47.1718, -122.5185]] },
  { name: "Bainbridge Island", points: [[47.6262, -122.5210]] },
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
