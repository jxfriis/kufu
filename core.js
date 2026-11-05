'use strict';
// Runs in <head>, before anything paints. Everything needed for the first frame comes from localStorage,
// which is synchronous; chrome.storage only ever talks to other devices, in the background, after paint.

const $ = id => document.getElementById(id);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

const icon = code => h('i', { class: 'icon', html: `&#x${code};` });

// Everything on the page lives in one of these zones.
const ZONES = ['tl', 'tc', 'tr', 'l', 'center', 'r', 'bl', 'bc', 'br'];
const PRESETS = {
  centered: { tl: [], tc: [], tr: ['weather', 'countdown'], l: ['pomodoro', 'tasks', 'ambient'], center: ['clock', 'date', 'greeting', 'search', 'links'], r: ['notes', 'progress'], bl: [], bc: ['quote'], br: [] },
  dashboard: { tl: [], tc: [], tr: [], l: ['weather', 'pomodoro', 'ambient'], center: ['clock', 'date', 'greeting', 'search', 'links'], r: ['quote', 'notes', 'tasks', 'countdown', 'progress'], bl: [], bc: [], br: [] },
  dock: { tl: ['weather'], tc: [], tr: ['quote', 'countdown'], l: ['pomodoro', 'tasks', 'ambient'], center: ['clock', 'date', 'greeting', 'search'], r: ['notes', 'progress'], bl: [], bc: ['links'], br: [] },
  minimal: { tl: [], tc: [], tr: ['weather'], l: ['pomodoro', 'tasks', 'ambient'], center: ['clock', 'date', 'greeting', 'search'], r: ['notes', 'progress', 'countdown'], bl: ['quote'], bc: ['links'], br: [] },
};

const DEFAULTS = {
  rev: 0,
  layoutV: 2,
  glassClear: true,
  lang: 'auto',
  accent: '',
  style: 'keys',
  surface: { mode: 'solid', opacity: 70, blur: 16, refraction: 60 },
  uiScale: 100,
  widgetOpacity: 100,
  palette: true,
  dark: 'dark',
  showall: false,
  reduceMotion: false,
  hideGear: false,
  tabtitle: '',
  favicon: '',
  css: '',
  page: { width: 1920, gap: 14 },
  font: { family: '', local: false, size: 13, weight: '', color: '', shadow: 0, shadowOn: false, shadowA: .5, shadowBlur: 6, shadowY: 2, shadowColor: '#000000' },
  bg: {
    type: 'friis', frequency: 'hour', blur: 0, fade: 400, color: '#0A0B0D', mute: true,
    unsplashKey: '', collections: '', urls: '', videos: '',
    dim: 0, grain: 20,
  },
  clock: {
    on: true, style: 'tiles', ampm: false, ampmlabel: true, seconds: false, size: 100, timezone: 'auto',
    color: '', analog: false, shape: 'round', face: 'marks', hands: 'modern', dialbg: '', dialborder: '',
    worldon: false, world: [], blink: false, seam: true, weight: 0, glassfrost: 0, glassrefraction: 60,
  },
  date: { on: true, style: 'rail', format: 'auto', week: true, weeknum: false, firstday: 'auto' },
  greeting: { on: true, design: 'classic', namecolor: '', weather: true, name: '', size: 34, mode: 'auto', sub: 'smart', subtext: '', icon: true, morning: '', afternoon: '', evening: '', night: '' },
  weather: {
    on: true, size: 'compact', iconstyle: 'soft', details: true, geo: 'approximate', city: '', lat: null, lon: null, unit: 'metric', showunit: true,
    forecast: 'always', temperature: 'actual', moreinfo: 'none', provider: '', hidedesc: false, hideicon: false,
  },
  search: { on: true, engine: 'default', request: '', newtab: false, suggestions: false, placeholder: '', width: 100, height: 46, opacity: 100, bangs: true, switcher: true },
  quotes: { on: true, type: 'classic', author: true, frequency: 'day', user: '', url: '', favs: [] },
  notes: { on: false, align: 'left', width: 100, opacity: 100, text: '' },
  pomodoro: { on: false, sound: true, alarm: 'bell', volume: 60, focus: 25, short: 5, long: 15, stats: true },
  tasks: { on: false, items: [] },
  ambient: { on: false, sound: 'rain', volume: 40, withpomo: false },
  countdown: { on: false, title: '', date: '' },
  progress: { on: false, day: true, week: true, month: false, year: true },
  links: {
    on: true, style: 'large', newtab: false, titles: true, backgrounds: true, radius: 14, row: 7,
    groupson: false, selected: 'Default',
    groups: [{ name: 'Default', type: 'links' }],
    items: [
      { id: 'l1', title: 'Gmail', url: 'https://mail.google.com', group: 'Default' },
      { id: 'l2', title: 'YouTube', url: 'https://www.youtube.com', group: 'Default' },
      { id: 'l3', title: 'GitHub', url: 'https://github.com', group: 'Default' },
      { id: 'l4', title: 'Claude', url: 'https://claude.ai', group: 'Default' },
      { id: 'l5', title: 'Spotify', url: 'https://open.spotify.com', group: 'Default' },
      { id: 'l6', title: 'Unsplash', url: 'https://unsplash.com', group: 'Default' },
    ],
  },
  layout: { preset: 'centered', zones: PRESETS.centered },
  sync: { type: 'browser', gistId: '' },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(def, val) {
  if (!isObj(def) || !isObj(val)) return val === undefined ? structuredClone(def) : val;
  const out = {};
  for (const k of new Set([...Object.keys(def), ...Object.keys(val)])) out[k] = merge(def[k], val[k]);
  return out;
}

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }

