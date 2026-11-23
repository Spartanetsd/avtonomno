// @ts-check
// Екрани модуля «Що маю — те використовую»: вибір проблеми, позначки «Є / Немає / Не знаю»,
// кількості й характеристики, до трьох варіантів із поясненням і джерелами.

import * as store from './store.js';
import { BUDGETS, SOURCES } from './data.js';
import { ITEMS, PROBLEMS, PROB_ORDER, HAVE_TIMES, HAVE_LIMITS, evaluate, statusText, itemsFor, paramDefaults, mergeItems } from './have.js';
import { app, on, esc, icon, note, pageHead, seg, chip, sourcesList, bindNumField, keepInPlace, plural } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./have.js').HaveItem} HaveItem */

/** Режим «Я в укритті» — виходити не можна. */
function inShelter() {
  const sh = store.get().shelter;
  return sh.since != null && sh.after == null;
}

/**
 * Поточні дані проблеми: власні позначки, резерв, параметри, час, бюджет, обмеження.
 * @param {string} prob
 */
function cur(prob) {
  const d = store.get();
  const h = d.have;
  const params = { ...paramDefaults(prob, d.state), ...(h.params[prob] || {}) };
  const { items, fromReserve } = mergeItems(h.items, d.reserve, d.profile.equip);
  const limits = [...new Set([...h.limits, ...(inShelter() ? ['noOutside'] : [])])];
  return { params, items, fromReserve, time: h.time, budget: h.budget, limits };
}

/* ───────────── Список проблем ───────────── */

/** @returns {View} */
function listView() {
  const d = store.get();
  const marked = Object.keys(d.have.items).length;
  return {
    title: 'Що маю',
    tab: 'home',
    html: `${pageHead('Що маю — те використовую', '#/', 'Оберіть проблему й позначте, що є під рукою')}
    <nav class="hv-tiles" aria-label="Проблеми">${PROB_ORDER.map((k) => {
      const p = PROBLEMS[k];
      return `<a class="hv-tile" href="#/have/${k}">${icon(p.icon)}<span class="hv-tl">${esc(p.label)}</span><span class="hv-ts">${esc(p.sub)}</span></a>`;
    }).join('')}</nav>
    <p class="hint">${icon('i-info')} Підберу до трьох варіантів із того, що є. Невідоме не вважаю наявним — для кожної речі відповідайте «Є», «Немає» чи «Не знаю». Небезпечних способів не пропоную: вони окремо, з причиною.</p>
    ${marked ? `<p class="muted center">Позначено речей: ${marked}. Позначки спільні для всіх проблем і враховуються в головному підборі.</p>` : ''}`,
  };
}

/* ───────────── Проблема ───────────── */

/** @param {string} prob @returns {View} */
function problemView(prob) {
  const P = PROBLEMS[prob];
  const c = cur(prob);
  const r = /** @type {NonNullable<ReturnType<typeof evaluate>>} */ (evaluate(prob, c));
  return {
    title: P.label,
    tab: 'home',
    html: `${pageHead(P.label, '#/have', P.sub)}
    ${inShelter() ? note('info', 'Ви в укритті', 'Враховано: виходити не можна, тож купити чи набрати бракуюче зараз не вийде.') : ''}
    <h2 class="h2">Варіанти з наявного</h2>
    <p class="hv-live" id="hv-live" aria-live="polite" tabindex="-1">${esc(liveText(r))}</p>
    <div id="hv-out">${resultsHtml(r)}</div>
    <h2 class="h2">Уточніть, що маєте</h2>
    ${condHtml(prob, c, r)}
    <section class="card hv-items" aria-labelledby="hv-i-h" data-prob="${prob}">
      <h3 id="hv-i-h">Що є під рукою</h3>
      <p class="hint">«Не знаю» не вважається наявним. Кількість і характеристики уточнюють розрахунок.</p>
      ${itemsFor(prob).map((k) => itemRow(k, c)).join('')}
    </section>
    <div class="row-btns center"><button class="btn ghost" type="button" data-act="hv-reset" data-v="${prob}">${icon('i-trash')}<span>Очистити позначки й умови</span></button></div>`,
    after() { bindAll(prob, document); },
  };
}

