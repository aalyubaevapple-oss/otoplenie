// Четыре шага с вопросами. Каждый вариант — кнопка с data-set/data-val, обработка в main.js.
import { WALLS, WALL_INSULATION, GLAZING, ROOFS, FLOORS, findWall } from '../data/building.js';
import { REGIONS } from '../data/regions.js';
import { windowsAuto } from '../engine/heat.js';
import { esc, num } from '../utils/format.js';
import { ICONS } from './icons.js';

export const STEPS = [
  { id: 'house', title: 'Дом', sub: 'Площадь и этажи — основа расчёта. Можно примерно.' },
  { id: 'walls', title: 'Стены', sub: 'Из чего построен дом и утеплён ли он снаружи.' },
  { id: 'envelope', title: 'Окна, потолок и пол', sub: 'Через них уходит больше половины тепла.' },
  { id: 'life', title: 'Где дом и кто в нём живёт', sub: 'Климат, горячая вода и тёплый пол.' },
];

// Толщина по умолчанию при выборе материала.
export const WALL_DEFAULT = { gas: 'gas400', ceramic: 'cer380', brick: 'brick510', timber: 'timber150', frame: 'frame150', sip: 'sip174', keramzit: 'kz390' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const attr = (v) => esc(JSON.stringify(v));

const chip = (key, val, label, cur) =>
  `<button type="button" class="chip${same(val, cur) ? ' on' : ''}" data-set="${key}" data-val="${attr(val)}" role="radio" aria-checked="${same(val, cur)}">${label}</button>`;

const opt = (key, val, cur, name, note, icon) =>
  `<button type="button" class="opt${same(val, cur) ? ' on' : ''}" data-set="${key}" data-val="${attr(val)}" role="radio" aria-checked="${same(val, cur)}">${icon ? ICONS[icon] : ''}<span><b>${esc(name)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></button>`;

const q = (title, body, hint = '') => `<div class="q"><div class="q-title">${title}${hint ? `<small>${hint}</small>` : ''}</div>${body}</div>`;

export function renderStep(i, h) {
  const s = STEPS[i];
  const head = `
    <div class="progress" aria-label="Шаг ${i + 1} из ${STEPS.length}">
      <div class="label"><span>Шаг ${i + 1} из ${STEPS.length}</span><span>${i === STEPS.length - 1 ? 'последний' : ''}</span></div>
      <div class="track"><div class="fill" style="width:${((i + 1) / (STEPS.length + 1)) * 100}%"></div></div>
    </div>
    <h1 class="step-title">${s.title}</h1>
    <p class="step-sub">${s.sub}</p>`;
  return head + BODY[s.id](h);
}

const BODY = {
  house: (h) => `
    ${q('Отапливаемая площадь', `
      <div class="area-box">
        <button type="button" class="round" data-act="area" data-d="-5" aria-label="Меньше">−</button>
        <input type="number" inputmode="numeric" min="30" max="600" step="1" value="${h.area}" data-input="area" aria-label="Площадь, м²">
        <span class="unit">м²</span>
        <button type="button" class="round" data-act="area" data-d="5" aria-label="Больше">+</button>
      </div>
      <input type="range" min="40" max="400" step="5" value="${Math.min(400, Math.max(40, h.area))}" data-input="area" aria-label="Площадь">`)}
    ${q('Этажей', `<div class="chips" role="radiogroup">
      ${chip('floors', 1, '1 этаж', h.floors)}${chip('floors', 2, '2 этажа', h.floors)}${chip('floors', 'attic', 'Этаж и мансарда', h.floors)}</div>`)}
    ${q('Высота потолков', `<div class="chips" role="radiogroup">
      ${[2.5, 2.7, 3].map((v) => chip('ceiling', v, `${num(v)} м`, h.ceiling)).join('')}</div>`)}`,

  walls: (h) => {
    const { wall } = findWall(h.wall);
    return `
      ${q('Материал стен', `<div class="opts" role="radiogroup">
        ${WALLS.map((w) => opt('wallType', w.id, wall.id, w.name, '', w.icon)).join('')}</div>`)}
      ${q(wall.id === 'frame' ? 'Утеплитель в каркасе' : 'Толщина', `<div class="chips" role="radiogroup">
        ${wall.sizes.map((s) => chip('wall', s.id, s.name, h.wall)).join('')}</div>`)}
      ${q('Утепление снаружи', `<div class="chips" role="radiogroup">
        ${WALL_INSULATION.map((x) => chip('insulation', x.id, x.name, h.insulation)).join('')}</div>`, 'минвата или пенопласт под фасадом')}`;
  },

  envelope: (h) => {
    const auto = windowsAuto(h.area);
    const n = h.windows === 'auto' ? auto : h.windows;
    return `
      ${q('Сколько окон', `
        <div class="area-box">
          <button type="button" class="round" data-act="windows" data-d="-1" aria-label="Меньше">−</button>
          <input type="number" inputmode="numeric" min="1" max="60" value="${n}" data-input="windows" aria-label="Окон">
          <span class="unit">шт.</span>
          <button type="button" class="round" data-act="windows" data-d="1" aria-label="Больше">+</button>
        </div>
        <p class="hint">${h.windows === 'auto' ? `Подставили обычное число для ${num(h.area)} м². Балконные двери считайте как окна.` : `Для ${num(h.area)} м² обычно ${auto}. <button type="button" class="btn ghost small" data-act="windows-auto">Вернуть</button>`}</p>`)}
      ${q('Окна', `<div class="opts two" role="radiogroup">
        ${GLAZING.map((g) => opt('glazing', g.id, h.glazing, g.name, g.note)).join('')}</div>`)}
      ${q(h.floors === 'attic' ? 'Утепление крыши мансарды' : 'Утепление потолка верхнего этажа', `<div class="chips" role="radiogroup">
        ${ROOFS.map((r) => chip('roof', r.id, r.name, h.roof)).join('')}</div>`)}
      ${q('Пол первого этажа', `<div class="opts two" role="radiogroup">
        ${FLOORS.map((f) => opt('floor', f.id, h.floor, f.name, f.note)).join('')}</div>`)}`;
  },

  life: (h) => `
    ${q('Ближайший крупный город', `<select data-input="region" aria-label="Город">
      ${REGIONS.map((r) => `<option value="${r.id}"${r.id === h.region ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
    </select><p class="hint">Расчётный мороз: ${num(REGIONS.find((r) => r.id === h.region)?.t5 ?? -26)} °C — по своду правил «Строительная климатология».</p>`)}
    ${q('Сколько человек живёт', `<div class="chips" role="radiogroup">
      ${chip('people', 2, '1–2', h.people)}${chip('people', 4, '3–4', h.people)}${chip('people', 6, '5 и больше', h.people)}</div>`)}
    ${q('Санузлов', `<div class="chips" role="radiogroup">
      ${[1, 2, 3].map((v) => chip('baths', v, String(v), h.baths)).join('')}</div>`, 'от двух — котёл с бойлером')}
    ${q('Тёплый пол', `<div class="chips" role="radiogroup">
      ${chip('floorHeat', 'none', 'Не нужен', h.floorHeat)}${chip('floorHeat', 'baths', 'В санузлах', h.floorHeat)}${chip('floorHeat', 'ground', 'Весь первый этаж', h.floorHeat)}</div>`)}`,
};

export { WALLS };
