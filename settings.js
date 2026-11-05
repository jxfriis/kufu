'use strict';
// Loaded the first time settings open, so a normal new tab never pays for it.

const askPermission = async spec => {
  if (!globalThis.chrome?.permissions) return false;
  return chrome.permissions.request(spec).catch(() => false);
};

const Settings = {
  el: null,
  page: 'home',
  q: '',
  rows: [],
  toggle() { this.el ? this.close() : this.open(); },
  open() {
    this.el = h('aside', { class: 'settings panel' });
    this.fill();
    document.body.append(this.el);
    this.preview(true);
    this.placePill(false);
    Motion.enter(this.el, 44, 0);
    Motion.pop($('gear'), .8);
    this.stagger();
  },
  openAt(id) { this.page = id; this.q = ''; if (this.el) this.go(id); else this.open(); },
  // The page stays exactly where it is: settings float over it, and widgets become shortcuts to their own settings.
  preview(on) {
    const root = document.documentElement;
    this.spot();
    if (on) {
      root.setAttribute('data-preview', '');
      this.pick = e => {
        const w = e.target.closest('#page .w');
        if (!w) return;
        e.preventDefault();
        e.stopPropagation();
        const id = PAGE_OF_WIDGET[w.dataset.w];
        if (id) this.go(id);
      };
      addEventListener('click', this.pick, true);
    } else {
      root.removeAttribute('data-preview');
      removeEventListener('click', this.pick, true);
    }
  },
  // light up what a menu item controls
  spot(id) {
    for (const el of document.querySelectorAll('#page .w.spot')) el.classList.remove('spot');
    for (const w of WIDGETS_OF_PAGE[id] || []) {
      const el = document.querySelector(`#page .w[data-w="${w}"]`);
      if (el) el.classList.add('spot');
    }
  },
  close() {
    pagesMemo = null;
    this.preview(false);
    const el = this.el;
    this.el = null;
    if (el) Motion.fadeOut(el);
  },
  rebuild() {
    if (!this.el) return;
    const top = this.body.scrollTop;
    this.renderPage();
    this.body.scrollTop = top;
  },
  fill() {
    const pages = PAGES();
    this.pill = h('div', { class: 'nav-pill' });
    this.navBtns = new Map(pages.map(p => [p.id, h('button', { class: 'nav-item no-press', onclick: () => this.go(p.id), onpointerenter: () => this.spot(p.id), onpointerleave: () => this.spot() }, icon(p.icon), h('span', { text: t(p.title) }))]));
    this.navToggles = new Map();
    const navRow = id => {
      const key = NAV_TOGGLES[id], btn = this.navBtns.get(id);
      if (!key) return btn;
      const sw = UI.toggle(!!getPath(key), on => {
        setPath(key, on);
        btn.classList.toggle('off', !on);
        save();
        Page.renderAll(false);
        if (key === 'weather.on' && on) Weather.refresh();
        this.rebuild();
      });
      sw.title = t('Show or hide');
      sw.classList.add('nav-switch');
      btn.classList.toggle('off', !getPath(key));
      this.navToggles.set(key, { sw, btn });
      return h('div', { class: 'nav-row' }, btn, sw);
    };
    const navKids = NAV.flatMap(([group, ids]) => [group ? h('div', { class: 'nav-group', text: t(group) }) : null, ...ids.map(navRow)]);
    const filter = h('input', { type: 'text', value: this.q, placeholder: t('Search') + '…', 'aria-label': t('Search'), oninput: () => { this.q = filter.value.trim().toLowerCase(); this.renderPage(); this.placePill(true); } });
    this.title = h('h2');
    this.blurb = h('p');
    this.body = h('div', { class: 'set-body' });
    this.el.replaceChildren(
      h('nav', { class: 'set-nav' },
        h('div', { class: 'set-brand' }, h('img', { src: 'icons/icon-48.png', alt: '', width: 26, height: 26 }), h('b', { text: 'Kufu' })),
        h('div', { class: 'text-in inset set-filter' }, icon('E721'), filter),
        h('div', { class: 'nav-list' }, this.pill, navKids)),
      h('div', { class: 'set-main' },
        h('header', { class: 'set-head' }, h('div', { class: 'grow' }, this.title, this.blurb),
          h('button', { class: 'ghost square', title: t('Close') + ' (Esc)', onclick: () => this.close() }, icon('E711'))),
        this.body));
    this.renderPage();
  },
  go(id) {
    this.page = id;
    if (this.q) { this.q = ''; this.el.querySelector('.set-filter input').value = ''; }
    this.renderPage();
    this.body.scrollTop = 0;
    this.placePill(true);
    this.stagger();
  },
  placePill(animate) {
    const b = this.navBtns.get(this.page);
    for (const [id, x] of this.navBtns) x.classList.toggle('on', id === this.page && !this.q);
    this.pill.style.opacity = this.q ? '0' : '1';
    if (!b?.offsetHeight) return;
    if (animate && !Motion.reduced) Motion.to(this.pill, 'translate', '0px ' + b.offsetTop + 'px', 650, Motion.Ease.spring);
    else this.pill.style.translate = '0px ' + b.offsetTop + 'px';
  },
  stagger() {
    [...this.body.children].forEach((c, i) => Motion.enter(c, 0, 12, Math.min(i, 8) * 28));
  },
  renderPage() {
    this.rows = [];
    const pages = PAGES();
    this.body.replaceChildren();
    if (this.q) {
      this.title.textContent = t('Search');
      this.blurb.textContent = '';
      for (const p of pages) {
        const hits = p.rows.filter(r => r.label && r.type !== 'head' && (t(r.label).toLowerCase().includes(this.q) || r.label.toLowerCase().includes(this.q)));
        if (hits.length) this.card(t(p.title), hits, p);
      }
      if (!this.body.children.length) this.body.append(h('div', { class: 'set-none', text: t('Nothing matches that.') }));
      this.refresh();
      return;
    }
    const p = pages.find(x => x.id === this.page) || pages[0];
    this.title.textContent = t(p.title);
    this.blurb.textContent = p.blurb ? t(p.blurb) : '';
    // cards split on each 'head' row; rarely-needed rows wait behind "More options"
    const main = p.rows.filter(r => !r.adv), more = p.rows.filter(r => r.adv);
    let title = '', group = [];
    for (const r of main) {
      if (r.type === 'head') { if (group.length) this.card(title, group, p); title = t(r.label); group = []; } else group.push(r);
    }
    if (group.length) this.card(title, group, p);
    if (more.length) {
      const shut = !this.moreOpen?.[p.id];
      const box = h('div', { class: 'set-more' }, this.rowsCard(more, p));
      box.hidden = shut;
      const btn = h('button', { class: 'more-btn no-press' + (shut ? '' : ' open'), onclick: () => {
        const open = box.hidden;
        (this.moreOpen ||= {})[p.id] = open;
        box.hidden = !open;
        btn.classList.toggle('open', open);
        if (open) { Motion.enter(box, 0, -8); this.placeSegs(); }
      } }, icon('E70D'), h('span', { text: t('More options') }));
      this.body.append(btn, box);
    }
    this.refresh();
  },
  card(title, rows, p) {
    const c = this.rowsCard(rows, p);
    this.body.append(title ? h('section', { class: 'set-sec' }, h('h3', { text: title }), c) : c);
  },
  rowsCard(rows, p) {
    const list = h('div', { class: 'set-card' });
    for (const r of rows) {
      const el = this.row(r, p);
      list.append(el);
      this.rows.push({ el, when: r.when });
    }
    return list;
  },
  changed(sec) {
    save();
    sec.apply?.();
    this.refresh();
  },
  refresh() {
    for (const [key, { sw, btn }] of this.navToggles) { const on = !!getPath(key); sw.set(on); btn.classList.toggle('off', !on); }
    for (const r of this.rows) r.el.hidden = !!(r.when && !r.when());
    for (const c of this.body.querySelectorAll('.set-card')) {
      const empty = ![...c.children].some(x => !x.hidden);
      (c.closest('.set-sec') || c).hidden = empty;
    }
    this.placeSegs();
  },
  // a pill can't be measured while its row is hidden, so place it once the row shows
  placeSegs() { for (const seg of this.body.querySelectorAll('.seg')) seg.place?.(false); },

  row(r, sec) {
    const label = r.label ? t(r.label) : '';
    const change = v => { setPath(r.key, v); r.after?.(v); this.changed(sec); };
    const val = () => getPath(r.key);
    const hint = r.hint ?? HINTS[r.key];
    const text = () => h('div', { class: 'row-text' }, label ? h('label', { text: label }) : null, hint ? h('small', { text: t(hint) }) : null);
    const line = ctl => h('div', { class: 'set-row' }, text(), ctl);
    const stack = ctl => h('div', { class: 'set-row stack' }, text(), ctl);
    switch (r.type) {
      case 'switch': {
        const el = UI.toggle(!!val(), async v => {
          if (r.ask && v && !(await r.ask())) { UI.toast(t('Permission was not granted'), true); this.rebuild(); return; }
          change(v);
        });
        return line(el);
      }
      case 'seg': return stack(UI.seg(r.options.map(o => ({ ...o, label: t(o.label) })), val(), change, 'fill'));
      case 'select': return line(selectBtn(r.options.map(o => ({ ...o, label: t(o.label) })), val(), change));
      case 'tiles': return stack(tiles(r, val(), change));
      case 'range': {
        const out = h('output', { text: fmtRange(r, val()) });
        const input = h('input', { type: 'range', min: r.min, max: r.max, step: r.step || 1, value: val(), 'aria-label': label });
        const paint = () => input.style.setProperty('--p', ((input.value - r.min) / (r.max - r.min) * 100) + '%');
        let frame = 0;
        input.addEventListener('input', () => {
          paint();
          out.textContent = fmtRange(r, +input.value);
          setPath(r.key, +input.value);
          frame ||= requestAnimationFrame(() => { frame = 0; (LIVE[r.key] || sec.apply)?.(); });
        });
        input.addEventListener('change', () => { save(); this.refresh(); });
        paint();
        return h('div', { class: 'set-row stack' }, h('div', { class: 'set-range-head' }, h('div', { class: 'row-text' }, h('label', { text: label }), hint ? h('small', { text: t(hint) }) : null), out), input);
      }
      case 'text': {
        const input = h('input', { type: r.secret ? 'password' : r.input || 'text', value: val() ?? '', placeholder: r.placeholder ? t(r.placeholder) : '', spellcheck: false, autocomplete: 'off', 'aria-label': label });
        let timer;
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => change(input.value), 400); });
        return stack(h('div', { class: 'text-in inset' }, input));
      }
      case 'area': {
        const area = h('textarea', { value: val() ?? '', placeholder: r.placeholder ? t(r.placeholder) : '', spellcheck: false, rows: r.rows || 4, 'aria-label': label || r.key });
        let timer;
        area.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => change(area.value), 400); });
        return stack(h('div', { class: 'area-in inset' + (r.mono ? ' mono' : '') }, area));
      }
      case 'color': {
        const input = h('input', { type: 'color', value: val() || r.fallback || '#ffffff', 'aria-label': label, oninput: () => { setPath(r.key, input.value); sec.apply?.(); }, onchange: () => save() });
        const clear = r.clearable ? h('button', { class: 'ghost square', title: t('Reset'), onclick: () => { change(''); this.rebuild(); } }, icon('E72C')) : null;
        return line(h('div', { class: 'color-in' }, clear, h('div', { class: 'swatch-in inset' }, input)));
      }
      case 'custom': return h('div', { class: 'set-row stack' }, label && r !== ARRANGE_BTN ? text() : null, r.build(sec));
    }
  },
};
const NAV = [
  [null, ['home']],
  ['Look', ['look', 'background', 'text', 'layout']],
  ['On your page', ['clock', 'calendar', 'greeting', 'search', 'links', 'weather', 'quotes']],
  ['Focus & tools', ['pomodoro', 'sounds', 'tasks', 'notes', 'countdown', 'progress']],
  ['Setup', ['profiles', 'system', 'backup']],
];
const NAV_TOGGLES = { clock: 'clock.on', calendar: 'date.on', greeting: 'greeting.on', search: 'search.on', links: 'links.on', weather: 'weather.on', quotes: 'quotes.on', pomodoro: 'pomodoro.on', sounds: 'ambient.on', tasks: 'tasks.on', notes: 'notes.on', countdown: 'countdown.on', progress: 'progress.on' };
const WIDGETS_OF_PAGE = { clock: ['clock'], calendar: ['date'], greeting: ['greeting'], links: ['links'], search: ['search'], weather: ['weather'], quotes: ['quote'], pomodoro: ['pomodoro'], sounds: ['ambient'], tasks: ['tasks'], notes: ['notes'], countdown: ['countdown'], progress: ['progress'] };
const PAGE_OF_WIDGET = Object.fromEntries(Object.entries(WIDGETS_OF_PAGE).flatMap(([page, list]) => list.map(w => [w, page])));
// a plain sentence for every setting that isn't obvious from its name
const HINTS = {
  'layout.preset': 'Ready-made ways to place everything. You can still move things afterwards.',
  style: 'The whole look of the app. Every design keeps your layout and settings.',
  dark: 'Sunset switches to dark when the sun goes down where you are.',
  'surface.mode': 'What widgets are made of: solid, see-through, frosted, or no fill at all.',
  'surface.opacity': 'How much you can see through widgets.',
  'surface.blur': 'How soft the picture looks behind frosted widgets.',
  'surface.refraction': 'How strongly the glass bends the picture at its edges.',
  uiScale: 'Makes everything on the page bigger or smaller.',
  widgetOpacity: 'Fades widgets until you point at them.',
  'bg.frequency': 'How often the picture changes.',
  'bg.blur': 'Softens the background picture.',
  'bg.fade': 'How slowly a new picture fades in.',
  'clock.worldon': 'Small clocks for other cities under the main clock.',
  'clock.seam': 'The thin line across each digit, like a flip clock.',
  'date.style': 'Click any of them on your page to see the whole month.',
  'date.format': 'The order of the day and the month.',
  'greeting.design': 'How the greeting is laid out.',
  'greeting.mode': 'Classic says good morning, Varied changes daily, World says hello in other languages.',
  'greeting.sub': 'The small line under the greeting. Smart mentions useful things like rain or sunset.',
  'greeting.weather': 'Mentions the temperature and sky in the small line.',
  'links.style': 'How big your links are.',
  'links.row': 'The most links in one row before starting a new one.',
  'search.switcher': 'A small menu in the search bar for changing engine.',
  'search.bangs': 'Type !yt cats to search YouTube directly, !gh GitHub, !w Wikipedia.',
  'search.width': 'How wide the search bar is.',
  'weather.size': 'Compact is a small pill you click to open the forecast.',
  'weather.geo': 'Approximate uses your time zone. Precise asks for your location. Manual lets you type a city.',
  'weather.forecast': 'What the forecast card shows.',
  'quotes.frequency': 'How often a new quote appears.',
  'pomodoro.focus': 'Length of a focus session.',
  'pomodoro.stats': 'Minutes focused today and this week, and your streak.',
  'page.width': 'How far widgets may spread on a wide screen.',
  'page.gap': 'The space between widgets.',
};
const applyCss = () => { applyPage(); globalThis.Glass?.on && Glass.later(); };
const LIVE = {
  'clock.glassfrost': () => globalThis.GlassDigits?.refresh(),
  'clock.glassrefraction': () => globalThis.GlassDigits?.refresh(),
  'clock.weight': () => { applyPage(); globalThis.GlassDigits?.refresh(); },
  'bg.blur': () => Bg.filters(), 'bg.dim': () => Bg.filters(), 'bg.grain': () => Bg.texture(), 'bg.fade': () => {},
};
for (const k of ['search.height', 'links.row', 'links.radius', 'clock.size', 'greeting.size', 'search.width', 'search.opacity', 'notes.width', 'notes.opacity', 'page.width', 'page.gap', 'uiScale', 'widgetOpacity', 'font.size', 'font.shadow', 'font.shadowA', 'font.shadowBlur', 'font.shadowY']) LIVE[k] = applyCss;
const fmtRange = (r, v) => (r.format ? r.format(v) : v) + (r.unit || '');

