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
// GLOBALNA zasada scramble (dyktando Pawła): dekodowanie napisów odpala się WYŁĄCZNIE
// z hovera na precyzyjnym wskaźniku. Dotyk/mobile = napisy statyczne (zero skakania strony).
const scrambleAllowed = !reduced && !compactMotion && window.matchMedia('(pointer: fine)').matches;
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

  // Mgła u dołu ekranu: NIE zasłania hero (CTA musi być ostre) — włącza się po zjechaniu z pierwszej karty.
  const mistVeil = document.querySelector('.mist-veil');
  if (mistVeil) {
    const heroSection = document.querySelector('.home-hero');
    if (heroSection) {
      ScrollTrigger.create({
        trigger: heroSection,
        start: 'bottom 18%',
        onEnter: () => mistVeil.classList.add('is-on'),
        onLeaveBack: () => mistVeil.classList.remove('is-on'),
      });
    } else {
      mistVeil.classList.add('is-on');
    }
  }
}

const scrambleGlyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+-<>[]';
const scrambleTimers = new WeakMap();
// Zamrożenie layoutu na czas dekodowania: losowe znaki mają różne szerokości, więc bez
// blokady zmieniało się łamanie linii, a z nim wysokość elementu — cała strona "skakała"
// (najbardziej na mobile). Inline height + overflow:clip = offsetHeight stały co do piksela;
// po zakończeniu przebiegu obie właściwości schodzą i element wraca do naturalnego flow.
const freezeScrambleLayout = (element) => {
  element.style.height = `${element.offsetHeight}px`;
  element.style.overflow = 'clip';
};
const releaseScrambleLayout = (element) => {
  element.style.removeProperty('height');
  element.style.removeProperty('overflow');
};
const runScramble = (element) => {
  if (!(element instanceof HTMLElement) || !scrambleAllowed) return;
  // Retrigger dozwolony dopiero PO zakończeniu bieżącego przebiegu — machanie myszą nie sieka.
  if (scrambleTimers.has(element)) return;
  const original = element.dataset.scrambleOriginal ?? element.textContent?.trim() ?? '';
  if (!original) return;
  element.dataset.scrambleOriginal = original;
  element.setAttribute('aria-label', original);
  element.setAttribute('aria-live', 'off');
  if (!element.style.minWidth) element.style.minWidth = `${Math.ceil(element.getBoundingClientRect().width)}px`;
  freezeScrambleLayout(element);
  let frame = 0;
  // Dłuższe teksty składają się szybciej na znak, żeby całość trwała podobnie (~3,5 s max).
  const rate = Math.max(1, original.length / 95);
  const timer = window.setInterval(() => {
    const resolved = Math.floor((frame * rate) / 2);
    element.textContent = [...original].map((character, index) => {
      if (/\s/.test(character) || index < resolved) return character;
      return scrambleGlyphs[Math.floor(Math.random() * scrambleGlyphs.length)];
    }).join('');
    frame += 1;
    if (resolved >= original.length) {
      window.clearInterval(timer);
      element.textContent = original;
      scrambleTimers.delete(element);
      releaseScrambleLayout(element);
    }
  }, 56);
  scrambleTimers.set(element, timer);
};

document.querySelectorAll('[data-scramble]').forEach((element) => {
  const trigger = element.closest('a, button') ?? element;
  trigger.addEventListener('pointerenter', () => runScramble(element));
  trigger.addEventListener('focus', () => runScramble(element));
});

// Etykiety „01 / Znajdź stratę" i podpisy kafli system-explore: dekodowanie na hover CAŁEGO
// wiersza/kafla (sam napis to za mały cel dla myszy), zawsze z powrotem do poprawnej formy.
document.querySelectorAll('.manifesto-signals li, [data-explore-item]').forEach((row) => {
  const label = row.querySelector('[data-scramble]');
  if (label) row.addEventListener('pointerenter', () => runScramble(label));
});

// Hero „AI, które dowozi.": najazd kursorem rozkodowuje litery i szybko składa je z powrotem.
// Retrigger dopiero po zakończeniu bieżącego przebiegu — bez sieczki przy machaniu myszą.
// (Auto-dekodowanie hero-intro po 650 ms USUNIĘTE — scramble działa wyłącznie z hovera.)
const heroTitle = document.querySelector('.hero-title');
if (heroTitle && scrambleAllowed) {
  // Linia 2 dekoduje się na <em> (outline), żeby nie zgubić stylowania konturu.
  const heroTargets = [...heroTitle.querySelectorAll('.line > span')]
    .map((line) => line.querySelector('em') ?? line);
  let heroQueued = 0;
  heroTitle.addEventListener('pointerenter', () => {
    if (heroQueued > 0 || heroTargets.some((target) => scrambleTimers.has(target))) return;
    heroTargets.forEach((target, index) => {
      heroQueued += 1;
      window.setTimeout(() => {
        heroQueued -= 1;
        runScramble(target);
      }, index * 90);
    });
  });
}

