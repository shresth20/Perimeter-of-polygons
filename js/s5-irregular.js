/* ==========================================================================
 * s5-irregular.js -- the perimeter of an irregular polygon
 * --------------------------------------------------------------------------
 * A regular heptagon, 4 cm a side. The learner drags any corner and the
 * sides stop being equal; the shape settles on the storyboard's heptagon
 * (4, 5, 3, 6, 4, 3, 5) and its perimeter is asked for, then walked.
 *   Laid out as the circle game's formula pane (pages.js: the perch): the
 * board split 50 / 50, the heptagon in the middle of the left half, and the
 * bird up on the right the whole scene -- every line in its bubble, the
 * heptagon's facts and then the answers and the working under its feet.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s5-irregular.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var NUDGE_AFTER = 2400;
  var PX = 26;                  /* figure units per cm */
  /* the middle of the board's left half: the right half is the bird's */
  var CX = 250, CY = 218;
  /* how far a dragged corner may go: inside the left half, its label too */
  var DRAG_X = [40, 460], DRAG_Y = [30, 400];
  var SUM = [4, 5, 3, 6, 4, 3, 5];
  /* the irregular heptagon with exactly those sides, in cm about its centre */
  var IRR = [[0.142, -4.981], [3.782, -3.322], [4.645, 1.603], [3.055, 4.146], [-2.944, 4.273], [-4.577, 0.622], [-4.104, -2.341]]
    .map(function (p) { return { x: S.round2(CX + p[0] * PX), y: S.round2(CY + p[1] * PX) }; });

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figIrregular'); }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function cm(n) { return T('lblCm', { n: n }); }
  function centreOf(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  /* The heptagon's facts, on a card under the bird (the perch owns it, and
     takes it away with it). */
  function infoCard(title, rows) {
    var card = h('div', 'card', K.perchRow());
    var t = h('p', 'card__title', card); t.textContent = T(title);
    rows.forEach(function (r) { var e = h('div', 'card__row is-soft', card); e.textContent = T(r); });
    return card;
  }
  function drop(card) { if (card && card.parentNode) card.parentNode.removeChild(card); }

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
    var shape = null, card = null, card2 = null, sum = null;
    return K.interlude(['i0Intro'])
      /* the header stays shut: the bird speaks from beside the shape */
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () {
        group.removeAttribute('hidden');
        group.appendChild(g);
        shape = S.build(g, S.regular(7, CX, CY, 120), {
          inks: true, vertices: true,
          labels: function (i, len) { return cm(Math.max(1, Math.round(len / PX))); }
        });
        return Flow.anim(Beats.drawShape(shape, { time: 1.4 }));
      })
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels, 0.1)); })
      /* the bird up on the right, the heptagon's facts under it */
      .then(function () { return K.perchUp(); })
      .then(function () {
        card = infoCard('lblRegHept', ['lbl7Sides', 'lblEach4']);
        return Flow.anim(Beats.cardIn(card));
      })
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
          Flow.anim(Beats.morphShape(shape, IRR, 1.1)),
          Flow.anim(M.to(shape.vertices, { opacity: 0, duration: M.dur(0.4) })),
          Flow.anim(Beats.cardOut(card))
        ]);
      })
      .then(function () {
        drop(card);
        card2 = infoCard('lblIrrHept', ['lbl7Sides', 'lblNotEqual']);
        return Flow.anim(Beats.cardIn(card2));
      })
      .then(function () { return Flow.anim(Beats.partPulse(shape.sides, 2)); })
      .then(function () { return K.perchSay('i1Look'); })
      .then(function () { return K.handOver(); })

      /* ---- the question, asked from the same spot ---------------------------
         As every question with answers to tap is: the bird on the right with
         the question in its bubble, three answers under it, every verdict in
         the same bubble; a right answer makes way for the working
         ("Perimeter:" over the sum) as the light walks the boundary. The
         bird is already there, so the facts make way and it simply asks. */
      .then(function () { return K.perchClear(); })
      .then(function () { return K.perchSay('i2Ask'); })
      .then(function () { return K.perchChoices([28, 30, 26].map(cm)); })
      .then(function (btns) {
        return K.perchAsk(btns, 1, {
          onWrong: function (k) { return K.perchSay({ 0: 'i2Wrong28', 2: 'i2Wrong26' }[k] || 'bWrongGeneric', 'confused', 'no'); }
        });
      })
      .then(function (res) {
        var told = K.perchRight('i2Right', res);
        var work = Flow.wait(BEAT)
          .then(function () { return K.perchClear(); })
          .then(function () {
            sum = K.perchSum(T('lblPerimeterIs'), { terms: SUM, total: '= ' + cm(30) });
            return Flow.anim(Beats.cardIn(sum.el));
          })
          .then(function () {
            return Flow.anim(Beats.walk(shape, 3.2, {
              onSide: function (k) { Beats.lightSide(shape, k, { label: true }); sum.term(String(SUM[k]), shape.ink(k)); }
            }));
          })
          .then(function () { return sum.total('= ' + cm(30)); })
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
