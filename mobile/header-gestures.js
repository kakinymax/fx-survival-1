// WKWebView can smart-zoom non-clickable text despite touch-action:
// manipulation (WebKit bug 319664). Cancel taps on the decorative header
// itself; leave its controls, scrolling, long presses and multi-touch alone.
export function installHeaderGestures(header) {
  if (!header) return;
  const interactive = target => target.closest?.(
    'button,a,input,select,textarea,summary,[role="button"],[role="link"],[contenteditable]:not([contenteditable="false"])');
  // Give WebKit a click target for decorative text/empty space too. Otherwise
  // its fast-tap policy can skip these nodes or adjust the touch to nearby UI.
  // This listener performs no action and does not consume control clicks.
  header.addEventListener('click', () => {});
  let tap = null;
  header.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    tap = event.touches.length === 1 && !interactive(event.target)
      ? { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp } : null;
  }, { passive: true });
  // A second finger can start outside the header while the first stays on it.
  header.ownerDocument.addEventListener('touchstart', event => {
    if (event.touches.length > 1) tap = null;
  }, { passive: true });
  header.addEventListener('touchmove', event => {
    const touch = [...event.touches].find(touch => touch.identifier === tap?.id);
    if (!touch || Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 10) tap = null;
  }, { passive: true });
  header.addEventListener('touchcancel', () => { tap = null; }, { passive: true });
  header.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    if (tap && !event.touches.length && event.changedTouches.length === 1
      && touch.identifier === tap.id && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) <= 10
      && event.timeStamp - tap.time < 500 && !interactive(event.target) && event.cancelable) {
      event.preventDefault();
    }
    tap = null;
  }, { passive: false });
}
