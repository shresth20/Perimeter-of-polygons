/* ==========================================================================
 * shapes.js -- a polygon on the board, built from its points
 * --------------------------------------------------------------------------
 * Every shape in the lesson is one group made here: the fill, one path per
 * side in its own ink, the outline the pen draws, the length written beside
 * each side, and the hit areas. Everything is measured from the points, so
 * a shape whose points change (a vertex dragged) is re-laid out from them
 * with set(). Coordinates are the figure's own units (1000 x 420).
 *
 *   Shapes.regular(n, cx, cy, r, rot)   -> points, clockwise from the top
 *   Shapes.build(host, pts, opts)       -> the shape object (below)
 *   shape.set(pts)                       re-lay everything out
 *   shape.len(i) / shape.mid(i)          a side's length and midpoint
 *
 * Load order: before js/animations.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SIDE_INKS = 6;                /* --side-0 .. --side-5 in style.css */

  function round2(n) { return Math.round(n * 100) / 100; }
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* A regular n-gon: its first vertex at the top (rot = -90) and the rest
     clockwise on the screen. */
  function regular(n, cx, cy, r, rot) {
    var pts = [];
    var a0 = (rot == null ? -90 : rot) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var a = a0 + i * 2 * Math.PI / n;
      pts.push({ x: round2(cx + Math.cos(a) * r), y: round2(cy + Math.sin(a) * r) });
    }
    return pts;
  }
  /* A rectangle, from its top-left corner. */
  function rect(x, y, w, h) {
    return [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
  }
  function pathOf(pts, open) {
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + round2(p.x) + ' ' + round2(p.y); }).join(' ');
    return open ? d : d + ' Z';
  }
  function seg(a, b) { return 'M' + round2(a.x) + ' ' + round2(a.y) + ' L' + round2(b.x) + ' ' + round2(b.y); }
  function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
  function centroid(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }
  /* Twice the signed area: > 0 when the points run clockwise on the screen. */
  function winding(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s;
  }
  /* The unit normal of side i that points AWAY from the shape. Read from the
     way the points wind, so it holds for a dented shape too (a corner
     dragged in); the centre is the fallback for a shape with no area. */
  function outward(pts, i) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    var dx = b.x - a.x, dy = b.y - a.y;
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var w = winding(pts);
    if (Math.abs(w) > 1e-6) return w > 0 ? { x: dy / L, y: -dx / L } : { x: -dy / L, y: dx / L };
    var n = { x: -dy / L, y: dx / L };
    var c = centroid(pts), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((m.x - c.x) * n.x + (m.y - c.y) * n.y < 0) { n.x = -n.x; n.y = -n.y; }
    return n;
  }

  /* ---- where a side's length is written ------------------------------------
     Off the middle of its side, outside the shape, with the SAME clear gap
     between the side and the nearest edge of the letters whatever the
     side's slope and however long the label is: "5 cm" beside an upright
     side stands as far off as "8 cm" over a level one. The gap is measured
     to the letters' real ink (the font's glyphs, not its line box), so a
     label is never pushed off by the empty room above and below its
     letters, and a wide one never runs into its side. */
  var SIDE_HALF = 2.5;              /* half a side's stroke (.shape__side)       */
  var HALO = 2.5;                   /* a little clear room kept round a label's letters */
  var GAP_EM = 0.45;                /* the clear gap, in the label's own ems     */
  var FALLBACK_PX = 26;             /* .figure-label, for a shape not yet on the page */
  var PUSH_STEP = 3, PUSH_MAX_EM = 3;
  var pen2d = null, inkCache = {};

  /* The label's font, as the page will draw it; null while it is off the
     page (nothing to read yet). */
  function fontOf(t) {
    if (!t.isConnected) return null;
    var cs = global.getComputedStyle(t);
    var size = parseFloat(cs.fontSize);
    if (!size) return null;
    return { size: size, font: [cs.fontStyle, cs.fontWeight, size + 'px', cs.fontFamily].join(' ') };
  }
  function fallbackFont() {
    var fam = global.getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
    return { size: FALLBACK_PX, font: FALLBACK_PX + 'px ' + fam };
  }
  function fontReady(f, text) {
    try { return !document.fonts || document.fonts.check(f.font, text); } catch (e) { return true; }
  }
  /* The ink of `text` about its anchor (text-anchor middle, on the
     alphabetic baseline): how far it reaches left, right, up and down. */
  function inkOf(text, f) {
    var key = f.font + '|' + text;
    if (inkCache[key]) return inkCache[key];
    if (!pen2d) pen2d = document.createElement('canvas').getContext('2d');
    pen2d.font = f.font;
    pen2d.textAlign = 'center';
    pen2d.textBaseline = 'alphabetic';
    var m = pen2d.measureText(text);
    var box = typeof m.actualBoundingBoxAscent === 'number'
      ? { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, up: m.actualBoundingBoxAscent, dn: m.actualBoundingBoxDescent }
      : { l: m.width / 2, r: m.width / 2, up: f.size * 0.72, dn: f.size * 0.05 };
    if (fontReady(f, text)) inkCache[key] = box;
    return box;
  }

  /* Does segment p-q touch the box {x0, y0, x1, y1}? (Liang-Barsky) */
  function segHitsBox(p, q, r) {
    var t0 = 0, t1 = 1, dx = q.x - p.x, dy = q.y - p.y;
    var P = [-dx, dx, -dy, dy], Q = [p.x - r.x0, r.x1 - p.x, p.y - r.y0, r.y1 - p.y];
    for (var k = 0; k < 4; k++) {
      if (P[k] === 0) { if (Q[k] < 0) return false; continue; }
      var t = Q[k] / P[k];
      if (P[k] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function inside(pts, x, y) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function boxesMeet(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }
  /* The label's ink box centred on (cx, cy), grown by `m` all round. */
  function boxAt(cx, cy, hw, hh, m) { return { x0: cx - hw - m, x1: cx + hw + m, y0: cy - hh - m, y1: cy + hh + m }; }
  function clearOf(pts, i, b, placed) {
    var n = pts.length;
    for (var j = 0; j < n; j++) {
      if (j !== i && segHitsBox(pts[j], pts[(j + 1) % n], b)) return false;
    }
    if (inside(pts, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) return false;
    for (var k = 0; k < placed.length; k++) if (boxesMeet(b, placed[k])) return false;
    return true;
  }

  /* Where side i's label is anchored, for ink `box` and a clear `gap`
     between the side's middle line and the nearest letter. A box reaches
     |nx|*w/2 + |ny|*h/2 towards a line with unit normal n, so its centre
     goes that much further out than the gap. On a convex shape that alone
     keeps it off the whole figure; on a dented one (a corner dragged in)
     it is walked further out until it clears every side and every label
     already placed. Returns the anchor and the box it took. */
  function labelAt(pts, i, box, gap, placed) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    var nrm = outward(pts, i);
    var hw = (box.l + box.r) / 2, hh = (box.up + box.dn) / 2;
    var d = gap + Math.abs(nrm.x) * hw + Math.abs(nrm.y) * hh;
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var room = SIDE_HALF + HALO, most = d + PUSH_MAX_EM * (hh * 2 + gap);
    var cx = mx + nrm.x * d, cy = my + nrm.y * d;
    for (var k = d; k <= most; k += PUSH_STEP) {
      var tx = mx + nrm.x * k, ty = my + nrm.y * k;
      if (clearOf(pts, i, boxAt(tx, ty, hw, hh, room), placed || [])) { cx = tx; cy = ty; break; }
    }
    return {
      x: round2(cx - (box.r - box.l) / 2),
      y: round2(cy + (box.up - box.dn) / 2),
      box: boxAt(cx, cy, hw, hh, HALO)
    };
  }

  /* ---- one ink per length --------------------------------------------------
     Sides of the same length wear the same ink, everywhere in the game: a
     rectangle is two inks (its lengths, its breadths), a square or any
     regular polygon is one, a scalene triangle three. Two sides are "the
     same length" when they carry the same label (8 cm and 8 cm, a and a)
     or, with no label, when they measure within LEN_SLACK of each other.
     The inks are kept stable while a shape changes under the finger: a
     length already showing keeps its ink, and a new one takes the first
     ink no showing length is using. */
  var LEN_SLACK = 1.5;
  function inkKeys(s) {
    var keys = [], lens = [];
    for (var i = 0; i < s.n; i++) {
      var lab = s.opts.labels != null ? String(s.labelText(i)) : '';
      if (lab) { keys.push('l:' + lab); continue; }
      var L = s.len(i), k = -1;
      for (var j = 0; j < lens.length; j++) if (Math.abs(lens[j] - L) <= LEN_SLACK) { k = j; break; }
      if (k < 0) { lens.push(L); k = lens.length - 1; }
      keys.push('n:' + k);
    }
    return keys;
  }
  function assignInks(s) {
    var o = s.opts;
    if (Array.isArray(o.inks)) return s.pts.map(function (p, i) { return o.inks[i % o.inks.length]; });
    if (o.inks !== true) return s.pts.map(function () { return null; });
    var keys = inkKeys(s), map = s.inkMap || {}, kept = {}, used = {};
    keys.forEach(function (k) { if (map[k] != null) { kept[k] = map[k]; used[map[k]] = true; } });
    var base = o.inkFrom || 0, next = 0;
    keys.forEach(function (k) {
      if (kept[k] != null) return;
      while (used[(base + next) % SIDE_INKS] && next < SIDE_INKS) next++;
      kept[k] = (base + next) % SIDE_INKS;
      used[kept[k]] = true;
    });
    s.inkMap = kept;
    return keys.map(function (k) { return kept[k]; });
  }
  function paintInks(s) {
    var inks = assignInks(s);
    for (var i = 0; i < s.n; i++) {
      var ink = inks[i];
      if (ink === s.inks[i]) continue;
      s.inks[i] = ink;
      [s.sides[i], s.labels[i]].forEach(function (e) {
        if (!e) return;
        if (ink == null) e.style.removeProperty('--c');
        else e.style.setProperty('--c', 'var(--side-' + ink + ')');
      });
    }
  }

  /* ---- equal sides, marked ---------------------------------------------------
     The geometry book's sign for "these sides are the same length": a short
     stroke across the middle of each -- one stroke on every side of the first
     set of equal sides, two on the next set, and so on. A side with no equal
     is left unmarked, so a regular polygon has a stroke on every side and a
     scalene one none. Lengths within TICK_SLACK (figure units) are equal. */
  var TICK_SLACK = 0.5, TICK_LEN = 18, TICK_GAP = 7;
  function tickCounts(s) {
    var sets = [], counts = [];
    for (var i = 0; i < s.n; i++) {
      var L = s.len(i), found = null;
      for (var j = 0; j < sets.length; j++) if (Math.abs(sets[j].len - L) <= TICK_SLACK) { found = sets[j]; break; }
      if (!found) { found = { len: L, sides: [] }; sets.push(found); }
      found.sides.push(i);
    }
    var k = 0;
    sets.forEach(function (set) {
      if (set.sides.length < 2) return;
      k++;
      set.sides.forEach(function (i2) { counts[i2] = k; });
    });
    return counts;
  }
  function tickPath(a, b, count) {
    if (!count) return '';
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = TICK_LEN / 2, d = [];
    for (var j = 0; j < count; j++) {
      var off = (j - (count - 1) / 2) * TICK_GAP;
      var cx = mx + ux * off, cy = my + uy * off;
      d.push('M' + round2(cx - nx * h) + ' ' + round2(cy - ny * h) + ' L' + round2(cx + nx * h) + ' ' + round2(cy + ny * h));
    }
    return d.join(' ');
  }

  /* ---- angles, marked ------------------------------------------------------
     The geometry book's sign for an angle: a small arc inside each corner,
     from one side to the other. Kept small (ANGLE_R, and never more than a
     share of the shorter side at that corner) so it marks the corner
     without crowding the figure. Drawn across the smaller opening between
     the two sides -- the inside of a convex polygon, which is every polygon
     that is marked. */
  var ANGLE_R = 12, ANGLE_SHARE = 0.25;
  function anglePath(prev, v, next) {
    var ux = prev.x - v.x, uy = prev.y - v.y, wx = next.x - v.x, wy = next.y - v.y;
    var lu = Math.sqrt(ux * ux + uy * uy) || 1, lw = Math.sqrt(wx * wx + wy * wy) || 1;
    var r = Math.min(ANGLE_R, ANGLE_SHARE * Math.min(lu, lw));
    ux /= lu; uy /= lu; wx /= lw; wy /= lw;
    var sweep = ux * wy - uy * wx > 0 ? 1 : 0;
    return 'M' + round2(v.x + ux * r) + ' ' + round2(v.y + uy * r) +
           ' A' + round2(r) + ' ' + round2(r) + ' 0 0 ' + sweep + ' ' +
           round2(v.x + wx * r) + ' ' + round2(v.y + wy * r);
  }

  /* opts:
       inks     true: one ink per side LENGTH (--side-i; equal sides share
                one, see above); a list of ink indices to use one per side;
                false: the shape's one line
       inkFrom  with inks true, the ink the first length takes (default 0),
                so shapes side by side can each wear their own
       labels   one string per side, or a function(i, len) -> string, or
                null for none
       gap      the clear space between a side and the nearest edge of its
                label (default: half a stroke + GAP_EM of the label's size,
                the same for every side -- see labelAt)
       hits     true: a tappable band over each side
       vertices true: a draggable dot on each corner
       perim/area  the warm-up's two highlights
       ticks    true: equal sides marked with strokes across them (above);
                hidden until a beat shows them (Beats.ticksIn)
       angles   true: a small arc in every corner (above); hidden until a
                beat shows them (Beats.ticksIn)
       tint     an ink index: the inside washed in a light shade of that
                ink (--side-i), so a shape outlined in its colour is not
                left a pale ice blue inside
       name     a word written under the shape (a key, read through T);
                nameAbove: true writes it over the shape instead, nameGap
                from the shape's top (default 40, the same either way) */
  function build(host, pts, opts) {
    var o = opts || {};
    var g = el('g', { 'class': 'shape' + (o.cls ? ' ' + o.cls : '') });
    if (o.id) g.setAttribute('id', o.id);
    if (o.tint != null) {
      g.classList.add('shape--tint');
      g.style.setProperty('--tint', 'var(--side-' + (o.tint % SIDE_INKS) + ')');
    }
    var n = pts.length;
    var s = {
      g: g, pts: pts.slice(), n: n, opts: o,
      fill: el('path', { 'class': 'shape__fill' }),
      area: o.area ? el('path', { 'class': 'shape__area' }) : null,
      perim: o.perim ? el('path', { 'class': 'shape__perim' }) : null,
      sides: [], hits: [], labels: [], vertices: [], vhits: [], ticks: [], angles: [], inks: [], inkMap: null,
      outline: el('path', { 'class': 'shape__outline' }),
      tip: el('circle', { 'class': 'shape__tip', r: 7 }),
      hitbox: o.hitbox ? el('path', { 'class': 'shape__hitbox' }) : null,
      name: null
    };
    g.appendChild(s.fill);
    if (s.area) g.appendChild(s.area);
    g.appendChild(s.outline);
    for (var i = 0; i < n; i++) {
      var side = el('path', { 'class': 'shape__side' });
      g.appendChild(side);
      s.sides.push(side);
    }
    if (s.perim) g.appendChild(s.perim);
    if (o.ticks) {
      for (i = 0; i < n; i++) {
        var tk = el('path', { 'class': 'shape__tick' });
        g.appendChild(tk);
        s.ticks.push(tk);
      }
    }
    if (o.angles) {
      for (i = 0; i < n; i++) {
        var an = el('path', { 'class': 'shape__angle' });
        g.appendChild(an);
        s.angles.push(an);
      }
    }
    if (o.hits) {
      for (i = 0; i < n; i++) {
        var hit = el('path', { 'class': 'shape__hit', role: 'button', tabindex: -1 });
        hit.setAttribute('aria-label', global.T ? global.T('a11ySide') : 'A side');
        g.appendChild(hit);
        s.hits.push(hit);
      }
    }
    if (o.labels != null) {
      for (i = 0; i < n; i++) {
        /* on the alphabetic baseline: labelAt sets it from the measured ink */
        var t = el('text', { 'class': 'figure-label shape__label', 'text-anchor': 'middle' });
        g.appendChild(t);
        s.labels.push(t);
      }
    }
    if (o.vertices) {
      for (i = 0; i < n; i++) {
        var v = el('circle', { 'class': 'shape__vertex', r: 8 });
        var vh = el('circle', { 'class': 'shape__vertex-hit', r: 30, role: 'button', tabindex: -1 });
        vh.setAttribute('aria-label', global.T ? global.T('a11yVertex') : 'A corner');
        g.appendChild(v); g.appendChild(vh);
        s.vertices.push(v); s.vhits.push(vh);
      }
    }
    if (s.hitbox) g.appendChild(s.hitbox);
    g.appendChild(s.tip);
    if (o.name) {
      s.name = el('text', { 'class': 'figure-label shape__name', 'text-anchor': 'middle' });
      s.name.textContent = global.T ? global.T(o.name) : o.name;
      g.appendChild(s.name);
    }

    s.len = function (i) { return dist(s.pts[i], s.pts[(i + 1) % s.n]); };
    s.mid = function (i) { var a = s.pts[i], b = s.pts[(i + 1) % s.n]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    s.centre = function () { return centroid(s.pts); };
    s.labelText = function (i) {
      var L = o.labels;
      if (typeof L === 'function') return L(i, s.len(i));
      if (Array.isArray(L)) return L[i] == null ? '' : L[i];
      return '';
    };
    /* Lay the labels out again once there is something true to measure: the
       shape on the page (a card's picture is built before it is put in), or
       the font loaded. */
    var again = false, tries = 0;
    function relayLater(wait) {
      if (again || tries >= 60) return;
      again = true;
      tries++;
      wait.then(function () { again = false; s.set(); }, function () { again = false; });
    }
    function nextFrame() { return new Promise(function (r) { global.requestAnimationFrame(r); }); }
    function fontLoad(f, text) {
      try { return document.fonts.load(f.font, text); } catch (e) { return Promise.reject(e); }
    }
    function placeLabel(i, text, placed) {
      var t = s.labels[i], f = fontOf(t);
      if (!f) { f = fallbackFont(); relayLater(nextFrame()); }
      else if (!fontReady(f, text)) relayLater(fontLoad(f, text));
      var gap = o.gap == null ? SIDE_HALF + GAP_EM * f.size : o.gap;
      var at = labelAt(s.pts, i, inkOf(text, f), gap, placed);
      t.setAttribute('x', at.x);
      t.setAttribute('y', at.y);
      placed.push(at.box);
    }

    /* Everything re-laid out from the points. */
    s.set = function (pts2) {
      if (pts2) s.pts = pts2.slice();
      var p = s.pts, d = pathOf(p);
      s.fill.setAttribute('d', d);
      s.outline.setAttribute('d', d);
      if (s.area) s.area.setAttribute('d', d);
      if (s.perim) s.perim.setAttribute('d', d);
      if (s.hitbox) s.hitbox.setAttribute('d', d);
      var placed = [];
      var marks = s.ticks.length ? tickCounts(s) : null;
      for (var i = 0; i < s.n; i++) {
        var sd = seg(p[i], p[(i + 1) % s.n]);
        s.sides[i].setAttribute('d', sd);
        if (s.hits[i]) s.hits[i].setAttribute('d', sd);
        if (marks) s.ticks[i].setAttribute('d', tickPath(p[i], p[(i + 1) % s.n], marks[i]));
        if (s.angles[i]) s.angles[i].setAttribute('d', anglePath(p[(i + s.n - 1) % s.n], p[i], p[(i + 1) % s.n]));
        if (s.labels[i]) {
          var txt = String(s.labelText(i));
          s.labels[i].textContent = txt;
          if (txt) placeLabel(i, txt, placed);
        }
        if (s.vertices[i]) {
          s.vertices[i].setAttribute('cx', p[i].x); s.vertices[i].setAttribute('cy', p[i].y);
          s.vhits[i].setAttribute('cx', p[i].x); s.vhits[i].setAttribute('cy', p[i].y);
        }
      }
      var top = p[0];
      s.tip.setAttribute('cx', top.x); s.tip.setAttribute('cy', top.y);
      if (s.name) {
        var c = centroid(p), low = -Infinity, high = Infinity;
        p.forEach(function (q) { low = Math.max(low, q.y); high = Math.min(high, q.y); });
        var nameGap = o.nameGap == null ? 40 : o.nameGap;
        s.name.setAttribute('x', c.x);
        s.name.setAttribute('y', o.nameAbove ? high - nameGap : low + nameGap);
      }
      paintInks(s);
    };
    /* The ink side i wears (an index into --side-0..5), for the working that
       writes its length in the same colour; null for a one-line shape. */
    s.ink = function (i) { return s.inks[i] == null ? null : s.inks[i]; };
    s.set(pts);
    /* Every mark in the group, for a wipe to fade. */
    s.parts = function () { return [g]; };
    if (host) host.appendChild(g);
    return s;
  }

  global.Shapes = {
    NS: NS, el: el, round2: round2, INKS: SIDE_INKS,
    regular: regular, rect: rect, pathOf: pathOf, seg: seg, dist: dist,
    centroid: centroid, outward: outward, labelAt: labelAt, build: build
  };
})(window);
