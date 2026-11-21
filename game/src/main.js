// Boot and the one loop for Verano Heat: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title (the city drifts
// by behind it), play, paused and game over. Progress — cash, the job Mac is on, his pistol —
// is saved to this browser and offered back as Continue on the title screen.
//
// ?seed=N fixes the city's randomness. ?shot=cover|foot|mission|pier (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, buildControls, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
let world = createWorld(createRandom(seed));

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, createRandom(seed ^ 0x9e3779b9));
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { save: null, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = loadSave();
  let started = false;
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;
  let pendingInteract = false;
  let pendingPunch = false;

  world.cameraFree = true;
  world.onCashChange = () => {
    save = world.saveData();
    storeSave();
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    audio.unlock();
    if (fresh) {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Nothing to clear.
      }
      world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)));
      world.onCashChange = () => {
        save = world.saveData();
        storeSave();
      };
      save = null;
    } else if (save) {
      world.applySave(save);
    }
    world.cameraFree = false;
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    screen = SCREEN_PLAY;
    accumulator = 0;
    if (!started) {
      started = true;
      world.toast('Verano City', 'Mac Delgado is home after six years away.', 5.5);
      world.toast('Lulu Ferran', '“Garage. Now. I have work for you.”', 5.5);
    }
    announce('Playing Verano Heat.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      else if (input.held('KeyN') && save) startGame(true);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        world.respawn(world.gameOver);
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_INTERACT) pendingInteract = true;
      if (actions & ACTION_PUNCH) pendingPunch = true;
    }
  }

  function playEventSounds(events) {
    for (const event of events) {
      if (event === 'shot') audio.shot();
      else if (event === 'punch') audio.punch();
      else if (event === 'crash') audio.crash(0.7);
      else if (event === 'door') audio.door();
      else if (event === 'chime') audio.chime();
      else if (event === 'mission-complete') audio.success();
      else if (event === 'wanted-up') audio.alarm();
    }
  }

  function stepOnce() {
    const controls = buildControls(input, renderer.view);
    controls.interact = pendingInteract;
    controls.punch = pendingPunch;
    pendingInteract = false;
    pendingPunch = false;
    const events = world.step(STEP, controls);
    playEventSounds(events);
    if (world.gameOver && screen === SCREEN_PLAY) {
      screen = SCREEN_OVER;
      audio.alarm();
      announce(world.gameOver === 'busted' ? 'Busted by the VCPD.' : 'Wrecked. Taken to St. Alba Hospital.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      titleTime += frameSeconds;
      world.stepAmbient(frameSeconds);
      world.camera.x = 1800 + Math.sin(titleTime * 0.045) * 760;
      world.camera.y = 1250 + Math.cos(titleTime * 0.032) * 470;
    } else if (screen === SCREEN_PLAY) {
      accumulator += frameSeconds;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepOnce();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Standing sounds follow the frame: the engine of Mac's car, the VCPD on the air.
    let policeNear = false;
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      for (const car of world.cars) {
        if (car.driver === 'police' && Math.hypot(car.x - world.player.x, car.y - world.player.y) < 760) policeNear = true;
      }
    }
    const driving = world.player.mode === 'car' && world.player.car
      ? world.player.car.vx * Math.cos(world.player.car.angle) + world.player.car.vy * Math.sin(world.player.car.angle)
      : null;
    audio.update(frameSeconds, screen === SCREEN_PLAY ? driving : null, policeNear && screen === SCREEN_PLAY);
    renderer.draw(world, screen, { save, muted: audio.muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Verano Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

// A handle for automated play-tests: the live world, for whoever drives the browser.
window.__verano = () => world;

if (shot) runShot(shot);
else runGame();
