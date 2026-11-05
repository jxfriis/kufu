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

/* ---------- the hero: a real clock under the real sky ---------- */
const clock = $('clock');
const makeDigit = small => { const s = el('div', 'digit' + (small ? ' small' : ''), el('b')); on(s, 'pointerdown', () => pop(s, .86)); return s; };
const slots = [makeDigit(), makeDigit(), makeDigit(), makeDigit(), makeDigit(true), makeDigit(true)];
clock.append(slots[0], slots[1], el('div', 'gap', el('i'), el('i')), slots[2], slots[3], slots[4], slots[5]);
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
let preview = null, heroVisible = true;
function tick(animate) {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  if (preview != null) { h = Math.floor(preview) % 24; m = Math.floor((preview % 1) * 60); }
  const text = pad(h) + pad(m) + pad(now.getSeconds());
  slots.forEach((slot, i) => show(slot, text[i], animate));
}
tick(false);
if (!still) slots.forEach((s, i) => Motion.popIn(s, 60 + i * 55));
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe($('hero'));
setInterval(() => { if (heroVisible && !document.hidden) tick(true); }, 1000);
segment($('clockstyle'), v => { clock.dataset.s = v; slots.forEach(s => pop(s, .9)); });

const SKY = [[0, '#060A20', '#141B48'], [4.6, '#0F1540', '#33306E'], [6.6, '#3B3F92', '#F69474'], [9, '#1C5FA8', '#8ACBE6'], [15, '#1E69B2', '#B0DCEC'], [17.6, '#3A2B78', '#F47C50'], [19.6, '#17174C', '#7A3A70'], [24, '#060A20', '#141B48']];
const hero = $('hero'), orb = $('orb'), stars = $('stars'), hello = $('hello');
for (let i = 0; i < 70; i++) { const s = el('i'); s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 62}%;opacity:${(.3 + Math.random() * .7).toFixed(2)};scale:${(.5 + Math.random()).toFixed(2)}`; stars.append(s); }
function paintSky(h) {
  let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  const top = mix(a[1], b[1], f), low = mix(a[2], b[2], f);
  hero.style.setProperty('--sky-top', top);
  hero.style.setProperty('--sky-low', low);
  hero.style.setProperty('--m-far', mix(top, low, .25));
  hero.style.setProperty('--m-mid', mix(top, '#0A0E26', .45));
  hero.style.setProperty('--m-near', mix(top, '#050714', .72));
  const day = h >= 6 && h < 19;
  const t = day ? (h - 6) / 13 : ((h < 6 ? h + 24 : h) - 19) / 11;
  orb.style.left = (8 + t * 84) + '%';
  orb.style.top = (66 - Math.sin(t * Math.PI) * 54) + '%';
  orb.classList.toggle('moon', !day);
  stars.style.opacity = day ? Math.max(0, 1 - Math.min(h - 6, 19 - h) * 1.2) * .4 : .9;
  hello.textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}
const nowHour = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60; };
const hourInput = $('hour'), hourNow = $('hournow');
hourInput.value = nowHour();
paintSky(nowHour());
on(hourInput, 'input', () => { preview = +hourInput.value; paintSky(preview); tick(true); hourNow.hidden = false; });
on(hourNow, 'click', () => {
  const from = preview, to = nowHour(), start = performance.now();
  preview = null; hourNow.hidden = true; tick(true);
  if (still) { paintSky(to); hourInput.value = to; return; }
  const step = t => { const f = Math.min(1, (t - start) / 700), v = from + (to - from) * (1 - (1 - f) ** 3); paintSky(v); hourInput.value = v; if (f < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});
setInterval(() => { if (preview == null && heroVisible) { paintSky(nowHour()); hourInput.value = nowHour(); } }, 60000);

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
  const layers = [...document.querySelectorAll('.land .layer')].map(n => [n, +n.dataset.depth]);
  let px = 0, py = 0, want = false;
  const paint = () => { want = false; for (const [n, d] of layers) n.style.transform = `translate(${(-px * d).toFixed(1)}px, ${(py * d * 2.4).toFixed(1)}px)`; };
  const ask = () => { if (!want) { want = true; requestAnimationFrame(paint); } };
  on(hero, 'pointermove', e => { px = e.clientX / innerWidth - .5; ask(); }, { passive: true });
  on(window, 'scroll', () => { if (heroVisible) { py = scrollY / innerHeight; ask(); } }, { passive: true });
}

/* ---------- the working miniature ---------- */
const NAMES = { clock: 'Clock', date: 'Calendar', greeting: 'Greeting', search: 'Search', links: 'Links', weather: 'Weather', quote: 'Quote', tasks: 'Tasks', pomodoro: 'Pomodoro' };
const LINKS = [['G', '#EA4335', 'Gmail'], ['Y', '#FF3355', 'YouTube'], ['G', '#8AA4FF', 'GitHub'], ['C', '#E8835A', 'Claude'], ['S', '#2BD46A', 'Spotify'], ['U', '#D7DBE2', 'Unsplash']];
const mini = $('mini'), stage = $('stage'), wall = $('wall');
const weekNow = () => { const d = new Date(), start = new Date(d); start.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [...Array(7)].map((_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return { n: x.getDate(), l: 'MTWTFSS'[i], today: x.toDateString() === d.toDateString() }; }); };
const dayName = () => new Date().toLocaleDateString('en', { weekday: 'long' }), dateName = () => new Date().toLocaleDateString('en', { month: 'long', day: 'numeric' });
const miniDigits = [];
const WIDGET = {
  clock() { const r = el('div', 'm-clock'); for (let i = 0; i < 4; i++) { const k = el('b', 'm-digit'); miniDigits.push(k); r.append(k); if (i === 1) r.append(el('i', 'm-colon', el('u'), el('u'))); } return r; },
  date() { const w = el('div', 'm-week'); for (const d of weekNow()) w.append(el('span', d.today ? 'today' : '', el('small', '', d.l), el('b', '', String(d.n)))); return el('div', 'm-date', el('div', 'm-dline', el('b', '', dayName()), ' ' + dateName()), w); },
  greeting() { const h = new Date().getHours(); return el('div', 'm-greet', el('b', '', h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night'), el('small', '', 'Clear sky, 12° in Kyoto')); },
  search() { return el('div', 'm-search', el('i'), 'Search'); },
  links() { return el('div', 'm-links', ...LINKS.map(([ch, c, name]) => { const k = el('div', 'm-key press', el('span', '', ch), el('small', '', name)); k.firstChild.style.color = c; return k; })); },
  weather() { return el('div', 'm-wx', el('i'), el('b', '', '12°'), el('small', '', 'Kyoto')); },
  quote() { return el('div', 'm-quote', el('p', '', 'Well done is better than well said.'), el('small', '', 'Benjamin Franklin')); },
  tasks() { return el('div', 'm-note', el('b', '', 'Tasks'), el('small', '', 'Water the plants'), el('small', '', 'Call Mika')); },
  pomodoro() { return el('div', 'm-note', el('b', '', '25:00'), el('small', '', 'Focus')); },
};
const widgets = {};
for (const id of Object.keys(WIDGET)) { const w = el('div', 'w', WIDGET[id]()); w.dataset.w = id; w.dataset.label = NAMES[id]; widgets[id] = w; }
const ZONES = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const zoneEls = Object.fromEntries(ZONES.map(z => { const n = el('div', 'zone z-' + z); n.dataset.z = z; mini.append(n); return [z, n]; }));
const layout = { tr: ['weather'], mc: ['clock', 'date', 'greeting', 'search', 'links'], bc: ['quote'] };
let arranging = false;
function placeMini() {
  for (const z of ZONES) zoneEls[z].replaceChildren(...(layout[z] || []).map(id => widgets[id]));
  decorate();
}
const unused = () => Object.keys(WIDGET).filter(id => !ZONES.some(z => layout[z]?.includes(id)));
function decorate() {
  mini.querySelectorAll('.m-x, .m-plus').forEach(n => n.remove());
  if (!arranging) return;
  for (const z of ZONES) {
    const list = layout[z] || [];
    for (const id of list) {
      const x = el('button', 'm-x no-press', el('i'));
      x.setAttribute('aria-label', 'Remove ' + NAMES[id]);
      on(x, 'click', () => flip(() => { layout[z] = list.filter(k => k !== id); placeMini(); }));
      widgets[id].append(x);
    }
    if (!list.length && unused().length) {
      const p = el('button', 'm-plus no-press', el('i'));
      p.setAttribute('aria-label', 'Add something here');
      on(p, 'click', () => plusMenu(p, z));
      zoneEls[z].append(p);
    }
  }
}
let menu = null;
const closeMenu = () => { menu?.remove(); menu = null; };
function plusMenu(btn, z) {
  closeMenu();
  menu = el('div', 'm-menu panel', ...unused().map(id => { const b = el('button', 'no-press', NAMES[id]); on(b, 'click', () => { closeMenu(); flip(() => { (layout[z] ||= []).push(id); placeMini(); }); pop(widgets[id], .7); }); return b; }));
  const a = btn.getBoundingClientRect(), s = stage.getBoundingClientRect();
  stage.append(menu);
  const mh = menu.offsetHeight, mw = menu.offsetWidth;
  menu.style.left = Math.min(s.width - mw - 8, Math.max(8, a.left - s.left - mw / 2 + a.width / 2)) + 'px';
  menu.style.top = Math.max(8, Math.min(s.height - mh - 8, a.bottom - s.top + 6)) + 'px';
  if (!still) Motion.popIn(menu);
}
on(document, 'pointerdown', e => { if (menu && !e.target.closest('.m-menu, .m-plus')) closeMenu(); }, true);
function flip(change) {
  const before = new Map(Object.values(widgets).filter(w => w.isConnected).map(w => [w, w.getBoundingClientRect()]));
  change();
  if (still) return;
  for (const [w, a] of before) { if (!w.isConnected) continue; const b = w.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (dx || dy) w.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 650, easing: Motion.Ease.bouncy }); }
}
placeMini();
const paintMini = () => { const d = new Date(), t = pad(d.getHours()) + pad(d.getMinutes()); miniDigits.forEach((k, i) => { k.textContent = t[i]; }); };
paintMini(); setInterval(paintMini, 20000);

// arranging: drag, red remove, plus
const arrangeBtn = $('arrange');
on(arrangeBtn, 'click', () => {
  arranging = !arranging;
  arrangeBtn.textContent = arranging ? 'Done' : 'Arrange';
  arrangeBtn.setAttribute('aria-pressed', arranging);
  closeMenu();
  flip(() => { stage.toggleAttribute('data-arrange', arranging); decorate(); });
  $('stagehint').textContent = arranging ? 'Drag anything to move it. Red removes it, plus adds something to an empty spot.' : 'The real thing works the same way, with many more options.';
});
on(mini, 'pointerdown', e => {
  const w = e.target.closest('.w');
  if (!arranging || !w || e.target.closest('.m-x') || e.button) return;
  e.preventDefault();
  const id = w.dataset.w, r = w.getBoundingClientRect(), s = stage.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  let ghost = null, over = null;
  const move = ev => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      ghost = w.cloneNode(true);
      ghost.classList.add('m-ghost');
      ghost.querySelector('.m-x')?.remove();
      ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;font-size:${getComputedStyle(mini).fontSize}`;
      document.body.append(ghost);
      w.style.opacity = '.25';
      pop(ghost, .94);
    }
    ghost.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
    const z = document.elementsFromPoint(ev.clientX, ev.clientY).map(x => x.closest?.('.zone')).find(Boolean) || null;
    if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
  };
  const up = ev => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (!ghost) return;
    ghost.remove(); w.style.opacity = ''; over?.classList.remove('over');
    if (!over) return;
    const to = over.dataset.z;
    flip(() => {
      for (const z of ZONES) layout[z] = (layout[z] || []).filter(k => k !== id);
      const kids = [...over.querySelectorAll(':scope > .w')].filter(k => k !== w);
      const at = kids.findIndex(k => { const b = k.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
      layout[to].splice(at < 0 ? layout[to].length : at, 0, id);
      placeMini();
    });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});
