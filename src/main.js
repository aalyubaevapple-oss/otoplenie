// Калькулятор отопления для сайта монтажной компании.
// ?c=<id> — компания (config/<id>.json), ?s=… — сохранённый расчёт, ?embed=1 — без шапки (виджет).
import { encodeState, decodeState } from './state.js';
import { computeHeat, autoRooms, numberRooms, windowsAuto, round05 } from './engine/heat.js';
import { computeAll } from './engine/equipment.js';
import { findWall } from './data/building.js';
import { renderStep, STEPS, WALL_DEFAULT } from './ui/wizard.js';
import { renderResult, resultBar } from './ui/result.js';
import { renderRooms } from './ui/rooms.js';
import { renderPrint } from './ui/print.js';
import { leadText } from './ui/describe.js';
import { ICONS } from './ui/icons.js';
import { esc } from './utils/format.js';
import { initMetrika, goal } from './utils/analytics.js';

const query = new URLSearchParams(location.search);
const embed = query.get('embed') === '1';
const app = document.getElementById('app');
const sheet = document.createElement('div');
document.body.append(sheet);

let cfg;
let h;
let step = 0;
let roomsOpen = false;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RESULT = STEPS.length;

async function loadConfig() {
  const p = query.get('c') || 'demo';
  const id = /^[a-z0-9-]{1,40}$/.test(p) ? p : 'demo';
  const res = await fetch(`config/${id}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`config ${id}: ${res.status}`);
  return res.json();
}

// ---------- расчёт ----------
function compute() {
  const rooms = h.rooms ? numberRooms(h.rooms) : null;
  const heat = computeHeat(h, rooms);
  const tiers = computeAll(cfg, h, heat);
  const sel = tiers.find((t) => t.tier.id === h.tier) || tiers[Math.min(1, tiers.length - 1)];
  return { cfg, h, heat, tiers, sel };
}

// ---------- адрес страницы ----------
function shareUrl() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  if (cfg.id && cfg.id !== 'demo') u.searchParams.set('c', cfg.id);
  u.searchParams.set('s', encodeState(h));
  return u.toString();
}

function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set('s', encodeState(h));
  history.replaceState(history.state, '', u);
}

const stepFromHash = () => {
  const m = location.hash.match(/^#(\d)$/);
  if (location.hash === '#result') return RESULT;
  return m ? clamp(+m[1] - 1, 0, STEPS.length - 1) : 0;
};

function go(n) {
  const hash = n >= RESULT ? '#result' : n > 0 ? `#${n + 1}` : '#1';
  if (location.hash !== hash) location.hash = hash; // запись в историю: кнопка «Назад» телефона возвращает на шаг
  else show(n);
}

function show(n) {
  const changed = n !== step;
  step = n;
  render();
  if (changed) window.scrollTo(0, 0);
  if (n >= RESULT) goal('result');
  else if (n > 0 && changed) goal(`step_${n + 1}`);
}

// ---------- отрисовка ----------
function header() {
  if (embed) return '';
  const c = cfg.contacts || {};
  const letter = esc((cfg.brand || '?').trim()[0]);
  return `
    <header class="top">
      <div class="brand">
        <span class="logo">${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="">` : letter}</span>
        <div><b>${esc(cfg.brand)}${c.demo ? '<span class="demo-badge">демо</span>' : ''}</b><small>${esc(cfg.tagline || '')}</small></div>
      </div>
      ${c.phone ? `<a class="call" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}" data-act="contact" data-ch="phone" aria-label="Позвонить">${ICONS.phone}</a>` : ''}
    </header>`;
}

function render() {
  if (step < RESULT) {
    const last = step === STEPS.length - 1;
    app.innerHTML = `${header()}<main>${renderStep(step, h)}</main>
      <div class="bar-bottom"><div class="in">
        ${step > 0 ? `<button type="button" class="btn" data-act="prev" aria-label="Назад">${ICONS.back}</button>` : ''}
        <button type="button" class="btn primary" data-act="next">${last ? 'Рассчитать отопление' : 'Далее'}</button>
      </div></div>`;
  } else {
    const ctx = compute();
    app.innerHTML = `${header()}<main>${renderResult(ctx)}</main>
      <div class="bar-bottom"><div class="in">${resultBar(ctx.sel)}</div></div>`;
  }
  renderSheet();
}

function renderSheet() {
  if (!roomsOpen || !h.rooms) {
    sheet.innerHTML = '';
    document.body.style.overflow = '';
    return;
  }
  sheet.innerHTML = renderRooms(numberRooms(h.rooms), h.floors !== 1, h.floors === 'attic' ? 'Мансарда' : '2 этаж');
  document.body.style.overflow = 'hidden';
}

// ---------- изменения ----------
const RESET_ROOMS = new Set(['floors', 'baths']);

function set(key, val) {
  if (key === 'wallType') {
    if (findWall(h.wall).wall.id !== val) h.wall = WALL_DEFAULT[val];
  } else {
    h[key] = val;
    if (RESET_ROOMS.has(key)) h.rooms = null;
    if (key === 'tier') goal(`tier_${val}`);
  }
  syncUrl();
  render();
}

function setArea(v, fromInput) {
  if (!Number.isFinite(v)) return;
  h.area = clamp(Math.round(v), 30, 600);
  h.rooms = null;
  syncUrl();
  if (fromInput) {
    // не перерисовываем шаг целиком, чтобы не сбить ползунок под пальцем
    for (const el of app.querySelectorAll('[data-input="area"]')) if (el !== fromInput) el.value = h.area;
  } else render();
}

function editRooms(fn) {
  fn(h.rooms);
  h.rooms = h.rooms.map((r) => ({ type: r.type, level: r.level, area: round05(r.area) }));
  h.area = h.rooms.reduce((s, r) => s + r.area, 0);
  syncUrl();
  render();
}

// ---------- связь ----------
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(text, ms = 3500) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function contact(ch) {
  const c = cfg.contacts || {};
  const { sel, heat } = compute();
  const text = leadText(cfg, h, heat, sel, shareUrl());
  goal(`contact_${ch}`);
  if (c.demo) {
    await copyText(text);
    toast('Это демо: здесь будут телефон и мессенджеры компании. Текст с расчётом уже скопирован', 5000);
    return;
  }
  if (ch === 'phone') location.href = `tel:${String(c.phone).replace(/[^\d+]/g, '')}`;
  else if (ch === 'whatsapp') window.open(`https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  else if (ch === 'telegram') {
    await copyText(text);
    toast('Текст с расчётом скопирован — вставьте его в чат', 5000);
    window.open(`https://t.me/${String(c.telegram).replace(/^@/, '')}`, '_blank', 'noopener');
  } else if (ch === 'email') {
    location.href = `mailto:${c.email}?subject=${encodeURIComponent('Расчёт отопления дома')}&body=${encodeURIComponent(text)}`;
  }
}

