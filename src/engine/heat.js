// Теплопотери дома по комнатам — укрупнённая методика СП 50.13330 / СП 60.13330:
// теплопередача через ограждения (с добавочными потерями) + нагрев наружного воздуха для вентиляции.
// Геометрию дома восстанавливаем по площади и этажности: прямоугольник 1 : 1,3.
// Без DOM — модуль запускается и в браузере, и в тестах Node.
import { wallU, GLAZING, ROOFS, FLOORS, DOOR, WINDOW_AREA } from '../data/building.js';
import { findRegion } from '../data/regions.js';

export const ROOM_TYPES = {
  kitchen: { name: 'Кухня-гостиная', t: 20, win: 1 },
  living: { name: 'Гостиная', t: 20, win: 1 },
  bedroom: { name: 'Спальня', t: 20, win: 1 },
  study: { name: 'Кабинет', t: 20, win: 1 },
  bath: { name: 'Санузел', t: 25, win: 0.25 },
  hall: { name: 'Прихожая', t: 18, win: 0.2 },
  corridor: { name: 'Холл', t: 18, win: 0.2 },
  boiler: { name: 'Котельная', t: 16, win: 0.25, noRadiator: true },
};
const LIVING = new Set(['kitchen', 'living', 'bedroom', 'study']);

const ASPECT = 1.3; // длина дома к ширине
const SLAB = 0.3; // толщина перекрытия, м
const EXTRA_VERTICAL = 1.1; // добавочные потери стен и окон: ориентация, ветер, примыкания
const EXTRA_CORNER = 0.05; // ещё +5 % для угловых комнат
const VENT_RATE = 0.35; // минимальная кратность воздухообмена, 1/ч
const VENT_PER_PERSON = 30; // м³/ч на человека
const AIR = 0.337; // Вт·ч/(м³·°C): теплоёмкость × плотность воздуха
const GAINS = 0.15; // доля бытовых и солнечных теплопоступлений за сезон
const DHW_KWH = 2.2; // горячая вода на человека в сутки, кВт·ч (≈ 50 л, нагрев на 35 °C)

export const round05 = (v) => Math.round(v * 2) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Этажи: площадь комнат, площадь основания, периметр, стены, крыша.
export function levels(h) {
  const A = h.area;
  const footprint = h.floors === 2 ? A / 2 : h.floors === 'attic' ? A / 1.75 : A;
  const side = Math.sqrt(footprint / ASPECT);
  const P = 2 * (side + side * ASPECT);
  const hw = h.ceiling + SLAB;
  if (h.floors === 1) return [{ n: 1, area: A, footprint, P, walls: P * hw, roof: footprint, floor: footprint, height: h.ceiling }];
  const ground = { n: 1, area: footprint, footprint, P, walls: P * hw, roof: 0, floor: footprint, height: h.ceiling };
  if (h.floors === 2) return [ground, { n: 2, area: footprint, footprint, P, walls: P * hw, roof: footprint, floor: 0, height: h.ceiling }];
  // Мансарда: жилая площадь 0,75 основания; стены — низкие боковые + фронтоны, крыша — скаты и затяжка.
  return [ground, { n: 2, area: A - footprint, footprint, P, walls: P * 1.5, roof: footprint * 1.15, floor: 0, height: 2.5, attic: true }];
}

// Типовой набор комнат по площади этажей. Покупатель потом может поправить список.
export function autoRooms(h) {
  const lv = levels(h);
  const rooms = [];
  const add = (type, level, area) => area >= 2 && rooms.push({ type, level, area: round05(area) });
  const bedrooms = (level, rest, size = 15) => {
    const n = Math.max(1, Math.round(rest / size));
    for (let i = 0; i < n; i++) add(i === 0 && level === 1 && lv.length > 1 ? 'study' : 'bedroom', level, rest / n);
  };
  const baths = h.baths || 1;
  if (lv.length === 1) {
    const S = lv[0].area;
    add('hall', 1, clamp(S * 0.07, 4, 12));
    if (S >= 70) add('boiler', 1, clamp(S * 0.04, 4, 8));
    add('kitchen', 1, clamp(S * 0.3, 14, 45));
    for (let i = 0; i < baths; i++) add('bath', 1, i === 0 ? clamp(S * 0.05, 4, 9) : 4.5);
    if (S > 90) add('corridor', 1, S * 0.06);
  } else {
    const S1 = lv[0].area;
    const S2 = lv[1].area;
    add('hall', 1, clamp(S1 * 0.1, 4, 12));
    if (S1 >= 40) add('boiler', 1, clamp(S1 * 0.06, 4, 8));
    add('kitchen', 1, clamp(S1 * 0.42, 14, 50));
    add('bath', 1, clamp(S1 * 0.07, 3, 7));
    add('corridor', 2, clamp(S2 * 0.12, 4, 16));
    for (let i = 1; i < baths; i++) add('bath', 2, i === 1 ? clamp(S2 * 0.08, 4, 9) : 4.5);
  }
  // Остаток этажа — спальни (на первом этаже двухэтажного дома — кабинет или гостевая).
  for (const l of lv) {
    const used = rooms.filter((r) => r.level === l.n).reduce((s, r) => s + r.area, 0);
    const rest = l.area - used;
    if (rest >= 8) bedrooms(l.n, rest, l.n === 1 && lv.length > 1 ? 18 : 15);
    else if (rest > 0) {
      const big = rooms.filter((r) => r.level === l.n).sort((a, b) => b.area - a.area)[0];
      big.area = round05(big.area + rest);
    }
  }
  // Округление до 0,5 м² — разницу отдаём самой большой комнате этажа.
  for (const l of lv) {
    const onLevel = rooms.filter((r) => r.level === l.n);
    const diff = round05(l.area - onLevel.reduce((s, r) => s + r.area, 0));
    if (diff) onLevel.sort((a, b) => b.area - a.area)[0].area += diff;
  }
  return numberRooms(rooms);
}

