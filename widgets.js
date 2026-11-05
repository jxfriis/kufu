'use strict';
// Renders every widget synchronously from localStorage, so the first paint is already the finished page.
// Network, favicon tints and account sync all wait until after that paint.

const idle = fn => (globalThis.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const pad = n => String(n).padStart(2, '0');
const COLORS = ['#FF8A70', '#7FB5FF', '#3DD68C', '#FFC48A', '#C6A2FF', '#FF9CCB', '#6FD6D6', '#E6D36A'];
const colorFor = s => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const locale = () => LANG;
const zone = tz => (tz && tz !== 'auto' ? tz : undefined);

/* ---------- clock ---------- */
const Clock = {
  el: h('div', { class: 'w', 'data-w': 'clock' }),
  slots: [],
  formats: {},
  build() {
    const c = S.clock;
    this.el.replaceChildren();
    this.slots = [];
    this.world = null;
    this.face = null;
    if (c.analog) this.el.append(this.buildDial(c));
    else if (c.style === 'plain') { this.plain = h('div', { class: 'clock plain' }); this.el.append(this.plain); }
    else {
      this.plain = null;
      const row = h('div', { class: 'clock' });
      const count = 4 + (c.seconds ? 2 : 0);
      for (let i = 0; i < count; i++) {
        const glass = c.style === 'glass';
        if (glass && (i === 2 || i === 4)) row.append(h('div', { class: 'digit raised gd colon' }, h('b', { text: ':' })));
        else if (i === 2) row.append(h('div', { class: 'clock-gap' }, h('i'), h('i')));
        const slot = h('div', { class: 'digit raised' + (glass ? ' gd' : i >= 4 ? ' small' : '') });
        slot.append(h('b'));
        this.slots.push(slot);
        row.append(slot);
      }
      this.ampmEl = h('div', { class: 'ampm' });
      row.append(this.ampmEl);
      this.el.append(row);
    }
    if (c.worldon && c.world.length) { this.world = h('div', { class: 'world' }); this.el.append(this.world); }
    this.tick(false);
    if (painted && c.style === 'glass' && !c.analog) syncGlassDigits();
  },
  buildDial(c) {
    const svg = dialFace(c.face);
    this.hands = { h: h('div', { class: 'hand h' }), m: h('div', { class: 'hand m' }), s: h('div', { class: 'hand s' }) };
    const face = h('div', { class: 'face inset', html: svg }, Object.values(this.hands), h('div', { class: 'hand-pin' }));
    this.face = h('div', { class: `dial raised ${c.shape}`, 'data-hands': c.hands }, face);
    if (c.seconds === false) this.hands.s.hidden = true;
    if (c.dialbg) face.style.background = c.dialbg;
    if (c.dialborder) this.face.style.background = `${c.dialborder} padding-box, var(--raised-edge) border-box`;
    this.lastSec = -1;
    return this.face;
  },
  parts(tz, ampm) {
    if (!zone(tz)) {
      const n = new Date(), h24 = n.getHours();
      return { h24, hour: ampm ? h24 % 12 || 12 : h24, minute: n.getMinutes(), second: n.getSeconds() };
    }
    // building a formatter is slow and this runs every second, so keep one per time zone
    const f = this.formats[tz] ||= new Intl.DateTimeFormat('en-GB', { timeZone: zone(tz), hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const p = {};
    for (const x of f.formatToParts(new Date())) p[x.type] = +x.value;
    p.h24 = p.hour;
    if (ampm) p.hour = p.hour % 12 || 12;
    return p;
  },
  setDigit(slot, ch, animate) {
    const cur = slot.lastChild;
    if (cur.textContent === ch) return;
    const glass = S.clock.style === 'glass' && globalThis.GlassDigits;
    // a hidden tab can't finish animations, so it just changes the number
    if (!animate || Motion.reduced || document.hidden) {
      while (slot.children.length > 1) slot.firstChild.remove();
      slot.lastChild.textContent = ch;
      if (glass) GlassDigits.apply(slot.lastChild, ch);
      return;
    }
    while (slot.children.length > 1) slot.firstChild.remove();
    const next = h('b', { text: ch });
    slot.append(next);
    if (glass) GlassDigits.apply(next, ch);
    Motion.enter(next, 0, 26);
    // two glass numbers can't cross-fade: each would bend the other
    if (slot.classList.contains('gd')) cur.remove(); else Motion.fadeOut(cur);
    Motion.pop(slot, 0.96);
  },
  tick(animate = true) {
    const c = S.clock;
    if (!c.on || !this.el.firstChild) return;
    const p = this.parts(c.timezone, c.ampm);
    if (this.face) {
      const secs = p.h24 * 3600 + p.minute * 60 + p.second;
      if (secs !== this.lastSec) {
        const set = (el, deg, spring) => {
          if (spring && animate && !Motion.reduced && secs > this.lastSec && this.lastSec >= 0) Motion.to(el, 'rotate', deg + 'deg', 650, Motion.Ease.spring);
          else el.style.rotate = deg + 'deg';
        };
        set(this.hands.s, secs * 6, true);
        set(this.hands.m, secs / 10, p.second === 0);
        set(this.hands.h, secs / 120, false);
        this.lastSec = secs;
      }
    } else {
      const hh = c.ampm && p.hour < 10 ? ' ' + p.hour : pad(p.hour);
      const text = hh + pad(p.minute) + (c.seconds ? pad(p.second) : '');
      if (this.plain) this.plain.textContent = `${hh.trim()}:${pad(p.minute)}${c.seconds ? ':' + pad(p.second) : ''}${c.ampm && c.ampmlabel ? ' ' + (p.h24 < 12 ? 'AM' : 'PM') : ''}`;
      else {
        this.slots.forEach((s, i) => { s.hidden = text[i] === ' '; this.setDigit(s, text[i] === ' ' ? '' : text[i], animate); });
        this.ampmEl.textContent = c.ampm && c.ampmlabel ? (p.h24 < 12 ? 'AM' : 'PM') : '';
      }
    }
    if (this.world && p.second === 0 || this.world && !this.world.childElementCount) this.renderWorld();
  },
  renderWorld() {
    this.world.replaceChildren(...S.clock.world.map(w => {
      const q = this.parts(w.timezone, S.clock.ampm);
      const night = q.h24 < 7 || q.h24 >= 19;
      return h('div', { class: 'wc raised' + (night ? ' night' : '') }, h('i'), h('b', { text: `${q.hour}:${pad(q.minute)}` }), h('span', { text: w.region || w.timezone.split('/').pop().replace(/_/g, ' ') }));
    }));
  },
};

function dialFace(face) {
  const ticks = [];
  const pt = (i, r) => [50 + r * Math.sin(i * Math.PI / 6), 50 - r * Math.cos(i * Math.PI / 6)];
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  if (face === 'number' || face === 'roman') {
    for (let i = 0; i < 12; i++) {
      const [x, y] = pt(i, 39);
      ticks.push(`<text x="${x}" y="${y}" font-size="9">${face === 'roman' ? ROMAN[i] : i || 12}</text>`);
    }
  } else if (face === 'marks' || face === 'swiss' || face === 'braun') {
    for (let i = 0; i < 12; i++) {
      const major = i % 3 === 0, [a, b] = pt(i, 46), [c, d] = pt(i, major ? 37 : 41);
      ticks.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="currentColor" stroke-width="${face === 'swiss' ? 2.6 : major ? 2.2 : 1.1}" stroke-linecap="${face === 'marks' ? 'round' : 'butt'}"/>`);
    }
    if (face === 'swiss' || face === 'braun') for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = i * Math.PI / 30;
      ticks.push(`<line x1="${50 + 46 * Math.sin(a)}" y1="${50 - 46 * Math.cos(a)}" x2="${50 + 43.5 * Math.sin(a)}" y2="${50 - 43.5 * Math.cos(a)}" stroke="currentColor" stroke-width=".7"/>`);
    }
  }
  return `<svg viewBox="0 0 100 100">${ticks.join('')}</svg>`;
}

/* ---------- date: today pops out of a sunken week rail ---------- */
const dateFormats = new Map();
function dateFormat(loc, options) {
  const key = loc + JSON.stringify(options);
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, f = new Intl.DateTimeFormat(loc, options));
  return f;
}
let localeFirstDay;
function firstDayOfWeek() {
  const f = S.date.firstday;
  if (f !== 'auto') return { sun: 0, mon: 1, sat: 6 }[f];
  if (localeFirstDay === undefined) {
    localeFirstDay = 1;
    try { const wi = new Intl.Locale(navigator.language).getWeekInfo?.(); if (wi) localeFirstDay = wi.firstDay % 7; } catch {}
  }
  return localeFirstDay;
}
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  return Math.ceil(((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
const DateW = {
  el: h('div', { class: 'w', 'data-w': 'date' }),
  key: '',
  build(animate) {
    const d = S.date, now = new Date(), tz = zone(S.clock.timezone), loc = locale();
    const fmt = o => dateFormat(loc, { timeZone: tz, ...o }).format(now);
    const weekday = fmt({ weekday: 'long' }), day = fmt({ day: 'numeric' }), month = fmt({ month: 'long' });
    const rest = d.format === 'us' ? `${month} ${day}` : d.format === 'eu' ? `${day} ${month}` : d.format === 'cn' ? `${fmt({ month: 'numeric' })}/${day}` : fmt({ day: 'numeric', month: 'long' });
    const line = h('div', { class: 'date-line' }, weekday, h('span', { text: rest }));
    this.key = now.toDateString();
    const open = el => Lazy.extras().then(() => Calendar.toggle(el));
    if (d.style === 'page') {
      const page = h('div', { class: 'cal-page raised press', title: t('Open calendar'), onclick: () => open(page) },
        h('div', { class: 'cp-top', text: month }), h('div', { class: 'cp-day', text: day }), h('div', { class: 'cp-week', text: weekday }));
      this.el.replaceChildren(page);
      if (animate) Motion.pop(page, .8);
      return;
    }
    if (d.style === 'month') {
      const start = firstDayOfWeek(), lead = (now.getDay() - now.getDate() + 1 - start + 70) % 7;
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const narrow = dateFormat(loc, { weekday: 'narrow' });
      const grid = h('div', { class: 'mm-grid' }, Array.from({ length: 7 }, (_, i) => h('i', { text: narrow.format(new Date(2023, 0, 1 + (start + i) % 7)) })));
      for (let i = 0; i < lead; i++) grid.append(h('span'));
      let today;
      for (let n = 1; n <= last; n++) {
        const c = h('span', { class: n === now.getDate() ? 'today' : n < now.getDate() ? 'past' : '', text: n });
        if (n === now.getDate()) today = c;
        grid.append(c);
      }
      const card = h('div', { class: 'mini-month panel', title: t('Open calendar'), onclick: () => open(card) }, h('div', { class: 'mm-head' }, h('b', { text: month }), h('span', { text: weekday })), grid);
      this.el.replaceChildren(card);
      return;
    }
    if (d.style === 'dots') {
      const first = firstDayOfWeek(), offset = (now.getDay() - first + 7) % 7;
      const dots = h('div', { class: 'week-dots' }, Array.from({ length: 7 }, (_, i) => h('i', { class: i === offset ? 'today' : i < offset ? 'past' : '' })));
      const box = h('div', { class: 'date stack', title: t('Open calendar'), onclick: () => open(box) }, line, dots);
      this.el.replaceChildren(box);
      return;
    }
    if (d.style === 'line') {
      const box = h('div', { class: 'date big-line', title: t('Open calendar'), onclick: () => open(box) }, line);
      this.el.replaceChildren(box);
      return;
    }
    const box = h('div', { class: 'date' }, line);
    if (d.week) {
      const first = firstDayOfWeek();
      const today = new Date(now), offset = (today.getDay() - first + 7) % 7;
      const rail = h('div', { class: 'week inset', title: t('Open calendar'), onclick: () => Lazy.extras().then(() => Calendar.toggle(rail)) });
      let todayEl;
      for (let i = 0; i < 7; i++) {
        const x = new Date(today); x.setDate(today.getDate() - offset + i);
        const el = h('div', { class: 'day' + (i === offset ? ' today' : i < offset ? ' past' : '') },
          h('small', { text: dateFormat(loc, { weekday: 'narrow' }).format(x) }),
          h('b', { text: x.getDate() }));
        if (i === offset) todayEl = el;
        rail.append(el);
      }
      if (d.weeknum) box.append(h('div', { class: 'weeknum inset', text: `${t('Week')} ${isoWeek(now)}` }));
      box.append(rail);
    }
    this.el.replaceChildren(box);
    this.key = now.toDateString();
  },
};

/* ---------- greeting: says hello, then says something useful about right now ---------- */
const Greeting = {
  el: h('div', { class: 'w', 'data-w': 'greeting' }),
  // where the sun is today, on a thin arc: real sunrise and sunset once the weather knows them
  arc() {
    const now = new Date(), d = C.weather?.data?.daily;
    const up = d?.sunrise?.[0] && Math.abs(+new Date(d.sunrise[0]) - now) < 864e5 ? +new Date(d.sunrise[0]) : new Date(now).setHours(6, 30, 0, 0);
    const down = d?.sunset?.[0] && Math.abs(+new Date(d.sunset[0]) - now) < 864e5 ? +new Date(d.sunset[0]) : new Date(now).setHours(19, 0, 0, 0);
    const day = +now >= up && +now <= down, f = day ? (now - up) / (down - up) : +now < up ? 0 : 1;
    const a = Math.PI * f, x = 28 - 22 * Math.cos(a), y = 26 - 20 * Math.sin(a);
    return `<svg viewBox="0 0 56 32" aria-hidden="true"><path d="M2 26H54" class="g-hz"/><path d="M6 26A22 20 0 0 1 50 26" class="g-path"/><path d="M6 26A22 20 0 0 1 50 26" class="g-done" pathLength="1" stroke-dasharray="${f.toFixed(3)} 1"/>${day ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="g-glow"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" class="g-sunny"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="g-moon"/>`}</svg>`;
  },
  period() { const n = new Date().getHours(); return n < 5 ? 'night' : n < 12 ? 'morning' : n < 18 ? 'afternoon' : n < 22 ? 'evening' : 'night'; },
  phrase(p) {
    const g = S.greeting, day = Math.floor(Date.now() / 864e5);
    if (g.mode === 'custom' && g[p]) return g[p];
    if (g.mode === 'world') { const w = ['Hej', 'Hola', 'Bonjour', 'Ciao', 'Hallo', 'Olá', 'こんにちは', '안녕하세요', 'Merhaba', 'Namaste', 'Salut', 'Aloha']; return w[day % w.length]; }
    if (g.mode === 'varied') {
      const v = { morning: ['Rise and shine', 'Morning', 'Fresh start', 'Up early'], afternoon: ['Keep it going', 'Afternoon', 'Halfway there', 'Good to see you'], evening: ['Evening', 'Winding down', 'Nice to see you', 'Almost done'], night: ['Still up', 'Late one', 'Quiet hours', 'Night owl'] }[p];
      return t(v[day % v.length]);
    }
    return t({ morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' }[p]);
  },
  subline() {
    const g = S.greeting, bits = [], now = new Date();
    if (g.sub === 'off') return '';
    if (g.sub === 'custom') return g.subtext;
    const d = g.weather && S.weather.on && C.weather?.data;
    if (d?.current) {
      const cur = d.current, kind = WMO[cur.weather_code]?.[1];
      bits.push(`${t(WMO[cur.weather_code]?.[0] || '')}, ${Math.round(cur.temperature_2m)}°${C.weather.city ? ` ${t('in')} ${C.weather.city}` : ''}`);
      if (kind !== 'rain' && kind !== 'storm' && d.hourly) {
        const i = d.hourly.time.findIndex((x, n) => +new Date(x) > +now && +new Date(x) < +now + 8 * 36e5 && d.hourly.precipitation_probability[n] >= 50);
        if (i >= 0) bits.push(`${t('Rain around')} ${pad(new Date(d.hourly.time[i]).getHours())}:00`);
      }
      const down = d.daily?.sunset?.[0] && (+new Date(d.daily.sunset[0]) - +now) / 6e4;
      if (bits.length < 2 && down > 0 && down <= 90) bits.push(`${t('Sunset in')} ${Math.round(down)} min`);
    }
    const done = C.pomo?.done?.[now.toDateString()];
    if (bits.length < 2 && done) bits.push(`${done} ${t('focus sessions today')}`);
    const left = S.tasks.on ? S.tasks.items.filter(x => !x.done).length : 0;
    if (bits.length < 2 && left) bits.push(`${left} ${t(left === 1 ? 'task left' : 'tasks left')}`);
    if (bits.length < 2) {
      const w = now.getDay();
      const mood = w === 5 ? 'Last stretch before the weekend' : w === 0 || w === 6 ? 'Enjoy the weekend' : w === 1 ? 'A fresh week ahead' : '';
      if (mood) bits.push(t(mood));
      else if (!bits.length) bits.push(`${t('Week')} ${isoWeek(now)}`);
    }
    return bits.slice(0, 2).join('  ·  ');
  },
  build(animate) {
    const g = S.greeting, p = this.period();
    const main = h('div', { class: 'g-main' });
    const stacked = g.design === 'stacked' && g.name;
    const big = stacked ? h('div', { class: 'g-big' }) : null;
    const words = (this.phrase(p) + (g.name && !stacked ? ', ' : '')).split(/(?<= )/);
    words.forEach((word, i) => {
      const s = h('span', { text: word });
      main.append(s);
      if (animate) Motion.enter(s, 0, 12, 180 + i * 40);
    });
    if (g.name) {
      const name = h('button', { class: 'g-name no-press', text: g.name, title: t('Greeting name'), onclick: () => this.edit(main, name) });
      (big || main).append(name);
      if (animate) Motion.popIn(name, 180 + words.length * 40);
    } else {
      const add = h('button', { class: 'g-add ghost small', text: t('Add your name'), onclick: () => this.edit(main, add) });
      main.append(add);
    }
    const sub = this.subline();
    const hour = new Date().getHours();
    const badge = g.icon ? h('div', { class: 'g-badge inset', html: scene(0, hour >= 6 && hour < 19) }) : null;
    const arc = g.icon ? h('div', { class: 'g-arc', html: this.arc() }) : null;
    const line = sub ? h('div', { class: 'g-sub', text: sub }) : null;
    const box = g.design === 'card' ? h('div', { class: 'greeting g-card panel' }, badge, h('div', { class: 'g-text' }, main, line))
      : g.design === 'minimal' ? h('div', { class: 'greeting g-minimal' }, main, line)
      : stacked ? h('div', { class: 'greeting g-stacked' }, main, big, line)
      : h('div', { class: 'greeting g-classic' }, h('div', { class: 'g-title' }, arc, main), line);
    if (animate && badge && box.contains(badge)) Motion.popIn(badge, 120);
    if (animate && arc && box.contains(arc)) Motion.popIn(arc, 120);
    if (animate && line) Motion.enter(line, 0, 8, 380);
    this.el.replaceChildren(box);
  },
  edit(main, node) {
    const input = h('input', { class: 'g-input inset', type: 'text', value: S.greeting.name, maxLength: 32, 'aria-label': t('Greeting name') });
    let done = false;
    const finish = keep => {
      if (done) return;
      done = true;
      if (keep) { S.greeting.name = input.value.trim(); save(); }
      this.build(keep);
      if (globalThis.Settings?.el) Settings.rebuild();
    };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
    node.replaceWith(input);
    Motion.popIn(input);
    input.focus();
    input.select();
  },
};

/* ---------- search ---------- */
const ENGINES = {
  default: { label: 'Browser default' },
  google: { label: 'Google', url: 'https://www.google.com/search?q=%s' },
  duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  bing: { label: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  brave: { label: 'Brave', url: 'https://search.brave.com/search?q=%s' },
  startpage: { label: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
  ecosia: { label: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  qwant: { label: 'Qwant', url: 'https://www.qwant.com/?q=%s' },
  kagi: { label: 'Kagi', url: 'https://kagi.com/search?q=%s' },
  yahoo: { label: 'Yahoo', url: 'https://search.yahoo.com/search?p=%s' },
  custom: { label: 'Custom' },
};
const BANGS = {
  g: ENGINES.google.url, d: ENGINES.duckduckgo.url, b: ENGINES.bing.url,
  yt: 'https://www.youtube.com/results?search_query=%s', gh: 'https://github.com/search?q=%s',
  w: 'https://en.wikipedia.org/wiki/Special:Search?search=%s', m: 'https://www.google.com/maps/search/%s',
  a: 'https://www.amazon.com/s?k=%s', r: 'https://www.reddit.com/search/?q=%s',
  i: 'https://www.google.com/search?tbm=isch&q=%s', tr: 'https://translate.google.com/?text=%s',
};
const Search = {
  el: h('div', { class: 'w', 'data-w': 'search' }),
  build() {
    const s = S.search;
    const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: false, placeholder: s.placeholder || t('Search'), 'aria-label': t('Search') });
    const engine = s.switcher ? h('button', { class: 'engine-btn no-press', type: 'button', title: t('Search engine'), onclick: e => {
      const r = e.currentTarget.getBoundingClientRect();
      UI.menu(r.left, r.bottom + 6, Object.entries(ENGINES).filter(([k]) => k !== 'custom' || s.request).map(([value, x]) => ({ label: t(x.label), on: value === s.engine, run: () => { s.engine = value; save(); this.build(); this.input.focus(); } })));
    } }, h('span', { text: s.engine === 'default' ? t('Default') : t(ENGINES[s.engine]?.label || '') }), icon('E70D')) : null;
    const form = h('form', { class: 'inset', onsubmit: e => { e.preventDefault(); this.go(input.value); } }, icon('E721'), input, engine);
    const box = h('div', { class: 'search' }, form);
    this.input = input;
    this.box = box;
    input.addEventListener('input', () => this.suggest(input.value));
    input.addEventListener('keydown', e => this.keys(e));
    input.addEventListener('blur', () => setTimeout(() => this.close(), 120));
    this.el.replaceChildren(box);
  },
  go(q) {
    q = q.trim();
    if (!q) return Motion.shake(this.box);
    const s = S.search;
    const bang = s.bangs && (q.match(/^!(\w+)\s+(.+)$/) || q.match(/^(.+)\s+!(\w+)$/));
    if (bang) {
      const [key, text] = q.startsWith('!') ? [bang[1], bang[2]] : [bang[2], bang[1]];
      if (BANGS[key]) return this.open(BANGS[key].replace('%s', encodeURIComponent(text)));
    }
    if (/^(https?:\/\/)\S+$/.test(q) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q)) return this.open(/^https?:/.test(q) ? q : 'https://' + q);
    if (s.engine === 'default' && globalThis.chrome?.search) return chrome.search.query({ text: q, disposition: s.newtab ? 'NEW_TAB' : 'CURRENT_TAB' });
    const tpl = s.engine === 'custom' ? s.request : ENGINES[s.engine]?.url;
    this.open((tpl || ENGINES.google.url).replace('%s', encodeURIComponent(q)));
  },
  open(url) { if (S.search.newtab) window.open(url); else location.href = url; },
  async suggest(q) {
    if (!S.search.suggestions || !q.trim()) return this.close();
    const ask = ++this.ask;
    try {
      const data = await (await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`)).json();
      if (ask !== this.ask) return;
      this.show((data[1] || []).slice(0, 7));
    } catch { this.close(); }
  },
  ask: 0,
  show(list) {
    if (!list.length) return this.close();
    const had = !!this.panel;
    this.panel?.remove();
    this.panel = h('div', { class: 'suggest panel' }, list.map(x => h('button', {
      type: 'button',
      onpointerdown: e => { e.preventDefault(); this.input.value = x; this.go(x); },
    }, icon('E721'), h('span', { text: x }))));
    this.box.append(this.panel);
    if (!had) Motion.popIn(this.panel);
    this.sel = -1;
  },
  close() { this.ask++; this.panel?.remove(); this.panel = null; },
  keys(e) {
    if (e.key === 'Escape' && this.panel) { e.stopPropagation(); return this.close(); }
    if (!this.panel || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = [...this.panel.children];
    this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    this.input.value = items[this.sel].textContent;
  },
};

/* ---------- quotes (all public-domain, bundled, so they work offline) ---------- */
const QUOTES = {
  classic: [
    ['Life can only be understood backwards; but it must be lived forwards.', 'Søren Kierkegaard'],
    ['Just living is not enough. One must have sunshine, freedom, and a little flower.', 'Hans Christian Andersen'],
    ['Nothing great was ever achieved without enthusiasm.', 'Ralph Waldo Emerson'],
    ['Adopt the pace of nature: her secret is patience.', 'Ralph Waldo Emerson'],
    ['The reward of a thing well done is to have done it.', 'Ralph Waldo Emerson'],
    ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
    ['Well done is better than well said.', 'Benjamin Franklin'],
    ['Lost time is never found again.', 'Benjamin Franklin'],
    ['Courage is resistance to fear, mastery of fear, not absence of fear.', 'Mark Twain'],
    ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
    ['Nothing is worth more than this day.', 'Johann Wolfgang von Goethe'],
    ['Experience is simply the name we give our mistakes.', 'Oscar Wilde'],
    ['To live is the rarest thing in the world. Most people exist, that is all.', 'Oscar Wilde'],
    ['Keep your face always toward the sunshine, and shadows will fall behind you.', 'Walt Whitman'],
    ['Forever is composed of nows.', 'Emily Dickinson'],
    ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
    ['The best is the enemy of the good.', 'Voltaire'],
    ['Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison'],
    ['All of humanity\'s problems stem from man\'s inability to sit quietly in a room alone.', 'Blaise Pascal'],
    ['Fortune favours the bold.', 'Virgil'],
  ],
  stoic: [
    ['We suffer more often in imagination than in reality.', 'Seneca'],
    ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
    ['While we wait for life, life passes.', 'Seneca'],
    ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
    ['Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius'],
    ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
    ['The best revenge is not to be like your enemy.', 'Marcus Aurelius'],
    ['Confine yourself to the present.', 'Marcus Aurelius'],
    ['Very little is needed to make a happy life.', 'Marcus Aurelius'],
    ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
    ['No man is free who is not master of himself.', 'Epictetus'],
    ['He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.', 'Epictetus'],
  ],
};
const FREQ_MS = { hour: 36e5, day: 864e5 };
function isDue(last, freq) {
  if (!last) return true;
  if (freq === 'pause') return false;
  if (freq === 'tabs') return true;
  if (freq === 'period') return dayPeriod(new Date(last)) !== dayPeriod(new Date());
  if (freq === 'day') return new Date(last).toDateString() !== new Date().toDateString();
  return Date.now() - last >= (FREQ_MS[freq] || 36e5);
}
const dayPeriod = d => { const n = d.getHours(); return `${d.toDateString()}:${n < 6 ? 0 : n < 12 ? 1 : n < 18 ? 2 : 3}`; };

const Quote = {
  el: h('div', { class: 'w', 'data-w': 'quote' }),
  list() {
    const q = S.quotes;
    if (q.type === 'user') return q.user.split('\n').map(l => l.split('|').map(x => x.trim())).filter(l => l[0]).map(l => [l[0], l[1] || '']);
    if (q.type === 'url') return C.quoteUrl || [];
    if (q.type === 'favorites') return q.favs;
    return QUOTES[q.type] || QUOTES.classic;
  },
  build(animate, force) {
    const q = S.quotes, list = this.list();
    const st = C.quote ||= {};
    if (st.type !== q.type || force || isDue(st.ts, q.frequency) || !list[st.i]) {
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === st.i) i = (i + 1) % list.length;
      Object.assign(C.quote, { i, ts: Date.now(), type: q.type });
      saveCache();
    }
    const item = list[C.quote.i];
    const text = h('div', { class: 'quote-text' });
    if (item) t(item[0]).split(/(?<= )/).forEach((w, i) => {
      const s = h('span', { text: w });
      text.append(s);
      if (animate) Motion.enter(s, 0, 8, 220 + Math.min(i, 24) * 22);
    });
    else text.textContent = q.type === 'url' ? t('Loading…') : q.type === 'favorites' ? t('Tap the heart on a quote to keep it here') : t('Add your quotes in settings');
    const who = item?.[1] || '';
    const isFav = !!item && q.favs.some(x => x[0] === item[0]);
    const card = h('div', { class: 'quote panel' },
      h('div', { class: 'quote-mark', text: '“' }),
      text,
      h('div', { class: 'quote-foot' },
        q.author && who ? h('div', { class: 'avatar', style: `color:${colorFor(who)}`, text: who[0] }) : null,
        h('div', { class: 'quote-author', text: q.author ? who : '' }),
        item ? h('button', { class: 'ghost' + (isFav ? ' on' : ''), title: t('Favorite'), onclick: () => {
          q.favs = isFav ? q.favs.filter(x => x[0] !== item[0]) : [...q.favs, [item[0], who]];
          save();
          this.build(false);
          Motion.pop(this.el.querySelector('.quote-foot .ghost'), .6);
        } }, icon(isFav ? 'EB52' : 'EB51')) : null,
        h('button', { class: 'ghost', title: t('Copy'), onclick: e => { navigator.clipboard.writeText(`${item ? t(item[0]) : ''}${who ? ' — ' + who : ''}`); Motion.pop(e.currentTarget, .8); UI.toast(t('Copied')); } }, icon('E8C8')),
        h('button', { class: 'ghost', title: t('New quote'), onclick: () => { this.build(true, true); Motion.pop(this.el.firstChild, .97); } }, icon('E72C'))),
    );
    this.el.replaceChildren(card);
    if (q.type === 'url' && q.url) idle(() => this.fetchUrl());
  },
  async fetchUrl() {
    if (C.quoteUrlFrom === S.quotes.url && C.quoteUrl?.length && Date.now() - (C.quoteUrlTs || 0) < 864e5) return;
    try {
      const data = await (await fetch(S.quotes.url)).json();
      const arr = (Array.isArray(data) ? data : [data]).map(x => [x.content || x.text || x.quote, x.author || '']).filter(x => x[0]);
      if (arr.length) { C.quoteUrl = arr; C.quoteUrlFrom = S.quotes.url; C.quoteUrlTs = Date.now(); saveCache(); this.build(false, true); }
    } catch { UI.toast(t('Could not load quotes from that URL'), true); }
  },
};

/* ---------- notes ---------- */
const Notes = {
  el: h('div', { class: 'w', 'data-w': 'notes' }),
  build() {
    const area = h('textarea', { placeholder: t('Notes') + '…', value: S.notes.text, spellcheck: false, style: `text-align:${S.notes.align}` });
    let timer;
    area.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { S.notes.text = area.value; save(); }, 300); });
    this.area = area;
    this.el.replaceChildren(h('div', { class: 'notes panel' }, area));
  },
};

/* ---------- pomodoro ---------- */
const Pomo = {
  el: h('div', { class: 'w', 'data-w': 'pomodoro' }),
  st() { return C.pomo ||= { mode: 'focus', end: 0, left: 0, done: {} }; },
  total(mode) { return S.pomodoro[mode] * 60; },
  remaining() {
    const p = this.st();
    if (p.end) return Math.max(0, (p.end - Date.now()) / 1000);
    return p.left || this.total(p.mode);
  },
  build() {
    const p = this.st();
    const modes = [{ value: 'focus', label: t('Focus') }, { value: 'short', label: t('Break') }, { value: 'long', label: t('Long break') }];
    this.time = h('div', { class: 'pomo-time' });
    this.fill = h('div', { class: 'fill' });
    this.toggle = h('button', { class: 'accent-btn', onclick: () => this.startStop() });
    this.count = h('div', { class: 'pomo-count' });
    this.el.replaceChildren(h('div', { class: 'pomo panel' },
      UI.seg(modes, p.mode, m => { Object.assign(p, { mode: m, end: 0, left: 0 }); saveCache(); this.paint(); }),
      this.time,
      h('div', { class: 'progress inset' }, this.fill),
      h('div', { class: 'pomo-actions' }, this.toggle,
        h('button', { class: 'raised-btn square', title: t('Reset'), onclick: () => { Object.assign(p, { end: 0, left: 0 }); saveCache(); this.paint(); } }, icon('E72C')),
        h('button', { class: 'raised-btn square', title: t('Focus mode'), onclick: () => this.focusMode() }, icon('E740'))),
      this.count));
    this.paint();
  },
  focusMode() {
    const on = document.body.toggleAttribute('data-focus');
    if (on) Motion.popIn(this.el.firstChild);
    else Page.place(false);
  },
  startStop() {
    const p = this.st();
    if (p.end) { p.left = this.remaining(); p.end = 0; }
    else { p.end = Date.now() + this.remaining() * 1000; p.left = 0; }
    ExtraW.ambient?.onPomo?.(!!p.end);
    saveCache();
    wakeBeat();
    this.paint();
  },
  paint() {
    if (!this.time) return;
    const p = this.st(), left = this.remaining(), total = this.total(p.mode);
    const secs = Math.ceil(left);
    this.time.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
    if (p.end && left <= 0) return this.finish();
    const width = this.fill.parentElement.clientWidth;
    if (width) {
      const px = Math.round(width * (1 - left / total));
      if (px !== this.lastPx) { Motion.size(this.fill, 'width', Math.max(0, px), true); this.lastPx = px; }
    }
    this.toggle.replaceChildren(icon(p.end ? 'E769' : 'E768'), h('span', { text: p.end ? t('Pause') : t('Start') }));
    const today = new Date().toDateString();
    const n = p.done[today] || 0;
    this.count.textContent = S.pomodoro.stats ? this.stats() : n ? `${n} ${t('finished today')}` : '';
  },
  stats() {
    const log = C.pomoLog || {}, at = i => log[new Date(Date.now() - i * 864e5).toDateString()] || 0;
    let week = 0, streak = at(0) ? 1 : 0;
    for (let i = 0; i < 7; i++) week += at(i);
    for (let i = 1; i < 60 && at(i); i++) streak++;
    if (!week) return '';
    return `${at(0)} min ${t('today')}  ·  ${week} min ${t('this week')}${streak > 1 ? `  ·  ${streak} ${t('day streak')}` : ''}`;
  },
  finish() {
    const p = this.st(), day = new Date().toDateString();
    if (p.mode === 'focus') {
      p.done = { [day]: (p.done[day] || 0) + 1 };
      C.pomoLog ||= {};
      C.pomoLog[day] = (C.pomoLog[day] || 0) + S.pomodoro.focus;
      for (const k of Object.keys(C.pomoLog)) if (Date.now() - +new Date(k) > 60 * 864e5) delete C.pomoLog[k];
    }
    ExtraW.ambient?.onPomo?.(false);
    const end = p.end;
    Object.assign(p, { end: 0, left: 0 });
    saveCache();
    this.paint();
    Motion.pop(this.el.firstChild, .92);
    // Every open tab sees the timer end; the first to claim it rings.
    if (S.pomodoro.sound && localStorage.getItem('fs.pomoRang') !== String(end)) {
      localStorage.setItem('fs.pomoRang', end);
      playAlarm(S.pomodoro.alarm, S.pomodoro.volume);
    }
    UI.toast(t('Time is up!'));
  },
};
const TUNES = {
  bell: [[880, 0, 1.4], [1320, .02, 1.1]],
  chime: [[659, 0, .5], [784, .18, .5], [988, .36, .9]],
  digital: [[1000, 0, .08], [1000, .16, .08], [1000, .32, .08], [1000, .48, .08]],
  soft: [[440, 0, 1.6], [554, .1, 1.5]],
};
function playAlarm(name, volume) {
  const ctx = new AudioContext();
  for (const [freq, at, len] of TUNES[name] || TUNES.bell) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + at;
    o.type = name === 'digital' ? 'square' : 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volume / 200, t0 + .01);
    g.gain.exponentialRampToValueAtTime(.0005, t0 + len);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + len + .05);
  }
  setTimeout(() => ctx.close(), 3000);
}

/* ---------- weather (Open-Meteo: free, no key) ---------- */
const WMO = {
  0: ['Clear sky', 'clear'], 1: ['Mainly clear', 'clear'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Rime fog', 'fog'], 51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'], 61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'], 71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Rain showers', 'rain'], 81: ['Rain showers', 'rain'], 82: ['Violent showers', 'rain'], 85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm with hail', 'storm'], 99: ['Thunderstorm with hail', 'storm'],
};
// Weather icons: gradients and plain shapes only, no SVG filters, so they stay cheap however many are on screen.
const PUFFS = 'M18 49a10.5 10.5 0 0 1-1.7-20.9 16 16 0 0 1 30.9-3.7A12.5 12.5 0 0 1 46 49z';
const SOFT_CLOUD = 'M20 46h26a10 10 0 0 0 1.5-19.9A14 14 0 0 0 20.8 24 11 11 0 0 0 20 46z';
const CRESCENT = 'M41 40a15 15 0 0 1-17-22 16 16 0 1 0 22 21 15 15 0 0 1-5 1z';
const BOLT = 'M34 38l-9 14h6.5l-3.5 11 12-15.5h-6.5l5-9.5z';
const tear = (x, y) => 'M' + x + ' ' + y + 'c0 0-3.7 4.3-3.7 6.8a3.7 3.7 0 0 0 7.4 0c0-2.5-3.7-6.8-3.7-6.8z';
const stop = (at, color, alpha = 1) => '<stop offset="' + at + '" stop-color="' + color + '" stop-opacity="' + alpha + '"/>';
const linear = (id, ...stops) => '<linearGradient id="' + id + '" x1="0" y1="0" x2=".25" y2="1">' + stops.join('') + '</linearGradient>';
const radial = (id, cx, cy, ...stops) => '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r=".75">' + stops.join('') + '</radialGradient>';
const SCALLOP = (() => {
  let d = '';
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r = i % 2 ? 19 : 24;
    d += (i ? 'L' : 'M') + (32 + r * Math.sin(a)).toFixed(1) + ' ' + (32 - r * Math.cos(a)).toFixed(1);
  }
  return d + 'z';
})();

const ICON_STYLES = {
  // translucent clouds with the sun glowing through them
  frosted: {
    defs: linear('fc', stop(0, '#FFFFFF', .96), stop(1, '#E4E9F2', .62)) + linear('fb', stop(0, '#FFFFFF', .62), stop(1, '#DDE3EE', .3)) + radial('fs', .38, .32, stop(0, '#FFE28C'), stop(.7, '#F9B740'), stop(1, '#F09E2B')) + linear('fm', stop(0, '#FFFFFF', .98), stop(1, '#CFD8F2', .66)) + linear('fd', stop(0, '#FFFFFF', .95), stop(1, '#DDE8F7', .55)) + linear('fl', stop(0, '#FFE391'), stop(1, '#F5A623')),
    sun: l => l('wi-breathe', '<circle cx="32" cy="32" r="20" fill="#FFC95C" fill-opacity=".26"/>') + l('', '<circle cx="32" cy="32" r="14" fill="url(#fs)"/><circle cx="32" cy="32" r="13.6" fill="none" stroke="#FFFFFF" stroke-opacity=".32" stroke-width=".8"/>'),
    moon: l => l('wi-rock', '<path d="' + CRESCENT + '" fill="url(#fm)" stroke="#FFFFFF" stroke-opacity=".5" stroke-width=".7"/>'),
    star: '#FFFFFF',
    front: dy => '<path d="' + PUFFS + '" transform="translate(0 ' + dy + ')" fill="url(#fc)" stroke="#FFFFFF" stroke-opacity=".62" stroke-width=".8"/>',
    back: dy => '<path d="' + PUFFS + '" transform="translate(-5 ' + (dy - 7) + ') scale(.92)" fill="url(#fb)" stroke="#FFFFFF" stroke-opacity=".34" stroke-width=".7"/>',
    drop: (x, y) => '<path d="' + tear(x, y) + '" fill="url(#fd)"/>',
    flake: (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="2.8" fill="#FFFFFF" fill-opacity=".85"/>',
    bolt: '<path d="' + BOLT + '" fill="url(#fl)"/>',
  },
  // glossy, sculpted: scalloped sun, shining clouds, drops with a highlight
  glossy: {
    defs: linear('gr', stop(0, '#FFD98A'), stop(1, '#F39A32')) + radial('gs', .36, .28, stop(0, '#FFD65C'), stop(.6, '#FBA92C'), stop(1, '#EE8A1C')) + linear('gc', stop(0, '#FFFFFF'), stop(.55, '#EDF5FF'), stop(1, '#AFCFF2')) + linear('gb', stop(0, '#F2F8FF', .96), stop(1, '#9FC3EC', .9)) + linear('gd', stop(0, '#A9DBFF'), stop(1, '#3E8FE6')) + linear('gm', stop(0, '#CFC2FF'), stop(1, '#6B57E3', .78)) + linear('gl', stop(0, '#FFD95A'), stop(1, '#FF8A1E')) + radial('gg', .5, .5, stop(0, '#FFB23D', .55), stop(.66, '#FFB23D', 0)),
    sun: l => l('wi-spin', '<path d="' + SCALLOP + '" fill="url(#gr)" stroke="#FFE7B8" stroke-opacity=".7" stroke-width=".7" stroke-linejoin="round"/>') + l('', '<circle cx="32" cy="32" r="15" fill="url(#gs)"/><ellipse cx="27" cy="25.5" rx="7" ry="4.2" fill="#FFFFFF" fill-opacity=".3" transform="rotate(-24 27 25.5)"/>'),
    moon: l => l('wi-rock', '<path d="' + CRESCENT + '" fill="url(#gm)" stroke="#E5DEFF" stroke-opacity=".7" stroke-width=".7"/>'),
    star: '#EDE8FF',
    starShape: true,
    front: dy => '<path d="' + PUFFS + '" transform="translate(0 ' + dy + ')" fill="url(#gc)"/><ellipse cx="33" cy="' + (22 + dy) + '" rx="10" ry="4.6" fill="#FFFFFF" fill-opacity=".85"/>',
    back: dy => '<path d="' + PUFFS + '" transform="translate(-6 ' + (dy - 6) + ') scale(.9)" fill="url(#gb)"/>',
    drop: (x, y) => '<path d="' + tear(x, y) + '" fill="url(#gd)"/><ellipse cx="' + (x - 1.2) + '" cy="' + (y + 7) + '" rx=".9" ry="1.6" fill="#FFFFFF" fill-opacity=".75"/>',
    flake: (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="3" fill="url(#gc)"/>',
    bolt: '<circle cx="31" cy="50" r="16" fill="url(#gg)"/><path d="' + BOLT + '" fill="url(#gl)" stroke="#FFE9A8" stroke-opacity=".8" stroke-width=".6" stroke-linejoin="round"/>',
  },
  // flat illustration: pale gradient clouds, plain sun, white teardrops
  flat: {
    defs: linear('pc', stop(0, '#FFFFFF'), stop(1, '#D3D8F3')) + linear('pb', stop(0, '#F3F5FF'), stop(1, '#B9C0E9')) + linear('ps', stop(0, '#FFD777'), stop(1, '#F7AB2E')) + linear('pm', stop(0, '#FFFFFF'), stop(1, '#C9CEE8')) + linear('pl', stop(0, '#FFE27A'), stop(1, '#FAA02C')),
    sun: l => l('', '<circle cx="32" cy="32" r="15" fill="url(#ps)"/>'),
    moon: l => l('wi-rock', '<path d="' + CRESCENT + '" fill="url(#pm)"/>'),
    star: '#FFFFFF',
    front: dy => '<path d="' + PUFFS + '" transform="translate(0 ' + dy + ')" fill="url(#pc)"/>',
    back: dy => '<path d="' + PUFFS + '" transform="translate(-6 ' + (dy - 6) + ') scale(.9)" fill="url(#pb)"/>',
    drop: (x, y) => '<path d="' + tear(x, y) + '" fill="#FFFFFF"/>',
    flake: (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="#FFFFFF"/>',
    bolt: '<path d="' + BOLT + '" fill="url(#pl)"/>',
  },
};

function scene(code, isDay, style = S.weather.iconstyle) {
  const kind = WMO[code]?.[1] || 'cloud';
  const custom = ICON_STYLES[style];
  const line = style === 'line', mono = style === 'mono';
  const paint = (gradient, monoAlpha = 1) => (line ? 'fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"'
    : mono ? 'fill="currentColor" fill-opacity="' + monoAlpha + '"' : 'fill="url(#' + gradient + ')"');
  const stroke = (color, width) => 'stroke="' + (line || mono ? 'currentColor' : color) + '" stroke-width="' + width + '" stroke-linecap="round"';
  const soft = style === 'soft' ? '<defs><linearGradient id="wxs" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFD36B"/><stop offset="1" stop-color="#FF9A2E"/></linearGradient><linearGradient id="wxm" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#E4E9FB"/><stop offset="1" stop-color="#9AA8DD"/></linearGradient><linearGradient id="wxc" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#E7EAEF"/><stop offset="1" stop-color="#A7AFBA"/></linearGradient><linearGradient id="wxd" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8E97A4"/><stop offset="1" stop-color="#5C6470"/></linearGradient></defs>' : '';
  const defs = custom ? '<defs>' + custom.defs + '</defs>' : soft;
  // the animation sits on an HTML box around the drawing: SVG elements themselves don't reach the compositor
  const layer = (cls, body) => '<span class="wl ' + cls + '"><svg viewBox="0 0 64 64">' + defs + body + '</svg></span>';

  const sun = custom ? custom.sun(layer) : (line || mono ? '' : layer('wi-breathe', '<circle cx="32" cy="32" r="17" fill="#FFB23D" fill-opacity=".28"/>'))
    + layer('wi-spin', '<g ' + stroke('#FFB23D', 3.4) + '>' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => '<line x1="32" y1="9" x2="32" y2="14" transform="rotate(' + a + ' 32 32)"/>').join('') + '</g>')
    + layer('', '<circle cx="32" cy="32" r="12.5" ' + paint('wxs') + '/>');
  const dot = line || mono ? 'currentColor' : custom?.star || '#C8D3F5';
  const stars = [[14, 17, 1.2], [50, 16, 1.6], [53, 33, 1]].map(([x, y, r], i) => layer('wi-twinkle t' + i, custom?.starShape && i === 1
    ? '<path d="M50 11l1.5 3.6 3.8.3-2.9 2.5.9 3.8-3.3-2-3.3 2 .9-3.8-2.9-2.5 3.8-.3z" fill="' + dot + '"/>'
    : '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + dot + '"/>')).join('');
  const moon = stars + (custom ? custom.moon(layer) : layer('wi-rock', '<path d="' + CRESCENT + '" ' + paint('wxm') + '/>'));
  const front = (cls, dy, grad = 'wxc', alpha = 1) => layer(cls, custom ? custom.front(dy) : '<path d="' + SOFT_CLOUD + '" transform="translate(0 ' + dy + ')" ' + paint(grad, alpha) + '/>');
  const back = (cls, dy, grad = 'wxd', alpha = .55) => layer(cls, custom ? custom.back(dy) : '<path d="' + SOFT_CLOUD + '" transform="translate(0 ' + dy + ')" ' + paint(grad, alpha) + '/>');
  const drops = [24, 33, 42].map((x, i) => layer('wi-drop d' + i, custom ? custom.drop(x, 49) : '<line x1="' + x + '" y1="50" x2="' + (x - 2) + '" y2="56" ' + stroke('#6FB6FF', 3) + '/>')).join('');
  const flakes = [24, 33, 42].map((x, i) => layer('wi-flake d' + i, custom ? custom.flake(x, 52) : '<circle cx="' + x + '" cy="51" r="2.3" fill="' + (line || mono ? 'currentColor' : '#DDEBFF') + '"/>')).join('');
  const bolt = layer('wi-bolt', custom ? custom.bolt : '<path d="' + BOLT + '" fill="' + (line || mono ? 'currentColor' : '#FFD36B') + '"/>');
  const behind = html => '<span class="wi-behind">' + html + '</span>';
  const fog = layer('wi-mist', '<line x1="14" y1="50" x2="50" y2="50" ' + stroke(custom ? '#FFFFFF' : '#A7AFBA', 3) + '/>') + layer('wi-mist b', '<line x1="20" y1="57" x2="44" y2="57" ' + stroke(custom ? '#E4E8F5' : '#A7AFBA', 3) + '/>');
  const body = {
    clear: isDay ? sun : moon,
    partly: behind(isDay ? sun : moon) + front('wi-drift', custom ? 8 : 6),
    cloud: back('wi-drift b', custom ? 2 : -6) + front('wi-drift', 4),
    fog: (custom ? front('wi-drift', -6) : back('wi-drift', -8)) + fog,
    rain: drops + (custom ? back('wi-bob', -6) : '') + front('wi-bob', -6, 'wxd', .75),
    snow: flakes + (custom ? back('wi-bob', -6) : '') + front('wi-bob', -6),
    storm: drops + (custom ? back('wi-bob', -8) : '') + front('wi-bob', -8, 'wxd', .75) + bolt,
  }[kind];
  return '<span class="wi">' + body + '</span>';
}

const Weather = {
  el: h('div', { class: 'w', 'data-w': 'weather' }),
  build(animate) {
    const w = C.weather, s = S.weather;
    if (!w?.data?.current) {
      this.el.replaceChildren(h('div', { class: 'weather panel' }, h('div', { class: 'wx-empty', text: this.status || t('Loading…') })));
      return;
    }
    if (s.size === 'compact') {
      const cur = w.data.current;
      const pill = h('button', { class: 'wx-pill press', title: t('Weather'), onclick: () => this.toggleCard() });
      if (!s.hideicon) pill.insertAdjacentHTML('beforeend', scene(cur.weather_code, !!cur.is_day));
      pill.append(h('b', { text: `${Math.round(s.temperature === 'feelslike' ? cur.apparent_temperature : cur.temperature_2m)}°` }),
        h('div', { class: 'wx-pill-text' }, s.hidedesc ? null : h('span', { text: t(WMO[cur.weather_code]?.[0] || '') }), h('small', { text: w.city || '' })));
      this.closeCard();
      this.el.replaceChildren(pill);
      return;
    }
    this.closeCard();
    this.el.replaceChildren(this.card(animate));
  },
  makeRoom(change) {
    const others = [...(this.el.closest('.col')?.querySelectorAll('.w') || [])].filter(w => w !== this.el);
    const before = others.map(w => w.getBoundingClientRect().top);
    change();
    if (Motion.reduced) return;
    others.forEach((w, i) => {
      const dy = before[i] - w.getBoundingClientRect().top;
      if (dy) w.animate([{ translate: `0px ${dy}px` }, { translate: '0px 0px' }], { duration: 500, easing: Motion.Ease.bouncy });
    });
  },
  toggleCard() {
    if (this.pop) return this.closeCard();
    this.pop = this.card(true);
    this.pop.classList.add('wx-pop');
    this.makeRoom(() => this.el.append(this.pop));
    const zone = this.el.parentElement?.dataset.z || '';
    this.pop.style.transformOrigin = `${zone.endsWith('r') ? '100%' : zone.endsWith('l') ? '0%' : '50%'} ${zone.startsWith('b') ? '100%' : '0%'}`;
    Motion.popIn(this.pop);
    this.away = e => { if (!this.el.contains(e.target)) this.closeCard(); };
    addEventListener('pointerdown', this.away, true);
  },
  closeCard() {
    if (!this.pop) return;
    removeEventListener('pointerdown', this.away, true);
    const p = this.pop;
    this.pop = null;
    Motion.fadeOut(p, () => this.makeRoom(() => p.remove()));
  },
  card(animate) {
    const w = C.weather, s = S.weather;
    const d = w.data, cur = d.current, day = !!cur.is_day;
    const unit = s.showunit ? (s.unit === 'imperial' ? '°F' : '°C') : '°';
    const actual = Math.round(cur.temperature_2m), feels = Math.round(cur.apparent_temperature);
    const big = s.temperature === 'feelslike' ? feels : actual;
    const sub = s.temperature === 'both' ? `${t('Feels like')} ${feels}°` : '';
    const desc = t(WMO[cur.weather_code]?.[0] || '');
    const url = this.moreUrl(w);
    const top = h('div', { class: 'wx-top' },
      s.hideicon ? null : h('div', { class: 'wx-scene inset', html: scene(cur.weather_code, day) }),
      h('div', {},
        h('div', { class: 'wx-temp' }, String(big), h('sup', { text: unit })),
        s.hidedesc ? null : h('div', { class: 'wx-desc', text: [desc, sub].filter(Boolean).join(' · ') }),
        h('div', { class: 'wx-city', text: w.city || '' })));
    const card = h('div', { class: 'weather panel' + (url ? ' linked' : ''), onclick: url ? () => { location.href = url; } : null }, top);
    if (s.details && cur.relative_humidity_2m != null) {
      const rain = Math.max(...d.hourly.precipitation_probability.slice(0, 24));
      card.append(h('div', { class: 'wx-more' },
        h('div', { class: 'inset' }, `${feels}°`, h('small', { text: t('Feels like') })),
        h('div', { class: 'inset' }, `${cur.relative_humidity_2m}%`, h('small', { text: t('Humidity') })),
        h('div', { class: 'inset' }, `${Math.round(cur.wind_speed_10m)} ${s.unit === 'imperial' ? 'mph' : 'km/h'}`, h('small', { text: t('Wind') })),
        h('div', { class: 'inset' }, `${rain}%`, h('small', { text: t('Rain') }))));
    }
    if (s.forecast !== 'never') {
      card.append(this.spark(d, animate), this.sunArc(d));
      if (s.forecast === 'always') card.append(this.days(d));
    }
    return card;
  },
  moreUrl(w) {
    const s = S.weather, q = encodeURIComponent(w.city || '');
    return {
      msnw: `https://www.msn.com/weather/forecast/in-${q}`,
      yhw: `https://search.yahoo.com/search?p=weather+${q}`,
      windy: `https://www.windy.com/?${w.lat},${w.lon},9`,
      accu: `https://www.accuweather.com/en/search-locations?query=${q}`,
      custom: s.provider,
    }[s.moreinfo] || '';
  },
  // the next 24 hours: temperature line over rain bars, with a pulse at "now"
  spark(d, animate) {
    const times = d.hourly.time.map(x => +new Date(x));
    let start = times.findIndex(x => x > Date.now() - 36e5);
    if (start < 0) start = 0;
    const temps = d.hourly.temperature_2m.slice(start, start + 25), rain = d.hourly.precipitation_probability.slice(start, start + 25);
    const lo = Math.min(...temps), hi = Math.max(...temps), W = 240, H = 56, span = Math.max(hi - lo, 1);
    const x = i => i * W / (temps.length - 1), y = v => 14 + (H - 30) * (1 - (v - lo) / span);
    let path = `M0 ${y(temps[0])}`;
    for (let i = 1; i < temps.length; i++) {
      const mx = (x(i - 1) + x(i)) / 2;
      path += ` C${mx} ${y(temps[i - 1])} ${mx} ${y(temps[i])} ${x(i)} ${y(temps[i])}`;
    }
    const bars = rain.map((r, i) => r > 5 ? `<rect x="${x(i) - 3}" y="${H - r * .14}" width="6" height="${r * .14}" rx="2" fill="#6FB6FF" opacity=".55"/>` : '').join('');
    const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="wxt" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${y(lo + span)}" y2="${y(lo)}"><stop stop-color="#FF5F45"/><stop offset=".5" stop-color="#FFC95C"/><stop offset="1" stop-color="#5DB4FF"/></linearGradient></defs>${bars}<path d="${path} L${W} ${H} L0 ${H}Z" fill="url(#wxt)" fill-opacity=".2"/><path class="wx-line" pathLength="1" d="${path}" fill="none" stroke="url(#wxt)" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
    // high, low and now are drawn over the graph, so they stay round when it stretches
    const mark = (i, cls, text) => {
      const px = Math.min(92, Math.max(8, x(i) / W * 100));
      return h('span', { class: 'wx-mark ' + cls, style: `left:${px}%;top:${y(temps[i])}px`, text });
    };
    const hiAt = temps.indexOf(hi), loAt = temps.indexOf(lo);
    const nowDot = h('i', { class: 'wx-nowdot', style: `left:0;top:${y(temps[0])}px` });
    const rail = h('div', { class: 'wx-rail inset' }, h('div', { class: 'wx-plot', html: svg }));
    rail.firstChild.append(nowDot);
    if (hi - lo >= 1) rail.firstChild.append(mark(hiAt, 'hi', Math.round(hi) + '°'), mark(loAt, 'lo', Math.round(lo) + '°'));
    const hours = [0, 6, 12, 18, 24].map(i => {
      const at = new Date(times[start + i] || times[start]);
      return h('span', { text: `${at.getHours()}` });
    });
    rail.append(h('div', { class: 'wx-spark-labels' }, hours));
    if (animate && !Motion.reduced) {
      const line = rail.querySelector('.wx-line');
      line.style.strokeDasharray = 1;
      line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 900, delay: 200, easing: Motion.Ease.settle, fill: 'backwards' });
    }
    return rail;
  },
  sunArc(d) {
    const up = +new Date(d.daily.sunrise[0]), down = +new Date(d.daily.sunset[0]), now = Date.now();
    const day = now >= up && now <= down, f = Math.min(1, Math.max(0, (now - up) / (down - up)));
    const a = Math.PI * f, cx = 120 - 104 * Math.cos(a), cy = 58 - 48 * Math.sin(a);
    const clock = ms => { const x = new Date(ms); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
    const mins = Math.round((down - up) / 6e4);
    let length = `${Math.floor(mins / 60)}:${pad(mins % 60)}`;
    try { length = new Intl.DurationFormat(locale(), { style: 'narrow' }).format({ hours: Math.floor(mins / 60), minutes: mins % 60 }); } catch {}
    const ARC = 'M16 58A104 48 0 0 1 224 58';
    const svg = `<svg viewBox="0 0 240 66" aria-hidden="true"><defs><linearGradient id="wxsg" x1="0" x2="1" y1="0" y2="0"><stop stop-color="#FF7A45"/><stop offset=".5" stop-color="#FFD166"/><stop offset="1" stop-color="#FF7A45"/></linearGradient><linearGradient id="wxsf" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#FFC95C" stop-opacity=".3"/><stop offset="1" stop-color="#FFC95C" stop-opacity="0"/></linearGradient><clipPath id="wxsc"><rect x="0" y="0" width="${cx.toFixed(1)}" height="58"/></clipPath></defs><path d="${ARC}Z" fill="url(#wxsf)" clip-path="url(#wxsc)"/><path d="M4 58H236" class="wxs-hz"/><path d="${ARC}" class="wxs-path"/><path d="${ARC}" class="wxs-done" stroke="url(#wxsg)" pathLength="1" stroke-dasharray="${f.toFixed(3)} 1"/>${day ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11" fill="#FFC95C" fill-opacity=".28"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="#FFD166"/>` : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" class="wxs-moon"/>`}</svg>`;
    const glyph = rising => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 ${rising ? '10V3M5 6l3-3 3 3' : '3v7M5 7l3 3 3-3'}M2 13h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return h('div', { class: 'wx-sun' + (day ? '' : ' night') },
      h('div', { class: 'wxs-art', html: svg }),
      h('div', { class: 'wxs-times' },
        h('span', { class: 'wxs-t', html: glyph(true) + `<b>${clock(up)}</b>` }),
        h('small', { text: length }),
        h('span', { class: 'wxs-t', html: glyph(false) + `<b>${clock(down)}</b>` })));
  },
  days(d) {
    const fmt = dateFormat(locale(), { weekday: 'short' });
    return h('div', { class: 'wx-days' }, [1, 2, 3, 4].map(i => {
      if (!d.daily.time[i]) return null;
      return h('div', { class: 'wx-day raised' },
        h('span', { text: fmt.format(new Date(d.daily.time[i] + 'T12:00')) }),
        h('div', { html: scene(d.daily.weather_code[i], true, ['line', 'mono'].includes(S.weather.iconstyle) ? S.weather.iconstyle : 'glossy'), style: 'display:contents' }),
        h('b', { text: Math.round(d.daily.temperature_2m_max[i]) + '°' }),
        h('em', { text: Math.round(d.daily.temperature_2m_min[i]) + '°' }));
    }));
  },
  async locate() {
    const s = S.weather;
    if (s.geo === 'precise') {
      const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { maximumAge: 36e5, timeout: 8000 }));
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, city: C.weather?.geoCity || '' };
    }
    if (s.geo === 'off' && s.lat != null) return { lat: s.lat, lon: s.lon, city: s.city };
    // approximate: the computer's time zone already names a nearby city, so nothing leaves the PC until the forecast request
    const name = s.geo === 'off' ? s.city : Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
    const found = await geocode(name);
    if (!found[0]) throw new Error('no location');
    return { lat: found[0].latitude, lon: found[0].longitude, city: found[0].name };
  },
  async refresh(force) {
    const s = S.weather, w = C.weather;
    if (!s.on) return;
    const sig = ['v2', s.geo, s.city, s.lat, s.unit].join();
    if (!force && w?.data && w.sig === sig && Date.now() - w.ts < 18e5) return;
    try {
      const at = await this.locate();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.lat}&longitude=${at.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=5${s.unit === 'imperial' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`;
      const data = await (await fetch(url)).json();
      if (!data.current) throw new Error('bad response');
      const from = Math.max(0, data.hourly.time.findIndex(x => +new Date(x) > Date.now() - 36e5));
      for (const k of Object.keys(data.hourly)) data.hourly[k] = data.hourly[k].slice(from, from + 72);
      for (const k of ['current_units', 'hourly_units', 'daily_units']) delete data[k];
      C.weather = { ts: Date.now(), sig, data, ...at };
      saveCache();
      this.build(!w?.data);
      if (S.greeting.on) Greeting.build(false);
      applyPage();
    } catch (e) {
      console.warn('Weather failed', e);
      if (!w?.data) { this.status = t('Weather is unavailable. Check your location in settings.'); this.build(false); }
    }
  },
};
async function geocode(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=${LANG.split('-')[0]}`);
  return (await r.json()).results || [];
}

/* ---------- links: keycaps with a sunken icon well and a favicon-tinted lip on hover ---------- */
const hasChrome = () => !!globalThis.chrome?.runtime?.id;
const faviconUrl = url => `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
const Links = {
  el: h('div', { class: 'w', 'data-w': 'links' }),
  groupItems(name = S.links.selected) {
    const g = S.links.groups.find(x => x.name === name) || S.links.groups[0];
    if (g.type !== 'links') return (C.synced?.[g.name] || []);
    return S.links.items.filter(l => (l.group || 'Default') === g.name);
  },
  current() { return S.links.groups.find(x => x.name === S.links.selected) || S.links.groups[0]; },
  iconNode(l, mini) {
    if (l.icon && !/^(https?:|data:)/.test(l.icon)) return h('span', { class: 'emoji', text: l.icon });
    const letter = () => h('span', { class: 'letter', style: `color:${colorFor(l.title || l.url)}`, text: (l.title || l.url || '?').replace(/^https?:\/\/(www\.)?/, '')[0].toUpperCase() });
    if (l.icon) return h('img', { src: l.icon, alt: '', loading: 'lazy' });
    if (!hasChrome() || l.noicon) return letter();
    return h('img', { src: faviconUrl(l.url), alt: '', decoding: 'async', onerror: e => e.target.replaceWith(letter()) });
  },
  key(l, i, inFolder) {
    const isFolder = !!l.items;
    const well = h('span', { class: 'well' + (isFolder ? ' mosaic' : '') });
    if (isFolder) well.append(...l.items.slice(0, 4).map(x => this.iconNode(x, true)));
    else well.append(this.iconNode(l));
    const el = h(isFolder ? 'button' : 'a', {
      class: 'key press', 'data-id': l.id, draggable: false, title: isFolder ? l.title : `${l.title}\n${l.url}`,
      style: l.tint ? `--tint:${l.tint}` : '',
    }, well, h('span', { class: 'name', text: l.title }));
    if (i < 9 && !inFolder) el.append(h('span', { class: 'keyhint', text: i + 1 }));
    if (isFolder) el.type = 'button';
    else { el.href = l.url; if (S.links.newtab) el.target = '_blank'; }
    return el;
  },
  build(animate) {
    const s = S.links, box = h('div', { class: 'links' });
    if (s.groupson && s.groups.length > 1) {
      box.append(UI.seg(s.groups.map(g => ({ value: g.name, label: g.name === 'Default' ? t('Default') : g.name })), s.selected, v => {
        s.selected = v;
        save();
        this.renderKeys(true);
        idle(() => this.refreshSynced());
      }));
    }
    this.grid = h('div', { class: `keys ${s.style}${s.backgrounds ? '' : ' flat'}${s.titles ? '' : ' notitles'}` });
    box.append(this.grid);
    this.el.replaceChildren(box);
    this.renderKeys(animate);
  },
  renderKeys(animate) {
    const list = this.groupItems();
    const nodes = list.map((l, i) => this.key(l, i));
    this.grid.replaceChildren(...nodes);
    if (animate) nodes.forEach((n, i) => Motion.enter(n, 0, 14, 60 + Math.min(i, 14) * 25));
  },
  find(id) {
    for (const l of [...S.links.items, ...this.groupItems()]) {
      if (l.id === id) return { link: l, parent: S.links.items };
      for (const x of l.items || []) if (x.id === id) return { link: x, parent: l.items, folder: l };
    }
    return {};
  },
  edit(link) {
    const isFolder = !!link?.items;
    UI.modal((box, close) => {
      const field = (label, value, ph) => {
        const input = h('input', { type: 'text', value: value || '', placeholder: ph || '' });
        box.append(h('label', { class: 'f', text: label }), h('div', { class: 'text-in inset' }, input));
        return input;
      };
      box.append(h('h2', { text: link ? (isFolder ? t('Edit folder') : t('Edit link')) : t('Add link') }));
      const title = field(t('Title'), link?.title, 'Example');
      const url = isFolder ? null : field(t('Link'), link?.url, 'https://example.com');
      const ic = isFolder ? null : field(t('Icon'), link?.icon, t('Emoji or image URL. Empty uses the website favicon.'));
      const done = () => {
        let u = url?.value.trim();
        if (url) {
          if (!u) return Motion.shake(url.parentElement);
          if (!/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u;
        }
        const name = title.value.trim() || (u ? u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : t('Folder'));
        if (link) Object.assign(link, { title: name }, url ? { url: u, icon: ic.value.trim(), tint: undefined, noicon: undefined } : {});
        else S.links.items.push({ id: 'l' + Date.now(), title: name, url: u, icon: ic.value.trim(), group: this.current().name });
        save();
        close();
        this.build(false);
        globalThis.Settings?.el && Settings.rebuild();
        idle(() => tintLinks());
      };
      box.append(h('div', { class: 'actions' },
        h('button', { class: 'raised-btn', text: t('Cancel'), onclick: close }),
        h('button', { class: 'accent-btn', text: t('Save'), onclick: done })));
      box.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
      setTimeout(() => (link ? title : url || title).focus(), 30);
    });
  },
  remove(id) {
    const { parent, folder } = this.find(id);
    if (!parent) return;
    parent.splice(parent.findIndex(x => x.id === id), 1);
    // a folder down to one link stops being a folder
    if (folder && folder.items.length === 1) {
      const only = folder.items[0];
      Object.assign(only, { group: folder.group });
      S.links.items[S.links.items.indexOf(folder)] = only;
    }
    if (folder && !folder.items.length) S.links.items.splice(S.links.items.indexOf(folder), 1);
    save();
    this.closeFolder();
    this.build(false);
    globalThis.Settings?.el && Settings.rebuild();
  },
  openFolder(folder, keyEl) {
    this.closeFolder();
    const r = keyEl.getBoundingClientRect();
    const grid = h('div', { class: `keys ${S.links.style === 'text' ? 'text' : S.links.style === 'inline' ? 'inline' : 'medium'}` }, folder.items.map((l, i) => this.key(l, i, true)));
    const pop = h('div', { class: 'folder-pop panel' }, h('h3', { text: folder.title }), grid);
    document.body.append(pop);
    const b = pop.getBoundingClientRect();
    const spot = UI.freeSpot(b.width, b.height, [
      { left: r.left + r.width / 2 - b.width / 2, top: r.bottom + 10, origin: '50% 0%' },
      { left: r.left + r.width / 2 - b.width / 2, top: r.top - b.height - 10, origin: '50% 100%' },
      { left: r.right + 10, top: r.top, origin: '0% 20%' },
      { left: r.left - b.width - 10, top: r.top, origin: '100% 20%' },
    ]);
    pop.style.left = spot.left + 'px';
    pop.style.top = spot.top + 'px';
    pop.style.transformOrigin = spot.origin;
    Motion.popIn(pop);
    [...grid.children].forEach((b2, i) => Motion.enter(b2, 0, 10, i * 25));
    this.pop = pop;
    this.away = e => { if (!pop.contains(e.target) && !e.target.closest('.menu') && !e.target.closest('.modal')) this.closeFolder(); };
    addEventListener('pointerdown', this.away, true);
  },
  closeFolder() {
    if (!this.pop) return;
    removeEventListener('pointerdown', this.away, true);
    const p = this.pop;
    this.pop = null;
    Motion.fadeOut(p);
  },
  async refreshSynced() {
    const g = this.current();
    if (g.type === 'links' || !hasChrome()) return;
    let list = [];
    try {
      if (g.type === 'topsites' && chrome.topSites) list = (await chrome.topSites.get()).slice(0, 18).map((x, i) => ({ id: 'ts' + i, title: x.title, url: x.url }));
      if (g.type === 'bookmarks' && chrome.bookmarks) list = (await chrome.bookmarks.getChildren(g.folderId)).filter(x => x.url).slice(0, 48).map(x => ({ id: 'bm' + x.id, title: x.title, url: x.url }));
    } catch { return; }
    C.synced ||= {};
    const before = JSON.stringify(C.synced[g.name]);
    C.synced[g.name] = list;
    saveCache();
    if (before !== JSON.stringify(list)) this.renderKeys(false);
  },
  wire() {
    const el = this.el;
    // hover: lift on the same gentle spring Friis uses for one-small-overshoot moves
    document.addEventListener('pointerover', e => {
      const k = e.target.closest?.('.key');
      if (!k || k === this.hovered || Motion.reduced || S.style === 'glass') return;
      this.unhover();
      this.hovered = k;
      Motion.to(k, 'translate', '0px -3px', 360, Motion.Ease.settle);
    });
    document.addEventListener('pointerout', e => {
      if (this.hovered && !this.hovered.contains(e.relatedTarget)) this.unhover();
    });
    document.addEventListener('click', e => {
      const k = e.target.closest?.('.key[data-id]');
      if (!k) return;
      if (this.justDragged) { e.preventDefault(); e.stopPropagation(); return; }
      const { link } = this.find(k.dataset.id);
      if (link?.items) { e.preventDefault(); return this.openFolder(link, k); }
      // chrome:// pages can't be navigated to from an <a>
      if (link && /^(chrome|edge|about|file):/.test(link.url) && hasChrome()) {
        e.preventDefault();
        (S.links.newtab || e.ctrlKey) ? chrome.tabs.create({ url: link.url }) : chrome.tabs.update({ url: link.url });
      }
    });
    el.addEventListener('pointerdown', e => this.dragStart(e));
  },
  unhover() {
    if (!this.hovered) return;
    Motion.to(this.hovered, 'translate', '0px 0px', 360, Motion.Ease.settle);
    this.hovered = null;
  },
  // Drag to reorder, the others springing out of the way. Drop on the middle of a key to make a folder.
  dragStart(e) {
    const key = e.target.closest('.key[data-id]');
    if (!key || e.button !== 0 || this.current().type !== 'links') return;
    e.preventDefault();
    const grid = this.grid, sx = e.clientX, sy = e.clientY, r = key.getBoundingClientRect();
    let ghost = null, target = null, lock = 0, retry = 0;
    const flip = change => {
      const kids = [...grid.children], before = new Map(kids.map(k => [k, k.getBoundingClientRect()]));
      change();
      for (const k of kids) {
        if (k === key) continue;
        const a = before.get(k), b = k.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if ((dx || dy) && !Motion.reduced) k.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 500, easing: Motion.Ease.bouncy });
      }
    };
    const setTarget = k => {
      if (k === target) return;
      target?.classList.remove('folder-target');
      target = k;
      target?.classList.add('folder-target');
    };
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost) {
        if (Math.hypot(dx, dy) < 6) return;
        this.unhover();
        ghost = key.cloneNode(true);
        ghost.classList.add('ghost-key');
        ghost.style.cssText += `;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
        document.body.append(ghost);
        key.classList.add('drag-src');
        Motion.pop(ghost, .92);
        Motion.springBack(key);
      }
      ghost.style.transform = `translate(${dx}px, ${dy}px)`;
      aim(ev.clientX, ev.clientY);
    };
    const aim = (x, y) => {
      const over = document.elementFromPoint(x, y)?.closest('.key[data-id]');
      if (!over || over === key || !grid.contains(over)) return setTarget(null);
      const b = over.getBoundingClientRect(), cx = b.left + b.width / 2;
      const off = x - cx;
      if (Math.abs(off) < b.width * .24 && !this.find(key.dataset.id).link?.items) return setTarget(over);
      setTarget(null);
      const before = off < 0 ? over : over.nextSibling;
      if (before === key || key.nextSibling === before) return;
      // still springing from the last move: come back to this spot once that settles
      const wait = lock - performance.now();
      if (wait > 0) {
        clearTimeout(retry);
        retry = setTimeout(() => aim(x, y), wait);
        return;
      }
      lock = performance.now() + 220;
      flip(() => grid.insertBefore(key, before));
    };
    const up = () => {
      clearTimeout(retry);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      key.classList.remove('drag-src');
      this.justDragged = true;
      setTimeout(() => { this.justDragged = false; }, 60);
      if (target) this.mergeInto(key.dataset.id, target.dataset.id);
      else {
        const ids = [...grid.querySelectorAll('.key[data-id]')].map(k => k.dataset.id);
        const name = this.current().name, mine = id => S.links.items.find(x => x.id === id);
        S.links.items = [...S.links.items.filter(x => (x.group || 'Default') !== name), ...ids.map(mine).filter(Boolean)];
        save();
        this.renderKeys(false);
        Motion.pop(grid.querySelector(`[data-id="${key.dataset.id}"]`), .9);
      }
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  },
  mergeInto(id, onto) {
    const items = S.links.items, a = items.find(x => x.id === id), b = items.find(x => x.id === onto);
    if (!a || !b || a === b) return;
    items.splice(items.indexOf(a), 1);
    if (b.items) b.items.push(a);
    else items[items.indexOf(b)] = { id: 'f' + Date.now(), title: t('Folder'), group: b.group, items: [b, a] };
    save();
    this.renderKeys(false);
    const folder = items.find(x => x.items?.includes(a));
    if (folder) Motion.pop(this.grid.querySelector(`[data-id="${folder.id}"]`), .8);
  },
};

// After paint: sample each favicon's colour for its key's lip, and spot Chrome's blank globe so
// never-visited sites get a coloured initial instead, like a Friis avatar.
async function tintLinks() {
  if (!hasChrome()) return;
  const today = new Date().toDateString(), daily = C.tintDay !== today;
  const all = S.links.items.flatMap(l => l.items || [l]).filter(l => l.url && !l.icon && (daily || (!l.tint && !l.noicon)));
  if (!all.length) return;
  if (daily) { C.tintDay = today; saveCache(); }
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d', { willReadFrequently: true });
  const sample = url => new Promise(ok => {
    const img = new Image();
    img.onload = () => {
      try {
        x.clearRect(0, 0, 16, 16);
        x.drawImage(img, 0, 0, 16, 16);
        const px = x.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue;
          const sat = Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
          const w = 1 + sat;
          r += px[i] * w; g += px[i + 1] * w; b += px[i + 2] * w; n += w;
        }
        ok({ data: c.toDataURL(), tint: n ? `rgb(${r / n | 0} ${g / n | 0} ${b / n | 0})` : '' });
      } catch { ok(null); }
    };
    img.onerror = () => ok(null);
    img.src = url;
  });
  const globe = (await sample(faviconUrl('https://kufu-no-such-site.invalid/')))?.data;
  let changed = false;
  for (const l of all) {
    const got = await sample(faviconUrl(l.url));
    if (!got) continue;
    const blank = got.data === globe;
    if (!!l.noicon !== blank || (!blank && l.tint !== got.tint)) {
      if (blank) { l.noicon = true; delete l.tint; }
      else { delete l.noicon; l.tint = got.tint; }
      changed = true;
    }
  }
  if (changed) { save(); Links.build(false); }
}

/* ---------- backgrounds ---------- */
const Idb = {
  open: () => new Promise((ok, no) => {
    const r = indexedDB.open('fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  }),
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((ok, no) => {
      const q = fn(db.transaction('files', mode).objectStore('files'));
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
  },
  all() { return this.run('readonly', s => s.getAll()); },
  put(rec) { return this.run('readwrite', s => s.put(rec)); },
  del(id) { return this.run('readwrite', s => s.delete(id)); },
};

const UNSPLASH_KEY = '';
const Bg = {
  key: () => UNSPLASH_KEY || S.bg.unsplashKey,
  layers: [$('bgA'), $('bgB')],
  front: 0,
  // Grain is one noise split in two: its bright half is added to the picture, its dark half subtracted.
  // Unlike black and white specks on top, that never pulls the picture toward grey.
  grainImage(table) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" stitchTiles="stitch"/><feColorMatrix values="3 0 0 0 -1 3 0 0 0 -1 3 0 0 0 -1 0 0 0 0 1"/><feComponentTransfer>${['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${table}"/>`).join('')}</feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  },
  texture() {
    const grain = S.bg.grain, add = $('texture'), sub = $('grainDark');
    // no grain, no blending at all
    add.hidden = sub.hidden = !grain;
    add.style.opacity = sub.style.opacity = grain / 100;
    if (grain && !add.style.backgroundImage) {
      add.style.backgroundImage = this.grainImage('0 0 0 0 0 .04 .08 .12 .16');
      sub.style.backgroundImage = this.grainImage('.16 .12 .08 .04 0 0 0 0 0');
    }
  },
  filters() {
    const b = S.bg;
    document.documentElement.style.setProperty('--bg-dim', b.dim / 100);
    $('bg').style.filter = b.blur ? `blur(${b.blur}px)` : '';
    $('bg').style.inset = b.blur ? `-${b.blur * 2}px` : '';
  },
  // decide which item of a list to show, stepping only when the frequency says so
  pick(list, force) {
    if (!list.length) return null;
    const st = C.bgPick ||= {};
    const key = S.bg.type + ':' + list.length;
    if (st.key !== key || force || isDue(st.ts, S.bg.frequency) || st.i >= list.length) {
      st.i = st.next != null && st.next < list.length && st.key === key ? st.next : Math.floor(Math.random() * list.length);
      st.next = list.length > 1 ? (st.i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length : st.i;
      st.ts = Date.now();
      st.key = key;
      saveCache();
    }
    return list[st.i];
  },
  photoUrl(p) {
    const w = Math.min(3840, Math.round(screen.width * devicePixelRatio));
    return `${p.u}${p.u.includes('?') ? '&' : '?'}w=${w}&q=80&auto=format&fit=max`;
  },
  show(paint) {
    const next = this.layers[1 - this.front], prev = this.layers[this.front];
    next.replaceChildren();
    next.style.backgroundImage = '';
    paint(next);
    const fade = Motion.reduced ? 0 : S.bg.fade;
    if (fade && prev.style.opacity === '1') prev.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'linear' });
    prev.style.opacity = '0';
    next.style.opacity = '1';
    if (fade) next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: 'linear' });
    setTimeout(() => { prev.replaceChildren(); prev.style.backgroundImage = ''; }, fade + 50);
    this.front = 1 - this.front;
  },
  image(url) {
    const img = new Image();
    img.fetchPriority = 'high';
    img.src = url;
    const go = () => this.show(el => { el.style.backgroundImage = `url("${url}")`; });
    if (img.complete) { const f = S.bg.fade; S.bg.fade = 0; go(); S.bg.fade = f; }
    else img.decode().then(go, () => { this.failed(url); });
  },
  failed() { UI.toast(t('Could not load that background'), true); },
  credit(p) {
    this.shown = p;
    const box = $('credit');
    const c = this.creditEls ||= (() => {
      const next = h('button', { class: 'ghost square', title: t('Next background'), onclick: e => { if (!globalThis.Glass?.on) Motion.pop(e.currentTarget, .8); this.render(true); } }, icon('E72A'));
      const pause = h('button', { class: 'ghost square', onclick: () => { S.bg.frequency = S.bg.frequency === 'pause' ? 'hour' : 'pause'; save(); this.credit(this.shown); } });
      const full = h('button', { class: 'ghost square', title: t('Open full photo'), onclick: () => window.open(this.photoUrl(this.shown)) }, icon('E8A7'));
      const who = h('a', { class: 'who' });
      box.append(next, pause, full, who);
      return { next, pause, full, who };
    })();
    const paused = S.bg.frequency === 'pause', canStep = ['unsplash', 'files', 'urls', 'videos'].includes(S.bg.type);
    c.next.style.display = c.pause.style.display = canStep ? '' : 'none';
    c.full.style.display = p?.u ? '' : 'none';
    c.who.style.display = p?.n ? '' : 'none';
    c.pause.classList.toggle('pinned', paused);
    c.pause.title = paused ? t('Resume') : t('Pause');
    if (c.pause.dataset.icon !== String(paused)) { c.pause.dataset.icon = paused; c.pause.replaceChildren(icon(paused ? 'E768' : 'E769')); }
    if (p?.n) { c.who.href = `${p.l}?utm_source=kufu&utm_medium=referral`; c.who.textContent = `${t('Photo by')} ${p.n}`; }
  },
  async render(force) {
    const b = S.bg;
    document.body.toggleAttribute('data-photo', !['friis', 'color'].includes(b.type));
    document.documentElement.style.setProperty('--bg-color', b.type === 'color' ? b.color : b.type === 'friis' ? 'var(--win)' : '#0A0B0D');
    this.texture();
    this.filters();
    let photo = null;
    if (b.type === 'friis' || b.type === 'color') {
      for (const l of this.layers) { l.style.opacity = '0'; l.replaceChildren(); l.style.backgroundImage = ''; }
    } else if (b.type === 'unsplash') {
      photo = this.pick(C.photos || [], force);
      if (photo) {
        document.documentElement.style.setProperty('--bg-color', photo.c || '#0A0B0D');
        this.image(this.photoUrl(photo));
        this.trackDownload(photo);
        this.preloadNext();
      }
      if (!C.photos?.length || C.photosFrom !== b.collections) idle(() => this.loadCollection().catch(e => console.warn(e)));
    } else if (b.type === 'urls') {
      const u = this.pick(b.urls.split('\n').map(x => x.trim()).filter(Boolean), force);
      if (u) this.image(u);
    } else if (b.type === 'videos') {
      const u = this.pick(b.videos.split('\n').map(x => x.trim()).filter(Boolean), force);
      if (u) this.show(el => el.append(h('video', { src: u, autoplay: true, loop: true, muted: b.mute, playsInline: true })));
    } else if (b.type === 'files') {
      const files = await Idb.all().catch(() => []);
      const f = this.pick(files, force);
      if (f) { this.objUrl && URL.revokeObjectURL(this.objUrl); this.objUrl = URL.createObjectURL(f.blob); this.image(this.objUrl); }
    }
    this.credit(photo);
  },
  // The next photo is fetched during idle time, so the next tab finds it in the HTTP cache and shows it at once.
  preloadNext() {
    idle(() => {
      const n = C.bgPick?.next, p = C.photos?.[n];
      if (p) new Image().src = this.photoUrl(p);
    });
  },
  // Unsplash's API guidelines ask apps to report each photo that's actually used.
  trackDownload(p) {
    const st = C.bgPick;
    if (!p.d || st.tracked === p.u) return;
    st.tracked = p.u;
    saveCache();
    idle(() => fetch(`${p.d}${p.d.includes('?') ? '&' : '?'}client_id=${Bg.key()}`).catch(() => {}));
  },
  collectionIds(text = S.bg.collections) {
    return text.split(/[\s,]+/).filter(Boolean).map(x => x.match(/collections\/([\w-]+)/)?.[1] || x);
  },
  // Fetches up to 5 pages of each collection (30 photos a page) and keeps only the fields it draws.
  async loadCollection() {
    const b = S.bg;
    if (!b.collections || !this.key()) return false;
    if (this.loading) return false;
    this.loading = true;
    try {
      const photos = [];
      for (const orientation of ['&orientation=landscape', '']) {
        for (const id of this.collectionIds()) for (let page = 1; page <= 5; page++) {
          const r = await fetch(`https://api.unsplash.com/collections/${encodeURIComponent(id)}/photos?per_page=30&page=${page}${orientation}&client_id=${encodeURIComponent(this.key())}`);
          if (!r.ok) throw new Error(r.status === 401 ? 'That Unsplash Access Key was refused' : r.status === 404 ? `Collection ${id} was not found` : r.status === 403 ? 'Unsplash rate limit reached, try again in an hour' : `Unsplash error ${r.status}`);
          const list = await r.json();
          photos.push(...list.map(p => ({ u: p.urls.raw, c: p.color, n: p.user?.name, l: p.user?.links?.html, d: p.links?.download_location })));
          if (list.length < 30) break;
        }
        if (photos.length) break;   // a collection with no landscape photos still shows the ones it has
      }
      if (!photos.length) throw new Error('Unsplash gave no photos for that collection. Unsplash+ collections cannot be used.');
      C.photos = photos;
      C.photosFrom = b.collections;
      C.bgPick = {};
      saveCache();
      if (b.type === 'unsplash') this.render(true);
      return photos.length;
    } finally { this.loading = false; }
  },
};

/* ---------- the page: everything lives in zones ---------- */
const OWN_COLOR = { clock: 'clock.color', date: 'date.textcolor', greeting: 'greeting.color', search: 'search.textcolor', links: 'links.titlecolor', weather: 'weather.textcolor', quote: 'quotes.textcolor', notes: 'notes.textcolor', pomodoro: 'pomodoro.textcolor', tasks: 'tasks.textcolor', ambient: 'ambient.textcolor', countdown: 'countdown.textcolor', progress: 'progress.textcolor' };
function paintTextColors() {
  const all = S.textColor, glassClock = S.style === 'glass' || S.clock.style === 'glass';
  for (const [id, path] of Object.entries(OWN_COLOR)) {
    const el = (WIDGETS[id] || ExtraW[id])?.el;
    if (!el) continue;
    let c = path.split('.').reduce((o, k) => o?.[k], S) || all;
    if (id === 'clock' && glassClock) c = '';
    if (c) { el.setAttribute('data-tc', ''); el.style.setProperty('--tc', c); }
    else if (el.hasAttribute('data-tc')) { el.removeAttribute('data-tc'); el.style.removeProperty('--tc'); }
  }
}
const WIDGETS = { clock: Clock, date: DateW, greeting: Greeting, weather: Weather, search: Search, links: Links, quote: Quote, notes: Notes, pomodoro: Pomo };
const ExtraW = {};      // tasks, sounds, countdown, progress: extras.js adds them when one is turned on
const widgetOn = id => !!(S[id === 'quote' ? 'quotes' : id]?.on && (WIDGETS[id] || ExtraW[id]));
const ZONE_SIDE = { tl: 'start', l: 'start', bl: 'start', tc: 'mid', center: 'mid', bc: 'mid', tr: 'end', r: 'end', br: 'end' };

const Page = {
  onPlace: null,
  place(animate) {
    const zones = {}, seen = new Set(), stored = S.layout.zones;
    for (const z of ZONES) zones[z] = h('div', { class: `zone ${ZONE_SIDE[z]}`, 'data-z': z });
    for (const z of ZONES) for (const id of stored[z] || []) {
      if (seen.has(id) || !widgetOn(id)) continue;
      seen.add(id);
      zones[z].append((WIDGETS[id] || ExtraW[id]).el);
    }
    // anything not placed yet (a widget newer than this saved layout) joins the middle
    for (const id of [...Object.keys(WIDGETS), ...Object.keys(ExtraW)]) if (widgetOn(id) && !seen.has(id)) zones.center.append((WIDGETS[id] || ExtraW[id]).el);
    const hero = h('div', { class: 'hero' }, zones.center);
    const col = (cls, ...kids) => h('div', { class: 'col ' + cls }, kids);
    $('page').replaceChildren(col('col-side', zones.tl, zones.l, zones.bl), col('col-mid', zones.tc, hero, zones.bc), col('col-side', zones.tr, zones.r, zones.br));
    if (animate) this.entrance(zones);
    this.onPlace?.();
  },
  entrance(zones) {
    if (Motion.reduced) return;
    // the clock is readable from the very first frame: it only springs, it never fades
    if (S.clock.on) Motion.pop(Clock.el.firstChild, .88);
    if (S.date.on) Motion.enter(DateW.el, 0, 10, 40);
    for (const z of ZONES) [...zones[z].children].forEach((el, i) => {
      const id = el.dataset.w;
      if (id === 'greeting' || id === 'links' || id === 'clock' || id === 'date') return;
      const side = ZONE_SIDE[z];
      Motion.enter(el, side === 'start' ? -16 : side === 'end' ? 16 : 0, side === 'mid' ? 14 : 0, 60 + i * 40);
    });
    Motion.pop($('gear'), .7);
  },
  renderAll(animate) {
    applyPage();
    applyMotionPref();
    document.body.removeAttribute('data-focus');
    if (S.clock.on) Clock.build();
    if (S.date.on) DateW.build(animate);
    if (S.greeting.on) Greeting.build(animate);
    if (S.search.on) Search.build();
    if (S.links.on) Links.build(animate);
    if (S.weather.on) Weather.build(animate);
    if (S.quotes.on) Quote.build(animate);
    if (S.notes.on) Notes.build();
    if (S.pomodoro.on) Pomo.build();
    for (const id in ExtraW) if (S[id]?.on) ExtraW[id].build(animate);
    this.place(animate);
    paintTextColors();
    if (S.pomodoro.on) queueMicrotask(() => Pomo.paint());
    $('gear').hidden = S.hideGear;
    wakeBeat();
    syncGlass();
    // only ever fetched if one of its widgets is switched on, and never before first paint
    if (!Lazy.extrasReady && ['tasks', 'ambient', 'countdown', 'progress'].some(k => S[k].on)) Lazy.extras().then(() => this.renderAll(false));
  },
};

/* ---------- settings and extras load on demand, so they cost new tabs nothing ---------- */
const Lazy = {
  css(href) {
    let link = document.querySelector(`link[href="${href}"]`);
    if (!link) {
      link = h('link', { rel: 'stylesheet', href });
      link.ready = new Promise(done => { link.addEventListener('load', done); link.addEventListener('error', done); });
      document.head.append(link);
    }
    return link.ready || Promise.resolve();
  },
  script(src) { return new Promise((ok, no) => document.head.append(h('script', { src, onload: ok, onerror: no }))); },
  load() {
    this.css('extras.css');
    this.css('settings.css');
    DESIGNS.forEach(loadDesign);
    return this.settings ||= this.script('settings.js');
  },
  extras() {
    return this.extrasP ||= Promise.all([this.css('extras.css'), this.script('extras.js')]).then(() => { this.extrasReady = true; });
  },
  async toggle() { await this.load(); Settings.toggle(); },
};

// Refraction is a treat that arrives right after paint. Everything else about Glass is plain CSS.
let painted = false;
function syncGlass() {
  if (!painted) return;
  const want = S.style === 'glass' && ['glass', 'translucent'].includes(S.surface.mode);
  if (want) (Lazy.glass ||= Lazy.script('glass.js')).then(() => { if (S.style === 'glass') Glass.start(); });
  else globalThis.Glass?.stop();
}

// the glass numbers' code only arrives if that style is chosen, and only after first paint
function syncGlassDigits() {
  if (S.clock.style !== 'glass' || S.clock.analog) return;
  (Lazy.digits ||= Lazy.script('glassdigits.js')).then(() => GlassDigits.refresh());
}

function toggleTheme() {
  S.dark = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save();
  applyPage();
  Bg.texture();
  syncGlass();
  globalThis.GlassDigits?.refresh();
}
function toggleZen(force) {
  const on = document.body.toggleAttribute('data-zen', force);
  if (on) UI.toast(t('Press Z to bring everything back'));
}

/* ---------- context menu + keys ---------- */
function wirePage() {
  Motion.install();
  Links.wire();
  $('gear').addEventListener('click', () => Lazy.toggle());
  $('gear').addEventListener('pointerenter', () => Lazy.load(), { once: true });
  $('gear').addEventListener('pointerenter', e => { if (!Motion.reduced) e.currentTarget.firstChild.animate([{ rotate: '0deg' }, { rotate: '90deg' }], { duration: 700, easing: Motion.Ease.spring }); });

  document.addEventListener('contextmenu', e => {
    if (e.target.closest('input, textarea, .settings, .modal')) return;
    e.preventDefault();
    const k = e.target.closest('.key[data-id]');
    if (k) {
      const { link, folder } = Links.find(k.dataset.id);
      if (!link) return;
      const editable = Links.current().type === 'links' || folder;
      const others = S.links.groups.filter(g => g.type === 'links' && g.name !== (link.group || 'Default'));
      UI.menu(e.clientX, e.clientY, [
        !link.items && { label: t('Open in new tab'), icon: 'E8A7', run: () => window.open(link.url) },
        link.items && { label: t('Open all'), icon: 'E8A7', run: () => link.items.forEach(x => window.open(x.url)) },
        editable && { label: t('Edit'), icon: 'E70F', run: () => Links.edit(link) },
        folder && { label: t('Take out of folder'), icon: 'E8C6', run: () => {
          folder.items.splice(folder.items.indexOf(link), 1);
          S.links.items.push({ ...link, group: folder.group });
          if (folder.items.length === 1) { const only = folder.items[0]; only.group = folder.group; S.links.items[S.links.items.indexOf(folder)] = only; }
          save(); Links.closeFolder(); Links.build(false);
        } },
        ...(editable && !folder && S.links.groupson ? others.map(g => ({ label: `${t('Move to')} ${g.name}`, icon: 'E8DE', run: () => { link.group = g.name; save(); Links.build(false); } })) : []),
        editable && { label: t('Delete'), icon: 'E74D', danger: true, run: () => Links.remove(link.id) },
      ]);
      return;
    }
    UI.menu(e.clientX, e.clientY, [
      ['unsplash', 'files', 'urls', 'videos'].includes(S.bg.type) && { label: t('Next background'), icon: 'E72A', run: () => Bg.render(true) },
      S.quotes.on && { label: t('New quote'), icon: 'E72C', run: () => Quote.build(true, true) },
      { label: t('Arrange page'), icon: 'E80A', run: () => Lazy.extras().then(() => Arrange.toggle()) },
      { label: document.documentElement.dataset.theme === 'dark' ? t('Light mode') : t('Dark mode'), icon: 'E793', run: toggleTheme },
      { label: t('Hide everything'), icon: 'E890', run: () => toggleZen(true) },
      { label: t('Settings'), icon: 'E713', run: () => Lazy.toggle() },
    ]);
  });

  addEventListener('keydown', e => {
    const key = e.key.toLowerCase(), inField = e.target.matches?.('input, textarea');
    if ((e.ctrlKey || e.metaKey) && key === 'k' && S.palette) { e.preventDefault(); Lazy.extras().then(() => Palette.toggle()); return; }
    if (e.ctrlKey && e.shiftKey && key === 'l') { e.preventDefault(); toggleTheme(); Motion.pop($('gear'), .8); return; }
    if (key === 'z' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleZen(); return; }
    if (e.key === 'Escape' && document.body.hasAttribute('data-zen')) { toggleZen(false); return; }
    if (e.key === 'Escape' && globalThis.Arrange?.on) { Arrange.toggle(); return; }
    if (e.key === 'Escape' && globalThis.Palette?.el) { Palette.toggle(); return; }
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const k = Links.grid?.querySelectorAll('.key[data-id]')[e.key - 1];
      if (k) { e.preventDefault(); k.click(); if (k.href && !e.defaultPrevented) location.href = k.href; }
    }
    if (e.key === 'Alt') { e.preventDefault(); document.body.toggleAttribute('data-alt', true); }
    const typing = e.target.matches?.('input, textarea');
    if (e.key === 'Escape') {
      if (Links.pop) return Links.closeFolder();
      if (!$('scrim').hidden) return $('scrim').querySelector('.modal') && ($('scrim').onpointerdown({ target: $('scrim') }));
      if (!typing || e.target.closest('.settings')) Lazy.toggle();
    }
    if (e.key === '/' && !typing && S.search.on) { e.preventDefault(); Search.input?.focus(); }
  });
  addEventListener('keyup', e => { if (e.key === 'Alt') document.body.removeAttribute('data-alt'); });
  addEventListener('blur', () => document.body.removeAttribute('data-alt'));

  // Other tabs: follow settings changes without a reload.
  addEventListener('storage', e => {
    if (e.key === 'fs.state' && e.newValue) {
      const next = merge(DEFAULTS, JSON.parse(e.newValue));
      const typingNotes = document.activeElement === Notes.area;
      if (JSON.stringify({ ...next, rev: 0 }) === JSON.stringify({ ...S, rev: 0 })) return;
      S = next;
      if (typingNotes) return;
      if (document.hidden) { staleTab = true; return; }   // redraw when it's looked at, not for every change elsewhere
      Page.renderAll(false);
      Bg.render(false);
    }
    if (e.key === 'fs.cache' && e.newValue) {
      if (document.hidden && !S.pomodoro.on) { staleCache = e.newValue; return; }
      const fresh = JSON.parse(e.newValue);
      Object.assign(C, fresh);
      if (S.pomodoro.on) { Pomo.paint(); wakeBeat(); }
    }
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPage);
}

/* ---------- first paint ---------- */
Page.renderAll(true);
syncGlassDigits();
wirePage();
Bg.render(false);

let lastMinute = -1, resting = false, staleTab = false, staleCache = null;
var beatTimer = 0;
function wakeBeat() {
  clearTimeout(beatTimer);
  const now = Date.now(), everySecond = S.clock.seconds || S.clock.analog || (S.pomodoro.on && Pomo.st().end);
  beatTimer = setTimeout(heartbeat, everySecond ? 1000 - (now % 1000) : 60000 - (now % 60000));
}
function heartbeat() {
  if (document.hidden && !(S.pomodoro.on && Pomo.st().end)) { resting = true; return; }
  Clock.tick(true);
  if (S.pomodoro.on && Pomo.st().end) Pomo.paint();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  if (m !== lastMinute) {
    if (lastMinute >= 0) {
      if (S.date.on && DateW.key !== new Date().toDateString()) DateW.build(true);
      if (S.greeting.on && m % 30 === 0) Greeting.build(false);
      if (S.dark === 'auto') { applyPage(); Bg.texture(); }
      if (S.bg.frequency !== 'pause' && S.bg.frequency !== 'tabs' && ['unsplash', 'urls', 'files', 'videos'].includes(S.bg.type) && isDue(C.bgPick?.ts, S.bg.frequency)) Bg.render(false);
      if (S.weather.on && m % 30 === 0) Weather.refresh();
    }
    lastMinute = m;
  }
  wakeBeat();
}
wakeBeat();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (staleTab) { staleTab = false; Page.renderAll(false); Bg.render(false); }
  if (staleCache) { Object.assign(C, JSON.parse(staleCache)); staleCache = null; }
  if (resting) { resting = false; Clock.tick(false); if (S.weather.on) Weather.refresh(); heartbeat(); }
});

// Everything below happens after the page has already painted.
requestAnimationFrame(() => setTimeout(() => {
  painted = true;
  syncGlass();
  syncGlassDigits();
  Links.refreshSynced();
  Weather.refresh();
  Sync.pull(() => { Page.renderAll(false); Bg.render(false); });
  idle(() => tintLinks());
  idle(() => loadTranslations().then(changed => { if (changed) Page.renderAll(false); }));
}, 0));