/** Короткий підсумок для читачів екрана. @param {any} r */
function liveText(r) {
  const n = r.variants.length;
  if (!n) return 'Безпечного варіанта з наявного не знайдено.';
  const ready = r.variants.filter((/** @type {any} */ v) => v.status === 'ready').length;
  const check = r.variants.filter((/** @type {any} */ v) => v.status === 'check').length;
  const part = n - ready - check;
  return `${n} ${plural(n, 'варіант', 'варіанти', 'варіантів')}: ${[ready ? `можна робити — ${ready}` : '', check ? `перевірити — ${check}` : '', part ? `чогось бракує — ${part}` : ''].filter(Boolean).join(', ')}.`;
}

/** @param {string[]} keys */
function orgs(keys) {
  return [...new Set(keys.map((k) => SOURCES[k]?.org).filter(Boolean))].join(', ');
}

const ST_ICON = { ready: 'i-check', check: 'i-info', partial: 'i-warn' };

/** @param {any} r */
function resultsHtml(r) {
  const cards = r.variants.length
    ? r.variants.map((/** @type {any} */ v, /** @type {number} */ i) => varCard(v, i === 0)).join('')
    : note('caution', 'Безпечного варіанта з наявного не знайдено', 'Перегляньте, що не підходить і чому, — і позначте, що ще є під рукою.');
  const rest = r.rest.length
    ? `<details class="card fold"><summary>${icon('i-list')}<span>Ще ${r.rest.length} ${plural(r.rest.length, 'варіант', 'варіанти', 'варіантів')}</span></summary>
        <ul class="hv-rest">${r.rest.map((/** @type {any} */ v) => `<li><b>${esc(v.title)}</b><span class="hv-st ${v.status}">${icon(ST_ICON[/** @type {'ready'} */ (v.status)])}${esc(statusText(v.status))}</span>${v.lack.length ? `<span class="muted">Бракує: ${esc(v.lack.join('; '))}</span>` : ''}</li>`).join('')}</ul></details>` : '';
  const badN = r.unsuitable.length + r.banned.length;
  const bad = badN ? `<details class="card fold hv-bad"${r.unsuitable.length ? ' open' : ''}><summary>${icon('i-alert')}<span>Не підходить або небезпечно (${badN})</span></summary>
      <ul class="blocked">${r.unsuitable.map((/** @type {any} */ u) => `<li>${u.solId ? `<a href="#/s/${u.solId}">${esc(u.title)}</a>` : `<b>${esc(u.title)}</b>`}<span>${esc(u.why)}</span></li>`).join('')}
      ${r.banned.map((/** @type {any} */ b) => `<li class="danger">${b.solId ? `<a href="#/s/${b.solId}">${esc(b.title)}</a>` : `<b>${esc(b.title)}</b>`}<span>${esc(b.why)}${b.src.length ? ` <span class="muted">(${esc(orgs(b.src))})</span>` : ''}</span></li>`).join('')}</ul></details>` : '';
  return cards + rest + bad;
}

