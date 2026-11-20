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
  var SIDE_INKS = 8;                /* --side-0 .. --side-7 in style.css */

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
  /* The unit normal of side i that points AWAY from the shape. */
  function outward(pts, i) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    var dx = b.x - a.x, dy = b.y - a.y;
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var n = { x: -dy / L, y: dx / L };
    var c = centroid(pts), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((m.x - c.x) * n.x + (m.y - c.y) * n.y < 0) { n.x = -n.x; n.y = -n.y; }
    return n;
  }
  /* The midpoint of side i, pushed `off` units outward -- where its length
     is written. */
  function labelAt(pts, i, off) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    var n = outward(pts, i);
    return { x: round2((a.x + b.x) / 2 + n.x * off), y: round2((a.y + b.y) / 2 + n.y * off) };
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

  /* opts:
       inks     true: one ink per side LENGTH (--side-i; equal sides share
                one, see above); a list of ink indices to use one per side;
                false: the shape's one line
       inkFrom  with inks true, the ink the first length takes (default 0),
                so shapes side by side can each wear their own
       labels   one string per side, or a function(i, len) -> string, or
                null for none
       offset   how far outside the side its label sits (default 26)
       hits     true: a tappable band over each side
       vertices true: a draggable dot on each corner
       perim/area  the warm-up's two highlights
       name     a word written under the shape (a key, read through T) */
  function build(host, pts, opts) {
    var o = opts || {};
    var g = el('g', { 'class': 'shape' + (o.cls ? ' ' + o.cls : '') });
    if (o.id) g.setAttribute('id', o.id);
    var n = pts.length;
    var s = {
      g: g, pts: pts.slice(), n: n, opts: o,
      fill: el('path', { 'class': 'shape__fill' }),
      area: o.area ? el('path', { 'class': 'shape__area' }) : null,
      perim: o.perim ? el('path', { 'class': 'shape__perim' }) : null,
      sides: [], hits: [], labels: [], vertices: [], vhits: [], inks: [], inkMap: null,
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
        var t = el('text', { 'class': 'figure-label shape__label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
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
    /* Everything re-laid out from the points. */
    s.set = function (pts2) {
      if (pts2) s.pts = pts2.slice();
      var p = s.pts, d = pathOf(p);
      s.fill.setAttribute('d', d);
      s.outline.setAttribute('d', d);
      if (s.area) s.area.setAttribute('d', d);
      if (s.perim) s.perim.setAttribute('d', d);
      if (s.hitbox) s.hitbox.setAttribute('d', d);
      var off = o.offset == null ? 26 : o.offset;
      for (var i = 0; i < s.n; i++) {
        var sd = seg(p[i], p[(i + 1) % s.n]);
        s.sides[i].setAttribute('d', sd);
        if (s.hits[i]) s.hits[i].setAttribute('d', sd);
        if (s.labels[i]) {
          var at = labelAt(p, i, off);
          s.labels[i].setAttribute('x', at.x);
          s.labels[i].setAttribute('y', at.y);
          s.labels[i].textContent = s.labelText(i);
        }
        if (s.vertices[i]) {
          s.vertices[i].setAttribute('cx', p[i].x); s.vertices[i].setAttribute('cy', p[i].y);
          s.vhits[i].setAttribute('cx', p[i].x); s.vhits[i].setAttribute('cy', p[i].y);
        }
      }
      var top = p[0];
      s.tip.setAttribute('cx', top.x); s.tip.setAttribute('cy', top.y);
      if (s.name) {
        var c = centroid(p), low = 0;
        p.forEach(function (q) { low = Math.max(low, q.y); });
        s.name.setAttribute('x', c.x);
        s.name.setAttribute('y', low + (o.nameGap == null ? 40 : o.nameGap));
      }
      paintInks(s);
    };
    /* The ink side i wears (an index into --side-0..7), for the working that
       writes its length in the same colour; null for a one-line shape. */
    s.ink = function (i) { return s.inks[i] == null ? null : s.inks[i]; };
    s.set(pts);
    /* Every mark in the group, for a wipe to fade. */
    s.parts = function () { return [g]; };
    if (host) host.appendChild(g);
    return s;
  }

  global.Shapes = {
    NS: NS, el: el, round2: round2,
    regular: regular, rect: rect, pathOf: pathOf, seg: seg, dist: dist,
    centroid: centroid, outward: outward, labelAt: labelAt, build: build
  };
})(window);
