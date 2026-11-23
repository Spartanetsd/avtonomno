// @ts-check
// Екран «72 години»: сценарій, часова шкала, до трьох дій і ризиків на етап,
// точні розрахунки води й енергії, параметри, збереження, експорт та імпорт.

import * as store from './store.js';
import { SOURCES } from './data.js';
import { DEVICE_PRESETS, WATER_PRESETS, fmt, fmtHours } from './calc.js';
import { STAGES, STAGE_LABEL, SCENARIOS, SOURCE_KINDS, UNIT_LABEL, simulate, remainingAt, stageForElapsed, newSource, exportSim, importSim, simDefaults, cleanSim } from './sim.js';
import { app, on, esc, icon, pageHead, seg, bindNumField, keepInPlace } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./sim.js').SimState} SimState */

const LEVEL_ICON = { danger: 'i-alert', caution: 'i-warn', info: 'i-info' };

/** @returns {SimState} */
const S = () => store.get().sim;

/** Етап, який показуємо: під час відліку — поточний за часом, інакше — вибраний. */
function shownStage() {
  const s = S();
  if (s.startAt != null) return stageForElapsed((Date.now() - s.startAt) / 3600000);
  return s.stage;
}

/** @returns {View} */
function simView() {
  const s = S();
  const m = simulate(s);
  const st = shownStage();
  return {
    title: '72 години',
    tab: 'home',
    html: `${pageHead('72 години', '#/', 'Що робити в перші три доби — за вашими даними')}
    <div class="sim-scen">${seg('sim-scen', Object.entries(SCENARIOS).map(([v, x]) => ({ v, label: x.label })), s.scen, 'Сценарій')}</div>
    <div id="sim-clock">${clockHtml()}</div>
    <nav class="sim-line" aria-label="Етапи">${STAGES.map((_t, i) => {
      const [n, u] = STAGE_LABEL[i].split(' ');
      return `<button type="button" class="sim-dot${i === st ? ' on' : ''}${i < st ? ' past' : ''}" data-act="sim-stage" data-v="${i}" aria-pressed="${i === st}" aria-label="Етап ${esc(STAGE_LABEL[i])}"><b>${esc(n)}</b><span>${esc(u)}</span></button>`;
    }).join('')}</nav>
    <div id="sim-out" aria-live="polite">${outHtml(m, st)}</div>
    <h2 class="h2">Ваші дані</h2>
    ${formHtml(s)}
    <section class="card">
      <h2>Файл симуляції</h2>
      <p class="muted">Дані зберігаються на цьому пристрої й відновлюються після перезапуску. Файл — щоб перенести чи зберегти копію.</p>
      <div class="row-btns">
        <button class="btn ghost" type="button" data-act="sim-export">${icon('i-download')}<span>Експорт JSON</span></button>
        <label class="btn ghost" for="sim-file">${icon('i-upload')}<span>Імпорт JSON</span></label>
        <input id="sim-file" type="file" accept="application/json,.json" class="sr-only">
      </div>
      <button class="btn danger-ghost" type="button" data-act="sim-reset">${icon('i-trash')}<span>Почати з нуля</span></button>
    </section>`,
    after() { bindForm(); startTicker(); },
  };
}

/** Відлік часу від початку відключення. */
function clockHtml() {
  const s = S();
  if (s.startAt == null) return `<div class="sim-clock"><span class="muted">Відключення почалося зараз?</span><button class="btn small primary" type="button" data-act="sim-start">${icon('i-clock')}<span>Почати відлік</span></button></div>`;
  const h = (Date.now() - s.startAt) / 3600000;
  return `<div class="sim-clock on"><span>${icon('i-hourglass')}Минуло <b>${esc(h < 1 / 60 ? 'менше хвилини' : fmtHours(h))}</b> · етап «${esc(STAGE_LABEL[stageForElapsed(h)])}»</span><button class="btn small ghost" type="button" data-act="sim-stop">Зупинити</button></div>`;
}

/** @param {string[]} keys */
function srcOrgs(keys) {
  return [...new Set(keys.map((k) => SOURCES[k]?.org).filter(Boolean))].join(', ');
}

