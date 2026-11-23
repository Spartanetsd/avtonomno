// @ts-check
// «Що маю — те використовую». Людина обирає проблему й позначає, що є під рукою;
// застосунок перевіряє обов’язкові умови й кількості та пропонує до трьох безпечних варіантів.
// Правила: невідоме («не знаю») ніколи не вважається наявним; кількості рахуються лише з
// введених розмірів; небезпечні способи не пропонуються — вони окремо, з причиною й джерелом.

import { num, fmt, daysText } from './calc.js';
import { DRINK_PER_DAY } from './safety.js';
import { MYTHS } from './solutions.js';

/** @typedef {'y'|'n'|'u'} Tri */
/** @typedef {{s: Tri, q?: string, p?: Record<string, string>}} HaveItem */
/** @typedef {'now'|'30'|'long'} HaveTime */
/** @typedef {{items: Record<string, HaveItem>, params: Record<string, string>, time: HaveTime, budget: number, limits: string[]}} HaveInput */

/* ───────────── Речі ───────────── */

/**
 * Каталог речей. unit — одиниця кількості (порожня — лише «є / немає»);
 * band — орієнтовна ціна, якщо доведеться купити: 0 — зазвичай є вдома, 1 — до 500 грн, 2 — до 2 000, 3 — до 5 000;
 * res — ключ «Мого резерву» (звідти підтягуємо стан, а кількість — лише за однакових одиниць);
 * params — технічні характеристики, без яких розрахунок неточний.
 * @type {Record<string, {label:string, unit:string, band:0|1|2|3, res?:string, tool?:boolean, hint?:string, params?: Record<string, {label:string, unit:string, min:number, max:number}>}>}
 */
export const ITEMS = {
  film: { label: 'Прозора плівка (поліетилен)', unit: 'м²', band: 1, hint: 'Площа, яку можна вкрити' },
  tape2: { label: 'Двосторонній скотч', unit: 'м', band: 1 },
  paintTape: { label: 'Малярний скотч', unit: 'м', band: 1 },
  foamStrip: { label: 'Самоклейний ущільнювач', unit: 'м', band: 1, res: 'sealTape' },
  towels: { label: 'Рушники або тканинний валик', unit: 'шт', band: 0 },
  curtains: { label: 'Щільні штори', unit: 'вікон', band: 2, hint: 'Скільки вікон ними можна закрити' },
  blankets: { label: 'Ковдри й пледи', unit: 'шт', band: 2, res: 'blankets' },
  clips: { label: 'Прищіпки, кнопки чи шнур', unit: '', band: 0 },
  scissors: { label: 'Ножиці або канцелярський ніж', unit: '', band: 0, tool: true },
  warmClothes: { label: 'Теплий одяг: шапка, шкарпетки, светр', unit: '', band: 0 },
  tent: { label: 'Туристичний намет', unit: 'шт', band: 3, res: 'tent' },
  mat: { label: 'Каремат або матрац', unit: 'шт', band: 2, res: 'mat' },
  sleepingBag: { label: 'Спальник', unit: 'шт', band: 3, res: 'sleepingBag' },
  hotBottle: { label: 'Гумова грілка', unit: 'шт', band: 1, res: 'hotBottle' },
  lamp: { label: 'Акумуляторна LED-лампа', unit: 'шт', band: 2, res: 'lamp', params: { h: { label: 'Світить на одному заряді', unit: 'год', min: 0.1, max: 1000 } } },
  headlamp: { label: 'Налобний ліхтар', unit: 'шт', band: 2, res: 'headlamp', params: { h: { label: 'Світить на одному заряді', unit: 'год', min: 0.1, max: 1000 } } },
  usbLamp: { label: 'USB-лампа або LED-стрічка на 5 В', unit: 'шт', band: 1, params: { w: { label: 'Потужність', unit: 'Вт', min: 0.1, max: 60 } } },
  powerbank: { label: 'Павербанк', unit: 'шт', band: 2, res: 'powerbank', params: { mah: { label: 'Ємність (на корпусі)', unit: 'мА·год', min: 500, max: 100000 }, pct: { label: 'Заряд зараз', unit: '%', min: 0, max: 100 } } },
  spareBatt: { label: 'Запасні батарейки до ліхтаря', unit: '', band: 1, res: 'aaBatteries' },
  drinkWater: { label: 'Питна вода в запасі', unit: 'л', band: 1, res: 'drinkWater' },
  canister: { label: 'Харчові ємності з кришками', unit: 'л', band: 1, res: 'canister', hint: 'Загальний об’єм порожніх ємностей' },
  bleach: { label: 'Хлорний відбілювач без ароматизаторів', unit: '', band: 1, res: 'bleach', params: { pct: { label: 'Гіпохлорит натрію (на етикетці)', unit: '%', min: 0.1, max: 20 } } },
  dropper: { label: 'Піпетка', unit: '', band: 1 },
  marker: { label: 'Маркер або наліпки', unit: '', band: 0 },
  bucket: { label: 'Відро з щільною кришкою', unit: 'шт', band: 1, res: 'bucket' },
  toiletBowl: { label: 'Унітаз (чаша, навіть без змиву)', unit: '', band: 0 },
  bags: { label: 'Міцні пакети для сміття', unit: 'шт', band: 1, res: 'bags', params: { l: { label: 'Об’єм одного пакета', unit: 'л', min: 5, max: 300 } } },
  filler: { label: 'Наповнювач: котячий, тирса чи папір', unit: '', band: 1 },
  gloves: { label: 'Рукавички', unit: '', band: 1 },
  soap: { label: 'Мило або антисептик від 60 % спирту', unit: '', band: 1, res: 'antiseptic' },
  bottle: { label: 'Пластикова пляшка з кришкою', unit: '', band: 0 },
  battens: { label: 'Дерев’яні рейки', unit: 'м', band: 2 },
  nails: { label: 'Цвяхи 5 см або шурупи', unit: 'шт', band: 1 },
  hammer: { label: 'Молоток', unit: '', band: 1, tool: true },
  driver: { label: 'Шуруповерт або викрутка', unit: '', band: 2, tool: true },
  saw: { label: 'Ножівка', unit: '', band: 1, tool: true },
  osb: { label: 'Лист OSB чи фанери', unit: 'м²', band: 2 },
  goggles: { label: 'Захисні окуляри', unit: '', band: 1 },
  mask: { label: 'Респіратор FFP2 або N95', unit: '', band: 1 },
  detergent: { label: 'Мийний засіб', unit: '', band: 0 },
  rags: { label: 'Ганчірки, які не шкода викинути', unit: '', band: 0 },
  hygrometer: { label: 'Термометр-гігрометр', unit: '', band: 1, res: 'hygrometer' },
};

/** Верхня межа ціни для кожної категорії, грн (лише для порівняння з бюджетом). */
export const BAND_MAX = [0, 500, 2000, 5000];

/* ───────────── Проблеми та їхні параметри ───────────── */

/**
 * @typedef {{k:string, label:string, unit?:string, int?:boolean, min?:number, max?:number, hint?:string, kind?:'num'|'tri'|'sel'|'bool', opts?:{v:string, label:string}[]}} ProbParam
 */

