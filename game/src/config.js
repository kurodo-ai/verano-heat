// Verano Heat — every tuning number, name and colour in one place.
// An original open-world crime game: the sun-soaked coastal city of Verano City,
// its wheelman Mac Delgado, and the fixer Lulu Ferran who feeds him work.
// Nothing here depends on the display size; the renderer scales the canvas.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city, in world pixels. The south edge is the beach and the marina. */
export const WORLD = { width: 3600, height: 2700 };

/** Road grid: avenues run north-south, streets east-west, evenly spaced over the city. */
export const GRID = {
  origin: 260,
  spacing: 440,
  avenues: 8,
  streets: 6,
  roadWidth: 168,
  laneOffset: 22,
  sidewalk: 16,
};

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'verano-heat.save.v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 196,
  sprintSpeed: 292,
  accel: 1500,
  maxHealth: 100,
  regenDelay: 6,
  regenRate: 9,
  punchRange: 52,
  punchDamage: 34,
  punchCooldown: 0.34,
  gunRange: 560,
  gunDamage: 55,
  gunCooldown: 0.21,
};

/** Car models of Verano City: invented names, arcade manners. w/l are the body's width/length. */
export const CAR_MODELS = {
  pico: { name: 'Pico Hatch', w: 36, l: 66, maxSpeed: 330, reverse: 130, accel: 250, grip: 5.2, value: 900, colors: ['#b8bec9', '#7fa6c9', '#c95f4e', '#8fbf7f', '#d9c25a'] },
  meridian: { name: 'Meridian Sedan', w: 38, l: 76, maxSpeed: 385, reverse: 145, accel: 285, grip: 5.6, value: 1600, colors: ['#33404f', '#6b7c8d', '#8d2f35', '#274e13', '#c0c6cc', '#513b75'] },
  vireo: { name: 'Vireo GT Coupe', w: 38, l: 78, maxSpeed: 470, reverse: 160, accel: 360, grip: 6.1, value: 3400, colors: ['#e0a81c', '#c22f4e', '#2255a4', '#101216', '#e8e8ec'] },
  hauler: { name: 'Hauler Pickup', w: 42, l: 86, maxSpeed: 340, reverse: 140, accel: 240, grip: 4.6, value: 1900, colors: ['#7a4a21', '#4a6741', '#5b6ee1', '#999999'] },
  cab: { name: 'City Cab', w: 38, l: 76, maxSpeed: 375, reverse: 145, accel: 280, grip: 5.5, value: 1500, colors: ['#f2b705'] },
  interceptor: { name: 'VCPD Interceptor', w: 39, l: 79, maxSpeed: 462, reverse: 155, accel: 345, grip: 6.0, value: 0, colors: ['#14181d'] },
};

/** Wanted heat: crimes add points, hiding lets them cool. Stars are derived from heat. */
export const HEAT = {
  perStar: 120,
  maxStars: 5,
  carjack: 90,
  hitCar: 26,
  hitPed: 75,
  killPed: 165,
  gunshot: 20,
  hitPolice: 85,
  ramPolice: 40,
  decayDelay: 4,
  decayRate: 15,
  witnessRange: 330,
  seenRange: 430,
};

/** Sun-soaked pastel palette: coral, mint, cream and teal over warm asphalt. */
export const PALETTE = {
  water: '#1f9db4',
  waterEdge: '#57c7d4',
  sand: '#ecd9a0',
  boardwalk: '#c9a06a',
  grass: '#79b657',
  parkPath: '#d8c491',
  road: '#3c4048',
  roadEdge: '#2e3238',
  lane: '#e8e3d0',
  crosswalk: '#d9d5c7',
  sidewalk: '#cfc7b4',
  curb: '#b3aa97',
  plaza: '#ddd2b8',
  buildingShadow: 'rgba(46,32,16,0.20)',
  roofTrim: 'rgba(0,0,0,0.16)',
  playerShirt: '#0e7c86',
  playerSkin: '#c98d64',
  hudPanel: 'rgba(12,16,22,0.62)',
  hudText: '#f5f1e6',
  hudMuted: '#b9bfae',
  accent: '#ffb52e',
  danger: '#ff5347',
  policeBlue: '#2e6fe8',
  policeRed: '#ff3b30',
  money: '#7ddc6a',
  starOff: 'rgba(245,241,230,0.25)',
};

export const ROOF_COLORS = ['#f2e3c6', '#eec9a3', '#dfe8dd', '#f4b8a0', '#bfe0d8', '#f7d774', '#e8a2b4', '#c3d4ea', '#f0ead8', '#d9b8e6'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const GAME_TITLE = 'VERANO HEAT';
export const CITY_NAME = 'Verano City';
