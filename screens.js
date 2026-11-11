// @ts-check
// Екрани: мої ресурси, стан сьогодні, майстер налаштування, резерв, безпека, про застосунок.

import * as store from './store.js';
import { PLACES, LIMITS, DURATIONS, BUDGETS, EQUIP, UTILITIES, RESERVE_CATS, RESERVE_CATALOG, SOURCES, NEEDS } from './data.js';
import { MYTHS } from './solutions.js';
import { reserveInsight } from './engine.js';
import { RULES, SYMPTOMS, EMERGENCY, RISK_LEVELS, stateAlerts } from './safety.js';
import { fmt } from './calc.js';
import { app, on, esc, icon, illo, note, seg, chip, pageHead, plural, tempText, peopleList, pic, picImg } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */

const VERSION = '1.2.0';

/* ───────────── Допоміжні ───────────── */

/** @param {string} v */
function parseNum(v) {
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** @param {number|null} v */
function numVal(v) {
  return v == null ? '' : String(v).replace('.', ',');
}

/**
 * Поле з кнопками ± .
 * @param {{id:string, label:string, value:number|null, step:number, unit?:string, hint?:string, act:string, min?:number, max?:number}} o
 */
function stepper(o) {
  return `<div class="field">
    <label for="${o.id}">${esc(o.label)}</label>
    <div class="stepper">
      <button type="button" class="sbtn" data-act="${o.act}" data-f="${o.id}" data-d="${-o.step}" aria-label="Зменшити: ${esc(o.label)}">${icon('i-minus')}</button>
      <input id="${o.id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(numVal(o.value))}" data-min="${o.min ?? ''}" data-max="${o.max ?? ''}" placeholder="—" aria-describedby="${o.id}-h">
      <button type="button" class="sbtn" data-act="${o.act}" data-f="${o.id}" data-d="${o.step}" aria-label="Збільшити: ${esc(o.label)}">${icon('i-plus')}</button>
      ${o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''}
    </div>
    <p class="hint" id="${o.id}-h">${esc(o.hint || '')}</p>
  </div>`;
}

/** @param {HTMLInputElement} inp @param {number|null} n */
function clampField(inp, n) {
  if (n == null || Number.isNaN(n)) return n;
  const min = inp.dataset.min === '' ? -Infinity : Number(inp.dataset.min);
  const max = inp.dataset.max === '' ? Infinity : Number(inp.dataset.max);
  return Math.min(max, Math.max(min, n));
}

/* ───────────── Мій стан сьогодні ───────────── */

const STATE_FIELDS = {
  'f-waterL': { key: 'waterL', label: 'Питна вода', unit: 'л', step: 1, min: 0, max: 100000 },
  'f-batteryPct': { key: 'batteryPct', label: 'Заряд основного акумулятора', unit: '%', step: 5, min: 0, max: 100 },
  'f-roomC': { key: 'roomC', label: 'Температура в кімнаті', unit: '°C', step: 1, min: -40, max: 60 },
  'f-adults': { key: 'adults', label: 'Дорослі', unit: '', step: 1, min: 0, max: 50 },
  'f-kids': { key: 'kids', label: 'Діти', unit: '', step: 1, min: 0, max: 50 },
  'f-elderly': { key: 'elderly', label: 'Літні люди', unit: '', step: 1, min: 0, max: 50 },
  'f-pets': { key: 'pets', label: 'Тварини', unit: '', step: 1, min: 0, max: 50 },
  'f-petKg': { key: 'petKg', label: 'Загальна маса тварин', unit: 'кг', step: 1, min: 0, max: 500 },
};

/** @returns {View} */
function stateView() {
  const s = store.get().state;
  const tri = (/** @type {'power'|'gas'|'tap'} */ k, /** @type {string} */ label) => {
    const v = s[k] === true ? '1' : s[k] === false ? '0' : '';
    return `<div class="field"><span class="flabel" id="lb-${k}">${esc(label)}</span>
      <div class="seg" role="group" aria-labelledby="lb-${k}">
        ${[['1', 'Є'], ['0', 'Немає'], ['', 'Не знаю']].map(([vv, l]) => `<button type="button" class="seg-b" data-act="st-tri" data-f="${k}" data-v="${vv}" aria-pressed="${v === vv}">${l}</button>`).join('')}
      </div></div>`;
  };
  const f = (/** @type {keyof typeof STATE_FIELDS} */ id, /** @type {string} */ hint = '') => {
    const m = STATE_FIELDS[id];
    return stepper({ id, label: m.label, value: /** @type {any} */ (s)[m.key], step: m.step, unit: m.unit, act: 'st-step', min: m.min, max: m.max, hint });
  };
  return {
    title: 'Мій стан сьогодні',
    tab: 'res',
    html: `${pageHead('Мій стан сьогодні', '#/', 'Зберігається одразу й лише на цьому пристрої')}
    ${pic('state')}
    <section class="card form">
      <h2>Що є зараз</h2>
      ${tri('power', 'Електроенергія')}
      ${tri('gas', 'Газ')}
      ${tri('tap', 'Вода з крана')}
    </section>
    <section class="card form">
      <h2>Запаси й умови</h2>
      ${f('f-waterL', reserveWaterHint())}
      ${f('f-batteryPct', 'Павербанк, станція чи телефон — те, на що ви покладаєтеся.')}
      ${f('f-roomC', 'Термометр у кімнаті, де ви перебуваєте.')}
    </section>
    <section class="card form">
      <h2>Хто з вами</h2>
      ${f('f-adults')}${f('f-kids')}${f('f-elderly')}${f('f-pets')}${f('f-petKg', 'Для розрахунку води для тварин.')}
    </section>
    <div id="state-alerts">${stateAlertsHtml()}</div>
    <div class="row-btns sticky-actions">
      <a class="btn primary" href="#/plan">${icon('i-check')}<span>Знайти рішення</span></a>
      <button class="btn ghost" type="button" data-act="st-clear" aria-label="Очистити стан сьогодні">Очистити</button>
    </div>`,
    after() {
      document.querySelectorAll('.stepper input').forEach((el) => {
        const inp = /** @type {HTMLInputElement} */ (el);
        inp.addEventListener('input', () => saveField(inp));
        inp.addEventListener('blur', () => { const n = parseNum(inp.value); if (n != null && !Number.isNaN(n)) inp.value = numVal(clampField(inp, n)); });
      });
    },
  };
}

function reserveWaterHint() {
  const l = store.get().reserve.filter((i) => i.key === 'drinkWater' && i.ok).reduce((a, i) => a + i.qty, 0);
  return l > 0
    ? `Лише питна вода. У «Моєму резерві» записано ${fmt(l, 1)} л — якщо поле порожнє, враховується саме ця кількість.`
    : 'Лише питна вода. Порожнє поле — «не знаю».';
}

/** @param {HTMLInputElement} inp */
function saveField(inp) {
  const m = STATE_FIELDS[/** @type {keyof typeof STATE_FIELDS} */ (inp.id)];
  if (!m) return;
  const n = parseNum(inp.value);
  inp.setAttribute('aria-invalid', String(Number.isNaN(n)));
  const hint = document.getElementById(`${inp.id}-h`);
  if (Number.isNaN(n)) { if (hint) hint.textContent = 'Введіть число, наприклад 5 або 2,5.'; return; }
  const v = clampField(inp, n);
  store.update((d) => {
    const st = /** @type {any} */ (d.state);
    const isCount = ['adults', 'kids', 'elderly', 'pets'].includes(m.key);
    st[m.key] = v == null ? (isCount ? 0 : null) : isCount ? Math.round(v) : v;
    d.state.updated = new Date().toISOString();
  });
  const sa = document.getElementById('state-alerts');
  if (sa) sa.innerHTML = stateAlertsHtml();
}

function stateAlertsHtml() {
  const al = stateAlerts(app.ctx());
  if (!al.length) return '';
  return `<h2 class="h2">Зверніть увагу</h2>${al.map((a) => note(a.level, a.title, a.text)).join('')}`;
}

on({
  'st-tri': (el) => {
    const k = /** @type {'power'|'gas'|'tap'} */ (el.dataset.f);
    const v = el.dataset.v === '1' ? true : el.dataset.v === '0' ? false : null;
    store.update((d) => { d.state[k] = v; d.state.updated = new Date().toISOString(); });
    app.render();
  },
  'st-step': (el) => {
    const inp = /** @type {HTMLInputElement|null} */ (document.getElementById(el.dataset.f || ''));
    if (!inp) return;
    const cur = parseNum(inp.value);
    const base = cur == null || Number.isNaN(cur) ? (inp.id === 'f-roomC' ? 15 : 0) : cur;
    const n = clampField(inp, Math.round((base + Number(el.dataset.d)) * 10) / 10);
    inp.value = numVal(n);
    saveField(inp);
  },
  'st-clear': () => {
    if (!confirm('Очистити стан сьогодні? Резерв і налаштування залишаться.')) return;
    store.update((d) => {
      const keep = { adults: d.state.adults, kids: d.state.kids, elderly: d.state.elderly, pets: d.state.pets, petKg: d.state.petKg };
      d.state = { ...store.defaults().state, ...keep };
    });
    app.render();
  },
});

/* ───────────── Майстер налаштування ───────────── */

const SETUP_STEPS = 5;

/** @param {number} n @returns {View} */
function setupView(n) {
  const step = Math.min(SETUP_STEPS, Math.max(1, n || 1));
  const d = store.get();
  const p = d.profile;
  let body = '';
  let q = '';
  if (step === 1) {
    q = 'Де ви перебуваєте?';
    body = `<div class="choices">${Object.entries(PLACES).map(([k, l]) => chip('su-place', k, l, p.place === k)).join('')}</div>`;
  } else if (step === 2) {
    q = 'Що доступно?';
    const util = UTILITIES.map((u) => chip('su-util', u.key, u.label, /** @type {any} */ (d.state)[u.key] === true)).join('');
    const eq = EQUIP.map((e) => chip('su-equip', e.key, e.label, p.equip.includes(e.key))).join('');
    const none = !p.equip.length && d.state.power !== true && d.state.gas !== true && d.state.tap !== true;
    body = `<p class="hint">Позначте все, що є зараз. Кілька варіантів — можна.</p>
      <div class="choices">${util}${eq}${chip('su-none', '1', 'Нічого з переліченого', none)}</div>`;
  } else if (step === 3) {
    q = 'Які обмеження?';
    body = `<p class="hint">Небезпечні варіанти за цими умовами не з’являться серед рекомендованих.</p>
      <div class="choices">${Object.entries(LIMITS).map(([k, l]) => chip('su-limit', k, l, p.limits.includes(/** @type {any} */ (k)))).join('')}</div>`;
  } else if (step === 4) {
    q = 'На який термін потрібна автономність?';
    body = `<div class="choices">${Object.entries(DURATIONS).map(([k, l]) => chip('su-dur', k, l, p.duration === k)).join('')}</div>`;
  } else {
    q = 'Бюджет';
    body = `<p class="hint">Лише для фільтрації рішень. Ціни орієнтовні й не є гарантією.</p>
      <div class="choices">${BUDGETS.map((b) => chip('su-budget', String(b.v), b.label, p.budget === b.v)).join('')}</div>`;
  }
  return {
    title: 'Налаштування ситуації',
    tab: 'res',
    html: `${pageHead(q, step === 1 ? '#/' : `#/setup/${step - 1}`, `Крок ${step} з ${SETUP_STEPS}`)}
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${SETUP_STEPS}" aria-valuenow="${step}" aria-label="Прогрес налаштування"><i style="width:${(step / SETUP_STEPS) * 100}%"></i></div>
    ${step === 1 ? pic('setup-start') : ''}
    <section class="card form">${body}</section>
    <div class="row-btns sticky-actions">
      ${step < SETUP_STEPS ? `<a class="btn primary" href="#/setup/${step + 1}">Далі</a>` : `<button class="btn primary" type="button" data-act="su-finish">Готово</button>`}
      <button class="btn ghost" type="button" data-act="su-skip">Пропустити</button>
    </div>
    <p class="hint">Усі відповіді можна змінити пізніше в розділі «Мої ресурси».</p>`,
  };
}

on({
  'su-place': (el) => { store.update((d) => { d.profile.place = /** @type {any} */ (el.dataset.v); }); app.render(); },
  'su-util': (el) => {
    const k = /** @type {'power'|'gas'|'tap'} */ (el.dataset.v);
    store.update((d) => { d.state[k] = d.state[k] === true ? false : true; });
    app.render();
  },
  'su-equip': (el) => {
    const k = el.dataset.v || '';
    store.update((d) => { d.profile.equip = d.profile.equip.includes(k) ? d.profile.equip.filter((x) => x !== k) : [...d.profile.equip, k]; });
    app.render();
  },
  'su-none': () => {
    store.update((d) => { d.profile.equip = []; d.state.power = false; d.state.gas = false; d.state.tap = false; });
    app.render();
  },
  'su-limit': (el) => {
    const k = /** @type {any} */ (el.dataset.v);
    store.update((d) => { d.profile.limits = d.profile.limits.includes(k) ? d.profile.limits.filter((x) => x !== k) : [...d.profile.limits, k]; });
    app.render();
  },
  'su-dur': (el) => { store.update((d) => { d.profile.duration = /** @type {any} */ (el.dataset.v); }); app.render(); },
  'su-budget': (el) => { store.update((d) => { d.profile.budget = Number(el.dataset.v); }); app.render(); },
  'su-finish': () => {
    store.update((d) => { d.profile.setupDone = true; });
    app.go('#/setup/done');
  },
  'su-skip': () => {
    store.update((d) => { d.profile.setupDismissed = true; });
    app.go('#/');
  },
});

/** Екран після налаштування: похвала й наступний крок. @returns {View} */
function setupDoneView() {
  return {
    title: 'Налаштування завершено',
    tab: 'res',
    html: `${pageHead('Готово!', '#/', 'Підбір рішень тепер враховує вашу ситуацію')}
    ${pic('setup-done', { eager: true })}
    <div class="row-btns">
      <a class="btn primary" href="#/plan">Знайти рішення</a>
      <a class="btn ghost" href="#/res">Мої ресурси</a>
    </div>
    <p class="hint">Відповіді можна змінити будь-коли в розділі «Мої ресурси».</p>`,
  };
}

/* ───────────── Мої ресурси ───────────── */

/** @returns {View} */
function resourcesView() {
  const d = store.get();
  const p = d.profile;
  const s = d.state;
  const eq = p.equip.map((k) => (EQUIP.find((e) => e.key === k) || RESERVE_CATALOG.find((r) => r.key === k))?.label).filter(Boolean);
  const util = [s.power === true ? 'світло' : null, s.gas === true ? 'газ' : null, s.tap === true ? 'вода з крана' : null].filter(Boolean);
  return {
    title: 'Мої ресурси',
    tab: 'res',
    html: `${pageHead('Мої ресурси', '', 'Ситуація, стан і запаси — лише на цьому пристрої')}
    ${pic('reserve')}
    <section class="card">
      <div class="card-h"><h2>Моя ситуація</h2><a class="linkbtn" href="#/setup/1">Змінити</a></div>
      <dl class="kv">
        <div><dt>Місце</dt><dd>${esc(p.place ? PLACES[p.place] : 'не вказано')}</dd></div>
        <div><dt>Доступно</dt><dd>${esc([...util, ...eq].join(', ') || 'не вказано')}</dd></div>
        <div><dt>Обмеження</dt><dd>${esc(p.limits.map((k) => LIMITS[k]).join('; ') || 'немає')}</dd></div>
        <div><dt>Термін</dt><dd>${esc(DURATIONS[p.duration])}</dd></div>
        <div><dt>Бюджет</dt><dd>${esc((BUDGETS.find((b) => b.v === p.budget) || BUDGETS[0]).label)}</dd></div>
      </dl>
    </section>
    <section class="card">
      <div class="card-h"><h2>Мій стан сьогодні</h2><a class="linkbtn" href="#/state">Змінити</a></div>
      <p class="muted">${esc(stateSummary(d))}</p>
    </section>
    <section class="sec" aria-labelledby="res-h">
      <h2 class="h2" id="res-h">Мій резерв</h2>
      <div id="reserve-insight">${insightHtml()}</div>
      <div id="reserve-list">${reserveListHtml()}</div>
      <details class="card fold" id="add-fold"><summary>${icon('i-plus')}<span>Додати до резерву</span></summary>${addHtml()}</details>
    </section>
    <section class="card">
      <h2><label for="notes">Нотатки на випадок</label></h2>
      <textarea id="notes" rows="4" maxlength="4000" placeholder="Адреса найближчого пункту незламності, телефони рідних, ліки, місце зустрічі…">${esc(d.notes)}</textarea>
      <p class="hint">Зберігається автоматично. Доступно офлайн.</p>
    </section>
    <section class="card">
      <h2>Дані</h2>
      <div class="row-btns">
        <button class="btn ghost" type="button" data-act="data-export">${icon('i-download')}<span>Експорт JSON</span></button>
        <label class="btn ghost" for="import-file">${icon('i-upload')}<span>Імпорт JSON</span></label>
        <input id="import-file" type="file" accept="application/json,.json" class="sr-only">
      </div>
      <p class="hint">Експорт — резервна копія запасів, ситуації й збереженого. Імпорт замінює поточні запаси після підтвердження.</p>
      ${!store.isPersistent() ? note('caution', 'Дані не зберігаються', store.getError() || 'Браузер блокує локальне сховище. Зробіть експорт, щоб не втратити запаси.') : ''}
      <button class="btn danger-ghost" type="button" data-act="data-reset">${icon('i-trash')}<span>Скинути всі дані</span></button>
    </section>
    <section class="card">
      <h2>Вигляд</h2>
      <div class="field"><span class="flabel">Тема</span>${seg('set-theme', [{ v: 'auto', label: 'Авто' }, { v: 'light', label: 'Світла' }, { v: 'dark', label: 'Темна' }], d.settings.theme, 'Тема')}</div>
      <div class="field"><div class="chips">${chip('set-contrast', '1', 'Висока контрастність', d.settings.contrast)}${chip('set-motion', '1', 'Менше анімації', d.settings.motion)}</div></div>
    </section>
    <div class="rows"><a class="row" href="#/about">${icon('i-info')}<span>Про застосунок і офлайн-режим</span>${icon('i-chev', 'end')}</a></div>`,
    after() {
      const t = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('notes'));
      t?.addEventListener('input', () => store.update((dd) => { dd.notes = t.value.slice(0, 4000); }));
      bindReserveInputs();
      const f = /** @type {HTMLInputElement|null} */ (document.getElementById('import-file'));
      f?.addEventListener('change', () => { if (f.files && f.files[0]) importFile(f.files[0]); f.value = ''; });
      const form = /** @type {HTMLFormElement|null} */ (document.getElementById('custom-form'));
      form?.addEventListener('submit', (e) => { e.preventDefault(); addCustom(form); });
    },
  };
}

/** @param {import('./types').AppData} d */
function stateSummary(d) {
  const s = d.state;
  const parts = [];
  if (s.power != null) parts.push(s.power ? 'світло є' : 'світла немає');
  if (s.gas != null) parts.push(s.gas ? 'газ є' : 'газу немає');
  if (s.tap != null) parts.push(s.tap ? 'вода з крана є' : 'води з крана немає');
  if (s.waterL != null) parts.push(`питної води ${fmt(s.waterL, 1)} л`);
  if (s.batteryPct != null) parts.push(`заряд ${Math.round(s.batteryPct)} %`);
  if (s.roomC != null) parts.push(`у кімнаті ${tempText(s.roomC)}`);
  const ppl = peopleList(s);
  if (ppl) parts.push(ppl);
  return parts.length ? parts.join(' · ') : 'Ще не вказано.';
}

function insightHtml() {
  const ins = reserveInsight(app.ctx());
  return `<div class="card insight">
    <a class="row plain" href="#/all?now=1">${icon('i-check')}<span>Можна зробити зараз: <b>${ins.feasibleNow.length}</b> ${plural(ins.feasibleNow.length, 'рішення', 'рішення', 'рішень')}</span>${icon('i-chev', 'end')}</a>
    ${ins.missing.length ? `<h3>Бракує важливого</h3><ul class="missing">${ins.missing.map((m) => `<li><span><b>${esc(m.label)}</b><br><span class="muted">${esc(m.why)}</span></span></li>`).join('')}</ul>` : `<p class="ok-line">${icon('i-check')}Найважливіше є. Перевіряйте запаси раз на кілька місяців.</p>`}
  </div>`;
}

function reserveListHtml() {
  const items = store.get().reserve;
  if (!items.length) {
    return `<div class="empty small">${picImg('empty-reserve', 'pic-e', 'il-box')}<p>Резерв порожній. Додайте те, що є вдома, — і застосунок покаже, що можна зробити просто зараз.</p></div>`;
  }
  return RESERVE_CATS.map((c) => {
    const list = items.filter((i) => i.cat === c.key);
    if (!list.length) return '';
    return `<div class="rgroup"><h3>${esc(c.label)}</h3><ul class="ritems">${list.map((it) => `<li class="ritem${it.ok ? '' : ' off'}">
      <div class="rname"><span>${esc(it.name)}</span>${it.ok ? '' : '<span class="badge plain">недоступно</span>'}</div>
      <div class="rctl">
        <div class="stepper sm">
          <button type="button" class="sbtn" data-act="res-step" data-id="${it.id}" data-d="-1" aria-label="Менше: ${esc(it.name)}">${icon('i-minus')}</button>
          <input type="text" inputmode="decimal" value="${esc(numVal(it.qty))}" data-res="${it.id}" aria-label="Кількість: ${esc(it.name)}">
          <button type="button" class="sbtn" data-act="res-step" data-id="${it.id}" data-d="1" aria-label="Більше: ${esc(it.name)}">${icon('i-plus')}</button>
          <span class="unit">${esc(it.unit)}</span>
        </div>
        <button type="button" class="iconbtn" data-act="res-ok" data-id="${it.id}" aria-pressed="${it.ok}" aria-label="${it.ok ? 'Позначити недоступним' : 'Позначити доступним'}: ${esc(it.name)}">${icon(it.ok ? 'i-check' : 'i-close')}</button>
        <button type="button" class="iconbtn" data-act="res-del" data-id="${it.id}" aria-label="Видалити: ${esc(it.name)}">${icon('i-trash')}</button>
      </div></li>`).join('')}</ul></div>`;
  }).join('');
}

function addHtml() {
  const have = new Set(store.get().reserve.map((i) => i.key).filter(Boolean));
  const groups = RESERVE_CATS.map((c) => {
    const list = RESERVE_CATALOG.filter((r) => r.cat === c.key && !have.has(r.key));
    if (!list.length) return '';
    return `<div class="frow"><span class="flabel">${esc(c.label)}</span><div class="chips">${list.map((r) => `<button type="button" class="chip" data-act="res-add" data-v="${r.key}">${icon('i-plus')}<span>${esc(r.label)}</span></button>`).join('')}</div></div>`;
  }).join('');
  return `${groups}
    <form id="custom-form" class="custom" autocomplete="off">
      <h3>Свій предмет</h3>
      <div class="field"><label for="c-name">Назва</label><input id="c-name" type="text" maxlength="80" required placeholder="Наприклад: свічки-таблетки"></div>
      <div class="grid2">
        <div class="field"><label for="c-cat">Категорія</label><select id="c-cat">${RESERVE_CATS.map((c) => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="c-qty">Кількість</label><input id="c-qty" type="text" inputmode="decimal" value="1"></div>
      </div>
      <div class="field"><label for="c-unit">Одиниця</label><input id="c-unit" type="text" maxlength="12" value="шт"></div>
      <button class="btn primary" type="submit">${icon('i-plus')}<span>Додати</span></button>
    </form>`;
}

function refreshReserve() {
  const a = document.getElementById('reserve-list');
  if (a) a.innerHTML = reserveListHtml();
  const b = document.getElementById('reserve-insight');
  if (b) b.innerHTML = insightHtml();
  const fold = document.getElementById('add-fold');
  if (fold) {
    const open = /** @type {HTMLDetailsElement} */ (fold).open;
    fold.innerHTML = `<summary>${icon('i-plus')}<span>Додати до резерву</span></summary>${addHtml()}`;
    /** @type {HTMLDetailsElement} */ (fold).open = open;
    const form = /** @type {HTMLFormElement|null} */ (document.getElementById('custom-form'));
    form?.addEventListener('submit', (e) => { e.preventDefault(); addCustom(form); });
  }
  bindReserveInputs();
}

function bindReserveInputs() {
  document.querySelectorAll('input[data-res]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    inp.addEventListener('input', () => {
      const n = parseNum(inp.value);
      inp.setAttribute('aria-invalid', String(n == null || Number.isNaN(n) || n < 0));
      if (n == null || Number.isNaN(n) || n < 0) return;
      store.update((d) => { const it = d.reserve.find((x) => x.id === inp.dataset.res); if (it) it.qty = Math.min(100000, n); });
      const b = document.getElementById('reserve-insight');
      if (b) b.innerHTML = insightHtml();
    });
  });
}

/** @param {HTMLFormElement} form */
function addCustom(form) {
  const name = /** @type {HTMLInputElement} */ (form.querySelector('#c-name')).value.trim();
  if (!name) return;
  const cat = /** @type {HTMLSelectElement} */ (form.querySelector('#c-cat')).value;
  const qty = parseNum(/** @type {HTMLInputElement} */ (form.querySelector('#c-qty')).value);
  const unit = /** @type {HTMLInputElement} */ (form.querySelector('#c-unit')).value.trim() || 'шт';
  const it = store.cleanItem({ name, cat, qty: qty == null || Number.isNaN(qty) ? 1 : qty, unit, ok: true });
  if (!it) return;
  store.update((d) => { d.reserve.push(it); });
  app.toast(`Додано: ${name}`);
  refreshReserve();
}

/** @type {{item: import('./types').ReserveItem, index:number} | null} */
let lastDeleted = null;

on({
  'res-add': (el) => {
    const r = RESERVE_CATALOG.find((x) => x.key === el.dataset.v);
    if (!r) return;
    const it = store.cleanItem({ key: r.key, name: r.label, cat: r.cat, qty: r.qty, unit: r.unit, ok: true });
    if (!it) return;
    store.update((d) => { d.reserve.push(it); });
    app.toast(`Додано: ${r.label}`);
    refreshReserve();
  },
  'res-step': (el) => {
    store.update((d) => {
      const it = d.reserve.find((x) => x.id === el.dataset.id);
      if (it) it.qty = Math.max(0, Math.round((it.qty + Number(el.dataset.d)) * 10) / 10);
    });
    refreshReserve();
  },
  'res-ok': (el) => {
    store.update((d) => { const it = d.reserve.find((x) => x.id === el.dataset.id); if (it) it.ok = !it.ok; });
    refreshReserve();
  },
  'res-del': (el) => {
    const d = store.get();
    const index = d.reserve.findIndex((x) => x.id === el.dataset.id);
    if (index < 0) return;
    lastDeleted = { item: d.reserve[index], index };
    store.update((dd) => { dd.reserve.splice(index, 1); });
    app.toast(`Видалено: ${lastDeleted.item.name}`, { action: 'res-undo', label: 'Повернути' });
    refreshReserve();
  },
  'res-undo': () => {
    if (!lastDeleted) return;
    const { item, index } = lastDeleted;
    store.update((d) => { d.reserve.splice(Math.min(index, d.reserve.length), 0, item); });
    lastDeleted = null;
    app.toast('Повернуто');
    refreshReserve();
  },
  'data-export': () => exportFile(),
  'data-reset': () => {
    if (!confirm('Видалити всі дані застосунку на цьому пристрої? Цю дію не можна скасувати.')) return;
    store.replaceAll(store.defaults());
    app.toast('Дані скинуто');
    app.go('#/');
  },
  'set-theme': (el) => { store.update((d) => { d.settings.theme = /** @type {any} */ (el.dataset.v); }); applyAndRender(); },
  'set-contrast': () => { store.update((d) => { d.settings.contrast = !d.settings.contrast; }); applyAndRender(); },
  'set-motion': () => { store.update((d) => { d.settings.motion = !d.settings.motion; }); applyAndRender(); },
});

function applyAndRender() {
  const s = store.get().settings;
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = s.theme;
  if (s.contrast) root.dataset.contrast = 'more'; else root.removeAttribute('data-contrast');
  if (s.motion) root.dataset.motion = 'reduce'; else root.removeAttribute('data-motion');
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0B1424' : '#F8F5EF'));
  app.render();
}

async function exportFile() {
  const payload = JSON.stringify(store.exportData(store.get()), null, 2);
  const name = `avtonomno-reserve-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([payload], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    const nav = /** @type {any} */ (navigator);
    if (nav.canShare && nav.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await nav.share({ files: [file], title: 'Автономно — резерв' });
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
  app.toast('Файл резерву збережено');
}

/** @param {File} file */
function importFile(file) {
  const r = new FileReader();
  r.onload = () => {
    const text = String(r.result || '');
    if (text.length > 2 * 1024 * 1024) { app.toast('Файл завеликий (понад 2 МБ).'); return; }
    const res = store.importData(text, store.get());
    if ('error' in res) { app.toast(`Не вдалося імпортувати: ${res.error}`); return; }
    const cur = store.get().reserve.length;
    if (!confirm(`Замінити поточні запаси (${cur}) даними з файлу (${res.counts.reserve})?`)) return;
    store.replaceAll(res.data);
    app.toast(`Імпортовано: ${res.counts.reserve} ${plural(res.counts.reserve, 'запис', 'записи', 'записів')}`);
    app.render();
  };
  r.onerror = () => app.toast('Не вдалося прочитати файл.');
  r.readAsText(file);
}

/* ───────────── Безпека ───────────── */

/** @returns {View} */
function safetyView() {
  return {
    title: 'Безпека',
    tab: '',
    html: `${pageHead('Безпека', '#/', 'Коли звичайні рекомендації поступаються невідкладній допомозі')}
    <section class="card sos">
      <h2>Екстрені номери</h2>
      <ul class="calls">${EMERGENCY.map((e) => `<li><a class="call" href="tel:${e.num}">${icon('i-phone')}<b>${e.num}</b><span>${esc(e.label)}</span></a></li>`).join('')}</ul>
    </section>
    ${pic('safety')}
    <h2 class="h2">Ознаки небезпеки</h2>
    ${SYMPTOMS.map((sy) => `<details class="card fold sign ${sy.level}"><summary>${icon(sy.level === 'danger' ? 'i-alert' : 'i-warn')}<span>${esc(sy.title)}</span></summary>
      <h3>Ознаки</h3><ul>${sy.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Що робити</h3><ol>${sy.act.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="src">Джерела: ${sy.sources.map((k) => SOURCES[k]).filter(Boolean).map((s) => s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.org)}</a>` : '').join(', ')}</p>
    </details>`).join('')}
    <h2 class="h2">Ніколи не робіть</h2>
    <ul class="rules">${RULES.map((r) => `<li class="rule-i ${r.level}">${icon(r.level === 'danger' ? 'i-alert' : 'i-warn')}<span>${esc(r.text)}</span></li>`).join('')}</ul>
    <h2 class="h2">Небезпечні міфи</h2>
    <div class="list">${MYTHS.map((m) => `<a class="card item myth" href="#/s/${m.id}"><h3>${esc(m.title)}</h3><p class="muted">${esc(NEEDS[m.need].label)} · чому ні</p></a>`).join('')}</div>
    <h2 class="h2">Рівні попереджень</h2>
    ${note('info', '', 'Корисне уточнення або порада.')}
    ${note('caution', '', 'Можна, але лише з дотриманням усіх умов безпеки.')}
    ${note('danger', '', 'Загроза життю чи здоров’ю. Не робіть цього або негайно звертайтеся по допомогу.')}
    <p class="hint">Застосунок не замінює лікаря чи рятувальників. У небезпеці телефонуйте 112 або 103 і виконуйте вказівки місцевої влади.</p>`,
  };
}

/* ───────────── Про застосунок ───────────── */

/** @param {any} sw */
function offlineDetails(sw) {
  const status = {
    ready: ['ok', 'Готово до роботи офлайн', 'Усі файли застосунку збережено на пристрої. Він відкриватиметься й без інтернету.'],
    partial: ['wait', 'Кешування ще триває', `Збережено ${sw.cached} з ${sw.total} файлів. Не закривайте застосунок, поки є інтернет.`],
    unsupported: ['off', 'Офлайн-режим недоступний', 'Цей браузер або спосіб відкриття не підтримує Service Worker. Відкрийте застосунок за адресою https:// у Safari чи Chrome.'],
    error: ['off', 'Не вдалося підтвердити офлайн-режим', 'Спробуйте перезавантажити сторінку, коли буде інтернет.'],
    checking: ['wait', 'Перевіряю…', ''],
  }[/** @type {'ready'|'partial'|'unsupported'|'error'|'checking'} */ (sw.status)] || ['wait', 'Перевіряю…', ''];
  return `<p class="ob ${status[0]}">${icon(status[0] === 'ok' ? 'i-offline' : status[0] === 'wait' ? 'i-sync' : 'i-info')}<b>${esc(status[1])}</b></p>
    ${status[2] ? `<p class="muted">${esc(status[2])}</p>` : ''}
    <ul class="kvs">
      <li>Інтернет зараз: <b>${navigator.onLine ? 'є' : 'немає'}</b></li>
      ${sw.total ? `<li>Файлів у кеші: <b>${sw.cached} з ${sw.total}</b></li>` : ''}
      ${sw.picsTotal ? `<li>Ілюстрацій у кеші: <b>${sw.picsCached} з ${sw.picsTotal}</b></li>` : ''}
      ${sw.version ? `<li>Версія кешу: <b>${esc(sw.version)}</b></li>` : ''}
      <li>Локальне сховище: <b>${store.isPersistent() ? 'працює' : 'недоступне'}</b></li>
    </ul>
    ${sw.install ? `<button class="btn primary" type="button" data-act="install">${icon('i-download')}<span>Встановити застосунок</span></button>` : ''}`;
}

/** @param {any} sw @returns {View} */
function aboutView(sw) {
  return {
    title: 'Про застосунок',
    tab: 'res',
    html: `${pageHead('Про «Автономно»', '#/res', 'Рішення є. Навіть коли немає звичного.')}
    <section class="card">
      <h2>Що це</h2>
      <p>Офлайн-помічник для життя без світла, газу, опалення, води чи зв’язку. Обираєте проблему — і за кілька секунд бачите практичне, обґрунтоване й безпечне рішення з тим, що маєте.</p>
    </section>
    <section class="card"><h2>Офлайн-режим</h2>${pic('offline')}<div id="about-offline">${offlineDetails(sw)}</div>
      <p class="hint">Для першого отримання застосунку потрібен інтернет. Після першого відкриття всі файли зберігаються на пристрої, і застосунок працює без мережі: рішення, калькулятори, резерв і нотатки.</p>
      <button class="btn ghost" type="button" data-act="recheck">${icon('i-sync')}<span>Перевірити ще раз</span></button>
    </section>
    <section class="card">
      <h2>Встановлення на головний екран</h2>
      <h3>iPhone (Safari)</h3>
      <ol><li>Відкрийте адресу застосунку в Safari.</li><li>Натисніть «Поділитися».</li><li>Оберіть «На початковий екран» → «Додати».</li></ol>
      <h3>Android (Chrome)</h3>
      <ol><li>Відкрийте адресу застосунку в Chrome.</li><li>Меню ⋮ → «Встановити застосунок» або «Додати на головний екран».</li></ol>
    </section>
    <section class="card">
      <h2>Приватність</h2>
      <p>Без реєстрації, без аналітики й трекерів. Усі дані — стан, запаси, нотатки — лише в пам’яті цього браузера. Для резервної копії скористайтеся експортом JSON.</p>
    </section>
    <section class="card">
      <h2>Важливо</h2>
      <p>Застосунок не замінює лікаря, рятувальників чи вказівки місцевої влади. Розрахунки — орієнтовні, крім позначених як точні фізичні. У небезпеці телефонуйте 112 або 103.</p>
    </section>
    <section class="card">
      <h2>Джерела</h2>
      <ul class="sources">${Object.values(SOURCES).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon('i-ext')}<span><b>${esc(s.org)}</b> — ${esc(s.title)}</span></a></li>`).join('')}</ul>
    </section>
    <p class="hint center">Версія ${VERSION} · Код — ліцензія MIT · Без реклами й брендів</p>`,
  };
}

on({
  recheck: () => { app.render(); window.dispatchEvent(new Event('av-recheck')); },
  install: async () => {
    const ev = /** @type {any} */ (window).__avInstall;
    if (ev && ev.prompt) { ev.prompt(); try { await ev.userChoice; } catch { /* скасовано */ } }
  },
});

export const screens = {
  resources: resourcesView,
  state: stateView,
  setup: setupView,
  setupDone: setupDoneView,
  safety: safetyView,
  about: aboutView,
  offlineDetails,
};
