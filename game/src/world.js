// The world of Verano Heat: every system in one state — Mac Delgado on foot and behind the
// wheel, the traffic and parked cars of the city, its pedestrians, the law and the work.
// step() advances one fixed step from a controls object and returns the frame's events as
// strings ('shot', 'crash', 'mission-complete', …) for the shell to turn into sound and text.
import { GRID, PLAYER, WORLD } from './config.js';
import { buildCity, buildingAt, collideWorld } from './city.js';
import { createCar, forwardSpeed, speed2D, stepCarPhysics, stepPolice, stepTraffic } from './vehicles.js';
import { createPed, hurtPed, stepPed } from './people.js';
import { createLaw, reportCrime, updateLaw } from './law.js';
import { createMissions, updateMissions } from './missions.js';
import { createEffects } from './effects.js';

const TRAFFIC_MODELS = ['pico', 'meridian', 'meridian', 'cab', 'hauler', 'pico'];
const PARKED_MODELS = ['pico', 'pico', 'meridian', 'meridian', 'hauler', 'cab', 'vireo'];

export function createWorld(random) {
  const city = buildCity(random);
  const world = {
    city,
    time: 0,
    player: {
      x: city.landmarks.spawn.x,
      y: city.landmarks.spawn.y,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      mode: 'foot',
      car: null,
      health: PLAYER.maxHealth,
      hasGun: false,
      punchCd: 0,
      gunCd: 0,
      lastHurtAt: -99,
      walkCycle: 0,
      dead: false,
    },
    cars: [],
    peds: [],
    law: createLaw(),
    missions: createMissions(),
    effects: createEffects(),
    cash: 120,
    camera: { x: city.landmarks.spawn.x, y: city.landmarks.spawn.y },
    cameraFree: false,
    messages: [],
    objective: null,
    gameOver: null,
    frameEvents: [],
    tracers: [],
    lastShotAt: -99,
    lastShotX: 0,
    lastShotY: 0,
    stats: { earned: 0, stolenCars: 0, shotsFired: 0 },
    missionCar: null,
    depotCar: null,
    onCashChange: null,
    trafficTimer: 0,
    pedTimer: 0,
    lockedToastAt: -9,
  };

  world.toast = (title, body, seconds = 4.5) => {
    world.messages.push({ title, body, until: world.time + seconds });
    if (world.messages.length > 3) world.messages.shift();
  };

  world.addCash = (amount) => {
    world.cash += amount;
    if (amount > 0) world.stats.earned += amount;
    if (world.onCashChange) world.onCashChange();
  };

  world.saveData = () => ({
    cash: world.cash,
    missionIndex: world.missions.index,
    storyDone: world.missions.storyDone,
    hasGun: world.player.hasGun,
  });

  world.applySave = (save) => {
    if (!save) return;
    world.cash = save.cash ?? world.cash;
    world.missions.index = save.missionIndex ?? 0;
    world.missions.storyDone = save.storyDone ?? false;
    world.player.hasGun = save.hasGun ?? false;
  };

  spawnParkedCars(world, random);
  for (let i = 0; i < 13; i += 1) spawnTraffic(world, random, true);
  for (let i = 0; i < 26; i += 1) spawnPeds(world, random, true);

  world.step = (dt, controls) => stepWorld(world, dt, controls, random);
  world.stepAmbient = (dt) => stepAmbient(world, dt, random);
  world.respawn = (kind) => respawn(world, kind);
  return world;
}

function shuffled(items, random) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function spawnParkedCars(world, random) {
  const marks = world.city.landmarks;
  const reserved = [
    { x: 3110, y: 570 },
    { x: 1350, y: 570 },
    { x: marks.spawn.x + 60, y: marks.spawn.y - 12 },
  ];
  const chosen = [];
  for (const spot of shuffled(world.city.parkingSpots, random)) {
    if (chosen.length >= 30) break;
    if (reserved.some((r) => Math.hypot(r.x - spot.x, r.y - spot.y) < 78)) continue;
    if (chosen.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 120)) continue;
    chosen.push(spot);
    world.cars.push(createCar(random.pick(PARKED_MODELS), spot.x, spot.y, spot.angle, random, { parked: true }));
  }
  // Mac's own battered Pico, waiting by the motel.
  const starter = createCar('pico', reserved[2].x, reserved[2].y, Math.PI / 2, random, { parked: true, owned: true, color: '#7fa6c9' });
  world.cars.push(starter);
  // The gold Vireo GT of Golden Hour, in the Hotel Alba forecourt.
  const gold = createCar('vireo', reserved[0].x, reserved[0].y, Math.PI / 2, random, { parked: true, missionCar: true, color: '#e0a81c' });
  world.cars.push(gold);
  world.missionCar = gold;
  // The depot Vireo of Neon Run.
  const depot = createCar('vireo', reserved[1].x, reserved[1].y, Math.PI / 2, random, { parked: true, missionCar: true, color: '#2255a4' });
  world.cars.push(depot);
  world.depotCar = depot;
}

