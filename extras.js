'use strict';
// Everything here is optional, so it loads only when a widget below is on, or on Ctrl+K, or when arranging.

/* ---------- tasks ---------- */
const Tasks = {
  el: h('div', { class: 'w', 'data-w': 'tasks' }),
  build() {
    const input = h('input', { type: 'text', placeholder: t('Add a task') + '…', maxLength: 140, onkeydown: e => {
      if (e.key !== 'Enter') return;
      const text = input.value.trim();
      if (!text) return Motion.shake(input.parentElement);
      S.tasks.items.push({ id: 't' + Date.now(), text, done: false });
      save();
      this.build();
      this.input.focus();
      Motion.enter(this.list.lastChild, 0, 10);
      Greeting.build(false);
    } });
    this.input = input;
    this.list = h('div', { class: 'task-list' }, S.tasks.items.map(x => this.row(x)));
    const done = S.tasks.items.filter(x => x.done).length;
    this.el.replaceChildren(h('div', { class: 'tasks panel' },
      h('div', { class: 'text-in inset' }, input), this.list,
      done ? h('button', { class: 'ghost small', text: `${t('Clear finished')} (${done})`, onclick: () => { S.tasks.items = S.tasks.items.filter(x => !x.done); save(); this.build(); } }) : null));
  },
  row(x) {
    const tick = h('button', { class: 'tick no-press' + (x.done ? ' on' : ''), title: t('Done'), onclick: () => {
      x.done = !x.done;
      save();
      row.classList.toggle('done', x.done);
      tick.classList.toggle('on', x.done);
      Motion.pop(tick, .55);
      Greeting.build(false);
      setTimeout(() => this.build(), 420);
    } }, x.done ? icon('E73E') : null);
    const row = h('div', { class: 'task' + (x.done ? ' done' : '') }, tick, h('span', { text: x.text }),
      h('button', { class: 'ghost square task-del', title: t('Delete'), onclick: () => { S.tasks.items = S.tasks.items.filter(y => y !== x); save(); Motion.fadeOut(row, () => this.build()); } }, icon('E711')));
    return row;
  },
};

/* ---------- ambient sounds: generated in the browser, nothing to download ---------- */
const SOUNDS = { rain: 'Rain', waves: 'Waves', wind: 'Wind', brown: 'Brown noise', white: 'White noise' };
const Ambient = {
  el: h('div', { class: 'w', 'data-w': 'ambient' }),
  ctx: null, nodes: [], playing: false,
  noise(brown) {
    const len = this.ctx.sampleRate * 4, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  },
  start() {
    this.stop();
    this.ctx ||= new AudioContext();
    this.ctx.resume();
    const c = this.ctx, kind = S.ambient.sound;
    this.gain = c.createGain();
    this.gain.gain.value = S.ambient.volume / 100;
    this.gain.connect(c.destination);
    const src = this.noise(kind === 'brown' || kind === 'waves' || kind === 'wind');
    let tail = src;
    const filter = (type, freq) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; tail.connect(f); tail = f; return f; };
    const lfo = (rate, depth, target) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(target); o.start(); this.nodes.push(o); };
    if (kind === 'rain') { filter('highpass', 900); filter('lowpass', 9000); }
    if (kind === 'waves') { const g = c.createGain(); g.gain.value = .6; tail.connect(g); tail = g; lfo(.11, .45, g.gain); }
    if (kind === 'wind') { const f = filter('bandpass', 500); f.Q.value = .6; lfo(.07, 260, f.frequency); }
    if (kind === 'white') { const g = c.createGain(); g.gain.value = .25; tail.connect(g); tail = g; }
    tail.connect(this.gain);
    src.start();
    this.nodes.push(src);
    this.playing = true;
    this.paint();
  },
  stop() {
    for (const n of this.nodes) { try { n.stop(); } catch {} }
    this.nodes = [];
    this.gain?.disconnect();
    this.playing = false;
    this.paint();
  },
  onPomo(running) { if (S.ambient.on && S.ambient.withpomo) running ? this.start() : this.stop(); },
  paint() { if (this.btn) this.btn.replaceChildren(icon(this.playing ? 'E769' : 'E768'), h('span', { text: this.playing ? t('Pause') : t('Play') })); },
  build() {
    this.btn = h('button', { class: 'accent-btn small', onclick: () => (this.playing ? this.stop() : this.start()) });
    const vol = h('input', { type: 'range', min: 0, max: 100, value: S.ambient.volume, style: `--p:${S.ambient.volume}%`, title: t('Volume'), oninput: () => {
      S.ambient.volume = +vol.value;
      vol.style.setProperty('--p', vol.value + '%');
      if (this.gain) this.gain.gain.value = vol.value / 100;
    }, onchange: () => save() });
    this.el.replaceChildren(h('div', { class: 'ambient panel' },
      h('div', { class: 'sound-chips' }, Object.entries(SOUNDS).map(([k, label]) => h('button', {
        class: 'chip-btn' + (k === S.ambient.sound ? ' on' : ''), text: t(label),
        onclick: () => { S.ambient.sound = k; save(); const was = this.playing; this.build(); if (was) this.start(); },
      }))),
      h('div', { class: 'ambient-row' }, this.btn, vol)));
    this.paint();
  },
};

