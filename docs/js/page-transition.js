/* page-transition.js — Smooth fade in/out entre les pages */
(function () {
  var overlay = document.getElementById('page-transition');
  if (!overlay) return;

  // ── Fade IN à l'arrivée sur la page ──────────────────────────
  function fadeIn() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('hidden');
      });
    });
  }

  if (document.readyState === 'complete') {
    fadeIn();
  } else {
    window.addEventListener('load', fadeIn);
    setTimeout(fadeIn, 1800); // fallback
  }

  // ── Fade OUT au clic sur un lien interne ──────────────────────
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('http') ||
      href.startsWith('mailto') ||
      href.startsWith('javascript') ||
      link.target === '_blank'
    ) return;
    var current = window.location.pathname.split('/').pop() || 'index.html';
    if (href === current) return;
    e.preventDefault();
    overlay.classList.remove('hidden');
    setTimeout(function () { window.location.href = href; }, 420);
  });
})();
