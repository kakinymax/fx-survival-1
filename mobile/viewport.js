// Fixed controls follow the visible area, including zoom, panning and the
// software keyboard. Game state and the user's chosen zoom are left alone.
export function installMobileViewport(window, root) {
  const sync = () => {
    const viewport = window.visualViewport;
    root.style.setProperty('--mobile-viewport-left', `${viewport?.offsetLeft ?? 0}px`);
    root.style.setProperty('--mobile-viewport-width', `${viewport?.width ?? window.innerWidth}px`);
    root.style.setProperty('--mobile-viewport-bottom',
      `${viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0}px`);
  };
  window.visualViewport?.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('pageshow', sync);
  sync();
}
