// The screenshot scenes behind ?shot=cover|foot|mission|pier. Each one arranges the real
// world — Mac in a car the VCPD wants, on foot downtown, at the gold coupe, on the beach
// run — then plays the real rules forward a fixed number of steps with scripted controls,
// so the frame is a moment the game itself produced and the same seed gives the same frame.
import { SCREEN_PLAY } from './render.js';
import { createCar } from './vehicles.js';

function controls(patch = {}) {
  return {
    moveX: 0,
    moveY: 0,
    sprint: false,
    aimX: 0,
    aimY: 0,
    firing: false,
    throttle: 0,
    steer: 0,
    handbrake: false,
    interact: false,
    punch: false,
    ...patch,
  };
}

function putPlayerInCar(world, car, speed) {
  car.driver = 'player';
  car.parked = false;
  car.vx = Math.cos(car.angle) * speed;
  car.vy = Math.sin(car.angle) * speed;
  world.player.mode = 'car';
  world.player.car = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.camera.x = car.x;
  world.camera.y = car.y;
}

function addPolice(world, random, x, y, angle, speed) {
  const car = createCar('interceptor', x, y, angle, random, { driver: 'police' });
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  world.cars.push(car);
  return car;
}

function step(world, count, patch) {
  for (let i = 0; i < count; i += 1) world.step(1 / 60, controls(patch));
}

/** Take ambient traffic out of a rectangle, so a staged chase runs a clean corridor. */
function clearCorridor(world, x0, x1, y0, y1) {
  world.cars = world.cars.filter((car) => car.driver !== 'traffic' || car.x < x0 || car.x > x1 || car.y < y0 || car.y > y1);
}

/**
 * After the drive, tidy the chase formation around wherever the hero car ended up: hero
 * back to full health and centred in its lane, Interceptors in line on its tail.
 */
function pinChase(hero, laneX, cops) {
  hero.x = laneX;
  hero.health = 100;
  hero.vx = 0;
  hero.vy = 330; // Whatever the staging drive traded paint with, the frame is a full-speed run.
  cops.forEach((cop, i) => {
    cop.health = 100;
    cop.x = laneX - 6 + i * 48;
    cop.y = hero.y - 170 - i * 130;
    cop.angle = Math.PI / 2;
    cop.vx = 0;
    cop.vy = 322;
  });
}

/** The cover: three stars, the gold Vireo running south, Interceptors on its tail. */
function stageCover(world, random) {
  world.applySave({ cash: 1450, missionIndex: 1, storyDone: false, hasGun: true });
  clearCorridor(world, 1250, 1950, 650, 2450);
  const car = world.missionCar;
  car.x = 1558;
  car.y = 1020;
  car.angle = Math.PI / 2;
  car.health = 100000; // The staging drive may trade paint; the frame must not be a wreck.
  putPlayerInCar(world, car, 300);
  world.law.heat = 300;
  const cop1 = addPolice(world, random, 1558, 760, Math.PI / 2, 300);
  const cop2 = addPolice(world, random, 1606, 580, Math.PI / 2, 310);
  cop1.health = 100000;
  cop2.health = 100000;
  step(world, 105, { throttle: 1, steer: 0 });
  pinChase(car, 1558, [cop1, cop2]);
  world.camera.x = car.x;
  world.camera.y = car.y - 40;
  return { screen: SCREEN_PLAY };
}

/** On foot downtown: traffic rolling past, residents strolling, the garage a job away. */
function stageFoot(world, random) {
  world.applySave({ cash: 320, missionIndex: 0, storyDone: false, hasGun: true });
  const player = world.player;
  player.x = 1690;
  player.y = 1236;
  player.angle = 0.4;
  world.camera.x = player.x;
  world.camera.y = player.y;
  step(world, 80, { aimX: player.x + 300, aimY: player.y + 130 });
  return { screen: SCREEN_PLAY };
}

/** The steal: Mac at the gold Vireo in the Hotel Alba forecourt, marker up, piece drawn. */
function stageMission(world, random) {
  world.applySave({ cash: 850, missionIndex: 1, storyDone: false, hasGun: true });
  const player = world.player;
  const car = world.missionCar;
  player.x = car.x - 64;
  player.y = car.y + 26;
  player.angle = Math.atan2(car.y - player.y, car.x - player.x);
  world.camera.x = player.x + 30;
  world.camera.y = player.y;
  step(world, 50, { aimX: car.x, aimY: car.y });
  return { screen: SCREEN_PLAY };
}

/** The beach run: package objective at the pier, palms and water ahead, heat on the glass. */
function stagePier(world, random) {
  world.applySave({ cash: 2100, missionIndex: 2, storyDone: false, hasGun: true });
  clearCorridor(world, 1750, 2300, 1250, 2560);
  const car = createCar('meridian', 1998, 1740, Math.PI / 2, random, { owned: true, color: '#8d2f35' });
  car.health = 100000;
  world.cars.push(car);
  putPlayerInCar(world, car, 295);
  world.law.heat = 130;
  const cop = addPolice(world, random, 1998, 1470, Math.PI / 2, 290);
  cop.health = 100000;
  step(world, 100, { throttle: 1, steer: 0 });
  pinChase(car, 1998, [cop]);
  world.camera.x = car.x;
  world.camera.y = car.y - 40;
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene (cover, foot, mission or pier; any other name is cover)
 * and return the screen to draw over it.
 */
export function stageShot(name, world, random) {
  if (name === 'foot') return stageFoot(world, random);
  if (name === 'mission') return stageMission(world, random);
  if (name === 'pier') return stagePier(world, random);
  return stageCover(world, random);
}
