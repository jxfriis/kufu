'use strict';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!still) Motion.install();
const $ = id => document.getElementById(id);
const el = (tag, cls, ...kids) => { const n = document.createElement(tag); if (cls) n.className = cls; n.append(...kids.filter(k => k != null)); return n; };
const on = (n, ev, f, o) => n.addEventListener(ev, f, o);
const pad = n => String(n).padStart(2, '0');
const mix = (a, b, f) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join(''); };
const pop = (n, s = .94) => { if (!still) Motion.pop(n, s); };

/* real grain, the same as the app: a bright half added, a dark half subtracted */
const grain = table => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" stitchTiles="stitch"/><feColorMatrix values="3 0 0 0 -1 3 0 0 0 -1 3 0 0 0 -1 0 0 0 0 1"/><feComponentTransfer>${['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${table}"/>`).join('')}</feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`)}")`;
document.querySelector('.grain.add').style.backgroundImage = grain('0 0 0 0 0 .04 .08 .12 .16');
document.querySelector('.grain.sub').style.backgroundImage = grain('.16 .12 .08 .04 0 0 0 0 0');

/* a segmented control with the app's springy pill */
function segment(box, change) {
  const pill = box.querySelector('.seg-pill'), buttons = [...box.querySelectorAll('button')];
  const place = (b, animate) => {
    if (!b.offsetWidth) return;
    if (animate && !still) { Motion.slideX(pill, b.offsetLeft - 3); Motion.size(pill, 'width', b.offsetWidth); }
    else { pill.style.translate = `${b.offsetLeft - 3}px 0px`; pill.style.width = b.offsetWidth + 'px'; }
  };
  box.place = b => place(b, true);
  const again = () => place(buttons.find(b => b.classList.contains('on')), false);
  again(); document.fonts?.ready.then(again); on(window, 'resize', again);
  for (const b of buttons) {
    b.setAttribute('aria-pressed', b.classList.contains('on'));
    on(b, 'click', () => {
      if (b.classList.contains('on')) return;
      for (const x of buttons) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }
      place(b, true);
      change(b.dataset.v);
    });
  }
}

const segPlace = (box, b) => box.place?.(b);

/* the page's color slides from section to section as you scroll */
const bgs = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) document.body.style.backgroundColor = e.target.dataset.bg; }, { rootMargin: '-45% 0px -45% 0px' });
document.querySelectorAll('[data-bg]').forEach(s => bgs.observe(s));

/* things spring in as they arrive */
const seen = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) {
    seen.unobserve(e.target);
    e.target.classList.remove('wait');
    Motion.enter(e.target, 0, 26, (+e.target.dataset.i || 0) * 50);
  }
}, { rootMargin: '0px 0px -8% 0px' });
if (!still) document.querySelectorAll('.rv').forEach(n => { n.classList.add('wait'); const sibs = [...n.parentElement.children].filter(x => x.classList.contains('rv')); n.dataset.i = Math.min(sibs.indexOf(n), 5); seen.observe(n); });

/* ---------- the hero: a real clock over Japan at this very hour ---------- */
const clock = $('clock');
const makeDigit = () => { const s = el('div', 'digit', el('b')); on(s, 'pointerdown', () => pop(s, .86)); return s; };
const slots = [makeDigit(), makeDigit(), makeDigit(), makeDigit()];
clock.append(slots[0], slots[1], el('div', 'gap', el('i'), el('i')), slots[2], slots[3]);
function show(slot, ch, animate) {
  const cur = slot.lastChild;
  if (cur.textContent === ch) return;
  if (!animate || still || document.hidden) { cur.textContent = ch; return; }
  const next = el('b'); next.textContent = ch;
  slot.append(next);
  Motion.enter(next, 0, 22);
  Motion.fadeOut(cur);
  pop(slot, .95);
}
const hourParam = +new URLSearchParams(location.search).get('hour');
const fixed = location.search.includes('hour=') && hourParam >= 0 && hourParam < 24 ? hourParam : null;
const nowHour = () => { if (fixed != null) return fixed; const n = new Date(); return n.getHours() + n.getMinutes() / 60; };
function tick(animate) {
  const h = nowHour(), text = pad(Math.floor(h)) + pad(Math.floor((h % 1) * 60 + 1e-6));
  slots.forEach((slot, i) => show(slot, text[i], animate));
}
tick(false);
if (!still) slots.forEach((s, i) => Motion.popIn(s, 60 + i * 55));

