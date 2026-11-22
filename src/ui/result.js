// Экран результата: теплопотери, куда уходит тепло, три комплектации со сметой, радиаторы по комнатам,
// газ за год, связь с монтажником.
import { computeHeat, ROOM_TYPES } from '../engine/heat.js';
import { findWall } from '../data/building.js';
import { esc, num, kW, formatRub, rangeK, approx, plural } from '../utils/format.js';
import { boilerText, radiatorText, houseLine } from './describe.js';
import { ICONS } from './icons.js';

export const PARTS = [
  ['walls', 'Стены', '--c-walls'],
  ['windows', 'Окна и дверь', '--c-windows'],
  ['vent', 'Проветривание', '--c-vent'],
  ['roof', 'Потолок, крыша', '--c-roof'],
  ['floor', 'Пол', '--c-floor'],
];

// Что даст самое заметное утепление — пересчитываем тот же дом с одним изменением.
function bestTip(h, heat, cfg, eff) {
  const { wall } = findWall(h.wall);
  const ideas = [];
  if (+h.insulation < 100 && !wall.solid) ideas.push([{ insulation: 100 }, 'утеплить стены снаружи на 100 мм']);
  if (['single', 'wood'].includes(h.glazing)) ideas.push([{ glazing: 'energy' }, 'поставить энергосберегающие окна']);
  if (['r0', 'r100'].includes(h.roof)) ideas.push([{ roof: 'r200' }, h.floors === 'attic' ? 'утеплить крышу до 200 мм' : 'утеплить потолок до 200 мм']);
  if (h.floor === 'joist') ideas.push([{ floor: 'joistIns' }, 'утеплить пол над подпольем']);
  if (h.floor === 'slab') ideas.push([{ floor: 'slabIns' }, 'утеплить пол']);
  let best = null;
  for (const [change, text] of ideas) {
    const alt = computeHeat({ ...h, ...change }, h.rooms);
    const save = 1 - alt.total / heat.total;
    if (!best || save > best.save) best = { save, text, alt };
  }
  if (!best || best.save < 0.08) return '';
  const gasSave = cfg.gasPrice ? ((heat.heatKwh - best.alt.heatKwh) / (9.3 * eff)) * cfg.gasPrice : 0;
  return `<p class="tip"><b>Совет.</b> Если ${best.text}, теплопотери снизятся примерно на ${Math.round(best.save * 100)} %${gasSave > 1000 ? `, газ — на ≈ ${approx(gasSave, 500)} ₽ в год` : ''}.</p>`;
}

function lossCard(h, heat, cfg, t) {
  const total = heat.total;
  const items = PARTS.map(([k, name, c]) => ({ k, name, c, v: heat.parts[k], p: (heat.parts[k] / total) * 100 })).filter((x) => x.p >= 0.5);
  return `
    <section class="card">
      <h2>Куда уходит тепло</h2>
      <div class="loss-bar" role="img" aria-label="${esc(items.map((x) => `${x.name} ${Math.round(x.p)} %`).join(', '))}">
        ${items.map((x) => `<i style="width:${x.p}%;background:var(${x.c})"></i>`).join('')}
      </div>
      <ul class="legend">${items.map((x) => `<li style="--c:var(${x.c})">${x.name}<b>${Math.round(x.p)} %</b></li>`).join('')}</ul>
      ${bestTip(h, heat, cfg, t.boiler.eff || 0.92)}
    </section>`;
}

function tierCards(tiers, sel, cfg) {
  const popular = cfg.popularTier || cfg.defaultTier;
  return `<div class="tiers" role="radiogroup" aria-label="Комплектация">${tiers.map((t) => `
    <button type="button" class="tier${t === sel ? ' on' : ''}" data-set="tier" data-val="${esc(JSON.stringify(t.tier.id))}" role="radio" aria-checked="${t === sel}">
      <span class="n">${esc(t.tier.name)}</span>
      <span class="p">${num(Math.round(t.low / 1000), 0)}–${num(Math.round(t.high / 1000), 0)}<small>тыс. ₽</small></span>
      ${t.tier.id === popular ? '<span class="badge">Популярный</span>' : ''}
    </button>`).join('')}</div>`;
}

