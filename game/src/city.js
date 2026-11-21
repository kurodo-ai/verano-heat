// Verano City itself: a seeded grid of avenues and streets, pastel blocks, landmark buildings
// (Ferran Motors, the Palm Court Motel, VCPD HQ, St. Alba Hospital, Hotel Alba, the North
// Depot), parking lots, parks, palms along the beach — plus the collision and sight-line
// helpers every other system asks about the city.
import { GRID, ROOF_COLORS, WORLD } from './config.js';

const HALF_ROAD = GRID.roadWidth / 2;

function avenueX(index) {
  return GRID.origin + index * GRID.spacing;
}
function streetY(index) {
  return GRID.origin + index * GRID.spacing;
}
function blockX(col) {
  return GRID.origin + HALF_ROAD + col * GRID.spacing;
}
function blockY(row) {
  return GRID.origin + HALF_ROAD + row * GRID.spacing;
}

const BLOCK_SIZE = GRID.spacing - GRID.roadWidth;

/** Landmark blocks, by [column, row] on the block grid: hand-placed, named, with a forecourt. */
const LANDMARKS = {
  garage: { col: 3, row: 2, name: 'Ferran Motors', color: '#f4b8a0' },
  motel: { col: 0, row: 4, name: 'Palm Court Motel', color: '#bfe0d8' },
  police: { col: 5, row: 1, name: 'VCPD HQ', color: '#c3d4ea' },
  hospital: { col: 1, row: 3, name: 'St. Alba Hospital', color: '#f0ead8' },
  hotel: { col: 6, row: 0, name: 'Hotel Alba', color: '#f7d774' },
  depot: { col: 2, row: 0, name: 'North Depot', color: '#eec9a3' },
};

export function buildCity(random) {
  const avenues = [];
  for (let i = 0; i < GRID.avenues; i += 1) avenues.push(avenueX(i));
  const streets = [];
  for (let j = 0; j < GRID.streets; j += 1) streets.push(streetY(j));

  const buildings = [];
  const blocks = [];
  const props = [];
  const parkingSpots = [];
  const pedSpots = [];
  const solids = [];

  function addBuilding(x, y, w, h, name) {
    const building = {
      x, y, w, h,
      floors: 2 + Math.floor(random.next() * 6),
      color: name ? LANDMARK_COLORS[name] : random.pick(ROOF_COLORS),
      name: name ?? null,
      seed: random.int(1, 100000),
    };
    buildings.push(building);
    return building;
  }

  const landmarkAt = {};
  for (const [key, mark] of Object.entries(LANDMARKS)) landmarkAt[`${mark.col},${mark.row}`] = { key, ...mark };

  for (let col = 0; col < GRID.avenues - 1; col += 1) {
    for (let row = 0; row < GRID.streets - 1; row += 1) {
      const bx = blockX(col);
      const by = blockY(row);
      const landmark = landmarkAt[`${col},${row}`];
      const block = { x: bx, y: by, w: BLOCK_SIZE, h: BLOCK_SIZE, kind: 'built', landmark: landmark ? landmark.key : null };
      blocks.push(block);
      // Sidewalk spawn points around every block: where pedestrians stroll.
      for (let s = 0; s < 4; s += 1) {
        pedSpots.push({ x: bx + 14 + random.next() * (BLOCK_SIZE - 28), y: by + 8 });
        pedSpots.push({ x: bx + 14 + random.next() * (BLOCK_SIZE - 28), y: by + BLOCK_SIZE - 8 });
        pedSpots.push({ x: bx + 8, y: by + 14 + random.next() * (BLOCK_SIZE - 28) });
        pedSpots.push({ x: bx + BLOCK_SIZE - 8, y: by + 14 + random.next() * (BLOCK_SIZE - 28) });
      }
      if (landmark) {
        block.kind = 'plaza';
        addBuilding(bx + 60, by + 40, 200, 130, landmark.name);
        // Forecourt parking in front of the landmark.
        for (let s = 0; s < 3; s += 1) parkingSpots.push({ x: bx + 70 + s * 80, y: by + 250, angle: -Math.PI / 2 });
        continue;
      }
      const roll = random.next();
      if (roll < 0.14) {
        block.kind = 'park';
        for (let t = 0; t < 9; t += 1) {
          const px = bx + 40 + random.next() * (BLOCK_SIZE - 80);
          const py = by + 40 + random.next() * (BLOCK_SIZE - 80);
          props.push({ x: px, y: py, kind: 'palm' });
          solids.push({ x: px, y: py, r: 7 });
        }
        continue;
      }
      if (roll < 0.28) {
        block.kind = 'parking';
        for (let px = bx + 46; px < bx + BLOCK_SIZE - 30; px += 74) {
          parkingSpots.push({ x: px, y: by + 70, angle: Math.PI / 2 });
          parkingSpots.push({ x: px, y: by + BLOCK_SIZE - 70, angle: -Math.PI / 2 });
        }
        continue;
      }
      const pattern = random.int(0, 2);
      if (pattern === 0) {
        addBuilding(bx + 30, by + 30, BLOCK_SIZE - 60, BLOCK_SIZE - 60, null);
      } else if (pattern === 1) {
        addBuilding(bx + 24, by + 28, 104, BLOCK_SIZE - 56, null);
        addBuilding(bx + 144, by + 28, 104, BLOCK_SIZE - 56, null);
      } else {
        addBuilding(bx + 24, by + 24, 104, 104, null);
        addBuilding(bx + 144, by + 24, 104, 104, null);
        addBuilding(bx + 24, by + 144, 104, 104, null);
        addBuilding(bx + 144, by + 144, 104, 104, null);
      }
    }
  }

  // Street parking along block edges, parallel to the kerb.
  for (const block of blocks) {
    if (block.kind === 'park') continue;
    for (let x = block.x + 44; x < block.x + block.w - 30; x += 88) {
      if (random.chance(0.5)) parkingSpots.push({ x, y: block.y - HALF_ROAD + 62, angle: 0 });
      if (random.chance(0.5)) parkingSpots.push({ x, y: block.y + block.h + HALF_ROAD - 62, angle: Math.PI });
    }
  }

  // Palms along the beach and lamps on the corners of the busiest intersections.
  for (let x = 90; x < WORLD.width - 60; x += random.int(120, 220)) {
    props.push({ x, y: 2568 + random.int(-14, 14), kind: 'palm' });
    solids.push({ x, y: 2568, r: 7 });
  }
  for (let i = 1; i < GRID.avenues - 1; i += 2) {
    for (let j = 1; j < GRID.streets - 1; j += 2) {
      props.push({ x: avenueX(i) - HALF_ROAD - 10, y: streetY(j) - HALF_ROAD - 10, kind: 'lamp' });
      props.push({ x: avenueX(i) + HALF_ROAD + 10, y: streetY(j) + HALF_ROAD + 10, kind: 'lamp' });
    }
  }

  const landmarks = {
    garage: pointOf(LANDMARKS.garage, 0, 268),
    motel: pointOf(LANDMARKS.motel, 0, 268),
    police: pointOf(LANDMARKS.police, 0, 268),
    hospital: pointOf(LANDMARKS.hospital, 0, 268),
    hotel: pointOf(LANDMARKS.hotel, 0, 268),
    depot: pointOf(LANDMARKS.depot, 0, 268),
    pier: { x: WORLD.width / 2, y: 2596 },
    spawn: { x: blockX(0) + 90, y: blockY(4) + 262 },
  };

  function pointOf(mark, dx, dy) {
    return { x: blockX(mark.col) + BLOCK_SIZE / 2 + dx, y: blockY(mark.row) + dy };
  }

  return {
    avenues,
    streets,
    buildings,
    blocks,
    props,
    parkingSpots,
    pedSpots,
    solids,
    landmarks,
    beachY: 2520,
  };
}