/** Результати: етап, що лишилося, розрахунки. @param {ReturnType<typeof simulate>} m @param {number} i */
function outHtml(m, i) {
  const stage = m.stages[i];
  const rem = remainingAt(m, stage.t);
  const allSrc = [...new Set([...stage.actions, ...stage.risks].flatMap((x) => x.src))];
  const remItems = [];
  if (rem.drink != null) remItems.push(`<li>${icon('i-drop')}<span>Питна вода: <b>${fmt(rem.drink, 1)} л</b></span></li>`);
  if (rem.tech != null) remItems.push(`<li>${icon('i-drop')}<span>Технічна: <b>${fmt(rem.tech, 1)} л</b></span></li>`);
  for (const x of rem.sources) remItems.push(`<li>${icon('i-battery')}<span>${esc(x.name)}: <b>${x.wh == null ? 'не пораховано' : `${fmt(x.wh)} Вт·год${x.pct != null ? ` · ${fmt(x.pct, 0)} %` : ''}`}</b></span></li>`);
  return `${m.errors.length ? `<div class="note caution"><div class="note-h">${icon('i-warn')}<span class="note-l">Перевірте дані</span></div><ul>${m.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
  <section class="card sim-stage" aria-labelledby="sim-st-h">
    <h2 id="sim-st-h">${esc(stage.label)} · ${esc(m.scen.label.toLowerCase())}</h2>
    <h3>Найважливіше</h3>
    ${stage.actions.length ? `<ol class="now-list">${stage.actions.map((a, n) => `<li><span class="n" aria-hidden="true">${n + 1}</span><span>${esc(a.text)}</span></li>`).join('')}</ol>` : '<p class="muted">На цьому етапі нових дій немає — продовжуйте попередні.</p>'}
    <h3>Ризики</h3>
    ${stage.risks.length ? `<ul class="sim-risks">${stage.risks.map((r) => `<li class="${r.level}">${icon(LEVEL_ICON[/** @type {'info'} */ (r.level || 'info')])}<span>${esc(r.text)}</span></li>`).join('')}</ul>` : '<p class="muted">Особливих ризиків на цьому етапі не видно з ваших даних.</p>'}
    ${allSrc.length ? `<p class="hint">Джерела: ${esc(srcOrgs(allSrc))}. Посилання — у «Розрахунках».</p>` : ''}
  </section>
  ${remItems.length ? `<section class="card sim-rem" aria-labelledby="sim-rem-h"><h3 id="sim-rem-h">Що лишиться на ${esc(stage.label)}</h3><ul class="sim-reml">${remItems.join('')}</ul></section>` : ''}
  ${calcHtml(m, allSrc)}`;
}

/** @param {ReturnType<typeof simulate>} m @param {string[]} srcKeys */
function calcHtml(m, srcKeys) {
  const w = /** @type {any} */ (m.water);
  const blocks = [];
  if (w.ok) blocks.push(`<h3>Вода</h3><ol>${w.steps.map((/** @type {string} */ x) => `<li>${esc(x)}</li>`).join('')}</ol>`);
  for (const x of m.sources) {
    const c = /** @type {any} */ (x.calc);
    blocks.push(`<h3>${esc(x.src.name)}</h3>${c.ok ? `<ol>${c.steps.map((/** @type {string} */ t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
      ${c.need.length ? `<p class="warnline">${icon('i-info')}<span>Щоб порахувати точно, вкажіть: ${esc(c.need.join('; '))}. Без цього час роботи не обіцяю.</span></p>` : ''}
      ${c.compat.map((/** @type {any} */ k) => `<p class="warnline ${k.level}">${icon(LEVEL_ICON[/** @type {'info'} */ (k.level)])}<span>${esc(k.text)}</span></p>`).join('')}`);
  }
  if (!m.sources.length) blocks.push(`<p class="muted">Джерел енергії не додано. Додайте павербанк чи станцію — порахую запас у Вт·год і час роботи приладів.</p>`);
  const keys = [...new Set([...srcKeys, 'readyOutage', 'cdcFood', 'sphere'])];
  return `<details class="card fold sim-calc"><summary>${icon('i-calc')}<span>Розрахунки й джерела</span></summary>
    ${blocks.join('')}
    <p class="hint">Вт — потужність приладу, Вт·год — запас енергії. Відсоток заряду без ємності не каже, на скільки вистачить.</p>
    <h3>Джерела</h3>
    <ul class="sources">${keys.map((k) => SOURCES[k]).filter(Boolean).map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${icon('i-ext')}<span><b>${esc(x.org)}</b> — ${esc(x.title)}</span></a></li>`).join('')}</ul>
  </details>`;
}

/* ───────────── Форма ───────────── */

/** @param {string} key @param {string} label @param {string} value @param {string} [unit] @param {string} [rules] @param {string} [hint] */
function field(key, label, value, unit = '', rules = '', hint = '') {
  const id = `sim-${key.replace(/[^\w-]/g, '-')}`;
  return `<div class="field"><label for="${id}">${esc(label)}</label>
    <div class="inrow"><input id="${id}" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" data-sim="${key}" data-opt="1" ${rules} value="${esc(value)}"${hint ? ` aria-describedby="${id}-h"` : ''}>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>
    ${hint ? `<p class="hint" id="${id}-h">${esc(hint)}</p>` : ''}</div>`;
}

/** @param {string} key @param {string} label @param {boolean} on */
function check(key, label, on) {
  return `<label class="check"><input type="checkbox" data-simc="${key}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

