// The law of Verano City: a heat meter fed by witnessed crimes, stars derived from it, a
// police director that sends Interceptors in proportion to the stars and pulls them back
// when the trail cools, foot cops near a runner, and the bust that ends a chase on foot.
import { HEAT } from './config.js';
import { lineOfSight } from './city.js';
import { createCar } from './vehicles.js';
import { createPed } from './people.js';

export const CRIME_AMOUNTS = {
  carjack: HEAT.carjack,
  hitCar: HEAT.hitCar,
  hitPed: HEAT.hitPed,
  killPed: HEAT.killPed,
  gunshot: HEAT.gunshot,
  hitPolice: HEAT.hitPolice,
  ramPolice: HEAT.ramPolice,
  assault: 60,
};

export function createLaw() {
  return {
    heat: 0,
    stars: 0,
    unseenFor: 0,
    bust: 0,
    spawnTimer: 0,
    forcedHeat: 0,
  };
}

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(HEAT.maxStars, 1 + Math.floor(heat / HEAT.perStar));
}

function playerPos(world) {
  const p = world.player;
  return p.mode === 'car' && p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

/** Anyone in a position to tell the VCPD what just happened at (x, y)? */
export function witnessed(world, x, y) {
  const city = world.city;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < HEAT.witnessRange && lineOfSight(city, ped.x, ped.y, x, y)) return true;
  }
  for (const car of world.cars) {
    if (car.driver !== 'police' || car.health <= 0) continue;
    if (Math.hypot(car.x - x, car.y - y) < HEAT.witnessRange + 60) return true;
  }
  return false;
}

/**
 * Report a crime at a place. Unwitnessed crime is free crime — that is the whole game of
 * losing the heat — so heat only lands when someone could have seen it.
 */
export function reportCrime(world, kind, x, y) {
  if (!witnessed(world, x, y)) return false;
  world.law.heat = Math.min(HEAT.perStar * HEAT.maxStars + 119, world.law.heat + (CRIME_AMOUNTS[kind] ?? 20));
  world.law.unseenFor = 0;
  return true;
}

/** Is any police unit close enough, with a view, to keep the heat from cooling? */
function policeWatching(world) {
  const pos = playerPos(world);
  const city = world.city;
  for (const car of world.cars) {
    if (car.driver !== 'police' || car.health <= 0) continue;
    if (Math.hypot(car.x - pos.x, car.y - pos.y) < HEAT.seenRange && lineOfSight(city, car.x, car.y, pos.x, pos.y)) return true;
  }
  for (const ped of world.peds) {
    if (!ped.cop || ped.dead) continue;
    if (Math.hypot(ped.x - pos.x, ped.y - pos.y) < 240) return true;
  }
  return false;
}

function spawnPoliceCar(world, random) {
  const pos = playerPos(world);
  // Come from a road junction a few blocks away, never from inside the player's view.
  for (let tries = 0; tries < 8; tries += 1) {
    const ax = random.pick(world.city.avenues);
    const sy = random.pick(world.city.streets);
    const dist = Math.hypot(ax - pos.x, sy - pos.y);
    if (dist < 640 || dist > 1250) continue;
    const car = createCar('interceptor', ax, sy, random.range(0, Math.PI * 2), random, { driver: 'police' });
    world.cars.push(car);
    return car;
  }
  return null;
}

export function updateLaw(world, dt, random) {
  const law = world.law;
  const events = world.frameEvents;
  if (law.forcedHeat > 0) law.heat = Math.max(law.heat, law.forcedHeat);

  if (policeWatching(world)) law.unseenFor = 0;
  else law.unseenFor += dt;
  if (law.unseenFor > HEAT.decayDelay && law.heat > 0) {
    law.heat = Math.max(0, law.heat - HEAT.decayRate * dt);
  }

  const stars = starsForHeat(law.heat);
  if (stars !== law.stars) {
    if (stars > law.stars) events.push('wanted-up');
    law.stars = stars;
  }

  // The director: Interceptors in proportion to the stars, thinned out when it cools.
  const wanted = law.stars === 0 ? 0 : law.stars + 1;
  let units = 0;
  for (const car of world.cars) if (car.driver === 'police' && car.health > 0) units += 1;
  law.spawnTimer -= dt;
  if (units < wanted && law.spawnTimer <= 0) {
    if (spawnPoliceCar(world, random)) law.spawnTimer = 1.4;
    else law.spawnTimer = 0.5;
  }
  const pos = playerPos(world);
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.driver !== 'police') continue;
    const dist = Math.hypot(car.x - pos.x, car.y - pos.y);
    if ((law.stars === 0 && dist > 620) || dist > 1750) world.cars.splice(i, 1);
  }

  // Foot cops: out of a stopped Interceptor near a player on foot, back in when it ends.
  const player = world.player;
  if (player.mode === 'foot' && law.stars > 0) {
    for (const car of world.cars) {
      if (car.driver !== 'police' || car.health <= 0 || car.copOut) continue;
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (dist < 250 && Math.hypot(car.vx, car.vy) < 42) {
        car.copOut = true;
        world.peds.push(createPed(car.x + 20, car.y, random, { cop: true, carId: car.id }));
      }
    }
  }

  // The bust: a cop's hands, or a boxed-in stop, held for a couple of seconds.
  if (player.mode === 'foot' && law.stars > 0 && !player.dead) {
    let grabbed = false;
    for (const ped of world.peds) {
      if (ped.cop && !ped.dead && Math.hypot(ped.x - player.x, ped.y - player.y) < 30) grabbed = true;
    }
    for (const car of world.cars) {
      if (car.driver === 'police' && Math.hypot(car.x - player.x, car.y - player.y) < 58 && Math.hypot(car.vx, car.vy) < 30 && Math.hypot(player.vx, player.vy) < 30) grabbed = true;
    }
    law.bust = grabbed ? Math.min(1, law.bust + dt / 2.1) : Math.max(0, law.bust - dt * 1.6);
    if (law.bust >= 1 && !world.gameOver) {
      world.gameOver = 'busted';
      events.push('busted');
    }
  } else {
    law.bust = Math.max(0, law.bust - dt * 2);
  }
}
