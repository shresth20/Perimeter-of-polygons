/* ==========================================================================
 * s5-irregular.js -- the perimeter of an irregular polygon
 * --------------------------------------------------------------------------
 * A regular heptagon, 4 cm a side. The learner drags any corner and the
 * sides stop being equal; the shape settles on the storyboard's heptagon
 * (4, 5, 3, 6, 4, 3, 5) and its perimeter is asked for, then walked.
 *   Laid out as the circle game's formula pane (pages.js: the perch): the
 * board split 50 / 50, the heptagon in the middle of the left half -- at
 * section 3's size, its name written over it and what it is in one line
 * under it -- and the bird up on the right the whole scene, every line in
 * its bubble, the answers and then the working under its feet.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s5-irregular.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var NUDGE_AFTER = 2400;
  /* the middle of the board's left half (the right half is the bird's); the
     regular heptagon about it is section 3's size (s2-basics.js), its sides
     4 cm each, so a cm is a seventh of its perimeter in figure units */
  var CX = 250, CY = 215, R = 110;
  var PX = 2 * R * Math.sin(Math.PI / 7) / 4;   /* figure units per cm */
  /* the heptagon's name over it, its facts under it (figure units) -- where
     they start; spread() moves all three to share out the height */
  var TITLE_Y = 50, FACTS_Y = 400;
  /* how far a dragged corner may go: inside the left half, clear of the
     name over the shape and the line under it (set by spread()) */
  var DRAG_X = [40, 460], DRAG_Y = [86, 340];
  var CORNER_CLEAR = 40;        /* a corner's own label reaches about this far */
  var SPREAD_INSET = 0.05;      /* of the shown height, kept clear top and bottom */
  var cy = CY;                  /* the heptagon's centre as laid out */
  var SUM = [4, 5, 3, 6, 4, 3, 5];
  /* the irregular heptagon with exactly those sides, in cm about its centre */
  var IRR_CM = [[0.142, -4.981], [3.782, -3.322], [4.645, 1.603], [3.055, 4.146], [-2.944, 4.273], [-4.577, 0.622], [-4.104, -2.341]];
  function irregular() {
    return IRR_CM.map(function (p) { return { x: S.round2(CX + p[0] * PX), y: S.round2(cy + p[1] * PX) }; });
  }

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figIrregular'); }
  function cm(n) { return T('lblCm', { n: n }); }
  function centreOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  /* The heptagon's name over it and its facts in one line under it, written
     on the figure in the shape's own group. */
  function caption(g, cls, y, key) {
    var t = S.el('text', { 'class': 'figure-label ' + cls, x: CX, y: y, 'text-anchor': 'middle' });
    t.textContent = T(key);
    g.appendChild(t);
    return t;
  }
  /* The height of the figure the stage shows, in figure units. The figure's
     box (1000 x 420) is wider than the stage, so it is fitted to the
     stage's width and the stage shows more of it, above and below the box,
     than the box itself. Read once the header has been put away, so nothing
     is moving it. */
  function shownBand() {
    var fig = dom.figure, m = fig.getScreenCTM && fig.getScreenCTM();
    var st = fig.parentNode.getBoundingClientRect();
    if (!m || !m.d || !st.height) return { top: 0, bottom: 420 };
    var top = (st.top - m.f) / m.d, bottom = (st.bottom - m.f) / m.d;
    var inset = (bottom - top) * SPREAD_INSET;
    return { top: top + inset, bottom: bottom - inset };
  }
  function boxOf(els) {
    var y0 = Infinity, y1 = -Infinity;
    els.forEach(function (e) {
      var b = e.getBBox();
      if (!b.height) return;
      y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.height);
    });
    return { y0: y0, y1: y1, h: y1 - y0 };
  }
  /* The left half, top to bottom -- the name, the heptagon with its
     lengths, the line under it -- with the height left over shared out
     round them evenly (space-around: a half share above the first and below
     the last, a whole one between). The heptagon is moved by re-laying out
     its points about a new centre; the corners may then be dragged only
     between the name and the line under it. */
  function spread(shape, title, facts) {
    shape.set();                       /* its lengths, laid out in their real font */
    var band = shownBand();
    var tb = boxOf([title]), fb = boxOf([facts]);
    var sb = boxOf([shape.outline].concat(shape.labels));
    var free = (band.bottom - band.top) - tb.h - sb.h - fb.h;
    if (!(free > 0) || !isFinite(free)) return;
    var gap = free / 3;
    var titleTop = band.top + gap / 2;
    var shapeTop = titleTop + tb.h + gap;
    var factsTop = shapeTop + sb.h + gap;
    title.setAttribute('y', S.round2(+title.getAttribute('y') + titleTop - tb.y0));
    facts.setAttribute('y', S.round2(+facts.getAttribute('y') + factsTop - fb.y0));
    cy = S.round2(cy + shapeTop - sb.y0);
    shape.set(S.regular(7, CX, cy, R));
    DRAG_Y = [titleTop + tb.h + CORNER_CLEAR, factsTop - CORNER_CLEAR];
  }
  /* ...and rewritten when the shape changes: out, the new words, back in. */
  function recaption(t, key) {
    var tl = M.timeline({ willChange: t, willChangeValue: 'opacity', revert: function () { t.textContent = T(key); M.set(t, { opacity: 1 }); } });
    tl.to(t, { opacity: 0, duration: M.dur(0.22), ease: 'power2.in' })
      .call(function () { t.textContent = T(key); })
      .to(t, { opacity: 1, duration: M.dur(0.34), ease: 'power2.out' });
    return tl;
  }

  /* Any corner dragged: the shape is re-laid out under the finger, its
     lengths rewritten live. Resolves once a corner has been moved and let
     go (at once under Skip). */
  function armVertex(shape) {
    var drag = null, live = true;
    shape.g.classList.add('is-live');
    function k() { var m = dom.figure.getScreenCTM(); return m ? m.a : 1; }
    function onDown(ev) {
      if (!live || drag) return;
      var i = shape.vhits.indexOf(ev.currentTarget);
      ev.preventDefault();
      drag = { i: i, id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, x0: shape.pts[i].x, y0: shape.pts[i].y, moved: false };
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
      shape.vertices[i].classList.add('is-held');
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = (ev.clientX - drag.ox) / k(), dy = (ev.clientY - drag.oy) / k();
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      var pts = shape.pts.slice();
      pts[drag.i] = { x: Math.max(DRAG_X[0], Math.min(DRAG_X[1], drag.x0 + dx)), y: Math.max(DRAG_Y[0], Math.min(DRAG_Y[1], drag.y0 + dy)) };
      shape.set(pts);
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      shape.vertices[d.i].classList.remove('is-held');
      if (d.moved) { live = false; dom.gate.dispatchEvent(new MouseEvent('click')); }
    }
    function onKey(ev) {
      if (!live || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      var i = shape.vhits.indexOf(ev.currentTarget);
      var pts = shape.pts.slice();
      pts[i] = { x: Math.min(DRAG_X[1], pts[i].x + 30), y: Math.max(DRAG_Y[0], pts[i].y - 20) };
      shape.set(pts);
      live = false;
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    shape.vhits.forEach(function (v) { v.addEventListener('pointerdown', onDown); v.addEventListener('keydown', onKey); v.setAttribute('tabindex', '0'); });
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    function off() {
      live = false;
      shape.vhits.forEach(function (v) { v.removeEventListener('pointerdown', onDown); v.removeEventListener('keydown', onKey); v.setAttribute('tabindex', '-1'); });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      shape.g.classList.remove('is-live');
    }
    return Flow.once(dom.gate, { auto: true }).then(off, function (err) { off(); throw err; });
  }

  function sceneIrregular() {
    var g = S.el('g');
    var shape = null, title = null, facts = null, sum = null;
    return K.interlude(['i0Intro'])
      /* the header stays shut: the bird speaks from beside the shape */
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () {
        group.removeAttribute('hidden');
        group.appendChild(g);
        cy = CY;
        shape = S.build(g, S.regular(7, CX, cy, R), {
          inks: true, vertices: true, cls: 'shape--big',
          labels: function (i, len) { return cm(Math.max(1, Math.round(len / PX))); }
        });
        title = caption(g, 'shape-title', TITLE_Y, 'lblRegHept');
        facts = caption(g, 'shape-facts', FACTS_Y, 'lblRegHeptFacts');
        spread(shape, title, facts);
        return Flow.anim(Beats.drawShape(shape, { time: 1.4 }));
      })
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels, 0.1)); })
      /* its name over it, what it is under it */
      .then(function () { return Flow.anim(Beats.labelsIn([title, facts], 0.2)); })
      /* the bird up on the right */
      .then(function () { return K.perchUp(); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.perchSay('i1Ask'); })
      .then(function () {
        return Flow.anim(M.to(shape.vertices, { opacity: 1, duration: M.dur(0.3), ease: 'power2.out', stagger: M.gap(0.05) }));
      })
      .then(function () {
        var stopHand = null, touched = false;
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (touched) return;
          stopHand = W.handDrag(function () { return centreOf(shape.vertices[1]); },
                                function () { var c = centreOf(shape.vertices[1]); return { x: c.x + 50, y: c.y - 30 }; }, 56);
        }));
        shape.vhits.forEach(function (v) { v.addEventListener('pointerdown', function () { touched = true; if (stopHand) { stopHand(); stopHand = null; } }); });
        return armVertex(shape).then(function () { if (stopHand) stopHand(); });
      })
      /* the sides settle on the heptagon the question is about */
      .then(function () {
        shape.opts.labels = SUM.map(cm);
        return Promise.all([
          Flow.anim(Beats.morphShape(shape, irregular(), 1.1)),
          Flow.anim(M.to(shape.vertices, { opacity: 0, duration: M.dur(0.4) })),
          Flow.anim(recaption(title, 'lblIrrHept')),
          Flow.anim(recaption(facts, 'lblIrrHeptFacts'))
        ]);
      })
      .then(function () { return Flow.anim(Beats.partPulse(shape.sides, 2)); })
      .then(function () { return K.perchSay('i1Look'); })
      .then(function () { return K.handOver(); })

      /* ---- the question, asked from the same spot ---------------------------
         As every question with answers to tap is (s2-basics.js): the bird on
         the right with the question kept in its bubble, three answers under
         it, every verdict heard only -- a wrong one shakes and the answers
         are shuffled out of sight, and after three wrong tries the answer is
         shown; a right (or shown) answer makes way for the working
         ("Perimeter:" over the sum) as the light walks the boundary. The
         bird is already there, so it simply asks. */
      .then(function () { return K.perchSay('i2Ask'); })
      .then(function () { return K.perchChoices([28, 30, 26].map(cm)); })
      .then(function (btns) {
        return K.perchAsk(btns, 1, {
          onWrong: function () { return K.perchHear('bNotQuite', 'confused'); }
        });
      })
      .then(function (res) {
        var told = res.revealed ? K.perchHear('i2Reveal') : K.perchHear('i2Right', 'happy');
        /* a revealed answer is left lit a moment longer: the learner did not find it */
        var work = Flow.wait(res.revealed ? LOOK : BEAT)
          .then(function () { return K.perchClear(); })
          .then(function () {
            /* seven terms: the total on a line of its own, so the sum is
               the same size as every other section's */
            sum = K.perchSum(T('lblPerimeterIs'), { terms: SUM });
            return Flow.anim(Beats.cardIn(sum.el));
          })
          .then(function () {
            /* each side's length carried off its label into the sum */
            return Flow.anim(Beats.walk(shape, 0.7 * SUM.length, {
              onSide: function (k) { Beats.lightSide(shape, k, { label: true }); sum.term(String(SUM[k]), shape.ink(k), shape.labels[k]); }
            }));
          })
          .then(function () { return sum.result('= ' + cm(30)); })
          .then(function () { var c = shape.centre(); K.burstAt(c.x, c.y); });
        return Promise.all([told, work]);
      })
      .then(function () { return K.handOver(); });
  }

  function parts() { return [group]; }
  function wipe() { var nodes = layerNodes.slice(); return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : []; }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() {}

  Pages.addSection({
    name: 'Irregular polygons',
    scenes: [{ name: 'An irregular heptagon', play: sceneIrregular }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