/* ---------- countdown ---------- */
const Countdown = {
  el: h('div', { class: 'w', 'data-w': 'countdown' }),
  build() {
    const c = S.countdown;
    if (!c.date) {
      this.el.replaceChildren(h('button', { class: 'raised-btn small', onclick: () => Lazy.load().then(() => Settings.openAt('countdown')) }, icon('E823'), h('span', { text: t('Set a countdown') })));
      return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((+new Date(c.date + 'T00:00') - +today) / 864e5);
    const label = days === 0 ? t('today') : days > 0 ? t(days === 1 ? 'day until' : 'days until') : t('days since');
    this.el.replaceChildren(h('div', { class: 'countdown panel' },
      h('div', { class: 'cd-num raised', text: Math.abs(days) }),
      h('div', { class: 'cd-text' }, h('small', { text: label }), h('b', { text: c.title || c.date }))));
  },
};

/* ---------- progress of the day, week, month, year ---------- */
const Progress = {
  el: h('div', { class: 'w', 'data-w': 'progress' }),
  value(kind) {
    const n = new Date(), y = n.getFullYear(), day = new Date(y, n.getMonth(), n.getDate());
    if (kind === 'day') return (n - day) / 864e5;
    if (kind === 'week') { const f = (n.getDay() - firstDayOfWeek() + 7) % 7; return (f + (n - day) / 864e5) / 7; }
    if (kind === 'month') return (n - new Date(y, n.getMonth(), 1)) / (new Date(y, n.getMonth() + 1, 1) - new Date(y, n.getMonth(), 1));
    return (n - new Date(y, 0, 1)) / (new Date(y + 1, 0, 1) - new Date(y, 0, 1));
  },
  build() {
    const names = { day: 'Today', week: 'This week', month: 'This month', year: 'This year' };
    const kinds = Object.keys(names).filter(k => S.progress[k]);
    this.el.replaceChildren(h('div', { class: 'progress-card panel' }, kinds.map(k => {
      const pct = this.value(k), fill = h('div', { class: 'fill', style: `width:${Math.max(4, pct * 100)}%` });
      return h('div', { class: 'pr-row' }, h('div', { class: 'pr-head' }, h('span', { text: t(names[k]) }), h('b', { text: Math.floor(pct * 100) + '%' })), h('div', { class: 'progress inset' }, fill));
    })));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.build(), 6e4);
  },
};

Object.assign(ExtraW, { tasks: Tasks, ambient: Ambient, countdown: Countdown, progress: Progress });

