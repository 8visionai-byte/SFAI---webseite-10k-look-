import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, CustomEase);
// Krzywe 1:1 z Azurio — cały „feeling" szablonu siedzi w tych dwóch easach.
CustomEase.create('hop', '.87, 0, .13, 1');
CustomEase.create('common', '.23, .65, .74, 1.09');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compactMotion = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const narrativeScrub = compactMotion ? 0.72 : 1.05;
const galleryScrub = compactMotion ? 0.86 : 1.2;
const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const menuPanel = document.querySelector('[data-menu-panel]');

if (!reduced && !compactMotion) {
  // Konfiguracja 1:1 z Azurio: czyste defaulty Lenis (lerp 0.1, wheelMultiplier 1).
  const lenis = new Lenis({
    anchors: true,
    prevent: (node) => node instanceof Element && Boolean(node.closest('[data-lenis-prevent]')),
  });
  const updateLenis = (time) => lenis.raf(time * 1000);
  const syncLenisState = () => {
    const overlayOpen = document.body.classList.contains('menu-open') || document.body.classList.contains('agent-console-open');
    overlayOpen ? lenis.stop() : lenis.start();
  };
  const overlayObserver = new MutationObserver(syncLenisState);

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(updateLenis);
  gsap.ticker.lagSmoothing(0);
  overlayObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncLenisState();

  const destroyLenis = () => {
    overlayObserver.disconnect();
    gsap.ticker.remove(updateLenis);
    lenis.destroy();
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
  const onPageHide = (event) => event.persisted ? lenis.stop() : destroyLenis();
  const onPageShow = (event) => {
    if (event.persisted) syncLenisState();
  };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
}
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

const revealElements = [...document.querySelectorAll('[data-reveal]')];
if (reduced) {
  revealElements.forEach((element) => element.classList.add('is-visible'));
} else {
  document.documentElement.classList.add('motion-ready');
  ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
  ScrollTrigger.defaults({ invalidateOnRefresh: true });

  const revealDistance = compactMotion ? 22 : 34;
  gsap.set(revealElements, { opacity: 0, y: revealDistance });
  ScrollTrigger.batch(revealElements, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: compactMotion ? 0.6 : 0.75,
      ease: 'common',
      stagger: 0.08,
      overwrite: true,
      onComplete: () => batch.forEach((element) => element.classList.add('is-visible')),
    }),
  });
}

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
  }, 44);
  scrambleTimers.set(element, timer);
};

document.querySelectorAll('[data-scramble]').forEach((element) => {
  const trigger = element.closest('a, button') ?? element;
  trigger.addEventListener('pointerenter', () => runScramble(element));
  trigger.addEventListener('focus', () => runScramble(element));
});

const hoverScrambleFrames = new WeakMap();
const resetHoverScramble = (element) => {
  if (!(element instanceof HTMLElement)) return;
  const activeFrame = hoverScrambleFrames.get(element);
  if (activeFrame) window.cancelAnimationFrame(activeFrame);
  hoverScrambleFrames.delete(element);
  if (element.dataset.hoverScrambleOriginal) element.textContent = element.dataset.hoverScrambleOriginal;
  element.classList.remove('is-hover-scrambling');
  element.style.removeProperty('--hover-scramble-height');
};

const runHoverScramble = (element) => {
  if (!(element instanceof HTMLElement) || reduced || compactMotion) return;
  resetHoverScramble(element);
  const original = element.dataset.hoverScrambleOriginal ?? element.textContent ?? '';
  if (!original.trim()) return;
  element.dataset.hoverScrambleOriginal = original;
  element.setAttribute('aria-label', original.trim());
  element.setAttribute('aria-live', 'off');
  element.style.setProperty('--hover-scramble-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
  element.classList.add('is-hover-scrambling');

  const characters = [...original];
  const duration = element.matches('p') ? 1120 : 980;
  let startTime = null;
  const animate = (time) => {
    if (startTime === null) startTime = time;
    const progress = Math.min(1, (time - startTime) / duration);
    const revealEdge = Math.floor(progress * (characters.length + 2));
    element.textContent = characters.map((character, index) => {
      if (/\s/u.test(character) || !/[\p{L}\d]/u.test(character) || index < revealEdge) return character;
      return scrambleGlyphs[Math.floor(Math.random() * scrambleGlyphs.length)];
    }).join('');

    if (progress < 1) {
      hoverScrambleFrames.set(element, window.requestAnimationFrame(animate));
      return;
    }
    element.textContent = original;
    hoverScrambleFrames.delete(element);
    element.classList.remove('is-hover-scrambling');
    element.style.removeProperty('--hover-scramble-height');
  };

  hoverScrambleFrames.set(element, window.requestAnimationFrame(animate));
};

document.querySelectorAll('[data-hover-scramble-group]').forEach((group) => {
  const targets = [...group.querySelectorAll('[data-hover-scramble]')];
  const play = () => targets.forEach((target, index) => {
    window.setTimeout(() => {
      if (group.matches(':hover')) runHoverScramble(target);
    }, index * 70);
  });
  const reset = () => targets.forEach(resetHoverScramble);
  group.addEventListener('pointerenter', play);
  group.addEventListener('pointerleave', reset);
  group.addEventListener('pointercancel', reset);
  group.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node) || !group.contains(event.relatedTarget)) reset();
  });
});