async function share() {
  goal('share');
  const url = shareUrl();
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    navigator.share({ title: 'Расчёт отопления дома', url }).catch(() => {});
  } else if (await copyText(url)) toast('Ссылка на расчёт скопирована');
  else prompt('Скопируйте ссылку:', url);
}

function printPdf() {
  goal('pdf');
  const ctx = compute();
  document.getElementById('print').innerHTML = renderPrint({ ...ctx, link: shareUrl() });
  const title = document.title;
  document.title = `Смета на отопление — ${Math.round(ctx.heat.area)} м²`;
  window.print();
  setTimeout(() => (document.title = title), 1000);
}

async function sendLead(form) {
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || String(data.phone || '').replace(/\D/g, '').length < 10) return toast('Укажите имя и телефон');
  if (!data.consent) return toast('Нужно согласие на обработку персональных данных');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const { sel, heat } = compute();
    const res = await fetch(cfg.lead.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: cfg.id, name: data.name, phone: data.phone, text: leadText(cfg, h, heat, sel, shareUrl()), total: Math.round(sel.total) }),
    });
    if (!res.ok) throw new Error(res.status);
    goal('lead_sent');
    form.innerHTML = '<p class="ok">Заявка отправлена. Мы скоро перезвоним.</p>';
  } catch {
    btn.disabled = false;
    toast('Не удалось отправить. Позвоните нам или напишите в мессенджер');
  }
}

