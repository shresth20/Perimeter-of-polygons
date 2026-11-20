/* ==========================================================================
 * s2-basics.js -- the perimeter of a rectangle, a square and a triangle
 * --------------------------------------------------------------------------
 * Three questions. Each shape is drawn large by the pen in the middle of
 * the board, its lengths written on, then carried to the left; the bird
 * jumps up on the right and asks in its bubble, three answers under it
 * ("Tap the correct answer." is heard only) -- the circle game's formula
 * pane, in ice (pages.js: the perch). Every verdict is said in the same
 * bubble. A right answer: the answers make way for the working --
 * "Perimeter:" over the sum -- while a light runs round the boundary and
 * each side's length lands in the sum as it is passed. Then the three
 * formulas, side by side.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s2-basics.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;

  function cm(n) { return T('lblCm', { n: n }); }

  /* Every shape is drawn with its box centred on MID (figure units, 1000 x
     420), large; once its lengths are on, it is carried left until that
     centre stands at ASIDE_X, the middle of the board's left half -- the
     right half is the bird's. Three answers each: the right one, and the
     two slips worth answering. */
  var MID_X = 500, ASIDE_X = 250;
  var QS = [
    { pts: S.rect(332, 105, 336, 210), sum: [8, 5, 8, 5], total: 26,
      ask: 'b1Ask', opts: [13, 40, 26], right: 2, wrong: { 1: 'b1Wrong40' }, told: 'b1Right' },
    { pts: S.rect(386, 96, 228, 228), sum: [15, 15, 15, 15], total: 60,
      ask: 'b2Ask', opts: [30, 60, 225], right: 1, wrong: { 2: 'b2Wrong225' }, told: 'b2Right' },
    { pts: [{ x: 374, y: 115.5 }, { x: 626, y: 115.5 }, { x: 626, y: 304.5 }], sum: [12, 9, 15], total: 36,
      ask: 'b3Ask', opts: [36, 45, 27], right: 0, wrong: { 1: 'b3Wrong45' }, told: 'b3Right' }
  ];

  var dom = null, group = null, layerNodes = [];

  function build(kit) {
    dom = kit.dom();
    group = document.getElementById('figBasics');
  }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* One question: the shape in the middle, carried aside; the bird's ask;
     the answer; the walk. */
  function question(q, i) {
    var g = S.el('g');
    group.appendChild(g);
    var shape = S.build(g, q.pts, { inks: true, labels: q.sum.map(cm), cls: 'shape--big' });
    var dx = ASIDE_X - MID_X;
    var c = shape.centre();

    /* the intro ("Let's find the perimeter...") is said before, in the bubble;
       the header stays shut -- the bird asks from beside the shape */
    return Flow.anim(K.collapseHeader(true))
      .then(function () { return Flow.anim(Beats.drawShape(shape, { time: i === 0 ? 2.0 : 1.6 })); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels)); })
      .then(function () { return Flow.wait(BEAT); })
      /* to the left, making room for the bird */
      .then(function () { return Flow.anim(Beats.moveGroup(g, { x: dx }, 0.9, 'power3.inOut')); })
      /* the bird jumps up on the right and asks */
      .then(function () { return K.perchSay(q.ask); })
      .then(function () { return K.perchChoices(q.opts.map(cm)); })
      .then(function (btns) {
        K.perchVoice('bTap');
        return K.perchAsk(btns, q.right, {
          onWrong: function (k) { return K.perchSay(q.wrong[k] || 'bWrongGeneric', 'confused', 'no'); }
        });
      })
      /* right: said in the bubble, while the answers make way for the
         working and the light walks the boundary into the sum */
      .then(function (res) {
        var told = K.perchRight(q.told, res);
        var card = null;
        var work = Flow.wait(BEAT)
          .then(function () { return K.perchClear(); })
          .then(function () {
            card = K.perchSum(T('lblPerimeterIs'), { terms: q.sum, total: '= ' + cm(q.total) });
            return Flow.anim(Beats.cardIn(card.el));
          })
          .then(function () {
            return Flow.anim(Beats.walk(shape, 2.4, {
              onSide: function (k) {
                Beats.lightSide(shape, k, { label: true });
                card.term(String(q.sum[k]), shape.ink(k));
              }
            }));
          })
          .then(function () { return card.total('= ' + cm(q.total)); })
          .then(function () { K.burstAt(c.x + dx, c.y); });
        return Promise.all([told, work]);
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () { return Promise.all([K.perchDown(), Flow.anim(Beats.clearFigure([g]))]); })
      .then(function () { if (g.parentNode) g.parentNode.removeChild(g); });
  }

  /* A small shape for a summary card, in its own little picture. */
  function miniShape(pts, labels, w, hh) {
    var svg = S.el('svg', { viewBox: '0 0 ' + w + ' ' + hh });
    var s = S.build(svg, pts, { inks: true, labels: labels });
    s.labels.forEach(function (l) { l.setAttribute('font-size', '26'); });
    return svg;
  }

  function sceneSummary() {
    var grid = h('div', 'grid grid--3 grid--kinds', dom.layer);
    layerNodes.push(grid);
    var cards = [
      { svg: miniShape(S.rect(40, 36, 170, 100), ['l', 'b', 'l', 'b'], 250, 170), title: 'lblRectangle', eq: 'fRect' },
      { svg: miniShape(S.rect(65, 26, 120, 120), ['a', 'a', 'a', 'a'], 250, 170), title: 'lblSquare', eq: 'fSquare' },
      { svg: miniShape([{ x: 125, y: 30 }, { x: 215, y: 140 }, { x: 35, y: 140 }], ['b', 'c', 'a'], 250, 170), title: 'lblTriangle', eq: 'fTriangle' }
    ].map(function (c) {
      var card = h('div', 'card', grid);
      card.appendChild(c.svg);
      var text = h('div', 'card__text', card);
      var t = h('p', 'card__title', text); t.textContent = T(c.title);
      var lbl = h('p', 'card__sub', text); lbl.textContent = T('lblPerimeter');
      var row = h('div', 'card__row', text); global.MathText.write(row, T(c.eq));
      return card;
    });

    return K.birdAway()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.cardsIn(cards, 0.22)); })
      .then(function () { return Flow.wait(LOOK); })
      .then(function () { return K.say('b4Sum', 'happy'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  function sceneBasics() {
    return K.interlude(['w1Identified', 'b0Intro'])
      .then(function () {
        group.removeAttribute('hidden');
        return QS.reduce(function (chain, q, i) {
          return chain.then(function () { return question(q, i); });
        }, Promise.resolve());
      })
      .then(sceneSummary);
  }

  function parts() { return [group]; }
  function wipe() {
    var nodes = layerNodes.slice();
    if (!nodes.length) return [];
    return [Flow.anim(Beats.cardOut(nodes))];
  }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() { /* opens on the board the warm-up left: the header open, nothing on it */ }

  Pages.addSection({
    name: 'Basics',
    scenes: [{ name: 'Rectangle, square, triangle', play: sceneBasics }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
