// Cars: arcade physics (a velocity vector, grip that bleeds off sideways slide, a handbrake
// that loosens it), the traffic brain that drives the road grid in lanes and turns at
// intersections, and the police brain that hunts the player and rams what it catches.
import { CAR_MODELS, GRID, WORLD } from './config.js';
import { buildingAt, collideWorld, lineOfSight } from './city.js';

const LANE = GRID.laneOffset;

let nextCarId = 1;

export function createCar(modelId, x, y, angle, random, options = {}) {
  const model = CAR_MODELS[modelId];
  return {
    id: nextCarId++,
    modelId,
    model,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    steerVis: 0,
    radius: 30,
    color: options.color ?? random.pick(model.colors),
    health: 100,
    driver: options.driver ?? null,
    parked: options.parked ?? false,
    stolen: false,
    owned: options.owned ?? false,
    missionCar: options.missionCar ?? false,
    delivered: false,
    ctrl: { throttle: 0, steer: 0, handbrake: false },
    ai: { mode: 'v', dir: 1, decidedFor: '', stuckFor: 0, reverseFor: 0, edgeCd: 0, seed: random.next() },
    crashCooldown: 0,
    smokeTimer: 0,
  };
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function speed2D(car) {
  return Math.hypot(car.vx, car.vy);
}

function angleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Advance one car's physics one step against the city. Returns the impact strength (0 when
 * the step was clean) so the world can charge damage, noise and shake to a real crash.
 */
export function stepCarPhysics(car, dt, city) {
  const model = car.model;
  const ctrl = car.ctrl;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let forward = car.vx * fx + car.vy * fy;
  // Lateral slide: what grip does not kill becomes drift.
  let lx = car.vx - fx * forward;
  let ly = car.vy - fy * forward;
  const grip = ctrl.handbrake ? model.grip * 0.32 : model.grip;
  const bleed = Math.exp(-grip * dt);
  lx *= bleed;
  ly *= bleed;

  if (ctrl.throttle > 0) forward += model.accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) {
    // Brake when rolling forward, reverse gear when nearly stopped.
    forward += (forward > 24 ? -model.accel * 1.25 : model.accel * 0.62) * ctrl.throttle * dt;
  }
  if (ctrl.handbrake) forward -= forward * 1.7 * dt;
  forward -= forward * 0.32 * dt;
  if (ctrl.throttle === 0 && Math.abs(forward) < 9) forward = 0;
  forward = Math.max(-model.reverse, Math.min(model.maxSpeed, forward));

  const steerAuthority = Math.min(1, Math.abs(forward) / 130);
  const turn = ctrl.steer * 2.35 * steerAuthority * (forward < 0 ? -1 : 1);
  car.angle += turn * dt * (1 - Math.min(0.45, Math.abs(forward) / model.maxSpeed * 0.45));
  car.steerVis = ctrl.steer;

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * forward + lx;
  car.vy = nfy * forward + ly;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  let impact = 0;
  const before = speed2D(car);
  if (collideWorld(city, car, car.radius)) {
    const after = { x: car.x, y: car.y };
    // Recompute velocity from the push-out so a wall stops the car instead of storing energy.
    car.vx *= 0.35;
    car.vy *= 0.35;
    if (before > 130) impact = (before - speed2D(car)) / 340;
    car.x = after.x;
    car.y = after.y;
  }
  if (car.crashCooldown > 0) car.crashCooldown -= dt;
  return impact;
}

/** The lane point a traffic car aims for: its own side of the road, a lookahead ahead. */
function laneTarget(city, car) {
  const ai = car.ai;
  if (ai.mode === 'v') {
    let avenue = city.avenues[0];
    let best = Infinity;
    for (const ax of city.avenues) {
      const d = Math.abs(ax - car.x);
      if (d < best) {
        best = d;
        avenue = ax;
      }
    }
    const laneX = avenue + (ai.dir > 0 ? -LANE : LANE);
    return { x: laneX, y: car.y + ai.dir * 130 };
  }
  let street = city.streets[0];
  let best = Infinity;
  for (const sy of city.streets) {
    const d = Math.abs(sy - car.y);
    if (d < best) {
      best = d;
      street = sy;
    }
  }
  const laneY = street + (ai.dir > 0 ? LANE : -LANE);
  return { x: car.x + ai.dir * 130, y: laneY };
}