// the colors of the scene through a day, in Japan's own light
const DAY = [
  // hour, sky top, sky middle, sky low, sun, fuji, haze, snow, far hills, near hills, shore, lake, deep lake, mist, pine, blossom, torii, lamps, stars, birds
  [0, '#04060F', '#0A1230', '#1A2350', '#F5EEDF', '#18214A', '#202A58', '#8E9ACB', '#121A3C', '#0B1029', '#05070F', '#101A3C', '#05081A', '#26305E', '#04060E', '#5C3550', '#7A2416', 1, 1, 0],
  [4.6, '#070B22', '#1C1F4E', '#4A3A6C', '#F5EEDF', '#262A5A', '#3B3466', '#ADA8D2', '#1C1D44', '#111232', '#070816', '#26285A', '#0B0C24', '#4A4280', '#06070F', '#7A4566', '#8A2C1B', .9, .6, 0],
  [6.2, '#1F2E6E', '#8B5E92', '#F0A07E', '#FF6A3D', '#5E5687', '#C48A8E', '#F6DCE0', '#3E3868', '#272448', '#120F26', '#9A6E8E', '#2C2448', '#F1B6A8', '#0E0C1C', '#E7A2B8', '#C23A22', .25, 0, .4],
  [8, '#3672C0', '#7FB2E2', '#F4DCC4', '#FFB070', '#6D8CC2', '#B9CBE2', '#FFFFFF', '#476F9F', '#2C5480', '#14263E', '#7FAED6', '#2A4E78', '#FFFFFF', '#14241E', '#F4A6C0', '#E8442A', 0, 0, 1],
  [12.5, '#2A6FC8', '#73AEE6', '#CDE6F4', '#FFF1D2', '#6C93C9', '#BCD5EC', '#FFFFFF', '#4878AA', '#2E5A88', '#15283F', '#74AAD8', '#244A76', '#FFFFFF', '#13261F', '#F6AAC4', '#EA4A2E', 0, 0, 1],
  [16.2, '#3B6FB8', '#94B6DC', '#F2D3A6', '#FFC27A', '#7487B6', '#D8C3B6', '#FFF4E6', '#556A98', '#34466E', '#1A2438', '#B7AFB8', '#3A4466', '#FFF1DE', '#16201E', '#F2A2BC', '#E8442A', 0, 0, 1],
  [18.1, '#252A6A', '#B5527A', '#FA8A4A', '#FF5436', '#5E4170', '#C2617A', '#FFD3C2', '#45305E', '#2D2146', '#120D22', '#D2735E', '#3A2242', '#FFAE88', '#0F0A18', '#F096AE', '#D63E24', .45, 0, .6],
  [19.3, '#141B48', '#43306C', '#91496C', '#FF5436', '#33305E', '#5A3E6E', '#C7B2D4', '#241E46', '#191538', '#0A0818', '#4A3A6A', '#120E2A', '#6A4A7E', '#08070F', '#A86488', '#9E3020', 1, .35, 0],
  [21, '#070A1E', '#0F1638', '#232A5C', '#F5EEDF', '#1C2450', '#262E60', '#98A2CF', '#151C40', '#0D112C', '#060811', '#14204A', '#06091C', '#2C3666', '#05060E', '#64395A', '#80261A', 1, .9, 0],
  [24, '#04060F', '#0A1230', '#1A2350', '#F5EEDF', '#18214A', '#202A58', '#8E9ACB', '#121A3C', '#0B1029', '#05070F', '#101A3C', '#05081A', '#26305E', '#04060E', '#5C3550', '#7A2416', 1, 1, 0],
];
const VARS = ['--sky0', '--sky1', '--sky2', '--sun', '--far', '--haze', '--snow', '--r1', '--r2', '--shore-c', '--water', '--deep', '--cloud', '--pine', '--blossom', '--torii', '--lamp', '--stars', '--birds'];
const hero = $('hero'), scene = $('scene'), sun = $('sun'), moon = $('moon'), sunpath = $('sunpath');
function paintSky(h) {
  let i = 0; while (i < DAY.length - 2 && h >= DAY[i + 1][0]) i++;
  const a = DAY[i], b = DAY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  VARS.forEach((name, k) => {
    const x = a[k + 1], y = b[k + 1];
    hero.style.setProperty(name, typeof x === 'number' ? (x + (y - x) * t).toFixed(3) : mix(x, y, t));
  });
  // the sun crosses from the left hills to behind Fuji; at night the moon takes its path
  const day = h >= 5.9 && h < 18.9, span = day ? [5.9, 18.9] : [18.9, 29.9], hh = !day && h < 5.9 ? h + 24 : h;
  // a wide ellipse: low over the hills at the ends of the day, high over the clock at its middle
  const p = (hh - span[0]) / (span[1] - span[0]);
  // the moon keeps to the left of the clock, over the pagoda
  const x = day ? 800 - Math.cos(p * Math.PI) * 790 : 110 + p * 560, y = day ? 690 - Math.sin(p * Math.PI) * 560 : 610 - Math.sin(p * Math.PI) * 420;
  sun.style.transform = `translate(${x}px, ${y}px)`;
  moon.style.transform = `translate(${x}px, ${y}px)`;
  sun.style.opacity = day ? 1 : 0;
  moon.style.opacity = day ? 0 : 1;
  // light on the water: strongest when the sun is low, and only when it is up
  const low = day ? Math.max(0, 1 - Math.sin(p * Math.PI) * 1.4) : .35 * Math.sin(p * Math.PI);
  sunpath.style.transform = `translateX(${x}px)`;
  sunpath.style.opacity = (day ? .25 + low * .6 : low).toFixed(2);
}
let heroVisible = true;
paintSky(nowHour());
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; hero.classList.toggle('still', !e.isIntersecting); }).observe(hero);
// the minute turns over on the minute, and the light moves with it
const nextMinute = () => setTimeout(() => { if (!document.hidden) { tick(true); paintSky(nowHour()); } nextMinute(); }, 60000 - (Date.now() % 60000) + 30);
nextMinute();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(false); paintSky(nowHour()); } });

