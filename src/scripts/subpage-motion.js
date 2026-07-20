import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const root = document.querySelector('.subpage-main');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (root instanceof HTMLElement && !root.dataset.motionBound) {
  root.dataset.motionBound = 'true';
  document.documentElement.classList.add('has-subpage-motion');

  const setVisible = (element) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.add('is-visible');
    element.classList.add('is-motion-visible');
  };

  const hero = root.querySelector('[data-subpage-hero]');

  if (hero instanceof HTMLElement) {
    const label = hero.querySelector('.mono-label');
    const title = hero.querySelector('h1');
    const copy = hero.querySelector('.subhero-copy, .service-hero-copy > p');
    const meta = hero.querySelector('.service-meta');
    const orb = hero.querySelector('.subhero-orb');

    if (reducedMotion.matches) {
      [label, title, copy, meta, orb].forEach(setVisible);
    } else {
      const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });

      if (label) {
        intro.fromTo(label, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.72 }, 0.12);
      }
      if (title) {
        intro.fromTo(
          title,
          { opacity: 0, yPercent: 13, clipPath: 'inset(0 0 100% 0)', filter: 'blur(7px)' },
          { opacity: 1, yPercent: 0, clipPath: 'inset(0 0 0% 0)', filter: 'blur(0px)', duration: 1.22 },
          0.2,
        );
      }
      if (copy) {
        intro.fromTo(
          copy,
          { opacity: 0, y: 24, filter: 'blur(5px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.92 },
          0.48,
        );
      }
      if (meta) {
        intro.fromTo(meta, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.78 }, 0.64);
      }
      if (orb) {
        intro.fromTo(
          orb,
          { opacity: 0, scale: 0.86, rotate: -15 },
          { opacity: 0.82, scale: 1, rotate: -7, duration: 1.6, ease: 'power3.out' },
          0.16,
        );

        gsap.to(orb, {
          yPercent: 8,
          xPercent: -4,
          rotate: 3,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 1.6,
          },
        });
      }
    }
  }

  const sections = [...root.querySelectorAll('[data-motion-section]')];

  sections.forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    const heading = section.querySelector(':scope > .content-grid > h2, :scope h2, :scope blockquote');
    const label = section.querySelector(':scope > .content-grid > .mono-label, :scope .mono-label');
    const lead = section.querySelector(':scope > .content-grid > .lead, :scope .lead');
    // Elements carrying data-reveal remain exclusively owned by site.js.
    // This avoids two GSAP/IntersectionObserver states fighting over opacity/y.
    const nodes = [label, heading, lead].filter(
      (node) => node instanceof HTMLElement && !node.matches('[data-reveal]'),
    );

    nodes.forEach(setVisible);

    if (reducedMotion.matches) {
      section.classList.add('is-motion-visible');
      return;
    }

    const observer = ScrollTrigger.create({
      trigger: section,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        section.classList.add('is-motion-visible');
        gsap.fromTo(
          nodes,
          { opacity: 0, y: 28, filter: 'blur(7px)' },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 1.02,
            stagger: 0.1,
            ease: 'power4.out',
            clearProps: 'filter,transform,opacity',
          },
        );
      },
    });

    section.dataset.motionTrigger = String(observer.vars.start);
  });

  const groups = [...root.querySelectorAll('[data-motion-group]')];
  groups.forEach((group) => {
    if (!(group instanceof HTMLElement)) return;
    const items = [...group.children].filter(
      (item) => item instanceof HTMLElement
        && !item.matches('[data-reveal]')
        && item.matches('[data-motion-item], [data-motion-row], .listing-card, .feature-card, .case-row'),
    );
    if (!items.length) return;
    items.forEach((item) => {
      if (!item.matches('[data-motion-item]')) item.dataset.motionRow = '';
      setVisible(item);
    });

    if (reducedMotion.matches) return;

    gsap.fromTo(
      items,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.96,
        stagger: 0.085,
        ease: 'power4.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: group,
          start: 'top 84%',
          once: true,
        },
      },
    );
  });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  const curtains = [...root.querySelectorAll('[data-image-curtain]')].filter(
    (curtain) => !(finePointer.matches && curtain.matches('.insight-preview')),
  );
  curtains.forEach((curtain) => {
    if (!(curtain instanceof HTMLElement)) return;
    const image = curtain.querySelector('img');
    const isHeroImage = curtain.matches('.service-hero-visual');

    if (reducedMotion.matches) {
      gsap.set(curtain, { '--sm-curtain': 0 });
      if (image) gsap.set(image, { clearProps: 'transform' });
      return;
    }

    if (isHeroImage) {
      const heroTimeline = gsap.timeline({ delay: 0.2 });
      heroTimeline.fromTo(
        curtain,
        { '--sm-curtain': 1 },
        { '--sm-curtain': 0, duration: 0.66, ease: 'power3.inOut' },
        0,
      );
      if (image) {
        heroTimeline
          .fromTo(
            image,
            { filter: 'blur(10px) brightness(0.38) contrast(0.76) saturate(0.34)', scale: 1.075, xPercent: 5, yPercent: 4 },
            { filter: 'blur(4px) brightness(0.72) contrast(0.92) saturate(0.72)', duration: 0.66, ease: 'power2.out' },
            0,
          )
          .to(image, { filter: 'blur(0px) brightness(1) contrast(1) saturate(1)', duration: 0.28, ease: 'power2.out' }, 0.66)
          .to(image, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.54, ease: 'power3.out' }, 0.94);
      }
      return;
    }

    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: curtain,
        start: 'top 96%',
        end: 'top 57%',
        scrub: 1.25,
      },
    });
    // Three explicit phases, reversible by ScrollTrigger:
    // 1. reveal from shadow, 2. reach full sharpness, 3. settle into position.
    timeline.fromTo(curtain, { '--sm-curtain': 1 }, { '--sm-curtain': 0, duration: 0.5 }, 0);
    if (image) {
      timeline
        .fromTo(
          image,
          {
            filter: `blur(${mobileViewport.matches ? 4 : 10}px) brightness(0.36) contrast(0.74) saturate(0.3)`,
            scale: mobileViewport.matches ? 1.045 : 1.075,
            xPercent: mobileViewport.matches ? 2 : 5,
            yPercent: mobileViewport.matches ? 4 : 7,
          },
          { filter: 'blur(5px) brightness(0.68) contrast(0.9) saturate(0.68)', duration: 0.5 },
          0,
        )
        .to(image, { filter: 'blur(0px) brightness(1) contrast(1) saturate(1)', duration: 0.2 }, 0.5)
        .to(image, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.3 }, 0.7);
    }
  });

  const caseShowcase = root.querySelector('[data-case-showcase]');
  if (caseShowcase instanceof HTMLElement) {
    const panels = [...caseShowcase.querySelectorAll('[data-case-panel]')];
    const rows = [...caseShowcase.querySelectorAll('[data-case-row]')];
    const scrambleAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const scrambleNumbers = '0123456789';
    let activeCase = 0;

    const scrambleTarget = (entry, delay = 0) => {
      entry.tween?.kill();
      entry.target.classList.add('is-scrambling');

      const originalCharacters = [...entry.original];
      const mutableCharacters = originalCharacters.filter((character) => !/[\s/—–-]/u.test(character));
      const state = { progress: 0 };

      entry.tween = gsap.to(state, {
        progress: 1,
        delay,
        duration: Math.min(0.82, 0.46 + entry.original.length * 0.011),
        ease: 'power3.out',
        onUpdate: () => {
          const revealedCount = Math.floor(state.progress * mutableCharacters.length);
          let mutableIndex = 0;

          entry.target.textContent = originalCharacters.map((character) => {
            if (/[\s/—–-]/u.test(character)) return character;
            const shouldReveal = mutableIndex < revealedCount;
            mutableIndex += 1;
            if (shouldReveal) return character;
            const pool = /\d/u.test(character) ? scrambleNumbers : scrambleAlphabet;
            return pool[Math.floor(Math.random() * pool.length)];
          }).join('');
        },
        onComplete: () => {
          entry.target.textContent = entry.original;
          entry.target.classList.remove('is-scrambling');
          entry.tween = null;
        },
      });
    };

    const setCaseState = (index) => {
      rows.forEach((row, rowIndex) => row.classList.toggle('is-active', rowIndex === index));
      panels.forEach((panel, panelIndex) => panel.setAttribute('aria-hidden', String(panelIndex !== index)));
    };

    const activateCase = (nextIndex, direction = 1, animate = true) => {
      if (!panels[nextIndex] || nextIndex === activeCase) {
        setCaseState(nextIndex);
        return;
      }

      const previous = panels[activeCase];
      const next = panels[nextIndex];
      const previousImage = previous?.querySelector('img');
      const nextImage = next.querySelector('img');

      [previous, previousImage, next, nextImage].forEach((element) => {
        if (element) gsap.killTweensOf(element);
      });

      panels.forEach((panel) => {
        if (panel !== previous) panel.classList.remove('is-exiting');
      });

      if (previous) {
        previous.classList.remove('is-active');
        previous.classList.add('is-exiting');
        if (animate) {
          gsap.to(previous, {
            '--case-curtain': 1,
            duration: 0.36,
            ease: 'power2.in',
            onComplete: () => {
              if (previous.classList.contains('is-active')) return;
              previous.classList.remove('is-exiting');
              gsap.set(previous, { opacity: 0 });
            },
          });
          if (previousImage) {
            gsap.to(previousImage, {
              filter: 'blur(8px) brightness(0.48) contrast(0.82) saturate(0.48)',
              scale: 1.025,
              duration: 0.34,
              ease: 'power2.in',
            });
          }
        } else {
          previous.classList.remove('is-exiting');
          gsap.set(previous, { opacity: 0, '--case-curtain': 1 });
        }
      }

      next.classList.remove('is-exiting');
      next.classList.add('is-active');
      gsap.set(next, { opacity: 1, '--case-curtain': animate ? 1 : 0 });

      if (nextImage) {
        if (animate) {
          const offset = direction >= 0 ? 5 : -5;
          gsap.timeline({ defaults: { ease: 'none' } })
            .fromTo(
              nextImage,
              {
                filter: 'blur(11px) brightness(0.36) contrast(0.76) saturate(0.32)',
                scale: 1.07,
                xPercent: offset,
                yPercent: 4,
              },
              { filter: 'blur(4px) brightness(0.72) contrast(0.92) saturate(0.72)', duration: 0.46 },
              0,
            )
            .to(next, { '--case-curtain': 0, duration: 0.46 }, 0)
            .to(nextImage, { filter: 'blur(0px) brightness(1) contrast(1) saturate(0.94)', duration: 0.2 }, 0.46)
            .to(nextImage, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.34, ease: 'power3.out' }, 0.66);
        } else {
          gsap.set(nextImage, { filter: 'none', scale: 1, xPercent: 0, yPercent: 0 });
        }
      }

      activeCase = nextIndex;
      setCaseState(nextIndex);
    };

    panels.forEach((panel, index) => {
      gsap.set(panel, {
        opacity: index === 0 ? 1 : 0,
        '--case-curtain': index === 0 ? 0 : 1,
      });
    });
    setCaseState(0);

    if (reducedMotion.matches) {
      panels.forEach((panel, index) => {
        panel.classList.toggle('is-active', index === 0);
        gsap.set(panel, { opacity: index === 0 ? 1 : 0, '--case-curtain': 0 });
      });
    } else {
      rows.forEach((row, index) => {
        const scrambleEntries = [...row.querySelectorAll('[data-case-scramble]')].map((target) => ({
          target,
          original: target.textContent ?? '',
          tween: null,
        }));

        gsap.fromTo(
          row,
          {
            opacity: mobileViewport.matches ? 0.34 : 0.16,
            y: mobileViewport.matches ? 22 : 38,
            filter: `blur(${mobileViewport.matches ? 4 : 10}px) brightness(${mobileViewport.matches ? 0.76 : 0.58})`,
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px) brightness(1)',
            ease: 'none',
            scrollTrigger: {
              trigger: row,
              start: 'clamp(top 94%)',
              end: 'clamp(top 57%)',
              scrub: mobileViewport.matches ? 0.78 : 1.18,
            },
          },
        );

        ScrollTrigger.create({
          trigger: row,
          start: 'top 64%',
          end: 'bottom 36%',
          onEnter: () => activateCase(index, 1),
          onEnterBack: () => activateCase(index, -1),
        });

        row.addEventListener('pointerenter', () => {
          if (!finePointer.matches) return;
          activateCase(index, index >= activeCase ? 1 : -1);
          scrambleEntries.forEach((entry, entryIndex) => scrambleTarget(entry, entryIndex * 0.045));
        });

        row.addEventListener('pointerleave', () => {
          scrambleEntries.forEach((entry) => {
            entry.tween?.kill();
            entry.tween = null;
            entry.target.textContent = entry.original;
            entry.target.classList.remove('is-scrambling');
          });
        });
      });
    }
  }

  const methodSequence = root.querySelector('[data-method-sequence]');
  if (methodSequence instanceof HTMLElement) {
    const steps = [...methodSequence.querySelectorAll('[data-method-step]')];
    const panels = [...methodSequence.querySelectorAll('[data-method-panel]')];
    const railIndex = methodSequence.querySelector('.method-sequence__rail-index');
    let activeMethodPanel = 0;
    let activeMethodStep = 0;

    const setMethodPanelState = (index) => {
      panels.forEach((panel, panelIndex) => {
        panel.setAttribute('aria-hidden', String(panelIndex !== index));
      });
    };

    const activateMethodPanel = (nextIndex, direction = 1, animate = true) => {
      if (!panels[nextIndex]) return;
      if (nextIndex === activeMethodPanel) {
        setMethodPanelState(nextIndex);
        return;
      }

      const previous = panels[activeMethodPanel];
      const next = panels[nextIndex];
      const previousImage = previous?.querySelector('img');
      const nextImage = next.querySelector('img');

      [previous, previousImage, next, nextImage].forEach((element) => {
        if (element) gsap.killTweensOf(element);
      });

      panels.forEach((panel) => {
        if (panel !== previous) panel.classList.remove('is-exiting');
      });

      if (previous) {
        previous.classList.remove('is-active');
        previous.classList.add('is-exiting');
        if (animate) {
          gsap.to(previous, {
            '--method-curtain': 1,
            duration: mobileViewport.matches ? 0.28 : 0.36,
            ease: 'power2.in',
            onComplete: () => {
              if (previous.classList.contains('is-active')) return;
              previous.classList.remove('is-exiting');
              gsap.set(previous, { opacity: 0 });
            },
          });
          if (previousImage) {
            gsap.to(previousImage, {
              filter: `blur(${mobileViewport.matches ? 4 : 8}px) brightness(0.48) contrast(0.82) saturate(0.48)`,
              scale: mobileViewport.matches ? 1.012 : 1.025,
              duration: mobileViewport.matches ? 0.26 : 0.34,
              ease: 'power2.in',
            });
          }
        } else {
          previous.classList.remove('is-exiting');
          gsap.set(previous, { opacity: 0, '--method-curtain': 1 });
        }
      }

      next.classList.remove('is-exiting');
      next.classList.add('is-active');
      gsap.set(next, { opacity: 1, '--method-curtain': animate ? 1 : 0 });

      if (nextImage) {
        if (animate) {
          const offset = direction >= 0 ? 5 : -5;
          gsap.timeline({ defaults: { ease: 'none' } })
            .fromTo(
              nextImage,
              {
                filter: `blur(${mobileViewport.matches ? 5 : 11}px) brightness(${mobileViewport.matches ? 0.5 : 0.36}) contrast(0.76) saturate(0.32)`,
                scale: mobileViewport.matches ? 1.035 : 1.07,
                xPercent: mobileViewport.matches ? offset * 0.45 : offset,
                yPercent: mobileViewport.matches ? 2 : 4,
              },
              { filter: 'blur(4px) brightness(0.72) contrast(0.92) saturate(0.72)', duration: 0.46 },
              0,
            )
            .to(next, { '--method-curtain': 0, duration: 0.46 }, 0)
            .to(nextImage, { filter: 'blur(0px) brightness(1) contrast(1) saturate(0.94)', duration: 0.2 }, 0.46)
            .to(nextImage, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.34, ease: 'power3.out' }, 0.66);
        } else {
          gsap.set(nextImage, { filter: 'none', scale: 1, xPercent: 0, yPercent: 0 });
        }
      }

      activeMethodPanel = nextIndex;
      setMethodPanelState(nextIndex);
    };

    panels.forEach((panel, index) => {
      gsap.set(panel, {
        opacity: index === 0 ? 1 : 0,
        '--method-curtain': index === 0 ? 0 : 1,
      });
    });
    setMethodPanelState(0);

    const markMethodStep = (index, direction = 1, animate = true) => {
      if (!steps[index]) return;
      steps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === index));
      if (railIndex) railIndex.textContent = steps[index]?.dataset.methodIndex ?? '01';
      const mappedPanelIndex = Number.parseInt(steps[index]?.dataset.methodPanelIndex ?? '', 10);
      const panelIndex = Number.isInteger(mappedPanelIndex) ? mappedPanelIndex : index;
      activateMethodPanel(Math.min(panelIndex, Math.max(0, panels.length - 1)), direction, animate);
      activeMethodStep = index;
    };

    markMethodStep(0, 1, false);

    if (reducedMotion.matches) {
      methodSequence.style.setProperty('--method-progress', '1');
      panels.forEach((panel, index) => {
        panel.classList.toggle('is-active', index === 0);
        gsap.set(panel, { opacity: index === 0 ? 1 : 0, '--method-curtain': 0 });
      });
      steps.forEach((step) => {
        step.style.removeProperty('opacity');
        step.style.removeProperty('filter');
        step.style.removeProperty('transform');
      });

      const reducedMotionObserver = new IntersectionObserver((entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => Math.abs(first.boundingClientRect.top - window.innerHeight * 0.5)
            - Math.abs(second.boundingClientRect.top - window.innerHeight * 0.5))[0];
        if (!visibleEntry) return;
        const nextIndex = steps.indexOf(visibleEntry.target);
        if (nextIndex < 0) return;
        markMethodStep(nextIndex, nextIndex >= activeMethodStep ? 1 : -1, false);
      }, { rootMargin: '-42% 0px -42% 0px' });

      steps.forEach((step) => reducedMotionObserver.observe(step));
    } else {
      gsap.fromTo(
        methodSequence,
        { '--method-progress': 0 },
        {
          '--method-progress': 1,
          ease: 'none',
          scrollTrigger: {
            trigger: methodSequence,
            start: 'clamp(top 76%)',
            end: 'clamp(bottom 42%)',
            scrub: mobileViewport.matches ? 0.86 : 1.3,
          },
        },
      );

      steps.forEach((step, index) => {
        const title = step.querySelector('.method-step__title');
        const copy = step.querySelector('.method-step__copy');
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: step,
            start: 'clamp(top 93%)',
            end: 'clamp(top 53%)',
            scrub: mobileViewport.matches ? 0.74 : 1.12,
          },
        });

        timeline.fromTo(
          step,
          { opacity: 0.14, y: mobileViewport.matches ? 24 : 46, filter: `blur(${mobileViewport.matches ? 5 : 11}px) brightness(0.52)` },
          { opacity: 1, y: 0, filter: 'blur(0px) brightness(1)', ease: 'none', duration: 1 },
          0,
        );
        if (title) timeline.fromTo(title, { x: mobileViewport.matches ? 0 : 24 }, { x: 0, ease: 'none', duration: 0.84 }, 0.16);
        if (copy) timeline.fromTo(copy, { opacity: 0.3 }, { opacity: 1, ease: 'none', duration: 0.62 }, 0.32);

        ScrollTrigger.create({
          trigger: step,
          start: mobileViewport.matches ? 'top 66%' : 'top 58%',
          end: 'bottom top',
          onEnter: () => markMethodStep(index, 1),
          onEnterBack: () => markMethodStep(index, -1),
          onLeaveBack: () => markMethodStep(Math.max(0, index - 1), -1),
        });
      });

      requestAnimationFrame(() => {
        const activationLine = window.innerHeight * (mobileViewport.matches ? 0.66 : 0.58);
        let initialStep = 0;
        steps.forEach((step, index) => {
          if (step.getBoundingClientRect().top <= activationLine) initialStep = index;
        });
        markMethodStep(initialStep, initialStep >= activeMethodStep ? 1 : -1, false);
      });
    }
  }

  if (finePointer.matches && !reducedMotion.matches) {
    root.querySelectorAll('[data-motion-row]').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;

      const moveX = gsap.quickTo(row, '--sm-mx', { duration: 0.72, ease: 'power3.out' });
      const moveY = gsap.quickTo(row, '--sm-my', { duration: 0.72, ease: 'power3.out' });
      let preview = null;
      let previewX = null;
      let previewY = null;

      if (row.dataset.motionPreview) {
        preview = document.createElement('span');
        preview.className = 'motion-row-preview';
        preview.setAttribute('aria-hidden', 'true');

        const index = document.createElement('span');
        index.className = 'motion-row-preview__index';
        index.textContent = row.dataset.motionIndex ?? 'S/F';

        const label = document.createElement('span');
        label.className = 'motion-row-preview__label';
        label.textContent = row.dataset.motionPreview;

        preview.append(index, label);
        row.append(preview);
        previewX = gsap.quickTo(preview, 'left', { duration: 0.5, ease: 'power3.out' });
        previewY = gsap.quickTo(preview, 'top', { duration: 0.5, ease: 'power3.out' });
      }

      const updatePointer = (event) => {
        const bounds = row.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const nx = x / bounds.width - 0.5;
        const ny = y / bounds.height - 0.5;

        row.style.setProperty('--sm-px', `${x}px`);
        row.style.setProperty('--sm-py', `${y}px`);
        moveX(`${(nx * 7).toFixed(2)}px`);
        moveY(`${(ny * 5).toFixed(2)}px`);

        if (preview && previewX && previewY) {
          const halfWidth = Math.min(115, bounds.width * 0.16);
          const halfHeight = 68;
          previewX(Math.max(halfWidth, Math.min(bounds.width - halfWidth, x)));
          previewY(Math.max(halfHeight, Math.min(bounds.height - halfHeight, y)));
        }
      };

      row.addEventListener('pointerenter', (event) => {
        updatePointer(event);
        preview?.classList.add('is-visible');
      });
      row.addEventListener('pointermove', updatePointer, { passive: true });
      row.addEventListener('pointerleave', () => {
        moveX('0px');
        moveY('0px');
        preview?.classList.remove('is-visible');
      });
    });
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  } else {
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
}