// ---------- события ----------
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-set]');
  if (s) return set(s.dataset.set, JSON.parse(s.dataset.val));
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const d = +b.dataset.d || 0;
  const roomIndex = () => +b.closest('[data-i]').dataset.i;
  switch (act) {
    case 'next': return go(step + 1);
    case 'prev': return go(step - 1);
    case 'edit': return go(0);
    case 'area': return setArea(h.area + d);
    case 'windows': {
      const n = (h.windows === 'auto' ? windowsAuto(h.area) : h.windows) + d;
      h.windows = clamp(n, 1, 60);
      syncUrl();
      return render();
    }
    case 'windows-auto':
      h.windows = 'auto';
      syncUrl();
      return render();
    case 'to-contact':
      e.preventDefault();
      return document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    case 'contact':
      e.preventDefault();
      return contact(b.dataset.ch);
    case 'share': return share();
    case 'pdf': return printPdf();
    case 'rooms-open':
      goal('rooms_edit');
      if (!h.rooms) h.rooms = autoRooms(h).map(({ type, level, area }) => ({ type, level, area }));
      roomsOpen = true;
      return renderSheet();
    case 'rooms-close':
      roomsOpen = false;
      return renderSheet();
    case 'rooms-reset':
      h.rooms = null;
      roomsOpen = false;
      syncUrl();
      return render();
    case 'room-add':
      return editRooms((rs) => rs.push({ type: 'bedroom', level: 1, area: 12 }));
    case 'room-del':
      if (h.rooms.length <= 1) return toast('Должна остаться хотя бы одна комната');
      return editRooms((rs) => rs.splice(roomIndex(), 1));
    case 'room-level':
      return editRooms((rs) => (rs[roomIndex()].level = +b.dataset.l));
    case 'room-area':
      return editRooms((rs) => {
        const r = rs[roomIndex()];
        r.area = clamp(r.area + d, 2, 200);
      });
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  // пока человек набирает число, неполные значения («1», «15») пропускаем — проверка на change
  if (el.dataset.input === 'area' && +el.value >= 30 && +el.value <= 600) setArea(+el.value, el);
  if (el.dataset.input === 'windows' && +el.value >= 1) {
    h.windows = clamp(Math.round(+el.value), 1, 60);
    syncUrl();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.input === 'region') set('region', el.value);
  if (el.dataset.input === 'area' && el.type === 'number') setArea(+el.value);
  if (el.dataset.input === 'windows') render();
  if (el.dataset.room === 'type') editRooms((rs) => (rs[+el.closest('[data-i]').dataset.i].type = el.value));
});

document.addEventListener('submit', (e) => {
  if (!e.target.matches('.lead-form')) return;
  e.preventDefault();
  sendLead(e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && roomsOpen) {
    roomsOpen = false;
    renderSheet();
  }
});

window.addEventListener('hashchange', () => show(stepFromHash()));

// ---------- запуск ----------
(async () => {
  if (embed) document.body.classList.add('embed');
  try {
    cfg = await loadConfig();
  } catch (err) {
    app.innerHTML = '<p class="loading">Не удалось загрузить калькулятор. Обновите страницу.</p>';
    throw err;
  }
  if (cfg.accent) document.documentElement.style.setProperty('--accent', cfg.accent);
  document.title = cfg.title || `Расчёт отопления дома — ${cfg.brand}`;
  initMetrika(cfg.metrikaId);
  h = decodeState(query.get('s'), cfg);
  // по ссылке с расчётом сразу показываем результат
  step = query.get('s') && !location.hash ? RESULT : stepFromHash();
  if (step === RESULT && location.hash !== '#result') history.replaceState(null, '', '#result');
  render();
  window.calcReady = true;
})();