// Setups saved before zones existed move to the new layout.
function migrate(raw) {
  const next = merge(DEFAULTS, raw || {});
  if (raw && !raw.layoutV) {
    next.page.width = 1920;
    next.links.row = 7;
    next.greeting.size = 34;
    delete next.layout.cols; delete next.layout.mode; delete next.layout.align;
  }
  if (next.style === 'pop') next.style = 'clay';
  if (raw && !raw.glassClear && next.style === 'glass') next.surface.mode = 'translucent';
  next.glassClear = true;
  if (next.style === 'glass' && !['translucent', 'glass'].includes(next.surface.mode)) next.surface.mode = 'translucent';
  next.font.shadow = 0;
  // the old texture and brightness settings become grain and dim, once
  if (raw?.bg && raw.bg.grain === undefined) {
    const old = raw.bg.texture;
    next.bg.grain = old?.type === 'grain' ? Math.min(100, Math.round(old.opacity * 200)) : old ? 0 : 20;
    next.bg.dim = Math.max(0, 100 - (raw.bg.bright ?? 100));
  }
  delete next.bg.texture;
  delete next.bg.bright;
  // setups from when the clock and calendar were fixed keep them exactly where they were
  const zones = next.layout.zones;
  for (const id of ['date', 'clock']) if (!ZONES.some(z => zones[z]?.includes(id))) zones.center = [id, ...(zones.center || [])];
  next.layoutV = 2;
  return next;
}
let S = migrate(readJSON('fs.state'));
// C is per-device: caches and timers that never sync.
const C = readJSON('fs.cache') || {};
const saveCache = () => writeJSON('fs.cache', C);

const getPath = (path, from = S) => path.split('.').reduce((o, k) => o?.[k], from);
function setPath(path, value, into = S) {
  const keys = path.split('.'), last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), into)[last] = value;
}

let onSaved = () => {};
function save() {
  S.rev = Date.now();
  writeJSON('fs.state', S);
  Profiles.touch();
  onSaved();
  Sync.schedule();
}

