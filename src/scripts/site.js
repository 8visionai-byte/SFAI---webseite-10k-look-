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

const scrambleGlyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+-<>[]';
const scrambleTimers = new WeakMap();
const runScramble = (element) => {
  if (!(element instanceof HTMLElement) || reduced) return;
  const original = element.dataset.scrambleOriginal ?? element.textContent?.trim() ?? '';
  if (!original) return;
  element.dataset.scrambleOriginal = original;
  element.setAttribute('aria-label', original);
  element.setAttribute('aria-live', 'off');
  if (!element.style.minWidth) element.style.minWidth = `${Math.ceil(element.getBoundingClientRect().width)}px`;
  const currentTimer = scrambleTimers.get(element);
  if (currentTimer) window.clearInterval(currentTimer);
  let frame = 0;
  const timer = window.setInterval(() => {
    const resolved = Math.floor(frame / 2);
    element.textContent = [...original].map((character, index) => {
      if (/\s/.test(character) || index < resolved) return character;
      return scrambleGlyphs[Math.floor(Math.random() * scrambleGlyphs.length)];
    }).join('');
    frame += 1;
    if (resolved >= original.length) {
      window.clearInterval(timer);
      element.textContent = original;
      scrambleTimers.delete(element);
    }
  }, 28);
  scrambleTimers.set(element, timer);
};

document.querySelectorAll('[data-scramble]').forEach((element) => {
  const trigger = element.closest('a, button') ?? element;
  trigger.addEventListener('pointerenter', () => runScramble(element));
  trigger.addEventListener('focus', () => runScramble(element));
});

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
  const applyHeroProgress = (value) => {
    const progress = Math.min(1, Math.max(0, value));
    const active = Math.min(heroScenes.length - 1, Math.floor(progress * heroScenes.length));
    heroScenes.forEach((scene, index) => scene.classList.toggle('is-active', index === active));
    hero.dispatchEvent(new CustomEvent('sfai:hero-progress', { detail: { progress } }));
  };

  const mobileHero = window.matchMedia('(max-width: 760px)').matches;
  if (reduced || mobileHero) {
    applyHeroProgress(mobileHero ? 0.55 : 0);
  } else {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => applyHeroProgress(self.progress),
      onRefresh: (self) => applyHeroProgress(self.progress),
    });
    applyHeroProgress(0);
  }
}

if (!reduced) {
  const cinematic = document.querySelector('[data-cinematic]');
  if (cinematic) {
    const curtain = cinematic.querySelector('[data-cinematic-curtain]');
    const frames = [...cinematic.querySelectorAll('[data-cinematic-frame]')];
    const titleLines = cinematic.querySelectorAll('.cinematic-title > span');
    const progressLine = cinematic.querySelector('[data-cinematic-progress]');
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: cinematic,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.85,
      },
    });
    timeline.fromTo(curtain, { xPercent: -101 }, { xPercent: 0, duration: 0.16, ease: 'none' }, 0);
    timeline.fromTo(titleLines, { yPercent: 115 }, { yPercent: 0, stagger: 0.025, duration: 0.16, ease: 'power3.out' }, 0.08);
    frames.forEach((frame, index) => {
      const fromRight = frame.classList.contains('is-right');
      const entry = 0.13 + index * 0.18;
      timeline.fromTo(frame, {
        xPercent: fromRight ? 82 : -82,
        yPercent: 35,
        clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)',
        opacity: 0,
      }, {
        xPercent: 0,
        yPercent: 0,
        clipPath: 'inset(0 0 0 0)',
        opacity: 1,
        duration: 0.19,
        ease: 'power2.out',
      }, entry);
      if (index > 0) {
        timeline.to(frames[index - 1], { yPercent: -52, opacity: 0.22, duration: 0.16, ease: 'none' }, entry + 0.01);
      }
    });
    timeline.to(frames[frames.length - 1], { yPercent: -38, scale: 1.04, duration: 0.18, ease: 'none' }, 0.83);
    timeline.fromTo(progressLine, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left', duration: 1, ease: 'none' }, 0);
  }

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

document.querySelectorAll('[data-image-sequence]').forEach((sequence) => {
  const frames = [...sequence.querySelectorAll('[data-sequence-frame]')];
  const ticks = [...sequence.querySelectorAll('.sequence-ticks i')];
  const label = sequence.querySelector('[data-sequence-label]');
  if (!frames.length) return;
  let index = 0;
  let timer = null;
  const activate = (nextIndex) => {
    index = nextIndex % frames.length;
    frames.forEach((frame, frameIndex) => frame.classList.toggle('is-active', frameIndex === index));
    ticks.forEach((tick, tickIndex) => tick.classList.toggle('is-active', tickIndex === index));
    if (label) label.textContent = frames[index].dataset.label ?? `0${index + 1}`;
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
    sequence.classList.remove('is-running');
    sequence.setAttribute('aria-pressed', 'false');
  };
  const start = () => {
    if (timer || reduced) return;
    sequence.classList.add('is-running');
    sequence.setAttribute('aria-pressed', 'true');
    activate(index + 1);
    timer = window.setInterval(() => activate(index + 1), 230);
  };
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer) {
    sequence.addEventListener('pointerenter', start);
    sequence.addEventListener('pointerleave', stop);
  } else {
    sequence.addEventListener('click', () => {
      if (reduced) activate(index + 1);
      else if (timer) stop();
      else start();
    });
  }
  sequence.addEventListener('focus', () => {
    if (sequence.matches(':focus-visible')) start();
  });
  sequence.addEventListener('blur', stop);
  sequence.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (reduced) activate(index + 1);
    else if (timer) stop();
    else start();
  });
  sequence.addEventListener('pointermove', (event) => {
    const rect = sequence.getBoundingClientRect();
    sequence.style.setProperty('--sequence-x', `${event.clientX - rect.left}px`);
    sequence.style.setProperty('--sequence-y', `${event.clientY - rect.top}px`);
  }, { passive: true });
});

if (window.matchMedia('(pointer: fine)').matches && !reduced) {
  document.querySelectorAll('[data-insight-row]').forEach((row) => {
    const preview = row.querySelector('[data-insight-preview]');
    if (!(preview instanceof HTMLElement)) return;
    preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.45, ease: 'power3' });
    const movePreview = (event) => {
      const bounds = preview.getBoundingClientRect();
      const margin = 18;
      const x = Math.min(innerWidth - bounds.width / 2 - margin, Math.max(bounds.width / 2 + margin, event.clientX));
      const y = Math.min(innerHeight - bounds.height / 2 - margin, Math.max(bounds.height / 2 + margin, event.clientY));
      xTo(x);
      yTo(y);
    };
    row.addEventListener('pointerenter', (event) => {
      preview.classList.add('is-visible');
      movePreview(event);
      runScramble(row.querySelector('[data-scramble]'));
    });
    row.addEventListener('pointermove', (event) => {
      preview.classList.add('is-visible');
      movePreview(event);
    }, { passive: true });
    row.addEventListener('pointerleave', () => preview.classList.remove('is-visible'));
  });
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.insight-preview.is-visible').forEach((preview) => preview.classList.remove('is-visible'));
  }, { passive: true });
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
