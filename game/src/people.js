// Pedestrians: Verano City residents strolling the sidewalks in bright shirts, who panic and
// run from gunfire, flying fists and fast cars — and the VCPD foot cops who climb out of
// stopped Interceptors to chase a runner down and make the bust.
import { buildingAt, collideWorld } from './city.js';

const SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#8ac926', '#ff9f1c', '#4cc9f0', '#e0aaff'];
const SKIN = ['#f2c29b', '#c98d64', '#8a5a3b', '#6e4530', '#ffd9b3'];

let nextPedId = 1;

export function createPed(x, y, random, options = {}) {
  return {
    id: nextPedId++,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: random.range(0, Math.PI * 2),
    radius: 11,
    shirt: options.cop ? '#1d3557' : random.pick(SHIRTS),
    skin: random.pick(SKIN),
    cop: options.cop ?? false,
    carId: options.carId ?? null,
    health: options.cop ? 130 : 70,
    dead: false,
    downFor: 0,
    panicFor: 0,
    threatX: 0,
    threatY: 0,
    targetX: x,
    targetY: y,
    repickFor: random.range(0, 2),
    walkSpeed: random.range(58, 96),
    hitTick: 0,
  };
}

/** Hurt a pedestrian; returns true when this blow is the one that puts them down for good. */
export function hurtPed(ped, damage, fromX, fromY) {
  if (ped.dead) return false;
  ped.health -= damage;
  ped.panicFor = Math.max(ped.panicFor, 2.6);
  ped.threatX = fromX;
  ped.threatY = fromY;
  const dx = ped.x - fromX;
  const dy = ped.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  ped.vx += (dx / dist) * 150;
  ped.vy += (dy / dist) * 150;
  if (ped.health <= 0) {
    ped.dead = true;
    return true;
  }
  if (damage > 26 && ped.downFor <= 0) ped.downFor = 1.1;
  return false;
}

function moveToward(ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const want = Math.min(speed, (dist / dt) * 0.9);
  ped.vx += ((dx / dist) * want - ped.vx) * Math.min(1, dt * 7);
  ped.vy += ((dy / dist) * want - ped.vy) * Math.min(1, dt * 7);
  return false;
}

export function stepPed(ped, world, dt, random) {
  if (ped.dead) return;
  const city = world.city;
  if (ped.downFor > 0) {
    ped.downFor -= dt;
    ped.vx *= 0.8;
    ped.vy *= 0.8;
    ped.x += ped.vx * dt;
    ped.y += ped.vy * dt;
    collideWorld(city, ped, ped.radius);
    return;
  }
  if (ped.panicFor > 0) ped.panicFor -= dt;
  ped.repickFor -= dt;

  // Sense fresh gunfire: a shot nearby is a threat at the shooter's position.
  if (world.time - world.lastShotAt < 0.4 && Math.hypot(ped.x - world.lastShotX, ped.y - world.lastShotY) < 360) {
    ped.panicFor = Math.max(ped.panicFor, 2.2);
    ped.threatX = world.lastShotX;
    ped.threatY = world.lastShotY;
  }

  if (ped.cop) {
    stepCop(ped, world, dt);
  } else if (ped.panicFor > 0) {
    const dx = ped.x - ped.threatX;
    const dy = ped.y - ped.threatY;
    const dist = Math.hypot(dx, dy) || 1;
    moveToward(ped, ped.x + (dx / dist) * 220 + (dy / dist) * 60, ped.y + (dy / dist) * 220 - (dx / dist) * 60, 218, dt);
  } else {
    if (ped.repickFor <= 0 || Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y) < 16) {
      const spot = random.pick(city.pedSpots);
      // Stroll targets stay in the neighbourhood, so the sidewalks stay lively everywhere.
      if (Math.hypot(spot.x - ped.x, spot.y - ped.y) < 620) {
        ped.targetX = spot.x;
        ped.targetY = spot.y;
      }
      ped.repickFor = random.range(4, 9);
    }
    moveToward(ped, ped.targetX, ped.targetY, ped.walkSpeed, dt);
  }

  ped.x += ped.vx * dt;
  ped.y += ped.vy * dt;
  if (Math.abs(ped.vx) + Math.abs(ped.vy) > 6) ped.angle = Math.atan2(ped.vy, ped.vx);
  collideWorld(city, ped, ped.radius);
}

function stepCop(ped, world, dt) {
  const player = world.player;
  const law = world.law;
  if (law.stars === 0 || player.mode === 'car') {
    // Back to the car when the heat dies or the chase goes wheels-up.
    const car = world.cars.find((c) => c.id === ped.carId);
    if (!car || Math.hypot(car.x - ped.x, car.y - ped.y) < 30) {
      ped.dead = true; // Climbed back in; the car drives on as a normal unit.
      if (car && car.driver === 'police') car.copOut = false;
      return;
    }
    moveToward(ped, car.x, car.y, 168, dt);
    return;
  }
  // Chase — but a building face on the straight line means running for its nearest corner
  // first, not grinding along the wall while the runner gets away.
  let tx = player.x;
  let ty = player.y;
  const dx = player.x - ped.x;
  const dy = player.y - ped.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wall = buildingAt(world.city, ped.x + (dx / dist) * 46, ped.y + (dy / dist) * 46, 4);
  if (wall && dist > 60) {
    let best = Infinity;
    const corners = [
      [wall.x - 26, wall.y - 26],
      [wall.x + wall.w + 26, wall.y - 26],
      [wall.x - 26, wall.y + wall.h + 26],
      [wall.x + wall.w + 26, wall.y + wall.h + 26],
    ];
    for (const [cx, cy] of corners) {
      const score = Math.hypot(cx - ped.x, cy - ped.y) + Math.hypot(cx - player.x, cy - player.y);
      if (score < best) {
        best = score;
        tx = cx;
        ty = cy;
      }
    }
  }
  moveToward(ped, tx, ty, 214, dt);
  // A cop with hands on the player is the bust clock, ticked in law.js.
}