// cherry petals drifting from the branch
if (!still) {
  const box = $('petals');
  for (let i = 0; i < 14; i++) {
    const p = el('i');
    p.style.cssText = `left:${(Math.random() * 30).toFixed(1)}%;top:${(Math.random() * 22).toFixed(1)}%;--dx:${(30 + Math.random() * 55).toFixed(0)}vw;--dy:${(45 + Math.random() * 45).toFixed(0)}vh;--r:${(180 + Math.random() * 540).toFixed(0)}deg;animation-duration:${(11 + Math.random() * 10).toFixed(1)}s;animation-delay:-${(Math.random() * 20).toFixed(1)}s;scale:${(.6 + Math.random() * .7).toFixed(2)}`;
    box.append(p);
  }
}
// the title lands letter by letter
const title = $('title');
if (!still) {
  const text = title.textContent;
  title.setAttribute('aria-label', text);
  title.textContent = '';
  let n = 0;
  for (const word of text.split(' ')) {
    const w = el('span', 'word');
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) { const s = el('span', 'ch'); s.textContent = ch; w.append(s); Motion.enter(s, 0, 34, 260 + n++ * 26); }
    title.append(w, ' ');
  }
}
// the mountains drift with the pointer and the scroll
if (!still) {
  const layers = [...document.querySelectorAll('.scene .layer')].map(n => [n, +n.dataset.depth]);
  let px = 0, py = 0, want = false;
  const paint = () => { want = false; for (const [n, d] of layers) n.style.transform = `translate(${(-px * d).toFixed(1)}px, ${(py * d * 2).toFixed(1)}px)`; };
  const ask = () => { if (!want) { want = true; requestAnimationFrame(paint); } };
  on(hero, 'pointermove', e => { px = e.clientX / innerWidth - .5; ask(); }, { passive: true });
  on(window, 'scroll', () => { if (heroVisible) { py = scrollY / innerHeight; ask(); } }, { passive: true });
}

/* ---------- three designs, and a cursor that shows you round them ---------- */
const LINKS = [['G', '#EA4335', 'Gmail'], ['Y', '#FF3355', 'YouTube'], ['G', '#8AA4FF', 'GitHub'], ['C', '#E8835A', 'Claude'], ['S', '#2BD46A', 'Spotify'], ['U', '#D7DBE2', 'Unsplash']];
const weekNow = () => { const d = new Date(), start = new Date(d); start.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [...Array(7)].map((_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return { n: x.getDate(), l: 'MTWTFSS'[i], today: x.toDateString() === d.toDateString() }; }); };
const dayName = () => new Date().toLocaleDateString('en', { weekday: 'long' });

