// Подбор оборудования и смета для каждой комплектации по прайсу компании (config.tiers).
// Радиаторы — по теплопотерям комнаты, котёл — по сумме с запасом, трубы — по периметру этажей.
import { ROOM_TYPES } from './heat.js';

const SUPPLY = 75; // температура подачи, °C
const RETURN = 65; // обратки
const NOMINAL_DT = 70; // паспортная мощность секции дана при температурном напоре 70 °C
const RAD_EXP = 1.3; // показатель степени для секционных радиаторов
const BOILER_RESERVE = 1.2; // запас мощности котла: прогрев после простоя и горячая вода
const MIN_SECTIONS = 4;
const FLOOR_W = { living: 70, bath: 80 }; // теплоотдача тёплого пола, Вт на м² укладки
const FLOOR_SHARE = { living: 0.75, bath: 0.6 }; // доля площади комнаты под трубами
const GAS_KWH = 9.3; // теплота сгорания природного газа, кВт·ч/м³

// Нужен ли бойлер: два санузла и больше или большая семья.
export function waterMode(h) {
  return (h.baths || 1) >= 2 || (h.people || 4) >= 5 ? 'boiler' : 'double';
}

export function sectionPower(w70, roomT) {
  const dt = (SUPPLY + RETURN) / 2 - roomT;
  return w70 * Math.pow(dt / NOMINAL_DT, RAD_EXP);
}

// Тёплый пол: в каких комнатах и сколько тепла он закрывает.
export function floorHeatingRooms(h, rooms) {
  if (h.floorHeat === 'baths') return rooms.filter((r) => r.type === 'bath');
  if (h.floorHeat === 'ground') return rooms.filter((r) => r.level === 1 && r.type !== 'boiler');
  return [];
}

function pickBoiler(list, kw, type) {
  const fit = (t) => list.filter((b) => b.type === t && b.kw >= kw).sort((a, b) => a.kw - b.kw)[0];
  const b = fit(type) || fit('floor');
  if (b) return { ...b, fits: true };
  const biggest = [...list].sort((a, b) => b.kw - a.kw)[0];
  return { ...biggest, fits: false };
}

