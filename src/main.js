import './styles.css';
import { GlassRenderer } from './renderer.js';

const controlSpec = [
  { key: 'refraction', label: '折射强度', min: 8, max: 58, step: 1, unit: ' px' },
  { key: 'blur', label: '柔化', min: 0, max: 14, step: .5, unit: ' px' },
  { key: 'chromatic', label: '边缘色散', min: 0, max: 24, step: 1, unit: '' },
  { key: 'lighting', label: '动态高光', min: .2, max: 1.8, step: .05, unit: '' },
  { key: 'tint', label: '材质浓度', min: 0, max: 1, step: .05, unit: '' },
  { key: 'radius', label: '连续圆角', min: 36, max: 120, step: 1, unit: ' px' },
  { key: 'elasticity', label: '弹性系数', min: 0, max: 0.5, step: .01, unit: '' }
];

const presets = {
  clear: { refraction: 22, blur: 2, chromatic: 6, lighting: .75, tint: .15, radius: 82, elasticity: 0.1 },
  balanced: { refraction: 32, blur: 4, chromatic: 10, lighting: .9, tint: .35, radius: 78, elasticity: 0.15 },
  dense: { refraction: 46, blur: 8, chromatic: 17, lighting: 1.25, tint: .60, radius: 68, elasticity: 0.2 }
};

const controlsRoot = document.querySelector('#controls');
const hitarea = document.querySelector('#glass-hitarea');
const followPointer = document.querySelector('#follow-pointer');
let renderer;
let drag = null;

// Physics state
const physics = {
  vx: 0,        // velocity x
  vy: 0,        // velocity y
  damping: 0.92, // friction
  bounce: 0.65,  // bounce energy retention
  lastX: 0,
  lastY: 0,
  lastTime: 0
};

function formatValue(spec, value) {
  const decimals = spec.step < 1 ? (spec.step < .1 ? 2 : 1) : 0;
  return `${Number(value).toFixed(decimals)}${spec.unit}`;
}

function syncControl(spec, input) {
  const progress = ((input.value - spec.min) / (spec.max - spec.min)) * 100;
  input.style.setProperty('--value', `${progress}%`);
  input.closest('.control-row').querySelector('output').value = formatValue(spec, input.value);
}

controlSpec.forEach(spec => {
  const row = document.createElement('div');
  row.className = 'control-row';
  row.innerHTML = `<label for="control-${spec.key}"><span>${spec.label}</span><output></output></label><input id="control-${spec.key}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" />`;
  const input = row.querySelector('input');
  input.value = presets.balanced[spec.key];
  input.addEventListener('input', () => {
    renderer.values[spec.key] = Number(input.value);
    syncControl(spec, input);
    document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
  });
  controlsRoot.append(row);
  syncControl(spec, input);
});

function applyPreset(name) {
  const preset = presets[name];
  Object.assign(renderer.values, preset);
  controlSpec.forEach(spec => {
    const input = document.querySelector(`#control-${spec.key}`);
    input.value = preset[spec.key];
    syncControl(spec, input);
  });
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', button.dataset.preset === name));
}

function syncGlass() {
  renderer?.setGlass(hitarea.getBoundingClientRect());
}

// --- Desktop capture initialization ---
async function initDesktopCapture() {
  if (!window.desktop?.getDesktopSourceId) {
    console.warn('Desktop capture not available, using fallback background');
    return;
  }
  try {
    const sourceId = await window.desktop.getDesktopSourceId();
    if (!sourceId) {
      console.warn('No desktop source found, using fallback background');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 640,
          maxWidth: 2560,
          minHeight: 360,
          maxHeight: 1440
        }
      }
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    await video.play();
    renderer.setBackdropVideo(video);
    console.log('Desktop capture initialized');
  } catch (err) {
    console.error('Desktop capture failed:', err);
  }
}

// --- Initialize renderer ---
try {
  renderer = new GlassRenderer(document.querySelector('#glass-canvas'));
  syncGlass();
  renderer.startRendering();
  initDesktopCapture();
} catch (error) {
  console.error(error);
  document.querySelector('#fallback').hidden = false;
}

document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
document.querySelector('#reset-button').addEventListener('click', () => {
  hitarea.style.left = '48%';
  hitarea.style.top = '48%';
  hitarea.style.transform = 'translate(-38%, -34%)';
  applyPreset('balanced');
  syncGlass();
});