// Marquee usług: pętla BEZSZWOWA. Dotąd tor (2 kopie treści w HTML) bywał węższy niż okno
// na szerokich monitorach — zanim keyframe przewinął połowę, w kadr wjeżdżał pusty fragment
// i „przerwany ciąg" (dyktando pkt 3). Tu: kopie doklejane aż tor ma >= 2x szerokości okna
// + jedna kopia zapasu (przy KAŻDEJ szerokości viewportu), a przesuw liczony modulo szerokości
// jednej kopii (gsap.utils.wrap) — nigdy pusty kadr, nigdy skok. Tempo bez zmian: kopia / 34 s.
const marqueeBand = document.querySelector('.marquee-band');
const marqueeTrack = marqueeBand?.querySelector('.marquee-track');
if (marqueeBand && marqueeTrack instanceof HTMLElement && !reduced && marqueeTrack.children.length > 1) {
  const baseCount = Math.max(1, Math.floor(marqueeTrack.children.length / 2)); // HTML niesie 2 kopie (fallback CSS)
  const baseSpans = [...marqueeTrack.children].slice(0, baseCount);
  const copyWidth = () => marqueeTrack.scrollWidth * (baseCount / marqueeTrack.children.length);
  const ensureCoverage = () => {
    let guard = 0;
    while (marqueeTrack.scrollWidth < window.innerWidth * 2 + copyWidth() && guard < 12) {
      baseSpans.forEach((span) => {
        const clone = span.cloneNode(true);
        if (clone instanceof Element) clone.setAttribute('aria-hidden', 'true');
        marqueeTrack.append(clone);
      });
      guard += 1;
    }
  };
  ensureCoverage();
  marqueeTrack.classList.add('is-wrapped'); // CSS gasi keyframes — ruch przejmuje ticker
  let marqueeUnit = copyWidth();
  let marqueeWrap = gsap.utils.wrap(-marqueeUnit, 0);
  window.addEventListener('resize', () => {
    ensureCoverage();
    marqueeUnit = copyWidth();
    marqueeWrap = gsap.utils.wrap(-marqueeUnit, 0);
  }, { passive: true });
  // Webfont (IBM Plex Mono, font-display: swap) potrafi wjechać PO pierwszym pomiarze
  // i poszerzyć kopię o kilkadziesiąt px — bez przeliczenia pas skakałby na szwie co obieg.
  document.fonts?.ready.then(() => {
    ensureCoverage();
    marqueeUnit = copyWidth();
    marqueeWrap = gsap.utils.wrap(-marqueeUnit, 0);
  });
  let marqueePaused = false;
  if (window.matchMedia('(pointer: fine)').matches) {
    // Jak dotychczasowe :hover na keyframes — pauza pod kursorem (desktop).
    marqueeBand.addEventListener('pointerenter', () => { marqueePaused = true; });
    marqueeBand.addEventListener('pointerleave', () => { marqueePaused = false; });
  }
  let marqueePos = 0;
  gsap.ticker.add((_, deltaTime) => {
    if (marqueePaused || marqueeUnit <= 0) return;
    marqueePos -= (marqueeUnit / 34) * (deltaTime / 1000);
    gsap.set(marqueeTrack, { x: marqueeWrap(marqueePos) });
  });
}

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
  if (!(element instanceof HTMLElement) || !scrambleAllowed) return;
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
  if (!(row instanceof HTMLElement) || !(element instanceof HTMLElement) || !scrambleAllowed) return;
  // Ta sama globalna zasada co runScramble: retrigger po zakończeniu + zamrożona wysokość.
  if (processScrambleFrames.has(element)) return;
  const original = element.dataset.processScrambleOriginal ?? element.textContent ?? '';
  if (!original.trim()) return;
  element.dataset.processScrambleOriginal = original;
  freezeScrambleLayout(element);

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
    releaseScrambleLayout(element);
    window.setTimeout(() => row.classList.remove('is-scrambling'), 120);
  };

  processScrambleFrames.set(element, window.requestAnimationFrame(animate));
};

const processRows = [...document.querySelectorAll('[data-process-row]')];
if (processRows.length && !reduced) {
  // Kodowanie TYLKO na hover karty (dyktando: koniec kodowania przy scrollu — to ono
  // zmieniało łamanie linii i huśtało stroną). Cel: PRAWY opis, tytuły zostają statyczne.
  processRows.forEach((row) => {
    const description = row.querySelector('.process-item-inner > p');
    if (!(description instanceof HTMLElement)) return;
    row.addEventListener('pointerenter', () => runProcessScramble(row, description));
    row.addEventListener('focusin', () => runProcessScramble(row, description));
  });
}

// Stacked cards procesu: karta przy scrollu „kładzie się w głąb" i odsłania następną.
// Azurio F2 (rotateX 30, opacity .3, blur 4) — ale liczone z ŻYWEJ geometrii karty
// (getBoundingClientRect przy scrollu), NIE z pozycji ScrollTriggera: przypięte sekcje
// wyżej zmieniają wysokość dokumentu i rozjeżdżały pozycje → karty gasły w złych miejscach.
// Ta wersja matematycznie nie może się rozjechać: p=0 dopóki karta nie doszła do góry ekranu.
// Mobile/dotyk: ten sam fold w wersji light — kąt 28st zamiast 48st i mniejsze przygaszenie;
// mgłę góry karty robi na mobile gradient w CSS (backdrop-filter bywa za ciężki na telefonach).
// Desktop: wartości identyczne jak dotąd (48st / 0.55).
if (processRows.length && !reduced) {
  const foldAngle = compactMotion ? 28 : 48;
  const foldFade = compactMotion ? 0.42 : 0.55;
  const foldTargets = processRows
    .map((row) => ({ row, inner: row.querySelector('[data-process-inner]') }))
    .filter((entry) => entry.inner);
  const updateProcessFold = () => {
    foldTargets.forEach(({ row, inner }) => {
      const rect = row.getBoundingClientRect();
      if (rect.bottom < -140 || rect.top > window.innerHeight + 140) return;
      // Składanie zaczyna się WCZEŚNIEJ (góra karty przy ~22% ekranu) i jest MOCNIEJSZE (48st)
      // — wyraźny efekt kładzenia na plecy z perspektywą (góra węższa, dół szerszy).
      const a = rect.top - window.innerHeight * 0.22;
      const b = rect.bottom - window.innerHeight * 0.52;
      const span = Math.max(1, b - a);
      const p = Math.min(1, Math.max(0, -a / span));
      // Rozmycie GRADIENTEM (góra we mgle, dół ostry) robi ::after z backdrop-filter + maską;
      // tu sterujemy tylko jego siłą przez --fold. Jednolity blur zabijał efekt kładzenia.
      gsap.set(inner, { rotateX: foldAngle * p, opacity: 1 - foldFade * p });
      inner.style.setProperty('--fold', p.toFixed(3));
    });
  };
  window.addEventListener('scroll', updateProcessFold, { passive: true });
  window.addEventListener('resize', updateProcessFold, { passive: true });
  updateProcessFold();
}

