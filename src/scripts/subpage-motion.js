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
