// ── Mobile menu ─────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
function closeMobile() { mobileMenu.classList.remove('open'); }

// ── Intersection observer for fade-ins ──────────────────────
function initIntersection() {
  const els = document.querySelectorAll('.fade-in');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}
initIntersection();

// ── Copy email ───────────────────────────────────────────────
function copyEmail() {
  navigator.clipboard.writeText('harshita.chauhan@gmail.com').then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V4C11 2.9 10.1 2 9 2H4C2.9 2 2 2.9 2 4V9C2 10.1 2.9 11 4 11H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Copy email`;
    }, 2500);
  });
}

// ── Nav scroll behaviour ─────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (window.scrollY > 20) {
    nav.style.background = 'rgba(247,245,241,0.96)';
  } else {
    nav.style.background = 'rgba(247,245,241,0.88)';
  }
});

// ── Smooth scroll only for actual same-page section links ────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  if (a.classList.contains('project-card')) return;
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ── Scroll animations ─────────────────────────────────────────
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  function initAnim() {
    document.querySelectorAll('[data-anim]:not(.visible), [data-anim-group]:not(.visible)').forEach(function (el) {
      obs.observe(el);
    });
  }
  initAnim();
})();

// ── If arriving at a page with a #hash already in the URL, scroll to it ──
window.addEventListener('load', () => {
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }
});

// ── Analytics: helper ─────────────────────────────────────────
function trackEvent(name, params) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params || {});
  }
}

// ── Analytics: Resume download clicks ──────────────────────────
// Catches every resume link on the page (nav, mobile menu, footer,
// contact section) since they all use the `download` attribute.
document.querySelectorAll('a[download]').forEach((link) => {
  link.addEventListener('click', () => {
    trackEvent('resume_download', {
      link_location: link.closest('nav') ? 'nav'
        : link.closest('.mobile-menu') ? 'mobile_menu'
        : link.closest('footer') ? 'footer'
        : link.closest('.contact-section') ? 'contact_section'
        : 'other',
      page_path: window.location.pathname
    });
  });
});

// ── Analytics: LinkedIn click ────────────────────────────────────
document.querySelectorAll('a[href*="linkedin.com"]').forEach((link) => {
  link.addEventListener('click', () => {
    trackEvent('linkedin_click', { page_path: window.location.pathname });
  });
});

// ── Analytics: Scroll depth ──────────────────────────────────────
(function () {
  const thresholds = [25, 50, 75, 90, 100];
  const fired = new Set();
  let ticking = false;

  function checkScrollDepth() {
    const scrollTop = window.scrollY;
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    if (docHeight <= winHeight) return; // page too short to scroll meaningfully

    const percent = Math.round(((scrollTop + winHeight) / docHeight) * 100);

    thresholds.forEach((t) => {
      if (percent >= t && !fired.has(t)) {
        fired.add(t);
        trackEvent('scroll_depth', {
          percent_scrolled: t,
          page_path: window.location.pathname
        });
      }
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(checkScrollDepth);
      ticking = true;
    }
  });
})();

// ── Gallery modal (coverflow carousel, looping) ───────────────
(function () {
  const modal = document.getElementById('galleryModal');
  if (!modal) return;

  const nameEl = document.getElementById('galleryModalName');
  const typeEl = document.getElementById('galleryModalType');
  const scrollEl = document.getElementById('galleryModalScroll');
  const closeBtn = document.getElementById('galleryModalClose');
  const arrowLeft = document.getElementById('galleryArrowLeft');
  const arrowRight = document.getElementById('galleryArrowRight');

  let images = [];
  let currentIndex = 0;

  function renderCarousel() {
    scrollEl.innerHTML = images
      .map((src, i) => `<img class="gallery-carousel-item" data-i="${i}" src="${src}" alt="">`)
      .join('');

    scrollEl.querySelectorAll('.gallery-carousel-item').forEach((img) => {
      img.addEventListener('click', () => {
        goTo(parseInt(img.dataset.i, 10));
      });
    });

    updatePositions();
  }

  function updatePositions() {
    const items = scrollEl.querySelectorAll('.gallery-carousel-item');
    const n = items.length;
    if (!n) return;
    const spacing = Math.max(scrollEl.clientWidth * 0.34, 220);

    items.forEach((img, i) => {
      let offset = i - currentIndex;
      if (offset > n / 2) offset -= n;
      if (offset < -n / 2) offset += n;

      const abs = Math.abs(offset);
      let scale, opacity, z;

      if (abs === 0) {
        scale = 1.25; opacity = 1; z = 10;
      } else if (abs === 1) {
        scale = 0.68; opacity = 0.4; z = 5;
      } else {
        scale = 0.5; opacity = 0; z = 1;
      }

      const translateX = offset * spacing;
      img.style.transform = `translate(-50%, -50%) translateX(${translateX}px) scale(${scale})`;
      img.style.opacity = opacity;
      img.style.zIndex = z;
    });
  }

  function goTo(index) {
    const n = images.length;
    currentIndex = ((index % n) + n) % n; // always positive, wraps both directions
    updatePositions();
  }

  function next() { goTo(currentIndex + 1); }
  function prev() { goTo(currentIndex - 1); }

  document.querySelectorAll('.gallery-item:not(.no-action)').forEach((item) => {
  item.addEventListener('click', () => {
    if (item.dataset.link) {
      trackEvent('gallery_card_link_click', { project: item.dataset.name || '' });
      window.open(item.dataset.link, '_blank');
      return;
    }

    images = (item.dataset.images || '').split(',').map(s => s.trim()).filter(Boolean);
    currentIndex = 0;

    nameEl.textContent = item.dataset.name || '';
    typeEl.textContent = item.dataset.type || '';
    renderCarousel();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    trackEvent('gallery_modal_open', { project: nameEl.textContent });
  });
});

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  arrowLeft.addEventListener('click', prev);
  arrowRight.addEventListener('click', next);
  window.addEventListener('resize', updatePositions);
})();

// ── Cursor-follow chip on gallery hover ────────────────────
(function () {
  const cursorEl = document.getElementById('cursorFollow');
  if (!cursorEl) return;

  const cursorTextEl = document.getElementById('cursorFollowText');

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('mouseenter', (e) => {
  cursorTextEl.textContent = item.dataset.cursorText || 'View';
  cursorEl.style.background = item.dataset.cursorBg || '#F5F2EA';
  cursorEl.style.color = item.dataset.cursorColor || '#14120F';
  cursorEl.style.left = e.clientX + 'px';
  cursorEl.style.top = e.clientY + 'px';
  cursorEl.classList.add('visible');
});

    item.addEventListener('mousemove', (e) => {
      cursorEl.style.left = e.clientX + 'px';
      cursorEl.style.top = e.clientY + 'px';
    });

    item.addEventListener('mouseleave', () => {
      cursorEl.classList.remove('visible');
    });
  });
})();