// «Спальня 1», «Спальня 2»… — только для повторяющихся типов.
export function numberRooms(rooms) {
  const count = {};
  for (const r of rooms) count[r.type] = (count[r.type] || 0) + 1;
  const seen = {};
  return rooms.map((r) => {
    seen[r.type] = (seen[r.type] || 0) + 1;
    const base = ROOM_TYPES[r.type]?.name || 'Комната';
    return { ...r, name: count[r.type] > 1 ? `${base} ${seen[r.type]}` : base };
  });
}

export function windowsAuto(area) {
  return Math.max(3, Math.round((area * 0.14) / WINDOW_AREA));
}

// Главный расчёт. h — ответы покупателя (см. state.js), rooms — список комнат (или автоматический).
export function computeHeat(h, roomsIn) {
  const region = findRegion(h.region);
  const lv = levels(h);
  const rooms0 = roomsIn?.length ? roomsIn : autoRooms(h);
  const glazing = GLAZING.find((g) => g.id === h.glazing) || GLAZING[0];
  const roof = ROOFS.find((r) => r.id === h.roof) || ROOFS[0];
  const floor = FLOORS.find((f) => f.id === h.floor) || FLOORS[0];
  const Uw = wallU(h.wall, h.insulation);
  const totalArea = rooms0.reduce((s, r) => s + r.area, 0);
  const windowsCount = h.windows === 'auto' || h.windows == null ? windowsAuto(totalArea) : +h.windows;
  const windowArea = windowsCount * WINDOW_AREA;
  const topLevel = Math.max(...rooms0.map((r) => r.level));
  const lvl = (n) => lv.find((l) => l.n === n) || lv[lv.length - 1];

  // Наружные стены: в каждом этаже по 4 угловые комнаты, коридор — внутренний.
  const rooms = rooms0.map((r) => ({ ...r }));
  for (const l of new Set(rooms.map((r) => r.level))) {
    const onLevel = rooms.filter((r) => r.level === l);
    const corners = onLevel.filter((r) => LIVING.has(r.type)).sort((a, b) => b.area - a.area).slice(0, 4);
    for (const r of onLevel) r.outer = r.type === 'corridor' && onLevel.length > 1 ? 0 : corners.includes(r) ? 2 : 1;
  }

  const wallWeight = (r) => r.outer * Math.sqrt(r.area);
  const winWeight = (r) => (r.outer ? (ROOM_TYPES[r.type]?.win ?? 1) * r.area : 0);
  const sumWin = rooms.reduce((s, r) => s + winWeight(r), 0) || 1;
  const doorRoom = rooms.find((r) => r.type === 'hall' && r.level === 1) || rooms.filter((r) => r.level === 1).sort((a, b) => b.area - a.area)[0];

  const volume = rooms.reduce((s, r) => s + r.area * lvl(r.level).height, 0);
  const people = h.people || 4;
  const ventTotal = Math.max(VENT_RATE * volume, VENT_PER_PERSON * people) * (glazing.infiltration || 1);

  const parts = { walls: 0, windows: 0, roof: 0, floor: 0, vent: 0 };
  let annual = 0;

  const out = rooms.map((r) => {
    const l = lvl(r.level);
    const onLevel = rooms.filter((x) => x.level === r.level);
    const levelArea = onLevel.reduce((s, x) => s + x.area, 0);
    const wsum = onLevel.reduce((s, x) => s + wallWeight(x), 0) || 1;
    const wallsGross = (l.walls * wallWeight(r)) / wsum;
    let win = (windowArea * winWeight(r)) / sumWin;
    win = Math.min(win, wallsGross * 0.6);
    const door = r === doorRoom ? DOOR.area : 0;
    const wallNet = Math.max(0, wallsGross - win - door);
    const roofA = r.level === topLevel ? (l.roof || l.footprint) * (r.area / levelArea) : 0;
    const floorA = r.level === 1 ? l.floor * (r.area / levelArea) : 0;
    const t = ROOM_TYPES[r.type]?.t ?? 20;
    const dt = t - region.t5;
    const extra = EXTRA_VERTICAL + (r.outer >= 2 ? EXTRA_CORNER : 0);
    const q = {
      walls: Uw * wallNet * dt * extra,
      windows: (glazing.U * win + DOOR.U * door) * dt * extra,
      roof: roof.U * roofA * dt,
      floor: floor.U * floorA * dt,
      vent: AIR * ventTotal * (r.area / totalArea) * dt,
    };
    const total = q.walls + q.windows + q.roof + q.floor + q.vent;
    for (const k in parts) parts[k] += q[k];
    // Годовая потребность: та же теплопотеря на градус × градусо-сутки отопительного периода.
    annual += (total / dt) * (t - region.tHeat) * region.days * 24 / 1000;
    return {
      ...r,
      t,
      windows: win > 0.3 ? Math.max(1, Math.round(win / WINDOW_AREA)) : 0,
      q: total,
      parts: q,
    };
  });

  const total = out.reduce((s, r) => s + r.q, 0);
  const heatKwh = annual * (1 - GAINS);
  const dhwKwh = people * DHW_KWH * 365;
  return {
    region,
    rooms: out,
    area: totalArea,
    windowsCount,
    total,
    perM2: total / totalArea,
    parts,
    heatKwh,
    dhwKwh,
    levels: lv,
  };
}