/* ---------- month calendar, from the week rail ---------- */
const Calendar = {
  el: null,
  toggle(anchor) {
    if (this.el) return this.close();
    if (!anchor?.isConnected) anchor = document.querySelector('[data-w="date"] .week') || document.querySelector('[data-w="date"] > *');
    if (!anchor) return;
    this.when = new Date();
    this.when.setDate(1);
    this.el = h('div', { class: 'cal-pop panel' });
    document.body.append(this.el);
    this.draw(true);
    const r = anchor.getBoundingClientRect(), b = this.el.getBoundingClientRect();
    const clock = document.querySelector('#page .clock, #page .dial')?.getBoundingClientRect() || r;
    const date = document.querySelector('#page .date, #page .cal-page, #page .mini-month')?.getBoundingClientRect() || r;
    const spot = UI.freeSpot(b.width, b.height, [
      { left: Math.max(clock.right, date.right) + 14, top: clock.top, origin: '0% 30%' },
      { left: Math.min(clock.left, date.left) - b.width - 14, top: clock.top, origin: '100% 30%' },
      { left: r.left + r.width / 2 - b.width / 2, top: r.bottom + 8, origin: '50% 0%' },
      { left: r.left + r.width / 2 - b.width / 2, top: r.top - b.height - 8, origin: '50% 100%' },
    ]);
    this.el.style.left = spot.left + 'px';
    this.el.style.top = spot.top + 'px';
    this.el.style.transformOrigin = spot.origin;
    Motion.popIn(this.el);
    this.away = e => { if (!this.el?.contains(e.target) && !anchor.contains(e.target)) this.close(); };
    addEventListener('pointerdown', this.away, true);
  },
  close() {
    removeEventListener('pointerdown', this.away, true);
    const el = this.el;
    this.el = null;
    if (el) Motion.fadeOut(el);
  },
  step(n) { this.when.setMonth(this.when.getMonth() + n); this.draw(false, n); },
  draw(first, dir = 0) {
    const w = this.when, loc = locale(), start = firstDayOfWeek(), today = new Date();
    const weekday = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
    const names = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2023, 0, 1 + (start + i) % 7)));
    const lead = (new Date(w.getFullYear(), w.getMonth(), 1).getDay() - start + 7) % 7;
    const total = new Date(w.getFullYear(), w.getMonth() + 1, 0).getDate();
    const showWeeks = S.date.weeknum;
    const cells = [];
    for (let i = 0; i < (Math.ceil((lead + total) / 7)) * 7; i++) {
      const d = new Date(w.getFullYear(), w.getMonth(), 1 - lead + i);
      if (showWeeks && i % 7 === 0) cells.push(h('div', { class: 'cal-wk', text: isoWeek(d) }));
      const isToday = d.toDateString() === today.toDateString();
      cells.push(h('div', { class: 'cal-d' + (isToday ? ' today' : '') + (d.getMonth() !== w.getMonth() ? ' out' : ''), text: d.getDate() }));
    }
    const grid = h('div', { class: 'cal-grid' + (showWeeks ? ' weeks' : '') }, showWeeks ? h('div', { class: 'cal-wk' }) : null, names.map(n => h('div', { class: 'cal-h', text: n })), cells);
    this.el.replaceChildren(h('div', { class: 'cal-head' },
      h('button', { class: 'ghost square', title: t('Previous'), onclick: () => this.step(-1) }, icon('E76B')),
      h('b', { text: new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(w) }),
      h('button', { class: 'ghost square', title: t('Next'), onclick: () => this.step(1) }, icon('E76C'))), grid);
    if (!first) Motion.enter(grid, dir * 14, 0);
  },
};