const storySteps = [...document.querySelectorAll('[data-story-step]')];
if (storySteps.length) {
  const storyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      storySteps.forEach((step) => step.classList.toggle('is-active', step === entry.target));
      // Zdjęcie po lewej podąża za aktywnym krokiem (Słucha / Rozumie / Wykonuje).
      const activeIndex = storySteps.indexOf(entry.target);
      document.querySelectorAll('[data-story-visual]').forEach((visual) => {
        visual.classList.toggle('is-active', Number(visual.dataset.storyVisual) === activeIndex);
      });
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

    // Hero zostaje w PEŁNYM kontraście do końca (decyzja Pawła) — bez przygaszania/rozmycia przy scrollu.
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
    // Scroll-scramble etykiet USUNIĘTY (dyktando: scramble wyłącznie z hovera) —
    // etykiety [data-scramble] dekodują się na hover wiersza (listener wyżej).
    const manifestoTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: manifesto,
        start: 'clamp(top 82%)',
        end: 'clamp(center 42%)',
        scrub: narrativeScrub,
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
    // h2 ma pełny aria-label — pocięte znaki chowamy przed czytnikami ekranu.
    lines.forEach((line) => line.setAttribute('aria-hidden', 'true'));
    if (manifestoChars.length) {
      // Żywa geometria zamiast pozycji ScrollTriggera — na świeżym wczytaniu pozycje
      // rozjeżdżały się przez piny i tekst bywał widoczny od razu. Tu nie ma jak.
      const totalChars = manifestoChars.length;
      gsap.set(manifestoChars, { opacity: 0, filter: 'blur(10px)' });
      const updateManifestoChars = () => {
        const rect = manifesto.getBoundingClientRect();
        if (rect.bottom < -60 || rect.top > window.innerHeight + 60) return;
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.9 - rect.top) / (vh * 1.25)));
        manifestoChars.forEach((glyph, index) => {
          const local = Math.min(1, Math.max(0, (p - (index / totalChars) * 0.7) / 0.3));
          gsap.set(glyph, {
            opacity: local,
            filter: local > 0.98 ? 'none' : `blur(${(10 * (1 - local)).toFixed(1)}px)`,
          });
        });
      };
      window.addEventListener('scroll', updateManifestoChars, { passive: true });
      updateManifestoChars();
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

    // (Scroll-scramble akapitów USUNIĘTY — wieloliniowe kodowanie zmieniało łamanie linii
    // i wysokość sekcji: to był główny generator „skakania" strony przy scrollu.)

    // Hover na nagłówku -> zdjęcia wyskakują jedno po drugim i chowają się (Azurio E1:
    // setInterval ~420 ms, miękkość robi CSS transition na opacity+scale). Desktop-only,
    // a cały blok manifesto siedzi w if (!reduced), więc reduced-motion = wyłączone.
    const manifestoPops = [...manifesto.querySelectorAll('[data-manifesto-pop]')];
    const manifestoHeading = manifesto.querySelector('h2');
    if (manifestoPops.length && manifestoHeading && window.matchMedia('(pointer: fine)').matches) {
      let popTimer = null;
      let popIndex = -1;
      const cycleManifestoPop = () => {
        if (popIndex >= 0) manifestoPops[popIndex % manifestoPops.length].classList.remove('is-on');
        popIndex += 1;
        manifestoPops[popIndex % manifestoPops.length].classList.add('is-on');
      };
      manifestoHeading.addEventListener('pointerenter', () => {
        if (popTimer) return;
        popIndex = -1;
        cycleManifestoPop();
        popTimer = window.setInterval(cycleManifestoPop, 1150);
      });
      manifestoHeading.addEventListener('pointerleave', () => {
        if (popTimer) window.clearInterval(popTimer);
        popTimer = null;
        popIndex = -1;
        manifestoPops.forEach((pop) => pop.classList.remove('is-on'));
      });
    }
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

    // Outro (dyktando): napis stoi ~jeden scroll (sekcja wydłużona do 270svh w CSS),
    // a przy kolejnym scrollu zbiega się do punktu styku dłoni (środek kompozycji) i gaśnie.
    // Scrub = w pełni odwracalne. CZYSTE 2D (scale/opacity, force3D off) — overlay pracuje
    // na mix-blend difference, translateZ odcinałby blend (ta sama lekcja co w cinematic).
    const bridgeOverlay = humanBridge.querySelector('[data-hb-overlay]');
    if (bridgeOverlay && !compactMotion) {
      // Wydłużona wysokość sekcji (270svh) obowiązuje TYLKO gdy outro realnie istnieje —
      // klasa spina CSS z tą gałęzią (okno wąskie przy load → brak outra → zwykłe 168svh).
      humanBridge.classList.add('has-outro');
      const bridgeOutro = gsap.timeline({
        scrollTrigger: {
          trigger: humanBridge,
          start: 'top top',
          end: 'bottom bottom',
          scrub: narrativeScrub,
        },
      });
      // Okno 0.62-0.96 progresu sekcji: wcześniej napis stoi nieruchomo (faza zatrzymania).
      bridgeOutro.fromTo(bridgeOverlay, { scale: 1, opacity: 1 }, {
        scale: 0.045,
        opacity: 0,
        transformOrigin: '50% 50%',
        duration: 0.34,
        ease: 'power2.in',
        force3D: false,
        immediateRender: false,
      }, 0.62);
      // Pusty marker na 1.0 — pełny zakres scrolla mapuje się 1:1 na oś czasu.
      bridgeOutro.set({}, {}, 1);
    }
  }

  // Care „Twój dział AI. Bez rekrutacji.": pełna limonka (zdjęcie i blur-sweep USUNIĘTE —
  // dyktando: „kompletnie żółta strona"). Słowa nagłówka lądują KOLEJNO jak wlepki przybijane
  // młotkiem: scale 1.6 -> 1 na easie 'hop' + mikro-wstrząs całego nagłówka przy każdym stemplu.
  // Trigger: raz przy wejściu sekcji (once) — scroll w górę NIE restartuje.
  // Mobile/reduced: statyczna żółta sekcja z widocznym tekstem (split robimy tylko tutaj).
  const careCallout = document.querySelector('.care-callout');
  if (careCallout && !compactMotion) {
    const careHeading = careCallout.querySelector('h2');
    if (careHeading) {
      careHeading.setAttribute('aria-label', (careHeading.textContent ?? '').trim().replace(/\s+/g, ' '));
      // Podział na słowa z zachowaniem <em> (outline „Bez rekrutacji." w drugiej linii).
      const careWords = [];
      const splitToWords = (node) => {
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
              word.className = 'care-word';
              word.textContent = chunk;
              fragment.append(word);
              careWords.push(word);
            });
            child.replaceWith(fragment);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            splitToWords(child);
          }
        });
      };
      splitToWords(careHeading);
      [...careHeading.children].forEach((child) => child.setAttribute('aria-hidden', 'true'));

      if (careWords.length) {
        gsap.set(careWords, { opacity: 0, scale: 1.6, transformOrigin: '50% 70%' });
        const stampTl = gsap.timeline({
          scrollTrigger: { trigger: careCallout, start: 'top 72%', once: true },
        });
        careWords.forEach((word, index) => {
          const at = index * 0.34;
          // Wlepka: pojawia się duża i lekko przezroczysta, dobija twardo na 'hop'.
          stampTl.fromTo(word, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' }, at);
          stampTl.fromTo(word, { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'hop' }, at);
          // Mikro-wstrząs nagłówka w momencie „dobicia" (młotek stuknął).
          stampTl.to(careHeading, { y: 5, duration: 0.06, ease: 'power2.in' }, at + 0.42);
          stampTl.to(careHeading, { y: 0, duration: 0.14, ease: 'power3.out' }, at + 0.48);
        });
      }
    }
  }

  // Wejście „Jeden przepływ": sekcja jak kartka 2D obrócona na sztorc, prostuje się przy scrollu.
  const storyGrid = document.querySelector('.system-story .story-grid');
  if (storyGrid && !compactMotion) {
    gsap.fromTo(storyGrid, {
      rotateX: -56,
      opacity: 0.12,
      transformPerspective: 1100,
      transformOrigin: '50% 0%',
    }, {
      rotateX: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.system-story', start: 'top 94%', end: 'top 16%', scrub: narrativeScrub },
    });
  } else if (storyGrid) {
    // Mobile: ten sam gest w wersji light (mniejszy kąt, krótszy przebieg) — nie męczy na dotyku.
    gsap.fromTo(storyGrid, {
      rotateX: -18,
      y: 36,
      opacity: 0.3,
      transformPerspective: 900,
      transformOrigin: '50% 0%',
    }, {
      rotateX: 0,
      y: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.system-story', start: 'top 96%', end: 'top 42%', scrub: narrativeScrub },
    });
  }

  // Przejścia MIĘDZY sekcjami: wejście jak obracana kartka 2D (subtelny flip), dla sekcji bez pinu.
  // Mobile: lżejszy wariant (rotateX -18, y 40) — desktop dostaje DOKŁADNIE dotychczasowe wartości.
  {
    const flipFrom = compactMotion
      ? { rotateX: -18, y: 40, opacity: 0.28, transformPerspective: 900, transformOrigin: '50% 0%' }
      : { rotateX: -44, y: 120, opacity: 0.1, transformPerspective: 1050, transformOrigin: '50% 0%' };
    const flipEnd = compactMotion ? 'top 55%' : 'top 44%';
    ['.services-section > .section-shell', '.insights-section > .section-shell', '.reel-intro'].forEach((selector) => {
      const block = document.querySelector(selector);
      if (!block) return;
      gsap.fromTo(block, { ...flipFrom }, {
        rotateX: 0,
        y: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: block, start: 'top 99%', end: flipEnd, scrub: narrativeScrub },
      });
    });
  }

  // Technika D z Azurio (mxdHero3dImages): sekcja pinowana, zdjęcia wylatują ZE ŚRODKA
  // we wszystkich kierunkach. NIE timeline — ręczna interpolacja po self.progress w onUpdate.
  const cinematic = document.querySelector('[data-cinematic]');
  if (cinematic && compactMotion) {
    // Dotyk/mobile: bez pinu (8 ekranów pinu męczy na telefonie) — statyczny layout z CSS,
    // ale z ładnym WEJŚCIEM: tytuł wyostrza się z mgły, okładka odsłania się clip-pathem
    // z dojazdem skali (clip-path omija CSS-owy freeze `transform: none !important` na okładce),
    // napis outro dochodzi na końcu. Wszystko once — zero scrubu, zero pinów.
    cinematic.classList.add('cinematic-static');
    const staticIntroLines = [...cinematic.querySelectorAll('[data-cinematic-intro-line]')];
    const staticOutroLines = [...cinematic.querySelectorAll('[data-cinematic-outro-line]')];
    const staticCover = cinematic.querySelector('[data-cinematic-cover]');
    const staticCoverImg = staticCover?.querySelector('img');
    if (staticIntroLines.length) {
      gsap.fromTo(staticIntroLines, { opacity: 0, y: 30, filter: 'blur(8px)' }, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.85,
        ease: 'power3.out',
        stagger: 0.14,
        scrollTrigger: { trigger: cinematic, start: 'top 74%', once: true },
      });
    }
    if (staticCover) {
      const staticCoverTl = gsap.timeline({
        scrollTrigger: { trigger: staticCover, start: 'top 82%', once: true },
      });
      staticCoverTl.fromTo(staticCover, { clipPath: 'inset(12% 8% 12% 8%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1,
        ease: 'power3.out',
      }, 0);
      if (staticCoverImg) {
        staticCoverTl.fromTo(staticCoverImg, { scale: 1.14 }, { scale: 1, duration: 1.25, ease: 'power3.out' }, 0);
      }
      if (staticOutroLines.length) {
        staticCoverTl.fromTo(staticOutroLines, { opacity: 0, y: 16 }, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.12,
        }, 0.3);
      }
    }
  } else if (cinematic) {
    const shots = [...cinematic.querySelectorAll('[data-cinematic-shot]')];
    const introLines = [...cinematic.querySelectorAll('[data-cinematic-intro-line]')];
    const outroLines = [...cinematic.querySelectorAll('[data-cinematic-outro-line]')];
    const cover = cinematic.querySelector('[data-cinematic-cover]');
    const progressLine = cinematic.querySelector('[data-cinematic-progress]');
    const clamp01 = gsap.utils.clamp(0, 1);

    // ~20+ wektorów kierunków (boki, rogi, góra-dół) — jeden na zdjęcie.
    const scatterDirections = [
      { x: 1.3, y: 0.7 }, { x: -1.5, y: 1.0 }, { x: 1.1, y: -1.3 }, { x: -0.9, y: -1.5 },
      { x: 1.7, y: 0.2 }, { x: -1.8, y: -0.3 }, { x: 0.4, y: 1.6 }, { x: -0.5, y: -1.7 },
      { x: 1.5, y: 1.2 }, { x: -1.3, y: 1.4 }, { x: 1.6, y: -0.8 }, { x: -1.6, y: 0.6 },
      { x: 0.8, y: 1.4 }, { x: -0.7, y: 1.6 }, { x: 0.9, y: -1.6 }, { x: -1.1, y: -1.2 },
      { x: 1.9, y: -0.4 }, { x: -2.0, y: 0.3 }, { x: 0.2, y: -1.8 }, { x: -0.2, y: 1.8 },
      { x: 1.4, y: 1.5 }, { x: -1.4, y: -1.4 },
    ];
    // CZYSTE 2D (x/y/scale, bez translateZ/preserve-3d): kontekst 3D odcinał zdjęcia od
    // blendu `difference` tytułu — w 2D litery odbijają strukturę zdjęcia jak w proof.
    const scatterMultiplier = 0.55;
    let scatterEnds = [];
    const computeScatter = () => {
      scatterEnds = shots.map((_, index) => {
        const dir = scatterDirections[index % scatterDirections.length];
        return {
          x: dir.x * window.innerWidth * scatterMultiplier,
          y: dir.y * window.innerHeight * scatterMultiplier,
        };
      });
    };
    computeScatter();

    // Start: punkt w centrum. xPercent/yPercent centrują niezależnie od x/y; skala udaje głębię.
    gsap.set(shots, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0, opacity: 1, force3D: true });
    gsap.set(cover, { scale: 0, opacity: 1, force3D: true });
    gsap.set(progressLine, { scaleX: 0, transformOrigin: 'left center' });

    const renderCinematic = (progress) => {
      shots.forEach((shot, index) => {
        // Gęściej (stagger 0.018) i szybszy wzrost — zdjęcia wcześniej duże pod napisem.
        const p = Math.max(0, (progress - index * 0.018) * 4);
        const end = scatterEnds[index];
        gsap.set(shot, {
          x: gsap.utils.interpolate(0, end.x, p),
          y: gsap.utils.interpolate(0, end.y, p),
          scale: 2.5 * Math.min(1, p * 1.35),
        });
      });
      // Tytuł intro gaśnie w oknie 0.60–0.75 (per linia, z lekkim przesunięciem).
      introLines.forEach((line, index) => {
        gsap.set(line, { opacity: 1 - clamp01((progress - (0.6 + index * 0.04)) / 0.11) });
      });
      // Okładka wyłania się od 0.70: z -1000 → 0, scale 0 → 1 (pełny kadr ok. 0.95).
      const coverP = Math.max(0, (progress - 0.7) * 4);
      gsap.set(cover, { scale: Math.min(1, coverP * 1.5) });
      // Napis outro na okładce w oknie 0.80–0.95 (per linia).
      outroLines.forEach((line, index) => {
        gsap.set(line, { opacity: clamp01((progress - (0.8 + index * 0.05)) / 0.1) });
      });
      if (progressLine) gsap.set(progressLine, { scaleX: progress });
    };

    ScrollTrigger.create({
      trigger: cinematic,
      start: 'top top',
      end: () => '+=' + window.innerHeight * 8,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        computeScatter();
        renderCinematic(self.progress);
      },
      onUpdate: (self) => renderCinematic(self.progress),
    });
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

    // Mobile: dryfują tylko 2 zdjęcia (subject + accent, indeksy 1 i 2) — mniej warstw
    // z animowanym blurem naraz; pozostałe dwa chowa CSS w gałęzi mobile.
    // Desktop: pełna czwórka z DOKŁADNIE dotychczasowymi oknami czasowymi.
    const fogActive = compactMotion ? [1, 2] : null;
    let fogOrder = 0;
    fogImages.forEach((image, index) => {
      if (fogActive && !fogActive.includes(index)) return;
      const order = fogOrder;
      fogOrder += 1;
      const bitmap = image.querySelector('img');
      const drift = fogDrifts[index] ?? fogDrifts[0];
      const entry = compactMotion ? 0.3 + order * 0.14 : 0.26 + index * 0.08;
      const exit = compactMotion ? 0.74 + order * 0.05 : 0.8 + index * 0.02;
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
    // Twardy stan startowy PRZED timeline'em — bez tego ostatnia linia nagłówka
    // („do pracy wykonanej...") potrafiła błysnąć przy wejściu w sekcję.
    gsap.set(lines, { xPercent: -64, opacity: 0 });
    if (note) gsap.set(note, { opacity: 0, x: -10 });
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
      filter: 'blur(10px)',
    }, {
      xPercent: 0,
      opacity: 1,
      filter: 'blur(0px)',
      stagger: 0.055,
      duration: 0.26,
      ease: 'none',
    }, 0.02);
    exploreTimeline.fromTo(note, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.24, ease: 'none' }, 0.16);

    items.forEach((item, index) => {
      const image = item.querySelector('.system-explore__image');
      const bitmap = item.querySelector('img');
      const entry = 0.045 + index * 0.145;

      // autoAlpha (nie opacity): przy 0 GSAP stawia visibility:hidden, więc niewidoczne
      // kafle NIE łapią hovera (inaczej przechwytywałyby scramble widocznego kafla).
      exploreTimeline.fromTo(item, {
        xPercent: compactMotion ? 28 : 38,
        yPercent: index % 2 === 0 ? -2 : 2.5,
        rotate: 0.8,
        autoAlpha: 0,
        filter: 'blur(10px)',
      }, {
        xPercent: compactMotion ? 5 : 7,
        yPercent: 0,
        rotate: 0.15,
        autoAlpha: 0.94,
        filter: 'blur(0px)',
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
        autoAlpha: 1,
        duration: 0.11,
        ease: 'none',
      }, entry + 0.14);
      if (bitmap) exploreTimeline.to(bitmap, { scale: 1, duration: 0.1, ease: 'none' }, entry + 0.17);
      exploreTimeline.to(item, {
        xPercent: compactMotion ? -18 : -25,
        yPercent: index % 2 === 0 ? 1.5 : -1.5,
        rotate: -0.55,
        autoAlpha: 0,
        duration: 0.17,
        ease: 'none',
      }, entry + 0.26);
    });
  }

  // Pinowany blok „Jeden partner. Cały ekosystem AI." (Azurio A1 uproszczone).
  // Zamiast Flip.fit: jeden fromTo scale z celem liczonym funkcyjnie — stabilniejsze
  // w Astro (bez placeholderów w px, globalny invalidateOnRefresh przelicza cel przy
  // resize), a scrub .55 + ease 'none' daje ten sam liniowy hero-scale co w Azurio.
  const reelBig = document.querySelector('[data-reel-big]');
  if (reelBig && !window.matchMedia('(max-width: 760px)').matches) {
    const reelMedia = reelBig.querySelector('[data-reel-big-media]');
    const reelRows = [...reelBig.querySelectorAll('[data-reel-big-row]')];
    const reelTitleLines = [...reelBig.querySelectorAll('[data-reel-big-line]')];

    if (reelMedia) {
      const reelTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: reelBig,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
        },
      });
      // 1 scroll = duży przyrost: wzrost kończy się po ~2/3 pinu (ok. 1.3 ekranu scrolla),
      // cel = pokrycie prawie całej zakładki niezależnie od proporcji viewportu.
      reelTimeline.fromTo(reelMedia, { scale: 1 }, {
        scale: () => Math.max(
          (window.innerWidth * 0.96) / Math.max(1, reelMedia.offsetWidth),
          (window.innerHeight * 0.96) / Math.max(1, reelMedia.offsetHeight),
        ),
        duration: 0.62,
        ease: 'none',
      }, 0.04);
      // Minimalny parallax gigantycznych rzędów tła (statyczne w pionie, dryf w poziomie).
      reelRows.forEach((row, index) => {
        const drift = index % 2 === 0 ? -3 : 3;
        reelTimeline.fromTo(row, { xPercent: -drift }, { xPercent: drift, duration: 0.96, ease: 'none' }, 0.02);
      });
    }

    // Tytuł wychodzi ze środkowej linii do góry NA zdjęciu (maska + yPercent 100->0,
    // ease 'common') po urośnięciu zdjęcia; scroll w górę chowa go z powrotem.
    if (reelTitleLines.length) {
      gsap.set(reelTitleLines, { yPercent: 108 });
      ScrollTrigger.create({
        trigger: reelBig,
        start: '48% top',
        onEnter: () => gsap.to(reelTitleLines, { yPercent: 0, duration: 0.85, ease: 'common', stagger: 0.09, overwrite: true }),
        onLeaveBack: () => gsap.to(reelTitleLines, { yPercent: 108, duration: 0.5, ease: 'power2.in', stagger: 0.05, overwrite: true }),
      });
    }

    // Kursor-badge „DOWIEDZ SIĘ WIĘCEJ" (Azurio B uproszczone): pozycja = GSAP
    // (duration .4, power1.out), skala = klasa CSS + transition. Desktop-only.
    const reelBadge = reelBig.querySelector('[data-reel-big-badge]');
    const reelHover = reelBig.querySelector('[data-reel-big-hover]');
    const reelStickyArea = reelBig.querySelector('.reel-big__sticky');
    if (reelBadge && reelHover && reelStickyArea && window.matchMedia('(pointer: fine)').matches) {
      const badgeX = gsap.quickTo(reelBadge, 'x', { duration: 0.4, ease: 'power1.out' });
      const badgeY = gsap.quickTo(reelBadge, 'y', { duration: 0.4, ease: 'power1.out' });
      const badgePoint = (event) => {
        const bounds = reelStickyArea.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      };
      reelHover.addEventListener('pointerenter', (event) => {
        const point = badgePoint(event);
        gsap.set(reelBadge, { x: point.x, y: point.y });
        reelBadge.classList.add('is-active');
      });
      reelHover.addEventListener('pointermove', (event) => {
        const point = badgePoint(event);
        badgeX(point.x);
        badgeY(point.y);
      });
      reelHover.addEventListener('pointerleave', () => reelBadge.classList.remove('is-active'));
    }
  } else if (reelBig) {
    // Mobile: layout statyczny zostaje (CSS), ale tytuł wyjeżdża z maski jak na desktopie,
    // a zdjęcie dostaje miękki dojazd skali. Klasa .reel-mobile-motion zdejmuje CSS-owy
    // freeze `transform: none !important` na liniach tytułu TYLKO w tej gałęzi.
    const reelTitleLines = [...reelBig.querySelectorAll('[data-reel-big-line]')];
    if (reelTitleLines.length) {
      reelBig.classList.add('reel-mobile-motion');
      gsap.set(reelTitleLines, { yPercent: 108 });
      ScrollTrigger.create({
        trigger: reelBig.querySelector('.reel-big__stage') ?? reelBig,
        start: 'top 72%',
        once: true,
        onEnter: () => gsap.to(reelTitleLines, { yPercent: 0, duration: 0.85, ease: 'common', stagger: 0.09, overwrite: true }),
      });
    }
    const reelImg = reelBig.querySelector('[data-reel-big-media] img');
    if (reelImg) {
      gsap.fromTo(reelImg, { scale: 1.12 }, {
        scale: 1,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: reelBig.querySelector('[data-reel-big-media]') ?? reelBig, start: 'top 82%', once: true },
      });
    }
  }

  document.querySelectorAll('.service-card').forEach((card) => {
    gsap.fromTo(card, { y: compactMotion ? 28 : 46, rotate: card.dataset.accent === 'blue' ? -0.35 : 0.35 }, {
      y: 0,
      rotate: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none none' },
    });

    // „Zobacz usługę" (prawy górny róg karty) wjeżdża strzałką od lewej przy wejściu karty.
    const cardLink = card.querySelector('.service-card-link');
    if (cardLink) {
      gsap.fromTo(cardLink, { x: -28, opacity: 0 }, {
        x: 0,
        opacity: 1,
        duration: 0.7,
        ease: 'common',
        delay: 0.3,
        scrollTrigger: { trigger: card, start: 'top 82%', once: true },
      });
    }
  });

  // Parallax na WSZYSTKICH trzech klatkach story (nie tylko pierwszej) — bez skoku skali przy crossfade.
  const storyImages = document.querySelectorAll('.story-media-frames img');
  if (storyImages.length) {
    gsap.to(storyImages, {
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

    // Tytuł widoczny (we mgle) już przy WEJŚCIU sekcji — bez czarnej dziury przed pinem.
    gsap.set(lines, { opacity: 0.35, yPercent: 22, filter: 'blur(9px)' });
    if (kicker) gsap.set(kicker, { opacity: 0 });

    const proofTl = gsap.timeline({
      scrollTrigger: { trigger: proofExplore, start: 'top top', end: 'bottom bottom', scrub: galleryScrub },
    });
    if (kicker) proofTl.to(kicker, { opacity: 1, duration: 0.04, ease: 'none' }, 0);
    proofTl.to(lines, { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: 0.03, duration: 0.08, ease: 'none' }, 0);
    proofTl.to(title, { yPercent: -12, duration: 0.2, ease: 'none' }, 0.24);
    proofTl.to(title, { yPercent: 0, duration: 0.2, ease: 'none' }, 0.72);

    // Zdjęcia wjeżdżają z dołu i przechodzą PRZEZ ŚRODEK za napisem (kontrast difference),
    // wyostrzając się znad dolnej mgły — ciągły przepływ, nie pojawianie się znikąd.
    // Mobile: 3 zdjęcia zamiast 5 (spokojniejszy rytm, mniej warstw naraz) — pozostałe dwa
    // chowa CSS i NIE dostają gsap.set (na tabletach coarse >760px zostają na opacity 0 z CSS).
    const proofImgs = compactMotion ? imgs.slice(0, 3) : imgs;
    gsap.set(proofImgs, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 });
    proofImgs.forEach((img, index) => {
      const at = compactMotion ? 0.16 + index * 0.21 : 0.12 + index * 0.155;
      proofTl.fromTo(img, { y: '112vh' }, { y: '-18vh', duration: 0.3, ease: 'none' }, at);
      // Ostrość od razu na dole — zdjęcie jest wyraźne ZANIM najedzie na napis.
      proofTl.fromTo(img, { filter: 'blur(9px)' }, { filter: 'blur(0px)', duration: 0.08, ease: 'none' }, at);
      // Ostro do KOŃCA przelotu — blur na wyjściu rozmazywał strukturę na literach.
      proofTl.to(img, { y: '-136vh', duration: 0.24, ease: 'none' }, at + 0.3);
    });
  }
}