function trafficSpawnPoint(world, random, anywhere) {
  const player = world.player;
  for (let tries = 0; tries < 10; tries += 1) {
    const vertical = random.chance(0.5);
    if (vertical) {
      const ax = random.pick(world.city.avenues);
      const y = random.range(80, WORLD.height - 80);
      const dist = Math.hypot(ax - player.x, y - player.y);
      if (anywhere ? dist > 200 : dist > 820 && dist < 1250) return { x: ax, y, mode: 'v', dir: random.chance(0.5) ? 1 : -1 };
    } else {
      const sy = random.pick(world.city.streets);
      const x = random.range(80, WORLD.width - 80);
      const dist = Math.hypot(x - player.x, sy - player.y);
      if (anywhere ? dist > 200 : dist > 820 && dist < 1250) return { x, y: sy, mode: 'h', dir: random.chance(0.5) ? 1 : -1 };
    }
  }
  return null;
}

function spawnTraffic(world, random, initial = false) {
  const point = trafficSpawnPoint(world, random, initial);
  if (!point) return;
  const car = createCar(random.pick(TRAFFIC_MODELS), point.x, point.y, 0, random, { driver: 'traffic' });
  car.ai.mode = point.mode;
  car.ai.dir = point.dir;
  if (point.mode === 'v') {
    car.x += point.dir > 0 ? -GRID.laneOffset : GRID.laneOffset;
    car.angle = point.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y += point.dir > 0 ? GRID.laneOffset : -GRID.laneOffset;
    car.angle = point.dir > 0 ? 0 : Math.PI;
  }
  world.cars.push(car);
}

function spawnPeds(world, random, initial = false) {
  const spot = random.pick(world.city.pedSpots);
  if (!initial && Math.hypot(spot.x - world.player.x, spot.y - world.player.y) < 640) return;
  world.peds.push(createPed(spot.x, spot.y, random));
}

function respawn(world, kind) {
  const player = world.player;
  const marks = world.city.landmarks;
  if (player.car) {
    player.car.driver = null;
    player.car.ctrl.throttle = 0;
    player.car = null;
  }
  const point = kind === 'busted' ? marks.police : marks.hospital;
  player.x = point.x;
  player.y = point.y;
  player.vx = 0;
  player.vy = 0;
  player.mode = 'foot';
  player.health = PLAYER.maxHealth;
  player.dead = false;
  world.cash = Math.max(0, world.cash - (kind === 'busted' ? 200 : 150));
  world.law.heat = 0;
  world.law.stars = 0;
  world.law.bust = 0;
  world.law.forcedHeat = 0;
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    if (world.cars[i].driver === 'police') world.cars.splice(i, 1);
  }
  for (const ped of world.peds) if (ped.cop) ped.dead = true;
  world.gameOver = null;
  world.toast(kind === 'busted' ? 'Released' : 'Patched up', kind === 'busted' ? 'The VCPD thanks you for the donation.' : 'St. Alba fixed the worst of it. The bill stings.', 4.5);
  if (world.onCashChange) world.onCashChange();
}

function stepAmbient(world, dt, random) {
  world.time += dt;
  world.frameEvents.length = 0;
  for (const car of world.cars) {
    if (car.driver === 'traffic') {
      stepTraffic(car, world, dt, random);
      stepCarPhysics(car, dt, world.city);
    }
  }
  for (const ped of world.peds) stepPed(ped, world, dt, random);
  world.effects.update(dt);
}

