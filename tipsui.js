// @ts-check
// Екрани добірок «Як зігрітися», «Як пережити блекаут» (по 100 порад) і «Укриття й тривога» (70 порад):
// головні 10, групи, пошук, розгорнуті пояснення, «Цікаво знати» й джерело біля кожної поради.
// Усі добірки — один шаблон екрана.

import { TIPS_HEAT, TIP_SETS, ALL_TIP_GROUPS, TIP_GO, tipNo } from './tips.js';
import { SOURCES } from './data.js';
import { findAny } from './solutions.js';
import { LESSON_BY_ID } from './master.js';
import { esc, icon, pageHead, empty, on } from './ui.js';
import { TOOL_ICON, TOOL_LABEL } from './shelterui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./tips.js').Tip} Tip */
/** @typedef {import('./tips.js').TipGroup} TipGroup */
/** @typedef {'heat'|'energy'|'shelter'} TipNeed */
/** @typedef {'top'|TipGroup|null} Sel */

/** Пошуковий запит кожної добірки зберігається між переходами в межах сесії. @type {Record<TipNeed, string>} */
const st = { heat: '', energy: '', shelter: '' };

/** Малі літери й один вид апострофа — щоб «з'їсти» і «з’їсти» знаходили одне. @param {string} s */
const norm = (s) => s.toLowerCase().replace(/['`ʼ]/g, '’');

/**
 * Нерозривні пробіли: число не відривається від одиниці, а тире не починає рядок.
 * @param {string} s
 */
const nb = (s) => s
  .replace(/(\d) (?=(?:°C|кВт|Вт|мм|см|м|с|%|км\/год|хв|хвилин|годин|години|років|роки|разів|рази|раз)(?![а-яіїєґ]))/g, '$1\u00A0')
  .replace(/ — /g, '\u00A0— ');

/** Коротка частина поради — те, що видно без розгортання. @param {Tip} t */
const shortText = (t) => norm(`${t.t} ${t.d || ''}`);

/** Розгорнута частина: чому, цікаво знати, як, обережно. @param {Tip} t */
const longText = (t) => norm([t.why || '', t.fact || '', ...(t.how || []), ...(t.warn || [])].join(' '));

/** Увесь текст поради для пошуку, разом із групою й джерелами. @param {Tip} t */
function hay(t) {
  const g = ALL_TIP_GROUPS[t.g];
  return `${shortText(t)} ${longText(t)} ${norm([g.label, g.sub, ...t.src.map((k) => SOURCES[k]?.org || '')].join(' '))}`;
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

/** Добірка за фільтром. @param {TipNeed} need @param {Sel} sel */
function picked(need, sel) {
  const list = TIP_SETS[need].list;
  if (sel === 'top') return list.filter((t) => t.top);
  if (sel) return list.filter((t) => t.g === sel);
  return list;
}

/** Розгорнуте пояснення: чому працює, цікаво знати, як зробити, на що зважати. @param {Tip} t @param {boolean} open */
function moreHtml(t, open) {
  if (!t.why || !t.how?.length) return '';
  return `<details class="tip-x"${open ? ' open' : ''}>
    <summary><span>Чому й як зробити</span></summary>
    <div class="tip-xb">
      <h3 class="tip-h">Чому це працює</h3>
      <p>${esc(nb(t.why))}</p>
      ${t.fact ? `<aside class="tip-fact"><h3 class="tip-h tip-hf">${icon('i-bulb')}<span>Цікаво знати</span></h3><p>${esc(nb(t.fact))}</p></aside>` : ''}
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
  const go = t.go ? TIP_GO[t.go] : null;
  const more = [
    t.tool ? `<button type="button" class="tip-tool" data-act="tool" data-v="${t.tool}">${icon(TOOL_ICON[t.tool])}<span>${esc(TOOL_LABEL[t.tool])}</span></button>` : '',
    go ? `<a href="${esc(t.go)}">${icon(go.ic)}<span>${esc(go.t)}</span></a>` : '',
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

/** @param {TipNeed} need @param {Sel} sel */
function listBody(need, sel) {
  const set = TIP_SETS[need];
  const q = st[need].trim();
  const base = picked(need, sel);
  if (q) {
    const res = searchTips(q, base);
    if (!res.length) return empty('empty-search', 'Нічого не знайдено', `Спробуйте інше слово${sel ? ' або оберіть «Усі»' : ''}.`);
    const words = wordsOf(q);
    // Знайшлося лише в поясненні — розгортаємо його, щоб було видно, чому порада тут
    const open = (/** @type {Tip} */ t) => !words.every((w) => shortText(t).includes(w));
    return `<p class="count">Знайдено порад: ${res.length}</p><ul class="tips">${res.map((t) => tipHtml(t, open(t))).join('')}</ul>`;
  }
  if (sel === 'top') return `<ul class="tips">${base.map((t) => tipHtml(t, true)).join('')}</ul>`;
  return (sel ? [sel] : set.order).map((g) => {
    const items = set.list.filter((t) => t.g === g);
    const G = ALL_TIP_GROUPS[g];
    return `<section class="tip-g" aria-labelledby="tg-${g}">
      <h2 class="h2" id="tg-${g}">${esc(G.label)} <span class="muted">· ${esc(G.sub)} · ${items.length}</span></h2>
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

/** @param {TipNeed} need @param {string} v @param {string} label @param {boolean} cur */
function chipLink(need, v, label, cur) {
  return `<a class="chip" href="#/tips/${need}${v ? `?g=${v}` : ''}" aria-current="${cur ? 'page' : 'false'}">${cur ? icon('i-check') : ''}<span>${esc(label)}</span></a>`;
}

/** Екран однієї добірки. @param {TipNeed} need */
function makeView(need) {
  const set = TIP_SETS[need];
  /** @param {URLSearchParams} q @returns {View} */
  return (q) => {
    const g = q.get('g');
    const grp = /** @type {TipGroup} */ (g);
    /** @type {Sel} */
    const sel = g === 'top' ? 'top' : g && set.order.includes(grp) ? grp : null;
    const title = `${set.title}: ${set.list.length} порад`;
    return {
      title,
      tab: need === 'shelter' ? 'shelter' : 'home',
      html: `${pageHead(title, set.back, 'Кожна — з поясненням, кроками й офіційним чи університетським джерелом')}
      <div class="chips ms-chips tp-chips" role="group" aria-label="Добірка порад">
        ${chipLink(need, 'top', `Головні ${set.list.filter((t) => t.top).length}`, sel === 'top')}
        ${chipLink(need, '', `Усі ${set.list.length}`, sel === null)}
        ${set.order.map((x) => chipLink(need, x, ALL_TIP_GROUPS[x].label, sel === x)).join('')}
      </div>
      <div class="search">${icon('i-search')}<input id="tp-q" type="search" inputmode="search" autocomplete="off" placeholder="${esc(set.ph)}" aria-label="Пошук порад" value="${esc(st[need])}"></div>
      <p class="hint">${sel === 'top'
        ? `${icon('i-star-f')} ${esc(set.topHint)}`
        : `${icon('i-info')} Під кожною порадою — «Чому й як зробити»${set.list.some((t) => t.fact) ? ', а в багатьох — ще й «Цікаво знати»' : ''}. Номер поради не змінюється.`}</p>
      <button type="button" class="btn ghost tp-all" data-act="tips-all" aria-pressed="false">${icon('i-layers')}<span>Розгорнути всі пояснення</span></button>
      <div id="tp-out" aria-live="polite">${listBody(need, sel)}</div>`,
      after() {
        const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('tp-q'));
        const out = document.getElementById('tp-out');
        inp?.addEventListener('input', () => { st[need] = inp.value; if (out) out.innerHTML = listBody(need, sel); syncAllBtn(); });
        out?.addEventListener('toggle', syncAllBtn, true);
        syncAllBtn();
      },
    };
  };
}

export const tipsScreens = { heat: makeView('heat'), energy: makeView('energy'), shelter: makeView('shelter') };
