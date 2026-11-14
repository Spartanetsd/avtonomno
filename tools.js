// @ts-check
// Інструменти на весь екран: нічник, «Дихаємо разом», звуковий сигнал «Я тут».
// Працюють офлайн. Поки інструмент відкритий, екран не гасне (Wake Lock, якщо браузер підтримує).

import { icon, on } from './ui.js';

/** @typedef {'light'|'breathe'|'signal'} ToolKind */

/** @type {HTMLElement|null} */
let el = null;
/** @type {any} */
let lock = null;
/** @type {any} */
let audio = null;
/** @type {ReturnType<typeof setTimeout>[]} */
let timers = [];
/** @type {HTMLElement|null} */
let lastFocus = null;
let lightLevel = 1;

/** Рівні нічника: від ледь помітного теплого до яскравого. */
export const LIGHT_LEVELS = [
  { bg: 'radial-gradient(circle at 50% 42%, #4A2108, #160800 72%)', fg: '#E39A5A', label: 'Ледь-ледь' },
  { bg: 'radial-gradient(circle at 50% 42%, #E07F35, #6B2A08 78%)', fg: '#FFF1DF', label: 'Тепле' },
  { bg: 'radial-gradient(circle at 50% 42%, #FFD39A, #E39143 80%)', fg: '#2A1505', label: 'Яскравіше' },
  { bg: 'radial-gradient(circle at 50% 42%, #FFFFFF, #FFE7C4 85%)', fg: '#3A2410', label: 'Найяскравіше' },
];

/** Сигнал: 3 короткі гудки кожні SIGNAL_EVERY секунд. */
export const SIGNAL_EVERY = 10;
/** Дихання: вдих BREATH_IN с, видих BREATH_OUT с — близько 6 подихів на хвилину. */
export const BREATH_IN = 4;
export const BREATH_OUT = 6;

export function isToolOpen() {
  return !!el;
}