const processScrambleFrames = new WeakMap();
const processUpperGlyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZĄĆĘŁŃÓŚŹŻ';
const processLowerGlyphs = 'abcdefghijklmnopqrstuvwxyząćęłńóśźż';
const processNumberGlyphs = '0123456789';
const processGlyphFor = (character, characterIndex, tick) => {
  if (/\d/u.test(character)) return processNumberGlyphs[(characterIndex * 7 + tick * 5) % processNumberGlyphs.length];
  if (!/\p{L}/u.test(character)) return character;
  const pool = character === character.toLocaleLowerCase('pl-PL') ? processLowerGlyphs : processUpperGlyphs;
  return pool[(characterIndex * 13 + tick * 7) % pool.length];
};

const runProcessScramble = (row, element) => {
  if (!(row instanceof HTMLElement) || !(element instanceof HTMLElement) || reduced) return;
  const original = element.dataset.processScrambleOriginal ?? element.textContent ?? '';
  if (!original.trim()) return;
  element.dataset.processScrambleOriginal = original;

  const activeFrame = processScrambleFrames.get(element);
  if (activeFrame) window.cancelAnimationFrame(activeFrame);

  const characters = [...original];
  const duration = 1180;
  let startTime = null;
  row.classList.add('is-scrambling');

  const animate = (time) => {
    if (startTime === null) startTime = time;
    const elapsed = time - startTime;
    const progress = Math.min(1, elapsed / duration);
    const tick = Math.floor(elapsed / 38);
    const revealEdge = progress * (characters.length + 3.6) - 2.1;

    element.textContent = characters.map((character, index) => {
      if (/\s/u.test(character) || !/[\p{L}\d]/u.test(character)) return character;
      return index <= revealEdge ? character : processGlyphFor(character, index, tick);
    }).join('');

    if (progress < 1) {
      processScrambleFrames.set(element, window.requestAnimationFrame(animate));
      return;
    }

    element.textContent = original;
    processScrambleFrames.delete(element);
    window.setTimeout(() => row.classList.remove('is-scrambling'), 120);
  };

  processScrambleFrames.set(element, window.requestAnimationFrame(animate));
};

const processRows = [...document.querySelectorAll('[data-process-row]')];
if (processRows.length && !reduced) {
  const processObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const row = entry.target;
      const title = row.querySelector('[data-process-scramble]');
      const rowIndex = Math.max(0, processRows.indexOf(row));
      window.setTimeout(() => runProcessScramble(row, title), rowIndex * 80);
      processObserver.unobserve(row);
    });
  }, { threshold: 0.52, rootMargin: '0px 0px -8% 0px' });

  processRows.forEach((row) => {
    const title = row.querySelector('[data-process-scramble]');
    if (!(title instanceof HTMLElement)) return;
    processObserver.observe(row);
    row.addEventListener('pointerenter', () => runProcessScramble(row, title));
    row.addEventListener('focusin', () => runProcessScramble(row, title));
  });
}