/** @type {Record<string, {label:string, sub:string, icon:string, params:ProbParam[], banned:({myth:string}|{title:string, why:string, src:string[]})[]}>} */
export const PROBLEMS = {
  insulate: {
    label: 'Утеплити приміщення', sub: 'вікна, двері, щілини', icon: 'i-home',
    params: [
      { k: 'windows', label: 'Вікон у кімнаті', unit: 'шт', int: true, min: 0, max: 20 },
      { k: 'winW', label: 'Ширина вікна (по рамі)', unit: 'м', min: 0.2, max: 6 },
      { k: 'winH', label: 'Висота вікна (по рамі)', unit: 'м', min: 0.2, max: 4 },
      { k: 'doors', label: 'Дверей, крізь які дме', unit: 'шт', int: true, min: 0, max: 10 },
      { k: 'doorP', label: 'Периметр дверей', unit: 'м', min: 1, max: 20, hint: '(ширина + висота) × 2; для дверей 0,9 × 2 м — 5,8 м' },
    ],
    banned: [{ myth: 'myth-seal-vents' }, { myth: 'myth-diy-heater' }],
  },
  keepwarm: {
    label: 'Зберегти тепло', sub: 'люди, ліжко, ніч', icon: 'i-heart',
    params: [
      { k: 'people', label: 'Людей', unit: 'осіб', int: true, min: 1, max: 30 },
      { k: 'infant', label: 'Є дитина до 1 року', kind: 'bool' },
      { k: 'hotWater', label: 'Чи є чим нагріти воду (світло, газ, станція)?', kind: 'tri' },
    ],
    banned: [
      { myth: 'myth-gas-stove' },
      { title: 'Газовий балон з пальником чи «насадкою-обігрівачем» у житлі', why: 'Балон і пальник у закритому приміщенні — ризик отруєння чадним газом, пожежі й вибуху. Для обігріву житла їх не використовують.', src: ['kmdaBurner', 'cdcCO'] },
      { myth: 'myth-candle-heater' }, { myth: 'myth-grill' }, { myth: 'myth-generator' }, { myth: 'myth-car-garage' }, { myth: 'myth-diy-heater' },
    ],
  },
  light: {
    label: 'Автономне світло', sub: 'лампи, ліхтарі, павербанк', icon: 'i-sun',
    params: [
      { k: 'hours', label: 'Скільки годин світла потрібно щодоби', unit: 'год', min: 0.5, max: 24 },
      { k: 'days', label: 'На скільки діб', unit: 'діб', min: 0.5, max: 30 },
    ],
    banned: [
      { title: 'Свічка як основне світло', why: 'Свічки — часта причина пожеж. Під час відключень радять ліхтарі й LED-лампи. Якщо свічка — крайній засіб: стійка підставка, 30 см від усього, що горить, і ніколи без нагляду.', src: ['nfpaCandle', 'cdcStorm'] },
      { title: 'Гасова лампа чи каганець у житлі', why: 'Відкрите полум’я й продукти горіння: ризик пожежі й отруєння чадним газом.', src: ['cdcCO'] },
    ],
  },
  water: {
    label: 'Водний запас', sub: 'скільки треба, де тримати, як знезаразити', icon: 'i-drop',
    params: [
      { k: 'people', label: 'Людей', unit: 'осіб', int: true, min: 1, max: 30 },
      { k: 'days', label: 'На скільки діб', unit: 'діб', min: 1, max: 30 },
      { k: 'tap', label: 'Вода з крана є зараз?', kind: 'tri' },
      { k: 'heat', label: 'Чи є чим кип’ятити воду?', kind: 'tri' },
    ],
    banned: [
      { myth: 'myth-boil-chem' },
      { title: 'Пити дощову воду без знезараження', why: 'Дощова вода може містити мікроби й хімічні речовини з дахів і ринв. Без очищення — лише технічна.', src: ['cdcRain'] },
      { title: 'Саморобні фільтри з піску, вугілля чи тканини для питної води', why: 'Немає підтвердження, що вони знешкоджують бактерії й віруси. Для пиття — кип’ятіння або знезараження за інструкцією CDC.', src: ['cdcWater'] },
    ],
  },
  sanitation: {
    label: 'Санітарія без води', sub: 'туалет, руки, сміття', icon: 'i-shield',
    params: [
      { k: 'people', label: 'Людей', unit: 'осіб', int: true, min: 1, max: 30 },
      { k: 'days', label: 'На скільки діб', unit: 'діб', min: 1, max: 30 },
    ],
    banned: [
      { title: 'Змивати в пошкоджену каналізацію', why: 'Стоки можуть повернутися у вашу чи сусідню квартиру. Коли каналізація пошкоджена — лише пакети.', src: ['toiletKC'] },
      { title: 'Спалювати сміття вдома чи на балконі', why: 'Дим токсичний, вогонь небезпечний.', src: ['toiletOSU'] },
    ],
  },
  repair: {
    label: 'Простий ремонт', sub: 'розбите вікно, пліснява', icon: 'i-box',
    params: [
      { k: 'what', label: 'Що сталося', kind: 'sel', opts: [{ v: 'window', label: 'Розбите вікно' }, { v: 'mold', label: 'Пліснява' }] },
      { k: 'openW', label: 'Ширина отвору', unit: 'м', min: 0.1, max: 6 },
      { k: 'openH', label: 'Висота отвору', unit: 'м', min: 0.1, max: 4 },
      { k: 'moldM2', label: 'Площа плісняви', unit: 'м²', min: 0, max: 500 },
    ],
    banned: [
      { title: 'Ремонт електропроводки, розеток чи щитка', why: 'Ризик ураження струмом і пожежі. Застосунок не дає схем електроживлення — це робота для електрика.', src: [] },
      { title: 'Ремонт газових приладів і труб', why: 'Лише аварійна газова служба: 104.', src: [] },
      { title: 'Різати чи ламати шифер і старі плити', why: 'Вони можуть містити азбест. Не ріжте, не ламайте й не використовуйте повторно.', src: ['shelterIec'] },
    ],
  },
};

export const PROB_ORDER = ['insulate', 'keepwarm', 'light', 'water', 'sanitation', 'repair'];

/** Скільки часу є. */
export const HAVE_TIMES = [
  { v: /** @type {HaveTime} */ ('now'), label: 'До 10 хв', max: 10 },
  { v: /** @type {HaveTime} */ ('30'), label: 'До 30 хв', max: 30 },
  { v: /** @type {HaveTime} */ ('long'), label: 'Кілька годин', max: 600 },
];

/** Обмеження модуля. */
export const HAVE_LIMITS = {
  noDamage: 'Орендоване житло: без пошкоджень',
  noOutside: 'Не можна виходити: купити чи набрати',
};

/* ───────────── Константи з джерел ───────────── */

/** Запас плівки на кожен бік рами, м. */
const FILM_MARGIN = 0.05;
/** Відходи з аварійного туалету: ≈19 л (5 галонів) на людину на тиждень — Oregon OEM. */
export const WASTE_L_DAY = 19 / 7;
/** Пакет заповнюють не більше ніж наполовину — Multnomah County. */
const BAG_FILL = 0.5;
/** Крок кріплення плівки через рейки — 30 см (Shelter Cluster). */
const NAIL_STEP = 0.3;
/** Ємність павербанків указують за напругою елементів ≈3,7 В; до 5 В доходить ≈70 % (калькулятор «Розрахунки»). */
const PB_V = 3.7, PB_K = 0.7;
/** EPA: самостійно прибирають пліснявину приблизно до 10 кв. футів (≈0,93 м²). */
export const MOLD_DIY_M2 = 0.93;

/* ───────────── Рецепти ───────────── */

/**
 * @typedef {{k?:string, any?:string[], q?:number|null, opt?:boolean, par?:string[], why?:string}} Need
 * @typedef {{t:string, uses?:string[], all?:string[], now?:boolean}} Step
 * @typedef {{label:string, needs:Need[]}} Alt
 * @typedef {Record<string, number|string|null>} P
 * @typedef {{
 *   id:string, prob:string, title:string, effect:number, result:string,
 *   min:(p:P) => number,
 *   when?:(p:P) => boolean,
 *   req?:{k:string, why:string}[],
 *   alts:(p:P, st:(k:string) => HaveItem) => Alt[],
 *   bad?:(p:P, st:(k:string) => HaveItem) => string|null,
 *   ask?:(p:P, st:(k:string) => HaveItem) => {p:string, text:string}[],
 *   steps:(p:P, st:(k:string) => HaveItem) => Step[],
 *   safe:string, limits:string[], src:string[], solId?:string
 * }} Recipe
 */