function smetaTable(t) {
  const row = (r) => `<tr><td>${esc(r.name)}<small>${r.note ? esc(r.note) + ' · ' : ''}${num(r.qty, 0)} ${r.unit} × ${formatRub(r.price)}</small></td><td class="r">${formatRub(r.sum)}</td></tr>`;
  const mats = t.rows.filter((r) => r.kind === 'mat');
  const works = t.rows.filter((r) => r.kind === 'work');
  return `
    <table class="smeta">
      <tr><th colspan="2">Оборудование и материалы</th></tr>
      ${mats.map(row).join('')}
      <tr class="sub-total"><td>Итого материалы</td><td class="r">${formatRub(t.materials)}</td></tr>
      <tr><th colspan="2">Работы</th></tr>
      ${works.map(row).join('')}
      <tr class="sub-total"><td>Итого работы</td><td class="r">${formatRub(t.labour)}</td></tr>
    </table>`;
}

function roomsCard(t, heat, custom) {
  const levels = [...new Set(t.rooms.map((r) => r.level))].sort();
  const row = (r) => `<tr><td>${esc(r.name)}<small>${num(r.area)} м² · теплопотери ${num(Math.round(r.q / 10) * 10, 0)} Вт</small></td><td class="r">${esc(radiatorText(r))}</td></tr>`;
  const body = levels.map((l) => `${levels.length > 1 ? `<tr class="lvl"><td colspan="2">${l === 1 ? 'Первый этаж' : heat.levels[1]?.attic ? 'Мансарда' : 'Второй этаж'}</td></tr>` : ''}${t.rooms.filter((r) => r.level === l).map(row).join('')}`).join('');
  return `
    <section class="card">
      <h2>Радиаторы по комнатам <small>· ${t.radCount} ${plural(t.radCount, 'радиатор', 'радиатора', 'радиаторов')}, ${t.sections} ${plural(t.sections, 'секция', 'секции', 'секций')}</small></h2>
      <table class="rooms">${body}</table>
      <p class="hint">${custom ? 'Комнаты — по вашему списку.' : 'Комнаты расставлены по типовой планировке. Если у вас иначе — поправьте, расчёт обновится.'}</p>
      <button type="button" class="btn small" data-act="rooms-open">${ICONS.edit}Уточнить комнаты</button>
    </section>`;
}

function gasCard(t, cfg) {
  if (!cfg.gasPrice) return '';
  const elec = cfg.electricityPrice ? (t.gasM3 * 9.3 * (t.boiler.eff || 0.92) * cfg.electricityPrice) / 0.99 : 0;
  return `
    <section class="card">
      <h2>Газ за год <small>· отопление и горячая вода</small></h2>
      <div class="gas">
        <div><span>Расход</span><b>≈ ${approx(t.gasM3, 50)} м³</b><small>в холодный месяц до ≈ ${approx(t.gasM3 * 0.16, 10)} м³</small></div>
        <div><span>Стоимость</span><b>≈ ${approx(t.gasRub, 500)} ₽</b><small>≈ ${approx(t.gasRub / 12, 100)} ₽ в месяц в среднем</small></div>
      </div>
      ${elec ? `<p class="hint">Для сравнения: электрокотёл в том же доме потратил бы ≈ ${approx(elec, 1000)} ₽ в год.</p>` : ''}
      <p class="hint">${esc(cfg.gasNote || '')}${cfg.electricityNote ? `; ${esc(cfg.electricityNote)}` : ''}.</p>
    </section>`;
}