/* ---------- command palette ---------- */
function calculate(src) {
  const text = src.replace(/,/g, '.').replace(/\s+/g, '');
  if (!/^[\d.+\-*/%^()]+$/.test(text) || !/[+\-*/%^]/.test(text)) return null;
  let i = 0;
  const atom = () => {
    if (text[i] === '-') { i++; return -atom(); }
    if (text[i] === '(') { i++; const v = sum(); if (text[i++] !== ')') throw 0; return v; }
    const m = text.slice(i).match(/^\d*\.?\d+/);
    if (!m) throw 0;
    i += m[0].length;
    return +m[0];
  };
  const pow = () => { const b = atom(); if (text[i] === '^') { i++; return b ** pow(); } return b; };
  const product = () => { let v = pow(); while ('*/%'.includes(text[i]) && text[i]) { const o = text[i++], r = pow(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } return v; };
  const sum = () => { let v = product(); while (text[i] === '+' || text[i] === '-') { const o = text[i++], r = product(); v = o === '+' ? v + r : v - r; } return v; };
  try { const v = sum(); return i === text.length && Number.isFinite(v) ? +v.toFixed(10) : null; } catch { return null; }
}
const UNITS = {
  km: 1000, m: 1, cm: .01, mm: .001, mi: 1609.344, ft: .3048, in: .0254, yd: .9144,
  kg: 1000, g: 1, mg: .001, lb: 453.59237, oz: 28.349523,
  l: 1, ml: .001, gal: 3.785412, cup: .2365882,
};
const UNIT_KIND = { km: 'len', m: 'len', cm: 'len', mm: 'len', mi: 'len', ft: 'len', in: 'len', yd: 'len', kg: 'mass', g: 'mass', mg: 'mass', lb: 'mass', oz: 'mass', l: 'vol', ml: 'vol', gal: 'vol', cup: 'vol' };
function convert(src) {
  const m = src.trim().toLowerCase().match(/^(-?[\d.,]+)\s*([a-z°]+)\s+(?:in|to)\s+([a-z°]+)$/);
  if (!m) return null;
  const v = +m[1].replace(',', '.'), a = m[2].replace('°', ''), b = m[3].replace('°', '');
  if (a === 'c' && b === 'f') return `${+(v * 9 / 5 + 32).toFixed(2)} °F`;
  if (a === 'f' && b === 'c') return `${+((v - 32) * 5 / 9).toFixed(2)} °C`;
  if (!UNITS[a] || !UNITS[b] || UNIT_KIND[a] !== UNIT_KIND[b]) return null;
  return `${+(v * UNITS[a] / UNITS[b]).toFixed(4)} ${b}`;
}
const fuzzy = (q, s) => {
  s = s.toLowerCase();
  const at = s.indexOf(q);
  if (at >= 0) return 100 - at;
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
};
const Palette = {
  el: null,
  actions() {
    const go = fn => () => { this.toggle(); fn(); };
    const page = id => go(() => Lazy.load().then(() => Settings.openAt(id)));
    return [
      { label: t('Settings'), icon: 'E713', run: go(() => Lazy.toggle()) },
      { label: t('Arrange page'), icon: 'E80A', run: go(() => Arrange.toggle()) },
      { label: t('Switch dark and light mode'), icon: 'E793', run: go(toggleTheme) },
      { label: t('Hide everything'), icon: 'E890', run: go(() => toggleZen(true)) },
      { label: t('Add link'), icon: 'E710', run: page('links') },
      { label: t('Next background'), icon: 'E72A', run: go(() => Bg.render(true)) },
      { label: t('New quote'), icon: 'E72C', run: go(() => { if (S.quotes.on) Quote.build(true, true); }) },
      { label: t('Start or pause Pomodoro'), icon: 'E916', run: go(() => { if (!S.pomodoro.on) { S.pomodoro.on = true; save(); Page.renderAll(false); } Pomo.startStop(); }) },
      { label: t('Background settings'), icon: 'EB9F', run: page('background') },
      { label: t('Clock and calendar settings'), icon: 'E917', run: page('clock') },
      { label: t('Backup and sync'), icon: 'E895', run: page('backup') },
    ];
  },
  toggle() {
    if (this.el) { const el = this.el; this.el = null; Motion.fadeOut(el); return; }
    this.input = h('input', { type: 'text', placeholder: t('Search links, tabs, actions, or do some math…'), spellcheck: false, oninput: () => this.search(), onkeydown: e => this.keys(e) });
    this.list = h('div', { class: 'pal-list' });
    this.el = h('div', { class: 'palette panel' }, h('div', { class: 'pal-input' }, icon('E721'), this.input), this.list);
    document.body.append(this.el);
    Motion.popIn(this.el);
    this.input.focus();
    this.search();
    this.away = e => { if (this.el && !this.el.contains(e.target)) { removeEventListener('pointerdown', this.away, true); this.toggle(); } };
    addEventListener('pointerdown', this.away, true);
  },
  allLinks() {
    return S.links.items.flatMap(l => l.items || [l]).concat(Links.groupItems()).filter((l, i, a) => l.url && a.findIndex(x => x.url === l.url) === i)
      .map(l => ({ label: l.title, hint: l.url.replace(/^https?:\/\/(www\.)?/, ''), icon: 'E71B', run: () => { location.href = l.url; } }));
  },
  async search() {
    const raw = this.input.value.trim(), q = raw.toLowerCase(), ask = ++this.ask;
    const out = [];
    const math = calculate(raw) ?? convert(raw);
    if (math != null) out.push({ label: `= ${math}`, hint: t('Copy'), icon: 'E8EF', run: () => { navigator.clipboard.writeText(String(math).replace(/ .*$/, '')); UI.toast(t('Copied')); this.toggle(); } });
    const rank = list => (q ? list.map(x => ({ x, s: fuzzy(q, `${x.label} ${x.hint || ''}`) })).filter(r => r.s).sort((a, b) => b.s - a.s).map(r => r.x) : list);
    out.push(...rank(this.allLinks()).slice(0, q ? 6 : 0), ...rank(this.actions()).slice(0, q ? 5 : 8));
    if (q) out.push({ label: `${t('Search for')} "${raw}"`, icon: 'E721', run: () => Search.go(raw) });
    this.render(out);
    if (!q || !globalThis.chrome?.permissions) {
      if (!q && globalThis.chrome?.permissions && !(await chrome.permissions.contains({ permissions: ['tabs', 'history', 'bookmarks'] }))) {
        if (ask === this.ask) this.render([...out, { label: t('Also search open tabs, bookmarks and history'), icon: 'E8A4', run: () => chrome.permissions.request({ permissions: ['tabs', 'history', 'bookmarks'] }).then(() => this.search()) }]);
      }
      return;
    }
    if (!(await chrome.permissions.contains({ permissions: ['tabs', 'history', 'bookmarks'] }))) return;
    const [tabs, marks, hist] = await Promise.all([chrome.tabs.query({}), chrome.bookmarks.search(raw), chrome.history.search({ text: raw, maxResults: 5 })]);
    if (ask !== this.ask) return;
    const more = [
      ...rank(tabs.map(x => ({ label: x.title || x.url, hint: t('Open tab'), icon: 'E737', run: () => { chrome.tabs.update(x.id, { active: true }); chrome.windows.update(x.windowId, { focused: true }); } }))).slice(0, 5),
      ...marks.filter(x => x.url).slice(0, 5).map(x => ({ label: x.title || x.url, hint: t('Bookmark'), icon: 'E8A4', run: () => { location.href = x.url; } })),
      ...hist.map(x => ({ label: x.title || x.url, hint: t('History'), icon: 'E81C', run: () => { location.href = x.url; } })),
    ];
    const last = out.pop();
    this.render([...out, ...more, last]);
  },
  ask: 0,
  render(items) {
    this.items = items;
    this.sel = 0;
    this.list.replaceChildren(...items.map((x, i) => h('button', { class: 'pal-item no-press' + (i ? '' : ' sel'), onpointerdown: e => { e.preventDefault(); x.run(); } },
      icon(x.icon), h('span', { text: x.label }), x.hint ? h('small', { text: x.hint }) : null)));
  },
  keys(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
      [...this.list.children].forEach((b, i) => { b.classList.toggle('sel', i === this.sel); if (i === this.sel) b.scrollIntoView({ block: 'nearest' }); });
    }
    if (e.key === 'Enter') { e.preventDefault(); this.items[this.sel]?.run(); }
  },
};