if (!reduced) {
  const refreshMotion = () => window.requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener('load', refreshMotion, { once: true });
  document.fonts?.ready.then(refreshMotion);
}

// Sequence-lab: 3 karty-zdjęcia. Hover = mini pokaz slajdów (Azurio E1: setInterval 350 ms,
// przełączanie opacity, miękkość robi CSS transition). Mobile: wolny automatyczny cykl w kadrze.
const sequenceLabCards = [...document.querySelectorAll('[data-sequence-card]')];
if (sequenceLabCards.length) {
  const sequenceFinePointer = window.matchMedia('(pointer: fine)').matches;
  sequenceLabCards.forEach((card) => {
    const frames = [...card.querySelectorAll('[data-sequence-card-frame]')];
    const tag = card.querySelector('[data-scramble]');
    if (frames.length < 2) return;
    let current = 0;
    let interval = null;
    const show = (next) => {
      frames[current].classList.remove('is-active');
      current = next % frames.length;
      frames[current].classList.add('is-active');
    };
    const stop = () => {
      if (interval) window.clearInterval(interval);
      interval = null;
      card.classList.remove('is-cycling');
      show(0);
    };
    const start = (speed) => {
      if (interval || reduced) return;
      card.classList.add('is-cycling');
      show(current + 1);
      interval = window.setInterval(() => show(current + 1), speed);
    };
    if (sequenceFinePointer) {
      card.addEventListener('pointerenter', () => {
        start(350);
        if (tag) runScramble(tag);
      });
      card.addEventListener('pointerleave', stop);
    } else if (!reduced) {
      const cycleObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.isIntersecting ? start(1600) : stop());
      }, { threshold: 0.45 });
      cycleObserver.observe(card);
    }
  });

  // Wjazd kart: blur-reveal batchem, spójny z resztą strony (power3.out + stagger).
  if (!reduced) {
    gsap.set(sequenceLabCards, { opacity: 0, y: compactMotion ? 26 : 44, filter: 'blur(8px)' });
    ScrollTrigger.batch(sequenceLabCards, {
      start: 'top 86%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: compactMotion ? 0.7 : 0.95,
        ease: 'power3.out',
        stagger: 0.12,
        overwrite: true,
      }),
    });
  }
}

