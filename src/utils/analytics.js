// Яндекс Метрика: подключается, только если в конфигурации производителя указан metrikaId.
// Цели: step_2…step_4, result, tier_<id>, rooms_edit, pdf, share, contact_<канал>, lead_sent.
let counter = null;

export function initMetrika(id) {
  if (!id || !/^\d{5,12}$/.test(String(id))) return;
  counter = +id;
  /* eslint-disable */
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
  /* eslint-enable */
  window.ym(counter, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
}

export function goal(name, params) {
  if (counter && window.ym) window.ym(counter, 'reachGoal', name, params);
}