function stepWorld(world, dt, controls, random) {
  const events = world.frameEvents;
  events.length = 0;
  const player = world.player;
  const city = world.city;
  if (world.gameOver) {
    world.effects.update(dt);
    return events;
  }
  world.time += dt;
  player.punchCd = Math.max(0, player.punchCd - dt);
  player.gunCd = Math.max(0, player.gunCd - dt);

  if (player.mode === 'foot') stepPlayerFoot(world, dt, controls);
  else stepPlayerCar(world, dt, controls);

  stepCars(world, dt, random);
  stepCarMeetings(world, dt);
  stepPeds(world, dt, random);
  stepCombat(world, dt, controls);
  updateLaw(world, dt, random);
  updateMissions(world, dt);
  maintainPopulation(world, dt, random);

  world.effects.update(dt);
  for (let i = world.tracers.length - 1; i >= 0; i -= 1) {
    if (world.tracers[i].until < world.time) world.tracers.splice(i, 1);
  }
  for (let i = world.messages.length - 1; i >= 0; i -= 1) {
    if (world.messages[i].until < world.time) world.messages.splice(i, 1);
  }

  // Camera: follow with a lean into the motion.
  if (!world.cameraFree) {
    const focus = player.mode === 'car' && player.car ? player.car : player;
    const lead = 0.34;
    const tx = focus.x + (focus.vx ?? 0) * lead;
    const ty = focus.y + (focus.vy ?? 0) * lead;
    const blend = Math.min(1, dt * 5);
    world.camera.x += (tx - world.camera.x) * blend;
    world.camera.y += (ty - world.camera.y) * blend;
  }

  if (!player.dead && player.health < PLAYER.maxHealth && world.time - player.lastHurtAt > PLAYER.regenDelay) {
    player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regenRate * dt);
  }
  if (!player.dead && player.health <= 0) {
    player.dead = true;
    world.gameOver = 'wrecked';
    events.push('wrecked');
  }
  return events;
}

function stepPlayerFoot(world, dt, controls) {
  const player = world.player;
  const length = Math.hypot(controls.moveX, controls.moveY) || 1;
  const speed = controls.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const tx = (controls.moveX / length) * speed * (controls.moveX || controls.moveY ? 1 : 0);
  const ty = (controls.moveY / length) * speed * (controls.moveX || controls.moveY ? 1 : 0);
  const blend = Math.min(1, dt * 11);
  player.vx += (tx - player.vx) * blend;
  player.vy += (ty - player.vy) * blend;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.walkCycle += Math.hypot(player.vx, player.vy) * dt * 0.09;
  collideWorld(world.city, player, player.radius);
  // Cars are furniture you cannot walk through.
  for (const car of world.cars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const min = player.radius + car.radius - 4;
    if (dist > 0.01 && dist < min) {
      player.x = car.x + (dx / dist) * min;
      player.y = car.y + (dy / dist) * min;
    }
  }
  player.angle = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);

  if (controls.interact) tryEnterCar(world);
}

function tryEnterCar(world) {
  const player = world.player;
  let best = null;
  let bestDist = 58;
  for (const car of world.cars) {
    if (car.health <= 0) continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  if (!best) return;
  if (best.driver === 'police') {
    if (world.time - world.lockedToastAt > 2.5) {
      world.lockedToastAt = world.time;
      world.toast('Locked', 'VCPD property. Even Mac has limits.', 2.2);
    }
    return;
  }
  const car = best;
  if (car.driver === 'traffic') car.driver = null;
  car.parked = false;
  player.mode = 'car';
  player.car = car;
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
  world.frameEvents.push('door');
  if (!car.owned && !car.delivered && !car.stolen) {
    car.stolen = true;
    world.stats.stolenCars += 1;
    reportCrime(world, 'carjack', car.x, car.y);
  }
}

function stepPlayerCar(world, dt, controls) {
  const player = world.player;
  const car = player.car;
  if (!car) {
    player.mode = 'foot';
    return;
  }
  car.ctrl.throttle = controls.throttle;
  car.ctrl.steer = controls.steer;
  car.ctrl.handbrake = controls.handbrake;
  player.x = car.x;
  player.y = car.y;
  player.vx = car.vx;
  player.vy = car.vy;
  player.angle = car.angle;
  if (controls.interact) {
    // Step out on whichever side is not inside a building.
    for (const side of [1, -1]) {
      const x = car.x + Math.cos(car.angle + (Math.PI / 2) * side) * 42;
      const y = car.y + Math.sin(car.angle + (Math.PI / 2) * side) * 42;
      if (!buildingAt(world.city, x, y, 6)) {
        player.x = x;
        player.y = y;
        break;
      }
    }
    player.mode = 'foot';
    player.car = null;
    car.driver = null;
    car.ctrl.throttle = 0;
    car.ctrl.steer = 0;
    car.ctrl.handbrake = false;
    world.frameEvents.push('door');
  }
}

function stepCars(world, dt, random) {
  const player = world.player;
  for (const car of world.cars) {
    if (car.driver === 'traffic') stepTraffic(car, world, dt, random);
    else if (car.driver === 'police') stepPolice(car, world, dt);
    else if (car.driver !== 'player') {
      car.ctrl.throttle = 0;
      car.ctrl.steer = 0;
    }
    if (car.health <= 0) {
      car.ctrl.throttle = 0;
      car.ctrl.handbrake = true;
    }
    const impact = stepCarPhysics(car, dt, world.city);
    if (impact > 0.12) {
      car.health -= impact * 42;
      world.effects.sparks(car.x, car.y, Math.round(4 + impact * 10));
      if (car === player.car) {
        world.effects.addShake(impact * 9);
        if (impact > 0.3) hurtPlayer(world, impact * 7);
        world.frameEvents.push('crash');
      }
    }
    if (car.health < 45 && car.health > 0) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.14;
        world.effects.smoke(car.x, car.y, car.health < 20);
      }
    }
    if (car.health <= 0 && car === player.car && player.mode === 'car') {
      // The wreck gives up: Mac climbs out of the smoke.
      stepPlayerCar(world, dt, { interact: true, throttle: 0, steer: 0, handbrake: false });
      hurtPlayer(world, 16);
      world.toast('Wrecked', 'That one is not driving anywhere again.', 3.5);
    }
  }
}