/* ---------- profiles: whole setups you can switch between ---------- */
const Profiles = {
  list: () => readJSON('fs.profiles') || [],
  store(list) {
    writeJSON('fs.profiles', list);
    localStorage.setItem('fs.timed', list.some(p => p.from && p.to) ? '1' : '0');
  },
  active: () => localStorage.getItem('fs.profile') || '',
  touch() {
    const id = this.active();
    if (!id) return;
    const list = this.list(), p = list.find(x => x.id === id);
    if (p) { p.state = S; this.store(list); }
  },
  apply(id) {
    const p = this.list().find(x => x.id === id);
    if (!p) return false;
    S = migrate(p.state);
    localStorage.setItem('fs.profile', id);
    writeJSON('fs.state', S);
    return true;
  },
  // A timed profile only takes over when its window opens, so a manual pick holds until the next one starts.
  auto() {
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const toMins = s => { const [a, b] = s.split(':'); return +a * 60 + +b; };
    const inside = p => {
      if (!p.from || !p.to) return false;
      const f = toMins(p.from), t = toMins(p.to);
      return f <= t ? mins >= f && mins < t : mins >= f || mins < t;
    };
    if (localStorage.getItem('fs.timed') === '0' && !localStorage.getItem('fs.profileAuto')) return;
    const match = this.list().find(inside);
    const last = localStorage.getItem('fs.profileAuto') || '';
    if ((match?.id || '') === last) return;
    localStorage.setItem('fs.profileAuto', match?.id || '');
    if (match && match.id !== this.active()) this.apply(match.id);
  },
};
Profiles.auto();

/* ---------- translations: one file per language, keyed by the English text ---------- */
const LANGS = { en: 'English', da: 'Dansk', de: 'Deutsch', es: 'Español', fr: 'Français', ja: '日本語', ko: '한국어', 'pt-BR': 'Português (Brasil)', 'zh-CN': '简体中文' };
const LANG_ALIAS = { pt: 'pt-BR', zh: 'zh-CN' };
function resolveLang() {
  if (S.lang !== 'auto' && LANGS[S.lang]) return S.lang;   // a language that was since removed falls back to the browser's
  const nav = navigator.language || 'en', base = nav.split('-')[0];
  return LANGS[nav] ? nav : LANGS[base] ? base : LANG_ALIAS[base] || 'en';
}
let LANG = resolveLang();
let TR = LANG === 'en' ? null : (readJSON('fs.tr') || {});
const I18N_VERSION = 13;   // raise when i18n/ changes, so saved copies refresh
if (TR && (TR.lang !== LANG || TR.v !== I18N_VERSION)) TR = null;
const t = s => TR?.[s] || s;
async function loadTranslations() {
  LANG = resolveLang();
  if (LANG === 'en') { TR = null; localStorage.removeItem('fs.tr'); return false; }
  if (TR?.lang === LANG) return false;
  try {
    TR = await (await fetch(`i18n/${LANG}.json`)).json();
    TR.lang = LANG;
    TR.v = I18N_VERSION;
    writeJSON('fs.tr', TR);
    return true;
  } catch { return false; }
}

/* ---------- theme + page-wide settings ---------- */
function isNight() {
  const d = C.weather?.data?.daily, now = Date.now();
  if (d?.sunrise?.[0]) {
    const up = +new Date(d.sunrise[0]), down = +new Date(d.sunset[0]);
    if (now - up < 864e5 && now > up - 864e5) return now < up || now > down;
  }
  const hour = new Date().getHours();
  return hour < 7 || hour >= 19;
}
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

// A design's stylesheet joins the page before first paint; the default design has none to fetch.
const DESIGNS = ['paper', 'glass', 'clay'];
if (DESIGNS.includes(S.style)) document.write(`<link rel="stylesheet" href="design-${S.style}.css">`);
function loadDesign(name) {
  if (DESIGNS.includes(name) && !document.querySelector(`link[href="design-${name}.css"]`)) document.head.append(h('link', { rel: 'stylesheet', href: `design-${name}.css` }));
}

const VAR_HOME = {
  '--clock-base': () => Clock.el, '--clock-weight': () => Clock.el, '--clock-color': () => Clock.el, '--greeting-size': () => Greeting.el,
  '--search-width': () => Search.el, '--search-height': () => Search.el, '--search-opacity': () => Search.el,
  '--notes-width': () => Notes.el, '--notes-opacity': () => Notes.el, '--key-row': () => Links.el,
};
const varsNow = new Map();
function setVar(name, value) {
  let target = document.documentElement;
  // the widgets don't exist yet during the very first call, so those first values go on the root
  if (VAR_HOME[name]) { try { target = VAR_HOME[name]() || target; } catch {} }
  const now = varsNow.get(name);
  if (now && now.target === target && now.value === value) return;
  varsNow.set(name, { target, value });
  if (value == null) target.style.removeProperty(name); else target.style.setProperty(name, value);
}