function selectBtn(options, value, onChange) {
  const name = () => options.find(o => o.value === value)?.label ?? value;
  const label = h('span', { text: name() });
  const btn = h('button', { class: 'raised-btn small select-btn', type: 'button', onclick: () => {
    const r = btn.getBoundingClientRect();
    UI.menu(r.left, r.bottom + 4, options.map(o => ({ label: o.label, on: o.value === value, run: () => { value = o.value; label.textContent = name(); onChange(value); Motion.pop(btn, .94); } })));
  } }, label, icon('E70D'));
  return btn;
}

function tiles(r, value, onChange) {
  const box = h('div', { class: 'tiles cols-' + (r.cols || 3) });
  for (const o of r.options) {
    const b = h('button', { type: 'button', class: 'tile no-press' + (o.value === value ? ' on' : ''), title: t(o.label), onclick: () => {
      for (const x of box.children) x.classList.remove('on');
      b.classList.add('on');
      Motion.pop(b, .9);
      onChange(o.value);
    } }, o.preview ? o.preview() : o.icon ? h('div', { class: 'tile-icon' }, icon(o.icon)) : null, r.nolabels ? null : h('span', { text: t(o.label) }));
    box.append(b);
  }
  return box;
}

const opts = pairs => Object.entries(pairs).map(([value, label]) => ({ value, label }));

/* ---------- little live previews for the pickers ---------- */
const miniTheme = theme => () => h('div', { class: 'mini', 'data-theme': theme }, h('i', { class: 'mini-key' }), h('i', { class: 'mini-key' }), h('i', { class: 'mini-dot' }));
const miniSplit = (a, b) => () => h('div', { class: 'mini-split' }, miniTheme(a)(), miniTheme(b)());
const miniLayout = name => () => h('div', { class: 'mini-layout' }, ['tl', 'tc', 'tr', 'l', 'center', 'r', 'bl', 'bc', 'br'].map(z => h('i', { class: (PRESETS[name][z] || []).some(id => ['weather', 'quote', 'links'].includes(id)) ? 'fill' : z === 'center' ? 'mid-block' : '' })));

