// Ответы покупателя и ссылка на расчёт (?s=…: компактный JSON → base64url).
import { WALLS, WALL_INSULATION, GLAZING, ROOFS, FLOORS } from './data/building.js';
import { REGIONS } from './data/regions.js';
import { ROOM_TYPES, round05 } from './engine/heat.js';

export function defaults(cfg) {
  return {
    area: 120,
    floors: 1,
    ceiling: 2.7,
    wall: 'gas400',
    insulation: 0,
    windows: 'auto',
    glazing: 'double',
    roof: 'r200',
    floor: 'slabIns',
    region: cfg?.region || 'moskva',
    people: 4,
    baths: 1,
    floorHeat: 'none',
    rooms: null, // null — комнаты считаются автоматически по площади
    tier: cfg?.defaultTier || cfg?.tiers?.[1]?.id || cfg?.tiers?.[0]?.id,
  };
}

const KEYS = ['area', 'floors', 'ceiling', 'wall', 'insulation', 'windows', 'glazing', 'roof', 'floor', 'region', 'people', 'baths', 'floorHeat', 'tier'];
const TYPES = Object.keys(ROOM_TYPES);

const b64 = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};

export function encodeState(h) {
  const doc = KEYS.map((k) => h[k]);
  if (h.rooms) doc.push(h.rooms.map((r) => [TYPES.indexOf(r.type), r.level, r.area]));
  return b64.enc(JSON.stringify(doc));
}

// Каждое значение проверяется по справочникам: испорченная ссылка даёт расчёт по умолчанию.
export function decodeState(str, cfg) {
  const d = defaults(cfg);
  if (!str) return d;
  try {
    const doc = JSON.parse(b64.dec(str));
    const raw = Object.fromEntries(KEYS.map((k, i) => [k, doc[i]]));
    const ok = {
      area: (v) => Number.isFinite(v) && v >= 30 && v <= 600,
      floors: (v) => [1, 2, 'attic'].includes(v),
      ceiling: (v) => [2.5, 2.7, 3].includes(v),
      wall: (v) => WALLS.some((w) => w.sizes.some((s) => s.id === v)),
      insulation: (v) => WALL_INSULATION.some((i) => i.id === v),
      windows: (v) => v === 'auto' || (Number.isInteger(v) && v >= 1 && v <= 60),
      glazing: (v) => GLAZING.some((g) => g.id === v),
      roof: (v) => ROOFS.some((r) => r.id === v),
      floor: (v) => FLOORS.some((f) => f.id === v),
      region: (v) => REGIONS.some((r) => r.id === v),
      people: (v) => [2, 4, 6].includes(v),
      baths: (v) => [1, 2, 3].includes(v),
      floorHeat: (v) => ['none', 'baths', 'ground'].includes(v),
      tier: (v) => cfg?.tiers?.some((t) => t.id === v),
    };
    for (const k of KEYS) if (ok[k](raw[k])) d[k] = raw[k];
    const rooms = doc[KEYS.length];
    if (Array.isArray(rooms) && rooms.length && rooms.length <= 40) {
      const list = rooms
        .filter((r) => Array.isArray(r) && TYPES[r[0]] && [1, 2].includes(r[1]) && r[2] >= 2 && r[2] <= 200)
        .map(([t, level, area]) => ({ type: TYPES[t], level: d.floors === 1 ? 1 : level, area: round05(area) }));
      if (list.length) {
        d.rooms = list;
        d.area = list.reduce((s, r) => s + r.area, 0);
      }
    }
  } catch {
    /* ссылка испорчена — расчёт по умолчанию */
  }
  return d;
}
