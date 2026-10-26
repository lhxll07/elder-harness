const slide = document.querySelector('.slide');

function fitSlide() {
  const scale = Math.min(window.innerWidth / 2048, window.innerHeight / 1152);
  slide.style.setProperty('--slide-scale', String(scale));
}

fitSlide();
window.addEventListener('resize', fitSlide);
document.addEventListener('keydown', async (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const destinations = {
    ArrowLeft: slide.dataset.previous,
    ArrowRight: slide.dataset.next,
    Home: 'cover.html',
    End: 'p17.html',
  };
  if (destinations[event.key]) {
    event.preventDefault();
    window.location.href = destinations[event.key];
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      document.documentElement.dataset.fullscreen = 'unavailable';
    }
  }
});
document.fonts.ready.then(() => {
  document.documentElement.dataset.ready = 'true';
});