function contactCard(cfg) {
  const c = cfg.contacts || {};
  const lead = cfg.lead || {};
  const channels = [
    ['phone', 'Позвонить', c.phone],
    ['whatsapp', 'WhatsApp', c.whatsapp],
    ['telegram', 'Telegram', c.telegram],
    ['email', 'Почта', c.email],
  ].filter(([, , v]) => v);
  return `
    <section class="card cta" id="contact">
      <h2>Точную цену назовёт инженер</h2>
      <p>${esc(cfg.ctaText || 'Инженер приедет, проверит расчёт на месте и зафиксирует цену в договоре.')} Сообщение уже содержит ваш расчёт.${c.hours ? ` <span class="muted">${esc(c.hours)}.</span>` : ''}</p>
      <div class="contact-grid">${channels.map(([id, label]) => `<button type="button" class="btn ${id}" data-act="contact" data-ch="${id}">${ICONS[id]}${label}</button>`).join('')}</div>
      ${lead.endpoint ? `
        <form class="lead-form" novalidate>
          <div class="muted">Или оставьте телефон — перезвоним</div>
          <input name="name" autocomplete="name" placeholder="Имя" required maxlength="80">
          <input name="phone" type="tel" autocomplete="tel" placeholder="Телефон" required maxlength="30">
          <label class="consent"><input type="checkbox" name="consent" value="1"><span>Согласен на обработку персональных данных по <a href="${esc(lead.privacyUrl || '#')}" target="_blank" rel="noopener">политике конфиденциальности</a></span></label>
          <button type="submit" class="btn primary">Отправить заявку</button>
        </form>` : ''}
    </section>`;
}

export function renderResult({ cfg, h, heat, tiers, sel }) {
  const lowKw = Math.ceil(sel.boilerKw);
  return `
    <div class="res-head">
      <h1>Дому нужно ${kW(heat.total)} тепла</h1>
      <p>${esc(houseLine(h))}. Расчёт на мороз ${num(heat.region.t5)} °C (${esc(heat.region.name)}).</p>
    </div>
    ${cfg.contacts?.demo && cfg.demoNote ? `<p class="demo-note">${esc(cfg.demoNote)}</p>` : ''}
    <div class="kpis">
      <div class="kpi"><span>Теплопотери</span><b>${kW(heat.total)}</b><small>${num(Math.round(heat.perM2), 0)} Вт на м² в самый холодный период</small></div>
      <div class="kpi"><span>Котёл</span><b>${sel.boiler.kw} кВт</b><small>${esc(boilerText(sel))}; нужно от ${lowKw} кВт с запасом</small></div>
    </div>
    ${sel.boiler.fits ? '' : `<p class="demo-note">Дому нужно больше ${Math.floor(sel.boiler.kw)} кВт — инженер подберёт два котла или мощный напольный на выезде.</p>`}

    <section class="card">
      <h2>Цена под ключ</h2>
      ${tierCards(tiers, sel, cfg)}
      <p class="tier-note">${esc(sel.tier.note || '')}</p>
      ${smetaTable(sel)}
      <div class="total-line"><b>≈ ${formatRub(Math.round(sel.total / 1000) * 1000)}</b><span>${rangeK(sel.low, sel.high)}</span></div>
    </section>

    ${lossCard(h, heat, cfg, sel)}
    ${roomsCard(sel, heat, !!h.rooms)}
    ${gasCard(sel, cfg)}
    ${contactCard(cfg)}

    <div class="actions">
      <button type="button" class="btn" data-act="pdf">${ICONS.pdf}Смета PDF</button>
      <button type="button" class="btn" data-act="share">${ICONS.share}Поделиться</button>
      <button type="button" class="btn wide" data-act="edit">${ICONS.edit}Изменить ответы</button>
    </div>
    <p class="disclaimer">Предварительный расчёт по укрупнённой методике: теплопотери через стены, окна, потолок и пол плюс нагрев воздуха для проветривания (СП 50.13330, СП 60.13330), климат — по СП 131.13330.2020. Это не проект и не публичная оферта: точная смета — после осмотра дома.</p>`;
}

export function resultBar(sel) {
  return `
    <div class="sum"><small>${esc(sel.tier.name)}</small><b>${rangeK(sel.low, sel.high)}</b></div>
    <a class="btn primary" href="#contact" data-act="to-contact">Вызвать инженера</a>`;
}

export { ROOM_TYPES };
