// Keyboard and mouse input for Verano Heat. Held keys and the pointer are read as levels every
// step; one-shot presses (confirm, pause, enter a car, mute, punch) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MUTE = 8;
export const ACTION_PUNCH = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') return;
    keys.add(event.code);
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
      else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
      else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    }
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** True while a key (by KeyboardEvent.code) is held. */
    held(code) {
      return keys.has(code);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Pointer position in canvas CSS pixels, and whether the left button is held. */
    pointer() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
  };
}

/**
 * Turn raw input levels into the control object the world steps with. `view` maps canvas CSS
 * pixels to world coordinates (the renderer's camera), so the aim point lands in the world.
 */
export function buildControls(input, view) {
  const pointer = input.pointer();
  const moveX = (input.held('KeyD') || input.held('ArrowRight') ? 1 : 0) - (input.held('KeyA') || input.held('ArrowLeft') ? 1 : 0);
  const moveY = (input.held('KeyS') || input.held('ArrowDown') ? 1 : 0) - (input.held('KeyW') || input.held('ArrowUp') ? 1 : 0);
  return {
    moveX,
    moveY,
    sprint: input.held('ShiftLeft') || input.held('ShiftRight'),
    aimX: view.toWorldX(pointer.x),
    aimY: view.toWorldY(pointer.y),
    firing: pointer.down,
    throttle: (input.held('KeyW') || input.held('ArrowUp') ? 1 : 0) - (input.held('KeyS') || input.held('ArrowDown') ? 1 : 0),
    steer: (input.held('KeyD') || input.held('ArrowRight') ? 1 : 0) - (input.held('KeyA') || input.held('ArrowLeft') ? 1 : 0),
    handbrake: input.held('Space'),
  };
}
