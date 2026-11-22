// Ограждающие конструкции: из чего дом и как утеплён.
// R — термическое сопротивление слоя, м²·°C/Вт (толщина / λ для условий эксплуатации Б по СП 50.13330);
// U — коэффициент теплопередачи готовой конструкции, Вт/(м²·°C).
// Это укрупнённые значения для предварительного расчёта, а не теплотехнический расчёт конкретного проекта.

export const WALLS = [
  {
    id: 'gas', name: 'Газобетон', icon: 'block',
    sizes: [
      { id: 'gas300', name: '300 мм', R: 0.30 / 0.14 },
      { id: 'gas375', name: '375 мм', R: 0.375 / 0.14 },
      { id: 'gas400', name: '400 мм', R: 0.40 / 0.14 },
    ],
  },
  {
    id: 'ceramic', name: 'Керамический блок', icon: 'block',
    sizes: [
      { id: 'cer380', name: '380 мм', R: 0.38 / 0.16 },
      { id: 'cer440', name: '440 мм', R: 0.44 / 0.16 },
    ],
  },
  {
    id: 'brick', name: 'Кирпич', icon: 'brick',
    sizes: [
      { id: 'brick380', name: '1,5 кирпича (380 мм)', R: 0.38 / 0.70 },
      { id: 'brick510', name: '2 кирпича (510 мм)', R: 0.51 / 0.70 },
      { id: 'brick640', name: '2,5 кирпича (640 мм)', R: 0.64 / 0.70 },
    ],
  },
  {
    id: 'timber', name: 'Брус или бревно', icon: 'wood',
    sizes: [
      { id: 'timber150', name: 'Брус 150 мм', R: 0.15 / 0.18 },
      { id: 'timber200', name: 'Брус 200 мм', R: 0.20 / 0.18 },
      { id: 'log240', name: 'Бревно 220–260 мм', R: 0.20 / 0.18 },
    ],
  },
  {
    id: 'frame', name: 'Каркас', icon: 'frame', solid: true,
    sizes: [
      { id: 'frame150', name: 'Утеплитель 150 мм', R: 2.7 },
      { id: 'frame200', name: 'Утеплитель 200 мм', R: 3.6 },
    ],
  },
  {
    id: 'sip', name: 'СИП-панели', icon: 'frame', solid: true,
    sizes: [
      { id: 'sip174', name: '174 мм', R: 3.3 },
      { id: 'sip224', name: '224 мм', R: 4.4 },
    ],
  },
  {
    id: 'keramzit', name: 'Шлакоблок, керамзитоблок', icon: 'block',
    sizes: [
      { id: 'kz390', name: '390 мм', R: 0.39 / 0.45 },
      { id: 'kz590', name: '590 мм', R: 0.59 / 0.45 },
    ],
  },
];

// Утепление снаружи минватой или пенополистиролом, λ ≈ 0,045.
export const WALL_INSULATION = [
  { id: 0, name: 'Нет', R: 0 },
  { id: 50, name: '50 мм', R: 0.05 / 0.045 },
  { id: 100, name: '100 мм', R: 0.10 / 0.045 },
  { id: 150, name: '150 мм', R: 0.15 / 0.045 },
];

// Сопротивления теплообмену у поверхностей: 1/8,7 + 1/23.
const R_SURF = 0.158;
// Коэффициент теплотехнической однородности кладки (швы, перемычки, торцы перекрытий).
const R_HOMOGENEITY = 0.9;

export function wallU(sizeId, insulationMm = 0) {
  const wall = WALLS.find((w) => w.sizes.some((s) => s.id === sizeId)) || WALLS[0];
  const size = wall.sizes.find((s) => s.id === sizeId) || wall.sizes[0];
  const ins = WALL_INSULATION.find((i) => i.id === +insulationMm) || WALL_INSULATION[0];
  const r = wall.solid ? 1 : R_HOMOGENEITY; // у каркаса и СИП мостики уже учтены в R
  return 1 / ((size.R + ins.R) * r + R_SURF);
}

export const findWall = (sizeId) => {
  for (const w of WALLS) {
    const s = w.sizes.find((x) => x.id === sizeId);
    if (s) return { wall: w, size: s };
  }
  return { wall: WALLS[0], size: WALLS[0].sizes[0] };
};

// Окна вместе с рамой. infiltration — во сколько раз старые рамы увеличивают воздухообмен.
export const GLAZING = [
  { id: 'energy', name: 'Энергосберегающие', note: 'двухкамерные, с напылением', U: 1.4 },
  { id: 'double', name: 'Двухкамерные', note: 'три стекла', U: 1.9 },
  { id: 'single', name: 'Однокамерные', note: 'два стекла', U: 2.9 },
  { id: 'wood', name: 'Старые деревянные', note: 'двойные рамы', U: 2.4, infiltration: 1.3 },
];

// Потолок последнего этажа или крыша мансарды.
export const ROOFS = [
  { id: 'r200', name: '200 мм и больше', U: 0.24 },
  { id: 'r150', name: '150 мм', U: 0.32 },
  { id: 'r100', name: '100 мм', U: 0.45 },
  { id: 'r0', name: 'Почти не утеплён', U: 1.0 },
];

// Пол первого этажа. Для пола по грунту — средний U по зонам (СП 50.13330, прил. Е) для дома 8×10 м;
// для пола над проветриваемым подпольем учтён коэффициент n = 0,9.
export const FLOORS = [
  { id: 'slabIns', name: 'Утеплённая плита', note: 'УШП или плита с ЭППС 100 мм', U: 0.17 },
  { id: 'slab', name: 'Плита по грунту', note: 'без утепления', U: 0.40 },
  { id: 'joistIns', name: 'Деревянный пол', note: 'над подпольем, утеплён 150 мм', U: 0.28 },
  { id: 'joist', name: 'Деревянный пол', note: 'над подпольем, утеплён слабо', U: 0.65 },
];

// Входная дверь: утеплённая металлическая, 2,1 м².
export const DOOR = { area: 2.1, U: 1.6 };

// Средняя площадь окна, м² (1,2 × 1,35 м).
export const WINDOW_AREA = 1.6;