/** @param {SimState} s */
function formHtml(s) {
  const kinds = /** @type {(keyof typeof SOURCE_KINDS)[]} */ (Object.keys(SOURCE_KINDS));
  return `<details class="card fold sim-f" open><summary>${icon('i-heart')}<span>Люди й тварини</span></summary>
      <div class="grid3">${field('adults', 'Дорослі', s.adults, '', 'data-min="0" data-max="50" data-int="1"')}${field('kids', 'Діти', s.kids, '', 'data-min="0" data-max="50" data-int="1"')}${field('elderly', 'Літні', s.elderly, '', 'data-min="0" data-max="50" data-int="1"')}</div>
      ${check('infant', 'Є дитина до 1 року', s.infant)}
      ${field('petKg', 'Тварини, загальна маса', s.petKg, 'кг', 'data-min="0" data-max="500"')}
    </details>
    <details class="card fold sim-f" open><summary>${icon('i-drop')}<span>Вода</span></summary>
      <div class="grid2">${field('drink', 'Питна', s.drink, 'л', 'data-min="0" data-max="100000"')}${field('tech', 'Технічна', s.tech, 'л', 'data-min="0" data-max="100000"')}</div>
      <div class="field"><span class="lbl">Норма на людину</span>${seg('sim-norm', WATER_PRESETS.map((p) => ({ v: p.id, label: p.label })), s.norm, 'Норма води')}<p class="hint">${esc((WATER_PRESETS.find((p) => p.id === s.norm) || WATER_PRESETS[0]).note)}</p></div>
      ${check('hot', 'Спека: пити потрібно вдвічі більше', s.hot)}
    </details>
    <details class="card fold sim-f"><summary>${icon('i-snow')}<span>Їжа й ліки</span></summary>
      ${check('fridge', 'У холодильнику є швидкопсувне', s.fridge)}
      <div class="field"><span class="lbl">Морозильник</span>${seg('sim-ice', [{ v: 'full', label: 'Повний' }, { v: 'half', label: 'Наполовину' }, { v: 'none', label: 'Порожній' }], s.icebox, 'Морозильник')}</div>
      ${check('cooler', 'Є термосумка з льодом чи холодними акумуляторами', s.cooler)}
      ${check('meds', 'Є ліки, що потребують холоду', s.meds)}
    </details>
    <details class="card fold sim-f"><summary>${icon('i-thermo')}<span>Температура</span></summary>
      ${field('roomC', 'У кімнаті зараз', s.roomC, '°C', 'data-min="-40" data-max="60"', 'Міряйте термометром. Як швидко холоне житло, залежить від будинку й погоди — тут цього не прогнозуємо.')}
    </details>
    <details class="card fold sim-f"${s.sources.length || !SCENARIOS[s.scen].power ? ' open' : ''}><summary>${icon('i-battery')}<span>Джерела енергії${s.sources.length ? ` · ${s.sources.length}` : ''}</span></summary>
      ${s.sources.map((x, i) => sourceHtml(x, i)).join('')}
      <div class="sim-add">${kinds.map((k) => `<button class="btn small ghost" type="button" data-act="sim-src-add" data-v="${k}">${icon('i-plus')}<span>${esc(SOURCE_KINDS[k].label)}</span></button>`).join('')}</div>
    </details>
    <details class="card fold sim-f"${s.devices.length || (s.sources.length && !SCENARIOS[s.scen].power) ? ' open' : ''}><summary>${icon('i-bolt')}<span>Пристрої${s.devices.length ? ` · ${s.devices.length}` : ''}</span></summary>
      ${s.devices.map((x, i) => deviceHtml(x, i, s)).join('')}
      <div class="sim-add">${DEVICE_PRESETS.map((p, i) => `<button class="btn small ghost" type="button" data-act="sim-dev-add" data-v="${i}">${icon('i-plus')}<span>${esc(p.name)}</span></button>`).join('')}<button class="btn small ghost" type="button" data-act="sim-dev-add" data-v="-1">${icon('i-plus')}<span>Інший</span></button></div>
      <p class="hint">Потужність (Вт) — на корпусі чи в інструкції приладу. Критичний — без нього не можна (наприклад, медичний).</p>
    </details>`;
}