segment($('designs'), v => { stage.dataset.d = v; Object.values(widgets).forEach(w => { if (w.isConnected) pop(w, .95); }); });
const ACCENTS = ['#FF5436', '#F26A3D', '#F5AE3C', '#22885A', '#3B82C4', '#EC6A97', '#9B7BEA', '#F4F4F2'];
stage.style.setProperty('--a', ACCENTS[0]);
const accentBox = $('accents');
ACCENTS.forEach((c, i) => {
  const b = el('button', 'swatch' + (i ? '' : ' on'));
  b.style.setProperty('--c', c);
  b.setAttribute('aria-label', 'Accent ' + (i + 1));
  on(b, 'click', () => { accentBox.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === b)); stage.style.setProperty('--a', c); stage.toggleAttribute('data-white', c === '#F4F4F2'); pop(b, .7); });
  accentBox.append(b);
});
const WALLS = [['teal', 'shots/wall-teal.webp'], ['warm', 'shots/wall-warm.webp'], ['night', 'shots/wall-night.webp'], ['plain', '']];
const wallBox = $('walls');
const setWall = (src, animate) => {
  stage.toggleAttribute('data-plain', !src);
  if (!src) { wall.style.backgroundImage = ''; return; }
  const img = new Image();
  img.onload = () => { wall.style.backgroundImage = `url(${src})`; if (animate && !still) wall.animate([{ opacity: .3, scale: 1.04 }, { opacity: 1, scale: 1 }], { duration: 500, easing: 'ease-out' }); };
  img.src = src;
};
WALLS.forEach(([name, src], i) => {
  const b = el('button', 'wall-btn' + (i ? '' : ' on'));
  b.setAttribute('aria-label', 'Wallpaper ' + name);
  if (src) b.style.backgroundImage = `url(${src})`;
  on(b, 'click', () => { wallBox.querySelectorAll('.wall-btn').forEach(x => x.classList.toggle('on', x === b)); setWall(src, true); pop(b, .8); });
  wallBox.append(b);
});
new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { setWall(WALLS[0][1]); io.disconnect(); } }, { rootMargin: '400px' }).observe(stage);

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
// cards lean toward the pointer
if (!still && matchMedia('(hover: hover)').matches) for (const c of document.querySelectorAll('[data-tilt]')) {
  on(c, 'pointermove', e => { const r = c.getBoundingClientRect(); c.style.transform = `perspective(900px) rotateX(${((.5 - (e.clientY - r.top) / r.height) * 3.2).toFixed(2)}deg) rotateY(${(((e.clientX - r.left) / r.width - .5) * 3.2).toFixed(2)}deg)`; }, { passive: true });
  on(c, 'pointerleave', () => { c.style.transform = ''; });
}

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
