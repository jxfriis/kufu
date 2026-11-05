'use strict';
// The clock's Glass style: the plain clock, with every character cut out of clear glass. Shape, bevel and rim are drawn
// once per character and size; Chromium's backdrop-filter bends the page behind it. Loaded only while this style is chosen.

const GlassDigits = {
  shapes: new Map(),
  filters: new Set(),
  kept: readJSON('fs.gd') || {},
  svg: null,
  sheet: null,

  ensure() {
    if (this.svg?.isConnected) return;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('aria-hidden', 'true');
    this.svg.style.cssText = 'position:absolute;width:0;height:0';
    this.sheet = document.createElement('style');
    document.body.append(this.svg, this.sheet);
    new ResizeObserver(() => this.later()).observe($('page'));
  },
  later() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 60);
  },
  fontOf(slot) { const cs = getComputedStyle(slot); return cs.fontWeight + '|' + cs.fontFamily; },
  // size, font, theme or frost changed: repaint whatever is showing
  refresh() {
    document.documentElement.style.setProperty('--gd-frost', S.clock.glassfrost / 100);
    const first = document.querySelector('.digit.gd');
    if (!first) return;
    const key = this.fontOf(first);
    if (key !== this.font) {
      if (key === this.loading) return;
      this.loading = key;
      const cs = getComputedStyle(first);
      const done = () => { if (this.loading !== key) return; this.loading = null; this.font = key; this.fit(cs); this.refresh(); };
      document.fonts.load(cs.fontWeight + ' 100px ' + cs.fontFamily, '0123456789:').then(done, done);
      return;
    }
    const seen = [...document.querySelectorAll('.digit.gd b')].filter(b => b.textContent).map(b => ({ b, ch: b.textContent, read: this.read(b.parentElement) }));
    this.batch = '';
    for (const { b, ch, read } of seen) this.apply(b, ch, read);
    if (this.batch) this.sheet.append(this.batch);
    this.batch = null;
  },
  read(slot) { const cs = getComputedStyle(slot); return { w: slot.clientWidth, ht: slot.clientHeight, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily }; },
  // every number gets a slot wide enough for the widest one in this font
  fit(cs) {
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontWeight + ' 100px ' + cs.fontFamily;
    const size = ch => { const m = c.measureText(ch); return Math.max(m.width, m.actualBoundingBoxRight + m.actualBoundingBoxLeft + 4); };
    const st = document.documentElement.style;
    st.setProperty('--gd-w', (Math.max(...'0123456789'.split('').map(size)) / 100).toFixed(3) + 'em');
    st.setProperty('--gd-colon', (size(':') / 100).toFixed(3) + 'em');
  },

  apply(b, ch, read) {
    if (!ch) return;
    this.ensure();
    if (!read && this.fontOf(b.parentElement) !== this.font) return this.refresh();
    const cs = read || this.read(b.parentElement), { w, ht } = cs;
    if (!w || !ht) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const shapeKey = [ch, w, ht, cs.fontSize, cs.fontWeight, cs.fontFamily, dark ? 'd' : 'l'].join('|');
    let shape = this.shapes.get(shapeKey);
    if (!shape) {
      const dpr = Math.max(2, Math.min(3, devicePixelRatio || 1)), saved = shapeKey + '|' + dpr;
      let art = this.kept[saved];
      if (!art) { art = this.kept[saved] = this.draw(ch, w, ht, cs, dark); this.keep(saved); }
      const id = 'gs' + this.shapes.size;
      const rule = '[data-gs="' + id + '"]{-webkit-mask-image:url("' + art.mask + '");mask-image:url("' + art.mask + '");background-image:url("' + art.rim + '");--gd-glow:url("' + art.glow + '")}';
      if (this.batch != null) this.batch += rule; else this.sheet.append(rule);
      shape = { id, field: art.field };
      this.shapes.set(shapeKey, shape);
    }
    // 0% is clear glass, 100% is fully frosted
    const blur = Math.round(S.clock.glassfrost / 100 * 14 * 10) / 10, refraction = S.clock.glassrefraction;
    const id = `${shape.id}-${String(blur).replace('.', '_')}-${refraction}`;
    if (!this.filters.has(id)) {
      this.filters.add(id);
      const tone = this.tone(dark, S.clock.glassfrost / 100);
      // the repo's refraction is written for surfaces hundreds of px wide, so it scales to the digit's lens: scale = 2 x amount
      const scale = 2 * refraction * parseFloat(cs.fontSize) / 780;
      this.svg.insertAdjacentHTML('beforeend', `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">`
        + (blur ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/>` : '')
        + `<feImage href="${shape.field}" x="0" y="0" width="${w}" height="${ht}" preserveAspectRatio="none" result="m"/>`
        + `<feDisplacementMap in="${blur ? 'b' : 'SourceGraphic'}" in2="m" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
        + `<feGaussianBlur in="d" stdDeviation=".35" result="e"/><feComponentTransfer in="e">${['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${tone}"/>`).join('')}</feComponentTransfer></filter>`);
    }
    if (b.dataset.gs !== shape.id) { b.dataset.gs = shape.id; b.classList.add('ready'); }
    if (b.dataset.gf !== id) { b.dataset.gf = id; b.style.backdropFilter = `url(#${id})`; }
  },

  // newest shapes last; when the time changes only a few are ever new
  keep(key) {
    this.keptOrder = (this.keptOrder || Object.keys(this.kept)).filter(k => k !== key);
    this.keptOrder.push(key);
    for (const k of this.keptOrder.splice(0, Math.max(0, this.keptOrder.length - 24))) delete this.kept[k];
    clearTimeout(this.keepTimer);
    this.keepTimer = setTimeout(() => { if (!writeJSON('fs.gd', this.kept)) localStorage.removeItem('fs.gd'); }, 800);
  },

  draw(ch, w, ht, cs, dark) {
    const dpr = Math.max(2, Math.min(3, devicePixelRatio || 1)), cw = Math.ceil(w * dpr), chh = Math.ceil(ht * dpr);
    const canvas = () => { const c = document.createElement('canvas'); c.width = cw; c.height = chh; return c.getContext('2d', { willReadFrequently: true }); };

    // the character itself, centred by its ink rather than by its line box
    const g = canvas();
    g.font = cs.fontWeight + ' ' + parseFloat(cs.fontSize) * dpr + 'px ' + cs.fontFamily;
    g.fillStyle = '#fff';
    const m = g.measureText(ch), eight = g.measureText('8');
    g.fillText(ch, (cw - m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft, (chh + eight.actualBoundingBoxAscent - eight.actualBoundingBoxDescent) / 2);
    const A = g.getImageData(0, 0, cw, chh).data;

    // the exact distance from every pixel to the nearest edge (Felzenszwalb & Huttenlocher)
    const D2 = new Float64Array(cw * chh), big = 1e12;
    for (let n = 0; n < D2.length; n++) D2[n] = A[n * 4 + 3] > 127 ? big : 0;
    const longest = Math.max(cw, chh), f = new Float64Array(longest), out = new Float64Array(longest), v = new Int32Array(longest), z = new Float64Array(longest + 1);
    const pass = len => {
      let k = 0;
      v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < len; q++) {
        let s;
        do { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } while (s <= z[k] && --k >= 0);
        k++;
        v[k] = q; z[k] = s; z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) ** 2 + f[v[k]]; }
    };
    for (let i = 0; i < cw; i++) { for (let j = 0; j < chh; j++) f[j] = D2[j * cw + i]; pass(chh); for (let j = 0; j < chh; j++) D2[j * cw + i] = out[j]; }
    for (let j = 0; j < chh; j++) { for (let i = 0; i < cw; i++) f[i] = D2[j * cw + i]; pass(cw); for (let i = 0; i < cw; i++) D2[j * cw + i] = out[i]; }
    // directions come from a softened copy of the shape, so they turn smoothly instead of in steps
    const em0 = parseFloat(cs.fontSize), soft = canvas();
    soft.filter = 'blur(' + Math.max(1.4, em0 * .016) * dpr + 'px)';
    soft.drawImage(g.canvas, 0, 0);
    const H = soft.getImageData(0, 0, cw, chh).data;
    const height = (i, j) => H[(Math.min(chh - 1, Math.max(0, j)) * cw + Math.min(cw - 1, Math.max(0, i))) * 4 + 3];

    const fieldCtx = canvas(), rimCtx = canvas(), glowCtx = canvas();
    const F = fieldCtx.createImageData(cw, chh), R = rimCtx.createImageData(cw, chh), L = glowCtx.createImageData(cw, chh);
    const sat = v => Math.min(1, Math.max(0, v)), facing0 = ny => Math.pow(Math.abs(ny), 1.25);
    const em = em0, bezel = Math.max(3, Math.min(20, em * .075)) * dpr, reach = Math.max(1, Math.round(dpr));
    for (let j = 0, p = 0; j < chh; j++) for (let i = 0; i < cw; i++, p += 4) {
      F.data[p + 3] = 255;
      const raw = D2[j * cw + i], d = raw ? Math.sqrt(raw) : 0;
      if (!d) { F.data[p] = F.data[p + 1] = F.data[p + 2] = 128; continue; }
      // the outward direction is downhill on the softened shape
      let nx = height(i - reach, j) - height(i + reach, j), ny = height(i, j - reach) - height(i, j + reach);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      // the same bezel curve as the panes, only over a much thinner edge
      const depth = sat(d / bezel), bend = 1 - Math.sqrt((2 - depth) * depth);
      F.data[p] = 127.5 - nx * bend * 127.5;
      F.data[p + 1] = 127.5 - ny * bend * 127.5;
      F.data[p + 2] = 128;
      // maps.wgsl: specular only where the edge faces up or down, a soft inner light, shade down the sides. No drawn lines.
      const inside = (d - .5) / dpr / Math.max(1, em / 90), aa = 1.1, ay = Math.abs(ny), spread = 1.08;
      const dir = Math.pow(sat((ay - Math.cos(spread)) / (1 - Math.cos(spread))), 1.25);
      const dif = Math.pow(sat((ay - Math.cos(spread * .65)) / (1 - Math.cos(spread * .65))), 1.25);
      let spec = dir * sat((.9 - inside) / aa + .5) * .72;
      spec /= 1 + .5 * (1 - spec);
      const diffuse = dif * .18 * (1 - sat(inside / 4.5)) ** 2;
      const light = sat(spec + diffuse);
      const sideLine = sat(1 - inside / 1.4);
      const wa = sat((nx - Math.cos(.98)) / (1 - Math.cos(.98))) * sideLine, wb = sat((-nx - Math.cos(.98)) / (1 - Math.cos(.98))) * sideLine;
      const shade = (wa / (1 + .4 * (1 - wa)) + wb / (1 + .4 * (1 - wb))) * .3;
      const alpha = light + shade * (1 - light);
      if (alpha > .004) {
        R.data[p] = R.data[p + 1] = R.data[p + 2] = 255 * light / alpha;
        R.data[p + 3] = 255 * alpha;
      }
      // frost only: light gathering softly inside the rim
      const glow = Math.pow(sat(1 - d / (bezel * 2.4)), 2);
      L.data[p] = L.data[p + 1] = L.data[p + 2] = 255;
      L.data[p + 3] = 255 * glow * .62;
    }
    fieldCtx.putImageData(F, 0, 0);
    const smooth = canvas();
    smooth.fillStyle = 'rgb(128 128 128)';
    smooth.fillRect(0, 0, cw, chh);
    smooth.filter = `blur(${dpr * .7}px)`;
    smooth.drawImage(fieldCtx.canvas, 0, 0);
    rimCtx.putImageData(R, 0, 0);
    const rim = canvas();
    rim.filter = 'blur(' + dpr * .3 + 'px)';
    rim.drawImage(rimCtx.canvas, 0, 0);
    glowCtx.putImageData(L, 0, 0);

    const mask = g.canvas.toDataURL('image/png');
    return { mask, rim: rim.canvas.toDataURL('image/png'), glow: glowCtx.canvas.toDataURL('image/png'), field: smooth.canvas.toDataURL('image/png') };
  },
  // material-graph.ts: the Clear curve at 0%, the Regular curve at 100%
  tone(dark, frost) {
    const out = [];
    const [lift, roll] = [.18, 0], [a, c, q, keep] = dark ? [.105, .83, -.2091, .9] : [.36, .67, -.1113, .8];
    for (let n = 0; n <= 32; n++) {
      const v = n / 32, base = v + lift * (1 - v) ** 3 - roll * v ** 3;
      const clear = .94 * base + .06 * (.78 * v + .26);
      const milky = keep * (a + c * v + q * v * v) + (1 - keep) * v;
      out.push(Math.min(1, Math.max(0, clear + (milky - clear) * frost)).toFixed(4));
    }
    return out.join(' ');
  },
};
globalThis.GlassDigits = GlassDigits;