function applyPage() {
  const gear = $('gear'); if (gear) gear.title = t('Settings') + ' (Esc)';
  loadDesign(S.style);
  const root = document.documentElement, st = root.style;
  const dark = S.dark === 'dark' || (S.dark === 'system' && systemDark()) || (S.dark === 'auto' && isNight());
  if (root.dataset.theme !== (dark ? 'dark' : 'light')) root.dataset.theme = dark ? 'dark' : 'light';
  root.lang = LANG;
  root.dir = ['ar', 'fa', 'he'].includes(LANG) ? 'rtl' : 'ltr';
  const title = S.tabtitle || t('New tab');
  if (document.title !== title) document.title = title;
  setVar('--page-width', S.page.width + 'px');
  setVar('--page-gap', S.page.gap + 'px');
  setVar('--font-size', S.font.size + 'px');
  setVar('--font-family', `"${S.font.family || 'Sunghyun Sans'}", `);
  setVar('--font-weight', S.font.weight || 'inherit');
  setVar('--text-color', S.font.color || 'unset');
  setVar('--text-shadow', S.font.shadow ? `0 1px ${Math.round(S.font.shadow * 14)}px rgba(0,0,0,${S.font.shadow + .2})` : 'none');
  root.toggleAttribute('data-shadow', S.font.shadowOn);
  if (S.font.shadowOn) setVar('--custom-shadow', S.font.shadowA ? `0 ${S.font.shadowY}px ${S.font.shadowBlur}px color-mix(in srgb, ${S.font.shadowColor} ${Math.round(S.font.shadowA * 100)}%, transparent)` : 'none');
  setVar('--key-radius', S.links.radius + 'px');
  setVar('--key-row', S.links.row);
  root.toggleAttribute('data-clockweight', S.clock.weight > 0);
  setVar('--clock-weight', S.clock.weight || 700);
  setVar('--clock-base', S.clock.size / 100);
  const clockTint = S.clock.color && S.style !== 'glass' && S.clock.style !== 'glass';
  root.toggleAttribute('data-clockcolor', !!clockTint);
  if (clockTint) setVar('--clock-color', S.clock.color);
  setVar('--greeting-size', S.greeting.size + 'px');
  setVar('--search-width', S.search.width + '%');
  setVar('--search-height', S.search.height + 'px');
  setVar('--search-opacity', S.search.opacity / 100);
  setVar('--notes-width', S.notes.width + '%');
  setVar('--notes-opacity', S.notes.opacity / 100);
  setVar('--ui-zoom', S.uiScale / 100);
  setVar('--widget-opacity', S.widgetOpacity / 100);
  if (root.dataset.style !== S.style) root.dataset.style = S.style;
  const nc = S.greeting.namecolor;
  setVar('--g-name', nc ? (nc === 'plain' ? 'currentColor' : nc) : null);
  const surf = S.surface;
  root.toggleAttribute('data-clear', surf.mode !== 'solid');
  root.toggleAttribute('data-blur', surf.mode === 'glass' || (S.style === 'glass' && surf.mode !== 'transparent'));
  setVar('--sf', surf.mode === 'solid' ? 1 : surf.mode === 'transparent' ? 0 : surf.opacity / 100);
  setVar('--surf-blur', S.style === 'glass' && surf.mode !== 'glass' ? '0px' : surf.blur + 'px');
  root.toggleAttribute('data-plainaccent', S.accent === 'plain');
  root.toggleAttribute('data-blink', S.clock.blink);
  root.toggleAttribute('data-noseam', !S.clock.seam);
  const white = S.accent === 'plain', A = white ? '#FFFFFF' : S.accent, mix = (c, n) => `color-mix(in srgb, ${A} ${n}%, ${c})`;
  const accents = A ? { '--accent': A, '--accent-text': white ? 'var(--text)' : mix('#fff', 62), '--accent-fill': `linear-gradient(${mix('#fff', 84)}, ${A})`, '--accent-fill-hover': `linear-gradient(${mix('#fff', 74)}, ${mix('#fff', 92)})`, '--accent-edge': `linear-gradient(${mix('#fff', 56)} 0%, ${A} 40%, ${mix('#000', 55)} 100%)` } : null;
  for (const k of ['--accent', '--accent-text', '--accent-fill', '--accent-fill-hover', '--accent-edge']) accents ? st.setProperty(k, accents[k]) : st.removeProperty(k);

  const custom = document.getElementById('customcss') || document.head.appendChild(h('style', { id: 'customcss' }));
  if (custom.textContent !== S.css) custom.textContent = S.css;

  const fontId = 'gfont', old = document.getElementById(fontId), family = S.font.family;
  const fontHref = family && !S.font.local ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}${C.fontPlain?.[family] ? '' : ':wght@300;400;500;600;700'}&display=swap` : '';
  if (old && old.getAttribute('href') !== fontHref) old.remove();
  if (fontHref && !document.getElementById(fontId)) {
    document.head.append(h('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: '' }));
    document.head.append(h('link', { id: fontId, rel: 'stylesheet', href: fontHref, onerror: () => {
      // not every font has all those weights: remember it, and ask for the font itself
      if (C.fontPlain?.[family]) return;
      (C.fontPlain ||= {})[family] = true;
      saveCache();
      applyPage();
    } }));
  }

  const fav = document.querySelector('link[rel=icon]');
  const href = S.favicon
    ? (/^https?:|^data:/.test(S.favicon) ? S.favicon : `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="88">${S.favicon}</text></svg>`)}`)
    : 'icons/icon-48.png';
  if (fav.getAttribute('href') !== href) fav.setAttribute('href', href);
}
applyPage();
if (S.bg.type === 'unsplash') document.head.append(h('link', { rel: 'preconnect', href: 'https://images.unsplash.com' }));