if (window.matchMedia('(pointer: fine)').matches && !reduced) {
  // JEDNO źródło prawdy: kontener listy steruje JEDNYM aktywnym podglądem. Per-wiersz
  // handlery gubiły enter/leave (wielkie nagłówki sąsiednich wierszy przejmowały hover),
  // stąd „trzy zdjęcia naraz" i podgląd zawieszony z boku. Tu: max jeden, zawsze pod kursorem.
  const previewByRow = new Map();
  document.querySelectorAll('[data-insight-row]').forEach((row) => {
    const preview = row.querySelector('[data-insight-preview]');
    if (!(preview instanceof HTMLElement)) return;
    preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
    gsap.set(preview, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
    previewByRow.set(row, preview);
  });
  let activeInsightPreview = null;
  let pointerInsideInsights = false;
  // .insights-list = strona główna; .listing-grid = /wiedza/ — bez tego podgląd na wiedzy
  // był wyrywany do body i zawisał bez follow/hide (FIND-1 audytu).
  const insightsListEl = document.querySelector('.insights-list, .listing-grid');
  insightsListEl?.addEventListener('pointermove', (event) => {
    pointerInsideInsights = true;
    const row = event.target instanceof Element ? event.target.closest('[data-insight-row]') : null;
    const preview = row ? previewByRow.get(row) : null;
    // Szybkie machnięcia: kursor łapie przerwy MIĘDZY wierszami (row=null) — wtedy NIE chowamy,
    // aktywny podgląd dalej płynie za kursorem. Zmiana tylko przy realnym wjeździe na inny wiersz.
    if (row && preview !== activeInsightPreview) {
      if (activeInsightPreview) {
        gsap.to(activeInsightPreview, { opacity: 0, scale: 0.7, duration: 0.16, ease: 'power2.in', overwrite: true });
      }
      activeInsightPreview = preview ?? null;
      if (activeInsightPreview) {
        gsap.set(activeInsightPreview, { x: event.clientX, y: event.clientY });
        gsap.fromTo(activeInsightPreview, { scale: 0.6, opacity: 0 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'common', overwrite: true });
        runScramble(row.querySelector('[data-scramble]'));
      }
    } else if (activeInsightPreview) {
      // Twarde wyjście: kursor poniżej/powyżej listy = natychmiastowe schowanie
      // (podgląd NIGDY nie wjeżdża na sekcję bąbelków).
      const bounds = insightsListEl.getBoundingClientRect();
      if (event.clientY > bounds.bottom + 6 || event.clientY < bounds.top - 6) {
        gsap.to(activeInsightPreview, { opacity: 0, scale: 0.7, duration: 0.15, ease: 'power2.in', overwrite: true });
        activeInsightPreview = null;
      } else {
        gsap.to(activeInsightPreview, { x: event.clientX, y: event.clientY, duration: 0.13, ease: 'power3.out', overwrite: 'auto' });
      }
    }
  }, { passive: true });
  // Fallback per-wiersz: wejście na wiersz ZAWSZE pokazuje podgląd (nawet gdy kursor
  // wcelował najpierw w przerwę i kontener nie zdążył złapać ruchu).
  previewByRow.forEach((preview, row) => {
    row.addEventListener('pointerenter', (event) => {
      // Wiersz podjechał pod nieruchomy kursor przy scrollu — flaga musi stanąć TUTAJ,
      // inaczej scroll-hide gasił świeżo pokazany podgląd (FIND-2 audytu).
      pointerInsideInsights = true;
      if (activeInsightPreview === preview) return;
      if (activeInsightPreview) {
        gsap.to(activeInsightPreview, { opacity: 0, scale: 0.7, duration: 0.14, ease: 'power2.in', overwrite: true });
      }
      activeInsightPreview = preview;
      gsap.set(preview, { x: event.clientX, y: event.clientY });
      gsap.fromTo(preview, { scale: 0.6, opacity: 0 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'common', overwrite: true });
      runScramble(row.querySelector('[data-scramble]'));
    });
  });
  insightsListEl?.addEventListener('pointerleave', () => {
    pointerInsideInsights = false;
    if (activeInsightPreview) {
      gsap.to(activeInsightPreview, { opacity: 0, scale: 0.7, duration: 0.18, ease: 'power2.in', overwrite: true });
      activeInsightPreview = null;
    }
  });
  const hideAllInsightPreviews = (force = false) => {
    // Kursor nad listą = NIE chowaj (scroll-hide walczył z hoverem podczas dojeżdżania
    // płynnego scrolla i podgląd znikał zaraz po pojawieniu — stąd "za którymś razem").
    // force = twardy bezpiecznik (sekcja wyjechała z viewportu): chowa ZAWSZE i zeruje stan —
    // przy scrollu bez ruchu myszy pointerleave nie przychodzi i flaga wisiała na true,
    // a activeInsightPreview blokował ponowne pokazanie na tym samym wierszu („zawieszka").
    if (!force && pointerInsideInsights) return;
    if (force) pointerInsideInsights = false;
    activeInsightPreview = null;
    document.querySelectorAll('.insight-preview').forEach((preview) => {
      if (Number(gsap.getProperty(preview, 'opacity')) > 0.05) {
        gsap.to(preview, { opacity: 0, scale: 0.7, duration: force ? 0.15 : 0.18, ease: 'power2.in', overwrite: true });
      }
    });
  };
  window.addEventListener('scroll', () => hideAllInsightPreviews(false), { passive: true });
  // Bezpiecznik 1: wyjazd sekcji z ekranu ZAWSZE chowa podgląd (twardo). Trigger tworzony
  // tylko tam, gdzie sekcja istnieje (na podstronach GSAP logował warning i martwy trigger).
  if (document.querySelector('.insights-section')) {
    ScrollTrigger.create({
      trigger: '.insights-section',
      start: 'top bottom',
      end: 'bottom top',
      onLeave: () => hideAllInsightPreviews(true),
      onLeaveBack: () => hideAllInsightPreviews(true),
    });
  }
  // Bezpiecznik 2: działa też na /wiedza/ (.listing-grid, gdzie nie ma .insights-section) —
  // lista poza viewportem = natychmiastowe schowanie, niezależnie od stanu hovera.
  if (insightsListEl) {
    const listVisibility = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) hideAllInsightPreviews(true);
      });
    });
    listVisibility.observe(insightsListEl);
  }
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
