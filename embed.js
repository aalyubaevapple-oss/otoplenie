/*
 * Калькулятор отопления на сайте монтажной компании.
 * Вставка на страницу:
 *   <script src="https://АДРЕС-КАЛЬКУЛЯТОРА/embed.js" data-c="demo" data-height="820"></script>
 * data-c — id компании (файл config/<id>.json), data-height — высота блока.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var base = s.src.replace(/embed\.js(\?.*)?$/, '');
  var c = (s.getAttribute('data-c') || 'demo').replace(/[^a-z0-9-]/gi, '');
  var h = parseInt(s.getAttribute('data-height'), 10) || 820;
  var f = document.createElement('iframe');
  f.src = base + '?c=' + encodeURIComponent(c) + '&embed=1';
  f.title = 'Расчёт отопления дома';
  f.loading = 'lazy';
  f.allow = 'clipboard-write; web-share';
  f.style.cssText = 'display:block;width:100%;max-width:680px;margin:0 auto;height:' + h + 'px;max-height:92vh;border:0;border-radius:14px;box-shadow:0 2px 16px rgba(0,0,0,.08)';
  s.parentNode.insertBefore(f, s);
})();
