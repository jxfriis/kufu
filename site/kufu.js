'use strict';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!still) Motion.install();

/* real grain, the same as the app: a bright half added, a dark half subtracted */
const grain = table => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" stitchTiles="stitch"/><feColorMatrix values="3 0 0 0 -1 3 0 0 0 -1 3 0 0 0 -1 0 0 0 0 1"/><feComponentTransfer>${['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${table}"/>`).join('')}</feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`)}")`;
document.querySelector('.grain.add').style.backgroundImage = grain('0 0 0 0 0 .04 .08 .12 .16');
document.querySelector('.grain.sub').style.backgroundImage = grain('.16 .12 .08 .04 0 0 0 0 0');

/* a live clock of raised keys, as on a new tab */
const clock = document.getElementById('clock');
const slots = [0, 1, 2, 3].map(() => {
  const slot = document.createElement('div');
  slot.className = 'digit';
  slot.append(document.createElement('b'));
  return slot;
});
const gap = document.createElement('div');
gap.className = 'gap';
gap.append(document.createElement('i'), document.createElement('i'));
clock.append(slots[0], slots[1], gap, slots[2], slots[3]);

function tick(animate) {
  const now = new Date(), text = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  slots.forEach((slot, i) => {
    const cur = slot.lastChild;
    if (cur.textContent === text[i]) return;
    if (!animate || still || document.hidden) { cur.textContent = text[i]; return; }
    const next = document.createElement('b');
    next.textContent = text[i];
    slot.append(next);
    Motion.enter(next, 0, 26);
    Motion.fadeOut(cur);
    Motion.pop(slot, .96);
  });
  setTimeout(() => tick(true), 60000 - (Date.now() % 60000));
}
tick(false);
if (!still) slots.forEach((slot, i) => Motion.popIn(slot, i * 60));

/* the design switcher */
const CAPTIONS = {
  keys: ['Keys: every digit and link is a physical key that squashes and springs back.', 'a clock of raised keys, a week calendar, search and quick links on a dark background'],
  glass: ['Glass: clear surfaces that bend the wallpaper behind them, with springs to match.', 'glass clock numbers and panels over a photo'],
  paper: ['Paper: flat and quiet, with thin lines instead of depth.', 'flat panels with thin outlines'],
  clay: ['Clay: soft, pillowy shapes pressed from the background itself.', 'soft shapes in the same color as the background'],
};
const seg = document.getElementById('designs'), pill = seg.querySelector('.seg-pill'), shot = document.getElementById('shot'), caption = document.getElementById('caption');
const buttons = [...seg.querySelectorAll('button')];
const place = (b, animate) => {
  if (animate && !still) { Motion.slideX(pill, b.offsetLeft - 3); Motion.size(pill, 'width', b.offsetWidth); }
  else { pill.style.translate = `${b.offsetLeft - 3}px 0px`; pill.style.width = b.offsetWidth + 'px'; }
};
const firstPlace = () => place(buttons.find(b => b.classList.contains('on')), false);
firstPlace();
document.fonts?.ready.then(firstPlace);
addEventListener('resize', firstPlace);

let ask = 0;
for (const b of buttons) b.addEventListener('click', async () => {
  if (b.classList.contains('on')) return;
  for (const x of buttons) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }
  place(b, true);
  const name = b.dataset.shot, mine = ++ask, next = new Image();
  next.src = `shots/${name}.webp`;
  await next.decode().catch(() => {});
  if (mine !== ask) return;
  shot.src = next.src;
  shot.alt = `Kufu in the ${b.textContent} design: ${CAPTIONS[name][1]}.`;
  caption.textContent = CAPTIONS[name][0];
  if (!still) Motion.pop(shot, .985);
});
// the other designs are ready before anyone asks for them
(window.requestIdleCallback || setTimeout)(() => buttons.slice(1).forEach(b => { new Image().src = `shots/${b.dataset.shot}.webp`; }));
