/* ==========================================================================
 * animations.js -- the beats this lesson is built out of, and its sound
 * --------------------------------------------------------------------------
 * Everything here returns a GSAP animation made through motion.js, so every
 * one is tracked: Skip lands them all on their last frame, and a Replay kills
 * them and hands back whatever they had written inline. Nothing in this file
 * decides WHEN it happens -- that is pages.js and the sections.
 *
 * Load order: js/motion.js -> js/flow.js -> js/shapes.js -> js/animations.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var S = global.Shapes;
  var NS = 'http://www.w3.org/2000/svg';

  /* ======================================================================
   * Sound
   * ====================================================================== */
  var CLIPS = {
    click:   'assets/audio/button-click.webm',
    correct: 'assets/audio/correct-answer.webm',
    wrong:   'assets/audio/incorrect-answer.webm',
    cheer:   'assets/audio/confetti-sound.webm'
  };
  var A = global.GameAudio;
  var live = Object.create(null);
  var RING_MS = { correct: 600, wrong: 600 };
  var rang = Object.create(null);

  function sfx(key) {
    var src = CLIPS[key];
    if (!src || !A || !M || !M.mayPlay(key)) return;
    if (live[key]) live[key].stop();
    var h = live[key] = A.play(src, { keep: true });
    h.done.then(function () { if (live[key] === h) live[key] = null; });
    rang[key] = performance.now();
  }
  function ringing() {
    var now = performance.now(), left = 0;
    Object.keys(RING_MS).forEach(function (k) {
      if (rang[k]) left = Math.max(left, rang[k] + RING_MS[k] - now);
    });
    return left;
  }
  /* The pop a mark makes as it lands: the click, soft and a touch off its
     own pitch each time. */
  var POP_GATE = 46;
  var popAt = 0;
  function pop() {
    var now = performance.now();
    if (!A || (M.isMuted && M.isMuted())) return;
    if (now - popAt < POP_GATE) return;
    popAt = now;
    A.play(CLIPS.click, { keep: true, volume: 0.3, rate: 0.94 + Math.random() * 0.2 });
  }

  /* ======================================================================
   * Strokes -- the dash trick
   * ====================================================================== */
  function pathLength(p) {
    try { return p.getTotalLength ? p.getTotalLength() : 0; } catch (e) { return 0; }
  }
  function stroke(tl, path, at, seconds, ease) {
    var len = pathLength(path) || 1;
    path.style.strokeDasharray = len + ' ' + len;
    path.style.strokeDashoffset = len;
    tl.to(path, { strokeDashoffset: 0, duration: M.dur(seconds), ease: ease || 'power2.out' }, M.gap(at));
  }
  function undash(paths) {
    paths.forEach(function (p) {
      if (!p || !p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
  }

  /* ======================================================================
   * The board
   * ====================================================================== */
  function boardIn(board) {
    board.classList.add('is-animating', 'show');
    board.setAttribute('aria-hidden', 'false');
    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        M.set(board, { clearProps: 'opacity,transform' });
        board.classList.remove('is-animating');
      }
    });
    tl.fromTo(board, { opacity: 0, scale: 0.965, y: 14 },
                     { opacity: 1, scale: 1, y: 0, duration: M.dur(0.62), ease: 'power3.out' });
    return tl;
  }
  function boardOut(board) {
    board.classList.add('is-animating');
    var tl = M.timeline({
      willChange: board, willChangeValue: 'transform, opacity',
      revert: function () {
        board.classList.remove('show', 'is-animating');
        board.setAttribute('aria-hidden', 'true');
        M.set(board, { clearProps: 'opacity,transform' });
      }
    });
    tl.to(board, { opacity: 0, scale: 0.965, y: 14, duration: M.dur(0.5), ease: 'power2.in' });
    return tl;
  }

  /* ======================================================================
   * Shapes
   * ====================================================================== */

  /* The shape made by a pen: a dot lands on the first corner and runs once
     round the outline, each side drawn in its own ink behind it; then the
     colour is poured in. ONE eased stroke for the whole outline -- the pen
     gathers speed off the first corner and settles into the last -- rather
     than a stop and start at every corner. `seconds` is the outline's time;
     `o.ease` the pen's (default sine.inOut). Each corner pops as it is
     reached. Every length is measured before the pen moves. */
  function drawShape(shape, opts) {
    var o = opts || {};
    var seconds = o.time || 1.6;
    var pts = shape.pts, n = shape.n;
    var total = 0, lens = [], ends = [], dash = [];
    for (var i = 0; i < n; i++) {
      lens.push(shape.len(i));
      total += lens[i];
      ends.push(total);
      dash.push(pathLength(shape.sides[i]) || lens[i] || 1);
    }
    var START = 0.26;
    var tip = shape.tip;
    M.set(tip, { opacity: 1, scale: 0, x: 0, y: 0, transformOrigin: 'center center' });
    var x0 = pts[0].x, y0 = pts[0].y;
    shape.sides.forEach(function (sd, k) {
      sd.style.strokeDasharray = dash[k] + ' ' + dash[k];
      sd.style.strokeDashoffset = dash[k];
    });
    M.set(shape.sides, { opacity: 1 });

    var pen = { d: 0 }, corner = 0;
    function draw() {
      var d = pen.d;
      for (var k = 0; k < n; k++) {
        var from = ends[k] - lens[k];
        var t = Math.max(0, Math.min(1, (d - from) / (lens[k] || 1)));
        shape.sides[k].style.strokeDashoffset = dash[k] * (1 - t);
      }
      var j = 0;
      while (j < n - 1 && d > ends[j]) j++;
      var a = pts[j], b = pts[(j + 1) % n];
      var f = Math.max(0, Math.min(1, (d - (ends[j] - lens[j])) / (lens[j] || 1)));
      M.set(tip, { x: a.x + (b.x - a.x) * f - x0, y: a.y + (b.y - a.y) * f - y0 });
      while (corner < n && d >= ends[corner] - 0.5) { corner++; pop(); }
    }

    var tl = M.timeline({
      revert: function () {
        undash(shape.sides);
        M.set(tip, { clearProps: 'transform,opacity' });
      }
    });
    tl.to(tip, { scale: 1, duration: M.dur(0.24), ease: M.POP }, 0);
    tl.call(pop, null, 0);
    tl.to(pen, { d: total, duration: M.dur(seconds), ease: o.ease || 'sine.inOut', onUpdate: draw }, M.gap(START));
    tl.to(tip, { scale: 0, opacity: 0, duration: M.dur(0.22), ease: 'power2.in' }, M.gap(START + seconds));
    if (o.fill !== false) tl.add(fillShape(shape, o.deep), M.gap(START + seconds + 0.05));
    return tl;
  }

  /* The colour poured in, growing from just inside the outline -- about the
     shape's own middle: svgOrigin is in the figure's units, where a px
     transformOrigin would be read from the fill's bounding box and grow it
     from off to one side. */
  function fillShape(shape, deep) {
    var c = shape.centre();
    if (deep) shape.fill.classList.add('is-deep');
    var tl = M.timeline({ willChange: shape.fill, willChangeValue: 'transform, opacity' });
    tl.fromTo(shape.fill,
      { opacity: 0, scale: 0.82, svgOrigin: c.x + ' ' + c.y },
      { opacity: 1, scale: 1, duration: M.dur(0.5), ease: 'power2.out' });
    return tl;
  }

  /* The whole shape at once -- sides, fill and labels -- for a shape that
     is not the thing being watched (a jump, a quick build). */
  function showShape(shape, opts) {
    var o = opts || {};
    var els = shape.sides.concat([shape.fill]).concat(o.labels ? shape.labels : []);
    if (shape.name && o.name) els.push(shape.name);
    var tl = M.timeline({ willChange: els, willChangeValue: 'opacity' });
    tl.to(els, { opacity: 1, duration: M.dur(o.time || 0.4), ease: 'power2.out' });
    return tl;
  }
  function putShape(shape, opts) {
    var o = opts || {};
    var els = shape.sides.concat([shape.fill]).concat(o.labels ? shape.labels : []);
    if (shape.name && o.name) els.push(shape.name);
    M.set(els, { opacity: 1 });
  }

  /* The lengths written beside the sides, one after another, each landing
     with the pop every label in the game lands with. */
  function labelsIn(texts, each) {
    var list = [].concat(texts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    list.forEach(function (t, i) {
      var at = i * (each == null ? 0.16 : each);
      M.set(t, { opacity: 0, scale: 0.6, transformOrigin: 'center center' });
      tl.to(t, { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'back.out(1.7)' }, M.gap(at));
      tl.call(pop, null, M.gap(at));
    });
    return tl;
  }
  function labelIn(text) { return labelsIn([text]); }
  function labelsOut(texts) {
    var list = [].concat(texts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    tl.to(list, { opacity: 0, duration: M.dur(0.26), ease: 'power2.in' });
    return tl;
  }
  /* Marks left standing, taken off together. */
  function marksOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({
      willChange: list, willChangeValue: 'opacity',
      revert: function () { M.set(list, { clearProps: 'opacity' }); }
    });
    tl.to(list, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }

  /* ---- a side, lit ---------------------------------------------------------
     The side swells in its own ink under a bloom; the others stand back. A
     loop of unknown length, so a class, as every held light in the game is.
     `label`, if given, breathes with it. */
  var SIDE_W = 5, SIDE_LIT_W = 9;

  function lightSide(shape, i, opts) {
    var o = opts || {};
    var side = shape.sides[i];
    var tl = M.timeline({ willChange: side, willChangeValue: 'stroke-width' });
    side.classList.add('is-lit');
    tl.to(side, { strokeWidth: SIDE_LIT_W, autoRound: false, duration: M.dur(0.28), ease: 'power2.out' }, 0);
    if (o.label && shape.labels[i]) {
      tl.fromTo(shape.labels[i], { scale: 1, transformOrigin: 'center center' },
        { scale: 1.22, duration: M.dur(0.22), ease: 'power2.out' }, 0)
        .to(shape.labels[i], { scale: 1, duration: M.dur(0.36), ease: M.POP }, M.gap(0.22));
    }
    if (o.dim) {
      var others = shape.sides.filter(function (s2, k) { return k !== i && !s2.classList.contains('is-lit'); });
      tl.to(others, { opacity: 0.35, duration: M.dur(0.3), ease: 'power2.inOut' }, 0);
    }
    return tl;
  }
  function unlightSide(shape, i) {
    var side = shape.sides[i];
    var tl = M.timeline({
      revert: function () { side.classList.remove('is-lit'); M.set(side, { clearProps: 'strokeWidth' }); }
    });
    tl.to(side, { strokeWidth: SIDE_W, autoRound: false, duration: M.dur(0.3), ease: 'power2.out' }, 0);
    return tl;
  }
  function unlightAll(shape) {
    var tl = M.timeline({
      revert: function () {
        shape.sides.forEach(function (s2) { s2.classList.remove('is-lit'); });
        M.set(shape.sides, { clearProps: 'strokeWidth' });
      }
    });
    tl.to(shape.sides, { strokeWidth: SIDE_W, opacity: 1, autoRound: false, duration: M.dur(0.3), ease: 'power2.out' }, 0);
    return tl;
  }
  /* Every side breathing, held, and released. */
  function pulseHold(marks) {
    [].concat(marks).filter(Boolean).forEach(function (m) {
      m.classList.remove('is-pulsing');
      void m.getBoundingClientRect().width;
      m.style.setProperty('--pulse-times', 'infinite');
      m.classList.add('is-pulsing');
    });
  }
  function pulseRelease(marks) {
    var list = [].concat(marks).filter(Boolean);
    var tl = M.timeline({ revert: function () { M.set(list, { clearProps: 'strokeWidth' }); } });
    list.forEach(function (m) {
      var now = parseFloat(getComputedStyle(m).strokeWidth);
      m.classList.remove('is-pulsing');
      m.style.removeProperty('--pulse-times');
      var rest = parseFloat(getComputedStyle(m).strokeWidth);
      tl.fromTo(m, { strokeWidth: now }, { strokeWidth: rest, autoRound: false, duration: M.dur(0.4), ease: 'power2.out' }, 0);
    });
    return tl;
  }
  var PULSE_SECS = 1.05;
  function partPulse(marks, times) {
    var list = [].concat(marks).filter(Boolean);
    var n = times || 2;
    function off() {
      list.forEach(function (m) { m.classList.remove('is-pulsing'); m.style.removeProperty('--pulse-times'); });
    }
    var tl = M.timeline({ revert: off });
    tl.call(function () {
      list.forEach(function (m) {
        m.classList.remove('is-pulsing');
        void m.getBoundingClientRect().width;
        m.style.setProperty('--pulse-times', String(n));
        m.classList.add('is-pulsing');
      });
    }, null, 0);
    tl.call(function () {}, null, M.gap(PULSE_SECS * n));
    return tl;
  }

  /* ---- the warm-up's two highlights ---------------------------------------
     The boundary: a thick golden stroke run once round the shape (the dash
     trick), left breathing. The inside: a deep wash poured in from the
     middle, left breathing. */
  function perimOn(shape, seconds) {
    var p = shape.perim;
    M.set(p, { opacity: 1 });
    var tl = M.timeline({ revert: function () { undash([p]); p.classList.add('is-pulsing'); } });
    stroke(tl, p, 0, seconds || 1.1, 'power1.inOut');
    return tl;
  }
  function areaOn(shape, seconds) {
    var a = shape.area, c = shape.centre();
    a.classList.remove('is-pulsing');
    var tl = M.timeline({
      willChange: a, willChangeValue: 'transform, opacity',
      revert: function () { a.classList.add('is-pulsing'); }
    });
    tl.fromTo(a, { opacity: 0, scale: 0.2, transformOrigin: c.x + 'px ' + c.y + 'px' },
                 { opacity: 1, scale: 1, duration: M.dur(seconds || 0.8), ease: 'power2.out' });
    return tl;
  }
  function highlightOff(shape) {
    var els = [shape.perim, shape.area].filter(Boolean);
    var tl = M.timeline({
      revert: function () {
        els.forEach(function (e) { e.classList.remove('is-pulsing'); });
        M.set(els, { clearProps: 'opacity,transform' });
        undash(els);
      }
    });
    tl.to(els, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }

  /* ---- the walk round the boundary ----------------------------------------
     A light sets off from the first corner and runs once round the shape,
     clockwise, with a trail behind it -- the distance all the way round,
     travelled. `onSide(i)` is called as the light finishes side i, so the
     length can be added as it is walked. The skate's own paths are built
     onto the shape the first time and kept. `path` may be a custom closed
     path (a composite's outer boundary) instead of the shape's own. */
  var TAILS = [60, 150, 1];

  function skateOf(shape, d) {
    if (!shape.skate) {
      var g = S.el('g', { 'class': 'skate' });
      var cls = ['skate__halo', 'skate__trail', 'skate__head'];
      shape.skate = { g: g, paths: cls.map(function (c) {
        var p = S.el('path', { 'class': c });
        g.appendChild(p);
        return p;
      }) };
      shape.g.appendChild(g);
    }
    shape.skate.paths.forEach(function (p) { p.setAttribute('d', d); });
    return shape.skate;
  }

  function walk(shape, seconds, opts) {
    var o = opts || {};
    var d = o.path || S.pathOf(shape.pts);
    var sk = skateOf(shape, d);
    var paths = sk.paths;
    var len = pathLength(paths[0]) || 1;
    var laps = o.laps || 1;
    paths.forEach(function (p, i) {
      p.style.strokeDasharray = TAILS[i] + ' ' + (len + TAILS[i]);
    });
    function place(h) {
      paths.forEach(function (p, i) { p.style.strokeDashoffset = TAILS[i] - h; });
    }
    place(0);
    /* where each side ends, along the path */
    var ends = [], acc = 0;
    if (!o.path) {
      for (var i = 0; i < shape.n; i++) { acc += shape.len(i); ends.push(acc); }
    } else if (o.ends) { ends = o.ends; }
    var fired = 0;
    var head = { h: 0 };
    var tl = M.timeline({
      revert: function () {
        undash(paths);
        M.set(sk.g, { clearProps: 'opacity' });
      }
    });
    tl.set(sk.g, { opacity: 1 }, 0)
      .to(head, {
        h: len * laps, duration: M.dur(seconds), ease: o.ease || 'power1.inOut',
        onUpdate: function () {
          place(head.h);
          while (o.onSide && fired < ends.length && head.h >= ends[fired] - 0.5) {
            o.onSide(fired);
            fired++;
          }
        }
      }, 0)
      .to(sk.g, { opacity: 0, duration: M.dur(0.45), ease: 'power2.in' }, M.gap(Math.max(0, seconds - 0.2)));
    tl.call(function () {
      while (o.onSide && fired < ends.length) { o.onSide(fired); fired++; }
    }, null, M.gap(seconds));
    return tl;
  }

  /* The shape's points carried from where they are to `to`, every mark in
     the group re-laid out each frame. */
  function morphShape(shape, to, seconds, ease) {
    var from = shape.pts.map(function (p) { return { x: p.x, y: p.y }; });
    var pen = { t: 0 };
    var tl = M.timeline({ revert: function () { pen.t = 1; shape.set(to); } });
    tl.to(pen, {
      t: 1, duration: M.dur(seconds || 1), ease: ease || 'power2.inOut',
      onUpdate: function () {
        shape.set(from.map(function (p, i) {
          return { x: p.x + (to[i].x - p.x) * pen.t, y: p.y + (to[i].y - p.y) * pen.t };
        }));
      }
    });
    return tl;
  }

  /* The whole group carried somewhere, or scaled, as one thing. */
  function moveGroup(g, vars, seconds, ease) {
    var tl = M.timeline({ willChange: g, willChangeValue: 'transform' });
    tl.to(g, M.set ? Object.assign({ duration: M.dur(seconds || 0.7), ease: ease || 'power2.inOut' }, vars) : vars);
    return tl;
  }
  function slideGroup(g, x, y, seconds) {
    return moveGroup(g, { x: x, y: y || 0 }, seconds || 0.75);
  }

  /* A side and its label pushed out by (dx, dy): a translate, so the
     length plainly does not change. */
  function pushSide(side, label, dx, dy, seconds) {
    var els = [side, label].filter(Boolean);
    var tl = M.timeline({ willChange: els, willChangeValue: 'transform' });
    tl.to(els, { x: dx, y: dy, duration: M.dur(seconds || 0.8), ease: 'power2.inOut' }, 0);
    return tl;
  }

  var SHAKE = [-5, 5, -5, 5, -4, 4, 0];
  function shake(tl, el, seconds) {
    var each = M.dur(seconds || 0.3) / SHAKE.length;
    SHAKE.forEach(function (x, i) {
      tl.to(el, { x: x, duration: each, ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' });
    });
  }
  /* ---- the swipe sort --------------------------------------------------------
     Two side panels sliding in from their own edges; the ice card rising
     into the middle; the card leaning a panel in as it nears, flying into
     it when it is right (and staying there, small), springing home when it
     is wrong. Every card transform is about the card's own centre (set as
     its svgOrigin when it is built). */
  function zoneOrigin(z) { return z.centre.x + ' ' + z.centre.y; }
  function zonesIn(zones) {
    var gs = zones.map(function (z) { return z.g; });
    var tl = M.timeline({ willChange: gs, willChangeValue: 'transform, opacity' });
    zones.forEach(function (z, i) {
      tl.fromTo(z.g, { opacity: 0, x: z.side === 'right' ? 60 : -60, svgOrigin: zoneOrigin(z) },
        { opacity: 1, x: 0, duration: M.dur(0.5), ease: M.POP }, M.gap(i * 0.12));
      tl.call(pop, null, M.gap(i * 0.12));
    });
    tl.call(function () { M.set(gs, { clearProps: 'opacity' }); gs.forEach(function (g) { g.classList.add('is-shown'); }); });
    return tl;
  }
  function zonesOut(zones) {
    var gs = zones.map(function (z) { return z.g; });
    var kept = zones.reduce(function (a, z) { return a.concat(z.kept.map(function (c) { return c.g; })); }, []);
    var all = gs.concat(kept);
    var tl = M.timeline({ willChange: all, willChangeValue: 'opacity' });
    tl.to(all, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' });
    return tl;
  }
  function zoneLean(z, on) {
    return M.to(z.g, { scale: on ? 1.05 : 1, svgOrigin: zoneOrigin(z), duration: M.dur(on ? 0.16 : 0.2),
                       ease: on ? 'power2.out' : 'power2.inOut', overwrite: 'auto' });
  }
  function zoneRight(z) {
    z.g.classList.remove('is-wrong', 'is-over');
    z.g.classList.add('is-right');
    sfx('correct');
    var tl = M.timeline({ revert: function () { z.g.classList.remove('is-right'); M.set(z.g, { clearProps: 'transform' }); } });
    tl.to(z.g, { scale: 1.06, svgOrigin: zoneOrigin(z), duration: M.dur(0.14), ease: 'power2.out' }, M.gap(0.62))
      .to(z.g, { scale: 1, duration: M.dur(0.36), ease: M.POP })
      .to({}, { duration: M.dur(0.4) });
    return tl;
  }
  function zoneWrong(z) {
    z.g.classList.remove('is-over');
    z.g.classList.add('is-wrong');
    sfx('wrong');
    var tl = M.timeline({
      willChange: z.g, willChangeValue: 'transform',
      revert: function () { z.g.classList.remove('is-wrong'); M.set(z.g, { clearProps: 'transform' }); }
    });
    tl.to(z.g, { scale: 1, duration: M.dur(0.12), ease: 'power2.out' }, 0);
    shake(tl, z.g);
    tl.to({}, { duration: M.dur(0.5) });
    return tl;
  }
  function swipeIn(card) {
    var tl = M.timeline({ willChange: card.g, willChangeValue: 'transform, opacity' });
    tl.fromTo(card.g, { opacity: 0, y: 34, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.45), ease: M.OUT });
    tl.call(function () { M.set(card.g, { clearProps: 'opacity' }); });
    return tl;
  }
  /* let go short of a panel: back to the middle, with a little overshoot */
  function swipeHome(card) {
    return M.to(card.g, { x: 0, y: 0, rotation: 0, scale: 1, duration: M.dur(0.38), ease: 'back.out(1.6)', overwrite: 'auto' });
  }
  /* sorted: into the panel, shrinking onto its shelf; the card's ice melts
     away on the way and the shape alone is kept */
  function swipeInto(card, dx, dy, k) {
    var x = gsap.getProperty(card.g, 'x') || 0;
    var tl = M.timeline({ willChange: [card.g, card.face], willChangeValue: 'transform, opacity' });
    tl.to(card.g, { x: x + (dx - x) * 0.18, y: -18, rotation: dx < 0 ? -6 : 6, scale: 1.06,
                    duration: M.dur(0.16), ease: 'power2.out', overwrite: 'auto' })
      .to(card.g, { x: dx, y: dy, rotation: 0, scale: k, duration: M.dur(0.55), ease: 'power2.inOut' })
      .to(card.face, { opacity: 0, duration: M.dur(0.34), ease: 'power2.in' }, M.gap(0.2));
    tl.call(pop, null, '>-0.05');
    return tl;
  }
  /* refused: home, then a head-shake where it lands */
  function swipeWrong(card) {
    var tl = M.timeline({ willChange: card.g, willChangeValue: 'transform' });
    tl.to(card.g, { x: 0, y: 0, rotation: 0, scale: 1, duration: M.dur(0.32), ease: 'power3.out', overwrite: 'auto' });
    var each = M.dur(0.3) / SHAKE.length;
    SHAKE.forEach(function (s, i) {
      tl.to(card.g, { x: s * 1.4, rotation: s * 0.4, duration: each, ease: i === SHAKE.length - 1 ? 'power2.out' : 'none' });
    });
    return tl;
  }
  /* a tap on the card: a small sway left and right -- it goes sideways */
  function swipeNudge(card) {
    var tl = M.timeline({ willChange: card.g, willChangeValue: 'transform' });
    tl.to(card.g, { x: -26, rotation: -4, duration: M.dur(0.18), ease: 'power2.out', overwrite: 'auto' })
      .to(card.g, { x: 26, rotation: 4, duration: M.dur(0.26), ease: 'power2.inOut' })
      .to(card.g, { x: 0, y: 0, rotation: 0, scale: 1, duration: M.dur(0.3), ease: 'back.out(1.6)' });
    return tl;
  }

  /* ---- the name boxes -------------------------------------------------- */
  function boxIn(box) {
    var c = box.centre;
    var tl = M.timeline();
    tl.fromTo(box.g, { opacity: 0, scale: 0.72, transformOrigin: c.x + 'px ' + c.y + 'px' },
      { opacity: 1, scale: 1, duration: M.dur(0.4), ease: M.POP });
    tl.call(pop, null, 0);
    tl.call(function () { box.g.classList.add('is-shown'); M.set(box.g, { clearProps: 'opacity' }); });
    return tl;
  }
  function boxRight(box) {
    box.g.classList.remove('is-wrong', 'is-over');
    box.g.classList.add('is-right');
    sfx('correct');
    var c = box.centre;
    M.set(box.text, { opacity: 0, scale: 0.7, transformOrigin: 'center center' });
    M.set(box.badge, { opacity: 1, scale: 0, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: [box.text, box.badge], willChangeValue: 'transform, opacity' });
    tl.to(box.rect, { scale: 1.05, transformOrigin: c.x + 'px ' + c.y + 'px', duration: M.dur(0.14), ease: 'power2.out' }, 0)
      .to(box.rect, { scale: 1, duration: M.dur(0.3), ease: M.POP }, M.gap(0.14))
      .to(box.text, { opacity: 1, scale: 1, duration: M.dur(0.36), ease: 'back.out(1.7)' }, M.gap(0.06))
      .to(box.badge, { scale: 1, duration: M.dur(0.34), ease: M.POP }, M.gap(0.16));
    return tl;
  }
  function boxWrong(box) {
    box.g.classList.remove('is-over');
    box.g.classList.add('is-wrong');
    sfx('wrong');
    var tl = M.timeline({
      willChange: box.g, willChangeValue: 'transform',
      revert: function () { box.g.classList.remove('is-wrong'); M.set(box.g, { clearProps: 'transform' }); }
    });
    shake(tl, box.g);
    tl.to({}, { duration: M.dur(0.5) });
    return tl;
  }

  /* ---- the names in the tray, and the answers ----------------------------- */
  function trayIn(tray, chips) {
    tray.removeAttribute('hidden');
    var tl = M.timeline({ willChange: chips, willChangeValue: 'transform, opacity' });
    tl.fromTo(chips, { opacity: 0, y: 14, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.36), ease: M.POP, stagger: M.gap(0.08) });
    return tl;
  }
  function trayOut(tray, chips) {
    var tl = M.timeline({
      willChange: chips, willChangeValue: 'transform, opacity',
      revert: function () { tray.setAttribute('hidden', ''); }
    });
    if (chips.length) tl.to(chips, { opacity: 0, y: 10, duration: M.dur(0.26), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }
  function choiceRight(btn) {
    btn.classList.remove('is-wrong');
    btn.classList.add('is-right');
    sfx('correct');
    return M.correct(btn);
  }
  function choiceWrong(btn) {
    btn.classList.add('is-wrong');
    sfx('wrong');
    var tl = M.incorrect(btn);
    return tl;
  }
  /* The answers under the bird beside the shape, as the circle game brings
     its formulas in (circum.js optsIn / optsOut): one by one, each pill its
     own arrival, and away again a beat apart. Hidden first, or the row
     flashes complete for the frame before the tween's first. */
  function optsIn(list) {
    M.set(list, { opacity: 0 });
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.fromTo(list, { opacity: 0, y: 14, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.4), ease: M.POP, stagger: M.gap(0.3) });
    return tl;
  }
  function optsOut(list) {
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    if (list.length) tl.to(list, { opacity: 0, y: 10, scale: 0.94, duration: M.dur(0.3), ease: 'power2.in', stagger: M.gap(0.08) });
    return tl;
  }
  function chipHome(chip) {
    return M.to(chip, { x: 0, y: 0, scale: 1, duration: M.dur(0.36), ease: 'power3.out', overwrite: 'auto' });
  }
  function chipDock(chip, dx, dy) {
    var x = gsap.getProperty(chip, 'x') || 0, y = gsap.getProperty(chip, 'y') || 0;
    return M.to(chip, {
      x: x + dx, y: y + dy, scale: 0.55, opacity: 0, duration: M.dur(0.4), ease: 'power2.inOut', overwrite: 'auto',
      onComplete: function () { chip.classList.add('is-docked'); M.set(chip, { clearProps: 'transform,opacity' }); }
    });
  }

  /* ---- cards and rows in the DOM layer ----------------------------------- */
  function cardIn(el, vars) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 14, scale: 0.96 },
      Object.assign({ opacity: 1, y: 0, scale: 1, duration: M.dur(0.42), ease: 'power3.out' }, vars || {}));
    return tl;
  }
  function cardsIn(els, each) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    tl.fromTo(list, { opacity: 0, y: 14, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: M.dur(0.42), ease: 'power3.out', stagger: M.gap(each == null ? 0.12 : each) });
    return tl;
  }
  function cardOut(els) {
    var list = [].concat(els).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'transform, opacity' });
    if (list.length) tl.to(list, { opacity: 0, y: -8, duration: M.dur(0.26), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }
  /* A row -- a line of working -- arriving under the one before. */
  function rowIn(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: M.dur(0.34), ease: 'power3.out' });
    return tl;
  }
  /* A term landing in a sum, with the pop. */
  function termIn(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: M.dur(0.34), ease: 'back.out(1.8)' });
    tl.call(pop, null, 0);
    return tl;
  }
  /* The rule, set down as a pill: rises and settles. */
  function ruleIn(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform, opacity' });
    tl.fromTo(el, { opacity: 0, y: 14, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: M.dur(0.48), ease: 'back.out(1.6)' });
    return tl;
  }
  /* A word that is answered glows once. */
  function emphasise(el) {
    return M.correct(el);
  }

  /* The rangoli's lights, switched on one after another round the edge. */
  function lightsOn(dots, each) {
    var tl = M.timeline({ willChange: dots, willChangeValue: 'transform, opacity' });
    dots.forEach(function (d, i) {
      M.set(d, { opacity: 0, scale: 0, transformOrigin: 'center center' });
      tl.to(d, { opacity: 1, scale: 1, duration: M.dur(0.22), ease: M.POP }, M.gap(i * (each || 0.06)));
      if (i % 3 === 0) tl.call(pop, null, M.gap(i * (each || 0.06)));
    });
    return tl;
  }

  /* ======================================================================
   * Clearing up
   * ====================================================================== */
  function clearFigure(parts) {
    var list = [].concat(parts).filter(Boolean);
    var tl = M.timeline({ willChange: list, willChangeValue: 'opacity' });
    if (list.length) tl.to(list, { opacity: 0, duration: M.dur(0.36), ease: 'power2.in', stagger: M.gap(0.03) });
    return tl;
  }

  /* ======================================================================
   * Text boxes and controls
   * ====================================================================== */
  var TAIL_X = 0.78 + 0.76 / 2;
  var TAIL_BORDER = 4;
  function tailOrigin(bubble) {
    var style = getComputedStyle(bubble);
    /* The bubble beside the shape (.bubble--perch, style.css) wears the
       circle game's side-pane tail, placed off its own em and the pane's
       container units, so its middle is read off the drawn tail rather than
       summed here. Resolved pixels: GSAP splits transform-origin on spaces,
       so a raw calc() could not be passed through. */
    if (bubble.classList.contains('bubble--perch')) {
      var tail = bubble.querySelector('.bubble-tail');
      if (tail) {
        var ts = getComputedStyle(tail);
        return (parseFloat(style.borderLeftWidth) + parseFloat(ts.left) + parseFloat(ts.width) / 2) + 'px 100%';
      }
    }
    var em = parseFloat(style.fontSize) || 16;
    return (TAIL_BORDER + em * TAIL_X) + 'px 100%';
  }
  function bubbleArm(bubble) {
    bubble.removeAttribute('hidden');
    M.set(bubble, { opacity: 0, scale: 0.15, transformOrigin: tailOrigin(bubble) });
  }
  function bubbleIn(bubble) {
    var tl = M.timeline({ willChange: bubble, willChangeValue: 'transform, opacity' });
    tl.to(bubble, { opacity: 1, scale: 1, transformOrigin: tailOrigin(bubble), duration: M.dur(0.44), ease: 'back.out(1.6)' });
    return tl;
  }
  function bubbleOut(bubble) {
    var tl = M.timeline({
      willChange: bubble, willChangeValue: 'transform, opacity',
      revert: function () { bubble.setAttribute('hidden', ''); M.set(bubble, { clearProps: 'opacity,transform' }); }
    });
    tl.to(bubble, { opacity: 0, scale: 0.9, transformOrigin: tailOrigin(bubble), duration: M.dur(0.24), ease: 'power2.in' });
    return tl;
  }

  /* The mascot's jump, in four halves (see mascotJumpIn in pages.js). */
  function hopUp(hopper, y) {
    var tl = M.timeline({ willChange: hopper, willChangeValue: 'transform' });
    tl.to(hopper, { y: y, duration: M.dur(0.38), ease: 'power2.out' });
    return tl;
  }
  function hopDown(hopper, y) {
    var tl = M.timeline({ willChange: hopper, willChangeValue: 'transform' });
    tl.to(hopper, { y: y, duration: M.dur(0.36), ease: 'power2.in' });
    return tl;
  }
  function landOn(el, from) {
    var fall = Math.min(0.76, 0.32 + Math.abs(from) * 0.0005);
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { y: 0, scaleX: 1.06, scaleY: 0.92, duration: M.dur(fall * 0.8), ease: 'power2.in' })
      .to(el, { scaleX: 1, scaleY: 1, duration: M.dur(fall * 0.2), ease: 'power2.out' });
    return tl;
  }
  function springOff(el, y) {
    var dip = el.getBoundingClientRect().height * 0.06;
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform' });
    tl.to(el, { y: dip, scaleX: 1.06, scaleY: 0.92, duration: M.dur(0.14), ease: 'power2.in' })
      .to(el, { y: y, scaleX: 1, scaleY: 1, duration: M.dur(0.42), ease: 'power2.out' });
    return tl;
  }

  /* The bird leaving centre stage before the board opens: a crouch, then a
     hop up and away as it fades. It ends hidden (.is-away), so nothing is
     left standing behind the board. */
  function heroOut(el) {
    var lift = el.getBoundingClientRect().height * 0.16;
    var tl = M.timeline({
      willChange: el, willChangeValue: 'transform, opacity',
      revert: function () {
        el.classList.add('is-away');
        M.set(el, { clearProps: 'opacity,transform,transformOrigin' });
      }
    });
    M.set(el, { transformOrigin: '50% 100%' });
    tl.to(el, { scaleX: 1.06, scaleY: 0.92, duration: M.dur(0.12), ease: 'power2.in' })
      .to(el, { y: -lift, scaleX: 0.9, scaleY: 0.9, opacity: 0, duration: M.dur(0.32), ease: 'power2.in' });
    return tl;
  }

  function lineOut(line) {
    var tl = M.timeline({ willChange: line, willChangeValue: 'transform, opacity' });
    tl.to(line, { opacity: 0, y: -8, filter: 'blur(3px)', duration: M.dur(0.28), ease: 'power2.in' });
    return tl;
  }
  function controlIn(btn) {
    btn.removeAttribute('hidden');
    var tl = M.timeline({ willChange: btn, willChangeValue: 'transform, opacity' });
    tl.fromTo(btn, { opacity: 0, scale: 0.7, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: M.dur(0.38), ease: 'back.out(1.6)' });
    return tl;
  }
  function controlOut(btn) {
    var tl = M.timeline({
      willChange: btn, willChangeValue: 'transform, opacity',
      revert: function () { btn.setAttribute('hidden', ''); M.set(btn, { clearProps: 'transform,opacity' }); }
    });
    tl.to(btn, { opacity: 0, scale: 0.8, duration: M.dur(0.2), ease: 'power2.in', overwrite: 'auto' });
    return tl;
  }
  function welcomeOut(welcome, title, start, extra) {
    var tl = M.timeline({
      willChange: [title, start], willChangeValue: 'transform, opacity',
      revert: function () { welcome.setAttribute('hidden', ''); }
    });
    start.classList.remove('in');
    tl.to([title, start].concat(extra || []), { opacity: 0, y: -14, scale: 0.94, duration: M.dur(0.3), ease: 'power2.in', stagger: M.gap(0.05) }, 0);
    tl.to(welcome, { opacity: 0, duration: M.dur(0.34), ease: 'power2.in' }, 0.08);
    return tl;
  }

  /* ======================================================================
   * Confetti
   * ====================================================================== */
  var BURST_N = 14;
  var HUES = ['blue', 'mint', 'lavender', 'berry', 'gold'];
  function confetti(host, x, y) {
    var bits = [];
    for (var i = 0; i < BURST_N; i++) {
      var round = i % 3 === 0;
      var size = 5 + Math.random() * 4;
      var e = document.createElementNS(NS, round ? 'circle' : 'rect');
      e.setAttribute('class', 'qz-bit qz-bit--' + HUES[i % HUES.length]);
      if (round) { e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('r', size / 2); }
      else { e.setAttribute('x', x - size / 2); e.setAttribute('y', y - size * 0.3); e.setAttribute('width', size); e.setAttribute('height', size * 0.6); e.setAttribute('rx', 1); }
      host.appendChild(e);
      bits.push(e);
    }
    var tl = M.timeline({ revert: function () { bits.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); }); } });
    if (M.reducedMotion()) return tl;
    bits.forEach(function (b, i) {
      var ang = (i / BURST_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      var d = 58 + Math.random() * 52;
      var dx = Math.cos(ang) * d, dy = -Math.abs(Math.sin(ang)) * d * 0.9 - 14;
      M.set(b, { transformOrigin: 'center center' });
      tl.to(b, { x: dx, y: dy, rotation: (Math.random() - 0.5) * 540, duration: M.dur(0.55), ease: 'power2.out' }, 0)
        .to(b, { y: dy + 36 + Math.random() * 20, duration: M.dur(0.5), ease: 'power1.in' }, M.gap(0.5))
        .to(b, { opacity: 0, scale: 0.5, duration: M.dur(0.4), ease: 'power2.in' }, M.gap(0.62));
    });
    return tl;
  }
  var RAIN_N = 34;
  var RAIN_HUES = ['blue', 'mint', 'lavender', 'berry', 'gold', 'snow'];
  function confettiRain(host) {
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    host.appendChild(layer);
    var remove = function () { if (layer.parentNode) layer.parentNode.removeChild(layer); };
    var w = layer.clientWidth, h = layer.clientHeight;
    if (M.reducedMotion() || !w || !h) { remove(); return M.timeline(); }
    var bits = [], plan = [];
    for (var i = 0; i < RAIN_N; i++) {
      var e = document.createElement('span');
      e.className = 'confetti__bit confetti__bit--' + RAIN_HUES[i % RAIN_HUES.length] + (i % 3 === 0 ? ' confetti__bit--round' : '');
      layer.appendChild(e);
      bits.push(e);
      plan.push({ x: (i + Math.random()) / RAIN_N * w, sway: (Math.random() - 0.5) * 70,
                  drop: h * (0.5 + Math.random() * 0.35), turn: (Math.random() - 0.5) * 720,
                  delay: Math.random() * 0.4, fall: 1.5 + Math.random() * 0.7 });
    }
    var tl = M.timeline({ willChange: bits, revert: remove });
    bits.forEach(function (b, n) {
      var p = plan[n];
      M.set(b, { x: p.x, y: -16, rotation: p.turn / 4, opacity: 1 });
      tl.to(b, { y: p.drop, duration: M.dur(p.fall), ease: 'power1.in' }, M.gap(p.delay))
        .to(b, { x: p.x + p.sway, rotation: p.turn, duration: M.dur(p.fall), ease: 'sine.inOut' }, M.gap(p.delay))
        .to(b, { opacity: 0, duration: M.dur(p.fall * 0.4), ease: 'power2.in' }, M.gap(p.delay + p.fall * 0.6));
    });
    return tl;
  }

  global.Beats = {
    sfx: sfx, pop: pop, ringing: ringing,
    sounds: function () { return Object.keys(CLIPS).map(function (k) { return CLIPS[k]; }); },
    stroke: stroke, undash: undash, pathLength: pathLength,
    boardIn: boardIn, boardOut: boardOut,
    drawShape: drawShape, fillShape: fillShape, showShape: showShape, putShape: putShape,
    labelsIn: labelsIn, labelIn: labelIn, labelsOut: labelsOut, marksOut: marksOut,
    lightSide: lightSide, unlightSide: unlightSide, unlightAll: unlightAll,
    pulseHold: pulseHold, pulseRelease: pulseRelease, partPulse: partPulse,
    perimOn: perimOn, areaOn: areaOn, highlightOff: highlightOff,
    walk: walk, morphShape: morphShape, moveGroup: moveGroup, slideGroup: slideGroup, pushSide: pushSide,
    zonesIn: zonesIn, zonesOut: zonesOut, zoneLean: zoneLean, zoneRight: zoneRight, zoneWrong: zoneWrong,
    swipeIn: swipeIn, swipeHome: swipeHome, swipeInto: swipeInto, swipeWrong: swipeWrong, swipeNudge: swipeNudge,
    boxIn: boxIn, boxRight: boxRight, boxWrong: boxWrong,
    trayIn: trayIn, trayOut: trayOut, choiceRight: choiceRight, choiceWrong: choiceWrong,
    optsIn: optsIn, optsOut: optsOut,
    chipHome: chipHome, chipDock: chipDock,
    cardIn: cardIn, cardsIn: cardsIn, cardOut: cardOut, rowIn: rowIn, termIn: termIn, ruleIn: ruleIn, emphasise: emphasise,
    lightsOn: lightsOn,
    clearFigure: clearFigure,
    bubbleArm: bubbleArm, bubbleIn: bubbleIn, bubbleOut: bubbleOut,
    hopUp: hopUp, hopDown: hopDown, landOn: landOn, springOff: springOff, heroOut: heroOut,
    lineOut: lineOut, controlIn: controlIn, controlOut: controlOut, welcomeOut: welcomeOut,
    confetti: confetti, confettiRain: confettiRain
  };
})(window);
