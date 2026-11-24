// @ts-check
// Екран «Як зігрітися: 100 порад»: головні 10, групи, пошук, розгорнуті пояснення й джерело біля кожної поради.

import { TIPS_HEAT, TIP_GROUPS, TIP_GROUP_ORDER, tipNo } from './tips.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { esc, icon, pageHead, empty, on } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./tips.js').Tip} Tip */
/** @typedef {import('./tips.js').TipGroup} TipGroup */
/** @typedef {'top'|TipGroup|null} Sel */

/** Пошуковий запит зберігається між переходами в межах сесії. */
const st = { q: '' };

/** Малі літери й один вид апострофа — щоб «з'їсти» і «з’їсти» знаходили одне. @param {string} s */
const norm = (s) => s.toLowerCase().replace(/['`ʼ]/g, '’');

/**
 * Нерозривні пробіли: число не відривається від одиниці, а тире не починає рядок.
 * @param {string} s
 */
const nb = (s) => s
  .replace(/(\d) (?=(?:°C|Вт|мм|см|м|%|км\/год|хв|хвилин|років|роки|разів|рази|раз)(?![а-яіїєґ]))/g, '$1 ')
  .replace(/ — /g, ' — ');

/** Коротка частина поради — те, що видно без розгортання. @param {Tip} t */
const shortText = (t) => norm(`${t.t} ${t.d || ''}`);

/** Розгорнута частина: чому, як, обережно. @param {Tip} t */
const longText = (t) => norm([t.why || '', ...(t.how || []), ...(t.warn || [])].join(' '));

/** Увесь текст поради для пошуку, разом із групою й джерелами. @param {Tip} t */
function hay(t) {
  return `${shortText(t)} ${longText(t)} ${norm([TIP_GROUPS[t.g].label, TIP_GROUPS[t.g].sub, ...t.src.map((k) => SOURCES[k]?.org || '')].join(' '))}`;
}

/** @param {string} q */
const wordsOf = (q) => norm(q).split(/\s+/).filter(Boolean);

/**
 * Пошук: кожне слово запиту має трапитися в тексті поради, зокрема в поясненні.
 * @param {string} q @param {Tip[]} [list]
 */
export function searchTips(q, list = TIPS_HEAT) {
  const words = wordsOf(q);
  if (!words.length) return list;
  return list.filter((t) => words.every((w) => hay(t).includes(w)));
}

/** Добірка за фільтром. @param {Sel} sel */
function picked(sel) {
  if (sel === 'top') return TIPS_HEAT.filter((t) => t.top);
  if (sel) return TIPS_HEAT.filter((t) => t.g === sel);
  return TIPS_HEAT;
}

/** Розгорнуте пояснення: чому працює, як зробити, на що зважати. @param {Tip} t @param {boolean} open */
function moreHtml(t, open) {
  if (!t.why || !t.how?.length) return '';
  return `<details class="tip-x"${open ? ' open' : ''}>
    <summary><span>Чому й як зробити</span></summary>
    <div class="tip-xb">
      <h3 class="tip-h">Чому це працює</h3>
      <p>${esc(nb(t.why))}</p>
      <h3 class="tip-h">Як зробити</h3>
      <ol class="tip-how">${t.how.map((s) => `<li>${esc(nb(s))}</li>`).join('')}</ol>
      ${t.warn?.length ? `<h3 class="tip-h tip-hw">${icon('i-warn')}<span>Обережно</span></h3><ul class="tip-warn">${t.warn.map((s) => `<li>${esc(nb(s))}</li>`).join('')}</ul>` : ''}
    </div>
  </details>`;
}

/** @param {Tip} t @param {boolean} [open] розгорнути пояснення одразу */
function tipHtml(t, open = false) {
  const n = tipNo(t);
  const srcs = t.src.map((k) => SOURCES[k]).filter(Boolean);
  const sol = t.sol ? findAny(t.sol) : null;
  const ls = t.ls ? LESSON_BY_ID.get(t.ls) : null;
  const more = [
    sol ? `<a href="#/s/${esc(sol.id)}">${icon('i-book')}<span>${esc(sol.title)}</span></a>` : '',
    ls ? `<a href="#/master/${esc(ls.id)}">${icon('i-hammer')}<span>Урок: ${esc(ls.title)}</span></a>` : '',
  ].filter(Boolean).join('');
  return `<li class="tip${t.top ? ' top' : ''}" id="tip-${n}">
    <span class="tip-n" aria-hidden="true">${n}</span>
    <div class="tip-b">
      <p class="tip-t"><span class="sr-only">Порада ${n}. </span>${esc(nb(t.t))}</p>
      ${t.d ? `<p class="tip-d">${esc(nb(t.d))}</p>` : ''}
      ${moreHtml(t, open)}
      <p class="tip-s">${srcs.length > 1 ? 'Джерела' : 'Джерело'}: ${srcs.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(s.org)}</a>`).join(' · ')}</p>
      ${more ? `<p class="tip-more">${more}</p>` : ''}
    </div>
  </li>`;
}

/** @param {Sel} sel */
function listBody(sel) {
  const q = st.q.trim();
  const base = picked(sel);
  if (q) {
    const res = searchTips(q, base);
    if (!res.length) return empty('empty-search', 'Нічого не знайдено', `Спробуйте інше слово${sel ? ' або оберіть «Усі»' : ''}.`);
    const words = wordsOf(q);
    // Знайшлося лише в поясненні — розгортаємо його, щоб було видно, чому порада тут
    const open = (/** @type {Tip} */ t) => !words.every((w) => shortText(t).includes(w));
    return `<p class="count">Знайдено порад: ${res.length}</p><ul class="tips">${res.map((t) => tipHtml(t, open(t))).join('')}</ul>`;
  }
  if (sel === 'top') return `<ul class="tips">${base.map((t) => tipHtml(t, true)).join('')}</ul>`;
  return (sel ? [sel] : TIP_GROUP_ORDER).map((g) => {
    const items = TIPS_HEAT.filter((t) => t.g === g);
    return `<section class="tip-g" aria-labelledby="tg-${g}">
      <h2 class="h2" id="tg-${g}">${esc(TIP_GROUPS[g].label)} <span class="muted">· ${esc(TIP_GROUPS[g].sub)} · ${items.length}</span></h2>
      <ul class="tips">${items.map((t) => tipHtml(t)).join('')}</ul>
    </section>`;
  }).join('');
}

/** Чи всі пояснення на екрані розгорнуті. */
function allOpen() {
  const ds = [...document.querySelectorAll('#tp-out details.tip-x')];
  return ds.length > 0 && ds.every((d) => /** @type {HTMLDetailsElement} */ (d).open);
}

/** Напис і стан кнопки «Розгорнути всі». */
function syncAllBtn() {
  const b = document.querySelector('[data-act="tips-all"]');
  if (!b) return;
  const opened = allOpen();
  b.setAttribute('aria-pressed', String(opened));
  const label = b.querySelector('span');
  if (label) label.textContent = opened ? 'Згорнути всі пояснення' : 'Розгорнути всі пояснення';
}

on({
  'tips-all': () => {
    const open = !allOpen();
    for (const d of document.querySelectorAll('#tp-out details.tip-x')) /** @type {HTMLDetailsElement} */ (d).open = open;
    syncAllBtn();
  },
});

/** @param {string} v @param {string} label @param {boolean} cur */
function chipLink(v, label, cur) {
  return `<a class="chip" href="#/tips/heat${v ? `?g=${v}` : ''}" aria-current="${cur ? 'page' : 'false'}">${cur ? icon('i-check') : ''}<span>${esc(label)}</span></a>`;
}

/** @param {URLSearchParams} q @returns {View} */
function heatView(q) {
  const g = q.get('g');
  /** @type {Sel} */
  const sel = g === 'top' ? 'top' : g && g in TIP_GROUPS ? /** @type {TipGroup} */ (g) : null;
  const title = `Як зігрітися: ${TIPS_HEAT.length} порад`;
  return {
    title,
    tab: 'home',
    html: `${pageHead(title, '#/need/heat', 'Кожна — з поясненням, кроками й офіційним чи університетським джерелом')}
    <div class="chips ms-chips tp-chips" role="group" aria-label="Добірка порад">
      ${chipLink('top', `Головні ${TIPS_HEAT.filter((t) => t.top).length}`, sel === 'top')}
      ${chipLink('', `Усі ${TIPS_HEAT.length}`, sel === null)}
      ${TIP_GROUP_ORDER.map((x) => chipLink(x, TIP_GROUPS[x].label, sel === x)).join('')}
    </div>
    <div class="search">${icon('i-search')}<input id="tp-q" type="search" inputmode="search" autocomplete="off" placeholder="Наприклад: штори, грілка, немовля" aria-label="Пошук порад" value="${esc(st.q)}"></div>
    <p class="hint">${sel === 'top'
      ? `${icon('i-star-f')} Почніть із цих десяти — вони працюють без світла й опалення.`
      : `${icon('i-info')} Під кожною порадою — «Чому й як зробити». Номер поради не змінюється.`}</p>
    <button type="button" class="btn ghost tp-all" data-act="tips-all" aria-pressed="false">${icon('i-layers')}<span>Розгорнути всі пояснення</span></button>
    <div id="tp-out" aria-live="polite">${listBody(sel)}</div>`,
    after() {
      const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('tp-q'));
      const out = document.getElementById('tp-out');
      inp?.addEventListener('input', () => { st.q = inp.value; if (out) out.innerHTML = listBody(sel); syncAllBtn(); });
      out?.addEventListener('toggle', syncAllBtn, true);
      syncAllBtn();
    },
  };
}

export const tipsScreens = { heat: heatView };