/** Картка варіанта. @param {any} v @param {boolean} top */
function varCard(v, top) {
  return `<article class="card hv-var${top ? ' hv-first' : ''}" aria-labelledby="hv-v-${v.id}">
    <p class="hv-st ${v.status}">${icon(ST_ICON[/** @type {'ready'} */ (v.status)])}<span>${esc(statusText(v.status))}${v.slow ? ' · потрібно більше часу' : ''}</span></p>
    <h3 id="hv-v-${v.id}" tabindex="-1">${esc(v.title)}</h3>
    ${v.alt ? `<p class="hv-alt">Варіант: ${esc(v.alt)}</p>` : ''}
    <p class="muted">${esc(v.result)}</p>
    <dl class="hv-dl">
      <div class="ok"><dt>${icon('i-check')}Що вже є</dt><dd>${v.have.length ? esc(v.have.join('; ')) : '<span class="muted">нічого не підтверджено</span>'}${v.optional.length ? `<span class="hint"> Бажано ще: ${esc(v.optional.join(', ').toLowerCase())}.</span>` : ''}</dd></div>
      <div class="no"><dt>${icon('i-close')}Чого бракує</dt><dd>${v.lack.length ? esc(v.lack.join('; ')) : '<span class="muted">нічого</span>'}</dd></div>
      ${v.check.length ? `<div class="unk"><dt>${icon('i-info')}Перевірте</dt><dd>${askHtml(v)}</dd></div>` : ''}
    </dl>
    <h4 class="hv-h4">Просто зараз</h4>
    ${v.now.length ? `<ol class="now-list compact">${v.now.map((/** @type {string} */ t) => `<li>${esc(t)}</li>`).join('')}</ol>` : '<p class="muted">Спершу знайдіть чи позначте потрібне — тоді з’являться кроки.</p>'}
    <details class="hv-more"${top ? ' open' : ''}><summary>Точні кроки (${v.steps.length})</summary><ol class="hv-steps">${v.steps.map((/** @type {string} */ t) => `<li>${esc(t)}</li>`).join('')}</ol></details>
    ${v.notes.map((/** @type {string} */ n) => `<p class="warnline">${icon('i-warn')}<span>${esc(n)}</span></p>`).join('')}
    <p class="hv-safe">${icon('i-shield')}<span><b>Чому безпечно:</b> ${esc(v.safe)}</span></p>
    ${v.limits.length ? `<ul class="hv-lim">${v.limits.map((/** @type {string} */ t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <details class="hv-more"><summary>Джерела: ${esc(orgs(v.src))}</summary>${sourcesList(v.src)}</details>
    ${v.solId ? `<a class="linkbtn" href="#/s/${v.solId}">Детальніше в бібліотеці рішень</a>` : ''}
  </article>`;
}

/**
 * «Перевірте»: невідомі речі можна позначити одним дотиком просто тут.
 * @param {any} v
 */
function askHtml(v) {
  const asked = new Set([...v.ask.map((/** @type {any} */ a) => a.full), ...v.askP.map((/** @type {any} */ a) => a.text)]);
  const rest = v.check.filter((/** @type {string} */ t) => !asked.has(t));
  return `<ul class="hv-ask">${v.ask.map((/** @type {any} */ a) => `<li><span>${esc(a.text)}</span><span class="hv-yn" role="group" aria-label="${esc(a.text)}"><button type="button" class="btn small ghost" data-act="hv-item" data-k="${a.k}" data-v="y">Є</button><button type="button" class="btn small ghost" data-act="hv-item" data-k="${a.k}" data-v="n">Немає</button></span></li>`).join('')}
    ${v.askP.map((/** @type {any} */ a) => { const q = a.text.replace(/: не позначено$/, ''); return `<li><span>${esc(q)}?</span><span class="hv-yn" role="group" aria-label="${esc(q)}"><button type="button" class="btn small ghost" data-act="hv-ptri" data-v="${a.p}:y">Так</button><button type="button" class="btn small ghost" data-act="hv-ptri" data-v="${a.p}:n">Ні</button></span></li>`; }).join('')}
    ${rest.map((/** @type {string} */ t) => `<li><span>${esc(t)}</span></li>`).join('')}</ul>`;
}

/* ───────────── Умови: параметри, час, бюджет, обмеження ───────────── */

/** @param {string} prob @param {ReturnType<typeof cur>} c @param {any} r */
function condHtml(prob, c, r) {
  const P = PROBLEMS[prob];
  const fields = P.params.map((d) => {
    const v = c.params[d.k] ?? '';
    if (d.kind === 'tri') return `<div class="field"><span class="lbl" id="hv-pl-${d.k}">${esc(d.label)}</span>${seg('hv-ptri', [{ v: `${d.k}:y`, label: 'Так' }, { v: `${d.k}:n`, label: 'Ні' }, { v: `${d.k}:u`, label: 'Не знаю' }], `${d.k}:${v || 'u'}`, d.label)}</div>`;
    if (d.kind === 'sel') return `<div class="field"><span class="lbl">${esc(d.label)}</span>${seg('hv-ptri', (d.opts || []).map((o) => ({ v: `${d.k}:${o.v}`, label: o.label })), `${d.k}:${v}`, d.label)}</div>`;
    if (d.kind === 'bool') return `<label class="check"><input type="checkbox" data-hvb="${d.k}"${v === 'y' ? ' checked' : ''}><span>${esc(d.label)}</span></label>`;
    if (prob === 'repair' && c.params.what === 'mold' && (d.k === 'openW' || d.k === 'openH')) return '';
    if (prob === 'repair' && c.params.what !== 'mold' && d.k === 'moldM2') return '';
    const id = `hv-p-${d.k}`;
    return `<div class="field"><label for="${id}">${esc(d.label)}</label>
      <div class="inrow"><input id="${id}" type="text" inputmode="${d.int ? 'numeric' : 'decimal'}" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" data-hvp="${d.k}" data-opt="1"${d.min != null ? ` data-min="${d.min}"` : ''}${d.max != null ? ` data-max="${d.max}"` : ''}${d.int ? ' data-int="1"' : ''} value="${esc(v)}"${d.hint ? ` aria-describedby="${id}-h"` : ''}>${d.unit ? `<span class="unit">${esc(d.unit)}</span>` : ''}</div>
      ${d.hint ? `<p class="hint" id="${id}-h">${esc(d.hint)}</p>` : ''}</div>`;
  }).join('');
  return `<section class="card form hv-form" aria-labelledby="hv-c-h">
    <h3 id="hv-c-h">Умови</h3>
    ${fields}
    <div id="hv-err">${errHtml(r.errors)}</div>
    <div class="field"><span class="lbl">Скільки є часу</span>${seg('hv-time', HAVE_TIMES, c.time, 'Скільки є часу')}</div>
    <div class="field"><label for="hv-budget">Бюджет на бракуюче</label><select id="hv-budget">${BUDGETS.map((b) => `<option value="${b.v}"${b.v === c.budget ? ' selected' : ''}>${esc(b.label)}</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">Обмеження</span><div class="chips">${Object.entries(HAVE_LIMITS).map(([k, l]) => chip('hv-limit', k, l, c.limits.includes(k))).join('')}</div>
    ${inShelter() ? '<p class="hint">У режимі укриття «Не можна виходити» ввімкнено автоматично.</p>' : ''}</div>
  </section>`;
}

/** @param {{k:string, text:string}[]} errors */
function errHtml(errors) {
  return errors.length ? `<div class="note caution"><div class="note-h">${icon('i-warn')}<span class="note-l">Перевірте дані</span></div><ul>${errors.map((e) => `<li>${esc(e.text)}</li>`).join('')}</ul></div>` : '';
}

/* ───────────── Речі ───────────── */

/** @param {string} k @param {ReturnType<typeof cur>} c */
function itemRow(k, c) {
  const def = ITEMS[k];
  const it = /** @type {HaveItem} */ (c.items[k] || { s: 'u' });
  const own = !!store.get().have.items[k];
  const fromRes = !own && c.fromReserve.has(k);
  const params = Object.entries(def.params || {});
  const fields = it.s === 'y' && (def.unit || params.length) ? `<div class="hv-qty">
      ${def.unit ? numField(`hv-q-${k}`, `Скільки є${def.hint ? ` (${def.hint.toLowerCase()})` : ''}`, def.unit, it.q || '', `data-hvq="${k}" data-min="0" data-max="100000"`) : ''}
      ${params.map(([pk, p]) => numField(`hv-x-${k}-${pk}`, p.label, p.unit, it.p?.[pk] || '', `data-hvx="${k}:${pk}" data-min="${p.min}" data-max="${p.max}"`)).join('')}
    </div>` : '';
  return `<div class="hv-item" id="hv-it-${k}">
    <div class="hv-ih"><span class="hv-il" id="hv-il-${k}">${esc(def.label)}</span>${fromRes ? '<span class="hv-tag">з резерву</span>' : ''}</div>
    <div class="seg hv-tri" role="group" aria-labelledby="hv-il-${k}">${[['y', 'Є'], ['n', 'Немає'], ['u', 'Не знаю']].map(([v, l]) => `<button type="button" class="seg-b" data-act="hv-item" data-k="${k}" data-v="${v}" aria-pressed="${it.s === v}">${esc(l)}</button>`).join('')}</div>
    ${fields}
  </div>`;
}

/** @param {string} id @param {string} label @param {string} unit @param {string} value @param {string} attrs */
function numField(id, label, unit, value, attrs) {
  return `<div class="field"><label for="${id}">${esc(label)}</label>
    <div class="inrow"><input id="${id}" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" data-opt="1" ${attrs} value="${esc(value)}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div></div>`;
}

/* ───────────── Оновлення без перебудови сторінки ───────────── */

/** Перераховує й оновлює лише результати. @param {string} prob */
function refresh(prob) {
  const c = cur(prob);
  const r = /** @type {any} */ (evaluate(prob, c));
  const out = document.getElementById('hv-out');
  if (out) out.innerHTML = resultsHtml(r);
  const live = document.getElementById('hv-live');
  if (live) live.textContent = liveText(r);
  const err = document.getElementById('hv-err');
  if (err) err.innerHTML = errHtml(r.errors);
}

/** Власна позначка (або те, що підтягнулося з резерву) для зміни. @param {string} k */
function ownOrMerged(k) {
  const d = store.get();
  if (d.have.items[k]) return { ...d.have.items[k] };
  const m = mergeItems(d.have.items, d.reserve, d.profile.equip).items[k];
  return m ? { ...m } : /** @type {HaveItem} */ ({ s: 'u' });
}

/** @param {string} prob @param {ParentNode} root */
function bindAll(prob, root) {
  root.querySelectorAll('input[data-hvp]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const k = inp.dataset.hvp || '';
    bindNumField(inp, (value) => keepInPlace(inp, () => {
      store.update((d) => { d.have.params[prob] = { ...(d.have.params[prob] || {}), [k]: value.slice(0, 12) }; });
      refresh(prob);
    }));
  });
  root.querySelectorAll('input[data-hvq]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const k = inp.dataset.hvq || '';
    bindNumField(inp, (value) => keepInPlace(inp, () => {
      const it = ownOrMerged(k);
      store.update((d) => { d.have.items[k] = { ...it, s: 'y', q: value.slice(0, 12) }; });
      refresh(prob);
    }));
  });
  root.querySelectorAll('input[data-hvx]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const [k, pk] = (inp.dataset.hvx || ':').split(':');
    bindNumField(inp, (value) => keepInPlace(inp, () => {
      const it = ownOrMerged(k);
      store.update((d) => { d.have.items[k] = { ...it, s: 'y', p: { ...(it.p || {}), [pk]: value.slice(0, 12) } }; });
      refresh(prob);
    }));
  });
  root.querySelectorAll('input[data-hvb]').forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    const k = inp.dataset.hvb || '';
    inp.addEventListener('change', () => keepInPlace(inp, () => {
      store.update((d) => { d.have.params[prob] = { ...(d.have.params[prob] || {}), [k]: inp.checked ? 'y' : 'n' }; });
      refresh(prob);
    }));
  });
  const b = /** @type {HTMLSelectElement|null} */ (root.querySelector ? root.querySelector('#hv-budget') : null);
  b?.addEventListener('change', () => keepInPlace(b, () => {
    store.update((d) => { d.have.budget = Number(b.value) || 0; });
    refresh(prob);
  }));
}