(() => {
  const CAP = {
    keys: 'Keys: every digit and link is a key that squashes and springs back.',
    glass: 'Glass: clear surfaces that bend your wallpaper behind them, with springs to match.',
    paper: 'Paper: flat and quiet, with thin lines instead of depth.',
  };
  const wrap = $('stackwrap'), stack = $('stack'), seg = $('designs'), caption = $('caption');
  const cards = [...stack.querySelectorAll('.shot-card')], buttons = [...seg.querySelectorAll('button')], order = cards.map(c => c.dataset.v);
  let at = 0, timer = 0, auto = !still, visible = false;
  // where each card sits: in front, or turned away to one side behind it
  const pose = slot => slot === 0 ? { t: 'translate3d(0,0,0) rotateY(0deg) scale(1)', o: 1, z: 3, f: 'brightness(1)' }
    : { t: `translate3d(${slot * 33}%, -1%, -240px) rotateY(${-slot * 36}deg) scale(.74)`, o: 1, z: 1, f: 'brightness(.72) saturate(.9)' };
  const place = animate => cards.forEach((c, i) => {
    let slot = (i - at + 3) % 3; if (slot === 2) slot = -1;
    const p = pose(slot);
    c.style.zIndex = p.z;
    c.classList.toggle('front', slot === 0);
    if (animate && !still) {
      const from = getComputedStyle(c);
      c.animate([{ transform: from.transform, filter: from.filter }, { transform: p.t, filter: p.f }], { duration: 820, easing: Motion.Ease.bouncy, fill: 'none' });
    }
    c.style.transform = p.t; c.style.filter = p.f; c.style.opacity = p.o;
  });
  function go(i, by) {
    i = (i + 3) % 3;
    if (by === 'you') { auto = false; stop(); }
    if (i === at) return;
    at = i;
    for (const b of buttons) { const on = b.dataset.v === order[at]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    seg.place?.(buttons[at]);
    caption.textContent = CAP[order[at]];
    if (!still) Motion.enter(caption, 0, 8);
    place(true);
    if (auto) schedule();
  }
  segment(seg, v => go(order.indexOf(v), 'you'));
  cards.forEach((c, i) => on(c, 'click', () => go(i, 'you')));
  // a swipe turns the stack
  let sx = null;
  on(stack, 'dragstart', e => e.preventDefault());
  on(stack, 'pointerdown', e => { sx = e.clientX; });
  on(window, 'pointercancel', () => { sx = null; });
  on(stack, 'click', e => { if (swiped) { e.stopPropagation(); swiped = false; } }, true);
  let swiped = false;
  on(window, 'pointerup', e => { if (sx == null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 40) { swiped = true; go(at + (d < 0 ? 1 : -1), 'you'); } });
  function stop() { clearTimeout(timer); buttons.forEach(b => b.classList.remove('timing')); }
  function schedule() { stop(); if (!auto || !visible) return; void buttons[at].offsetWidth; buttons[at].classList.add('timing'); timer = setTimeout(() => go(at + 1), 4200); }
  place(false);
  // as you scroll in, the stack swings up to face you; the pointer tips it a little
  let tilt = 0, px = 0, py = 0, frame = 0;
  const paint = () => { frame = 0; stack.style.transform = `rotateX(${(tilt * 22 + py * 5).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(${(tilt * 60).toFixed(1)}px) scale(${(1 - tilt * .1).toFixed(3)})`; };
  const ask = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const onScroll = () => { const r = wrap.getBoundingClientRect(), mid = r.top + r.height / 2; tilt = Math.max(-1, Math.min(1, (mid - innerHeight / 2) / innerHeight * 1.6)); ask(); };
  if (!still) {
    on(window, 'scroll', () => { if (visible) onScroll(); }, { passive: true });
    on(wrap, 'pointermove', e => { const r = wrap.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - .5; py = .5 - (e.clientY - r.top) / r.height; ask(); }, { passive: true });
    on(wrap, 'pointerleave', () => { px = py = 0; ask(); });
    onScroll();
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { onScroll(); schedule(); } else stop(); }, { threshold: .4 }).observe(wrap);
})();