const LANDMARK_COLORS = {
  'Ferran Motors': '#f4b8a0',
  'Palm Court Motel': '#bfe0d8',
  'VCPD HQ': '#c3d4ea',
  'St. Alba Hospital': '#f0ead8',
  'Hotel Alba': '#f7d774',
  'North Depot': '#eec9a3',
};

/** True when a point sits on a road (avenue, street, or the marina road along the beach). */
export function isRoad(city, x, y) {
  if (y > 2500 && y < 2560) return true;
  for (const ax of city.avenues) if (Math.abs(x - ax) < HALF_ROAD) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) < HALF_ROAD) return true;
  return false;
}

/** The building a point is inside (padded by `pad`), or null. */
export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

/**
 * Push a circle (an object with x/y, moved in place) out of every building and prop trunk.
 * Returns true when anything was touched, so callers can count it as a collision.
 */
export function collideWorld(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nearX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    let dx = body.x - nearX;
    let dy = body.y - nearY;
    let distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq < 0.0001) {
      // Centre inside the box: leave by the nearest face.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - radius;
      else if (min === right) body.x = b.x + b.w + radius;
      else if (min === top) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    dx /= dist;
    dy /= dist;
    body.x = nearX + dx * radius;
    body.y = nearY + dy * radius;
  }
  for (const s of city.solids) {
    const dx = body.x - s.x;
    const dy = body.y - s.y;
    const rr = radius + s.r;
    const distSq = dx * dx + dy * dy;
    if (distSq >= rr * rr || distSq < 0.0001) continue;
    const dist = Math.sqrt(distSq);
    body.x = s.x + (dx / dist) * rr;
    body.y = s.y + (dy / dist) * rr;
    hit = true;
  }
  body.x = Math.max(radius, Math.min(WORLD.width - radius, body.x));
  body.y = Math.max(radius, Math.min(WORLD.height - radius, body.y));
  return hit;
}

/** A cheap sight line: blocked when any of the sampled points along it sits inside a building. */
export function lineOfSight(city, x1, y1, x2, y2) {
  const steps = 8;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (buildingAt(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2)) return false;
  }
  return true;
}
