// @ts-check
// Екран «Як зігрітися: 100 порад»: головні 10, групи, пошук і джерело біля кожної поради.

import { TIPS_HEAT, TIP_GROUPS, TIP_GROUP_ORDER, tipNo } from './tips.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { esc, icon, pageHead, empty } from './ui.js';

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
  .replace(/(\d) (?=(?:°C|Вт|мм|см|м|%|км\/год|хв|хвилин|років|роки)(?![а-яіїєґ]))/g, '$1\u00A0')
  .replace(/ — /g, '\u00A0— ');

/** Текст поради для пошуку: сама порада, пояснення, група й джерела. @param {Tip} t */
function hay(t) {
  return norm([t.t, t.d || '', TIP_GROUPS[t.g].label, TIP_GROUPS[t.g].sub, ...t.src.map((k) => SOURCES[k]?.org || '')].join(' '));
}

/**
 * Пошук: кожне слово запиту має трапитися в тексті поради.
 * @param {string} q @param {Tip[]} [list]
 */
export function searchTips(q, list = TIPS_HEAT) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((t) => words.every((w) => hay(t).includes(w)));
}

/** Добірка за фільтром. @param {Sel} sel */
function picked(sel) {
  if (sel === 'top') return TIPS_HEAT.filter((t) => t.top);
  if (sel) return TIPS_HEAT.filter((t) => t.g === sel);
  return TIPS_HEAT;
}

/** @param {Tip} t */
function tipHtml(t) {
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
    return `<p class="count">Знайдено порад: ${res.length}</p><ul class="tips">${res.map(tipHtml).join('')}</ul>`;
  }
  if (sel === 'top') return `<ul class="tips">${base.map(tipHtml).join('')}</ul>`;
  return (sel ? [sel] : TIP_GROUP_ORDER).map((g) => {
    const items = TIPS_HEAT.filter((t) => t.g === g);
    return `<section class="tip-g" aria-labelledby="tg-${g}">
      <h2 class="h2" id="tg-${g}">${esc(TIP_GROUPS[g].label)} <span class="muted">· ${esc(TIP_GROUPS[g].sub)} · ${items.length}</span></h2>
      <ul class="tips">${items.map(tipHtml).join('')}</ul>
    </section>`;
  }).join('');
}

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
    html: `${pageHead(title, '#/need/heat', 'Перевірені поради — кожна з офіційним чи університетським джерелом')}
    <div class="chips ms-chips tp-chips" role="group" aria-label="Добірка порад">
      ${chipLink('top', `Головні ${TIPS_HEAT.filter((t) => t.top).length}`, sel === 'top')}
      ${chipLink('', `Усі ${TIPS_HEAT.length}`, sel === null)}
      ${TIP_GROUP_ORDER.map((x) => chipLink(x, TIP_GROUPS[x].label, sel === x)).join('')}
    </div>
    <div class="search">${icon('i-search')}<input id="tp-q" type="search" inputmode="search" autocomplete="off" placeholder="Наприклад: штори, грілка, немовля" aria-label="Пошук порад" value="${esc(st.q)}"></div>
    <p class="hint">${sel === 'top'
      ? `${icon('i-star-f')} Почніть із цих десяти — вони працюють без світла й опалення.`
      : `${icon('i-info')} Номер поради не змінюється. Посилання на джерела відкриваються, коли є інтернет.`}</p>
    <div id="tp-out" aria-live="polite">${listBody(sel)}</div>`,
    after() {
      const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('tp-q'));
      const out = document.getElementById('tp-out');
      inp?.addEventListener('input', () => { st.q = inp.value; if (out) out.innerHTML = listBody(sel); });
    },
  };
}

export const tipsScreens = { heat: heatView };