document.querySelectorAll('[data-voice-trigger]').forEach((trigger) => {
  if (!(trigger instanceof HTMLButtonElement) || trigger.dataset.voiceBound) return;
  const core = trigger.closest('[data-flow-core]');
  const panelId = trigger.getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!(core instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
  trigger.dataset.voiceBound = 'true';

  const setOpen = (open) => {
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    core.classList.toggle('is-voice-open', open);
  };

  trigger.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || trigger.getAttribute('aria-expanded') !== 'true') return;
    setOpen(false);
    trigger.focus();
  });
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
if (hero) {
  const applyHeroProgress = (value) => {
    const progress = Math.min(1, Math.max(0, value));
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

    const heroCopy = hero.querySelector('.hero-copy');
    const heroVisual = hero.querySelector('.flow-core');
    const heroBottom = hero.querySelector('.hero-bottom');
    const heroSide = hero.querySelector('.hero-side-list');
    const exitTargets = [heroCopy, heroBottom, heroSide].filter(Boolean);
    const heroExit = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom bottom',
        scrub: narrativeScrub,
      },
    });
    heroExit.to(exitTargets, {
      y: -24,
      opacity: 0.08,
      filter: 'blur(5px)',
      stagger: 0.025,
      duration: 0.34,
      ease: 'none',
    }, 0.56);
    if (heroVisual) {
      heroExit.to(heroVisual, {
        yPercent: -3,
        scale: 0.96,
        opacity: 0.2,
        filter: 'blur(3px)',
        duration: 0.4,
        ease: 'none',
      }, 0.5);
    }
    applyHeroProgress(0);
  }
}

