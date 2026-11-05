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
// [month, day, name] | ['e', days from Easter, name] | ['n', month, weekday, nth (-1 = last), name] | ['l', lunar month, lunar day, name] | ['f', year => [month, day], name]
const HOLIDAYS = {
  DK: [[1, 1, 'Nytårsdag'], [2, 14, 'Valentinsdag'], ['e', -49, 'Fastelavn'], ['e', -7, 'Palmesøndag'], ['e', -3, 'Skærtorsdag'], ['e', -2, 'Langfredag'], ['e', 0, 'Påskedag'], ['e', 1, '2. påskedag'], ['n', 5, 0, 2, 'Mors dag'], ['e', 39, 'Kristi himmelfartsdag'], ['e', 49, 'Pinsedag'], ['e', 50, '2. pinsedag'], [6, 5, 'Grundlovsdag og fars dag'], [6, 23, 'Sankthansaften'], [10, 31, 'Halloween'], [11, 10, 'Mortensaften'], [12, 24, 'Juleaften'], [12, 25, '1. juledag'], [12, 26, '2. juledag'], [12, 31, 'Nytårsaften']],
  DE: [[1, 1, 'Neujahr'], [2, 14, 'Valentinstag'], ['e', -2, 'Karfreitag'], ['e', 0, 'Ostersonntag'], ['e', 1, 'Ostermontag'], [5, 1, 'Tag der Arbeit'], ['n', 5, 0, 2, 'Muttertag'], ['e', 39, 'Christi Himmelfahrt'], ['e', 49, 'Pfingstsonntag'], ['e', 50, 'Pfingstmontag'], [10, 3, 'Tag der Deutschen Einheit'], [10, 31, 'Halloween'], [12, 24, 'Heiligabend'], [12, 25, '1. Weihnachtstag'], [12, 26, '2. Weihnachtstag'], [12, 31, 'Silvester']],
  ES: [[1, 1, 'Año Nuevo'], [1, 6, 'Reyes'], [2, 14, 'San Valentín'], ['e', -2, 'Viernes Santo'], ['e', 0, 'Domingo de Resurrección'], [5, 1, 'Día del Trabajador'], ['n', 5, 0, 1, 'Día de la Madre'], [8, 15, 'Asunción'], [10, 12, 'Fiesta Nacional'], [11, 1, 'Todos los Santos'], [12, 6, 'Día de la Constitución'], [12, 8, 'Inmaculada Concepción'], [12, 24, 'Nochebuena'], [12, 25, 'Navidad'], [12, 31, 'Nochevieja']],
  MX: [[1, 1, 'Año Nuevo'], ['n', 2, 1, 1, 'Día de la Constitución'], [2, 14, 'San Valentín'], ['n', 3, 1, 3, 'Natalicio de Benito Juárez'], ['e', -2, 'Viernes Santo'], ['e', 0, 'Domingo de Pascua'], [5, 1, 'Día del Trabajo'], [5, 10, 'Día de las Madres'], [9, 16, 'Día de la Independencia'], [11, 2, 'Día de Muertos'], ['n', 11, 1, 3, 'Día de la Revolución'], [12, 24, 'Nochebuena'], [12, 25, 'Navidad'], [12, 31, 'Fin de Año']],
  FR: [[1, 1, 'Jour de l’An'], [2, 14, 'Saint-Valentin'], ['e', 0, 'Pâques'], ['e', 1, 'Lundi de Pâques'], [5, 1, 'Fête du Travail'], [5, 8, 'Victoire 1945'], ['e', 39, 'Ascension'], ['e', 49, 'Pentecôte'], ['e', 50, 'Lundi de Pentecôte'], [7, 14, 'Fête nationale'], [8, 15, 'Assomption'], [10, 31, 'Halloween'], [11, 1, 'Toussaint'], [11, 11, 'Armistice 1918'], [12, 24, 'Réveillon de Noël'], [12, 25, 'Noël'], [12, 31, 'Saint-Sylvestre']],
  BR: [[1, 1, 'Ano Novo'], ['e', -47, 'Carnaval'], ['e', -2, 'Sexta-feira Santa'], ['e', 0, 'Páscoa'], [4, 21, 'Tiradentes'], [5, 1, 'Dia do Trabalho'], ['n', 5, 0, 2, 'Dia das Mães'], [6, 12, 'Dia dos Namorados'], ['e', 60, 'Corpus Christi'], ['n', 8, 0, 2, 'Dia dos Pais'], [9, 7, 'Independência'], [10, 12, 'Nossa Senhora Aparecida'], [11, 2, 'Finados'], [11, 15, 'Proclamação da República'], [11, 20, 'Consciência Negra'], [12, 24, 'Véspera de Natal'], [12, 25, 'Natal'], [12, 31, 'Réveillon']],
  JP: [[1, 1, '元日'], ['n', 1, 1, 2, '成人の日'], [2, 11, '建国記念の日'], [2, 14, 'バレンタインデー'], [2, 23, '天皇誕生日'], ['f', y => [3, Math.floor(20.8431 + .242194 * (y - 1980)) - Math.floor((y - 1980) / 4)], '春分の日'], [4, 29, '昭和の日'], [5, 3, '憲法記念日'], [5, 4, 'みどりの日'], [5, 5, 'こどもの日'], ['n', 7, 1, 3, '海の日'], [8, 11, '山の日'], ['n', 9, 1, 3, '敬老の日'], ['f', y => [9, Math.floor(23.2488 + .242194 * (y - 1980)) - Math.floor((y - 1980) / 4)], '秋分の日'], ['n', 10, 1, 2, 'スポーツの日'], [11, 3, '文化の日'], [11, 23, '勤労感謝の日'], [12, 25, 'クリスマス'], [12, 31, '大晦日']],
  KR: [[1, 1, '신정'], ['l', '1', 1, '설날'], [3, 1, '삼일절'], [5, 5, '어린이날'], ['l', '4', 8, '부처님오신날'], [6, 6, '현충일'], [8, 15, '광복절'], ['l', '8', 15, '추석'], [10, 3, '개천절'], [10, 9, '한글날'], [12, 25, '크리스마스']],
  CN: [[1, 1, '元旦'], ['l', '1', 1, '春节'], ['l', '1', 15, '元宵节'], ['f', y => [4, Math.floor((y % 100) * .2422 + 4.81) - Math.floor((y % 100 - 1) / 4)], '清明节'], [5, 1, '劳动节'], ['l', '5', 5, '端午节'], ['l', '7', 7, '七夕节'], ['l', '8', 15, '中秋节'], [10, 1, '国庆节']],
  US: [[1, 1, 'New Year’s Day'], ['n', 1, 1, 3, 'Martin Luther King Jr. Day'], [2, 14, 'Valentine’s Day'], ['n', 2, 1, 3, 'Presidents’ Day'], [3, 17, 'St. Patrick’s Day'], ['e', 0, 'Easter'], ['n', 5, 0, 2, 'Mother’s Day'], ['n', 5, 1, -1, 'Memorial Day'], ['n', 6, 0, 3, 'Father’s Day'], [6, 19, 'Juneteenth'], [7, 4, 'Independence Day'], ['n', 9, 1, 1, 'Labor Day'], [10, 31, 'Halloween'], [11, 11, 'Veterans Day'], ['n', 11, 4, 4, 'Thanksgiving'], [12, 24, 'Christmas Eve'], [12, 25, 'Christmas Day'], [12, 31, 'New Year’s Eve']],
  GB: [[1, 1, 'New Year’s Day'], [2, 14, 'Valentine’s Day'], ['e', -21, 'Mother’s Day'], ['e', -2, 'Good Friday'], ['e', 0, 'Easter Sunday'], ['e', 1, 'Easter Monday'], ['n', 5, 1, 1, 'Early May bank holiday'], ['n', 5, 1, -1, 'Spring bank holiday'], ['n', 6, 0, 3, 'Father’s Day'], ['n', 8, 1, -1, 'Summer bank holiday'], [10, 31, 'Halloween'], [11, 5, 'Bonfire Night'], [12, 24, 'Christmas Eve'], [12, 25, 'Christmas Day'], [12, 26, 'Boxing Day'], [12, 31, 'New Year’s Eve']],
};
const Holidays = {
  years: new Map(),
  country() {
    const pick = S.date.holidays || 'auto';
    if (pick === 'off') return null;
    if (HOLIDAYS[pick]) return pick;
    let region = '';
    try { region = new Intl.Locale(navigator.language).region || ''; } catch {}
    const near = { AT: 'DE', CH: 'DE', IE: 'GB', AU: 'GB', NZ: 'GB', CA: 'US', PT: 'BR', AR: 'MX', CL: 'MX', CO: 'MX', PE: 'MX', VE: 'MX', BE: 'FR' };
    return HOLIDAYS[region] ? region : near[region] || { da: 'DK', de: 'DE', es: 'ES', fr: 'FR', ja: 'JP', ko: 'KR', 'pt-BR': 'BR', 'zh-CN': 'CN', en: 'US' }[LANG] || null;
  },
  easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1);
  },
  nth(y, month, weekday, n) {
    if (n > 0) { const first = new Date(y, month - 1, 1).getDay(); return new Date(y, month - 1, 1 + (weekday - first + 7) % 7 + (n - 1) * 7); }
    const last = new Date(y, month, 0);
    return new Date(y, month - 1, last.getDate() - (last.getDay() - weekday + 7) % 7);
  },
  lunar(y, country) {
    const fmt = new Intl.DateTimeFormat('en-u-ca-' + (country === 'KR' ? 'dangi' : 'chinese'), { month: 'numeric', day: 'numeric' }), out = new Map();
    for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
      const p = fmt.formatToParts(d);
      const month = p.find(x => x.type === 'month').value, at = new Date(d);
      if (country === 'CN' && month === '1') at.setDate(at.getDate() + ({ 2027: -1, 2030: 1 }[y] || 0));
      out.set(month + '/' + p.find(x => x.type === 'day').value, at);
    }
    return out;
  },
  year(y) {
    const country = this.country();
    if (!country) return new Map();
    const id = country + y;
    if (this.years.has(id)) return this.years.get(id);
    const out = new Map(), easter = HOLIDAYS[country].some(r => r[0] === 'e') ? this.easter(y) : null;
    const lunar = HOLIDAYS[country].some(r => r[0] === 'l') ? this.lunar(y, country) : null;
    const add = (d, name) => { if (!d) return; const k = d.toDateString(); out.set(k, out.has(k) ? out.get(k) + ' · ' + name : name); };
    for (const r of HOLIDAYS[country]) {
      if (r[0] === 'e') { const d = new Date(easter); d.setDate(d.getDate() + r[1]); add(d, r[2]); }
      else if (r[0] === 'n') add(this.nth(y, r[1], r[2], r[3]), r[4]);
      else if (r[0] === 'l') add(lunar.get(r[1] + '/' + r[2]), r[3]);
      else if (r[0] === 'f') { const [m, day] = r[1](y); add(new Date(y, m - 1, day), r[2]); }
      else add(new Date(y, r[0] - 1, r[1]), r[2]);
    }
    this.years.set(id, out);
    return out;
  },
  on(d) { return this.year(d.getFullYear()).get(d.toDateString()) || ''; },
};
const Calendar = {
  el: null,
  toggle(anchor) {
    if (this.el) return this.close();
    if (!anchor?.isConnected || !anchor.offsetWidth) anchor = document.querySelector('[data-w="date"] .week') || document.querySelector('[data-w="date"] > *');
    if (!anchor) return;
    this.when = new Date();
    this.when.setDate(1);
    this.el = h('div', { class: 'cal-pop panel' });
    document.body.append(this.el);
    this.draw(true);
    const r = anchor.getBoundingClientRect(), b = this.el.getBoundingClientRect();
    // always underneath what you clicked. On a short screen the list scrolls rather than the card jumping above.
    this.el.style.left = Math.max(8, Math.min(innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2)) + 'px';
    this.under = r.bottom + 8;
    this.over = r.top;
    this.fit();
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
  // underneath what you clicked, whole and without scrolling. A calendar low on the page opens above itself if there is room there, or the card just moves up to fit.
  fit() {
    const height = this.el.offsetHeight, fitsBelow = this.under + height <= innerHeight - 8, fitsAbove = this.over - 8 - height >= 8;
    const above = !fitsBelow && fitsAbove && innerHeight - this.under < 300;
    this.el.style.top = (above ? this.over - 8 - height : Math.max(8, Math.min(this.under, innerHeight - height - 8))) + 'px';
    this.el.style.transformOrigin = above ? '50% 100%' : '50% 0%';
  },
  step(n) { this.when.setMonth(this.when.getMonth() + n); this.draw(false, n); },
  draw(first, dir = 0) {
    const w = this.when, loc = locale(), start = firstDayOfWeek(), today = new Date();
    const weekday = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
    const names = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2023, 0, 1 + (start + i) % 7)));
    const lead = (new Date(w.getFullYear(), w.getMonth(), 1).getDay() - start + 7) % 7;
    const total = new Date(w.getFullYear(), w.getMonth() + 1, 0).getDate();
    const showWeeks = S.date.weeknum;
    const cells = [], special = [];
    for (let i = 0; i < (Math.ceil((lead + total) / 7)) * 7; i++) {
      const d = new Date(w.getFullYear(), w.getMonth(), 1 - lead + i);
      if (showWeeks && i % 7 === 0) cells.push(h('div', { class: 'cal-wk', text: isoWeek(d) }));
      const isToday = d.toDateString() === today.toDateString();
      const holiday = Holidays.on(d);
      if (holiday && d.getMonth() === w.getMonth()) special.push([d.getDate(), holiday]);
      cells.push(h('div', { class: 'cal-d' + (isToday ? ' today' : '') + (d.getMonth() !== w.getMonth() ? ' out' : '') + (holiday ? ' hol' : ''), text: d.getDate(), title: holiday || null }));
    }
    const grid = h('div', { class: 'cal-grid' + (showWeeks ? ' weeks' : '') }, showWeeks ? h('div', { class: 'cal-wk' }) : null, names.map(n => h('div', { class: 'cal-h', text: n })), cells);
    this.el.replaceChildren(h('div', { class: 'cal-head' },
      h('button', { class: 'ghost square', title: t('Previous'), onclick: () => this.step(-1) }, icon('E76B')),
      h('b', { text: new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(w) }),
      h('button', { class: 'ghost square', title: t('Next'), onclick: () => this.step(1) }, icon('E76C'))),
      h('div', { class: 'cal-body' + (Holidays.country() ? ' with-days' : '') }, grid, Holidays.country() ? h('div', { class: 'cal-hol' }, special.map(([day, name]) => h('div', {}, h('b', { text: day }), h('span', { text: name })))) : null));
    if (!first) {
      Motion.enter(grid, dir * 14, 0);
      this.fit();
    }
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
const ARRANGE_NAMES = { clock: 'Clock', date: 'Calendar', greeting: 'Greeting', weather: 'Weather', search: 'Search bar', links: 'Quick Links', quote: 'Quotes', notes: 'Notes', pomodoro: 'Pomodoro', tasks: 'Tasks', ambient: 'Sounds', countdown: 'Countdown', progress: 'Progress' };
const Arrange = {
  on: false,
  toggle() { this.on ? this.stop() : this.start(); },
  start() {
    this.on = true;
    if (globalThis.Settings?.el) Settings.close();
    Weather.closeCard();
    document.body.setAttribute('data-arrange', '');
    this.label();
    this.bar = h('div', { class: 'arrange-bar panel' },
      h('b', { text: t('Drag anything to move it') }),
      this.seg(),
      h('button', { class: 'accent-btn small', text: t('Done'), onclick: () => this.stop() }));
    document.body.append(this.bar);
    Motion.enter(this.bar, 0, -18);
    this.down = e => this.drag(e);
    $('page').addEventListener('pointerdown', this.down, true);
    this.decorate();
    // widgets rebuild themselves now and then, so their remove buttons are put back the moment that happens
    this.watch = new MutationObserver(() => this.decorate());
    this.watch.observe($('page'), { childList: true, subtree: true });
  },
  label() {
    for (const [id, name] of Object.entries(ARRANGE_NAMES)) (WIDGETS[id] || ExtraW[id])?.el.setAttribute('data-label', t(name));
  },
  // what is switched off right now, and so can be added to an empty spot
  unused: () => Object.keys(ARRANGE_NAMES).filter(id => !S[id === 'quote' ? 'quotes' : id]?.on),
  decorate() {
    const unused = this.unused().length;
    for (const w of document.querySelectorAll('#page .zone > .w')) {
      if (w.querySelector(':scope > .arr-x')) continue;
      const x = h('button', { class: 'arr-x no-press', title: t('Remove'), 'aria-label': t('Remove'), onclick: () => this.remove(w.dataset.w) }, h('i'));
      w.append(x);
      if (!Motion.reduced) Motion.pop(x, .4);
    }
    for (const z of document.querySelectorAll('#page .zone')) {
      const empty = !z.querySelector(':scope > .w'), plus = z.querySelector(':scope > .arr-add');
      if (!empty || !unused) { plus?.remove(); continue; }
      if (plus) continue;
      const add = h('button', { class: 'arr-add no-press', title: t('Add here'), 'aria-label': t('Add here'), onclick: () => this.pick(add, z.dataset.z) }, h('i'));
      z.append(add);
      if (!Motion.reduced) Motion.popIn(add);
    }
  },
  pick(btn, zone) {
    const r = btn.getBoundingClientRect();
    Motion.pop(btn, .8);
    UI.menu(r.left, r.bottom + 6, this.unused().map(id => ({ label: t(ARRANGE_NAMES[id]), run: () => this.add(id, zone) })));
  },
  async add(id, zone) {
    const key = id === 'quote' ? 'quotes' : id;
    this.flip(() => {
      S[key].on = true;
      const z = S.layout.zones;
      for (const k of ZONES) z[k] = (z[k] || []).filter(x => x !== id);
      (z[zone] ||= []).push(id);
      this.custom();
      save();
      Page.renderAll(false);
      this.label();
      this.decorate();
    });
    if (id === 'weather') Weather.refresh();
    const el = (WIDGETS[id] || ExtraW[id])?.el;
    if (el && !Motion.reduced) Motion.popIn(el);
  },
  remove(id) {
    const el = (WIDGETS[id] || ExtraW[id])?.el;
    if (el && !Motion.reduced) {
      // a copy shrinks away where the widget was, while the others spring into the gap
      const r = el.getBoundingClientRect(), copy = el.cloneNode(true);
      copy.querySelector(':scope > .arr-x')?.remove();
      copy.classList.add('arrange-ghost');
      copy.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px`;
      document.body.append(copy);
      copy.animate([{ scale: 1, opacity: 1 }, { scale: .86, opacity: 0 }], { duration: 220, easing: Motion.Ease.quick, fill: 'forwards' }).onfinish = () => copy.remove();
    }
    this.flip(() => {
      S[id === 'quote' ? 'quotes' : id].on = false;
      this.custom();
      save();
      Page.renderAll(false);
      this.label();
      this.decorate();
    });
  },
  seg() {
    const names = { ...PRESET_NAMES, ...(S.layout.custom ? { custom: 'My layout' } : {}) };
    return UI.seg(Object.entries(names).map(([value, label]) => ({ value, label: t(label) })), S.layout.preset, v => this.preset(v));
  },
  custom() {
    rememberLayout();
    this.bar?.querySelector('.seg')?.replaceWith(this.seg());
  },
  stop() {
    this.on = false;
    this.watch.disconnect();
    document.querySelectorAll('.arr-x, .arr-add').forEach(x => x.remove());
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
    this.flip(() => { S.layout.preset = v; S.layout.zones = layoutZones(v); save(); Page.place(false); this.decorate(); });
  },
  drag(e) {
    const w = e.target.closest('.zone > .w');
    if (e.button !== 0 || !w || e.target.closest('.arr-x')) return;
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
        ghost.querySelector(':scope > .arr-x')?.remove();
        ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px`;
        document.body.append(ghost);
        w.style.opacity = '.25';
        Motion.pop(ghost, .94);
      }
      ghost.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
      mark(document.elementsFromPoint(ev.clientX, ev.clientY).map(x => x.closest?.('.zone')).find(Boolean) || null);
      if (zone) {
        const kids = [...zone.children].filter(k => k !== w && k.classList.contains('w'));
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
        this.custom();
        save();
        Page.place(false);
        this.decorate();
      });
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  },
};

// widgets.js checks for these before they have ever loaded
Object.assign(globalThis, { Palette, Arrange, Calendar });