export function computeTier(tier, cfg, h, heat) {
  const works = { ...cfg.works, ...tier.works };
  const rad = tier.radiator;
  const fh = new Set(floorHeatingRooms(h, heat.rooms));
  let floorArea = 0;

  // Радиаторы по комнатам.
  const rooms = heat.rooms.map((r) => {
    const type = ROOM_TYPES[r.type] || {};
    let need = r.q;
    let floorW = 0;
    if (fh.has(r)) {
      const k = r.type === 'bath' ? 'bath' : 'living';
      const laid = r.area * FLOOR_SHARE[k];
      floorArea += laid;
      floorW = Math.min(need, laid * FLOOR_W[k]);
      need -= floorW;
    }
    if (type.noRadiator || need < 150) return { ...r, floorW, radiators: [], sections: 0 };
    const qs = sectionPower(rad.w70, r.t);
    const sections = Math.max(MIN_SECTIONS, Math.ceil(need / qs));
    let count = Math.max(1, r.windows, Math.ceil(sections / rad.maxSections));
    count = Math.max(1, Math.min(count, Math.floor(sections / MIN_SECTIONS)));
    const per = Array.from({ length: count }, (_, i) => Math.floor(sections / count) + (i < sections % count ? 1 : 0));
    return { ...r, floorW, radiators: per, sections };
  });
  const radCount = rooms.reduce((s, r) => s + r.radiators.length, 0);
  const sections = rooms.reduce((s, r) => s + r.sections, 0);

  // Котёл и горячая вода.
  let mode = waterMode(h);
  const kw = (heat.total * BOILER_RESERVE) / 1000;
  let boiler = pickBoiler(tier.boilers, kw, mode === 'double' ? 'double' : 'single');
  if (boiler.type === 'floor') mode = 'boiler'; // напольный котёл одноконтурный — вода через бойлер
  const liters = (h.people || 4) >= 5 || (h.baths || 1) >= 3 ? 150 : 100;
  const heater = mode === 'boiler'
    ? [...tier.waterHeaters].sort((a, b) => a.liters - b.liters).find((w) => w.liters >= liters) || tier.waterHeaters.at(-1)
    : null;

  // Трубы: магистрали вдоль наружных стен каждого этажа, подводки к радиаторам, стояки, котельная.
  const levelsUsed = new Set(heat.rooms.map((r) => r.level)).size;
  const P = heat.levels[0].P;
  const pipeM = Math.round((P * 1.2 * levelsUsed + radCount * 2 + (levelsUsed - 1) * 6 + 6) * (tier.pipe.factor || 1));

  const rows = [];
  const mat = (name, qty, unit, price, note) => rows.push({ kind: 'mat', name, qty, unit, price, sum: qty * price, note });
  const wrk = (name, qty, unit, price) => rows.push({ kind: 'work', name, qty, unit, price, sum: qty * price });

  mat(boiler.name, 1, 'шт.', boiler.price, `${boiler.kw} кВт`);
  if (heater) mat(heater.name, 1, 'шт.', heater.price);
  if (radCount) {
    mat(rad.name, sections, 'секц.', rad.price, `${radCount} шт.`);
    mat(tier.radiatorKit.name, radCount, 'компл.', tier.radiatorKit.price);
  }
  mat(tier.pipe.name, pipeM, 'м', tier.pipe.price);
  for (const it of tier.fixed || []) mat(it.name, 1, 'шт.', it.price);
  for (const it of tier.perLevel || []) mat(it.name, levelsUsed, 'шт.', it.price);
  if (floorArea > 0) {
    const fa = Math.ceil(floorArea);
    mat(tier.floorHeating.name, fa, 'м²', tier.floorHeating.perM2);
    mat(tier.floorHeating.unitName, 1, 'шт.', tier.floorHeating.unitPrice);
  }

  wrk(boiler.type === 'floor' ? 'Монтаж напольного котла с обвязкой и дымоходом' : 'Монтаж настенного котла с обвязкой и дымоходом', 1, 'шт.', boiler.type === 'floor' ? works.boilerFloor : works.boiler);
  if (heater) wrk('Монтаж бойлера', 1, 'шт.', works.waterHeater);
  if (radCount) wrk('Монтаж радиаторов', radCount, 'шт.', works.radiator);
  wrk('Прокладка труб', pipeM, 'м', works.pipeM);
  if (floorArea > 0) wrk('Укладка тёплого пола', Math.ceil(floorArea), 'м²', works.floorM2);
  wrk('Опрессовка, пусконаладка, запуск', 1, 'усл.', works.start);

  const materials = rows.filter((r) => r.kind === 'mat').reduce((s, r) => s + r.sum, 0);
  const labour = rows.filter((r) => r.kind === 'work').reduce((s, r) => s + r.sum, 0);
  const total = materials + labour;
  const [lo, hi] = cfg.range || [-0.05, 0.1];
  const roundTo = cfg.roundTo || 1000;

  // Газ за год: отопление + горячая вода, КПД котла из прайса.
  const eff = boiler.eff || 0.92;
  const gasM3 = (heat.heatKwh + heat.dhwKwh) / (GAS_KWH * eff);

  return {
    tier,
    rooms,
    boiler,
    boilerKw: kw,
    mode,
    heater,
    radCount,
    sections,
    pipeM,
    floorArea: Math.ceil(floorArea),
    rows,
    materials,
    labour,
    total,
    low: Math.floor((total * (1 + lo)) / roundTo) * roundTo,
    high: Math.ceil((total * (1 + hi)) / roundTo) * roundTo,
    gasM3,
    gasRub: cfg.gasPrice ? gasM3 * cfg.gasPrice : null,
  };
}

export function computeAll(cfg, h, heat) {
  return cfg.tiers.map((t) => computeTier(t, cfg, h, heat));
}
