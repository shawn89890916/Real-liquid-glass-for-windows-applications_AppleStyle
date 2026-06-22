import './styles.css';
import { GlassRenderer } from './renderer.js';

const controlSpec = [
  { key: 'refraction', label: '折射强度', min: 8, max: 58, step: 1, unit: ' px' },
  { key: 'blur', label: '柔化', min: 0, max: 14, step: .5, unit: ' px' },
  { key: 'chromatic', label: '边缘色散', min: 0, max: 24, step: 1, unit: '' },
  { key: 'lighting', label: '动态高光', min: .2, max: 1.8, step: .05, unit: '' },
  { key: 'tint', label: '材质浓度', min: 0, max: 1, step: .05, unit: '' },
  { key: 'radius', label: '连续圆角', min: 36, max: 120, step: 1, unit: ' px' }
];

const presets = {
  clear: { refraction: 22, blur: 2, chromatic: 6, lighting: .75, tint: .15, radius: 82 },
  balanced: { refraction: 32, blur: 4, chromatic: 10, lighting: .9, tint: .35, radius: 78 },
  dense: { refraction: 46, blur: 8, chromatic: 17, lighting: 1.25, tint: .60, radius: 68 }
};

const controlsRoot = document.querySelector('#controls');
const hitarea = document.querySelector('#glass-hitarea');
const followPointer = document.querySelector('#follow-pointer');
let renderer;
let drag = null;

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

try {
  renderer = new GlassRenderer(document.querySelector('#glass-canvas'));
  syncGlass();
  renderer.render();
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

hitarea.addEventListener('pointerdown', event => {
  hitarea.setPointerCapture(event.pointerId);
  const rect = hitarea.getBoundingClientRect();
  const parent = hitarea.offsetParent.getBoundingClientRect();
  const visualLeft = rect.left - parent.left;
  const visualTop = rect.top - parent.top;
  hitarea.style.transform = 'none';
  hitarea.style.left = `${visualLeft}px`;
  hitarea.style.top = `${visualTop}px`;
  drag = { x: event.clientX, y: event.clientY, left: visualLeft, top: visualTop };
});
hitarea.addEventListener('pointermove', event => {
  if (followPointer.checked) renderer.pointer = { x: event.clientX, y: event.clientY };
  if (!drag) return;
  const parent = hitarea.offsetParent.getBoundingClientRect();
  const nextLeft = Math.max(-hitarea.clientWidth * .18, Math.min(parent.width - hitarea.clientWidth * .82, drag.left + event.clientX - drag.x));
  const nextTop = Math.max(-hitarea.clientHeight * .15, Math.min(parent.height - hitarea.clientHeight * .85, drag.top + event.clientY - drag.y));
  hitarea.style.left = `${nextLeft}px`;
  hitarea.style.top = `${nextTop}px`;
  syncGlass();
});
hitarea.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', event => {
  if (followPointer.checked && renderer) renderer.pointer = { x: event.clientX, y: event.clientY };
});
window.addEventListener('resize', () => {
  renderer?.resize();
  syncGlass();
});

document.querySelectorAll('[data-window]').forEach(button => button.addEventListener('click', () => window.desktop?.[button.dataset.window]?.()));