function stepCarMeetings(world, dt) {
  const cars = world.cars;
  const player = world.player;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      // Cars are long, not round: they collide as if narrower than their building radius,
      // so a parked car and a passing car in the next lane never touch.
      const min = 34;
      if (dist < 0.01 || dist >= min) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (min - dist) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const relVx = b.vx - a.vx;
      const relVy = b.vy - a.vy;
      const closing = relVx * nx + relVy * ny;
      if (closing >= 0) continue;
      const bounce = -closing * 0.72;
      a.vx -= nx * bounce;
      a.vy -= ny * bounce;
      b.vx += nx * bounce;
      b.vy += ny * bounce;
      const severity = -closing;
      if (severity > 60) {
        a.health -= severity * 0.1;
        b.health -= severity * 0.1;
        world.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        const playerCar = player.mode === 'car' ? player.car : null;
        if (a === playerCar || b === playerCar) {
          const other = a === playerCar ? b : a;
          world.effects.addShake(Math.min(8, severity * 0.03));
          world.frameEvents.push('crash');
          if (other.crashCooldown <= 0) {
            other.crashCooldown = 1.2;
            if (other.driver === 'police') reportCrime(world, 'ramPolice', other.x, other.y);
            else reportCrime(world, 'hitCar', other.x, other.y);
          }
        }
      }
    }
  }
  // Cars versus people, and versus Mac on foot.
  for (const car of cars) {
    const speed = speed2D(car);
    if (speed < 46) continue;
    for (const ped of world.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.radius + 9) {
        const died = hurtPed(ped, (speed - 30) * 0.3, car.x, car.y);
        world.effects.fall(ped.x, ped.y);
        if (car === player.car) {
          reportCrime(world, died ? 'killPed' : 'hitPed', ped.x, ped.y);
          world.frameEvents.push('crash');
        }
      }
    }
    if (player.mode === 'foot' && !player.dead && car !== player.car) {
      if (Math.hypot(player.x - car.x, player.y - car.y) < car.radius + 10 && speed > 105 && world.time - (player.carHitAt ?? -9) > 0.7) {
        player.carHitAt = world.time;
        hurtPlayer(world, Math.min(30, (speed - 85) * 0.15));
        const dx = player.x - car.x;
        const dy = player.y - car.y;
        const dist = Math.hypot(dx, dy) || 1;
        player.vx = (dx / dist) * speed * 0.9;
        player.vy = (dy / dist) * speed * 0.9;
        world.effects.addShake(6);
        world.frameEvents.push('crash');
      }
    }
  }
}

function stepPeds(world, dt, random) {
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    stepPed(ped, world, dt, random);
    // Cops who climbed back in, and the fallen long gone, leave the list.
    if (ped.dead && ped.cop) world.peds.splice(i, 1);
  }
}

