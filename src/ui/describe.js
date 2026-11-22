// Тексты о доме и расчёте — общие для экрана, сметы в PDF и сообщения монтажнику.
import { findWall, GLAZING, ROOFS, FLOORS, WALL_INSULATION } from '../data/building.js';
import { num, kW, rangeK, plural } from '../utils/format.js';

const FLOORS_TEXT = { 1: '1 этаж', 2: '2 этажа', attic: 'этаж и мансарда' };
const PEOPLE_TEXT = { 2: '1–2 человека', 4: '3–4 человека', 6: '5 и больше человек' };
const FLOOR_HEAT_TEXT = { none: 'нет', baths: 'в санузлах', ground: 'весь первый этаж' };

export function wallText(h) {
  const { wall, size } = findWall(h.wall);
  const ins = +h.insulation ? `, утепление ${h.insulation} мм` : '';
  return `${wall.name.toLowerCase()}, ${size.name.replace(/^(\D)/, (c) => c.toLowerCase())}${ins}`;
}

export function houseLine(h) {
  return `${num(h.area)} м², ${FLOORS_TEXT[h.floors]}, ${wallText(h)}`;
}

export function params(h, heat) {
  const pick = (list, id) => list.find((x) => x.id === id);
  const g = pick(GLAZING, h.glazing);
  const f = pick(FLOORS, h.floor);
  return [
    ['Площадь', `${num(heat.area)} м², ${FLOORS_TEXT[h.floors]}, потолки ${num(h.ceiling)} м`],
    ['Стены', wallText(h)],
    ['Окна', `${heat.windowsCount} шт., ${g.name.toLowerCase()} (${g.note})`],
    [h.floors === 'attic' ? 'Крыша мансарды' : 'Потолок', `утепление: ${pick(ROOFS, h.roof).name.toLowerCase()}`],
    ['Пол', `${f.name.toLowerCase()}, ${f.note}`],
    ['Климат', `${heat.region.name}, расчётная температура ${num(heat.region.t5)} °C`],
    ['Живут', `${PEOPLE_TEXT[h.people]}, ${h.baths} ${plural(h.baths, 'санузел', 'санузла', 'санузлов')}`],
    ['Тёплый пол', FLOOR_HEAT_TEXT[h.floorHeat]],
  ];
}

export function boilerText(t) {
  if (t.boiler.type === 'double') return 'двухконтурный: отопление и горячая вода';
  if (t.heater) return `${t.boiler.type === 'floor' ? 'напольный' : 'одноконтурный'} + бойлер ${t.heater.liters} л`;
  return t.boiler.type === 'floor' ? 'напольный' : 'одноконтурный';
}

// «2 × 5 секц.», «6 + 6 + 5 секц.», «тёплый пол»
export function radiatorText(r) {
  const parts = [];
  if (r.radiators.length) {
    const allSame = r.radiators.every((n) => n === r.radiators[0]);
    parts.push(allSame && r.radiators.length > 1 ? `${r.radiators.length} × ${r.radiators[0]} секц.` : `${r.radiators.join(' + ')} секц.`);
  }
  if (r.floorW > 0) parts.push('тёплый пол');
  if (!parts.length) return r.type === 'boiler' ? 'греет котёл' : '—';
  return parts.join(' и ');
}

export function leadText(cfg, h, heat, t, link) {
  return [
    `Здравствуйте! Посчитал отопление${cfg.brand && !cfg.contacts?.demo ? ` на сайте «${cfg.brand}»` : ''}.`,
    `Дом: ${houseLine(h)}; ${heat.region.name}.`,
    `Теплопотери: ${kW(heat.total)}. Котёл: ${t.boiler.kw} кВт, ${boilerText(t)}.`,
    `Радиаторов: ${t.radCount}${t.floorArea ? `, тёплый пол ${t.floorArea} м²` : ''}.`,
    `Вариант «${t.tier.name}»: ${rangeK(t.low, t.high)}.`,
    `Расчёт: ${link}`,
  ].join('\n');
}

export { WALL_INSULATION };