// Respect the system's and the user's "less motion" wish everywhere, in one place.
function applyMotionPref() {
  const reduced = S.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.toggleAttribute('data-reduce', reduced);
  Motion.reduced = reduced;
  if (typeof MotionPlain !== 'undefined') applyMotionProfile();
}

const MotionPlain = { ...Motion, Ease: { ...Motion.Ease } };
let MotionLiquid = null;
// the glass spring: perceptual duration and bounce, solved exactly and sampled into a CSS linear() easing
function liquidSpring(duration, bounce) {
  const w = 2 * Math.PI / duration, z = 1 - bounce, wd = w * Math.sqrt(Math.max(1 - z * z, 0));
  const at = t => (bounce === 0 ? 1 - Math.exp(-w * t) * (1 + w * t) : 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)));
  let end = duration;
  while (end < duration * 6 && Math.abs(1 - at(end)) > .002) end += duration / 8;
  const n = 48, points = [];
  for (let i = 0; i <= n; i++) points.push(+at(end * i / n).toFixed(4));
  points[n] = 1;
  return { ms: Math.round(end * 1000), ease: `linear(${points.join(', ')})` };
}
function buildLiquidMotion() {
  const press = liquidSpring(.24, .2), release = liquidSpring(.5, .42), morph = liquidSpring(.42, .18), layout = liquidSpring(.4, .16);
  const { to, fromTo } = Motion;
  return {
    Ease: { ...MotionPlain.Ease, spring: release.ease, bouncy: layout.ease, back: morph.ease, settle: layout.ease },
    // glass grows under a press rather than squashing, by the same amount on any size
    press(el) {
      const grow = Math.min(.16, 8 / Math.max(el.offsetWidth || 1, el.offsetHeight || 1));
      el.style.setProperty('--lg-glow', 1);
      return to(el, 'scale', String(1 + grow), press.ms, press.ease);
    },
    springBack(el) {
      el.style.removeProperty('--lg-glow');
      return to(el, 'scale', '1', release.ms, release.ease);
    },
    pop: (el, from = .94) => fromTo(el, 'scale', String(from), '1', release.ms, release.ease),
    popIn(el, delay = 0) {
      fromTo(el, 'opacity', '0', '1', 140, 'linear', delay);
      fromTo(el, 'scale', '.86', '1', morph.ms, morph.ease, delay);
    },
    enter(el, dx, dy, delay = 0) {
      fromTo(el, 'opacity', '0', '1', 180, 'linear', delay);
      fromTo(el, 'translate', `${dx}px ${dy}px`, '0px 0px', layout.ms, layout.ease, delay);
    },
    shake: MotionPlain.shake,
    fadeOut(el, done) {
      to(el, 'scale', '.94', 170, MotionPlain.Ease.quick);
      return MotionPlain.fadeOut(el, done);
    },
    size: (el, prop, px) => to(el, prop, `${px}px`, layout.ms, layout.ease),
    slideX: (el, px) => to(el, 'translate', `${px}px 0px`, layout.ms, layout.ease),
  };
}
function applyMotionProfile() {
  const impl = S.style === 'glass' ? (MotionLiquid ||= buildLiquidMotion()) : MotionPlain;
  for (const name of ['press', 'springBack', 'fadeOut', 'size', 'slideX']) Motion[name] = impl[name];
  for (const name of ['enter', 'popIn', 'pop', 'shake']) {
    const real = impl[name];
    Motion[name] = (...a) => (Motion.reduced ? undefined : real(...a));
  }
  Object.assign(Motion.Ease, impl.Ease);
}
applyMotionPref();