const n0 = (/** @type {unknown} */ v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Українська множина: 1 — one, 2–4 — few, інше — many; дробові — few. @param {number} n @param {string} one @param {string} few @param {string} many */
export function pl(n, one, few, many) {
  if (!Number.isInteger(n)) return few;
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** Одиниця після числа: «1 вікно», «2 вікна», «5 вікон»; решта одиниць — як є. @param {number} q @param {string} u */
export function unitFor(q, u) {
  return u === 'вікон' ? pl(q, 'вікно', 'вікна', 'вікон') : u;
}
const round1 = (/** @type {number} */ x) => Math.ceil(x * 10 - 1e-9) / 10;

/** @type {Recipe[]} */
export const RECIPES = [
  /* — Утеплення — */
  {
    id: 'towel-gap', prob: 'insulate', title: 'Валик під двері', effect: 3,
    result: 'Менше протягу по підлозі — у кімнаті тепліше за кілька хвилин.',
    min: () => 3,
    alts: (p) => [{ label: '', needs: [{ any: ['towels', 'blankets'], q: Math.max(1, n0(p.doors, 1)) }] }],
    steps: (p) => [
      { t: `Згорніть рушник чи плед у щільний валик (${Math.max(1, n0(p.doors, 1))} шт — по одному на двері) і покладіть під двері з боку теплої кімнати.`, uses: ['towels'], now: true },
      { t: 'Зачиніть двері в кімнати, які не обігріваєте.', now: true },
      { t: 'Вентиляційні решітки й витяжки не закривайте.' },
    ],
    safe: 'Без вогню, електрики й інструментів. Вентиляцію не перекриває — повітря в кімнаті оновлюється.',
    limits: ['Щілина під дверима — лише частина втрат; вікна вночі теж закрийте.'],
    src: ['readyWinter', 'cdcStorm'], solId: 'heat-drafts',
  },
  {
    id: 'night-cover', prob: 'insulate', title: 'Вікна вночі під шторами чи ковдрами', effect: 3,
    result: 'Від вікна менше тягне холодом; вдень сонце знову гріє кімнату.',
    min: (p) => 5 + 3 * Math.max(1, n0(p.windows, 1)),
    alts: (p) => {
      const w = Math.max(1, n0(p.windows, 1));
      return [
        { label: 'Щільні штори', needs: [{ k: 'curtains', q: w }] },
        { label: 'Ковдри на прищіпках чи шнурі', needs: [{ k: 'blankets', q: w }, { k: 'clips' }] },
      ];
    },
    steps: (p) => [
      { t: `Увечері закрийте ${Math.max(1, n0(p.windows, 1)) > 1 ? 'всі вікна кімнати' : 'вікно'} щільною шторою чи ковдрою — щоб закривала раму повністю.`, uses: ['curtains', 'blankets', 'clips'], now: true },
      { t: 'Вдень відкривайте вікна, куди світить сонце, а на ніч знову закривайте (DOE).', now: true },
      { t: 'Не притискайте тканину до батареї чи обігрівача.' },
    ],
    safe: 'Без вогню й електрики; нічого не кріпиться назавжди.',
    limits: ['Тканина не повинна торкатися нагрівальних приладів і свічок.'],
    src: ['cdcStorm', 'doeTips', 'doeWindows'], solId: 'heat-windows',
  },
  {
    id: 'film-frame', prob: 'insulate', title: 'Прозора плівка на раму зсередини', effect: 4,
    result: 'Між плівкою і склом — шар нерухомого повітря: від вікна менше холоду й протягів, світло проходить.',
    min: (p) => 30 * Math.max(1, n0(p.windows, 1)),
    req: [{ k: 'winW', why: 'ширину вікна' }, { k: 'winH', why: 'висоту вікна' }],
    alts: (p) => {
      const n = Math.max(1, n0(p.windows, 1));
      const ok = typeof p.winW === 'number' && typeof p.winH === 'number';
      const area = ok ? round1(n * (n0(p.winW) + 2 * FILM_MARGIN) * (n0(p.winH) + 2 * FILM_MARGIN)) : null;
      const per = ok ? round1(n * 2 * (n0(p.winW) + n0(p.winH))) : null;
      return [
        { label: 'На двосторонній скотч', needs: [{ k: 'film', q: area }, { k: 'tape2', q: per }, { k: 'scissors' }] },
        { label: 'На малярний скотч', needs: [{ k: 'film', q: area }, { k: 'paintTape', q: per }, { k: 'scissors' }] },
      ];
    },
    steps: (p) => {
      const n = Math.max(1, n0(p.windows, 1));
      const ok = typeof p.winW === 'number' && typeof p.winH === 'number';
      const w = n0(p.winW), h = n0(p.winH);
      return [
        { t: 'Протріть раму насухо: на вологу й брудну поверхню скотч не тримається.', now: true },
        { t: ok ? `Відріжте ${n} ${pl(n, 'шматок', 'шматки', 'шматків')} плівки ${fmt(w + 2 * FILM_MARGIN)} × ${fmt(h + 2 * FILM_MARGIN)} м — із запасом 5 см на кожен бік.` : 'Відріжте плівку на розмір рами із запасом 5 см на кожен бік.', uses: ['film', 'scissors'] },
        { t: ok ? `Наклейте скотч по периметру рами — ${fmt(2 * (w + h))} м на кожне вікно.` : 'Наклейте скотч по периметру рами.', uses: ['tape2', 'paintTape'] },
        { t: 'Притисніть плівку до скотчу зверху вниз, натягуючи без складок, щоб вона щільно прилягала (DOE).', uses: ['film'] },
        { t: 'Батареї під вікном не закривайте: тепле повітря має підніматися вздовж плівки.' },
      ];
    },
    safe: 'Без вогню й інструментів, окрім ножиць; вентиляції кімнати не перекриває. Якщо житло найняте — під двосторонній скотч наклейте малярний, щоб не зняти фарбу.',
    limits: ['Відчиняти таке вікно для провітрювання незручно — провітрюйте через інше вікно чи двері.', 'Плівка тонка: від осколків чи вибухової хвилі не захищає.'],
    src: ['doeTips'],
  },
  {
    id: 'strip-door', prob: 'insulate', title: 'Самоклейний ущільнювач на двері', effect: 4,
    result: 'Двері прилягають щільно — протяг по периметру зникає.',
    min: (p) => 20 * Math.max(1, n0(p.doors, 1)),
    req: [{ k: 'doorP', why: 'периметр дверей' }],
    alts: (p) => {
      const d = Math.max(1, n0(p.doors, 1));
      const len = typeof p.doorP === 'number' ? round1(d * n0(p.doorP)) : null;
      return [{ label: '', needs: [{ k: 'foamStrip', q: len }, { k: 'scissors' }] }];
    },
    steps: (p) => [
      { t: 'Знайдіть, де дме: підносьте до щілини смужку тонкого паперу — вона затріпоче.', now: true },
      { t: 'Вимийте й висушіть місце наклеювання: ущільнювач клеять лише на чисту суху поверхню (DOE).', now: true },
      { t: typeof p.doorP === 'number' ? `Відміряйте ${fmt(n0(p.doorP))} м ущільнювача на кожні двері: двічі поміряйте, один раз відріжте.` : 'Поміряйте периметр дверей і відріжте ущільнювач.', uses: ['foamStrip', 'scissors'] },
      { t: 'Клейте на дверну коробку так, щоб зачинені двері злегка стискали ущільнювач (DOE).', uses: ['foamStrip'] },
    ],
    safe: 'Без вогню й електрики. Решітки вентиляції, двері до кімнати з газовою колонкою чи котлом не ущільнюйте наглухо — приладам потрібне повітря.',
    limits: ['На морозі клей тримає гірше — краще клеїти в теплому приміщенні.', 'Пінний ущільнювач із часом зношується — перевірте його навесні.'],
    src: ['doeWeather', 'cdcCO'],
  },

  /* — Тепло людям — */
  {
    id: 'one-room', prob: 'keepwarm', title: 'Одна тепла кімната для всіх', effect: 5,
    result: 'Тепло людей і приладів не розходиться по всьому житлу.',
    min: () => 5,
    alts: () => [{ label: '', needs: [{ any: ['towels', 'blankets'], q: 1, opt: true }] }],
    steps: (p) => [
      { t: `Оберіть найменшу кімнату з найменшою кількістю вікон і зберіть там усіх${n0(p.people) > 1 ? ` (${n0(p.people)} ${pl(n0(p.people), 'особа', 'особи', 'осіб')})` : ''}.`, now: true },
      { t: 'Зачиніть двері в інші кімнати; під двері покладіть згорнутий рушник (Ready.gov).', uses: ['towels'], now: true },
      { t: 'На ніч закрийте вікна шторами чи ковдрами (CDC).' },
      { t: 'Коротко провітрюйте кілька разів на день; вентиляцію не закривайте.' },
    ],
    safe: 'Нічого не горить і не нагрівається — лише утримуємо тепло, яке вже є.',
    limits: ['Якщо в кімнаті +12 °C і нижче, а людям холодно попри одяг, плануйте перехід у тепле місце (PHE).'],
    src: ['cdcStorm', 'readyWinter', 'phe'], solId: 'heat-room',
  },
  {
    id: 'layers', prob: 'keepwarm', title: 'Одяг шарами й шапка', effect: 4,
    result: 'Кілька тонких шарів тримають тепло краще за одну товсту річ.',
    min: () => 5,
    alts: () => [{ label: '', needs: [{ k: 'warmClothes' }] }],
    steps: () => [
      { t: 'Вдягніть кілька вільних шарів, шапку, теплі шкарпетки й рукавиці (CDC).', uses: ['warmClothes'], now: true },
      { t: 'Вологий одяг одразу замініть сухим.', now: true },
      { t: 'Їжте регулярно й пийте теплі напої; алкоголь не зігріває (CDC).' },
    ],
    safe: 'Найбезпечніший спосіб: без вогню, електрики й витрат.',
    limits: ['Діти й літні люди мерзнуть швидше — перевіряйте, чи їм тепло.'],
    src: ['cdcStorm', 'cdcWinter'], solId: 'heat-layers',
  },
  {
    id: 'bed-canopy', prob: 'keepwarm', title: 'Тепле ліжко під навісом', effect: 4,
    result: 'Під навісом повітря прогрівається диханням і тілом — спати тепліше.',
    min: () => 15,
    alts: () => [
      { label: 'Намет на ліжку', needs: [{ k: 'tent' }, { any: ['mat', 'blankets'], q: 1 }] },
      { label: 'Ковдри над ліжком', needs: [{ k: 'blankets', q: 2 }, { k: 'clips' }] },
    ],
    steps: (p) => [
      { t: 'Поставте намет на ліжко або натягніть ковдри над ліжком між меблями, на шнурі чи прищіпках.', uses: ['tent', 'blankets', 'clips'] },
      { t: 'Знизу обов’язково утеплення: каремат, матрац чи складена ковдра.', uses: ['mat'] },
      { t: 'Залиште щілину для повітря: простір не повинен бути герметичним.', now: true },
      ...(p.infant === 'y' ? [{ t: 'Немовляті — окреме спальне місце без подушок, ковдр і навісів, у теплому комбінезоні (CDC).', now: true }] : []),
    ],
    safe: 'Жодного вогню й обігрівачів під навісом. Щілина для повітря обов’язкова.',
    limits: ['Свічки, пальники й обігрівачі під навісом чи в наметі — ризик пожежі й отруєння чадним газом (CDC).', 'Дітям до 1 року не можна спати під ковдрами чи в закритих конструкціях (CDC).'],
    src: ['cdcStorm', 'cdcCO', 'cdcWinter'], solId: 'heat-canopy',
  },
  {
    id: 'hot-bottle', prob: 'keepwarm', title: 'Грілка в ліжко', effect: 3,
    result: 'Ліжко прогріте до того, як ви ляжете.',
    min: () => 10,
    alts: () => [{ label: '', needs: [{ k: 'hotBottle' }, { any: ['towels', 'blankets'], q: 1 }] }],
    bad: (p) => (p.hotWater === 'n' ? 'Немає чим нагріти воду — грілка не допоможе.' : null),
    ask: (p) => (p.hotWater === 'u' ? [{ p: 'hotWater', text: 'Чи є чим нагріти воду: не позначено' }] : []),
    steps: () => [
      { t: 'Огляньте грілку: тріщини, липкість, потоншення — викиньте її (ACCC).', uses: ['hotBottle'], now: true },
      { t: 'Налийте гарячу, але не окріп, воду приблизно на дві третини, випустіть повітря, щільно закрийте (ACCC).', uses: ['hotBottle'] },
      { t: 'Загорніть у рушник і покладіть у ліжко за 10–15 хвилин до сну; не лягайте на неї.', uses: ['towels', 'blankets'] },
    ],
    safe: 'Без вогню в ліжку; температура води нижча за окріп, а чохол захищає шкіру.',
    limits: ['Опіки можливі навіть від «просто гарячої» грілки при тривалому контакті — обережно з дітьми й літніми людьми (ACCC).'],
    src: ['hotBottle'], solId: 'heat-bottle',
  },
  {
    id: 'sleep-bag', prob: 'keepwarm', title: 'Спальник на кожного', effect: 4,
    result: 'Кожен спить у власному теплому «коконі», не залежно від температури кімнати.',
    min: () => 5,
    alts: (p) => [{ label: '', needs: [{ k: 'sleepingBag', q: Math.max(1, n0(p.people, 1)) }, { any: ['mat', 'blankets'], q: Math.max(1, n0(p.people, 1)) }] }],
    steps: (p) => [
      { t: `Розкладіть спальники (потрібно ${Math.max(1, n0(p.people, 1))}) на каремат чи матрац — знизу холод іде найсильніше.`, uses: ['sleepingBag', 'mat'], now: true },
      { t: 'Лягайте в сухому одязі й шапці; мокре — сушіть окремо.', now: true },
      ...(p.infant === 'y' ? [{ t: 'Немовляті — не дорослий спальник, а окреме безпечне місце й спальний мішечок за віком (CDC).', now: true }] : []),
    ],
    safe: 'Не потребує тепла чи енергії.',
    limits: ['Дорослий спальник не підходить немовлятам.'],
    src: ['cdcStorm', 'cdcWinter'],
  },

  /* — Світло — */
  {
    id: 'lamp-led', prob: 'light', title: 'Акумуляторна LED-лампа', effect: 5,
    result: 'Рівне світло на кімнату без вогню; LED витрачає щонайменше на 75 % менше енергії, ніж лампа розжарювання (DOE).',
    min: () => 2,
    req: [{ k: 'hours', why: 'скільки годин світла потрібно' }],
    alts: () => [{ label: '', needs: [{ k: 'lamp', q: 1, par: ['h'] }] }],
    steps: (p, st) => {
      const h = num(st('lamp').p?.h ?? '');
      const need = typeof p.hours === 'number' ? p.hours : null;
      /** @type {Step[]} */ const out = [{ t: 'Поставте лампу вище й спрямуйте на білу стелю чи стіну — світло розійдеться рівніше.', uses: ['lamp'], now: true }];
      if (h > 0 && need) {
        const days = h / need;
        out.push({ t: days >= 1 ? `Одного заряду вистачить приблизно на ${daysText(days, true)} по ${fmt(need)} год (${fmt(h)} год ÷ ${fmt(need)} год).` : `Одного заряду вистачить на ${fmt(h)} год — менше, ніж потрібно на добу (${fmt(need)} год). Потрібна підзарядка чи друга лампа.` });
      }
      if (h > 0 && need && typeof p.days === 'number') {
        const c = Math.ceil((need * p.days) / h - 1e-9);
        out.push({ t: `На ${daysText(p.days, true)} потрібно ${fmt(need * p.days)} год світла — це ${c} ${pl(c, 'повний заряд', 'повні заряди', 'повних зарядів')} лампи.` });
      }
      out.push({ t: 'Заряджайте лампу, щойно з’являється світло.' });
      return out;
    },
    safe: 'Без вогню й продуктів горіння; лампа не нагрівається до небезпечної температури.',
    limits: ['Час роботи з інструкції — для нової лампи й повного заряду; на холоді він коротший.'],
    src: ['doeLed', 'cdcOutage'], solId: 'energy-light',
  },
  {
    id: 'headlamp', prob: 'light', title: 'Налобний ліхтар для справ', effect: 4,
    result: 'Світло туди, куди дивитеся, а руки вільні.',
    min: () => 1,
    alts: () => [{ label: '', needs: [{ k: 'headlamp', q: 1, par: ['h'] }, { k: 'spareBatt', opt: true }] }],
    steps: (p, st) => {
      const h = num(st('headlamp').p?.h ?? '');
      /** @type {Step[]} */ const out = [{ t: 'Тримайте ліхтар біля ліжка: він знадобиться першим, коли згасне світло.', uses: ['headlamp'], now: true }];
      if (h > 0 && typeof p.hours === 'number') out.push({ t: `Якщо світити лише ним, одного заряду чи комплекту батарейок вистачить на ≈${daysText(h / p.hours, true)} по ${fmt(p.hours)} год.` });
      out.push({ t: 'Для кімнати краще лампа: налобний ліхтар — для справ і переходів.' });
      return out;
    },
    safe: 'Без вогню. Батарейки тримайте окремо від металевих предметів.',
    limits: ['Яскраве світло в очі іншим людям засліплює — опускайте промінь.'],
    src: ['cdcOutage'],
  },
  {
    id: 'usb-lamp', prob: 'light', title: 'USB-лампа від павербанка', effect: 4,
    result: 'Павербанк стає джерелом світла на кілька вечорів.',
    min: () => 2,
    alts: () => [{ label: '', needs: [{ k: 'usbLamp', q: 1, par: ['w'] }, { k: 'powerbank', q: 1, par: ['mah', 'pct'] }] }],
    steps: (p, st) => {
      const w = num(st('usbLamp').p?.w ?? ''), mah = num(st('powerbank').p?.mah ?? ''), pct = num(st('powerbank').p?.pct ?? '');
      /** @type {Step[]} */ const out = [{ t: 'Під’єднайте лампу коротким кабелем і спрямуйте на світлу стелю.', uses: ['usbLamp', 'powerbank'], now: true }];
      if (w > 0 && mah > 0 && pct >= 0) {
        const wh = (mah * PB_V) / 1000;
        const use = wh * (pct / 100) * PB_K;
        const hrs = use / w;
        out.push({ t: `Запас павербанка: ${fmt(mah)} мА·год × ${fmt(PB_V)} В ÷ 1000 = ${fmt(wh)} Вт·год; із зарядом ${fmt(pct)} % і втратами перетворення (×${fmt(PB_K)}) — ≈${fmt(use)} Вт·год.` });
        out.push({ t: `Лампа ${fmt(w)} Вт світитиме ≈${fmt(hrs, 1)} год (${fmt(use)} Вт·год ÷ ${fmt(w)} Вт)${typeof p.hours === 'number' ? ` — це ≈${daysText(hrs / p.hours, true)} по ${fmt(p.hours)} год` : ''}.` });
      }
      out.push({ t: 'Залиште частину заряду на телефон: зв’язок важливіший за світло.' });
      return out;
    },
    safe: 'Низька напруга 5 В і без вогню. Кабель і павербанк не накривайте — вони мають остигати.',
    limits: ['Ємність на корпусі павербанка вказують за напругою елементів (≈3,7 В), а не 5 В — тому реальний запас менший, ніж здається.'],
    src: ['doeLed'],
  },
  {
    id: 'daylight', prob: 'light', title: 'Денне світло на максимум', effect: 3,
    result: 'Удень справи без витрат заряду.',
    min: () => 5,
    alts: () => [{ label: '', needs: [] }],
    steps: () => [
      { t: 'Перенесіть справи, що потребують світла, на день і ближче до вікна: денне світло корисне приблизно на глибину 1,5–2 висоти вікна (NREL).', now: true },
      { t: 'Звільніть підвіконня, відсуньте штори й тюль на день (LRC).', now: true },
      { t: 'Світлі стіни, скатертина чи простирадло відбивають світло вглиб кімнати (LRC).' },
    ],
    safe: 'Нічого не горить і не витрачає заряд.',
    limits: ['Працює лише вдень; на вечір підготуйте лампу заздалегідь.', 'Під час тривоги тримайтеся подалі від вікон.'],
    src: ['nrelDaylight', 'lrcDaylight'], solId: 'energy-daylight',
  },

  /* — Вода — */
  {
    id: 'store-drink', prob: 'water', title: 'Запас питної води на потрібні доби', effect: 5,
    result: 'Ви точно знаєте, скільки води треба, скільки вже є і що набрати.',
    min: () => 15,
    alts: (p, st) => {
      const need = n0(p.people, 1) * DRINK_PER_DAY * n0(p.days, 3);
      const have = st('drinkWater').s === 'y' ? num(st('drinkWater').q ?? '') : 0;
      const gap = Math.max(0, need - (have >= 0 ? have : 0));
      return [
        { label: 'Уже є в запасі', needs: [{ k: 'drinkWater', q: need }] },
        { label: 'Набрати в ємності', needs: [{ k: 'canister', q: round1(gap) }, { k: 'marker', opt: true }] },
      ];
    },
    ask: (p, st) => {
      const need = n0(p.people, 1) * DRINK_PER_DAY * n0(p.days, 3);
      const have = st('drinkWater').s === 'y' ? num(st('drinkWater').q ?? '') : 0;
      return p.tap === 'u' && !(have >= need) ? [{ p: 'tap', text: 'Чи є вода з крана, щоб набрати: не позначено' }] : [];
    },
    bad: (p, st) => {
      const need = n0(p.people, 1) * DRINK_PER_DAY * n0(p.days, 3);
      const have = st('drinkWater').s === 'y' ? num(st('drinkWater').q ?? '') : 0;
      if (p.tap === 'n' && !(have >= need)) return 'Води з крана немає, а запасу не вистачає — набрати нема звідки. Шукайте бутильовану воду чи пункт видачі, коли вихід безпечний.';
      return null;
    },
    steps: (p, st) => {
      const people = n0(p.people, 1), days = n0(p.days, 3);
      const need = people * DRINK_PER_DAY * days;
      const haveRaw = st('drinkWater').s === 'y' ? num(st('drinkWater').q ?? '') : NaN;
      const have = haveRaw >= 0 ? haveRaw : 0;
      const gap = Math.max(0, need - have);
      const cap = st('canister').s === 'y' ? num(st('canister').q ?? '') : NaN;
      /** @type {Step[]} */ const out = [{ t: `Потрібно лише на пиття: ${people} × ${DRINK_PER_DAY} л × ${fmt(days)} = ${fmt(need)} л (Sphere). На гігієну й їжу — окремо.` }];
      if (haveRaw >= 0) out.push({ t: gap > 0 ? `Є ${fmt(have)} л — бракує ${fmt(gap)} л.` : `Є ${fmt(have)} л — на ${daysText(days, true)} пиття вистачає.` });
      if (gap > 0 && cap >= 0) out.push({ t: cap >= gap ? `Ваших ємностей (${fmt(cap)} л) вистачить: наберіть ${fmt(gap)} л.` : `Ваших ємностей (${fmt(cap)} л) замало: потрібно ще ${fmt(gap - cap)} л об’єму.`, uses: ['canister'] });
      if (gap > 0) {
        out.push({ t: 'Ємності, що не нові, вимийте з милом і продезінфікуйте: ≈1 чайна ложка відбілювача без ароматизаторів на 1 л води (Ready.gov).', uses: ['canister'] });
        out.push({ t: 'Наповніть водою з крана, щільно закрийте, підпишіть «ПИТНА» й дату.', uses: ['canister'], now: p.tap === 'y' });
      }
      out.push({ t: 'Тримайте в прохолодному темному місці, подалі від пального й хімії; самостійно набрану воду міняйте кожні 6 місяців (CDC).' });
      return out;
    },
    safe: 'Вода з крана в чистих харчових ємностях — перевірений спосіб запасу (CDC, Ready.gov).',
    limits: ['Тару з-під молока й соку не радять: її важко відмити.', 'У спеку, під час хвороби чи годування груддю пити потрібно більше.'],
    src: ['sphere', 'readyWater', 'cdcWaterSupply'], solId: 'water-store',
  },
  {
    id: 'separate', prob: 'water', title: 'Питна — окремо від технічної', effect: 3,
    result: 'Питна вода не витрачається на миття й змив.',
    min: () => 5,
    alts: () => [{ label: '', needs: [{ k: 'marker' }] }],
    steps: () => [
      { t: 'Підпишіть ємності: «ПИТНА» і «НЕ ПИТИ».', uses: ['marker'], now: true },
      { t: 'Питну тримайте окремо й закритою; технічну — для змиву, прибирання, прання.', now: true },
      { t: 'Воду після миття рук і посуду збирайте для змиву унітаза.' },
    ],
    safe: 'Нічого не змінює у воді — лише прибирає плутанину.',
    limits: ['Технічну воду не пийте й не використовуйте для приготування без знезараження.'],
    src: ['cdcWaterSupply', 'readyWater'], solId: 'water-separate',
  },
  {
    id: 'bleach-treat', prob: 'water', title: 'Знезараження відбілювачем', effect: 4,
    result: 'Прозора вода стає безпечнішою від бактерій і вірусів за 30 хвилин.',
    min: () => 35,
    alts: () => [{ label: '', needs: [{ k: 'bleach', par: ['pct'] }, { k: 'dropper' }] }],
    bad: (_p, st) => {
      const b = st('bleach');
      if (b.s !== 'y') return null;
      const pct = num(b.p?.pct ?? '');
      if (Number.isNaN(pct)) return null;
      if ((pct >= 5 && pct <= 9) || (pct >= 0.9 && pct <= 1.1)) return null;
      return `Концентрація ${fmt(pct)} % — для неї немає перевіреного дозування. Не використовуйте: кип’ятіть або беріть бутильовану воду.`;
    },
    steps: (_p, st) => {
      const pct = num(st('bleach').p?.pct ?? '');
      const one = pct >= 0.9 && pct <= 1.1;
      return [
        { t: 'Перевірте етикетку: гіпохлорит натрію, без ароматизаторів і «кольорозахисних» добавок (CDC).', uses: ['bleach'], now: true },
        { t: one ? 'Відбілювач 1 %: 10 крапель на 1 л води (CDC).' : 'Прозора вода: 2 краплі на 1 л; каламутна чи дуже холодна — 4 краплі на 1 л (CDC). Для 5 л — 10 крапель, для 10 л — 20.', uses: ['bleach', 'dropper'] },
        { t: 'Перемішайте й залиште щонайменше на 30 хвилин (CDC).' },
        { t: 'Вода має ледь пахнути хлором. Немає запаху — повторіть дозу й зачекайте ще 15 хвилин; запаху й тоді немає — не пийте (Ready.gov).' },
      ];
    },
    safe: 'Дозування — за CDC; хлор не змішують з іншими засобами, працюють при відчиненому вікні.',
    limits: ['Хлор слабко діє на деяких паразитів (криптоспоридії) — кип’ятіння надійніше (CDC).', 'Не допомагає від хімії, пального й радіоактивного забруднення.'],
    src: ['cdcWater', 'readyWater'], solId: 'water-chlorine',
  },
  {
    id: 'boil', prob: 'water', title: 'Кип’ятіння', effect: 5,
    result: 'Найнадійніше знищує мікроби у воді.',
    min: () => 15,
    alts: () => [{ label: '', needs: [] }],
    bad: (p) => (p.heat === 'n' ? 'Немає чим кип’ятити воду.' : null),
    ask: (p) => (p.heat === 'u' ? [{ p: 'heat', text: 'Чи є чим кип’ятити воду: не позначено' }] : []),
    steps: () => [
      { t: 'Каламутну воду процідіть крізь чисту тканину чи кавовий фільтр або дайте відстоятися (CDC).', now: true },
      { t: 'Доведіть до інтенсивного кипіння й кип’ятіть 1 хвилину (вище 2000 м — 3 хвилини) (CDC).' },
      { t: 'Остудіть під кришкою й зберігайте в чистій закритій ємності.' },
    ],
    safe: 'Перевірений спосіб CDC. Не гріти воду пальником у приміщенні без провітрювання й детектора CO.',
    limits: ['Кип’ятіння не прибирає хімію, пальне й важкі метали (Ready.gov).'],
    src: ['cdcWater', 'readyWater'], solId: 'water-boil',
  },

  /* — Санітарія — */
  {
    id: 'bag-toilet', prob: 'sanitation', title: 'Туалет у подвійному пакеті', effect: 5,
    result: 'Гігієнічний туалет без води, коли змивати не можна.',
    min: () => 10,
    alts: (p, st) => {
      const bags = bagsNeeded(p, num(st('bags').p?.l ?? ''));
      return [
        { label: 'У чаші унітаза', needs: [{ k: 'toiletBowl' }, { k: 'bags', q: bags, par: ['l'] }, { k: 'filler' }, { k: 'gloves', opt: true }] },
        { label: 'У відрі з кришкою', needs: [{ k: 'bucket', q: 1 }, { k: 'bags', q: bags, par: ['l'] }, { k: 'filler' }, { k: 'gloves', opt: true }] },
      ];
    },
    steps: (p, st) => {
      const l = num(st('bags').p?.l ?? '');
      const total = n0(p.people, 1) * n0(p.days, 3) * WASTE_L_DAY;
      /** @type {Step[]} */ const out = [
        { t: 'Застеліть чашу унітаза чи відро двома міцними пакетами (King County).', uses: ['bags'], now: true },
        { t: 'Після кожного використання присипайте наповнювачем — котячим, тирсою чи подрібненим папером (King County).', uses: ['filler'] },
      ];
      if (l > 0) {
        const b = bagsNeeded(p, l);
        out.push({ t: `Розрахунок: ≈${fmt(total)} л відходів за ${daysText(n0(p.days, 3), true)} (≈19 л на людину на тиждень — Oregon OEM). Пакет ${fmt(l)} л заповнюйте лише наполовину — потрібно ${b} ${pl(Number(b), 'пакет', 'пакети', 'пакетів')} (по два на заміну).` });
      }
      out.push({ t: 'Заповнений наполовину пакет зав’яжіть разом із другим і тримайте в закритій ємності подалі від їжі та води (Multnomah County).' });
      out.push({ t: 'Після кожного використання — мило з водою або антисептик.' });
      return out;
    },
    safe: 'Відходи ізольовані двома шарами пакета й наповнювачем; туалет — подалі від їжі.',
    limits: ['Не виносьте пакети, коли перебування надворі небезпечне.', 'Облаштовуйте туалет подалі від місця приготування їжі (King County).'],
    src: ['toiletKC', 'multcoToilet', 'oemToilet'], solId: 'hyg-toilet',
  },
  {
    id: 'two-bucket', prob: 'sanitation', title: 'Два відра: рідина окремо', effect: 4,
    result: 'Менше об’єму й запаху — пакети міняти рідше.',
    min: () => 15,
    alts: (p, st) => [{ label: '', needs: [{ k: 'bucket', q: 2 }, { k: 'bags', q: bagsNeeded(p, num(st('bags').p?.l ?? '')), par: ['l'] }, { k: 'filler' }] }],
    steps: () => [
      { t: 'Відро для твердих відходів застеліть міцним пакетом; відро для рідини — без пакета (Oregon State University).', uses: ['bucket', 'bags'] },
      { t: 'Тверде після кожного використання присипайте наповнювачем.', uses: ['filler'] },
      { t: 'Рідину виливайте в унітаз чи каналізацію, якщо вона справна; тримайте відро закритим.' },
    ],
    safe: 'Відходи закриті кришками; рідина й тверде не змішуються — менше запаху й бактерій.',
    limits: ['Якщо каналізацію пошкоджено, рідину не виливайте в неї — збирайте в закриті ємності.'],
    src: ['toiletOSU', 'multcoToilet'],
  },
  {
    id: 'hands', prob: 'sanitation', title: 'Миття рук без крана', effect: 4,
    result: 'Чисті руки при мінімумі води.',
    min: () => 3,
    alts: () => [{ label: '', needs: [{ k: 'soap' }, { k: 'bottle', opt: true }] }],
    steps: () => [
      { t: 'Зробіть «краник»: 2–3 дірочки в кришці пляшки з водою.', uses: ['bottle'], now: true },
      { t: 'Намилюйте щонайменше 20 секунд, змивайте тонким струменем над тазиком (CDC).', uses: ['soap'], now: true },
      { t: 'Руки чисті на вигляд — підійде антисептик зі спиртом від 60 % (CDC).' },
    ],
    safe: 'Звичайне мило й антисептик за рекомендаціями CDC.',
    limits: ['На брудних чи жирних руках антисептик діє погано — потрібне мило (CDC).'],
    src: ['cdcHands'], solId: 'hyg-hands',
  },
  {
    id: 'waste', prob: 'sanitation', title: 'Сміття без вивезення', effect: 3,
    result: 'Без запаху й шкідників, поки сміття не можна винести.',
    min: () => 5,
    alts: () => [{ label: '', needs: [{ k: 'bags', q: 2 }, { k: 'bucket', q: 1, opt: true }] }],
    steps: () => [
      { t: 'Харчові відходи — окремо, у щільно зав’язаних пакетах; сухе сміття стисніть.', uses: ['bags'], now: true },
      { t: 'Тримайте пакети в закритій ємності в прохолодному місці, подалі від житлових кімнат.', uses: ['bucket'] },
      { t: 'Не спалюйте сміття; виносьте, коли вихід безпечний (Oregon State University).' },
    ],
    safe: 'Нічого не горить; відходи закриті.',
    limits: ['Влітку харчові рештки виносьте першими.'],
    src: ['toiletOSU'], solId: 'hyg-waste',
  },

  /* — Ремонт — */
  {
    id: 'film-battens', prob: 'repair', title: 'Плівка на рейках у віконному отворі', effect: 4,
    result: 'Отвір закритий від вітру й дощу, а світло проходить.',
    when: (p) => p.what !== 'mold',
    min: () => 60,
    req: [{ k: 'openW', why: 'ширину отвору' }, { k: 'openH', why: 'висоту отвору' }],
    alts: (p) => {
      const ok = typeof p.openW === 'number' && typeof p.openH === 'number';
      const w = n0(p.openW), h = n0(p.openH);
      const film = ok ? round1((w + 0.2) * (h + 0.2)) : null;
      const per = ok ? round1(2 * (w + h)) : null;
      const nails = ok ? Math.ceil((2 * (w + h)) / NAIL_STEP) + 4 : null;
      return [{ label: '', needs: [{ k: 'film', q: film }, { k: 'battens', q: per }, { k: 'nails', q: nails }, { k: 'hammer' }, { k: 'scissors' }, { k: 'gloves' }, { k: 'goggles' }] }];
    },
    steps: (p) => {
      const ok = typeof p.openW === 'number' && typeof p.openH === 'number';
      const w = n0(p.openW), h = n0(p.openH);
      return [
        { t: 'У рукавичках і окулярах приберіть уламки скла, що тримаються слабко; працюйте лише зсередини, не висувайтеся з вікна.', all: ['gloves', 'goggles'], now: true },
        { t: ok ? `Відріжте плівку ${fmt(w + 0.2)} × ${fmt(h + 0.2)} м — із запасом 10 см на кожен бік.` : 'Відріжте плівку на розмір отвору із запасом 10 см на кожен бік.', uses: ['film', 'scissors'] },
        { t: ok ? `Притисніть край плівки рейками до рами по периметру (${fmt(2 * (w + h))} м рейок).` : 'Притисніть край плівки рейками до рами по периметру.', uses: ['battens'] },
        { t: ok ? `Прибийте рейки цвяхами 5 см через кожні 30 см — ≈${Math.ceil((2 * (w + h)) / NAIL_STEP) + 4} цвяхів; плівку натягуйте, але не перегинайте рейки (Shelter Cluster).` : 'Прибийте рейки цвяхами 5 см через кожні 30 см; плівку натягуйте рівно (Shelter Cluster).', uses: ['nails', 'hammer'] },
      ];
    },
    safe: 'Захист рук і очей від скла; робота лише зсередини. Плівка тимчасова — це не утеплення на зиму (Shelter Cluster).',
    limits: ['Пошкоджена рама, тріщини в стіні чи загроза обвалу — не ремонтуйте самі, повідомте ДСНС чи керуючу компанію.', 'Найкраще підходить плівка 0,15 мм зі стабілізацією від ультрафіолету (Shelter Cluster).'],
    src: ['shelterEsk', 'shelterIec'],
  },
  {
    id: 'osb-board', prob: 'repair', title: 'Щит з OSB чи фанери', effect: 4,
    result: 'Міцно закритий отвір — тепліше й тихіше, але без світла.',
    when: (p) => p.what !== 'mold',
    min: () => 90,
    req: [{ k: 'openW', why: 'ширину отвору' }, { k: 'openH', why: 'висоту отвору' }],
    alts: (p) => {
      const ok = typeof p.openW === 'number' && typeof p.openH === 'number';
      const w = n0(p.openW), h = n0(p.openH);
      const area = ok ? round1((w + 0.1) * (h + 0.1)) : null;
      const screws = ok ? Math.ceil((2 * (w + h)) / NAIL_STEP) : null;
      return [{ label: '', needs: [{ k: 'osb', q: area }, { k: 'nails', q: screws }, { k: 'driver' }, { k: 'saw' }, { k: 'gloves' }, { k: 'goggles' }] }];
    },
    steps: (p) => {
      const ok = typeof p.openW === 'number' && typeof p.openH === 'number';
      const w = n0(p.openW), h = n0(p.openH);
      return [
        { t: 'У рукавичках і окулярах приберіть уламки скла з рами; працюйте лише зсередини.', all: ['gloves', 'goggles'], now: true },
        { t: ok ? `Відпиляйте щит ${fmt(w + 0.1)} × ${fmt(h + 0.1)} м — на 5 см більший за отвір з кожного боку.` : 'Відпиляйте щит на 5 см більший за отвір з кожного боку.', uses: ['osb', 'saw'] },
        { t: ok ? `Прикрутіть до рами шурупами через кожні 30 см (≈${Math.ceil((2 * (w + h)) / NAIL_STEP)} шт).` : 'Прикрутіть до рами шурупами через кожні 30 см.', uses: ['nails', 'driver'] },
      ];
    },
    safe: 'Захист рук і очей; кріплення до рами зсередини.',
    limits: ['Щит не пропускає світла — залиште хоча б одне вікно в кімнаті прозорим.', 'Пошкоджені стіни й рами — лише фахівці.'],
    src: ['shelterEsk', 'shelterIec'],
  },
  {
    id: 'mold-clean', prob: 'repair', title: 'Прибрати невелику пліснявину', effect: 4,
    result: 'Пліснява прибрана, а вологе місце висушене — вона не повертається.',
    when: (p) => p.what === 'mold',
    min: () => 60,
    req: [{ k: 'moldM2', why: 'площу плісняви' }],
    alts: () => [{ label: '', needs: [{ k: 'gloves' }, { k: 'mask' }, { k: 'goggles' }, { k: 'detergent' }, { k: 'rags' }] }],
    bad: (p) => (typeof p.moldM2 === 'number' && p.moldM2 > MOLD_DIY_M2 ? `Площа ${fmt(p.moldM2)} м² — більше ніж ≈1 м² (10 кв. футів). EPA радить звернутися до фахівців.` : null),
    steps: () => [
      { t: 'Спершу знайдіть і усуньте джерело вологи: протікання, конденсат (EPA).', now: true },
      { t: 'У рукавичках, респіраторі й окулярах змийте пліснявину водою з мийним засобом (EPA).', all: ['gloves', 'mask', 'goggles', 'detergent', 'rags'] },
      { t: 'Висушіть поверхню повністю; вологі речі — протягом 24–48 годин (EPA).' },
      { t: 'Не змішуйте відбілювач з аміаком чи іншими засобами — утворюються отруйні гази (EPA).' },
    ],
    safe: 'Засоби захисту дихання, очей і рук — за порадами EPA; без сильної хімії.',
    limits: ['Астма, алергія чи ослаблений імунітет — не прибирайте пліснявину самі (EPA).', 'Пористі речі з пліснявою (килим, гіпсокартон) часто доводиться викинути.'],
    src: ['epaMold', 'epaMoldGuide'], solId: 'hyg-damp',
  },
  {
    id: 'mold-dry', prob: 'repair', title: 'Висушити й провітрити', effect: 3,
    result: 'Менше вологи — пліснява не росте.',
    when: (p) => p.what === 'mold',
    min: () => 10,
    alts: () => [{ label: '', needs: [{ k: 'hygrometer', opt: true }, { k: 'rags', opt: true }] }],
    steps: () => [
      { t: 'Провітрюйте коротко й інтенсивно кілька разів на день.', now: true },
      { t: 'Витирайте конденсат з вікон і стін щодня.', uses: ['rags'], now: true },
      { t: 'Тримайте вологість у межах 30–50 %, якщо є гігрометр (EPA).', uses: ['hygrometer'] },
    ],
    safe: 'Лише провітрювання й прибирання вологи.',
    limits: ['Без усунення протікання пліснява повернеться.'],
    src: ['epaMoldGuide'], solId: 'hyg-damp',
  },
];

/**
 * Скільки пакетів потрібно: відходи ≈19 л на людину на тиждень (Oregon OEM),
 * пакет — лише наполовину (Multnomah County), по два пакети на заміну (King County).
 * Без об’єму пакета точну кількість не рахуємо.
 * @param {P} p @param {number} l
 */
export function bagsNeeded(p, l) {
  if (!(l > 0)) return null;
  const total = n0(p.people, 1) * n0(p.days, 3) * WASTE_L_DAY;
  return 2 * Math.max(1, Math.ceil(total / (l * BAG_FILL)));
}

/* ───────────── Перевірка ───────────── */

/** Порядок станів: що краще. */
const RANK = { ok: 0, unknown: 1, short: 2, missing: 3 };

/**
 * Стан однієї потреби; для «або» — найкращий з варіантів.
 * @param {Need} need
 * @param {(k:string) => HaveItem} st
 * @returns {{st:'ok'|'unknown'|'short'|'missing', k:string, text:string, opt:boolean, lackQ:number|null, ask?:string, mark?:boolean}}
 */
function needState(need, st) {
  const keys = need.any || [need.k || ''];
  /** @type {any} */ let best = null;
  for (const k of keys) {
    const r = oneState(k, need, st(k));
    if (!best || RANK[r.st] < RANK[best.st]) best = r;
  }
  return best;
}

/**
 * @param {string} k @param {Need} need @param {HaveItem} it
 * @returns {{st:'ok'|'unknown'|'short'|'missing', k:string, text:string, opt:boolean, lackQ:number|null, ask?:string, mark?:boolean}}
 */
function oneState(k, need, it) {
  const item = ITEMS[k];
  const u = item ? item.unit : '';
  const label = item ? item.label : k;
  const opt = need.opt === true;
  const qtxt = need.q != null && need.q > 0 ? ` — потрібно ${fmt(need.q)} ${unitFor(need.q, u)}`.trimEnd() : '';
  if (it.s === 'n') return { st: 'missing', k, text: `${label}${qtxt}`, opt, lackQ: need.q ?? null };
  if (it.s !== 'y') return { st: 'unknown', k, text: `${label}: не позначено${qtxt}`, opt, lackQ: null, ask: `${label}${qtxt}`, mark: true };
  // Є: спершу характеристики (усі, яких бракує, — одразу), потім кількість
  const noPar = (need.par || []).filter((pk) => {
    const def = item?.params?.[pk];
    const v = num(it.p?.[pk] ?? '');
    return Number.isNaN(v) || (def && (v < def.min || v > def.max));
  }).map((pk) => `«${item?.params?.[pk] ? item.params[pk].label.toLowerCase() : pk}»`);
  if (noPar.length) return { st: 'unknown', k, text: `${label}: вкажіть ${noPar.join(' і ')}`, opt, lackQ: null };
  if (need.q != null && need.q > 0 && u) {
    const have = num(it.q ?? '');
    if (Number.isNaN(have)) return { st: 'unknown', k, text: `${label}: скільки є?${qtxt}`, opt, lackQ: null };
    if (have < need.q) return { st: 'short', k, text: `${label}: є ${fmt(have)} ${unitFor(have, u)}, бракує ${fmt(need.q - have)} ${unitFor(need.q - have, u)}`, opt, lackQ: (need.q - have) / need.q };
  } else if (need.q === null && u) {
    // Кількість залежить від розмірів, яких ще немає
    return { st: 'unknown', k, text: `${label}: є, а скільки потрібно — порахую після розмірів`, opt, lackQ: null };
  }
  return { st: 'ok', k, text: label, opt, lackQ: null };
}

/**
 * Розбирає параметри проблеми: числа — з перевіркою меж, решта — як є.
 * @param {string} prob @param {Record<string, string>} raw
 * @returns {{p: P, errors: {k:string, text:string}[]}}
 */
export function parseParams(prob, raw) {
  /** @type {P} */ const p = {};
  /** @type {{k:string, text:string}[]} */ const errors = [];
  for (const d of PROBLEMS[prob]?.params || []) {
    const v = raw?.[d.k];
    if (d.kind === 'tri') { p[d.k] = v === 'y' || v === 'n' ? v : 'u'; continue; }
    if (d.kind === 'bool') { p[d.k] = v === 'y' ? 'y' : 'n'; continue; }
    if (d.kind === 'sel') { p[d.k] = d.opts?.some((o) => o.v === v) ? v : d.opts?.[0].v ?? null; continue; }
    if (v == null || String(v).trim() === '') { p[d.k] = null; continue; }
    const n = num(v);
    if (Number.isNaN(n) || (d.int && !Number.isInteger(n)) || (d.min != null && n < d.min) || (d.max != null && n > d.max)) {
      errors.push({ k: d.k, text: `${d.label}: ${d.int ? 'ціле число' : 'число'}${d.min != null ? ` від ${fmt(d.min)}` : ''}${d.max != null ? ` до ${fmt(d.max)}` : ''}${d.unit ? ` ${d.unit}` : ''}` });
      p[d.k] = null;
      continue;
    }
    p[d.k] = n;
  }
  return { p, errors };
}

/**
 * Типові параметри: кількість людей — зі «Стану сьогодні», доби — 3 (мінімальний запас за Ready.gov).
 * Розміри не підставляємо: їх треба поміряти.
 * @param {string} prob @param {{adults?:number, kids?:number, elderly?:number}} [state]
 * @returns {Record<string, string>}
 */
export function paramDefaults(prob, state) {
  const people = Math.max(1, (state?.adults || 0) + (state?.kids || 0) + (state?.elderly || 0));
  /** @type {Record<string, string>} */ const out = {};
  for (const d of PROBLEMS[prob]?.params || []) {
    if (d.k === 'people') out.people = String(people);
    else if (d.k === 'days') out.days = '3';
    else if (d.k === 'windows' || d.k === 'doors') out[d.k] = '1';
    else if (d.kind === 'tri') out[d.k] = 'u';
    else if (d.kind === 'bool') out[d.k] = 'n';
    else if (d.kind === 'sel') out[d.k] = d.opts?.[0].v || '';
    else out[d.k] = '';
  }
  return out;
}

/** Речі, які стосуються проблеми (для форми). @param {string} prob */
export function itemsFor(prob) {
  /** @type {Set<string>} */ const keys = new Set();
  const p = parseParams(prob, paramDefaults(prob)).p;
  const none = () => /** @type {HaveItem} */ ({ s: 'u' });
  for (const r of RECIPES.filter((x) => x.prob === prob)) {
    for (const a of r.alts(p, none)) for (const n of a.needs) for (const k of n.any || [n.k || '']) if (k) keys.add(k);
  }
  return [...keys];
}

/** Повна ціна речей, яких бракує (верхня межа категорій). @param {string[]} keys */
function costOf(keys) {
  return [...new Set(keys)].reduce((s, k) => s + BAND_MAX[ITEMS[k]?.band ?? 1], 0);
}

/**
 * Головна функція: до трьох варіантів, решта, непридатне й небезпечне.
 * @param {string} prob
 * @param {HaveInput} inp
 */
export function evaluate(prob, inp) {
  const P = PROBLEMS[prob];
  if (!P) return null;
  const { p, errors } = parseParams(prob, inp.params || {});
  const st = (/** @type {string} */ k) => /** @type {HaveItem} */ (inp.items?.[k] || { s: 'u' });
  const tmax = (HAVE_TIMES.find((t) => t.v === inp.time) || HAVE_TIMES[1]).max;
  const budget = Number.isFinite(inp.budget) ? inp.budget : 0;
  const limits = new Set(inp.limits || []);
  /** @type {any[]} */ const ok = [];
  /** @type {{id:string, title:string, why:string, src:string[], solId?:string}[]} */ const unsuitable = [];

  for (const r of RECIPES.filter((x) => x.prob === prob && (!x.when || x.when(p)))) {
    const why = r.bad ? r.bad(p, st) : null;
    if (why) { unsuitable.push({ id: r.id, title: r.title, why, src: r.src, solId: r.solId }); continue; }
    // Найкращий з альтернативних наборів
    /** @type {any} */ let best = null;
    for (const a of r.alts(p, st)) {
      const states = a.needs.map((nd) => needState(nd, st));
      const req = states.filter((s) => !s.opt);
      const miss = req.filter((s) => s.st === 'missing' || s.st === 'short');
      const unk = req.filter((s) => s.st === 'unknown');
      const sc = miss.length * 10 + unk.length + miss.reduce((/** @type {number} */ t, /** @type {any} */ s) => t + (s.lackQ != null && s.st === 'short' ? s.lackQ : 1), 0) / 10;
      if (!best || sc < best.sc) best = { a, states, miss, unk, sc };
    }
    const reqMissing = (r.req || []).filter((q) => p[q.k] == null);
    const asks = r.ask ? r.ask(p, st) : [];
    const status = best.miss.length ? 'partial' : best.unk.length || reqMissing.length || asks.length ? 'check' : 'ready';
    const min = r.min(p);
    const slow = min > tmax;
    const buyKeys = best.states.filter((/** @type {any} */ s) => !s.opt && (s.st === 'missing' || s.st === 'short')).map((/** @type {any} */ s) => s.k);
    const costMax = costOf(buyKeys);
    const overBudget = costMax > budget;
    const steps = r.steps(p, st);
    const okKeys = new Set(best.states.filter((/** @type {any} */ s) => s.st === 'ok').map((/** @type {any} */ s) => s.k));
    // «Просто зараз»: короткі кроки, для яких усе потрібне вже підтверджено
    const now = steps.filter((s) => s.now && (!s.uses || s.uses.some((k) => okKeys.has(k))) && (!s.all || s.all.every((k) => okKeys.has(k)))).map((s) => s.t).slice(0, 3);
    /** @type {string[]} */ const notes = [];
    if (reqMissing.length) notes.push(`Вкажіть ${reqMissing.map((q) => q.why).join(' і ')} — тоді порахую кількість точно.`);
    if (slow) notes.push(`Потрібно ≈${min < 60 ? `${min} хв` : `${fmt(min / 60, 1)} год`} — більше, ніж у вас є зараз. Почніть із кроків «просто зараз».`);
    if (buyKeys.length) notes.push(limits.has('noOutside') ? 'Купити бракуюче можна буде, коли вихід стане безпечним.' : `Бракуюче — орієнтовно до ${fmt(costMax)} грн${overBudget ? ' (понад ваш бюджет)' : ''}.`);
    if (limits.has('noDamage') && (r.id === 'film-frame' || r.id === 'strip-door' || r.id === 'film-battens' || r.id === 'osb-board')) notes.push('Житло найняте: клейте на малярний скотч, а кріплення до рами погодьте з власником.');
    // Не позначена річ важить більше, ніж невідома характеристика речі, яка точно є;
    // варіанти з підтвердженими речами — вище за ті, що лише «можуть» підійти
    const unkCost = best.unk.reduce((/** @type {number} */ t, /** @type {any} */ s) => t + (s.mark ? 4 + 3 * (ITEMS[s.k]?.band ?? 1) : 2), 0);
    const confirmed = best.states.filter((/** @type {any} */ s) => !s.opt && (s.st === 'ok' || (s.st === 'unknown' && !s.mark) || s.st === 'short')).length;
    let score = { ready: 300, check: 200, partial: 100 }[status] + r.effect * 10 - best.miss.length * 8 - unkCost + confirmed * 3 - reqMissing.length * 4 - asks.length * 4;
    if (slow) score -= 60;
    if (overBudget) score -= 40;
    if (limits.has('noOutside') && buyKeys.length) score -= 20;
    score -= min / 20;
    ok.push({
      id: r.id, title: r.title, result: r.result, alt: best.a.label, status, score, min, slow, costMax, overBudget,
      have: best.states.filter((/** @type {any} */ s) => s.st === 'ok').map((/** @type {any} */ s) => s.text),
      lack: best.states.filter((/** @type {any} */ s) => !s.opt && (s.st === 'missing' || s.st === 'short')).map((/** @type {any} */ s) => s.text),
      check: [...best.states.filter((/** @type {any} */ s) => !s.opt && s.st === 'unknown').map((/** @type {any} */ s) => s.text), ...asks.map((a) => a.text), ...reqMissing.map((q) => `Дані: ${q.why}`)],
      // Питання про умови (вода з крана, чим гріти), на які можна відповісти «Так / Ні» просто в картці
      askP: asks,
      // Що можна позначити одним дотиком просто в картці: «Є» чи «Немає»
      ask: best.states.filter((/** @type {any} */ s) => !s.opt && s.st === 'unknown' && s.ask).map((/** @type {any} */ s) => ({ k: s.k, text: s.ask, full: s.text })),
      optional: best.states.filter((/** @type {any} */ s) => s.opt && s.st !== 'ok').map((/** @type {any} */ s) => ITEMS[s.k]?.label || s.k),
      now, steps: steps.map((s) => s.t), notes, safe: r.safe, limits: r.limits, src: r.src, solId: r.solId,
    });
  }
  ok.sort((a, b) => b.score - a.score || a.min - b.min || a.id.localeCompare(b.id));
  const banned = P.banned.map((b) => {
    if ('myth' in b) {
      const m = MYTHS.find((x) => x.id === b.myth);
      return m ? { title: m.title, why: m.why, src: m.sources, solId: m.id } : null;
    }
    return { title: b.title, why: b.why, src: b.src };
  }).filter(Boolean);
  return { prob, variants: ok.slice(0, 3), rest: ok.slice(3), unsuitable, banned, errors, params: p };
}

/** Текст стану варіанта. @param {'ready'|'check'|'partial'} s */
export function statusText(s) {
  return s === 'ready' ? 'Усе є — можна робити' : s === 'check' ? 'Перевірте, чи є потрібне' : 'Чогось бракує';
}

/* ───────────── Стан модуля: перевірка й заповнення з резерву ───────────── */

/** @returns {{prob:string|null, items:Record<string, HaveItem>, params:Record<string, Record<string, string>>, time:HaveTime, budget:number, limits:string[]}} */
export function haveDefaults() {
  return { prob: null, items: {}, params: {}, time: '30', budget: 0, limits: [] };
}

/** @param {unknown} v @param {number} max */
const short = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

/**
 * Перевіряє збережений стан модуля: невідоме відкидає, решту обрізає до розумних меж.
 * @param {any} raw
 */
export function cleanHave(raw) {
  const d = haveDefaults();
  if (!raw || typeof raw !== 'object') return d;
  d.prob = typeof raw.prob === 'string' && raw.prob in PROBLEMS ? raw.prob : null;
  if (raw.items && typeof raw.items === 'object') {
    for (const [k, v] of Object.entries(raw.items).slice(0, 200)) {
      if (!(k in ITEMS) || !v || typeof v !== 'object') continue;
      const it = /** @type {any} */ (v);
      if (it.s !== 'y' && it.s !== 'n' && it.s !== 'u') continue;
      /** @type {HaveItem} */ const out = { s: it.s };
      const q = short(it.q, 12);
      if (q) out.q = q;
      if (it.p && typeof it.p === 'object') {
        /** @type {Record<string, string>} */ const pp = {};
        for (const pk of Object.keys(ITEMS[k].params || {})) { const pv = short(it.p[pk], 12); if (pv) pp[pk] = pv; }
        if (Object.keys(pp).length) out.p = pp;
      }
      d.items[k] = out;
    }
  }
  if (raw.params && typeof raw.params === 'object') {
    for (const prob of Object.keys(PROBLEMS)) {
      const src = raw.params[prob];
      if (!src || typeof src !== 'object') continue;
      /** @type {Record<string, string>} */ const pp = {};
      for (const def of PROBLEMS[prob].params) { const v = short(src[def.k], 12); if (v) pp[def.k] = v; }
      d.params[prob] = pp;
    }
  }
  d.time = raw.time === 'now' || raw.time === 'long' ? raw.time : '30';
  const b = Number(raw.budget);
  d.budget = Number.isFinite(b) ? Math.min(1000000, Math.max(0, b)) : 0;
  d.limits = Array.isArray(raw.limits) ? [...new Set(raw.limits.filter((x) => typeof x === 'string' && x in HAVE_LIMITS))] : [];
  return d;
}

/**
 * Стан речей з урахуванням «Мого резерву» й налаштувань: явна позначка людини важливіша;
 * інакше — що є в резерві (кількість лише за однакових одиниць), інакше — «не знаю».
 * @param {Record<string, HaveItem>} own
 * @param {{key?:string, qty:number, unit:string, ok:boolean}[]} reserve
 * @param {string[]} [equip]
 * @returns {{items: Record<string, HaveItem>, fromReserve: Set<string>}}
 */
export function mergeItems(own, reserve, equip = []) {
  /** @type {Record<string, HaveItem>} */ const items = {};
  const fromReserve = new Set();
  for (const k of Object.keys(ITEMS)) {
    if (own && own[k]) { items[k] = own[k]; continue; }
    const res = ITEMS[k].res;
    if (!res) continue;
    const rows = (reserve || []).filter((r) => r.key === res);
    const good = rows.filter((r) => r.ok && r.qty > 0);
    if (good.length) {
      const sameUnit = good.every((r) => r.unit === ITEMS[k].unit);
      items[k] = sameUnit && ITEMS[k].unit ? { s: 'y', q: String(good.reduce((s, r) => s + r.qty, 0)) } : { s: 'y' };
      fromReserve.add(k);
    } else if (rows.length) {
      items[k] = { s: 'n' };
      fromReserve.add(k);
    } else if (equip.includes(res)) {
      items[k] = { s: 'y' };
      fromReserve.add(k);
    }
  }
  return { items, fromReserve };
}

/**
 * Ключі резерву, які людина підтвердила чи заперечила в «Що маю» — для головного підбору.
 * @param {Record<string, HaveItem>} own
 * @returns {{yes:string[], no:string[]}}
 */
export function haveToReserveKeys(own) {
  /** @type {string[]} */ const yes = [], no = [];
  for (const [k, it] of Object.entries(own || {})) {
    const res = ITEMS[k]?.res;
    if (!res) continue;
    if (it.s === 'y') {
      const q = num(it.q ?? '');
      if (Number.isNaN(q) || q > 0) yes.push(res); else no.push(res);
    } else if (it.s === 'n') no.push(res);
  }
  return { yes, no };
}
