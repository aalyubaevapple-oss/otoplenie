// Редактор комнат (нижняя шторка): тип, этаж, площадь, удалить, добавить.
import { ROOM_TYPES } from '../engine/heat.js';
import { esc, num } from '../utils/format.js';
import { ICONS } from './icons.js';

export function renderRooms(rooms, twoLevels, atticName) {
  const row = (r, i) => `
    <div class="room-row" data-i="${i}">
      <select data-room="type" aria-label="Тип комнаты">
        ${Object.entries(ROOM_TYPES).map(([id, t]) => `<option value="${id}"${id === r.type ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
      <button type="button" class="del" data-act="room-del" aria-label="Удалить комнату">${ICONS.close}</button>
      <div class="lv">${twoLevels ? [1, 2].map((l) => `<button type="button" class="chip${r.level === l ? ' on' : ''}" data-act="room-level" data-l="${l}">${l === 1 ? '1 этаж' : atticName}</button>`).join('') : ''}</div>
      <div class="ctl">
        <button type="button" class="round" data-act="room-area" data-d="-1" aria-label="Меньше">−</button>
        <span class="val">${num(r.area)} м²</span>
        <button type="button" class="round" data-act="room-area" data-d="1" aria-label="Больше">+</button>
      </div>
    </div>`;
  const total = rooms.reduce((s, r) => s + r.area, 0);
  return `
    <div class="sheet-bg" data-act="rooms-close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Комнаты">
      <header><b>Комнаты · ${num(total)} м²</b><button type="button" class="btn small primary" data-act="rooms-close">Готово</button></header>
      ${rooms.map(row).join('')}
      <div class="foot">
        <button type="button" class="btn" data-act="room-add">${ICONS.plus}Добавить комнату</button>
        <button type="button" class="btn ghost" data-act="rooms-reset">Вернуть типовую планировку</button>
      </div>
    </div>`;
}