/* ---------- the settings themselves ---------- */
const applyAll = () => Page.renderAll(false);
const applyBg = () => { Bg.render(false); };
const applyLook = () => { applyPage(); applyMotionPref(); Bg.texture(); $('gear').hidden = S.hideGear; syncGlass(); globalThis.GlassDigits?.later(); };
const isOn = key => () => getPath(key);
const ACCENTS = [['', '#FF5436', 'Ember'], ['plain', '#FFFFFF', 'White'], ['#E5484D', '#E5484D', 'Red'], ['#F5A524', '#F5A524', 'Amber'], ['#30A46C', '#30A46C', 'Green'], ['#12A594', '#12A594', 'Teal'], ['#3E8EED', '#3E8EED', 'Blue'], ['#7C66DC', '#7C66DC', 'Violet'], ['#D6409F', '#D6409F', 'Pink']];
const miniStyle = name => () => h('div', { class: 'mini', 'data-style': name, 'data-theme': document.documentElement.dataset.theme }, h('i', { class: 'mini-key' }), h('i', { class: 'mini-key' }), h('i', { class: 'mini-dot' }));
const STYLE_ROW = { type: 'tiles', key: 'style', label: 'Design', cols: 4, options: [
  { value: 'keys', label: 'Keys', preview: miniStyle('keys') },
  { value: 'glass', label: 'Glass', preview: miniStyle('glass') },
  { value: 'paper', label: 'Paper', preview: miniStyle('paper') },
  { value: 'clay', label: 'Clay', preview: miniStyle('clay') },
], after: v => {
  S.surface.mode = v === 'glass' ? 'translucent' : 'solid';
  if (v === 'glass') {
    S.surface.opacity = 100; S.surface.blur = 13; S.surface.refraction = 60;
    S.clock.style = 'glass';
  } else if (S.clock.style === 'glass') S.clock.style = 'tiles';
  Clock.build();
  Page.place(false);
  Settings.rebuild();
} };
const SURFACE_ROWS = [
  // Glass is only ever see-through or frosted
  { type: 'tiles', key: 'surface.mode', label: 'Behind things',
    get cols() { return S.style === 'glass' ? 2 : 4; },
    get hint() { return S.style === 'glass' ? 'See-through shows the picture sharply. Frosted softens it.' : undefined; },
    get options() {
      const clear = { value: 'translucent', label: 'See-through', icon: 'E7B3' }, frost = { value: 'glass', label: 'Frosted', icon: 'E753' };
      return S.style === 'glass' ? [clear, frost] : [{ value: 'solid', label: 'Solid', icon: 'E73B' }, clear, frost, { value: 'transparent', label: 'None', icon: 'E711' }];
    },
    after: () => Settings.rebuild() },
  { type: 'range', key: 'surface.opacity', label: 'Opacity', min: 5, max: 100, unit: '%', when: () => S.style !== 'glass' && ['translucent', 'glass'].includes(S.surface.mode) },
  { type: 'range', key: 'surface.blur', label: 'Blur', min: 0, max: 40, unit: 'px', when: () => S.surface.mode === 'glass' },
  { type: 'range', key: 'surface.refraction', label: 'Refraction', min: 0, max: 120, when: () => S.style === 'glass' && ['glass', 'translucent'].includes(S.surface.mode) },
];
const THEME_ROW = { type: 'tiles', key: 'dark', label: 'Appearance', cols: 4, options: [
  { value: 'dark', label: 'Dark', preview: miniTheme('dark') },
  { value: 'light', label: 'Light', preview: miniTheme('light') },
  { value: 'system', label: 'System', preview: miniSplit('dark', 'light') },
  { value: 'auto', label: 'Sunset', preview: miniSplit('light', 'dark') },
] };
const ACCENT_ROW = { type: 'custom', label: 'Accent color', build: sec => {
  const box = h('div', { class: 'accents' }, ACCENTS.map(([value, color, name]) => {
    const b = h('button', { type: 'button', class: 'accent-dot no-press' + (S.accent === value ? ' on' : ''), title: t(name), style: '--dot:' + color, onclick: () => {
      S.accent = value;
      for (const x of box.children) x.classList.remove('on');
      b.classList.add('on');
      Motion.pop(b, .7);
      Settings.changed(sec);
    } });
    return b;
  }));
  return box;
} };
const LAYOUT_ROW = { type: 'tiles', key: 'layout.preset', label: 'Layout', cols: 4, options: [
  { value: 'centered', label: 'Centered', preview: miniLayout('centered') },
  { value: 'dashboard', label: 'Dashboard', preview: miniLayout('dashboard') },
  { value: 'dock', label: 'Dock', preview: miniLayout('dock') },
  { value: 'minimal', label: 'Minimal', preview: miniLayout('minimal') },
], after: v => { S.layout.zones = structuredClone(PRESETS[v]); } };
const ARRANGE_BTN = { type: 'custom', label: 'Arrange page by dragging', build: () => h('div', { class: 'arrange-box' },
  h('button', { class: 'accent-btn arrange-btn', onclick: () => Lazy.extras().then(() => Arrange.toggle()) }, icon('E80A'), h('span', { text: t('Arrange page by dragging') })),
  h('div', { class: 'set-hint', text: t('Move anything on your page, including the clock, calendar and links.') })) };

const WIDGET_TOGGLES = [
  ['clock.on', 'Clock', 'E917', 'clock'], ['date.on', 'Calendar', 'E787', 'calendar'], ['greeting.on', 'Greeting', 'E76E', 'greeting'],
  ['search.on', 'Search bar', 'E721', 'search'], ['links.on', 'Quick Links', 'E71B', 'links'], ['weather.on', 'Weather', 'E706', 'weather'],
  ['quotes.on', 'Quotes', 'E8BD', 'quotes'], ['pomodoro.on', 'Pomodoro', 'E916', 'pomodoro'], ['ambient.on', 'Sounds', 'E767', 'sounds'],
  ['tasks.on', 'Tasks', 'E9D5', 'tasks'], ['notes.on', 'Notes', 'E70B', 'notes'], ['countdown.on', 'Countdown', 'E823', 'countdown'], ['progress.on', 'Progress', 'E9D2', 'progress'],
];
function buildWidgetGrid(sec) {
  return h('div', { class: 'widget-grid' }, WIDGET_TOGGLES.map(([key, name, ic, page]) => {
    const tile = h('div', { class: 'widget-tile' + (getPath(key) ? ' on' : '') });
    tile.append(
      h('button', { class: 'wt-main no-press', title: t('Open settings'), onclick: () => Settings.go(page),
        onpointerenter: () => Settings.spot(page), onpointerleave: () => Settings.spot() }, icon(ic), h('span', { text: t(name) })),
      UI.toggle(!!getPath(key), on => {
        setPath(key, on);
        tile.classList.toggle('on', on);
        Settings.changed(sec);
        if (key === 'weather.on' && on) Weather.refresh();
      }));
    return tile;
  }));
}

