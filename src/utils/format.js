const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (v, digits = 1) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: digits });
export const formatRub = (v) => `${rub.format(Math.round(v))} ₽`;
export const kW = (watts) => `${num(watts / 1000)} кВт`;
// 408 000 и 472 000 → «408–472 тыс. ₽»
export const rangeK = (lo, hi) => `${rub.format(Math.round(lo / 1000))}–${rub.format(Math.round(hi / 1000))} тыс. ₽`;
// округление «≈ 2 560» до двух значащих разрядов в сотнях
export const approx = (v, step = 10) => rub.format(Math.round(v / step) * step);

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