/** Поточна проблема з адреси. */
function probFromHash() {
  const m = location.hash.match(/#\/have\/(\w+)/);
  return m && m[1] in PROBLEMS ? m[1] : '';
}

/** Повторно знаходить кнопку після перебудови й повертає на неї фокус. @param {string} act @param {string} v */
function refocus(act, v) {
  const b = /** @type {HTMLElement|null} */ (document.querySelector(`[data-act="${act}"][data-v="${CSS.escape(v)}"]`));
  b?.focus();
}

/** Відкладене повернення позначок після «Очистити». @type {{prob:string, items:Record<string, HaveItem>, params:any}|null} */
let undo = null;

on({
  'hv-item': (el) => {
    const k = el.dataset.k || '';
    const v = /** @type {'y'|'n'|'u'} */ (el.dataset.v || 'u');
    const prob = probFromHash();
    if (!(k in ITEMS) || !prob) return;
    // Позначили просто в картці варіанта чи у списку речей нижче
    const inCard = !!el.closest('#hv-out');
    const vid = el.closest('article')?.getAttribute('aria-labelledby') || '';
    const row = document.getElementById(`hv-it-${k}`);
    keepInPlace(inCard ? document.getElementById('hv-out') : row, () => {
      const it = ownOrMerged(k);
      store.update((d) => { d.have.items[k] = v === 'y' ? { ...it, s: 'y' } : { s: v }; });
      if (row) {
        const fresh = document.createElement('div');
        fresh.innerHTML = itemRow(k, cur(prob));
        const next = /** @type {HTMLElement} */ (fresh.firstElementChild);
        row.replaceWith(next);
        bindAll(prob, next);
      }
      refresh(prob);
    }, () => (inCard ? document.getElementById('hv-out') : document.getElementById(`hv-it-${k}`)));
    if (inCard) {
      /** @type {HTMLElement|null} */ ((vid && document.getElementById(vid)) || document.getElementById('hv-live'))?.focus({ preventScroll: true });
      app.toast(`${ITEMS[k].label}: ${v === 'y' ? 'є' : 'немає'}`);
    } else {
      /** @type {HTMLElement|null} */ (document.querySelector(`#hv-it-${k} [data-v="${v}"]`))?.focus();
    }
  },
  'hv-ptri': (el) => {
    const [k, val] = (el.dataset.v || ':').split(':');
    const prob = probFromHash();
    if (!prob) return;
    const inCard = !!el.closest('#hv-out');
    store.update((d) => { d.have.params[prob] = { ...(d.have.params[prob] || {}), [k]: val }; });
    app.render();
    // Відповіли просто в картці — лишаємося на місці, а не стрибаємо до форми внизу
    if (inCard) {
      /** @type {HTMLElement|null} */ (document.getElementById('hv-live'))?.focus({ preventScroll: true });
      const d = PROBLEMS[prob].params.find((x) => x.k === k);
      app.toast(`${d ? d.label.replace(/\?$/, '') : k}: ${val === 'y' ? 'так' : 'ні'}`);
    } else refocus('hv-ptri', el.dataset.v || '');
  },
  'hv-time': (el) => {
    const v = el.dataset.v;
    store.update((d) => { d.have.time = v === 'now' || v === 'long' ? v : '30'; });
    app.render();
    refocus('hv-time', v || '');
  },
  'hv-limit': (el) => {
    const k = el.dataset.v || '';
    if (k === 'noOutside' && inShelter()) { app.toast('У режимі укриття виходити не можна — обмеження діє автоматично'); return; }
    store.update((d) => { d.have.limits = d.have.limits.includes(k) ? d.have.limits.filter((x) => x !== k) : [...d.have.limits, k]; });
    app.render();
    refocus('hv-limit', k);
  },
  'hv-reset': (el) => {
    const prob = el.dataset.v || '';
    if (!(prob in PROBLEMS)) return;
    const keys = new Set(itemsFor(prob));
    const d = store.get();
    undo = { prob, items: Object.fromEntries(Object.entries(d.have.items).filter(([k]) => keys.has(k))), params: d.have.params[prob] };
    store.update((x) => {
      for (const k of keys) delete x.have.items[k];
      delete x.have.params[prob];
    });
    app.render();
    app.toast('Позначки й умови очищено', { action: 'hv-undo', label: 'Повернути' });
  },
  'hv-undo': () => {
    if (!undo) return;
    const u = undo;
    undo = null;
    store.update((d) => {
      Object.assign(d.have.items, u.items);
      if (u.params) d.have.params[u.prob] = u.params;
    });
    app.render();
    app.toast('Повернуто');
  },
});


export const haveScreens = { list: listView, problem: problemView };