/** @param {import('./sim.js').SimSource} x @param {number} i */
function sourceHtml(x, i) {
  return `<div class="sim-item" id="sim-src-${i}">
    <div class="sim-ih"><b>${esc(SOURCE_KINDS[x.kind].label)}</b><button class="iconbtn" type="button" data-act="sim-src-del" data-v="${i}" aria-label="Прибрати джерело ${esc(x.name)}">${icon('i-trash')}</button></div>
    <div class="field"><label for="sim-s${i}-name">Назва</label><input id="sim-s${i}-name" type="text" maxlength="40" enterkeyhint="done" data-simt="s.${i}.name" value="${esc(x.name)}"></div>
    <div class="grid2">
      ${field(`s.${i}.cap`, 'Ємність', x.cap, UNIT_LABEL[x.unit], 'data-min="0" data-max="10000000"')}
      <div class="field"><label for="sim-s${i}-unit">Одиниця</label><select id="sim-s${i}-unit" data-sims="s.${i}.unit">${['Wh', 'Ah', 'mAh'].map((u) => `<option value="${u}"${x.unit === u ? ' selected' : ''}>${UNIT_LABEL[/** @type {'Wh'} */ (u)]}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      ${x.unit !== 'Wh' ? field(`s.${i}.v`, 'Напруга', x.v, 'В', 'data-min="0" data-max="1000"') : ''}
      ${field(`s.${i}.pct`, 'Заряд зараз', x.pct, '%', 'data-min="0" data-max="100"')}
      ${field(`s.${i}.k`, 'ККД', x.k, '', 'data-min="0.05" data-max="100"')}
      ${field(`s.${i}.outW`, 'Вихід, макс.', x.outW, 'Вт', 'data-min="0" data-max="100000"')}
    </div>
  </div>`;
}

/** @param {import('./sim.js').SimDevice} x @param {number} i @param {SimState} s */
function deviceHtml(x, i, s) {
  return `<div class="sim-item" id="sim-dev-${i}">
    <div class="sim-ih"><input type="text" maxlength="40" enterkeyhint="done" aria-label="Назва пристрою" data-simt="d.${i}.name" value="${esc(x.name)}"><button class="iconbtn" type="button" data-act="sim-dev-del" data-v="${i}" aria-label="Прибрати пристрій ${esc(x.name)}">${icon('i-trash')}</button></div>
    <div class="grid2">
      ${field(`d.${i}.w`, 'Потужність', x.w, 'Вт', 'data-min="0" data-max="100000"')}
      ${field(`d.${i}.h`, 'Годин на добу', x.h, 'год', 'data-min="0" data-max="24"')}
    </div>
    <div class="field"><label for="sim-d${i}-src">Живлення від</label><select id="sim-d${i}-src" data-sims="d.${i}.src"><option value="-1"${x.src < 0 ? ' selected' : ''}>Не підключено</option>${s.sources.map((src, j) => `<option value="${j}"${x.src === j ? ' selected' : ''}>${esc(src.name)}</option>`).join('')}</select></div>
    ${check(`d.${i}.crit`, 'Критичний пристрій', x.crit)}
  </div>`;
}

/* ───────────── Прив’язка полів і оновлення ───────────── */

/**
 * Записує значення за шляхом: «drink», «s.0.cap», «d.2.name».
 * @param {SimState} s @param {string} path @param {any} value
 */
function setPath(s, path, value) {
  const [a, b, c] = path.split('.');
  if (a === 's' && s.sources[Number(b)]) /** @type {any} */ (s.sources[Number(b)])[c] = value;
  else if (a === 'd' && s.devices[Number(b)]) /** @type {any} */ (s.devices[Number(b)])[c] = value;
  else if (!b) /** @type {any} */ (s)[a] = value;
}

/** Перераховує лише результати — форма й фокус не змінюються. */
function refresh() {
  const m = simulate(S());
  const out = document.getElementById('sim-out');
  if (out) out.innerHTML = outHtml(m, shownStage());
}

/** Зберігає й перевіряє стан симуляції. @param {(s: SimState) => void} fn */
function change(fn) {
  store.update((d) => {
    fn(d.sim);
    d.sim = cleanSim(d.sim);
  });
}

function bindForm() {
  document.querySelectorAll('input[data-sim]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const path = inp.dataset.sim || '';
    bindNumField(inp, (value) => keepInPlace(inp, () => { change((s) => setPath(s, path, value.slice(0, 12))); refresh(); }));
  });
  document.querySelectorAll('input[data-simt]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const path = inp.dataset.simt || '';
    inp.addEventListener('input', () => { change((s) => setPath(s, path, inp.value.slice(0, 40))); });
    inp.addEventListener('change', () => keepInPlace(inp, () => refresh()));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });
  document.querySelectorAll('input[data-simc]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const path = inp.dataset.simc || '';
    inp.addEventListener('change', () => keepInPlace(inp, () => { change((s) => setPath(s, path, inp.checked)); refresh(); }));
  });
  document.querySelectorAll('select[data-sims]').forEach((el) => {
    const sel = /** @type {HTMLSelectElement} */ (el);
    const path = sel.dataset.sims || '';
    sel.addEventListener('change', () => {
      change((s) => setPath(s, path, path.endsWith('.src') ? Number(sel.value) : sel.value));
      // Зміна одиниці змінює набір полів — перебудовуємо сторінку
      if (path.endsWith('.unit')) { app.render(); /** @type {HTMLElement|null} */ (document.getElementById(sel.id))?.focus(); } else keepInPlace(sel, () => refresh());
    });
  });
  const f = /** @type {HTMLInputElement|null} */ (document.getElementById('sim-file'));
  f?.addEventListener('change', () => {
    const file = f.files && f.files[0];
    if (file) readFile(file);
    f.value = '';
  });
}

/** Оновлює відлік щохвилини, поки екран відкритий. @type {ReturnType<typeof setInterval>|null} */
let ticker = null;
function startTicker() {
  if (ticker) clearInterval(ticker);
  if (S().startAt == null) return;
  let last = shownStage();
  ticker = setInterval(() => {
    const clock = document.getElementById('sim-clock');
    if (!clock || S().startAt == null) { if (ticker) clearInterval(ticker); ticker = null; return; }
    clock.innerHTML = clockHtml();
    const now = shownStage();
    if (now !== last) { last = now; app.render(); }
  }, 30000);
}

/** Відкладене скасування «Почати з нуля» та імпорту. @type {SimState|null} */
let undo = null;

/** @param {File} file */
function readFile(file) {
  if (file.size > 512 * 1024) { app.toast('Файл завеликий (понад 512 КБ).'); return; }
  const r = new FileReader();
  r.onload = () => {
    const res = importSim(String(r.result || ''));
    if ('error' in res) { app.toast(`Не вдалося імпортувати: ${res.error}`); return; }
    undo = JSON.parse(JSON.stringify(S()));
    store.update((d) => { d.sim = res.sim; });
    app.render();
    app.toast('Симуляцію відкрито з файлу', { action: 'sim-undo', label: 'Скасувати' });
  };
  r.onerror = () => app.toast('Не вдалося прочитати файл.');
  r.readAsText(file);
}

async function exportFile() {
  const payload = JSON.stringify(exportSim(S()), null, 2);
  const name = `avtonomno-72-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([payload], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    const nav = /** @type {any} */ (navigator);
    if (nav.canShare && nav.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await nav.share({ files: [file], title: 'Автономно — 72 години' });
      return;
    }
  } catch (e) {
    if (e && /** @type {any} */ (e).name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  app.toast('Файл симуляції збережено');
}

/** @param {string} act @param {string} v */
function refocus(act, v) {
  /** @type {HTMLElement|null} */ (document.querySelector(`[data-act="${act}"][data-v="${CSS.escape(v)}"]`))?.focus();
}

on({
  'sim-scen': (el) => { const v = el.dataset.v || 'all'; change((s) => { s.scen = /** @type {any} */ (v); }); app.render(); refocus('sim-scen', v); },
  'sim-stage': (el) => {
    const v = Number(el.dataset.v) || 0;
    if (S().startAt != null) app.toast('Іде відлік — етап обирається за часом. Зупиніть відлік, щоб гортати етапи.');
    else change((s) => { s.stage = v; });
    app.render();
    refocus('sim-stage', String(v));
  },
  'sim-start': () => { change((s) => { s.startAt = Date.now(); }); app.render(); app.toast('Відлік почато — етапи змінюватимуться самі'); },
  'sim-stop': () => { change((s) => { s.stage = shownStage(); s.startAt = null; }); app.render(); },
  'sim-norm': (el) => { const v = el.dataset.v || 'min'; change((s) => { s.norm = /** @type {any} */ (v); }); app.render(); refocus('sim-norm', v); },
  'sim-ice': (el) => { const v = el.dataset.v || 'half'; change((s) => { s.icebox = /** @type {any} */ (v); }); app.render(); refocus('sim-ice', v); },
  'sim-src-add': (el) => {
    const k = /** @type {keyof typeof SOURCE_KINDS} */ (el.dataset.v || 'station');
    if (S().sources.length >= 6) { app.toast('Щонайбільше 6 джерел'); return; }
    change((s) => { s.sources.push(newSource(k in SOURCE_KINDS ? k : 'station')); });
    app.render();
    /** @type {HTMLElement|null} */ (document.querySelector(`#sim-src-${S().sources.length - 1} input[data-sim$=".cap"]`))?.focus();
  },
  'sim-src-del': (el) => {
    const i = Number(el.dataset.v);
    change((s) => {
      s.sources.splice(i, 1);
      for (const d of s.devices) d.src = d.src === i ? -1 : d.src > i ? d.src - 1 : d.src;
    });
    app.render();
  },
  'sim-dev-add': (el) => {
    const i = Number(el.dataset.v);
    if (S().devices.length >= 16) { app.toast('Щонайбільше 16 пристроїв'); return; }
    const p = DEVICE_PRESETS[i];
    change((s) => { s.devices.push({ name: p ? p.name : 'Пристрій', w: p ? String(p.watts) : '', h: p ? String(p.hours).replace('.', ',') : '', crit: !!(p && p.medical), src: s.sources.length ? 0 : -1 }); });
    app.render();
    /** @type {HTMLElement|null} */ (document.querySelector(`#sim-dev-${S().devices.length - 1} input[data-sim$=".w"]`))?.focus();
  },
  'sim-dev-del': (el) => { const i = Number(el.dataset.v); change((s) => { s.devices.splice(i, 1); }); app.render(); },
  'sim-export': () => { exportFile(); },
  'sim-reset': () => {
    undo = JSON.parse(JSON.stringify(S()));
    const d = store.get().state;
    store.update((x) => { x.sim = { ...simDefaults(), adults: String(d.adults ?? 1), kids: String(d.kids ?? 0), elderly: String(d.elderly ?? 0), drink: d.waterL != null ? String(d.waterL) : '' }; });
    app.render();
    app.toast('Симуляцію скинуто', { action: 'sim-undo', label: 'Повернути' });
  },
  'sim-undo': () => {
    if (!undo) return;
    const u = undo;
    undo = null;
    store.update((d) => { d.sim = cleanSim(u); });
    app.render();
    app.toast('Повернуто');
  },
});


export const simScreens = { sim: simView };
