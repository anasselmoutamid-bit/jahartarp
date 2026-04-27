/* ============================================
   JAHARTA RP — Landing Page Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initScrollReveal();
  initParticles();
});

/* --- Navbar scroll effect --- */
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 60);
        ticking = false;
      });
      ticking = true;
    }
  });
}

/* --- Scroll Reveal (IntersectionObserver) --- */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal, .reveal-stagger');

  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  reveals.forEach((el) => observer.observe(el));
}

/* --- Floating Particles (Canvas) --- */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;
  let width, height;

  function resize() {
    const hero = canvas.parentElement;
    width = canvas.width = hero.offsetWidth;
    height = canvas.height = hero.offsetHeight;
  }

  function createParticles() {
    const count = Math.min(Math.floor((width * height) / 18000), 80);
    particles = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.3,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.2 - 0.1,
        opacity: Math.random() * 0.5 + 0.1,
        // Some particles are cyan, some violet
        color: Math.random() > 0.75 ? '180, 74, 255' : '0, 240, 255',
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.pulse += p.pulseSpeed;

      // Wrap around
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

      // Glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${currentOpacity * 0.15})`;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${currentOpacity})`;
      ctx.fill();
    });

    animationId = requestAnimationFrame(draw);
  }

  // Reduce animation when not visible
  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (!animationId) draw();
      } else {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
    { threshold: 0.1 }
  );

  resize();
  createParticles();
  draw();
  heroObserver.observe(canvas.parentElement);

  // Debounced resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      createParticles();
    }, 200);
  });
}

/* --- Mobile Nav Toggle --- */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (!toggle || !navLinks) return;
  // Skip if already initialized by an inline script
  if (toggle.dataset.navInit) return;
  toggle.dataset.navInit = '1';

  const bd = document.getElementById('nav-backdrop');

  function openNav() {
    navLinks.classList.add('open');
    if (bd) bd.classList.add('open');
    toggle.textContent = '✕';
  }
  function closeNav() {
    navLinks.classList.remove('open');
    if (bd) bd.classList.remove('open');
    toggle.textContent = '☰';
  }

  toggle.addEventListener('click', () => {
    navLinks.classList.contains('open') ? closeNav() : openNav();
  });

  if (bd) bd.addEventListener('click', closeNav);

  // Close on link click
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeNav);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !toggle.contains(e.target)) {
      closeNav();
    }
  });
}

/* --- Page Transition --- managed by page-transition.js */

// Init new features
initMobileNav();