/* ---------- the features: one stage, a short list, and each one comes to you in turn ---------- */
(() => {
  const list = $('featlist'), stage = $('featstage'), box = $('feat');
  const items = [...stage.querySelectorAll('.card')];
  let at = 0, timer = 0, auto = !still, visible = false, holding = false;
  const rows = items.map((c, i) => {
    const b = el('button', 'feat-item no-press', el('span', '', c.querySelector('h3').textContent), el('i', 'feat-time'));
    b.style.setProperty('--tint', getComputedStyle(c).getPropertyValue('--tint'));
    on(b, 'click', () => { auto = false; show(i); });
    list.append(el('li', '', b));
    return b;
  });
  function show(i, first) {
    const prev = items[at];
    at = (i + items.length) % items.length;
    rows.forEach((r, k) => { r.classList.toggle('on', k === at); r.setAttribute('aria-current', k === at ? 'true' : 'false'); });
    items.forEach((c, k) => { c.classList.toggle('on', k === at); c.inert = k !== at; });
    stage.style.setProperty('--tint', getComputedStyle(items[at]).getPropertyValue('--tint'));
    if (!first && !still && prev !== items[at]) {
      prev.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-30px) scale(.96)' }], { duration: 260, easing: 'ease-in' });
      items[at].animate([{ opacity: 0, transform: 'translateX(40px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: Motion.Ease.bouncy });
      [...items[at].querySelectorAll('.demo > *')].forEach((n, k) => Motion.popIn(n, 120 + k * 60));
    }
    schedule();
  }
  function stop() { clearTimeout(timer); rows.forEach(r => r.classList.remove('timing')); }
  function schedule() { stop(); if (!auto || !visible || holding) return; void rows[at].offsetWidth; rows[at].classList.add('timing'); timer = setTimeout(() => show(at + 1), 5200); }
  // using a demo stops the turning; leaving it starts again
  on(stage, 'pointerenter', () => { holding = true; stop(); });
  on(stage, 'pointerleave', () => { holding = false; schedule(); });
  on(stage, 'focusin', () => { holding = true; stop(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? schedule() : stop(); }, { threshold: .35 }).observe(box);
  show(0, true);
  if (!still && matchMedia('(hover: hover)').matches) {
    on(stage, 'pointermove', e => { const r = stage.getBoundingClientRect(); stage.style.transform = `perspective(1100px) rotateX(${((.5 - (e.clientY - r.top) / r.height) * 2.4).toFixed(2)}deg) rotateY(${(((e.clientX - r.left) / r.width - .5) * 2.4).toFixed(2)}deg)`; }, { passive: true });
    on(stage, 'pointerleave', () => { stage.style.transform = ''; });
  }
})();

/* ---------- live feature cards ---------- */
// weather
(() => {
  const box = $('d-weather');
  const temps = [9, 8, 7, 6, 5, 5, 6, 8, 11, 13, 14, 13, 11, 10];
  const lo = Math.min(...temps), hi = Math.max(...temps), W = 240, H = 60, x = i => i * W / (temps.length - 1), y = v => 12 + (H - 26) * (1 - (v - lo) / (hi - lo));
  let d = `M0 ${y(temps[0])}`;
  for (let i = 1; i < temps.length; i++) { const m = (x(i - 1) + x(i)) / 2; d += ` C${m} ${y(temps[i - 1])} ${m} ${y(temps[i])} ${x(i)} ${y(temps[i])}`; }
  const pill = el('button', 'w-pill no-press', el('i', 'w-sun'), el('b', '', '12°'), el('span', '', 'Clear, Kyoto'));
  const open = el('div', 'w-open');
  open.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="dwx" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${y(hi)}" y2="${y(lo)}"><stop stop-color="#FF5F45"/><stop offset=".5" stop-color="#FFC95C"/><stop offset="1" stop-color="#5DB4FF"/></linearGradient></defs><path d="${d} L${W} ${H} L0 ${H}Z" fill="url(#dwx)" fill-opacity=".22"/><path class="w-line" pathLength="1" d="${d}" fill="none" stroke="url(#dwx)" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><div class="w-days"><span>Fri<b>13°</b></span><span>Sat<b>15°</b></span><span>Sun<b>11°</b></span><span>Mon<b>9°</b></span></div>`;
  open.hidden = true;
  on(pill, 'click', () => {
    open.hidden = !open.hidden;
    pop(pill, .9);
    if (!open.hidden && !still) { Motion.enter(open, 0, -14); open.querySelector('.w-line').animate([{ strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDasharray: 1, strokeDashoffset: 0 }], { duration: 900, easing: Motion.Ease.settle }); [...open.querySelectorAll('.w-days span')].forEach((s, i) => Motion.popIn(s, 120 + i * 60)); }
  });
  box.append(pill, open);
})();
// palette: a small, safe calculator and a search
(() => {
  const box = $('d-palette'), input = el('input', 'p-input'), out = el('div', 'p-out');
  input.type = 'text'; input.placeholder = 'Search links, actions, or do some math…'; input.spellcheck = false; input.setAttribute('aria-label', 'Try the command palette');
  const ITEMS = ['Gmail', 'GitHub', 'YouTube', 'Spotify', 'Claude', 'Unsplash', 'Arrange page', 'Dark mode', 'Light mode', 'Start Pomodoro', 'New quote', 'Settings', 'Hide everything'];
  // numbers and + - * / ( ) only, read by hand
  const calc = s => {
    const t = s.replace(/\s/g, ''); let i = 0;
    if (!/^[-+*/().,0-9]+$/.test(t) || !/\d/.test(t)) return null;
    const num = () => { if (t[i] === '(') { i++; const v = sum(); if (t[i++] !== ')') throw 0; return v; } if (t[i] === '-') { i++; return -num(); } const m = /^[0-9]*[.,]?[0-9]+/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0].replace(',', '.')); };
    const prod = () => { let v = num(); while (t[i] === '*' || t[i] === '/') { const o = t[i++], r = num(); v = o === '*' ? v * r : v / r; } return v; };
    const sum = () => { let v = prod(); while (t[i] === '+' || t[i] === '-') { const o = t[i++], r = prod(); v = o === '+' ? v + r : v - r; } return v; };
    try { const v = sum(); return i === t.length && isFinite(v) ? v : null; } catch { return null; }
  };
  const draw = () => {
    const q = input.value.trim(), m = q && /[-+*/]/.test(q) ? calc(q) : null;
    const rows = !q ? ITEMS.slice(0, 3) : m != null ? ['= ' + (+m.toFixed(6))] : ITEMS.filter(x => x.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
    out.replaceChildren(...(rows.length ? rows : ['Nothing matches that.']).map((r, i) => el('div', 'p-row' + (rows.length && !i ? ' on' : ''), r)));
    if (!still && q) [...out.children].forEach((n, i) => Motion.enter(n, 0, 6, i * 24));
  };
  on(input, 'input', draw); draw();
  box.append(input, out);
})();
// pomodoro
(() => {
  const box = $('d-pomo'), R = 38, len = 2 * Math.PI * R;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 100 100'); ring.setAttribute('class', 'pomo-ring');
  ring.innerHTML = `<circle cx="50" cy="50" r="${R}" class="bg"/><circle cx="50" cy="50" r="${R}" class="fg" stroke-dasharray="${len}" stroke-dashoffset="0"/>`;
  const fg = ring.querySelector('.fg'), label = el('b', '', '25:00'), wrap = el('div', 'pomo', ring, label), btn = el('button', 'raised-btn small press', 'Start');
  const FULL = 1500; let left = FULL, timer = 0, last = 0;
  const draw = () => { label.textContent = `${pad(Math.floor(left / 60))}:${pad(Math.floor(left % 60))}`; fg.style.strokeDashoffset = len * (1 - left / FULL); };
  const stop = () => { timer = 0; btn.textContent = 'Start'; };
  const step = t => { if (!timer) return; left = Math.max(0, left - (t - last) / 1000 * 60); last = t; draw(); if (left <= 0) { stop(); left = FULL; label.textContent = 'Done'; pop(wrap, .8); setTimeout(draw, 1400); return; } requestAnimationFrame(step); };
  on(btn, 'click', () => { if (timer) return stop(); timer = 1; last = performance.now(); btn.textContent = 'Pause'; pop(wrap, .94); requestAnimationFrame(step); });
  draw();
  box.append(wrap, btn);
})();
// links shuffle with a spring
(() => {
  const box = $('d-links'), row = el('div', 'l-row');
  const keys = LINKS.map(([ch, c, name]) => { const k = el('button', 'l-key no-press', ch); k.style.color = c; k.setAttribute('aria-label', name); return k; });
  row.append(...keys);
  on(row, 'click', e => {
    const k = e.target.closest('.l-key'); if (!k) return;
    const before = new Map(keys.map(x => [x, x.getBoundingClientRect()]));
    row.prepend(k);
    pop(k, .75);
    if (!still) for (const [x, a] of before) { const b = x.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) x.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 650, easing: Motion.Ease.bouncy }); }
  });
  box.append(row);
})();
// languages
(() => {
  const box = $('d-lang'), HI = [['Good morning', 'en', 'English'], ['Godmorgen', 'da', 'Dansk'], ['Guten Morgen', 'de', 'Deutsch'], ['Buenos días', 'es', 'Español'], ['Bonjour', 'fr', 'Français'], ['おはようございます', 'ja', '日本語'], ['좋은 아침이에요', 'ko', '한국어'], ['Bom dia', 'pt-BR', 'Português'], ['早上好', 'zh-CN', '简体中文']];
  const word = el('button', 'lang-word no-press'), sub = el('small', 'lang-sub'); let i = 0, auto = 0;
  const show = () => { const [w, l, n] = HI[i]; word.textContent = w; word.lang = l; sub.textContent = n; if (!still) { Motion.enter(word, 0, 16); Motion.pop(word, .9); } };
  on(word, 'click', () => { i = (i + 1) % HI.length; show(); });
  new IntersectionObserver(([e]) => { clearInterval(auto); if (e.isIntersecting && !still) auto = setInterval(() => { i = (i + 1) % HI.length; show(); }, 2200); }).observe(box);
  word.textContent = HI[0][0]; sub.textContent = HI[0][2];
  box.append(word, sub);
})();
// wallpaper sliders, on a real photo
(() => {
  const box = $('d-wall'), view = el('div', 'wp-view', el('i', 'wp-dim'), el('i', 'wp-grain'));
  const row = (label, value, f) => { const r = el('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = value; r.setAttribute('aria-label', label); on(r, 'input', () => f(+r.value)); f(value); return el('label', 'wp-row', el('span', '', label), r); };
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { view.style.backgroundImage = 'url(shots/wall-warm.webp)'; io.disconnect(); } }, { rootMargin: '300px' }).observe(box);
  const a = row('Dim', 20, v => view.style.setProperty('--dim', v / 100)), b = row('Grain', 40, v => view.style.setProperty('--gr', v / 100));
  view.querySelector('.wp-grain').style.backgroundImage = document.querySelector('.grain.add').style.backgroundImage;
  box.append(view, el('div', 'wp-rows', a, b));
})();
// calendar styles
(() => {
  const box = $('d-cal'), week = weekNow(), STYLES = ['week', 'dots', 'page'];
  let i = 0;
  const view = el('button', 'cal-view no-press');
  view.setAttribute('aria-label', 'Change the calendar style');
  const draw = () => {
    const s = STYLES[i], today = week.find(d => d.today);
    if (s === 'week') view.replaceChildren(el('div', 'cal-week', ...week.map(d => el('span', d.today ? 'today' : '', el('small', '', d.l), el('b', '', String(d.n))))));
    if (s === 'dots') view.replaceChildren(el('div', '', el('div', 'cal-dots', ...week.map((d, n) => el('i', d.today ? 'today' : n < week.indexOf(today) ? 'past' : ''))), el('div', 'cal-label', dayName())));
    if (s === 'page') view.replaceChildren(el('div', 'cal-page', el('small', '', new Date().toLocaleDateString('en', { month: 'long' })), el('b', '', String(today.n))));
    pop(view, .88);
  };
  on(view, 'click', () => { i = (i + 1) % STYLES.length; draw(); });
  draw();
  box.append(view);
})();
// profiles
(() => {
  const box = $('d-prof'), P = { Work: ['Calendar', 'Tasks', 'Pomodoro'], Home: ['Weather', 'Quotes', 'Sounds'] };
  const seg = el('div', 'seg inset'); seg.innerHTML = '<i class="seg-pill"></i><button class="on" data-v="Work">Work</button><button data-v="Home">Home</button>';
  const chips = el('div', 'chips');
  const draw = name => { chips.replaceChildren(...P[name].map(c => el('span', 'chip', c))); if (!still) [...chips.children].forEach((c, i) => Motion.popIn(c, i * 60)); };
  box.append(seg, chips); draw('Work');
  segment(seg, draw);
})();
// tasks
(() => {
  const box = $('d-tasks'), T = ['Water the plants', 'Call Mika', 'Finish the slides'];
  box.append(...T.map(tx => { const b = el('button', 'task no-press', el('i'), el('span', '', tx)); on(b, 'click', () => { b.classList.toggle('done'); pop(b.firstChild, .5); }); return b; }));
})();