/* ---------- sync across devices via the Chrome account (after paint, never blocks) ---------- */
const Sync = {
  timer: 0,
  chunk: 5000, // sync's 8 KB item limit counts escaped quotes, so leave room
  has: () => !!globalThis.chrome?.storage?.sync,
  schedule() {
    if (S.sync.type !== 'browser' || !this.has()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 2000);
  },
  payload() {
    return JSON.stringify({ state: S, profiles: Profiles.list() });
  },
  async push() {
    const json = this.payload(), parts = {};
    for (let i = 0; i * this.chunk < json.length; i++) parts['c' + i] = json.slice(i * this.chunk, (i + 1) * this.chunk);
    const count = Object.keys(parts).length;
    try {
      await chrome.storage.sync.set({ ...parts, n: count, rev: S.rev });
      const stale = await chrome.storage.sync.get(null);
      const extra = Object.keys(stale).filter(k => /^c\d+$/.test(k) && +k.slice(1) >= count);
      if (extra.length) await chrome.storage.sync.remove(extra);
    } catch (e) { console.warn('Sync failed', e); }
  },
  async pull(apply) {
    if (S.sync.type !== 'browser' || !this.has()) return;
    try {
      const all = await chrome.storage.sync.get(null);
      if (!all.n || all.rev <= S.rev) { if (!all.n && S.rev) this.schedule(); return; }
      let json = '';
      for (let i = 0; i < all.n; i++) json += all['c' + i] || '';
      const { state, profiles } = JSON.parse(json);
      S = migrate(state);
      writeJSON('fs.state', S);
      if (profiles) Profiles.store(profiles);
      apply();
    } catch (e) { console.warn('Sync read failed', e); }
  },
};

