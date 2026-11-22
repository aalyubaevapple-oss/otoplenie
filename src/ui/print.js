// Смета для печати и сохранения в PDF (печать браузера: на iPhone — «Поделиться → Сохранить в Файлы»).
import { esc, num, kW, formatRub, rangeK, approx } from '../utils/format.js';
import { params, boilerText, radiatorText } from './describe.js';
import { PARTS } from './result.js';

export function renderPrint({ cfg, h, heat, sel, link }) {
  const c = cfg.contacts || {};
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const row = (r) => `<tr><td>${esc(r.name)}${r.note ? ` <span style="color:#555">(${esc(r.note)})</span>` : ''}</td><td class="r">${num(r.qty, 0)} ${r.unit}</td><td class="r">${formatRub(r.price)}</td><td class="r">${formatRub(r.sum)}</td></tr>`;
  const mats = sel.rows.filter((r) => r.kind === 'mat');
  const works = sel.rows.filter((r) => r.kind === 'work');
  const parts = PARTS.map(([k, n]) => `${n.toLowerCase()} ${Math.round((heat.parts[k] / heat.total) * 100)} %`).join(', ');
  return `
    <div class="ph">
      <div><b>${esc(cfg.brand || '')}</b><br>${esc(cfg.tagline || '')}</div>
      <div>${[c.phone, c.email, c.address].filter(Boolean).map(esc).join('<br>')}</div>
    </div>
    <h1>Предварительная смета на отопление дома</h1>
    <div>${date}${cfg.contacts?.demo ? ' · демо, цены условные' : ''}</div>

    <div class="kp">
      <div><span>Теплопотери</span><b>${kW(heat.total)}</b><br>${num(Math.round(heat.perM2), 0)} Вт/м² при ${num(heat.region.t5)} °C</div>
      <div><span>Котёл</span><b>${sel.boiler.kw} кВт</b><br>${esc(boilerText(sel))}</div>
      <div><span>Вариант «${esc(sel.tier.name)}»</span><b>${formatRub(sel.total)}</b><br>${rangeK(sel.low, sel.high)}</div>
    </div>

    <h2>Дом</h2>
    <table class="params">${params(h, heat).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
    <p class="note">Куда уходит тепло: ${parts}.</p>

    <h2>Оборудование и материалы</h2>
    <table>
      <tr><th>Позиция</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr>
      ${mats.map(row).join('')}
      <tr class="tot"><td colspan="3">Итого материалы</td><td class="r">${formatRub(sel.materials)}</td></tr>
    </table>

    <h2>Работы</h2>
    <table>
      <tr><th>Работа</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr>
      ${works.map(row).join('')}
      <tr class="tot"><td colspan="3">Итого работы</td><td class="r">${formatRub(sel.labour)}</td></tr>
      <tr class="tot"><td colspan="3">Всего под ключ</td><td class="r">${formatRub(sel.total)}</td></tr>
    </table>

    <h2>Радиаторы по комнатам</h2>
    <table>
      <tr><th>Комната</th><th class="r">Площадь</th><th class="r">Теплопотери</th><th class="r">Отопление</th></tr>
      ${sel.rooms.map((r) => `<tr><td>${esc(r.name)}${r.level > 1 ? ' (2 этаж)' : ''}</td><td class="r">${num(r.area)} м²</td><td class="r">${num(Math.round(r.q / 10) * 10, 0)} Вт</td><td class="r">${esc(radiatorText(r))}</td></tr>`).join('')}
    </table>

    ${cfg.gasPrice ? `<p class="note">Газ на отопление и горячую воду: ≈ ${approx(sel.gasM3, 50)} м³ в год, ≈ ${approx(sel.gasRub, 500)} ₽ (${esc(cfg.gasNote || '')}).</p>` : ''}
    <p class="note">Предварительный расчёт по укрупнённой методике (СП 50.13330, СП 60.13330, климат — СП 131.13330.2020). Не является проектом и публичной офертой. Точная смета — после осмотра дома инженером.${link ? ` Расчёт онлайн: ${esc(link)}` : ''}</p>`;
}