// --- Physics-based dragging with inertia and edge bouncing ---
hitarea.addEventListener('pointerdown', event => {
  hitarea.setPointerCapture(event.pointerId);
  const rect = hitarea.getBoundingClientRect();
  const parent = hitarea.offsetParent.getBoundingClientRect();
  const visualLeft = rect.left - parent.left;
  const visualTop = rect.top - parent.top;
  hitarea.style.transform = 'none';
  hitarea.style.left = `${visualLeft}px`;
  hitarea.style.top = `${visualTop}px`;
  drag = {
    x: event.clientX, y: event.clientY,
    left: visualLeft, top: visualTop,
    startTime: performance.now()
  };
  physics.vx = 0;
  physics.vy = 0;
  physics.lastX = event.clientX;
  physics.lastY = event.clientY;
  physics.lastTime = performance.now();
});

hitarea.addEventListener('pointermove', event => {
  if (followPointer.checked) renderer.pointer = { x: event.clientX, y: event.clientY };
  if (!drag) return;

  const now = performance.now();
  const dt = Math.max(now - physics.lastTime, 1);
  const dx = event.clientX - physics.lastX;
  const dy = event.clientY - physics.lastY;

  // Track velocity (pixels per ms, scaled to per-frame)
  physics.vx = (dx / dt) * 16;
  physics.vy = (dy / dt) * 16;

  physics.lastX = event.clientX;
  physics.lastY = event.clientY;
  physics.lastTime = now;

  const parent = hitarea.offsetParent.getBoundingClientRect();
  const nextLeft = Math.max(-hitarea.clientWidth * .18, Math.min(parent.width - hitarea.clientWidth * .82, drag.left + event.clientX - drag.x));
  const nextTop = Math.max(-hitarea.clientHeight * .15, Math.min(parent.height - hitarea.clientHeight * .85, drag.top + event.clientY - drag.y));
  hitarea.style.left = `${nextLeft}px`;
  hitarea.style.top = `${nextTop}px`;
  syncGlass();
});

hitarea.addEventListener('pointerup', event => {
  if (!drag) return;
  drag = null;
  // Start inertia animation
  requestAnimationFrame(inertiaStep);
});

// --- Inertia physics: glass continues moving, bounces off edges, jelly deformation ---
function inertiaStep() {
  if (drag) return; // User is actively dragging

  const parent = hitarea.offsetParent.getBoundingClientRect();
  let left = parseFloat(hitarea.style.left) || 0;
  let top = parseFloat(hitarea.style.top) || 0;
  const w = hitarea.clientWidth;
  const h = hitarea.clientHeight;

  // Apply velocity
  left += physics.vx;
  top += physics.vy;

  // Edge collision with bounce
  const minX = -w * .18;
  const maxX = parent.width - w * .82;
  const minY = -h * .15;
  const maxY = parent.height - h * .85;

  let bounced = false;
  if (left < minX) { left = minX; physics.vx = -physics.vx * physics.bounce; bounced = true; }
  if (left > maxX) { left = maxX; physics.vx = -physics.vx * physics.bounce; bounced = true; }
  if (top < minY) { top = minY; physics.vy = -physics.vy * physics.bounce; bounced = true; }
  if (top > maxY) { top = maxY; physics.vy = -physics.vy * physics.bounce; bounced = true; }

  hitarea.style.left = `${left}px`;
  hitarea.style.top = `${top}px`;
  syncGlass();

  // Feed velocity to renderer for jelly deformation
  renderer?.setVelocity(physics.vx, physics.vy);

  // Apply damping
  physics.vx *= physics.damping;
  physics.vy *= physics.damping;

  // Continue if still moving
  if (Math.abs(physics.vx) > 0.1 || Math.abs(physics.vy) > 0.1) {
    requestAnimationFrame(inertiaStep);
  } else {
    physics.vx = 0;
    physics.vy = 0;
    renderer?.setVelocity(0, 0);
  }
}

window.addEventListener('pointermove', event => {
  if (followPointer.checked && renderer) renderer.pointer = { x: event.clientX, y: event.clientY };
});
window.addEventListener('resize', () => {
  renderer?.resize();
  syncGlass();
});

document.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => window.desktop?.[button.dataset.window]?.()));