function nearestCrossing(city, car) {
  const ai = car.ai;
  if (ai.mode === 'v') {
    let best = null;
    for (const sy of city.streets) {
      const d = Math.abs(sy - car.y);
      if (best === null || d < best.d) best = { d, key: `v${Math.round(car.x)},${sy}`, cross: sy };
    }
    return best;
  }
  let best = null;
  for (const ax of city.avenues) {
    const d = Math.abs(ax - car.x);
    if (best === null || d < best.d) best = { d, key: `h${ax},${Math.round(car.y)}`, cross: ax };
  }
  return best;
}

/** Something solid in the lane ahead means brakes, for traffic and police alike. */
function blockedAhead(car, world, distance) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of world.cars) {
    if (other === car || other.health <= 0) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 6 || ahead > distance) continue;
    if (Math.abs(dx * -fy + dy * fx) < 30) return true;
  }
  for (const ped of world.peds) {
    if (ped.dead || ped.inCar) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 4 || ahead > distance * 0.7) continue;
    if (Math.abs(dx * -fy + dy * fx) < 24) return true;
  }
  const player = world.player;
  if (player && player.mode === 'foot' && !player.dead) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead >= 4 && ahead <= distance * 0.7 && Math.abs(dx * -fy + dy * fx) < 24) return true;
  }
  return false;
}

function steerToward(car, tx, ty, dt) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, desired);
  car.ctrl.steer = Math.max(-1, Math.min(1, diff * 2.4));
  return diff;
}

function unstuck(car, dt) {
  const ai = car.ai;
  if (ai.reverseFor > 0) {
    ai.reverseFor -= dt;
    car.ctrl.throttle = -1;
    car.ctrl.steer = car.ctrl.steer >= 0 ? -1 : 1;
    return true;
  }
  if (Math.abs(forwardSpeed(car)) < 16 && car.ctrl.throttle > 0.4) ai.stuckFor += dt;
  else ai.stuckFor = 0;
  if (ai.stuckFor > 1.1) {
    ai.stuckFor = 0;
    ai.reverseFor = 0.55;
    return true;
  }
  return false;
}

/** Traffic: follow the lane, slow for company, turn at some intersections, never hurry. */
export function stepTraffic(car, world, dt, random) {
  const ai = car.ai;
  // The road ends at the world edge: swing a U-turn into the opposite lane rather than
  // grinding on the border forever.
  ai.edgeCd = Math.max(0, ai.edgeCd - dt);
  if (ai.edgeCd === 0) {
    const lookX = ai.mode === 'v' ? car.x : car.x + ai.dir * 190;
    const lookY = ai.mode === 'v' ? car.y + ai.dir * 190 : car.y;
    if (lookX < 110 || lookX > WORLD.width - 110 || lookY < 110 || lookY > WORLD.height - 110) {
      ai.dir *= -1;
      ai.edgeCd = 2.5;
    }
  }
  const crossing = nearestCrossing(world.city, car);
  if (crossing && crossing.d < 30 && ai.decidedFor !== crossing.key) {
    ai.decidedFor = crossing.key;
    const roll = random.next();
    if (roll < 0.34) {
      // Turn: swap the travel axis. side is +1 for a right turn, -1 for a left, and the new
      // direction along the crossed road follows from the old heading and the side taken.
      const side = roll < 0.17 ? -1 : 1;
      if (ai.mode === 'v') {
        ai.mode = 'h';
        ai.dir = -ai.dir * side;
      } else {
        ai.mode = 'v';
        ai.dir = ai.dir * side;
      }
    }
  }
  const target = laneTarget(world.city, car);
  const diff = steerToward(car, target.x, target.y, dt);
  let cruise = 205;
  if (Math.abs(diff) > 0.5) cruise = 120;
  if (blockedAhead(car, world, 92)) cruise = 0;
  const fwd = forwardSpeed(car);
  car.ctrl.handbrake = false;
  if (unstuck(car, dt)) return;
  car.ctrl.throttle = fwd < cruise ? 0.75 : -0.5;
  if (cruise === 0 && fwd < 12) car.ctrl.throttle = 0;
}

