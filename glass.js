'use strict';
// Glass: bends the picture behind a surface at its edges and lights its rim.

// One damped spring, solved exactly, so a dropped frame can't change the motion.
class GlassSpring {
  constructor(duration, bounce) { this.value = 0; this.v = 0; this.target = 0; this.set(duration, bounce); }
  set(duration, bounce) { this.w = 2 * Math.PI / duration; this.z = 1 - bounce; }
  step(dt) {
    const { w, z } = this, x = this.value - this.target, v = this.v;
    if (z >= 1) {
      const e = Math.exp(-w * dt), k = v + w * x;
      this.value = this.target + e * (x + k * dt);
      this.v = e * (v - k * w * dt);
    } else {
      const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt), b = (v + z * w * x) / wd;
      this.value = this.target + e * (x * c + b * s);
      this.v = e * ((b * wd - z * w * x) * c - (x * wd + z * w * b) * s);
    }
    return Math.abs(this.value - this.target) < .001 && Math.abs(this.v) < .01;
  }
}
const GlassPress = {
  live: new Map(),
  frame: 0,
  // the innermost surface you press owns it; switches and segmented controls have their own motion
  target(t) {
    if (t.closest?.('.key')) return null;
    const el = t.closest?.('button, .press, .tile, .widget-tile, #page .week, #page .cal-page, #page .mini-month, #page .date.stack, #page .date.big-line');
    return el && !el.matches(':disabled, .switch, .switch *, .seg button, .font-row, .pal-item') ? el : null;
  },
  down(e) {
    if (e.button !== 0 || Motion.reduced) return;
    const el = this.target(e.target);
    if (!el) return;
    let m = this.live.get(el);
    if (!m) {
      m = { x: new GlassSpring(.18, 0), y: new GlassSpring(.18, 0), press: new GlassSpring(.24, .2) };
      this.live.set(el, m);
    }
    const r = el.getBoundingClientRect();
    Object.assign(m, { held: true, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: el.offsetWidth || 1, h: el.offsetHeight || 1 });
    m.press.set(.24, .2);
    m.press.target = 1;
    el.style.setProperty('--lg-glow', 1);
    this.held = el;
    this.wake();
  },
  move(e) {
    const m = this.held && this.live.get(this.held);
    if (!m) return;
    m.px = e.clientX; m.py = e.clientY;
  },
  up() {
    const el = this.held, m = el && this.live.get(el);
    this.held = null;
    if (!m) return;
    m.held = false;
    m.press.set(.5, .42);
    m.press.target = m.x.target = m.y.target = 0;
    el.style.removeProperty('--lg-glow');
    this.wake();
  },
  band: (off, limit) => Math.sign(off) * limit * (1 - 1 / (Math.abs(off) * .55 / limit + 1)),
  wake() { if (!this.frame) { this.last = performance.now(); this.frame = requestAnimationFrame(t => this.tick(t)); } },
  tick(now) {
    this.frame = 0;
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    for (const [el, m] of this.live) {
      if (!el.isConnected) { this.live.delete(el); continue; }
      const { w, h } = m, big = Math.max(w, h), small = big <= 72;
      if (m.held) {
        const ox = small ? m.px - m.sx : m.px - Math.max(m.cx - w / 2, Math.min(m.cx + w / 2, m.px));
        const oy = small ? m.py - m.sy : m.py - Math.max(m.cy - h / 2, Math.min(m.cy + h / 2, m.py));
        const limit = small ? 4 + .15 * big : Math.min(10, 3 + .04 * big);
        m.x.target = this.band(ox, limit);
        m.y.target = this.band(oy, limit);
      }
      const a = m.x.step(dt), b = m.y.step(dt), c = m.press.step(dt);
      if (a && b && c && !m.held) {
        el.style.removeProperty('translate');
        el.style.removeProperty('scale');
        this.live.delete(el);
        continue;
      }
      const grow = Math.min(.16, 8 / big) * m.press.value, cap = small ? .2 : .12;
      const ex = Math.min(cap, .5 * Math.abs(m.x.value) / w + .00007 * Math.abs(m.x.v)), ey = Math.min(cap, .5 * Math.abs(m.y.value) / h + .00007 * Math.abs(m.y.v));
      el.style.translate = `${m.x.value.toFixed(2)}px ${m.y.value.toFixed(2)}px`;
      el.style.scale = `${((1 + grow) * (1 + ex) / Math.sqrt(1 + ey)).toFixed(4)} ${((1 + grow) * (1 + ey) / Math.sqrt(1 + ex)).toFixed(4)}`;
    }
    if (this.live.size) this.wake();
  },
};
const Glass = {
  panes: '#page .panel, .cal-page, #page .digit:not(.gd), #page .key:not(.add), .wx-pill, .search form, #gear, #page .week, #page .weeknum, #credit button, .wx-pop, .cal-pop, .folder-pop, .suggest, .toast, .arrange-bar, .menu, .palette, .modal, .settings',
  // long text sits on these, so they keep a trace of frost even in clear glass
  dense: '.menu, .palette, .modal, .settings',
  // these open on top of other text, so a trace of frost keeps the two from colliding
  covering: '.wx-pop, .suggest',
  frosted: '.cal-pop, .folder-pop, .wx-pop',
  on: false,
  known: new Set(),
  applied: new Set(),
  maps: null,

  start() {
    if (!this.on) {
      this.on = true;
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.style.cssText = 'position:absolute;width:0;height:0';
      this.sheet = document.createElement('style');
      document.body.append(this.svg, this.sheet);
      this.maps = readJSON('fs.lgmaps') || {};
      this.watch = new MutationObserver(records => this.changed(records));
      this.watch.observe(document.body, { childList: true, subtree: true });
      this.resize = () => this.later();
      addEventListener('resize', this.resize);
      this.pressDown = e => GlassPress.down(e);
      this.pressMove = e => GlassPress.move(e);
      this.pressUp = () => GlassPress.up();
      addEventListener('pointerdown', this.pressDown, true);
      addEventListener('pointermove', this.pressMove, { capture: true, passive: true });
      addEventListener('pointerup', this.pressUp, true);
      addEventListener('pointercancel', this.pressUp, true);
      this.move = e => this.glow(e);
      addEventListener('pointermove', this.move, { passive: true });
    }
    this.scan();
  },
  stop() {
    if (!this.on) return;
    this.on = false;
    this.watch.disconnect();
    removeEventListener('resize', this.resize);
    removeEventListener('pointermove', this.move);
    removeEventListener('pointerdown', this.pressDown, true);
    removeEventListener('pointermove', this.pressMove, true);
    removeEventListener('pointerup', this.pressUp, true);
    removeEventListener('pointercancel', this.pressUp, true);
    for (const el of this.applied) { el.style.backdropFilter = ''; el.style.removeProperty('--lg-glow-size'); delete el.dataset.lg; delete el.dataset.lgr; }
    this.applied.clear();
    this.known.clear();
    this.svg.remove();
    this.sheet.remove();
  },
  // A new overlay gets its glass in the same frame. Settings rows changing inside a pane can't change any pane's shape.
  changed(records) {
    const inner = records.every(r => r.target.closest?.('.settings, .pal-list, .digit'));
    if (inner) return;
    if (records.some(r => [...r.addedNodes].some(n => n.matches?.(this.overlays) || n.querySelector?.(this.overlays)))) this.scan();
    else this.later();
  },
  overlays: '.wx-pop, .cal-pop, .folder-pop, .suggest, .toast, .arrange-bar, .menu, .palette, .modal, .settings',
  later() {
    if (this.pending) return;
    this.pending = true;
    idle(() => { this.pending = false; if (this.on) this.scan(); });
  },

  // light under the pointer; at most one style write a frame
  glow(e) {
    this.last = e;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const el = this.last.target.closest?.(this.panes);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${this.last.clientX - r.left}px`);
      el.style.setProperty('--gy', `${this.last.clientY - r.top}px`);
    });
  },

  scan() {
    const dark = document.documentElement.dataset.theme === 'dark', s = S.surface;
    const clear = s.mode === 'translucent', dpr = Math.min(2, devicePixelRatio || 1);
    for (const el of this.applied) if (!el.isConnected) this.applied.delete(el);
    let wrote = false;
    const seen = [];
    for (const el of document.querySelectorAll(this.panes)) {
      const w = el.offsetWidth, ht = el.offsetHeight;
      if (w && ht) seen.push({ el, w, ht, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, covering: el.matches(this.frosted) ? 16 : el.matches(this.dense) ? 4 : el.matches(this.covering) ? 3 : 0, settings: el.matches('.settings') });
    }
    let rules = '';
    for (const { el, w, ht, radius, covering, settings } of seen) {
      const r = Math.round(Math.min(radius, Math.min(w, ht) / 2));
      const frost = clear ? (s.glassfrost || 0) / 100 : 0;
      const blur = settings ? 24 : clear ? Math.max(covering, Math.round(Math.max(0, frost * 2 - 1) * 140) / 10) : s.blur;
      const id = `lg-${w}-${ht}-${r}-${dark ? 'd' : 'l'}-${clear ? 'c' : 'r'}-${blur}-${s.refraction}-${frost * 100 | 0}`.replace('.', '_');
      const rim = `r${w}-${ht}-${r}-${dark ? 'd' : 'l'}`;
      if (!this.known.has(id)) {
        this.known.add(id);
        this.svg.insertAdjacentHTML('beforeend', this.filter(id, w, ht, r, dark, clear, blur));
        wrote = true;
      }
      if (!this.known.has(rim)) {
        this.known.add(rim);
        rules += `[data-lgr="${rim}"]{--lg-rim:url("${this.rim(w, ht, r, dark, dpr)}")}`;
        wrote = true;
      }
      if (el.dataset.lg !== id) { el.dataset.lg = id; el.style.backdropFilter = `url(#${id})`; }
      if (el.dataset.lgr !== rim) {
        el.dataset.lgr = rim;
        el.style.setProperty('--lg-glow-size', `${Math.max(36, Math.min(180, Math.max(w, ht) * .9))}px`);
      }
      this.applied.add(el);
    }
    if (rules) this.sheet.append(rules);
    if (wrote) this.saveMaps();
  },

  filter(id, w, ht, r, dark, clear, blur) {
    // light may bend at most across 40% of the short side, or a thin pill would smear the far edge into itself
    const scale = Math.min(S.surface.refraction, Math.min(w, ht) * .8);
    return `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">`
      + (blur ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/>` : '')
      + `<feImage href="${this.field(w, ht, r)}" x="0" y="0" width="${w}" height="${ht}" preserveAspectRatio="none" result="m"/>`
      + `<feDisplacementMap in="${blur ? 'b' : 'SourceGraphic'}" in2="m" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
      + `<feComponentTransfer in="d" result="t">${['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${this.tone(dark, clear, (S.surface.glassfrost || 0) / 100)}"/>`).join('')}</feComponentTransfer>`
      + (clear ? '' : `<feColorMatrix in="t" type="saturate" values="${dark ? 1.0648 : 1.1031}"/>`) + '</filter>';
  },

  tone(dark, clear, frost = 0) {
    const out = [];
    const [a, b, q, keep] = dark ? [.105, .83, -.2091, .9] : [.36, .67, -.1113, .8];
    for (let n = 0; n <= 16; n++) {
      const v = n / 16, milky = keep * (a + b * v + q * v * v) + (1 - keep) * v;
      if (!clear) { out.push(milky.toFixed(4)); continue; }
      const [lift, roll] = dark ? [.15, .2] : [.18, 0];
      const plain = v + lift * (1 - v) ** 3 - roll * v ** 3;
      // the same curves the clock's glass uses at 0% and 100%
      const base = v + .18 * (1 - v) ** 3, watch = .94 * base + .06 * (.78 * v + .26);
      const value = frost <= .5 ? plain + (watch - plain) * frost * 2 : watch + (milky - watch) * (frost * 2 - 1);
      out.push(Math.min(1, Math.max(0, value)).toFixed(4));
    }
    return out.join(' ');
  },

  // signed distance to the rounded rectangle, and the outward normal
  sd(px, py, hw, hh, r) {
    const qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.hypot(ox, oy);
    let nx = 0, ny = 0;
    if (len > 0) { nx = ox / len; ny = oy / len; } else if (qx > qy) nx = 1; else ny = 1;
    return [len + Math.min(Math.max(qx, qy), 0) - r, nx * Math.sign(px || 1), ny * Math.sign(py || 1)];
  },
  png(cw, ch, paint) {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const x = c.getContext('2d'), im = x.createImageData(cw, ch);
    paint(im.data);
    x.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  },

  // Refraction: a 20px bezel where light bends in toward the middle, half resolution because it's smooth.
  field(w, ht, r) {
    const key = `g${w}x${ht}r${r}`;
    if (this.maps[key]) return this.hit(key);
    // thin shapes bend sharply, so they get full resolution; everything else is smooth enough for half
    const res = Math.min(w, ht) < 64 ? 1 : 2;
    const cw = Math.max(2, Math.ceil(w / res)), ch = Math.max(2, Math.ceil(ht / res));
    return (this.maps[key] = this.png(cw, ch, d => {
      for (let j = 0, p = 0; j < ch; j++) for (let i = 0; i < cw; i++, p += 4) {
        const [dist, nx, ny] = this.sd((i + .5) / cw * w - w / 2, (j + .5) / ch * ht - ht / 2, w / 2, ht / 2, r);
        const depth = Math.min(1, Math.max(0, -dist * .05));
        const edge = 1 - Math.sqrt((2 - depth) * depth);
        d[p] = 127.5 - nx * edge * 127.5;
        d[p + 1] = 127.5 - ny * edge * 127.5;
        d[p + 2] = 128;
        d[p + 3] = 255;
      }
    }));
  },

  // The rim: bright hairline along top and bottom, soft inner light, dark shade down the sides.
  rim(w, ht, r, dark, dpr) {
    const key = `r${w}x${ht}r${r}${dark ? 'd' : 'l'}@${dpr}`;
    if (this.maps[key]) return this.hit(key);
    const sat = x => Math.min(1, Math.max(0, x));
    const cw = Math.ceil(w * dpr), ch = Math.ceil(ht * dpr), aa = 1 / dpr;
    const mixd = (a, b) => (dark ? b : a), spread = 1.08, side = .98;
    return (this.maps[key] = this.png(cw, ch, o => {
      const band = Math.ceil(6 * dpr), corner = Math.ceil((r + 6) * dpr);
      for (let j = 0, p = 0; j < ch; j++) for (let i = 0; i < cw; i++, p += 4) {
        // the middle stays clear: skip it without any maths, so big panes cost next to nothing
        const ex = Math.min(i, cw - 1 - i), ey = Math.min(j, ch - 1 - j);
        if (ex > band && ey > band && (ex > corner || ey > corner)) continue;
        const [d, nx, ny] = this.sd((i + .5) / dpr - w / 2, (j + .5) / dpr - ht / 2, w / 2, ht / 2, r);
        if (d < -6) continue;
        const coverage = sat(.5 - d / aa);
        const dir = Math.pow(sat((Math.abs(ny) - Math.cos(spread)) / (1 - Math.cos(spread))), 1.25);
        const dif = Math.pow(sat((Math.abs(ny) - Math.cos(spread * .65)) / (1 - Math.cos(spread * .65))), 1.25);
        let spec = dir * sat((d + .9) / aa + .5) * sat(.5 - d / aa);
        spec /= 1 + .5 * (1 - spec);
        const diffuse = dif * .18 * (1 - sat(-d / 4.5)) ** 2 * coverage;
        const light = sat(spec * mixd(1, .82) + diffuse * mixd(1, .4));
        const adj = d - .5, fall = 1 - sat(-adj / .5);
        const ramp = (fall > 0 ? .25 : 0) + fall * .75;
        const line = ramp * sat((adj + .5) / aa + .5) * sat(-adj / aa + .5);
        const wa = sat((nx - Math.cos(side)) / (1 - Math.cos(side))) * line, wb = sat((-nx - Math.cos(side)) / (1 - Math.cos(side))) * line;
        const shade = (wa / (1 + .4 * (1 - wa)) + wb / (1 + .4 * (1 - wb))) * mixd(.48, .6);
        const alpha = light + shade * (1 - light);
        if (alpha <= 0) continue;
        o[p] = o[p + 1] = o[p + 2] = 255 * mixd(1, .82) * light / alpha;
        o[p + 3] = 255 * alpha;
      }
    }));
  },

  // keep the newest shapes so the next tab skips this work
  // a map that is used again moves to the newest end, so the ones a page really needs are the ones kept
  hit(key) {
    const v = this.maps[key];
    delete this.maps[key];
    this.maps[key] = v;
    this.dirty = true;
    return v;
  },
  saveMaps() {
    clearTimeout(this.saving);
    this.saving = setTimeout(() => idle(() => {
      const keys = Object.keys(this.maps);
      for (const k of keys.slice(0, Math.max(0, keys.length - 64))) delete this.maps[k];
      writeJSON('fs.lgmaps', this.maps);
    }), 1200);
  },
};
globalThis.Glass = Glass;
