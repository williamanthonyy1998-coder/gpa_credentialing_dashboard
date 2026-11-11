/** Reveal themed scrollbars while an element is actively scrolling. */
const timers = new WeakMap();

function markScrolling(target) {
  if (!(target instanceof Element)) return;
  target.classList.add('is-scrolling');
  const prev = timers.get(target);
  if (prev) window.clearTimeout(prev);
  timers.set(
    target,
    window.setTimeout(() => {
      target.classList.remove('is-scrolling');
      timers.delete(target);
    }, 900)
  );
}

export function initScrollReveal() {
  if (typeof document === 'undefined') return () => {};

  const onScroll = (event) => {
    const target = event.target;
    if (target === document || target === document.documentElement || target === document.body) {
      markScrolling(document.documentElement);
      return;
    }
    markScrolling(target);
  };

  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => document.removeEventListener('scroll', onScroll, { capture: true });
}
