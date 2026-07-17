import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const menuPanel = document.querySelector('[data-menu-panel]');
let lastFocused = null;

const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const closeMenu = () => {
  if (!(menuToggle instanceof HTMLButtonElement) || !(menuPanel instanceof HTMLElement)) return;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Otwórz menu');
  menuPanel.setAttribute('aria-hidden', 'true');
  menuPanel.classList.remove('is-open');
  document.body.classList.remove('menu-open');
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
};

const openMenu = () => {
  if (!(menuToggle instanceof HTMLButtonElement) || !(menuPanel instanceof HTMLElement)) return;
  lastFocused = document.activeElement;
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Zamknij menu');
  menuPanel.setAttribute('aria-hidden', 'false');
  menuPanel.classList.add('is-open');
  document.body.classList.add('menu-open');
  window.setTimeout(() => menuPanel.querySelector('a')?.focus(), 420);
};

menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  isOpen ? closeMenu() : openMenu();
});
menuPanel?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  if (event.key !== 'Tab' || !document.body.classList.contains('menu-open') || !(menuPanel instanceof HTMLElement)) return;
  const focusable = [...menuPanel.querySelectorAll('a, button')].filter((element) => !element.hasAttribute('disabled'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));

const storySteps = [...document.querySelectorAll('[data-story-step]')];
if (storySteps.length) {
  const storyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      storySteps.forEach((step) => step.classList.toggle('is-active', step === entry.target));
    });
  }, { rootMargin: '-38% 0px -42% 0px', threshold: 0 });
  storySteps.forEach((step) => storyObserver.observe(step));
  storySteps[0].classList.add('is-active');
}

const hero = document.querySelector('[data-hero]');
const heroScenes = [...document.querySelectorAll('[data-hero-scene]')];
if (hero && heroScenes.length) {
  let ticking = false;
  const setHeroScene = () => {
    const rect = hero.getBoundingClientRect();
    const range = Math.max(1, hero.scrollHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    const active = Math.min(heroScenes.length - 1, Math.floor(progress * heroScenes.length));
    heroScenes.forEach((scene, index) => scene.classList.toggle('is-active', index === active));
    ticking = false;
  };
  heroScenes[0].classList.add('is-active');
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(setHeroScene);
  }, { passive: true });
}

if (!reduced) {
  document.querySelectorAll('.service-card').forEach((card) => {
    gsap.fromTo(card, { y: 80, rotate: card.dataset.accent === 'blue' ? -0.8 : 0.8 }, {
      y: 0,
      rotate: 0,
      ease: 'none',
      scrollTrigger: { trigger: card, start: 'top 100%', end: 'top 72%', scrub: 0.6 },
    });
  });

  const storyImage = document.querySelector('.story-media img');
  if (storyImage) {
    gsap.to(storyImage, {
      scale: 1,
      yPercent: 4,
      ease: 'none',
      scrollTrigger: { trigger: '.system-story', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });
  }

  document.querySelectorAll('.proof-card').forEach((card) => {
    gsap.from(card, {
      clipPath: 'inset(100% 0 0 0)',
      ease: 'power4.out',
      scrollTrigger: { trigger: card, start: 'top 88%', end: 'top 48%', scrub: 0.6 },
    });
  });
}

if (window.matchMedia('(pointer: fine)').matches && !reduced) {
  const cursor = document.querySelector('.cursor-orbit');
  if (cursor instanceof HTMLElement) {
    document.body.classList.add('has-cursor');
    const xTo = gsap.quickTo(cursor, 'x', { duration: .42, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: .42, ease: 'power3' });
    window.addEventListener('pointermove', (event) => {
      xTo(event.clientX - 15);
      yTo(event.clientY - 15);
    }, { passive: true });
    document.querySelectorAll('a, button, summary, input, textarea, select').forEach((element) => {
      element.addEventListener('pointerenter', () => document.body.classList.add('cursor-active'));
      element.addEventListener('pointerleave', () => document.body.classList.remove('cursor-active'));
    });
  }
}

document.querySelectorAll('[data-demo-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-form-status]');
    if (status) status.textContent = 'Dziękujemy. To wersja projektowa — formularz zostanie podłączony na etapie wdrożenia.';
  });
});

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest('a');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin || next.pathname === window.location.pathname) return;
  event.preventDefault();
  document.documentElement.classList.add('is-leaving');
  window.setTimeout(() => { window.location.href = next.href; }, reduced ? 20 : 430);
});

window.addEventListener('pageshow', () => document.documentElement.classList.remove('is-leaving'));
