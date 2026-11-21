// The work: a four-job story Lulu Ferran feeds Mac Delgado, one objective at a time, and —
// once the story is told — the endless chop-shop loop that pays for every stolen car
// delivered to Ferran Motors in one piece. Each mission is stages: go somewhere, take
// something, bring it back, lose the heat. Objectives live on world.objective for the HUD.

export const MISSION_TITLES = ['First Lap', 'Golden Hour', 'Cool Down', 'Neon Run'];

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    needReenter: false,
    storyDone: false,
  };
}

function playerAt(world, point, dist) {
  const p = world.player;
  const x = p.mode === 'car' && p.car ? p.car.x : p.x;
  const y = p.mode === 'car' && p.car ? p.car.y : p.y;
  return Math.hypot(x - point.x, y - point.y) < dist;
}

function complete(world, missions, reward, title, body) {
  // Advance the chain first: paying out fires the autosave, and the snapshot must
  // already show the mission as done or a reload would sell the same job twice.
  missions.index += 1;
  missions.stage = 0;
  missions.timer = 0;
  missions.needReenter = false;
  if (missions.index >= MISSION_TITLES.length) missions.storyDone = true;
  world.addCash(reward);
  world.toast(title, body, 5.5);
  world.frameEvents.push('mission-complete');
}

export function updateMissions(world, dt) {
  const missions = world.missions;
  const law = world.law;
  const marks = world.city.landmarks;
  const player = world.player;
  world.objective = null;

  if (missions.storyDone) {
    updateChopShop(world);
    return;
  }

  if (missions.index === 0) {
    // First Lap: get across the city to Lulu's garage. She arms Mac at the end of it.
    world.objective = { x: marks.garage.x, y: marks.garage.y, label: 'Meet Lulu at Ferran Motors', sub: 'First Lap' };
    if (playerAt(world, marks.garage, 92)) {
      player.hasGun = true;
      complete(world, missions, 250, 'Lulu Ferran', '“You still know the way. Take this piece — Verano is not friendly.” +$250');
    }
    return;
  }

  if (missions.index === 1) {
    // Golden Hour: a gold Vireo GT at Hotel Alba, delivered home to the garage.
    const car = world.missionCar;
    if (missions.stage === 0) {
      world.objective = { x: car.x, y: car.y, label: 'Steal the gold Vireo GT at Hotel Alba', sub: 'Golden Hour' };
      if (player.mode === 'car' && player.car === car) missions.stage = 1;
    } else {
      world.objective = { x: marks.garage.x, y: marks.garage.y, label: 'Deliver the Vireo to Ferran Motors', sub: 'Golden Hour' };
      if (player.mode === 'car' && player.car === car && playerAt(world, marks.garage, 96)) {
        car.missionCar = false;
        car.delivered = true;
        car.stolen = false;
        complete(world, missions, 600, 'Lulu Ferran', '“Pristine. The buyer pays double for gold.” +$600');
      }
    }
    return;
  }

  if (missions.index === 2) {
    // Cool Down: the pier pickup is hot. Lose the heat, then lie low at the motel.
    if (missions.stage === 0) {
      world.objective = { x: marks.pier.x, y: marks.pier.y, label: 'Pick up the package at Marina Pier', sub: 'Cool Down' };
      if (playerAt(world, marks.pier, 88)) {
        law.heat = Math.max(law.heat, 250);
        law.unseenFor = 0;
        world.toast('The pickup was hot', 'Every patrol in Verano just heard your name. Lose the heat.', 5);
        world.frameEvents.push('wanted-up');
        missions.stage = 1;
      }
    } else if (missions.stage === 1) {
      world.objective = { x: player.x, y: player.y, label: 'Lose the heat', sub: 'Cool Down — break line of sight and stay hidden', hide: true };
      if (law.stars === 0) missions.stage = 2;
    } else {
      world.objective = { x: marks.motel.x, y: marks.motel.y, label: 'Lie low at the Palm Court Motel', sub: 'Cool Down' };
      if (playerAt(world, marks.motel, 92)) {
        complete(world, missions, 800, 'Lulu Ferran', '“Good. You are a ghost, Mac.” +$800');
      }
    }
    return;
  }

  // Neon Run: a depot Vireo delivered to the pier against the clock, heat held high.
  const car = world.depotCar;
  if (missions.stage === 0) {
    world.objective = { x: car.x, y: car.y, label: 'Collect the Vireo at the North Depot', sub: 'Neon Run' };
    if (player.mode === 'car' && player.car === car && !missions.needReenter) {
      missions.stage = 1;
      missions.timer = 150;
      law.forcedHeat = 190;
      world.toast('Neon Run', 'The buyer waits at the pier — and the VCPD knows the car. Move.', 5);
    }
    if (player.mode !== 'car' || player.car !== car) missions.needReenter = false;
  } else {
    missions.timer -= dt;
    law.forcedHeat = 190;
    world.objective = { x: marks.pier.x, y: marks.pier.y, label: `Deliver to Marina Pier — ${Math.max(0, Math.ceil(missions.timer))}s`, sub: 'Neon Run' };
    if (player.mode === 'car' && player.car === car && playerAt(world, marks.pier, 100)) {
      law.forcedHeat = 0;
      car.missionCar = false;
      car.delivered = true;
      car.stolen = false;
      complete(world, missions, 1500, 'Lulu Ferran', '“That is the last of it. Verano City is yours again.” +$1,500');
      world.toast('Story complete', 'Free roam: every stolen car delivered to Ferran Motors pays cash.', 6);
    } else if (missions.timer <= 0) {
      law.forcedHeat = 0;
      missions.stage = 0;
      missions.needReenter = true;
      world.toast('Too slow', 'The buyer walked. Take the depot Vireo again when you are ready.', 5);
    } else if (player.mode !== 'car' || player.car !== car) {
      // Out of the car mid-run is allowed; the clock is the only enemy.
    }
  }
}

/** After the story: any stolen car is money waiting at the garage door. */
function updateChopShop(world) {
  const player = world.player;
  const marks = world.city.landmarks;
  if (player.mode !== 'car' || !player.car) return;
  const car = player.car;
  if (!car.stolen || car.delivered || car.missionCar) return;
  world.objective = { x: marks.garage.x, y: marks.garage.y, label: `Deliver the stolen ${car.model.name} to Ferran Motors`, sub: 'Chop shop — paid by condition' };
  if (playerAt(world, marks.garage, 96)) {
    const pay = Math.round(car.model.value * (0.35 + 0.65 * (car.health / 100)));
    car.delivered = true;
    car.stolen = false;
    world.addCash(pay);
    world.toast('Ferran Motors', `“${car.model.name}, lightly used.” +$${pay}`, 4.5);
    world.frameEvents.push('chime');
  }
}
