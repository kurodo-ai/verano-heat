// Drawing only: the world in, pixels out. A camera follows Mac through a sun-soaked pastel
// city — coral and mint rooftops with long shadows, palms on the beach, lane paint and
// crosswalks — then the HUD: health, cash, wanted stars, the objective banner, toasts, a
// minimap with police and the mission marker, and the title / pause / game-over screens.
import { CITY_NAME, FONT, GAME_TITLE, GRID, PALETTE, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MAP_W = 204;
const MAP_H = 154;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 1280, height: 720, zoom: 1, camX: 0, camY: 0 };
  view.toWorldX = (cssX) => view.camX + (cssX - view.width / 2) / view.zoom;
  view.toWorldY = (cssY) => view.camY + (cssY - view.height / 2) / view.zoom;

  const fonts = new Map();
  function font(size, weight) {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    view.zoom = Math.max(0.62, Math.min(1.12, view.width / 1280));
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function rr(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudPanel;
    rr(x, y, w, h, 10);
    ctx.fill();
  }

  // ---------- the city ----------

  function drawGround(world, left, top, right, bottom) {
    const city = world.city;
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, city.beachY);
    // The beach and the marina boardwalk along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, city.beachY, WORLD.width, WORLD.height - city.beachY);
    ctx.fillStyle = PALETTE.boardwalk;
    ctx.fillRect(0, 2500, WORLD.width, 58);
    ctx.fillStyle = PALETTE.waterEdge;
    ctx.fillRect(0, WORLD.height, WORLD.width, 10);
    // Roads first; the blocks sit between them.
    ctx.fillStyle = PALETTE.road;
    for (const ax of city.avenues) ctx.fillRect(ax - GRID.roadWidth / 2, 0, GRID.roadWidth, WORLD.height);
    for (const sy of city.streets) ctx.fillRect(0, sy - GRID.roadWidth / 2, WORLD.width, GRID.roadWidth);
    ctx.fillRect(0, 2500, WORLD.width, 58);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of city.avenues) {
      for (let y = 16; y < WORLD.height; y += 46) {
        if (city.streets.some((sy) => Math.abs(sy - y) < 78)) continue;
        ctx.fillRect(ax - 2, y, 4, 24);
      }
    }
    for (const sy of city.streets) {
      for (let x = 16; x < WORLD.width; x += 46) {
        if (city.avenues.some((ax) => Math.abs(ax - x) < 78)) continue;
        ctx.fillRect(x, sy - 2, 24, 4);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const ax of city.avenues) {
      for (const sy of city.streets) {
        for (let s = -48; s <= 48; s += 16) {
          ctx.fillRect(ax - 68, sy + s - 4, 12, 8);
          ctx.fillRect(ax + 56, sy + s - 4, 12, 8);
          ctx.fillRect(ax + s - 4, sy - 68, 8, 12);
          ctx.fillRect(ax + s - 4, sy + 56, 8, 12);
        }
      }
    }
  }

  function drawBlocks(world, left, top, right, bottom) {
    for (const block of world.city.blocks) {
      if (block.x > right || block.y > bottom || block.x + block.w < left || block.y + block.h < top) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(block.x - 6, block.y - 6, block.w + 12, block.h + 12);
      const inset = 14;
      if (block.kind === 'park') {
        ctx.fillStyle = PALETTE.grass;
        ctx.fillRect(block.x + inset, block.y + inset, block.w - inset * 2, block.h - inset * 2);
        ctx.fillStyle = PALETTE.parkPath;
        ctx.fillRect(block.x + inset, block.y + block.h / 2 - 9, block.w - inset * 2, 18);
        ctx.fillRect(block.x + block.w / 2 - 9, block.y + inset, 18, block.h - inset * 2);
      } else if (block.kind === 'parking') {
        ctx.fillStyle = '#4a4e57';
        ctx.fillRect(block.x + inset, block.y + inset, block.w - inset * 2, block.h - inset * 2);
        ctx.strokeStyle = 'rgba(232,227,208,0.5)';
        ctx.lineWidth = 2;
        for (let x = block.x + 40; x < block.x + block.w - 30; x += 74) {
          ctx.strokeRect(x - 20, block.y + 40, 40, 58);
          ctx.strokeRect(x - 20, block.y + block.h - 98, 40, 58);
        }
      } else {
        ctx.fillStyle = block.kind === 'plaza' ? PALETTE.plaza : '#c4bda6';
        ctx.fillRect(block.x + inset, block.y + inset, block.w - inset * 2, block.h - inset * 2);
      }
    }
  }

  function drawProps(world, left, top, right, bottom) {
    for (const prop of world.city.props) {
      if (prop.x < left - 40 || prop.x > right + 40 || prop.y < top - 40 || prop.y > bottom + 40) continue;
      if (prop.kind === 'palm') {
        ctx.fillStyle = 'rgba(46,32,16,0.18)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 7, prop.y + 9, 13, 6, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8a6b42';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x + 2, prop.y - 3);
        ctx.stroke();
        ctx.strokeStyle = '#3e9e4f';
        ctx.lineWidth = 3.4;
        for (let frond = 0; frond < 6; frond += 1) {
          const a = (frond / 6) * Math.PI * 2 + prop.x * 0.01;
          ctx.beginPath();
          ctx.moveTo(prop.x + 2, prop.y - 3);
          ctx.quadraticCurveTo(prop.x + 2 + Math.cos(a) * 11, prop.y - 8 + Math.sin(a) * 6, prop.x + 2 + Math.cos(a) * 19, prop.y - 1 + Math.sin(a) * 13);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#3a3f47';
        ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255,214,106,0.85)';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 4.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuildings(world, left, top, right, bottom) {
    for (const b of world.city.buildings) {
      if (b.x > right || b.y > bottom || b.x + b.w < left || b.y + b.h < top) continue;
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(b.x + 12, b.y + 16, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.roofTrim;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
      // Rooftop clutter, placed by the building's own seed so it never flickers.
      let seed = b.seed;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      ctx.fillStyle = 'rgba(90,80,60,0.35)';
      const boxes = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < boxes; i += 1) {
        const bw = 14 + rand() * 22;
        ctx.fillRect(b.x + 16 + rand() * (b.w - 40 - bw), b.y + 16 + rand() * (b.h - 40 - bw), bw, bw * 0.7);
      }
      if (b.floors >= 6) {
        ctx.fillStyle = 'rgba(70,70,80,0.4)';
        ctx.fillRect(b.x + b.w - 44, b.y + 18, 22, 22);
      }
      if (b.name) {
        ctx.save();
        ctx.globalAlpha = 0.66;
        text(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 6, Math.min(21, b.w / 9), '#4a3b28', 'center', 800);
        ctx.restore();
      }
    }
  }

  // ---------- things that move ----------

  function drawSkids(world) {
    ctx.fillStyle = 'rgba(20,18,16,0.4)';
    for (const skid of world.effects.skids) {
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.globalAlpha = Math.min(0.42, skid.life * 0.1);
      ctx.fillRect(-2.4, -7, 4.8, 14);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(30,24,14,0.28)';
    ctx.beginPath();
    ctx.ellipse(5, 8, car.model.l * 0.52, car.model.w * 0.62, car.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(car.angle);
    const { w, l } = car.model;
    // Wheels, the front pair turned with the steering.
    ctx.fillStyle = '#15161a';
    const wheel = (x, y, steer) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(steer);
      ctx.fillRect(-6, -3.4, 12, 6.8);
      ctx.restore();
    };
    wheel(l * 0.32, -w / 2 + 2, car.steerVis * 0.42);
    wheel(l * 0.32, w / 2 - 2, car.steerVis * 0.42);
    wheel(-l * 0.32, -w / 2 + 2, 0);
    wheel(-l * 0.32, w / 2 - 2, 0);
    // Body.
    ctx.fillStyle = car.health <= 0 ? '#3c3a38' : car.color;
    rr(-l / 2, -w / 2, l, w, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (car.modelId === 'interceptor') {
      ctx.fillStyle = '#eef1f5';
      rr(-l * 0.08, -w / 2 + 2, l * 0.3, w - 4, 5);
      ctx.fill();
      const phase = Math.floor(time * 5) % 2 === 0;
      ctx.fillStyle = phase ? PALETTE.policeRed : '#5b1a16';
      ctx.fillRect(-7, -w / 2 + 3, 14, 7);
      ctx.fillStyle = phase ? '#173a7a' : PALETTE.policeBlue;
      ctx.fillRect(-7, w / 2 - 10, 14, 7);
    }
    if (car.modelId === 'cab') {
      ctx.fillStyle = '#14181d';
      ctx.fillRect(-8, -9, 16, 18);
      ctx.fillStyle = '#f2b705';
      ctx.font = font(9, 800);
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    // Cabin and glass.
    ctx.fillStyle = 'rgba(16,24,34,0.88)';
    rr(-l * 0.1, -w / 2 + 5, l * 0.34, w - 10, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,200,230,0.5)';
    rr(l * 0.16, -w / 2 + 6, l * 0.07, w - 12, 3);
    ctx.fill();
    // Headlights and tail lights.
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(l / 2 - 3, -w / 2 + 4, 3, 6);
    ctx.fillRect(l / 2 - 3, w / 2 - 10, 3, 6);
    ctx.fillStyle = '#c22f2f';
    ctx.fillRect(-l / 2, -w / 2 + 4, 3, 6);
    ctx.fillRect(-l / 2, w / 2 - 10, 3, 6);
    if (car.health < 32 && car.health > 0) {
      ctx.fillStyle = 'rgba(20,18,16,0.35)';
      ctx.beginPath();
      ctx.arc(l * 0.3, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.missionCar && !car.delivered) {
      const bob = Math.sin(time * 4) * 4;
      ctx.fillStyle = PALETTE.accent;
      ctx.save();
      ctx.translate(car.x, car.y - 44 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
  }

  function drawPerson(x, y, angle, shirt, skin, options = {}) {
    ctx.fillStyle = 'rgba(30,24,14,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (options.lying) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(13, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, 3, 0, Math.PI * 2);
    ctx.fill();
    if (options.cop) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 4, y - 10, 8, 3);
    }
  }

  function drawObjectiveMarker(world) {
    const objective = world.objective;
    if (!objective || objective.hide) return;
    const bob = Math.sin(world.time * 3.4) * 5;
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 30 + Math.sin(world.time * 3.4) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.accent;
    ctx.save();
    ctx.translate(objective.x, objective.y - 52 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }

  function drawEffects(world) {
    for (const tracer of world.tracers) {
      ctx.strokeStyle = 'rgba(255,230,150,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tracer.x1, tracer.y1);
      ctx.lineTo(tracer.x2, tracer.y2);
      ctx.stroke();
    }
    for (const p of world.effects.particles) {
      const ratio = Math.max(0, p.life / p.maxLife);
      if (p.grow > 40) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = ratio;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, ratio * 1.8);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.size * (0.4 + ratio * 0.6)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------

  function drawMinimap(world) {
    const x0 = 16;
    const y0 = view.height - MAP_H - 16;
    panel(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    ctx.fillStyle = '#20242c';
    ctx.fillRect(x0, y0, MAP_W, MAP_H);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, y0 + world.city.beachY * sy, MAP_W, (WORLD.height - world.city.beachY) * sy);
    ctx.strokeStyle = 'rgba(230,225,205,0.4)';
    ctx.lineWidth = 1;
    for (const ax of world.city.avenues) {
      ctx.beginPath();
      ctx.moveTo(x0 + ax * sx, y0);
      ctx.lineTo(x0 + ax * sx, y0 + MAP_H);
      ctx.stroke();
    }
    for (const syLine of world.city.streets) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + syLine * sy);
      ctx.lineTo(x0 + MAP_W, y0 + syLine * sy);
      ctx.stroke();
    }
    const dot = (x, y, color, size) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + x * sx - size / 2, y0 + y * sy - size / 2, size, size);
    };
    for (const car of world.cars) {
      if (car.driver === 'police') dot(car.x, car.y, Math.floor(world.time * 4) % 2 ? PALETTE.policeRed : PALETTE.policeBlue, 5);
    }
    if (world.missionCar && !world.missionCar.delivered) dot(world.missionCar.x, world.missionCar.y, PALETTE.accent, 5);
    const objective = world.objective;
    if (objective && !objective.hide) dot(objective.x, objective.y, '#ffffff', 6);
    const player = world.player;
    const px = player.mode === 'car' && player.car ? player.car.x : player.x;
    const py = player.mode === 'car' && player.car ? player.car.y : player.y;
    ctx.save();
    ctx.translate(x0 + px * sx, y0 + py * sy);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.4);
    ctx.lineTo(-5, 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text('N', x0 + MAP_W - 4, y0 + 14, 11, PALETTE.hudMuted, 'right', 800);
  }

  function drawHud(world, ui) {
    const player = world.player;
    const law = world.law;
    // Health, top left.
    panel(14, 14, 218, 52);
    text('MAC DELGADO', 26, 34, 12, PALETTE.hudMuted, 'left', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(26, 42, 194, 13, 6);
    ctx.fill();
    const healthRatio = Math.max(0, player.health / 100);
    ctx.fillStyle = healthRatio > 0.5 ? '#7ddc6a' : healthRatio > 0.25 ? '#ffb52e' : PALETTE.danger;
    if (healthRatio > 0) {
      rr(26, 42, 194 * healthRatio, 13, 6);
      ctx.fill();
    }
    // Cash and stars, top right.
    const cashText = `$${world.cash.toLocaleString('en-US')}`;
    panel(view.width - 232, 14, 218, 66);
    text(cashText, view.width - 26, 46, 25, PALETTE.money, 'right', 800);
    for (let star = 0; star < 5; star += 1) {
      text('★', view.width - 122 + star * 22, 72, 19, star < law.stars ? PALETTE.accent : PALETTE.starOff, 'left', 800);
    }
    // Objective banner, top centre.
    const objective = world.objective;
    if (objective) {
      const focus = player.mode === 'car' && player.car ? player.car : player;
      const dist = objective.hide ? 0 : Math.round(Math.hypot(objective.x - focus.x, objective.y - focus.y) / 10);
      const label = objective.hide ? objective.label : `${objective.label} · ${dist}m`;
      ctx.font = font(16, 700);
      const width = Math.max(300, ctx.measureText(label).width + 56);
      panel(view.width / 2 - width / 2, 14, width, 52);
      text(objective.sub ?? '', view.width / 2, 34, 11, PALETTE.accent, 'center', 800);
      text(label, view.width / 2, 56, 16, PALETTE.hudText, 'center', 700);
      // Direction arrow at the banner when the target is off-screen.
      if (!objective.hide) drawObjectiveArrow(world);
    }
    // Toasts under the banner.
    let toastY = 84;
    for (const message of world.messages) {
      const remain = message.until - world.time;
      ctx.globalAlpha = Math.min(1, remain / 0.6);
      ctx.font = font(14, 500);
      const width = Math.min(560, Math.max(ctx.measureText(message.body).width + 40, ctx.measureText(message.title).width + 40));
      panel(view.width / 2 - width / 2, toastY, width, 46);
      text(message.title, view.width / 2, toastY + 19, 12, PALETTE.accent, 'center', 800);
      text(message.body, view.width / 2, toastY + 37, 14, PALETTE.hudText, 'center', 500);
      ctx.globalAlpha = 1;
      toastY += 54;
    }
    // Bust meter.
    if (law.bust > 0.02) {
      panel(view.width / 2 - 110, view.height - 64, 220, 40);
      text('BUSTED', view.width / 2, view.height - 38, 13, PALETTE.danger, 'center', 800);
      ctx.fillStyle = PALETTE.danger;
      rr(view.width / 2 - 96, view.height - 34, 192 * law.bust, 7, 4);
      ctx.fill();
    }
    drawMinimap(world);
    // Context hints, bottom right.
    ctx.textAlign = 'right';
    let hint = '';
    if (player.mode === 'car' && player.car) {
      const mph = Math.round(Math.abs(player.car.vx * Math.cos(player.car.angle) + player.car.vy * Math.sin(player.car.angle)) * 0.14);
      text(`${mph} mph`, view.width - 24, view.height - 58, 22, PALETTE.hudText, 'right', 800);
      hint = 'E exit · SPACE handbrake';
    } else {
      const near = nearestCar(world);
      hint = near ? `E — enter the ${near.model.name}` : player.hasGun ? 'Mouse aim · CLICK shoot · F punch' : 'Mouse aim · CLICK / F punch';
    }
    text(hint, view.width - 24, view.height - 24, 14, PALETTE.hudMuted, 'right', 600);
    text(player.mode === 'car' ? '' : player.hasGun ? 'PISTOL' : 'FISTS', view.width - 24, view.height - 58, 15, PALETTE.accent, 'right', 800);
    if (ui.muted) text('MUTED (M)', view.width - 24, 96, 12, PALETTE.hudMuted, 'right', 700);
    // Low-health pulse.
    if (player.health < 35 && !player.dead) {
      const alpha = (0.24 + 0.1 * Math.sin(world.time * 6)) * (1 - player.health / 35);
      const gradient = ctx.createRadialGradient(view.width / 2, view.height / 2, view.height * 0.36, view.width / 2, view.height / 2, view.height * 0.75);
      gradient.addColorStop(0, 'rgba(180,20,10,0)');
      gradient.addColorStop(1, `rgba(180,20,10,${alpha.toFixed(3)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  function nearestCar(world) {
    const player = world.player;
    if (player.mode !== 'foot') return null;
    let best = null;
    let bestDist = 58;
    for (const car of world.cars) {
      if (car.health <= 0 || car.driver === 'police') continue;
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  function drawObjectiveArrow(world) {
    const objective = world.objective;
    const player = world.player;
    const focus = player.mode === 'car' && player.car ? player.car : player;
    const dx = objective.x - focus.x;
    const dy = objective.y - focus.y;
    const screenDx = dx * view.zoom;
    const screenDy = dy * view.zoom;
    if (Math.abs(screenDx) < view.width / 2 - 60 && Math.abs(screenDy) < view.height / 2 - 60) return;
    const angle = Math.atan2(dy, dx);
    const ax = view.width / 2 + Math.cos(angle) * (view.width / 2 - 46);
    const ay = view.height / 2 + Math.sin(angle) * (view.height / 2 - 46);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- screens ----------

  function drawTitle(world, ui) {
    const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, 'rgba(20,10,30,0.42)');
    gradient.addColorStop(0.55, 'rgba(20,10,30,0.18)');
    gradient.addColorStop(1, 'rgba(10,8,20,0.66)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
    const cx = view.width / 2;
    text('— ' + CITY_NAME.toUpperCase() + ' —', cx, view.height * 0.24, 17, '#ffd9a0', 'center', 800);
    const titleGradient = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0);
    titleGradient.addColorStop(0, '#ffb52e');
    titleGradient.addColorStop(0.5, '#ff7847');
    titleGradient.addColorStop(1, '#ff3d77');
    ctx.font = font(84, 900);
    ctx.fillStyle = titleGradient;
    ctx.textAlign = 'center';
    ctx.fillText(GAME_TITLE, cx, view.height * 0.24 + 78);
    text('An original open-world crime story', cx, view.height * 0.24 + 112, 17, PALETTE.hudText, 'center', 500);
    text('Mac Delgado is home. Lulu Ferran has work. The VCPD has opinions.', cx, view.height * 0.24 + 142, 15, '#ffd9a0', 'center', 500);
    const lines = [
      'W A S D / arrows — walk and drive      SHIFT — sprint',
      'MOUSE — aim      CLICK — shoot      F — punch',
      'E — enter / exit a car      SPACE — handbrake',
      'P — pause      M — mute',
    ];
    let y = view.height * 0.58;
    for (const line of lines) {
      text(line, cx, y, 15, PALETTE.hudText, 'center', 600);
      y += 25;
    }
    const prompt = ui.save ? 'ENTER — continue      N — new game' : 'Press ENTER or click to start';
    text(prompt, cx, view.height * 0.82, 20, PALETTE.accent, 'center', 800);
    if (ui.save) {
      text(`Saved: $${ui.save.cash.toLocaleString('en-US')} · ${ui.save.storyDone ? 'story complete' : `job ${Math.min(4, ui.save.missionIndex + 1)} of 4`}`, cx, view.height * 0.82 + 30, 14, PALETTE.hudMuted, 'center', 600);
    }
  }

  function drawPaused(world) {
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(0, 0, view.width, view.height);
    text('PAUSED', view.width / 2, view.height * 0.4, 44, PALETTE.hudText, 'center', 900);
    text('P — resume · M — mute', view.width / 2, view.height * 0.4 + 44, 16, PALETTE.hudMuted, 'center', 600);
    text(`Cash $${world.cash.toLocaleString('en-US')} · ${world.missions.storyDone ? 'Story complete — free roam' : `On the job: ${world.objective?.sub ?? ''}`}`, view.width / 2, view.height * 0.4 + 76, 15, PALETTE.hudText, 'center', 600);
  }

  function drawOver(world) {
    const busted = world.gameOver === 'busted';
    ctx.fillStyle = busted ? 'rgba(10,16,40,0.62)' : 'rgba(40,8,8,0.62)';
    ctx.fillRect(0, 0, view.width, view.height);
    text(busted ? 'BUSTED' : 'WRECKED', view.width / 2, view.height * 0.4, 58, busted ? '#7aa2ff' : PALETTE.danger, 'center', 900);
    text(busted ? 'The VCPD impounds your pride and $200 of your cash.' : 'St. Alba patches you up. The bill is $150 and your dignity.', view.width / 2, view.height * 0.4 + 46, 16, PALETTE.hudText, 'center', 500);
    text(`Cash $${world.cash.toLocaleString('en-US')} · Earned all told $${world.stats.earned.toLocaleString('en-US')} · Cars stolen ${world.stats.stolenCars}`, view.width / 2, view.height * 0.4 + 78, 15, PALETTE.hudMuted, 'center', 600);
    text('Press ENTER to carry on', view.width / 2, view.height * 0.4 + 122, 19, PALETTE.accent, 'center', 800);
  }

  /** Paint one frame: the city from the camera, then the HUD or the screen's panel. */
  function draw(world, screen, ui) {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const shake = world.effects.shake;
    const shakeX = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    const shakeY = shake ? (Math.random() - 0.5) * 2 * shake : 0;
    view.camX = world.camera.x + shakeX / view.zoom;
    view.camY = world.camera.y + shakeY / view.zoom;
    const halfW = view.width / 2 / view.zoom;
    const halfH = view.height / 2 / view.zoom;
    const left = view.camX - halfW;
    const top = view.camY - halfH;
    const right = view.camX + halfW;
    const bottom = view.camY + halfH;

    ctx.save();
    ctx.translate(view.width / 2, view.height / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.camX, -view.camY);
    drawGround(world, left, top, right, bottom);
    drawBlocks(world, left, top, right, bottom);
    drawSkids(world);
    drawProps(world, left, top, right, bottom);
    drawObjectiveMarker(world);
    for (const ped of world.peds) {
      if (ped.dead) drawPerson(ped.x, ped.y, ped.angle, '#5a5148', ped.skin, { lying: true });
    }
    for (const car of world.cars) {
      if (car.x < left - 120 || car.x > right + 120 || car.y < top - 120 || car.y > bottom + 120) continue;
      drawCar(car, world.time);
    }
    for (const ped of world.peds) {
      if (ped.dead) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, { cop: ped.cop, lying: ped.downFor > 0 });
    }
    const player = world.player;
    if (player.mode === 'foot' && !player.dead) {
      drawPerson(player.x, player.y, player.angle, PALETTE.playerShirt, '#c98d64', {});
      if (player.hasGun) {
        ctx.strokeStyle = '#191c20';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
        ctx.lineTo(player.x + Math.cos(player.angle) * 21, player.y + Math.sin(player.angle) * 21);
        ctx.stroke();
      }
    }
    drawEffects(world);
    drawBuildings(world, left, top, right, bottom);
    ctx.restore();

    // Warm sunlight wash over everything.
    const sun = ctx.createRadialGradient(view.width / 2, view.height * 0.32, view.height * 0.3, view.width / 2, view.height / 2, view.height * 0.95);
    sun.addColorStop(0, 'rgba(255,190,90,0.05)');
    sun.addColorStop(1, 'rgba(50,20,60,0.16)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, view.width, view.height);

    if (screen === SCREEN_TITLE) {
      drawTitle(world, ui);
      return;
    }
    drawHud(world, ui);
    if (screen === SCREEN_PAUSED) drawPaused(world);
    else if (screen === SCREEN_OVER) drawOver(world);
  }

  return { draw, view };
}
