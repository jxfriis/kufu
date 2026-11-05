// Friis's motion language, ported from Offload's Motion.cs: things squash when pressed and spring back
// with a little overshoot. The curves are WPF's own ElasticEase / BackEase formulas, sampled into CSS
// linear() easings, so the bounce matches Offload exactly.
// Scale and translate are animated as separate CSS properties, so a squash never wipes out a slide.
const Motion = (() => {
  const elasticIn = (oscillations, springiness) => t => {
    const expo = springiness === 0 ? t : (Math.exp(springiness * t) - 1) / (Math.exp(springiness) - 1);
    return expo * Math.sin((Math.PI * 2 * oscillations + Math.PI / 2) * t);
  };
  const backIn = amplitude => t => t * t * t - t * amplitude * Math.sin(Math.PI * t);
  const easeOut = f => t => 1 - f(1 - t);
  const sample = (f, n = 72) => `linear(${Array.from({ length: n + 1 }, (_, i) => +f(i / n).toFixed(4)).join(', ')})`;

  const Ease = {
    spring: sample(easeOut(elasticIn(2, 6)), 96),   // ElasticEase { Oscillations = 2, Springiness = 6 }
    bouncy: sample(easeOut(elasticIn(1, 4))),       // ElasticEase { Oscillations = 1, Springiness = 4 }
    back: sample(easeOut(backIn(0.45))),            // BackEase { Amplitude = 0.45 }
    settle: sample(easeOut(backIn(0.22))),          // BackEase { Amplitude = 0.22 }
    wobble: sample(easeOut(elasticIn(5, 2)), 120),  // the "no" shake
    quick: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',  // QuadraticEase out
  };
  document.documentElement.style.setProperty('--bouncy', Ease.bouncy);
  document.documentElement.style.setProperty('--quick', Ease.quick);

  // per element, the running animation of each property
  const running = new WeakMap();
  const track = (el, prop, a) => { let m = running.get(el); if (!m) running.set(el, m = {}); m[prop] = a; return a; };
  const current = (el, prop) => running.get(el)?.[prop];

  /** Animate one CSS property from wherever it is right now (mid-animation included) to `value`. */
  function to(el, prop, value, ms, easing) {
    const from = getComputedStyle(el)[prop];
    const old = current(el, prop);
    if (old && old.playState !== 'idle') { if (el.isConnected && el.offsetParent !== null) old.commitStyles?.(); old.cancel(); }
    const a = track(el, prop, el.animate([{ [prop]: from }, { [prop]: value }], { duration: ms, easing, fill: 'forwards', id: prop }));
    a.onfinish = () => { el.style[prop] = value; a.cancel(); };
    return a;
  }

  function fromTo(el, prop, from, value, ms, easing, delay = 0) {
    current(el, prop)?.cancel();
    el.style[prop] = value;
    return track(el, prop, el.animate([{ [prop]: from }, { [prop]: value }], { duration: ms, easing, delay, fill: 'backwards', id: prop }));
  }

  const press = el => to(el, 'scale', '0.94', 90, Ease.quick);
  const springBack = el => to(el, 'scale', '1', 650, Ease.spring);

  /** Squash to `from`, then spring back to full size. */
  const pop = (el, from = 0.94) => fromTo(el, 'scale', String(from), '1', 700, Ease.spring);

  /** Scale up from small with an elastic overshoot (cards, badges, dialogs). */
  function popIn(el, delay = 0) {
    fromTo(el, 'opacity', '0', '1', 180, 'linear', delay);
    fromTo(el, 'scale', '0.82', '1', 700, Ease.spring, delay);
  }

  /** Fade in while springing in from an offset (messages, toasts, panels). */
  function enter(el, dx, dy, delay = 0) {
    fromTo(el, 'opacity', '0', '1', 220, 'linear', delay);
    fromTo(el, 'translate', `${dx}px ${dy}px`, '0px 0px', 650, Ease.bouncy, delay);
  }

  const shake = el => fromTo(el, 'translate', '12px 0px', '0px 0px', 800, Ease.wobble);

  function fadeOut(el, done) {
    const a = to(el, 'opacity', '0', 160, Ease.quick);
    a.addEventListener('finish', () => { done ? done() : el.remove(); });
  }

  /** Spring a size (progress fills, the switch knob, expanding embeds). gentle = one small overshoot. */
  const size = (el, prop, px, gentle) => to(el, prop, `${px}px`, gentle ? 360 : 750, gentle ? Ease.settle : Ease.spring);
  const slideX = (el, px, gentle) => to(el, 'translate', `${px}px 0px`, gentle ? 360 : 750, gentle ? Ease.settle : Ease.spring);

  /** A ring bursts out of a status dot a few times ("he's here!"). */
  function ping(ring, times = 3) {
    ring.animate([{ scale: '1', opacity: 0.9 }, { scale: '3.4', opacity: 0 }], { duration: 900, iterations: times, easing: Ease.quick });
  }

  // Every button (and anything marked .press) squashes on press and springs back on release — installed
  // once at document level, like Offload's class handlers, so nothing needs per-element wiring.
  function install() {
    let held = null;
    document.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const el = e.target.closest('button, .press');
      if (!el || el.disabled || el.classList.contains('no-press')) return;
      held = el;
      Motion.press(el);
    }, true);
    const release = () => { if (held) { Motion.springBack(held); held = null; } };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    document.addEventListener('pointerout', e => { if (held && e.target === held && !held.contains(e.relatedTarget)) release(); }, true);
  }

  return { Ease, to, fromTo, press, springBack, pop, popIn, enter, shake, fadeOut, size, slideX, ping, install };
})();