/* ---------- arrange: drag widgets between zones, right on the page ---------- */
const PRESET_NAMES = { centered: 'Centered', dashboard: 'Dashboard', dock: 'Dock', minimal: 'Minimal' };
const Arrange = {
  on: false,
  toggle() { this.on ? this.stop() : this.start(); },
  start() {
    this.on = true;
    if (globalThis.Settings?.el) Settings.close();
    Weather.closeCard();
    document.body.setAttribute('data-arrange', '');
    const names = { clock: 'Clock', date: 'Calendar', greeting: 'Greeting', weather: 'Weather', search: 'Search bar', links: 'Quick Links', quote: 'Quotes', notes: 'Notes', pomodoro: 'Pomodoro', tasks: 'Tasks', ambient: 'Sounds', countdown: 'Countdown', progress: 'Progress' };
    for (const [id, name] of Object.entries(names)) (WIDGETS[id] || ExtraW[id])?.el.setAttribute('data-label', t(name));
    this.bar = h('div', { class: 'arrange-bar panel' },
      h('b', { text: t('Drag anything to move it') }),
      UI.seg(Object.entries(PRESET_NAMES).map(([value, label]) => ({ value, label: t(label) })), S.layout.preset, v => this.preset(v)),
      h('button', { class: 'accent-btn small', text: t('Done'), onclick: () => this.stop() }));
    document.body.append(this.bar);
    Motion.enter(this.bar, 0, -18);
    this.down = e => this.drag(e);
    $('page').addEventListener('pointerdown', this.down, true);
  },
  stop() {
    this.on = false;
    document.body.removeAttribute('data-arrange');
    $('page').removeEventListener('pointerdown', this.down, true);
    const bar = this.bar;
    this.bar = null;
    Motion.fadeOut(bar);
  },
  // every widget springs from where it was to where it now lives
  flip(change) {
    const before = new Map([...document.querySelectorAll('#page .w')].map(el => [el, el.getBoundingClientRect()]));
    change();
    if (Motion.reduced) return;
    for (const [el, a] of before) {
      if (!el.isConnected) continue;
      const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 650, easing: Motion.Ease.bouncy });
    }
  },
  preset(v) {
    this.flip(() => { S.layout.preset = v; S.layout.zones = structuredClone(PRESETS[v]); save(); Page.place(false); });
  },
  drag(e) {
    const w = e.target.closest('.zone > .w');
    if (e.button !== 0 || !w) return;
    e.preventDefault();
    e.stopPropagation();
    const id = w.dataset.w, r = w.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    let ghost = null, zone = null, at = 0;
    let pointerY = sy, scrolling = 0;
    const scroller = document.scrollingElement;
    const autoScroll = () => {
      const edge = 70, by = pointerY > innerHeight - edge ? 14 : pointerY < edge ? -14 : 0;
      if (by) scroller.scrollTop = Math.max(0, Math.min($('page').offsetHeight - innerHeight, scroller.scrollTop + by));
      scrolling = requestAnimationFrame(autoScroll);
    };
    const mark = el => { if (zone !== el) { zone?.classList.remove('over'); zone = el; zone?.classList.add('over'); } };
    const move = ev => {
      pointerY = ev.clientY;
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        scrolling = requestAnimationFrame(autoScroll);
        ghost = w.cloneNode(true);
        ghost.classList.add('arrange-ghost');
        ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px`;
        document.body.append(ghost);
        w.style.opacity = '.25';
        Motion.pop(ghost, .94);
      }
      ghost.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
      mark(document.elementsFromPoint(ev.clientX, ev.clientY).map(x => x.closest?.('.zone')).find(Boolean) || null);
      if (zone) {
        const kids = [...zone.children].filter(k => k !== w);
        at = kids.findIndex(k => { const b = k.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (at < 0) at = kids.length;
      }
    };
    const up = () => {
      cancelAnimationFrame(scrolling);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      w.style.opacity = '';
      const to = zone?.dataset.z;
      zone?.classList.remove('over');
      if (!to) return;
      this.flip(() => {
        const z = S.layout.zones;
        for (const k of ZONES) z[k] = (z[k] || []).filter(x => x !== id);
        // zones also remember widgets that are switched off, so count only the visible ones for the position
        const visible = z[to].filter(widgetOn);
        const before = visible[at];
        z[to].splice(before ? z[to].indexOf(before) : z[to].length, 0, id);
        S.layout.preset = 'custom';
        save();
        Page.place(false);
      });
      this.bar?.querySelector('.seg')?.replaceWith(UI.seg(Object.entries(PRESET_NAMES).map(([value, label]) => ({ value, label: t(label) })), 'custom', v => this.preset(v)));
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  },
};

// widgets.js checks for these before they have ever loaded
Object.assign(globalThis, { Palette, Arrange, Calendar });