/** @param {ToolKind} k */
export function openTool(k) {
  if (el) closeTool();
  lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
  el = document.createElement('div');
  el.className = `tool tool-${k}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (k === 'light') renderLight();
  if (k === 'breathe') renderBreathe();
  if (k === 'signal') renderSignal();
  document.body.appendChild(el);
  setInert(true);
  keepAwake();
  /** @type {HTMLElement|null} */ (el.querySelector('[data-first]'))?.focus();
}

export function closeTool() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
  if (audio) { try { audio.close(); } catch { /* уже закрито */ } audio = null; }
  if (lock) { lock.release().catch(() => {}); lock = null; }
  el?.remove();
  el = null;
  setInert(false);
  lastFocus?.focus?.();
  lastFocus = null;
}

/** Поки інструмент відкритий, решта сторінки недоступна для фокуса й читачів екрана. @param {boolean} v */
function setInert(v) {
  document.querySelectorAll('body > header, body > main, body > nav, body > .skip, #toast').forEach((n) => {
    if (v) n.setAttribute('inert', ''); else n.removeAttribute('inert');
  });
}

async function keepAwake() {
  try {
    const wl = /** @type {any} */ (navigator).wakeLock;
    if (wl && document.visibilityState === 'visible') lock = await wl.request('screen');
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (el && document.visibilityState === 'visible') keepAwake(); });
document.addEventListener('keydown', (e) => { if (el && e.key === 'Escape') closeTool(); });

/* ───────────── Нічник ───────────── */

function renderLight() {
  if (!el) return;
  const lv = LIGHT_LEVELS[lightLevel];
  el.style.setProperty('--tool-bg', lv.bg);
  el.style.setProperty('--tool-fg', lv.fg);
  el.setAttribute('aria-label', 'Нічник');
  el.innerHTML = `<button type="button" class="tool-x" data-act="tool-close" aria-label="Закрити нічник" data-first>${icon('i-close')}</button>
    <button type="button" class="tool-area" data-act="light-next" aria-label="Змінити яскравість. Зараз: ${lv.label}"></button>
    <p class="tool-hint"><b>${lv.label}</b> · торкніться екрана, щоб змінити яскравість. Екран не згасне, поки нічник відкритий.</p>`;
}

/* ───────────── Дихаємо разом ───────────── */

function renderBreathe() {
  if (!el) return;
  el.setAttribute('aria-label', 'Дихаємо разом');
  el.style.setProperty('--br-in', `${BREATH_IN}s`);
  el.style.setProperty('--br-cycle', `${BREATH_IN + BREATH_OUT}s`);
  el.innerHTML = `<button type="button" class="tool-x" data-act="tool-close" aria-label="Закрити вправу" data-first>${icon('i-close')}</button>
    <div class="br-wrap" aria-hidden="true"><div class="br-c"></div></div>
    <p class="br-t" id="br-t">Вдих</p>
    <p class="tool-hint">Повільний вдих носом — ${BREATH_IN} секунди, видих — ${BREATH_OUT}. Дихайте разом із дитиною, тримаючи її за руку.</p>`;
  const phase = (/** @type {boolean} */ inhale) => {
    const t = document.getElementById('br-t');
    if (t) t.textContent = inhale ? 'Вдих' : 'Видих';
    timers.push(setTimeout(() => phase(!inhale), (inhale ? BREATH_IN : BREATH_OUT) * 1000));
  };
  phase(true);
}

/* ───────────── Сигнал «Я тут» ───────────── */

function renderSignal() {
  if (!el) return;
  el.setAttribute('aria-label', 'Звуковий сигнал «Я тут»');
  const AC = /** @type {any} */ (window).AudioContext || /** @type {any} */ (window).webkitAudioContext;
  let ok = false;
  if (AC) {
    try { audio = new AC(); audio.resume?.(); ok = true; } catch { audio = null; }
  }
  el.innerHTML = `<p class="sg-h">${ok ? 'Сигнал «Я тут» увімкнено' : 'Звук недоступний у цьому браузері'}</p>
    <p class="sg-n" id="sg-n">${ok ? 'Сигнал лунає' : 'Стукайте по трубах чи батареях і користуйтеся свистком'}</p>
    <p class="tool-hint">Три гучні гудки кожні ${SIGNAL_EVERY} секунд. Між ними прислухайтеся й стукайте по трубах чи батареях. Екран чорний, щоб берегти заряд.</p>
    <p class="tool-hint">На iPhone вимкніть беззвучний режим і збільште гучність — інакше сигналу не буде чути.</p>
    <button type="button" class="btn primary sg-stop" data-act="tool-close" data-first>Зупинити сигнал</button>`;
  if (!ok) return;
  let left = 0;
  const tick = () => {
    if (left <= 0) { beepBurst(); left = SIGNAL_EVERY; }
    const n = document.getElementById('sg-n');
    if (n) n.textContent = left === SIGNAL_EVERY ? 'Сигнал лунає' : `Наступний сигнал за ${left} с`;
    left--;
    timers.push(setTimeout(tick, 1000));
  };
  tick();
}

/** Три короткі гудки близько 2,8 кГц — у цьому діапазоні слух найчутливіший. */
function beepBurst() {
  if (!audio) return;
  const t0 = audio.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = 2800;
    const s = t0 + i * 0.5;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.8, s + 0.02);
    g.gain.setValueAtTime(0.8, s + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.32);
    o.connect(g).connect(audio.destination);
    o.start(s);
    o.stop(s + 0.34);
  }
}

on({
  tool: (b) => openTool(/** @type {ToolKind} */ (b.dataset.v)),
  'tool-close': () => closeTool(),
  'light-next': () => { lightLevel = (lightLevel + 1) % LIGHT_LEVELS.length; renderLight(); /** @type {HTMLElement|null} */ (el?.querySelector('.tool-area'))?.focus(); },
});