/* ---------- Friis UI pieces ---------- */
const UI = {
  toast(text, bad) {
    const el = h('div', { class: 'toast panel' + (bad ? ' bad' : '') }, icon(bad ? 'E783' : 'E73E'), h('span', { text }));
    $('toasts').append(el);
    Motion.enter(el, 0, 16);
    setTimeout(() => Motion.fadeOut(el), 2800);
  },

  modal(build) {
    const scrim = $('scrim');
    const close = () => {
      if (scrim.hidden) return;
      Motion.fadeOut(scrim, () => { scrim.hidden = true; scrim.style.opacity = ''; scrim.replaceChildren(); });
    };
    const box = h('div', { class: 'modal panel' });
    build(box, close);
    scrim.replaceChildren(box);
    scrim.style.opacity = '';
    scrim.hidden = false;
    scrim.onpointerdown = e => { if (e.target === scrim) close(); };
    Motion.popIn(box);
    return close;
  },

  confirm(title, lede, label, onYes) {
    UI.modal((box, close) => box.append(
      h('h2', { text: title }), h('p', { class: 'lede', text: lede }),
      h('div', { class: 'actions' },
        h('button', { class: 'raised-btn', text: t('Cancel'), onclick: close }),
        h('button', { class: 'accent-btn', text: label, onclick: () => { close(); onYes(); } })),
    ));
  },

  menu(x, y, items) {
    document.querySelector('.menu')?.remove();
    const m = h('div', { class: 'menu panel' }, items.filter(Boolean).map(it => h('button', {
      class: it.danger ? 'danger' : it.on ? 'on' : '',
      onclick: () => { close(); it.run(); },
    }, it.icon ? icon(it.icon) : null, h('span', { text: it.label }))));
    function close() { m.remove(); removeEventListener('pointerdown', away, true); removeEventListener('keydown', esc, true); }
    const away = e => { if (!m.contains(e.target)) close(); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    m.style.transformOrigin = 'left top';
    Motion.popIn(m);
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', esc, true);
    return m;
  },

  // Of these spots, in order of preference, the first that covers the least of what's on the page.
  freeSpot(w, ht, spots) {
    const blocks = [...document.querySelectorAll('#page .w > *:not(.links), #page .keys, #page .links > .seg')].filter(e => e.offsetWidth).map(e => ({ r: e.getBoundingClientRect(), weight: e.closest('[data-w="clock"], [data-w="date"]') ? 8 : 1 }));   // the clock is the last thing to cover
    let best = null, least = Infinity;
    for (const s of spots) {
      const left = Math.max(8, Math.min(innerWidth - w - 8, s.left)), top = Math.max(8, Math.min(innerHeight - ht - 8, s.top));
      let covered = 0;
      for (const { r, weight } of blocks) covered += weight * Math.max(0, Math.min(left + w, r.right) - Math.max(left, r.left)) * Math.max(0, Math.min(top + ht, r.bottom) - Math.max(top, r.top));
      if (covered < least) { least = covered; best = { left, top, origin: s.origin }; }
    }
    return best;
  },

  // sliding-pill choice, Friis's .seg
  seg(options, value, onChange, cls = '') {
    const pill = h('div', { class: 'seg-pill' });
    const box = h('div', { class: 'seg inset ' + cls }, pill);
    const buttons = options.map(o => h('button', {
      type: 'button', 'data-v': o.value, text: o.label, title: o.title || '',
      onclick: () => { if (o.value !== value) { value = o.value; place(true); onChange(o.value); } },
    }));
    box.append(...buttons);
    function place(animate) {
      const b = buttons.find(x => x.dataset.v === String(value)) || buttons[0];
      for (const x of buttons) x.classList.toggle('on', x === b);
      if (!b || !b.offsetWidth) return;
      if (animate && !Motion.reduced) {
        Motion.slideX(pill, b.offsetLeft - 2);
        Motion.size(pill, 'width', b.offsetWidth);
      } else {
        pill.style.translate = `${b.offsetLeft - 2}px 0px`;
        pill.style.width = b.offsetWidth + 'px';
      }
    }
    box.place = place;
    queueMicrotask(() => place(false));
    return box;
  },

  toggle(on, onChange, label) {
    const knob = h('div', { class: 'knob' });
    const track = h('div', { class: 'track inset' }, knob);
    const el = h('label', { class: 'switch' + (on ? ' on' : ''), role: 'switch', tabIndex: 0 },
      label ? h('span', { text: label }) : null, track);
    knob.style.translate = on ? '16px 0px' : '0px 0px';
    const flip = () => {
      on = !on;
      el.classList.toggle('on', on);
      Motion.slideX(knob, on ? 16 : 0);
      onChange(on);
    };
    // follow a change made elsewhere, without announcing it back
    el.set = v => {
      if (v === on) return;
      on = v;
      el.classList.toggle('on', on);
      Motion.slideX(knob, on ? 16 : 0);
    };
    el.addEventListener('click', e => { e.preventDefault(); flip(); });
    el.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    return el;
  },
};