if (!reduced) {
  const manifesto = document.querySelector('[data-manifesto]');
  if (manifesto) {
    const lines = [...manifesto.querySelectorAll('[data-manifesto-line]')];
    const signalRows = [...manifesto.querySelectorAll('.manifesto-signals li')];
    const signalRules = [...manifesto.querySelectorAll('.manifesto-signals i')];
    const copy = [...manifesto.querySelectorAll('[data-manifesto-copy] p')];
    const scrambleLabels = [...manifesto.querySelectorAll('[data-scramble]')];
    const scrambleManifestoLabels = () => scrambleLabels.forEach((label, index) => {
      window.setTimeout(() => runScramble(label), index * 76);
    });
    const manifestoTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: manifesto,
        start: 'clamp(top 82%)',
        end: 'clamp(center 42%)',
        scrub: narrativeScrub,
        onEnter: scrambleManifestoLabels,
        onEnterBack: scrambleManifestoLabels,
      },
    });
    // Azurio "reveal-type": nagłówek cięty na znaki, wyostrza się z mgły scrollem (scrub 2).
    const manifestoChars = [];
    const splitToChars = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((chunk) => {
            if (!chunk) return;
            if (/^\s+$/.test(chunk)) {
              fragment.append(chunk);
              return;
            }
            const word = document.createElement('span');
            word.className = 'mword';
            [...chunk].forEach((character) => {
              const glyph = document.createElement('span');
              glyph.className = 'mchar';
              glyph.textContent = character;
              word.append(glyph);
              manifestoChars.push(glyph);
            });
            fragment.append(word);
          });
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          splitToChars(child);
        }
      });
    };
    lines.forEach(splitToChars);
    if (manifestoChars.length) {
      gsap.from(manifestoChars, {
        opacity: 0,
        filter: 'blur(10px)',
        stagger: 0.05,
        ease: 'none',
        scrollTrigger: {
          trigger: manifesto,
          start: 'top 88%',
          end: 'center 44%',
          scrub: 2,
        },
      });
    }
    manifestoTimeline.fromTo(signalRows, {
      opacity: 0,
      y: 15,
    }, {
      opacity: 1,
      y: 0,
      stagger: 0.045,
      duration: 0.24,
      ease: 'none',
    }, 0.28);
    manifestoTimeline.to(signalRules, {
      scaleX: 1,
      stagger: 0.04,
      duration: 0.22,
      ease: 'none',
    }, 0.31);
    manifestoTimeline.fromTo(copy, {
      opacity: 0,
      y: 18,
      filter: 'blur(5px)',
    }, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      stagger: 0.06,
      duration: 0.28,
      ease: 'none',
    }, 0.42);
  }

  const humanBridge = document.querySelector('[data-human-bridge]');
  if (humanBridge) {
    const media = humanBridge.querySelector('[data-human-bridge-media]');
    if (media) {
      gsap.fromTo(media, { scale: 1.055, yPercent: 2.6 }, {
        scale: 1,
        yPercent: -2.6,
        ease: 'none',
        scrollTrigger: {
          trigger: humanBridge,
          start: 'clamp(top bottom)',
          end: 'clamp(bottom top)',
          scrub: narrativeScrub,
        },
      });
    }

    const bridgeLines = [...humanBridge.querySelectorAll('[data-hb-line]')];
    const bridgeKicker = humanBridge.querySelector('[data-hb-kicker]');
    if (bridgeLines.length) {
      gsap.set(bridgeLines, { yPercent: 118, opacity: 0, filter: 'blur(6px)' });
      if (bridgeKicker) gsap.set(bridgeKicker, { opacity: 0, y: 14 });
      const showBridge = () => {
        if (bridgeKicker) gsap.to(bridgeKicker, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', overwrite: true });
        gsap.to(bridgeLines, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.05, ease: 'power3.out', stagger: 0.14, overwrite: true });
      };
      const hideBridge = () => {
        if (bridgeKicker) gsap.to(bridgeKicker, { opacity: 0, y: 14, duration: 0.4, ease: 'power2.in', overwrite: true });
        gsap.to(bridgeLines, { yPercent: 118, opacity: 0, filter: 'blur(6px)', duration: 0.5, ease: 'power2.in', stagger: 0.06, overwrite: true });
      };
      ScrollTrigger.create({
        trigger: humanBridge,
        start: 'top -32%',
        onEnter: showBridge,
        onLeaveBack: hideBridge,
      });
    }
  }

  const cinematic = document.querySelector('[data-cinematic]');
  if (cinematic) {
    const frames = [...cinematic.querySelectorAll('[data-cinematic-frame]')];
    const titleLines = cinematic.querySelectorAll('[data-cinematic-line]');
    const progressLine = cinematic.querySelector('[data-cinematic-progress]');
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: cinematic,
        start: 'clamp(top top)',
        end: 'clamp(bottom bottom)',
        scrub: galleryScrub,
      },
    });
    gsap.set(titleLines, { yPercent: 120, opacity: 0, filter: 'blur(8px)' });
    ScrollTrigger.create({
      trigger: cinematic,
      start: 'top 62%',
      once: true,
      onEnter: () => gsap.to(titleLines, {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.16,
      }),
    });

    frames.forEach((frame, index) => {
      const bitmap = frame.querySelector('img');
      const entry = 0.36 + index * 0.15;

      gsap.set(frame, { '--sfai-curtain': 0 });
      timeline.fromTo(frame, {
        opacity: 0,
        scale: 1.07,
        yPercent: index % 2 === 0 ? 3.5 : -3.5,
        filter: 'blur(18px)',
      }, {
        opacity: 0.97,
        scale: 1,
        yPercent: 0,
        filter: 'blur(0px)',
        duration: 0.2,
        ease: 'power2.out',
      }, entry);

      if (bitmap) {
        timeline.fromTo(bitmap, {
          scale: 1.08,
          filter: 'grayscale(.5) sepia(.1) contrast(.98) brightness(.82)',
        }, {
          scale: 1,
          filter: 'grayscale(.28) sepia(.06) contrast(1.08) brightness(1)',
          duration: 0.24,
          ease: 'power2.out',
        }, entry);
      }

      timeline.to(frame, {
        opacity: 0,
        scale: 0.99,
        filter: 'blur(12px)',
        duration: 0.16,
        ease: 'power1.in',
      }, entry + 0.32);
    });
    timeline.fromTo(progressLine, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left', duration: 1.02, ease: 'none' }, 0);
  }

  const fogStatement = document.querySelector('[data-fog-statement]');
  if (fogStatement) {
    const fogImages = [...fogStatement.querySelectorAll('[data-fog-image]')];
    const fogLines = fogStatement.querySelectorAll('[data-fog-line]');
    const fogNote = fogStatement.querySelector('[data-fog-note]');
    const fogVeil = fogStatement.querySelector('[data-fog-veil]');
    // Choreografia mgły (inaczej niż cinematic, gdzie zdjęcia tylko ostrzeją w miejscu):
    // 1) najpierw wyostrza się NAPIS, 2) każde zdjęcie wychodzi z pełnego rozmycia
    // i przez cały pobyt na ekranie DRYFUJE własnym wektorem, 3) gaśnie z powrotem w blur.
    // Scrub + ease 'none' = w pełni odwracalne przy scrollu w górę.
    const fogBlurMax = compactMotion ? 9 : 14;
    const fogDriftScale = compactMotion ? 0.55 : 1;
    const fogFoggy = `brightness(.55) contrast(.9) saturate(.4) blur(${fogBlurMax}px)`;
    const fogSharp = 'brightness(.82) contrast(1.06) saturate(.56) blur(0px)';
    const fogDrifts = [
      { xPercent: 22, yPercent: -3, fromScale: 1, toScale: 1.045 },    // background: w prawo
      { xPercent: -24, yPercent: 4, fromScale: 1.02, toScale: 0.975 }, // subject: w lewo
      { xPercent: 30, yPercent: -26, fromScale: 0.97, toScale: 1.05 }, // accent: w górny prawy róg
      { xPercent: -26, yPercent: 14, fromScale: 1.01, toScale: 1.06 }, // foreground: w dolny lewy róg
    ];
    const fogOpacities = [0.46, 0.8, 0.66, 0.55];
    const fogTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: fogStatement,
        start: 'clamp(top top)',
        end: 'clamp(bottom bottom)',
        scrub: galleryScrub,
      },
    });

    fogTimeline.fromTo(fogLines, {
      opacity: 0.02,
      scale: 1.016,
      filter: `blur(${compactMotion ? 8 : 12}px)`,
    }, {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      stagger: 0.05,
      duration: 0.2,
      ease: 'none',
    }, 0.02);
    fogTimeline.fromTo(fogNote, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'none' }, 0.16);
    fogTimeline.fromTo(fogVeil, { opacity: 0.98 }, { opacity: 0.3, duration: 0.5, ease: 'none' }, 0.04);
    fogTimeline.to(fogVeil, { opacity: 0.78, duration: 0.18, ease: 'none' }, 0.82);

    fogImages.forEach((image, index) => {
      const bitmap = image.querySelector('img');
      const drift = fogDrifts[index] ?? fogDrifts[0];
      const entry = 0.26 + index * 0.08;
      const exit = 0.8 + index * 0.02;
      const finalOpacity = fogOpacities[index] ?? 0.6;

      fogTimeline.fromTo(image, { opacity: 0 }, {
        opacity: finalOpacity,
        duration: 0.13,
        ease: 'none',
      }, entry);
      fogTimeline.fromTo(image, {
        xPercent: 0,
        yPercent: 0,
        scale: drift.fromScale,
      }, {
        xPercent: drift.xPercent * fogDriftScale,
        yPercent: drift.yPercent * fogDriftScale,
        scale: drift.toScale,
        duration: exit + 0.14 - entry,
        ease: 'none',
      }, entry);
      if (bitmap) {
        fogTimeline.fromTo(bitmap, { filter: fogFoggy }, {
          filter: fogSharp,
          duration: 0.16,
          ease: 'none',
        }, entry);
        fogTimeline.to(bitmap, { filter: fogFoggy, duration: 0.14, ease: 'none' }, exit);
      }
      fogTimeline.to(image, { opacity: 0, duration: 0.14, ease: 'none' }, exit);
    });
  }

  const systemExplore = document.querySelector('[data-system-explore]');
  if (systemExplore) {
    const items = [...systemExplore.querySelectorAll('[data-explore-item]')];
    const lines = systemExplore.querySelectorAll('[data-explore-line]');
    const note = systemExplore.querySelector('.system-explore__note');
    const exploreTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: systemExplore,
        start: 'clamp(top top)',
        end: 'clamp(bottom bottom)',
        scrub: galleryScrub,
        onUpdate: (self) => systemExplore.style.setProperty('--explore-progress', self.progress.toFixed(3)),
      },
    });
    exploreTimeline.fromTo(lines, {
      xPercent: -64,
      opacity: 0,
    }, {
      xPercent: 0,
      opacity: 1,
      stagger: 0.055,
      duration: 0.26,
      ease: 'none',
    }, 0.02);
    exploreTimeline.fromTo(note, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.24, ease: 'none' }, 0.16);

    items.forEach((item, index) => {
      const image = item.querySelector('.system-explore__image');
      const bitmap = item.querySelector('img');
      const entry = 0.045 + index * 0.145;

      exploreTimeline.fromTo(item, {
        xPercent: compactMotion ? 28 : 38,
        yPercent: index % 2 === 0 ? -2 : 2.5,
        rotate: 0.8,
        opacity: 0,
      }, {
        xPercent: compactMotion ? 5 : 7,
        yPercent: 0,
        rotate: 0.15,
        opacity: 0.94,
        duration: 0.15,
        ease: 'none',
      }, entry);
      if (image) exploreTimeline.fromTo(image, { '--sfai-curtain': 1 }, { '--sfai-curtain': 0, duration: 0.15, ease: 'none' }, entry);

      if (bitmap) {
        exploreTimeline.fromTo(bitmap, {
          scale: 1.028,
          filter: 'brightness(.7) contrast(.96) saturate(.28) grayscale(.62)',
        }, {
          filter: 'brightness(1) contrast(1.08) saturate(.82) grayscale(.05)',
          scale: 1.006,
          duration: 0.18,
          ease: 'none',
        }, entry);
      }
      exploreTimeline.to(item, {
        xPercent: 0,
        rotate: 0,
        opacity: 1,
        duration: 0.11,
        ease: 'none',
      }, entry + 0.14);
      if (bitmap) exploreTimeline.to(bitmap, { scale: 1, duration: 0.1, ease: 'none' }, entry + 0.17);
      exploreTimeline.to(item, {
        xPercent: compactMotion ? -18 : -25,
        yPercent: index % 2 === 0 ? 1.5 : -1.5,
        rotate: -0.55,
        opacity: 0,
        duration: 0.17,
        ease: 'none',
      }, entry + 0.26);
    });
  }

  const reelHeading = document.querySelector('[data-reel-heading]');
  if (reelHeading) {
    const lines = reelHeading.querySelectorAll('[data-reel-heading-line]');
    gsap.fromTo(lines, {
      yPercent: 108,
      opacity: 0,
      filter: 'blur(8px)',
    }, {
      yPercent: 0,
      opacity: 1,
      filter: 'blur(0px)',
      stagger: 0.09,
      duration: 0.95,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: reelHeading,
        start: 'top 82%',
        toggleActions: 'play none none none',
      },
    });
  }

  document.querySelectorAll('.service-card').forEach((card) => {
    gsap.fromTo(card, { y: compactMotion ? 28 : 46, rotate: card.dataset.accent === 'blue' ? -0.35 : 0.35 }, {
      y: 0,
      rotate: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none none' },
    });
  });

  const storyImage = document.querySelector('.story-media img');
  if (storyImage) {
    gsap.to(storyImage, {
      scale: 1,
      yPercent: 4,
      ease: 'none',
      scrollTrigger: { trigger: '.system-story', start: 'clamp(top bottom)', end: 'clamp(bottom top)', scrub: narrativeScrub },
    });
  }

  const proofExplore = document.querySelector('[data-proof-explore]');
  if (proofExplore) {
    const title = proofExplore.querySelector('[data-proof-title]');
    const lines = [...proofExplore.querySelectorAll('[data-proof-line]')];
    const kicker = proofExplore.querySelector('[data-proof-kicker]');
    const imgs = [...proofExplore.querySelectorAll('[data-proof-img]')];

    gsap.set(lines, { opacity: 0, yPercent: 60, filter: 'blur(16px)' });
    if (kicker) gsap.set(kicker, { opacity: 0 });

    const proofTl = gsap.timeline({
      scrollTrigger: { trigger: proofExplore, start: 'top top', end: 'bottom bottom', scrub: galleryScrub },
    });
    if (kicker) proofTl.to(kicker, { opacity: 1, duration: 0.05, ease: 'none' }, 0.02);
    proofTl.to(lines, { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: 0.05, duration: 0.16, ease: 'none' }, 0.03);
    proofTl.to(title, { yPercent: -12, duration: 0.2, ease: 'none' }, 0.24);
    proofTl.to(title, { yPercent: 0, duration: 0.2, ease: 'none' }, 0.72);

    imgs.forEach((img, index) => {
      const at = 0.16 + index * 0.135;
      proofTl.fromTo(img,
        { clipPath: 'inset(50% 0% 50% 0%)', opacity: 0, yPercent: 10, filter: 'blur(10px)' },
        { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.12, ease: 'none' }, at);
      proofTl.to(img, { yPercent: -10, duration: 0.14, ease: 'none' }, at + 0.12);
      proofTl.to(img, { opacity: 0, filter: 'blur(8px)', duration: 0.1, ease: 'none' }, at + 0.22);
    });
  }
}

if (!reduced) {
  const refreshMotion = () => window.requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener('load', refreshMotion, { once: true });
  document.fonts?.ready.then(refreshMotion);
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

// Karuzela usług: NIE zatrzymuje się na hover — pauza tylko na klik (klik w kartę = nawigacja).
document.querySelectorAll('[data-services-reel]').forEach((reel) => {
  reel.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    reel.classList.toggle('is-paused');
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