function buildNameColor(sec) {
  const choose = (value, el) => {
    S.greeting.namecolor = value;
    for (const x of box.children) x.classList.remove('on');
    el?.classList.add('on');
    if (el) Motion.pop(el, .7);
    Settings.changed(sec);
  };
  const dot = (value, color, title, cls = '') => {
    const b = h('button', { type: 'button', class: 'accent-dot no-press ' + cls + (S.greeting.namecolor === value ? ' on' : ''), title: t(title), style: color ? '--dot:' + color : '', onclick: () => choose(value, b) });
    return b;
  };
  const custom = h('input', { type: 'color', value: /^#/.test(S.greeting.namecolor) ? S.greeting.namecolor : '#7FB5FF', 'aria-label': t('Your own color'), oninput: () => { S.greeting.namecolor = custom.value; applyPage(); }, onchange: () => choose(custom.value, null) });
  const box = h('div', { class: 'accents' },
    dot('', 'var(--accent)', 'Accent color'),
    dot('plain', '', 'No color', 'plain'),
    ['#FF8A70', '#F5C04A', '#3DD68C', '#6FD6D6', '#7FB5FF', '#C6A2FF', '#FF9CCB'].map(c => dot(c, c, 'Color')),
    h('label', { class: 'accent-dot custom', title: t('Your own color') }, custom));
  return box;
}

const ZONE_NAMES = { tl: 'Top left', tc: 'Top center', tr: 'Top right', l: 'Left', center: 'Center', r: 'Right', bl: 'Bottom left', bc: 'Bottom center', br: 'Bottom right' };
const WIDGET_NAMES = { clock: 'Clock', date: 'Calendar', greeting: 'Greeting', weather: 'Weather', search: 'Search bar', links: 'Quick Links', quote: 'Quotes', notes: 'Notes', pomodoro: 'Pomodoro', tasks: 'Tasks', ambient: 'Sounds', countdown: 'Countdown', progress: 'Progress' };
function buildPositions(sec) {
  const zoneOf = id => ZONES.find(z => S.layout.zones[z]?.includes(id)) || 'center';
  return h('div', { class: 'set-group' }, Object.entries(WIDGET_NAMES).filter(([id]) => widgetOn(id)).map(([id, name]) => h('div', { class: 'pos-row' },
    h('span', { text: t(name) }),
    selectBtn(opts(ZONE_NAMES).map(o => ({ ...o, label: t(o.label) })), zoneOf(id), v => {
      for (const z of ZONES) S.layout.zones[z] = (S.layout.zones[z] || []).filter(x => x !== id);
      S.layout.zones[v].push(id);
      S.layout.preset = 'custom';
      Settings.changed(sec);
    }))));
}

function buildShortcuts() {
  const keys = [['Esc', 'Settings'], ['Ctrl K', 'Command palette'], ['/', 'Search'], ['Z', 'Hide everything'], ['Ctrl Shift L', 'Dark or light mode'], ['Alt 1–9', 'Open a link']];
  return h('div', { class: 'keys-help' }, keys.map(([k, what]) => h('div', {}, h('span', { text: t(what) }), h('span', { class: 'kbd-row' }, k.split(' ').map(x => h('kbd', { class: 'raised', text: x }))))));
}

/* ---------- font picker: every name is shown in its own font, fetched only when scrolled into view ---------- */
const FONTS = {
  Sans: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Work Sans', 'DM Sans', 'Manrope', 'Rubik', 'Outfit', 'Figtree', 'Plus Jakarta Sans', 'Space Grotesk', 'Sora', 'Urbanist', 'Lexend', 'Mulish', 'Quicksand', 'Karla', 'IBM Plex Sans', 'Source Sans 3', 'Barlow'],
  Serif: ['Playfair Display', 'Merriweather', 'Lora', 'EB Garamond', 'Libre Baskerville', 'Crimson Pro', 'Source Serif 4', 'Fraunces', 'DM Serif Display', 'Cormorant Garamond', 'Bitter'],
  Display: ['Bebas Neue', 'Oswald', 'Anton', 'Archivo Black', 'Righteous', 'Abril Fatface', 'Lobster', 'Comfortaa', 'Fredoka', 'Baloo 2', 'Orbitron', 'Audiowide'],
  Mono: ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', 'Source Code Pro', 'Inconsolata', 'VT323'],
  Handwriting: ['Caveat', 'Pacifico', 'Dancing Script', 'Satisfy', 'Shadows Into Light', 'Kalam', 'Patrick Hand', 'Permanent Marker'],
  'On this PC': ['Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Cascadia Mono', 'Consolas', 'Georgia', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
};
const fontPreviews = new Set();
function buildFontPicker(sec) {
  const name = h('span', { text: S.font.family || 'Sunghyun Sans', style: `font-family:"${S.font.family || 'Sunghyun Sans'}"` });
  const panel = h('div', { class: 'font-panel', hidden: true });
  const button = h('button', { class: 'raised-btn font-btn', type: 'button', onclick: () => {
    panel.hidden = !panel.hidden;
    button.classList.toggle('open', !panel.hidden);
    if (!panel.hidden) { Motion.enter(panel, 0, -8); draw(); search.focus(); }
  } }, name, icon('E70D'));
  const search = h('input', { type: 'text', placeholder: t('Search') + '…', spellcheck: false, 'aria-label': t('Search'), oninput: () => draw() });
  let group = 'All';
  const groups = h('div', { class: 'font-groups' });
  const rows = h('div', { class: 'font-rows' });
  const seen = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      const f = e.target.dataset.font;
      if (fontPreviews.has(f)) continue;
      fontPreviews.add(f);
      // only the letters of its own name, so a preview is a few KB at most
      document.head.append(h('link', { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}&text=${encodeURIComponent(f)}&display=swap` }));
    }
  }, { root: rows });
  const choose = (family, local) => {
    Object.assign(S.font, { family, local });
    name.textContent = family || 'Sunghyun Sans';
    name.style.fontFamily = `"${family || 'Sunghyun Sans'}"`;
    Settings.changed(sec);
    draw();
  };
  const row = (family, local, shown) => {
    const on = S.font.family === family;
    const b = h('button', { type: 'button', class: 'font-row no-press' + (on ? ' on' : ''), 'data-font': local || !family ? null : family, onclick: () => choose(family, local) },
      h('span', { text: shown || family, style: `font-family:"${family || 'Sunghyun Sans'}"` }), on ? icon('E73E') : null);
    if (family && !local) seen.observe(b);
    return b;
  };
  function draw() {
    const q = search.value.trim().toLowerCase();
    groups.replaceChildren(...['All', ...Object.keys(FONTS)].map(g => h('button', { type: 'button', class: 'chip-btn no-press' + (g === group ? ' on' : ''), text: t(g), onclick: () => { group = g; draw(); } })));
    const out = [];
    if (!q && group === 'All') out.push(row('', true, 'Sunghyun Sans'));
    for (const [g, list] of Object.entries(FONTS)) {
      if (group !== 'All' && group !== g) continue;
      for (const f of list) if (!q || f.toLowerCase().includes(q)) out.push(row(f, g === 'On this PC'));
    }
    const typed = search.value.trim();
    if (typed && !Object.values(FONTS).flat().some(f => f.toLowerCase() === q)) out.push(h('button', { type: 'button', class: 'font-row no-press', onclick: () => choose(typed, false) }, h('span', { text: `${t('Use from Google Fonts')}: ${typed}` })));
    rows.replaceChildren(...out);
  }
  panel.append(h('div', { class: 'text-in inset' }, search), groups, rows);
  return h('div', { class: 'set-group' }, button, panel);
}

let pagesMemo = null;
function PAGES() { return pagesMemo ||= buildPages(); }
function buildPages() {
  const b = () => S.bg.type;
  const photo = () => !['friis', 'color'].includes(b());
  return [
    {
      id: 'home', title: 'Overview', icon: 'E80F', blurb: 'Start here: where things go, what is on your page, and how it looks.', apply: applyAll,
      rows: [
        ARRANGE_BTN,
        { ...LAYOUT_ROW, after: v => { S.layout.zones = structuredClone(PRESETS[v]); Settings.rebuild(); } },
        { type: 'head', label: '' },
        { type: 'custom', label: 'On your page', hint: 'Click a name to open its settings. Use the switch to show or hide it.', build: buildWidgetGrid },
        { type: 'head', label: '' },
        STYLE_ROW,
        THEME_ROW,
        ACCENT_ROW,
      ],
    },
    {
      id: 'look', title: 'Design', icon: 'E790', blurb: 'The overall look: design, light or dark, color and material.', apply: applyLook,
      rows: [
        STYLE_ROW,
        THEME_ROW,
        ACCENT_ROW,
        { type: 'head', label: 'Surfaces' },
        ...SURFACE_ROWS,
        { type: 'head', label: 'Motion' },
        { type: 'switch', key: 'reduceMotion', label: 'Reduce animations' },
      ],
    },
    {
      id: 'background', title: 'Background', icon: 'EB9F', blurb: 'Your Unsplash collection, your own files, or plain dark.', apply: applyBg,
      rows: [
        { type: 'tiles', key: 'bg.type', label: 'Background type', options: [
          { value: 'friis', label: 'Dark', icon: 'E793' }, { value: 'unsplash', label: 'Unsplash', icon: 'EB9F' }, { value: 'files', label: 'My files', icon: 'E8B7' },
          { value: 'urls', label: 'Image links', icon: 'E71B' }, { value: 'videos', label: 'Video links', icon: 'E714' }, { value: 'color', label: 'Solid color', icon: 'E790' },
        ], after: () => Settings.rebuild() },
        { type: 'custom', when: () => b() === 'unsplash', build: buildUnsplash },
        { type: 'custom', when: () => b() === 'files', build: buildFiles },
        { type: 'area', key: 'bg.urls', label: 'Background URLs', placeholder: 'One image URL per line', when: () => b() === 'urls' },
        { type: 'area', key: 'bg.videos', label: 'Video URLs', placeholder: 'One .mp4 or .webm URL per line', when: () => b() === 'videos' },
        { type: 'switch', key: 'bg.mute', label: 'Mute videos', when: () => b() === 'videos' },
        { type: 'color', key: 'bg.color', label: 'Background color', when: () => b() === 'color' },
        { type: 'head', label: 'Photo' },
        { type: 'select', key: 'bg.frequency', label: 'Frequency', when: photo, options: opts({ tabs: 'Every tab', hour: 'Every hour', period: 'Every period of the day', day: 'Every day', pause: 'Pause' }) },
        { type: 'range', key: 'bg.blur', label: 'Blur intensity', min: 0, max: 40, unit: 'px', when: photo },
        { type: 'head', label: 'Look' },
        { type: 'range', key: 'bg.dim', label: 'Dim background', min: 0, max: 90, unit: '%', hint: 'Darkens the background so text stands out.' },
        { type: 'range', key: 'bg.grain', label: 'Grain', min: 0, max: 100, unit: '%', hint: 'A fine film grain over the background.' },
        { type: 'range', key: 'bg.fade', label: 'Fade in time', min: 0, max: 2000, step: 50, unit: ' ms', adv: true, when: photo },
      ],
    },
    {
      id: 'text', title: 'Text', icon: 'E8D2', blurb: 'The font, its size, and the shadow behind text and numbers.', apply: applyLook,
      rows: [
        { type: 'custom', label: 'Font family', build: buildFontPicker },
        { type: 'range', key: 'font.size', label: 'Size', min: 11, max: 18, unit: 'px' },
        { type: 'select', key: 'font.weight', label: 'Weight', adv: true, options: opts({ '': 'Default', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }) },
        { type: 'head', label: 'Text shadow' },
        { type: 'switch', key: 'font.shadowOn', label: 'Shadow behind all text and numbers', hint: 'Off by default. Turn it on to adjust it below.', after: () => Settings.rebuild() },
        { type: 'range', key: 'font.shadowA', label: 'Strength', min: 0, max: 1, step: .05, format: v => Math.round(v * 100) + '%', when: isOn('font.shadowOn') },
        { type: 'range', key: 'font.shadowBlur', label: 'Softness', min: 0, max: 24, unit: 'px', when: isOn('font.shadowOn') },
        { type: 'range', key: 'font.shadowY', label: 'Distance', min: 0, max: 12, unit: 'px', when: isOn('font.shadowOn') },
        { type: 'color', key: 'font.shadowColor', label: 'Shadow color', when: isOn('font.shadowOn') },
      ],
    },
    {
      id: 'layout', title: 'Layout', icon: 'E80A', blurb: 'Move anything on your page.', apply: applyAll,
      rows: [
        ARRANGE_BTN,
        { ...LAYOUT_ROW, after: v => { S.layout.zones = structuredClone(PRESETS[v]); Settings.rebuild(); } },
        { type: 'head', label: 'Exact positions' },
        { type: 'custom', build: buildPositions },
        { type: 'head', label: 'Size' },
        { type: 'range', key: 'uiScale', label: 'Page zoom', min: 70, max: 140, step: 5, unit: '%' },
        { type: 'range', key: 'widgetOpacity', label: 'Widget opacity', min: 30, max: 100, unit: '%' },
        { type: 'range', key: 'page.width', label: 'Page width', min: 800, max: 2600, step: 20, unit: 'px', adv: true },
        { type: 'range', key: 'page.gap', label: 'Page gap', min: 4, max: 40, unit: 'px', adv: true },
      ],
    },
    {
      id: 'clock', title: 'Clock', icon: 'E917', blurb: 'Digital or analog, and how it shows the time.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'clock.on', label: 'Show clock' },
        { type: 'tiles', key: 'clock.analog', label: 'Clock type', cols: 2, when: isOn('clock.on'), options: [{ value: false, label: 'Digital', icon: 'E917' }, { value: true, label: 'Analog', icon: 'E823' }], after: () => Settings.rebuild() },
        { type: 'color', key: 'clock.color', label: 'Clock color', when: () => S.clock.on && S.style !== 'glass' && (S.clock.analog || S.clock.style !== 'glass'), clearable: true, fallback: '#ffffff' },
        { type: 'seg', key: 'clock.style', label: 'Digital style', when: () => S.clock.on && !S.clock.analog, options: [{ value: 'tiles', label: 'Keys' }, { value: 'plain', label: 'Plain' }, { value: 'glass', label: 'Glass' }] },
        { type: 'range', key: 'clock.glassfrost', label: 'Frosted', min: 0, max: 100, step: 5, unit: '%', hint: '0% is clear glass. 100% is fully frosted.', when: () => S.clock.on && !S.clock.analog && S.clock.style === 'glass' },
        { type: 'range', key: 'clock.glassrefraction', label: 'Refraction', min: 0, max: 120, hint: 'How strongly the numbers bend the picture behind them.', when: () => S.clock.on && !S.clock.analog && S.clock.style === 'glass' },
        { type: 'select', key: 'clock.shape', label: 'Clock shape', when: isOn('clock.analog'), options: opts({ round: 'Round', square: 'Square', rectangle: 'Rectangle' }) },
        { type: 'select', key: 'clock.face', label: 'Clock face', when: isOn('clock.analog'), options: opts({ none: 'None', marks: 'Marks', number: 'Numbers', roman: 'Roman', swiss: 'Swiss', braun: 'Braun' }) },
        { type: 'select', key: 'clock.hands', label: 'Clock hands', when: isOn('clock.analog'), options: opts({ modern: 'Modern', swiss: 'Swiss', classic: 'Classic', braun: 'Braun', apple: 'Rounded' }) },
        { type: 'range', key: 'clock.weight', label: 'Weight', min: 0, max: 900, step: 100, format: v => v || t('Automatic'), hint: 'How bold the numbers are.', when: () => S.clock.on && !S.clock.analog },
        { type: 'range', key: 'clock.size', label: 'Clock size', min: 40, max: 200, step: 5, unit: '%', when: isOn('clock.on') },
        { type: 'head', label: 'What it shows' },
        { type: 'switch', key: 'clock.seconds', label: 'Show seconds', when: isOn('clock.on') },
        { type: 'switch', key: 'clock.ampm', label: '12-Hour Time', when: () => S.clock.on && !S.clock.analog },
        { type: 'switch', key: 'clock.ampmlabel', label: 'Show AM/PM', when: () => S.clock.on && !S.clock.analog && S.clock.ampm },
        { type: 'head', label: 'World clocks' },
        { type: 'switch', key: 'clock.worldon', label: 'World clocks', when: isOn('clock.on'), after: () => Settings.rebuild() },
        { type: 'custom', when: () => S.clock.on && S.clock.worldon, build: buildWorld },
        { type: 'custom', label: 'Time zone', when: isOn('clock.on'), adv: true, build: sec => tzPicker(S.clock.timezone, v => { S.clock.timezone = v; Settings.changed(sec); }, true) },
        { type: 'switch', key: 'clock.blink', label: 'Blink the colon', when: isOn('clock.on'), adv: true },
        { type: 'switch', key: 'clock.seam', label: 'Seam across digits', when: isOn('clock.on'), adv: true },
        { type: 'color', key: 'clock.dialbg', label: 'Clock background', when: isOn('clock.analog'), clearable: true, fallback: '#0d0f11', adv: true },
        { type: 'color', key: 'clock.dialborder', label: 'Clock border', when: isOn('clock.analog'), clearable: true, fallback: '#23282e', adv: true },
      ],
    },
    {
      id: 'calendar', title: 'Calendar', icon: 'E787', blurb: 'Click it on your page to see the whole month.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'date.on', label: 'Show calendar' },
        { type: 'tiles', key: 'date.style', label: 'Calendar style', cols: 5, when: isOn('date.on'), options: [{ value: 'rail', label: 'Week', icon: 'E8C0' }, { value: 'page', label: 'Page', icon: 'E787' }, { value: 'month', label: 'Month', icon: 'E8BF' }, { value: 'dots', label: 'Dots', icon: 'E915' }, { value: 'line', label: 'Text', icon: 'E8D2' }], after: () => Settings.rebuild() },
        { type: 'switch', key: 'date.week', label: 'Show the week', hint: 'Click it to open the whole month.', when: () => S.date.on && S.date.style === 'rail' },
        { type: 'switch', key: 'date.weeknum', label: 'Show week numbers', when: () => S.date.on && S.date.style === 'rail' },
        { type: 'head', label: 'Dates' },
        { type: 'select', key: 'date.firstday', label: 'Week starts on', when: isOn('date.on'), options: opts({ auto: 'Automatic', mon: 'Monday', sun: 'Sunday', sat: 'Saturday' }) },
        { type: 'select', key: 'date.format', label: 'Date format', when: isOn('date.on'), options: opts({ auto: 'Automatic', eu: 'Day first', us: 'Month first', cn: 'Numeric' }) },
      ],
    },
    {
      id: 'greeting', title: 'Greeting', icon: 'E76E', blurb: 'Says hello, then something useful about right now.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'greeting.on', label: 'Show greeting' },
        { type: 'tiles', key: 'greeting.design', label: 'Greeting style', cols: 4, when: isOn('greeting.on'), options: [{ value: 'classic', label: 'Classic', icon: 'E706' }, { value: 'stacked', label: 'Stacked', icon: 'E8FD' }, { value: 'card', label: 'Card', icon: 'E8A9' }, { value: 'minimal', label: 'Minimal', icon: 'E8D2' }] },
        { type: 'head', label: 'Your name' },
        { type: 'text', key: 'greeting.name', label: 'Greeting name', placeholder: 'Your name', when: isOn('greeting.on') },
        { type: 'custom', label: 'Color of your name', when: isOn('greeting.on'), build: buildNameColor },
        { type: 'head', label: 'What it says' },
        { type: 'tiles', key: 'greeting.mode', label: 'Words', cols: 4, when: isOn('greeting.on'), options: [{ value: 'auto', label: 'Classic', icon: 'E76E' }, { value: 'varied', label: 'Varied', icon: 'E8B1' }, { value: 'world', label: 'World', icon: 'E774' }, { value: 'custom', label: 'My own', icon: 'E70F' }], after: () => Settings.rebuild() },
        ...['morning', 'afternoon', 'evening', 'night'].map(p => ({ type: 'text', key: 'greeting.' + p, label: { morning: 'In the morning', afternoon: 'In the afternoon', evening: 'In the evening', night: 'At night' }[p], when: () => S.greeting.on && S.greeting.mode === 'custom' })),
        { type: 'head', label: 'Second line' },
        { type: 'seg', key: 'greeting.sub', label: 'Shows', when: isOn('greeting.on'), options: [{ value: 'smart', label: 'Smart' }, { value: 'custom', label: 'My own' }, { value: 'off', label: 'Off' }], after: () => Settings.rebuild() },
        { type: 'text', key: 'greeting.subtext', label: 'Your line', when: () => S.greeting.on && S.greeting.sub === 'custom' },
        { type: 'switch', key: 'greeting.weather', label: 'Show weather in the greeting', when: () => S.greeting.on && S.greeting.sub === 'smart' },
        { type: 'head', label: 'Look' },
        { type: 'switch', key: 'greeting.icon', label: 'Show sun and moon', when: isOn('greeting.on') },
        { type: 'range', key: 'greeting.size', label: 'Greeting size', min: 16, max: 72, unit: 'px', when: isOn('greeting.on') },
      ],
    },
    {
      id: 'search', title: 'Search bar', icon: 'E721', blurb: 'Type !yt, !gh, !w, !m or !r to jump straight to a site.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'search.on', label: 'Show search bar' },
        { type: 'select', key: 'search.engine', label: 'Search engine', when: isOn('search.on'), options: Object.entries(ENGINES).map(([value, e]) => ({ value, label: e.label })) },
        { type: 'text', key: 'search.request', label: 'URL request', placeholder: 'https://example.com/search?q=%s', when: () => S.search.on && S.search.engine === 'custom' },
        { type: 'head', label: 'When you search' },
        { type: 'switch', key: 'search.newtab', label: 'Open in new tab', when: isOn('search.on') },
        { type: 'switch', key: 'search.suggestions', label: 'Suggestions', when: isOn('search.on'), hint: 'What you type is sent to DuckDuckGo for suggestions.', ask: () => askPermission({ origins: ['https://duckduckgo.com/*'] }) },
        { type: 'switch', key: 'search.bangs', label: 'Bang shortcuts', when: isOn('search.on') },
        { type: 'head', label: 'Look' },
        { type: 'switch', key: 'search.switcher', label: 'Engine switcher in the bar', when: isOn('search.on') },
        { type: 'range', key: 'search.width', label: 'Width', min: 30, max: 100, unit: '%', when: isOn('search.on') },
        { type: 'range', key: 'search.height', label: 'Height', min: 32, max: 72, unit: 'px', when: isOn('search.on') },
        { type: 'text', key: 'search.placeholder', label: 'Placeholder text', when: isOn('search.on'), adv: true },
        { type: 'range', key: 'search.opacity', label: 'Background', min: 20, max: 100, unit: '%', when: isOn('search.on'), adv: true },
      ],
    },
    {
      id: 'links', title: 'Quick Links', icon: 'E71B', blurb: 'Drag keys to reorder. Drop one on another for a folder.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'links.on', label: 'Show links' },
        { type: 'custom', when: isOn('links.on'), build: buildLinkTools },
        { type: 'custom', label: 'Your links', when: isOn('links.on'), build: buildLinkList },
        { type: 'head', label: 'Look' },
        { type: 'tiles', key: 'links.style', label: 'Style', cols: 5, when: isOn('links.on'), options: [{ value: 'large', label: 'Large', icon: 'E8A9' }, { value: 'medium', label: 'Medium', icon: 'E8A9' }, { value: 'small', label: 'Small', icon: 'E80A' }, { value: 'inline', label: 'Inline', icon: 'E8FD' }, { value: 'text', label: 'Text', icon: 'E8D2' }] },
        { type: 'range', key: 'links.row', label: 'Links per row', min: 1, max: 14, when: isOn('links.on') },
        { type: 'switch', key: 'links.titles', label: 'Show titles', when: isOn('links.on') },
        { type: 'head', label: 'When you click' },
        { type: 'switch', key: 'links.newtab', label: 'Open in new tab', when: isOn('links.on') },
        { type: 'head', label: 'Groups' },
        { type: 'switch', key: 'links.groupson', label: 'Show groups', when: isOn('links.on'), after: () => Settings.rebuild() },
        { type: 'custom', when: () => S.links.on && S.links.groupson, build: buildGroups },
        { type: 'switch', key: 'links.backgrounds', label: 'Show keycaps', when: isOn('links.on'), hint: 'Off shows icons directly on the background until you hover.', adv: true },
        { type: 'range', key: 'links.radius', label: 'Icon corner radius', min: 4, max: 30, unit: 'px', when: isOn('links.on'), adv: true },
      ],
    },
    {
      id: 'weather', title: 'Weather', icon: 'E706', blurb: 'Click the pill on your page to open the forecast.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'weather.on', label: 'Show weather', after: v => v && Weather.refresh() },
        { type: 'head', label: 'Where' },
        { type: 'seg', key: 'weather.geo', label: 'Geolocation', when: isOn('weather.on'), options: [{ value: 'approximate', label: 'Approximate' }, { value: 'precise', label: 'Precise' }, { value: 'off', label: 'Manual' }], after: () => { Weather.refresh(true); } },
        { type: 'custom', label: 'Manual location', when: () => S.weather.on && S.weather.geo === 'off', build: buildCity },
        { type: 'seg', key: 'weather.unit', label: 'Temperature unit', when: isOn('weather.on'), options: [{ value: 'metric', label: 'Celsius' }, { value: 'imperial', label: 'Fahrenheit' }], after: () => Weather.refresh(true) },
        { type: 'head', label: 'Look' },
        { type: 'tiles', key: 'weather.iconstyle', label: 'Icon style', cols: 3, when: isOn('weather.on'), options: [['soft', 'Soft'], ['frosted', 'Frosted'], ['glossy', 'Glossy'], ['flat', 'Flat'], ['line', 'Line'], ['mono', 'Mono']].map(([value, label]) => ({ value, label, preview: () => h('div', { class: 'wi-prev', html: scene(2, true, value) }) })) },
        { type: 'seg', key: 'weather.size', label: 'Size', when: isOn('weather.on'), options: [{ value: 'compact', label: 'Compact' }, { value: 'full', label: 'Full card' }] },
        { type: 'head', label: 'Forecast' },
        { type: 'select', key: 'weather.forecast', label: 'Forecast', when: isOn('weather.on'), options: opts({ always: 'Today and next days', auto: 'Today only', never: 'None' }) },
        { type: 'switch', key: 'weather.details', label: 'Humidity, wind and rain', when: isOn('weather.on') },
        { type: 'select', key: 'weather.temperature', label: 'Temperature', when: isOn('weather.on'), adv: true, options: opts({ actual: 'Actual', feelslike: 'Feels like', both: 'Both' }) },
        { type: 'switch', key: 'weather.showunit', label: 'Show temperature unit', when: isOn('weather.on'), adv: true },
        { type: 'switch', key: 'weather.hidedesc', label: 'Hide description', when: isOn('weather.on'), adv: true },
        { type: 'switch', key: 'weather.hideicon', label: 'Hide icon', when: isOn('weather.on'), adv: true },
        { type: 'select', key: 'weather.moreinfo', label: 'Detailed weather', when: isOn('weather.on'), adv: true, options: opts({ none: 'None', msnw: 'MSN Weather', yhw: 'Yahoo Weather', windy: 'Windy', accu: 'AccuWeather', custom: 'Custom' }) },
        { type: 'text', key: 'weather.provider', label: 'Provider URL', placeholder: 'https://', adv: true, when: () => S.weather.on && S.weather.moreinfo === 'custom' },
      ],
    },
    {
      id: 'quotes', title: 'Quotes', icon: 'E8BD', blurb: 'Tap the heart on a quote to keep it.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'quotes.on', label: 'Show quotes' },
        { type: 'tiles', key: 'quotes.type', label: 'Quote type', cols: 5, when: isOn('quotes.on'), options: [{ value: 'classic', label: 'Classic', icon: 'E8BD' }, { value: 'stoic', label: 'Stoic', icon: 'E8D4' }, { value: 'favorites', label: 'Favorites', icon: 'EB51' }, { value: 'user', label: 'My own', icon: 'E70F' }, { value: 'url', label: 'From a URL', icon: 'E71B' }], after: () => Settings.rebuild() },
        { type: 'area', key: 'quotes.user', label: 'Custom quotes', placeholder: 'One per line:\nThe quote | The author', when: () => S.quotes.on && S.quotes.type === 'user' },
        { type: 'text', key: 'quotes.url', label: 'URL', placeholder: 'https://… returning JSON with content + author', when: () => S.quotes.on && S.quotes.type === 'url' },
        { type: 'select', key: 'quotes.frequency', label: 'Frequency', when: isOn('quotes.on'), options: opts({ tabs: 'Every tab', hour: 'Every hour', day: 'Every day', pause: 'Pause' }) },
        { type: 'switch', key: 'quotes.author', label: 'Always show author', when: isOn('quotes.on') },
      ],
    },
    {
      id: 'pomodoro', title: 'Pomodoro', icon: 'E916', blurb: 'A focus timer with breaks.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'pomodoro.on', label: 'Show Pomodoro' },
        { type: 'head', label: 'Times' },
        { type: 'range', key: 'pomodoro.focus', label: 'Default time', min: 1, max: 120, unit: ' min', when: isOn('pomodoro.on') },
        { type: 'range', key: 'pomodoro.short', label: 'Break time', min: 1, max: 60, unit: ' min', when: isOn('pomodoro.on') },
        { type: 'range', key: 'pomodoro.long', label: 'Long break time', min: 1, max: 90, unit: ' min', when: isOn('pomodoro.on') },
        { type: 'switch', key: 'pomodoro.stats', label: 'Show focus stats', when: isOn('pomodoro.on') },
        { type: 'head', label: 'Alarm' },
        { type: 'switch', key: 'pomodoro.sound', label: 'Play sound on alarm', when: isOn('pomodoro.on') },
        { type: 'select', key: 'pomodoro.alarm', label: 'Alarm tune', when: () => S.pomodoro.on && S.pomodoro.sound, options: opts({ bell: 'Bell', chime: 'Chime', digital: 'Digital', soft: 'Soft' }), after: v => playAlarm(v, S.pomodoro.volume) },
        { type: 'range', key: 'pomodoro.volume', label: 'Alarm volume', min: 0, max: 100, unit: '%', when: () => S.pomodoro.on && S.pomodoro.sound },
      ],
    },
    {
      id: 'sounds', title: 'Sounds', icon: 'E767', blurb: 'Rain, waves and noise to focus with.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'ambient.on', label: 'Show sounds', hint: 'Made in the browser, so they work offline.' },
        { type: 'switch', key: 'ambient.withpomo', label: 'Play with the Pomodoro', when: isOn('ambient.on') },
      ],
    },
    {
      id: 'tasks', title: 'Tasks', icon: 'E9D5', blurb: 'A short to-do list. Add and tick off tasks on your page.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'tasks.on', label: 'Show tasks' },
      ],
    },
    {
      id: 'notes', title: 'Notes', icon: 'E70B', blurb: 'A place to jot things down. Saved as you type.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'notes.on', label: 'Show notes' },
        { type: 'seg', key: 'notes.align', label: 'Text alignment', when: isOn('notes.on'), options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
        { type: 'range', key: 'notes.width', label: 'Width', min: 40, max: 100, unit: '%', when: isOn('notes.on') },
        { type: 'range', key: 'notes.opacity', label: 'Background', min: 20, max: 100, unit: '%', when: isOn('notes.on') },
      ],
    },
    {
      id: 'countdown', title: 'Countdown', icon: 'E823', blurb: 'Days until something you are looking forward to.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'countdown.on', label: 'Show countdown' },
        { type: 'text', key: 'countdown.title', label: 'What is it for?', placeholder: 'Holiday', when: isOn('countdown.on') },
        { type: 'text', key: 'countdown.date', label: 'Date', input: 'date', when: isOn('countdown.on') },
      ],
    },
    {
      id: 'progress', title: 'Progress', icon: 'E9D2', blurb: 'How far through the day, week, month and year you are.', apply: applyAll,
      rows: [
        { type: 'switch', key: 'progress.on', label: 'Show progress bars' },
        { type: 'switch', key: 'progress.day', label: 'Today', when: isOn('progress.on') },
        { type: 'switch', key: 'progress.week', label: 'This week', when: isOn('progress.on') },
        { type: 'switch', key: 'progress.month', label: 'This month', when: isOn('progress.on') },
        { type: 'switch', key: 'progress.year', label: 'This year', when: isOn('progress.on') },
      ],
    },
    {
      id: 'profiles', title: 'Profiles', icon: 'E716', blurb: 'Whole setups you can switch between, by hand or by the clock.',
      rows: [
        { type: 'custom', build: buildProfiles },
      ],
    },
    {
      id: 'system', title: 'General', icon: 'E713', blurb: 'Language, shortcuts and small details.', apply: applyAll,
      rows: [
        { type: 'select', key: 'lang', label: 'Language', options: [{ value: 'auto', label: 'Same as browser' }, ...opts(LANGS)], after: async () => { await loadTranslations(); applyPage(); Page.renderAll(false); Settings.el.remove(); Settings.el = null; Settings.open(); } },
        { type: 'switch', key: 'palette', label: 'Command palette', hint: 'Ctrl K searches links, runs actions and does math.' },
        { type: 'head', label: 'Keyboard shortcuts' },
        { type: 'custom', build: buildShortcuts },
        { type: 'switch', key: 'hideGear', label: 'Hide settings icon', hint: 'Esc still opens settings.', adv: true },
        { type: 'text', key: 'tabtitle', label: 'Tab title', placeholder: 'New tab', adv: true },
        { type: 'text', key: 'favicon', label: 'Tab icon', placeholder: 'Emoji or image URL', adv: true },
        { type: 'area', key: 'css', label: 'Custom Style', mono: true, rows: 6, placeholder: '.quote-text { font-style: italic; }', adv: true },
      ],
    },
    {
      id: 'backup', title: 'Backup & sync', icon: 'E895', blurb: 'Keep your settings safe and move them between computers.', apply: applyAll,
      rows: [
        { type: 'custom', build: buildManagement },
      ],
    },
  ];
}

/* ---------- Unsplash ---------- */
function buildUnsplash() {
  const key = UNSPLASH_KEY ? null : h('input', { type: 'password', value: S.bg.unsplashKey, placeholder: 'Access Key', autocomplete: 'off', spellcheck: false });
  const col = h('input', { type: 'text', value: S.bg.collections, placeholder: 'https://unsplash.com/collections/…', spellcheck: false });
  const status = h('div', { class: 'set-hint', text: C.photos?.length ? `${C.photos.length} ${t('photos loaded')}` : t('Paste a collection link. Several are fine, separated by commas.') });
  const load = h('button', { class: 'accent-btn small', text: t('Load collection'), onclick: async () => {
    if (key) S.bg.unsplashKey = key.value.trim();
    S.bg.collections = col.value.trim();
    S.bg.type = 'unsplash';
    if (key && !S.bg.unsplashKey) return Motion.shake(key.parentElement);
    if (!S.bg.collections) return Motion.shake(col.parentElement);
    save();
    C.photosFrom = '';
    status.textContent = t('Loading…');
    try {
      const n = await Bg.loadCollection();
      status.textContent = `${n} ${t('photos loaded')}`;
      UI.toast(`${n} ${t('photos loaded')}`);
    } catch (e) {
      status.textContent = e.message;
      UI.toast(e.message, true);
      Motion.shake(load);
    }
  } });
  return h('div', { class: 'set-group' },
    h('label', { text: t('Collection') }), h('div', { class: 'text-in inset' }, col),
    key ? h('label', { text: 'Unsplash Access Key' }) : null,
    key ? h('div', { class: 'text-in inset' }, key) : null,
    key ? h('div', { class: 'set-hint' }, t('Free, takes a minute: '), h('a', { href: 'https://unsplash.com/oauth/applications', target: '_blank', text: 'unsplash.com/oauth/applications' })) : null,
    h('div', { class: 'set-line' }, load),
    status);
}

/* ---------- local files ---------- */
function buildFiles() {
  const strip = h('div', { class: 'thumbs' });
  const refresh = async () => {
    const all = await Idb.all().catch(() => []);
    strip.replaceChildren(...all.map(f => {
      const url = URL.createObjectURL(f.blob);
      return h('div', { class: 'thumb raised' }, h('img', { src: url, alt: '' }),
        h('button', { title: t('Delete'), onclick: async () => { await Idb.del(f.id); refresh(); Bg.render(true); } }, icon('E711')));
    }));
  };
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async () => {
    for (const f of input.files) await Idb.put({ id: 'f' + Date.now() + Math.random(), blob: f });
    input.value = '';
    await refresh();
    Bg.render(true);
  } });
  refresh();
  return h('div', { class: 'set-group' }, h('button', { class: 'raised-btn small', onclick: () => input.click() }, icon('E710'), h('span', { text: t('Add images') })), input, strip);
}

/* ---------- link tools ---------- */
function buildLinkList() {
  const row = (l, nested) => h('div', { class: 'link-row' + (nested ? ' nested' : '') },
    h('span', { class: 'well' + (l.items ? ' mosaic' : '') }, l.items ? l.items.slice(0, 4).map(x => Links.iconNode(x)) : Links.iconNode(l)),
    h('button', { class: 'link-main no-press', title: t('Edit'), onclick: () => Links.edit(l) },
      h('b', { text: l.title }), h('small', { text: l.items ? `${l.items.length} links` : l.url.replace(/^https?:\/\/(www\.)?/, '') })),
    h('button', { class: 'ghost square', title: t('Edit'), onclick: () => Links.edit(l) }, icon('E70F')),
    h('button', { class: 'ghost square', title: t('Delete'), onclick: () => Links.remove(l.id) }, icon('E74D')));
  const groups = S.links.groups.filter(g => g.type === 'links');
  const out = groups.flatMap(g => {
    const items = S.links.items.filter(l => (l.group || 'Default') === g.name);
    return [groups.length > 1 ? h('div', { class: 'link-group', text: g.name === 'Default' ? t('Default') : g.name }) : null,
      ...items.flatMap(l => [row(l), ...(l.items || []).map(x => row(x, true))])];
  }).filter(Boolean);
  return h('div', { class: 'link-list' }, S.links.items.length ? out : h('div', { class: 'set-hint', text: t('No links yet. Add your first one above.') }));
}

function buildLinkTools() {
  return h('div', { class: 'set-line' },
    h('button', { class: 'accent-btn small', onclick: () => Links.edit() }, icon('E710'), h('span', { text: t('Add link') })),
    h('button', { class: 'raised-btn small', onclick: importBookmarks }, icon('E8A4'), h('span', { text: t('Import bookmarks') })),
    h('button', { class: 'raised-btn small', onclick: saveTabs }, icon('E737'), h('span', { text: t('Save open tabs') })));
}

// keeps every open tab as a new group of links, so a whole session can be closed and reopened later
async function saveTabs() {
  if (!(await askPermission({ permissions: ['tabs'] }))) return UI.toast(t('Permission was not granted'), true);
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(x => /^https?:/.test(x.url));
  if (!tabs.length) return UI.toast(t('No open tabs to save'), true);
  const name = `${t('Tabs')} ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
  if (!S.links.groups.some(g => g.name === name)) S.links.groups.push({ name, type: 'links' });
  tabs.forEach((x, i) => S.links.items.push({ id: `s${Date.now()}${i}`, title: x.title || x.url, url: x.url, group: name }));
  S.links.groupson = true;
  S.links.selected = name;
  save();
  Links.build(true);
  Settings.rebuild();
  UI.toast(`${tabs.length} ${t('links added')}`);
}

async function importBookmarks() {
  if (!(await askPermission({ permissions: ['bookmarks'] })) || !chrome.bookmarks) return UI.toast(t('Permission was not granted'), true);
  const tree = await chrome.bookmarks.getTree();
  const checks = [];
  const walk = (nodes, depth) => nodes.flatMap(n => {
    if (n.url) {
      const box = h('input', { type: 'checkbox' });
      checks.push({ box, n });
      return [h('label', { class: 'bm', style: `padding-inline-start:${depth * 14}px` }, box, h('span', { text: n.title || n.url }))];
    }
    return [n.title ? h('div', { class: 'bm-folder', style: `padding-inline-start:${depth * 14}px`, text: n.title }) : null, ...walk(n.children || [], depth + (n.title ? 1 : 0))];
  });
  UI.modal((box, close) => box.append(
    h('h2', { text: t('Import bookmarks') }),
    h('div', { class: 'bm-list inset' }, walk(tree, 0)),
    h('div', { class: 'actions' },
      h('button', { class: 'raised-btn', text: t('Cancel'), onclick: close }),
      h('button', { class: 'accent-btn', text: t('Import'), onclick: () => {
        const group = Links.current().type === 'links' ? Links.current().name : 'Default';
        const picked = checks.filter(c => c.box.checked);
        picked.forEach((c, i) => S.links.items.push({ id: `b${Date.now()}${i}`, title: c.n.title || c.n.url, url: c.n.url, group }));
        save();
        close();
        Links.build(true);
        idle(() => tintLinks());
        UI.toast(`${picked.length} ${t('links added')}`);
      } })),
  ));
}

function buildGroups(sec) {
  const list = h('div', { class: 'chips' }, S.links.groups.map(g => h('div', { class: 'chip raised' },
    h('span', { text: g.name === 'Default' ? t('Default') : g.name }),
    g.name === 'Default' ? null : h('button', { title: t('Delete'), onclick: () => {
      S.links.groups = S.links.groups.filter(x => x !== g);
      for (const l of S.links.items) if (l.group === g.name) l.group = 'Default';
      if (S.links.selected === g.name) S.links.selected = 'Default';
      Settings.changed(sec);
      Settings.rebuild();
    } }, icon('E711')))));
  const add = group => {
    if (S.links.groups.some(x => x.name === group.name)) return UI.toast(t('That group already exists'), true);
    S.links.groups.push(group);
    S.links.selected = group.name;
    Settings.changed(sec);
    Links.refreshSynced();
    Settings.rebuild();
  };
  const name = h('input', { type: 'text', placeholder: t('New group') });
  return h('div', { class: 'set-group' }, list,
    h('div', { class: 'set-line' }, h('div', { class: 'text-in inset grow' }, name),
      h('button', { class: 'raised-btn small', text: t('Add'), onclick: () => { const n = name.value.trim(); if (!n) return Motion.shake(name.parentElement); add({ name: n, type: 'links' }); } })),
    h('div', { class: 'set-line' },
      h('button', { class: 'raised-btn small', text: t('Most visited'), onclick: async () => { if (await askPermission({ permissions: ['topSites'] })) add({ name: t('Most visited'), type: 'topsites' }); } }),
      h('button', { class: 'raised-btn small', text: t('Bookmarks folder'), onclick: async e => {
        if (!(await askPermission({ permissions: ['bookmarks'] }))) return;
        const flat = [], walk = ns => ns.forEach(n => { if (!n.url) { if (n.title) flat.push(n); walk(n.children || []); } });
        walk(await chrome.bookmarks.getTree());
        const r = e.target.getBoundingClientRect();
        UI.menu(r.left, r.bottom + 4, flat.map(f => ({ label: f.title, run: () => add({ name: f.title, type: 'bookmarks', folderId: f.id }) })));
      } })));
}

/* ---------- time zones + world clocks ---------- */
function tzPicker(value, onChange, withAuto) {
  const zones = Intl.supportedValuesOf('timeZone');
  const id = 'tz' + Math.random().toString(36).slice(2);
  const input = h('input', { type: 'text', value: value === 'auto' ? '' : value, placeholder: withAuto ? t('Automatic') : 'Europe/Copenhagen', spellcheck: false });
  input.setAttribute('list', id);
  input.addEventListener('change', () => {
    const v = input.value.trim();
    if (!v && withAuto) return onChange('auto');
    if (!zones.includes(v)) return Motion.shake(input.parentElement);
    onChange(v);
  });
  return h('div', { class: 'text-in inset' }, input, h('datalist', { id }, zones.map(z => h('option', { value: z }))));
}

function buildWorld(sec) {
  const box = h('div', { class: 'set-group' });
  const draw = () => {
    box.replaceChildren(...S.clock.world.map((w, i) => h('div', { class: 'set-line' },
      h('div', { class: 'text-in inset grow' }, h('input', { type: 'text', value: w.region, placeholder: t('Region'), onchange: e => { w.region = e.target.value; Settings.changed(sec); } })),
      h('div', { class: 'grow' }, tzPicker(w.timezone, v => { w.timezone = v; Settings.changed(sec); })),
      h('button', { class: 'ghost square', title: t('Delete'), onclick: () => { S.clock.world.splice(i, 1); Settings.changed(sec); draw(); } }, icon('E74D')))),
      h('button', { class: 'raised-btn small', onclick: () => { S.clock.world.push({ region: 'Tokyo', timezone: 'Asia/Tokyo' }); Settings.changed(sec); draw(); } }, icon('E710'), h('span', { text: t('Add') })));
  };
  draw();
  return box;
}

function buildCity(sec) {
  const input = h('input', { type: 'text', value: S.weather.city, placeholder: 'Copenhagen', spellcheck: false });
  const find = async () => {
    const q = input.value.trim();
    if (!q) return Motion.shake(input.parentElement);
    const list = await geocode(q).catch(() => []);
    if (!list.length) { UI.toast(t('No matching location'), true); return Motion.shake(input.parentElement); }
    const r = input.getBoundingClientRect();
    UI.menu(r.left, r.bottom + 6, list.map(x => ({ label: [x.name, x.admin1, x.country].filter(Boolean).join(', '), run: () => {
      Object.assign(S.weather, { city: x.name, lat: x.latitude, lon: x.longitude });
      input.value = x.name;
      save();
      Weather.refresh(true);
    } })));
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
  return h('div', { class: 'set-line' }, h('div', { class: 'text-in inset grow' }, input), h('button', { class: 'raised-btn small', onclick: find }, icon('E721')));
}

/* ---------- profiles ---------- */
function buildProfiles() {
  const box = h('div', { class: 'set-group' });
  const draw = () => {
    const list = Profiles.list(), active = Profiles.active();
    const persist = () => { Profiles.store(list); Sync.schedule(); };
    const name = h('input', { type: 'text', placeholder: t('Work, Home, Gaming…') });
    box.replaceChildren(
      ...list.map(p => h('div', { class: 'profile raised' + (p.id === active ? ' on' : '') },
        h('div', { class: 'set-line' },
          h('button', { class: p.id === active ? 'accent-btn small grow' : 'raised-btn small grow', text: p.name, onclick: () => {
            if (p.id === active) return;
            Profiles.apply(p.id);
            Page.renderAll(true);
            Bg.render(false);
            Settings.rebuild();
            UI.toast(`${p.name}`);
          } }),
          h('button', { class: 'ghost square', title: t('Delete'), onclick: () => UI.confirm(t('Delete this profile?'), p.name, t('Delete'), () => {
            Profiles.store(Profiles.list().filter(x => x.id !== p.id));
            if (p.id === active) localStorage.removeItem('fs.profile');
            Sync.schedule();
            draw();
          }) }, icon('E74D'))),
        h('div', { class: 'set-line profile-time' },
          h('span', { text: t('Auto from') }), h('input', { type: 'time', class: 'inset', value: p.from || '', onchange: e => { p.from = e.target.value; persist(); } }),
          h('span', { text: t('to') }), h('input', { type: 'time', class: 'inset', value: p.to || '', onchange: e => { p.to = e.target.value; persist(); } })))),
      h('div', { class: 'set-line' }, h('div', { class: 'text-in inset grow' }, name),
        h('button', { class: 'raised-btn small', text: t('Save current'), onclick: () => {
          const n = name.value.trim();
          if (!n) return Motion.shake(name.parentElement);
          const id = 'p' + Date.now();
          Profiles.store([...Profiles.list(), { id, name: n, state: structuredClone(S), from: '', to: '' }]);
          localStorage.setItem('fs.profile', id);
          Sync.schedule();
          draw();
          Motion.popIn(box.children[Profiles.list().length - 1]);
        } })),
      h('div', { class: 'set-hint', text: t('A profile keeps the whole setup: links, background, widgets and layout. Changes save into the active profile.') }));
  };
  draw();
  return box;
}

/* ---------- import / export / sync ---------- */
const exportable = () => { const c = structuredClone(S); c.bg.unsplashKey = ''; return c; };
function importState(data) {
  const next = data.state || data;
  if (!isObj(next) || !('clock' in next || 'links' in next)) throw new Error(t('That is not a Kufu settings file'));
  const ownKey = S.bg.unsplashKey;
  S = migrate(next);
  S.bg.unsplashKey ||= ownKey;
  save();
  Page.renderAll(true);
  Bg.render(true);
  Settings.rebuild();
  UI.toast(t('Settings imported'));
}
function buildManagement() {
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    try { importState(JSON.parse(await file.files[0].text())); } catch (e) { UI.toast(e.message, true); }
    file.value = '';
  } });
  const url = h('input', { type: 'text', placeholder: 'https://…/settings.json', spellcheck: false });
  const token = h('input', { type: 'password', value: localStorage.getItem('fs.gist') || '', placeholder: t('GitHub token with gist scope'), autocomplete: 'off', onchange: () => localStorage.setItem('fs.gist', token.value.trim()) });
  const gistBox = h('div', { class: 'set-group' },
    h('div', { class: 'text-in inset' }, token),
    h('div', { class: 'set-line' },
      h('button', { class: 'raised-btn small', text: t('Back up to Gist'), onclick: gistPush }),
      h('button', { class: 'raised-btn small', text: t('Restore from Gist'), onclick: gistPull })));
  gistBox.hidden = S.sync.type !== 'gist';
  return h('div', { class: 'set-group' },
    h('label', { text: t('Synchronization type') }),
    UI.seg([{ value: 'browser', label: t('Chrome account') }, { value: 'gist', label: 'GitHub Gist' }, { value: 'off', label: t('Off') }], S.sync.type, v => { S.sync.type = v; save(); gistBox.hidden = v !== 'gist'; }, 'fill'),
    gistBox,
    h('div', { class: 'set-line' },
      h('button', { class: 'raised-btn small', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(exportable(), null, 2)], { type: 'application/json' })), download: 'kufu-settings.json' });
        a.click();
        URL.revokeObjectURL(a.href);
      } }, icon('E896'), h('span', { text: t('Export') })),
      h('button', { class: 'raised-btn small', onclick: () => file.click() }, icon('E898'), h('span', { text: t('Import') })),
      h('button', { class: 'raised-btn small', onclick: () => { navigator.clipboard.writeText(JSON.stringify(exportable())); UI.toast(t('Copied')); } }, icon('E8C8'), h('span', { text: t('Copy') })), file),
    h('div', { class: 'set-line' }, h('div', { class: 'text-in inset grow' }, url),
      h('button', { class: 'raised-btn small', text: t('Load'), onclick: async () => {
        try { importState(await (await fetch(url.value.trim())).json()); } catch (e) { UI.toast(e.message, true); Motion.shake(url.parentElement); }
      } })),
    h('button', { class: 'ghost small danger', onclick: () => UI.confirm(t('Reset all settings'), t('Links, background and widgets go back to the defaults. Profiles are kept.'), t('Reset'), () => {
      S = structuredClone(DEFAULTS);
      localStorage.removeItem('fs.profile');
      save();
      Page.renderAll(true);
      Bg.render(true);
      Settings.rebuild();
    }) }, icon('E74D'), h('span', { text: t('Reset all settings') })));
}
async function gistRequest(method, path, body) {
  const token = localStorage.getItem('fs.gist');
  if (!token) throw new Error(t('Add a GitHub token first'));
  const r = await fetch(`https://api.github.com/gists${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub: ${r.status}`);
  return r.json();
}
async function gistPush() {
  try {
    const files = { 'kufu.json': { content: JSON.stringify(exportable()) } };
    const res = S.sync.gistId ? await gistRequest('PATCH', `/${S.sync.gistId}`, { files }) : await gistRequest('POST', '', { description: 'Kufu settings', public: false, files });
    S.sync.gistId = res.id;
    save();
    UI.toast(t('Backed up'));
  } catch (e) { UI.toast(e.message, true); }
}
async function gistPull() {
  try {
    if (!S.sync.gistId) {
      const all = await gistRequest('GET', '');
      S.sync.gistId = all.find(g => g.files['kufu.json'])?.id || '';
      if (!S.sync.gistId) throw new Error(t('No backup found'));
    }
    const res = await gistRequest('GET', `/${S.sync.gistId}`);
    importState(JSON.parse(res.files['kufu.json'].content));
  } catch (e) { UI.toast(e.message, true); }
}

globalThis.Settings = Settings;
