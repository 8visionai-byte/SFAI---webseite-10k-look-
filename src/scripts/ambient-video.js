// Ambient video controller.
// Odtwarzanie robi natywny atrybut `autoplay` (Chrome sam startuje wyciszone wideo,
// gdy wejdzie w viewport, i sam odracza ładowanie plików offscreen).
// Ten skrypt tylko: pauzuje wideo poza viewportem i przy ukryciu karty (oszczędność CPU/baterii),
// wznawia po powrocie, oraz respektuje prefers-reduced-motion (zostaje poster).
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const videos = [...document.querySelectorAll('[data-ambient-video]')];

if (videos.length) {
  const tryPlay = (video) => {
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  };

  if (reduced) {
    // Bez ruchu: zdejmij autoplay i zatrzymaj — pozostaje sam poster.
    videos.forEach((video) => {
      video.removeAttribute('autoplay');
      video.autoplay = false;
      video.pause();
    });
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.dataset.ambientInview = '1';
          if (!document.hidden && video.paused) tryPlay(video);
        } else {
          video.dataset.ambientInview = '';
          if (!video.paused) video.pause();
        }
      });
    }, { threshold: 0.15, rootMargin: '15% 0px 15% 0px' });

    videos.forEach((video) => {
      video.muted = true;
      observer.observe(video);
    });

    document.addEventListener('visibilitychange', () => {
      videos.forEach((video) => {
        if (document.hidden) {
          video.pause();
        } else if (video.dataset.ambientInview === '1' && video.paused) {
          tryPlay(video);
        }
      });
    });
  }
}