/* ---------- numbers roll into place ---------- */
const STATS = [
  ['0.1', ' s', 'until the clock is on screen', 's-yama'],
  ['600', ' KB', 'or less to download, fonts included', 's-matsu'],
  ['0.1', ' %', 'or less of the main thread while idle', 's-ai'],
  ['13', '', 'widgets, placed anywhere', 's-fuji'],
  ['9', '', 'languages, fully translated', 's-saku'],
  ['0', '', 'accounts, trackers and ads', 's-shu'],
];
(() => {
  const box = $('stats'), rollers = [];
  for (const [num, unit, text, cls] of STATS) {
    const figure = el('div', 'odo');
    for (const ch of num) {
      if (/\d/.test(ch)) { const col = el('span', 'col'); for (let d = 0; d < 10; d++) col.append(el('span', '', String(d))); col.dataset.to = ch; figure.append(col); rollers.push(col); }
      else figure.append(el('span', 'dot', ch));
    }
    if (unit) figure.append(el('small', '', unit.trim()));
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', num + unit);
    box.append(el('div', 'stat ' + cls, figure, el('p', '', text)));
  }
  const roll = () => rollers.forEach((c, i) => { c.style.transitionDelay = i * 50 + 'ms'; c.style.translate = `0 ${-c.dataset.to}em`; });
  if (still) return roll();
  [...box.children].forEach((n, i) => { n.classList.add('wait'); n.dataset.i = i; seen.observe(n); });
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { setTimeout(roll, 260); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' }).observe(box);
})();
// one tab in slow motion
(() => {
  const btn = $('race'), fill = $('racefill'), ms = $('racems'), tab = $('racetab'), face = $('raceclock');
  let busy = false;
  on(btn, 'click', () => {
    if (busy) return;
    busy = true;
    const n = new Date(), start = performance.now(), TOTAL = 97, SLOW = 16;
    face.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    tab.classList.remove('shown');
    const step = t => {
      const real = Math.min(TOTAL, (t - start) / SLOW);
      fill.style.width = real / TOTAL * 100 + '%';
      ms.textContent = Math.round(real) + ' ms';
      if (real < TOTAL) return requestAnimationFrame(step);
      tab.classList.add('shown');
      pop(tab, .82);
      busy = false;
    };
    requestAnimationFrame(step);
  });
})();

/* ---------- 工夫 writes itself as it scrolls in ---------- */
(() => {
  const strokes = [...$('kanji').querySelectorAll('path')];
  strokes.forEach(p => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = 1; p.style.strokeDashoffset = still ? 0 : 1; });
  if (still) return;
  new IntersectionObserver((es, io) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    strokes.forEach((p, i) => { p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, delay: 100 + i * 230, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' }).onfinish = () => { p.style.strokeDashoffset = 0; }; });
  }, { threshold: .35 }).observe($('kanji'));
})();

/* ---------- the install guide walks through a fake browser ---------- */
(() => {
  const ZIP = 'https://github.com/jxfriis/kufu/releases/latest/download/kufu.zip';
  const steps = $('steps'), body = $('bbody'), url = $('burl');
  let at = 0, dev = false, loaded = false;
  const NUM = ['一', '二', '三', '四'];
  const STEP = [
    ['Download and unzip', 'Unzip kufu.zip somewhere it can stay. Chrome keeps reading from that folder.', 'kufuapp.pages.dev'],
    ['Open extensions', 'Type or paste the address below into a new tab. Chrome blocks links to it, so it has to be typed.', 'chrome://extensions'],
    ['Turn on Developer mode', 'The switch is in the top right corner of that page. Try it in the window here.', 'chrome://extensions'],
    ['Load unpacked', 'Press Load unpacked, choose the unzipped folder, and open a new tab. That\'s it.', 'chrome://extensions'],
  ];
  const lis = STEP.map(([h3, p], i) => {
    const num = el('span', 'num', NUM[i]);
    num.lang = 'ja';
    const li = el('li', 'step', num, el('div', '', el('h3', '', h3), el('p', '', p)));
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    on(li, 'click', () => go(i));
    on(li, 'keydown', e => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(i); } });
    steps.append(li);
    return li;
  });
  const copy = el('button', 'raised-btn small press', 'Copy chrome://extensions');
  on(copy, 'click', async () => { try { await navigator.clipboard.writeText('chrome://extensions'); copy.textContent = 'Copied'; } catch { copy.textContent = 'chrome://extensions'; } pop(copy, .9); setTimeout(() => { copy.textContent = 'Copy chrome://extensions'; }, 1600); });
  lis[1].querySelector('div').append(copy);
  const next = el('button', 'raised-btn small press', 'Next step');
  on(next, 'click', () => go(Math.min(at + 1, 3)));

  const VIEW = [
    () => {
      const dl = el('a', 'accent-btn press', 'Download kufu.zip'); dl.href = ZIP;
      const zip = el('div', 'b-file', el('i', 'ic-zip'), el('span', '', 'kufu.zip')), arrow = el('i', 'b-arrow'), dir = el('div', 'b-file', el('i', 'ic-dir'), el('span', '', 'kufu'));
      if (!still) { Motion.popIn(zip, 200); Motion.enter(arrow, -14, 0, 500); Motion.popIn(dir, 760); }
      return el('div', 'b-center', el('div', 'b-files', zip, arrow, dir), el('div', 'cta', dl, next));
    },
    () => {
      const typed = el('span', 'typed', ''), t = 'chrome://extensions';
      if (still) typed.textContent = t;
      else { let i = 0; const iv = setInterval(() => { typed.textContent = t.slice(0, ++i); if (i >= t.length) clearInterval(iv); }, 45); }
      return el('div', 'b-center', el('p', 'b-say', 'In a new tab, type:'), el('div', 'b-type', typed), next);
    },
    () => page(),
    () => page(),
  ];
  function page() {
    const sw = el('button', 'b-switch no-press' + (dev ? ' on' : ''), el('i'));
    sw.setAttribute('aria-label', 'Developer mode');
    const load = el('button', 'raised-btn small press' + (dev ? '' : ' off'), 'Load unpacked');
    const list = el('div', 'b-list'), finish = el('div', 'b-done');
    const card = () => { const img = el('img'); img.src = 'icon-48.png'; img.alt = ''; return el('div', 'ext-card', img, el('div', '', el('b', '', 'Kufu'), el('small', '', 'A fast new tab page')), el('i', 'b-switch on mini', el('i'))); };
    const showDone = () => {
      const n = new Date();
      finish.replaceChildren(el('div', 'b-newtab', el('b', '', `${pad(n.getHours())}:${pad(n.getMinutes())}`), el('small', '', 'Your new tab')));
      if (!still) Motion.popIn(finish.firstChild, 240);
    };
    if (loaded) { list.append(card()); showDone(); }
    on(sw, 'click', () => {
      dev = !dev;
      sw.classList.toggle('on', dev);
      load.classList.toggle('off', !dev);
      pop(sw.firstChild, .7);
      if (dev && at === 2) setTimeout(() => { if (at === 2) go(3); }, 800);
    });
    on(load, 'click', () => {
      if (!dev) { if (!still) Motion.shake(sw); return; }
      if (!loaded) { loaded = true; const c = card(); list.append(c); if (!still) Motion.popIn(c); showDone(); }
    });
    return el('div', 'b-page', el('div', 'b-pagehead', el('b', '', 'Extensions'), el('div', 'b-dev', 'Developer mode', sw)), el('div', 'b-actions', load), list, finish);
  }
  function go(i, first) {
    at = i;
    lis.forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('past', k < i); });
    url.textContent = STEP[i][2];
    next.remove();
    body.replaceChildren(VIEW[i]());
    if (!still && !first) Motion.enter(body.firstChild, 10, 0);
  }
  go(0, true);
})();

/* details spring open */
for (const d of document.querySelectorAll('.faq details')) on(d, 'toggle', () => { if (d.open && !still) Motion.enter(d.querySelector('p'), 0, -8); });