function stepCombat(world, dt, controls) {
  const player = world.player;
  if (player.mode !== 'foot' || player.dead) return;
  if (controls.punch && player.punchCd <= 0) doPunch(world);
  if (controls.firing && player.gunCd <= 0) {
    if (player.hasGun) doShoot(world);
    else if (player.punchCd <= 0) doPunch(world);
  }
  // A foot cop's hands hurt, a little at a time.
  for (const ped of world.peds) {
    if (!ped.cop || ped.dead) continue;
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < 27) {
      ped.hitTick -= dt;
      if (ped.hitTick <= 0) {
        ped.hitTick = 0.55;
        hurtPlayer(world, 5);
      }
    }
  }
}

function doPunch(world) {
  const player = world.player;
  player.punchCd = PLAYER.punchCooldown;
  world.frameEvents.push('punch');
  player.vx += Math.cos(player.angle) * 130;
  player.vy += Math.sin(player.angle) * 130;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.punchRange) continue;
    const facing = (dx * Math.cos(player.angle) + dy * Math.sin(player.angle)) / (dist || 1);
    if (facing < 0.15) continue;
    const died = hurtPed(ped, PLAYER.punchDamage, player.x, player.y);
    reportCrime(world, died ? 'killPed' : 'assault', ped.x, ped.y);
    world.effects.fall(ped.x, ped.y);
  }
}

function doShoot(world) {
  const player = world.player;
  player.gunCd = PLAYER.gunCooldown;
  world.stats.shotsFired += 1;
  world.lastShotAt = world.time;
  world.lastShotX = player.x;
  world.lastShotY = player.y;
  world.frameEvents.push('shot');
  const angle = player.angle + (Math.random() - 0.5) * 0.02;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  world.effects.muzzle(player.x + dx * 22, player.y + dy * 22, angle);
  reportCrime(world, 'gunshot', player.x, player.y);

  let bestT = PLAYER.gunRange;
  let hitPed = null;
  let hitCar = null;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const t = rayCircle(player.x, player.y, dx, dy, ped.x, ped.y, 13);
    if (t !== null && t < bestT) {
      bestT = t;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of world.cars) {
    const t = rayCircle(player.x, player.y, dx, dy, car.x, car.y, 34);
    if (t !== null && t < bestT) {
      bestT = t;
      hitCar = car;
      hitPed = null;
    }
  }
  for (let t = 20; t < bestT; t += 16) {
    if (buildingAt(world.city, player.x + dx * t, player.y + dy * t, 0)) {
      bestT = t;
      hitPed = null;
      hitCar = null;
      break;
    }
  }
  const endX = player.x + dx * bestT;
  const endY = player.y + dy * bestT;
  world.tracers.push({ x1: player.x + dx * 24, y1: player.y + dy * 24, x2: endX, y2: endY, until: world.time + 0.07 });
  if (hitPed) {
    const died = hurtPed(hitPed, PLAYER.gunDamage, player.x, player.y);
    if (died) reportCrime(world, 'killPed', hitPed.x, hitPed.y);
    world.effects.fall(endX, endY);
  } else if (hitCar) {
    hitCar.health -= 22;
    world.effects.sparks(endX, endY, 5);
    if (hitCar.driver === 'police') reportCrime(world, 'hitPolice', hitCar.x, hitCar.y);
  }
}

function rayCircle(x, y, dx, dy, cx, cy, r) {
  const ox = cx - x;
  const oy = cy - y;
  const t = ox * dx + oy * dy;
  if (t < 0) return null;
  const px = x + dx * t;
  const py = y + dy * t;
  const distSq = (cx - px) ** 2 + (cy - py) ** 2;
  if (distSq > r * r) return null;
  return t;
}

export function hurtPlayer(world, damage) {
  const player = world.player;
  if (player.dead || world.gameOver) return;
  player.health -= damage;
  player.lastHurtAt = world.time;
}

function maintainPopulation(world, dt, random) {
  world.trafficTimer -= dt;
  if (world.trafficTimer <= 0) {
    world.trafficTimer = 0.7;
    let traffic = 0;
    for (let i = world.cars.length - 1; i >= 0; i -= 1) {
      const car = world.cars[i];
      if (car.driver !== 'traffic') continue;
      traffic += 1;
      if (Math.hypot(car.x - world.player.x, car.y - world.player.y) > 1650) {
        world.cars.splice(i, 1);
        traffic -= 1;
      }
    }
    if (traffic < 12) spawnTraffic(world, random);
  }
  world.pedTimer -= dt;
  if (world.pedTimer <= 0) {
    world.pedTimer = 0.9;
    let walkers = 0;
    for (const ped of world.peds) if (!ped.dead && !ped.cop) walkers += 1;
    if (walkers < 22) spawnPeds(world, random);
  }
}
