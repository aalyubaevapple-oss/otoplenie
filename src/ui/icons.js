// Линейные иконки 24×24 (stroke = currentColor).
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  block: svg('<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 12h18M9 6v6M15 12v6"/>'),
  brick: svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M8 5v4.7M16 5v4.7M12 9.7v4.6M8 14.3V19M16 14.3V19"/>'),
  wood: svg('<rect x="3" y="4.5" width="18" height="5" rx="2.5"/><rect x="3" y="9.5" width="18" height="5" rx="2.5"/><rect x="3" y="14.5" width="18" height="5" rx="2.5"/>'),
  frame: svg('<path d="M3 5h18M3 19h18M5 5v14M12 5v14M19 5v14M5 12l7-5M12 17l7-5"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  whatsapp: svg('<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2 2 3.5 4 4l1.2-1.2 2 1-1 1.7c-3.5 0-7-3.5-7-7l1.7-1 1 2z"/>'),
  telegram: svg('<path d="m3 11 17-7-3 16-5-4-3 3v-5l8-7-10 6z"/>'),
  email: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  pdf: svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 14h6M10 17h6"/>'),
  share: svg('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};
