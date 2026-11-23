// @ts-check
// Екрани «Майстер предків»: сім напрямів, уроки зі схемою, кроками й джерелами.

import { DIRS, DIR_ORDER, LESSONS, LESSON_BY_ID, lessonsOf } from './master.js';
import { BY_ID } from './solutions.js';
import { esc, icon, note, pageHead, sourcesList, empty } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */

/** @param {URLSearchParams} q @returns {View} */
function listView(q) {
  const dir = q.get('d');
  const only = dir && dir in DIRS ? /** @type {keyof typeof DIRS} */ (dir) : null;
  const dirs = only ? [only] : DIR_ORDER;
  return {
    title: 'Майстер предків',
    tab: 'home',
    html: `${pageHead('Майстер предків', '#/', `${LESSONS.length} уроків: як робили колись — і як безпечно зараз`)}
    <div class="chips ms-chips" role="group" aria-label="Напрям">
      <a class="chip" href="#/master" aria-current="${only ? 'false' : 'page'}">${only ? '' : icon('i-check')}<span>Усі</span></a>
      ${DIR_ORDER.map((d) => `<a class="chip" href="#/master?d=${d}" aria-current="${only === d ? 'page' : 'false'}">${only === d ? icon('i-check') : ''}<span>${esc(DIRS[d].label)}</span></a>`).join('')}
    </div>
    <p class="hint">${icon('i-info')} Історичне не означає безпечне: у кожному уроці — що змінилося, чому, і як зробити сьогодні без ризику. Кожна порада — з джерелом.</p>
    ${dirs.map((d) => `<section class="ms-dir" aria-labelledby="ms-${d}">
      <h2 class="h2" id="ms-${d}">${esc(DIRS[d].label)} <span class="muted">· ${esc(DIRS[d].sub)}</span></h2>
      <div class="rows">${lessonsOf(d).map((l) => `<a class="row two" href="#/master/${l.id}">${icon(DIRS[d].icon)}<span><b>${esc(l.title)}</b><span class="muted">${esc(l.goal)}</span></span>${icon('i-chev', 'end')}</a>`).join('')}</div>
    </section>`).join('')}`,
  };
}

/** @param {string} id @returns {View} */
function lessonView(id) {
  const l = LESSON_BY_ID.get(id);
  if (!l) return { title: 'Не знайдено', tab: '', html: `${pageHead('Урок не знайдено', '#/master')}${empty('il-lamp', 'Такого уроку немає', 'Можливо, посилання застаріло.', '<a class="btn primary" href="#/master">До всіх уроків</a>')}` };
  const list = lessonsOf(l.dir);
  const i = list.indexOf(l);
  const prev = list[i - 1], next = list[i + 1];
  const sol = l.solId ? BY_ID.get(l.solId) : null;
  return {
    title: l.title,
    tab: '',
    html: `<div class="ph">
      <a class="back" href="#/master?d=${l.dir}" aria-label="Назад до напряму">${icon('i-back')}<span>${esc(DIRS[l.dir].label)}</span></a>
      <h1 tabindex="-1">${esc(l.title)}</h1>
      <p class="sub">${esc(l.goal)}</p>
    </div>
    <section class="sec"><h2>Схема</h2>
      <ol class="ms-scheme" aria-label="Схема: ${esc(l.title)}">${l.scheme.map((n, k) => `<li><span class="ms-n" aria-hidden="true">${k + 1}</span><b>${esc(n.t)}</b><span>${esc(n.d)}</span></li>`).join('')}</ol>
    </section>
    <section class="sec ms-then"><h2>${icon('i-book')}Як робили колись</h2><p>${esc(l.history)}</p>
      ${note('caution', 'Що змінилося', l.histNote)}
    </section>
    <section class="sec"><h2>${icon('i-shield')}Як безпечно зараз</h2><p>${esc(l.modern)}</p></section>
    <section class="sec ms-two">
      <div><h2>Матеріали</h2><ul class="mat">${l.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>
      <div><h2>Інструменти</h2>${l.tools.length ? `<ul class="mat">${l.tools.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="muted">Не потрібні</p>'}</div>
    </section>
    <section class="sec"><h2>Кроки</h2>
      <ol class="steps">${l.steps.map((st, k) => `<li><button type="button" class="step" data-act="step" data-id="m-${l.id}" data-i="${k}" aria-pressed="false"><span class="box" aria-hidden="true">${icon('i-check')}</span><span class="num">${k + 1}</span><span class="txt">${esc(st)}</span></button></li>`).join('')}</ol>
      <p class="steps-st" id="steps-st" aria-live="polite">Торкніться кроку, щоб позначити виконаним.</p>
    </section>
    <section class="sec">${note('caution', 'Обмеження', '', `<ul>${l.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`)}</section>
    <section class="sec"><h2>Типові помилки</h2><ul class="ms-err">${l.mistakes.map((x) => `<li>${icon('i-close')}<span>${esc(x)}</span></li>`).join('')}</ul></section>
    ${sol ? `<section class="sec"><h2>У бібліотеці рішень</h2><a class="card mini" href="#/s/${sol.id}"><span class="mini-t">${esc(sol.title)}</span><span class="muted">${esc('result' in sol ? sol.result : '')}</span>${icon('i-chev', 'end')}</a></section>` : ''}
    <section class="sec"><h2>Джерела</h2>${sourcesList(l.src)}</section>
    ${prev || next ? `<nav class="rows ms-nav" aria-label="Інші уроки напряму">
      ${prev ? `<a class="row two" href="#/master/${prev.id}">${icon('i-back')}<span><span class="muted">Попередній урок</span><b>${esc(prev.title)}</b></span></a>` : ''}
      ${next ? `<a class="row two" href="#/master/${next.id}">${icon(DIRS[l.dir].icon)}<span><span class="muted">Наступний урок</span><b>${esc(next.title)}</b></span>${icon('i-chev', 'end')}</a>` : ''}
    </nav>` : ''}`,
  };
}


export const masterScreens = { list: listView, lesson: lessonView };
