// Short-lived visual juice: impact sparks, damage smoke, muzzle flashes, pickup rings,
// tyre skid marks that fade with the sun, and the camera shake a crash earns.
// The world spawns them; the renderer only reads the lists.

const MAX_PARTICLES = 420;
const MAX_SKIDS = 520;

export function createEffects() {
  const particles = [];
  const skids = [];
  let shake = 0;

  function spawn(x, y, vx, vy, life, size, color, drag = 0.92, grow = 0) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x, y, vx, vy, life, maxLife: life, size, color, drag, grow });
  }

  return {
    particles,
    skids,
    get shake() {
      return shake;
    },
    addShake(amount) {
      shake = Math.min(15, shake + amount);
    },
    sparks(x, y, count = 8) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 190;
        spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.22 + Math.random() * 0.25, 2.2, '#ffd76a');
      }
    },
    smoke(x, y, big = false) {
      spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14, -26 - Math.random() * 22, 0.8 + Math.random() * 0.7, big ? 9 : 6, 'rgba(70,70,74,0.5)', 0.98, 7);
    },
    dust(x, y) {
      spawn(x, y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.4, 5, 'rgba(216,196,145,0.55)', 0.94, 5);
    },
    muzzle(x, y, angle) {
      spawn(x, y, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.07, 7, '#ffe9a3', 0.8);
      spawn(x, y, 0, 0, 0.1, 3.4, '#fff6d8', 0.8);
    },
    ring(x, y, color = '#7ddc6a') {
      spawn(x, y, 0, 0, 0.45, 6, color, 1, 90);
    },
    fall(x, y) {
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        spawn(x, y, Math.cos(angle) * 40, Math.sin(angle) * 40, 0.3, 2.6, '#e8e3d0');
      }
    },
    addSkid(x, y, angle) {
      if (skids.length >= MAX_SKIDS) skids.shift();
      skids.push({ x, y, angle, life: 5.5 });
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.size += p.grow * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      shake = Math.max(0, shake - dt * 26);
    },
  };
}