/** Police: hunt the player's position a heartbeat ahead, and do not brake for the catch. */
export function stepPolice(car, world, dt) {
  const player = world.player;
  const px = player.mode === 'car' && player.car ? player.car.x : player.x;
  const py = player.mode === 'car' && player.car ? player.car.y : player.y;
  const pvx = player.mode === 'car' && player.car ? player.car.vx : player.vx;
  const pvy = player.mode === 'car' && player.car ? player.car.vy : player.vy;
  const dist = Math.hypot(px - car.x, py - car.y);
  const lead = Math.min(0.45, dist / 900);
  // No clear line to the target: take the grid. Aim for the junction nearest the player and
  // let the direct chase take over once the way is open — straight-line charges through
  // blocks just wreck Interceptors on building faces.
  let tx = px + pvx * lead;
  let ty = py + pvy * lead;
  if (dist > 260 && !lineOfSight(world.city, car.x, car.y, px, py)) {
    let best = Infinity;
    for (const ax of world.city.avenues) {
      for (const sy of world.city.streets) {
        const d = Math.hypot(ax - px, sy - py);
        if (d < best) {
          best = d;
          tx = ax;
          ty = sy;
        }
      }
    }
  }
  const diff = steerToward(car, tx, ty, dt);
  car.ctrl.handbrake = false;
  if (unstuck(car, dt)) return;
  if (Math.abs(diff) > 2.5 && dist < 130) {
    car.ctrl.throttle = -1;
    return;
  }
  car.ctrl.throttle = 1;
  // A building face dead ahead: aim for its nearest corner instead of grinding on the wall.
  const aheadX = car.x + Math.cos(car.angle) * 84;
  const aheadY = car.y + Math.sin(car.angle) * 84;
  const wall = buildingAt(world.city, aheadX, aheadY, 8);
  if (wall) {
    let cornerX = wall.x - 42;
    let cornerY = wall.y - 42;
    let best = Infinity;
    const corners = [
      [wall.x - 42, wall.y - 42],
      [wall.x + wall.w + 42, wall.y - 42],
      [wall.x - 42, wall.y + wall.h + 42],
      [wall.x + wall.w + 42, wall.y + wall.h + 42],
    ];
    for (const [cx, cy] of corners) {
      const score = Math.hypot(cx - car.x, cy - car.y) + Math.hypot(cx - px, cy - py);
      if (score < best) {
        best = score;
        cornerX = cx;
        cornerY = cy;
      }
    }
    steerToward(car, cornerX, cornerY, dt);
    car.ctrl.throttle = speed2D(car) > 240 ? 0.3 : 0.85;
  }
  // Chasing a runner: a speed governor tied to the gap, so the Interceptor sheds its
  // highway pace as it closes and pulls up beside him instead of flattening him.
  if (player.mode === 'foot') {
    const fwd = forwardSpeed(car);
    const cap = Math.max(26, Math.min(430, dist * 0.5));
    if (fwd > cap) car.ctrl.throttle = -0.7;
    else if (car.ctrl.throttle > 0.85) car.ctrl.throttle = 0.85;
    if (dist < 80 && fwd <= 30 && car.ctrl.throttle > 0) car.ctrl.throttle = 0;
  }
}
