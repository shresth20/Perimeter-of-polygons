/* ==========================================================================
 * s2-basics.js -- the perimeter of a rectangle, a square and a triangle
 * --------------------------------------------------------------------------
 * Three questions. Each shape is drawn large by the pen in the middle of
 * the board, its lengths written on, then carried to the left; the bird
 * jumps up on the right and asks in its bubble, three answers under it
 * ("Tap the correct answer." is heard only) -- the circle game's formula
 * pane, in ice (pages.js: the perch). The question stays in the bubble:
 * every verdict is heard only. A wrong answer shakes and the answers are
 * shuffled out of sight; after three wrong tries the answer is shown. A
 * right (or shown) answer: the answers make way for the working --
 * "Perimeter:" over the sum -- while a light runs round the boundary and
 * each side's length, as it is passed, is carried off its label on the
 * shape and dropped into the sum. Then the three formulas, built one card
 * at a time -- the shape's name over it, its rule on one line under it --
 * each one's rule heard as it is written.
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
     two slips worth answering. `told` is heard on a right answer, `reveal`
     when the answer is shown after three wrong tries.
       Every side has its length written on -- all four of the rectangle's
     too -- and sides of one length share one ink. The triangle is drawn a
     size up (12 : 9 : 15, 25 figure units to the cm). */
  var MID_X = 500, ASIDE_X = 250;
  var WALK_PER_SIDE = 0.8;   /* s: the light's pace round the boundary, a side's length carried each */
  var QS = [
    { pts: S.rect(332, 105, 336, 210), sum: [8, 5, 8, 5], total: 26,
      ask: 'b1Ask', opts: [13, 40, 26], right: 2, told: 'b1Right', reveal: 'b1Reveal' },
    { pts: S.rect(386, 96, 228, 228), sum: [15, 15, 15, 15], total: 60,
      ask: 'b2Ask', opts: [30, 60, 225], right: 1, told: 'b2Right', reveal: 'b2Reveal' },
    { pts: [{ x: 350, y: 97.5 }, { x: 650, y: 97.5 }, { x: 650, y: 322.5 }], sum: [12, 9, 15], total: 36,
      ask: 'b3Ask', opts: [36, 45, 27], right: 0, told: 'b3Right', reveal: 'b3Reveal' }
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
          onWrong: function () { return K.perchHear('bNotQuite', 'confused'); }
        });
      })
      /* right (or shown): heard while the answers make way for the working
         and the light walks the boundary, each side's length carried from
         its label on the shape into the sum as it is passed */
      .then(function (res) {
        var told = res.revealed ? K.perchHear(q.reveal) : K.perchHear(q.told, 'happy');
        var card = null;
        /* a revealed answer is left lit a moment longer: the learner did not find it */
        var work = Flow.wait(res.revealed ? LOOK : BEAT)
          .then(function () { return K.perchClear(); })
          .then(function () {
            card = K.perchSum(T('lblPerimeterIs'), { terms: q.sum, total: '= ' + cm(q.total) });
            return Flow.anim(Beats.cardIn(card.el));
          })
          .then(function () {
            return Flow.anim(Beats.walk(shape, WALK_PER_SIDE * q.sum.length, {
              onSide: function (k) {
                Beats.lightSide(shape, k, { label: true });
                card.term(String(q.sum[k]), shape.ink(k), shape.labels[k]);
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

  /* A small shape for a summary card, in its own little picture -- every
     mark of it hidden, for the card's pen to draw. */
  function miniShape(pts, labels, w, hh) {
    var svg = S.el('svg', { viewBox: '0 0 ' + w + ' ' + hh });
    var s = S.build(svg, pts, { inks: true, labels: labels });
    s.labels.forEach(function (l) { l.setAttribute('font-size', '26'); });
    M.set(s.sides.concat(s.labels, [s.fill, s.outline]), { opacity: 0 });
    return { svg: svg, shape: s };
  }
  var KINDS = [
    { pts: S.rect(40, 36, 170, 100), labels: ['l', 'b', 'l', 'b'], title: 'lblRectangle', eq: 'fRect', say: 'b4Rect' },
    { pts: S.rect(65, 26, 120, 120), labels: ['a', 'a', 'a', 'a'], title: 'lblSquare', eq: 'fSquare', say: 'b4Square' },
    { pts: [{ x: 125, y: 30 }, { x: 215, y: 140 }, { x: 35, y: 140 }], labels: ['b', 'c', 'a'], title: 'lblTriangle', eq: 'fTriangle', say: 'b4Tri' }
  ];

  /* The three formulas, one card at a time -- the rectangle, the square,
     the triangle: the card comes in, its name is set down at the top, its
     shape is drawn by the pen under it and its sides named; then, as "The
     perimeter of a rectangle is ..." is heard (the voice only), its rule is
     written on one line under the shape -- "Perimeter: 2 × (l + b)" -- and
     a light runs once round the boundary. Then the bird's own line. */
  function sceneSummary() {
    var grid = h('div', 'grid grid--3 grid--kinds grid--named grid--formulas', dom.layer);
    layerNodes.push(grid);
    var cards = KINDS.map(function (c) {
      var card = h('div', 'card', grid);
      var t = h('p', 'card__title', card); t.textContent = T(c.title);
      var mini = miniShape(c.pts, c.labels, 250, 170);
      card.appendChild(mini.svg);
      var text = h('div', 'card__text', card);
      var row = h('div', 'card__row card__formula', text);
      var lbl = h('span', 'card__sub', row); lbl.textContent = T('lblPerimeterIs');
      var eq = h('span', 'card__eq', row); global.MathText.write(eq, T(c.eq));
      M.set([t, lbl, eq], { opacity: 0 });
      return { el: card, shape: mini.shape, title: t, sub: lbl, row: eq, say: c.say };
    });
    function build(c) {
      return Flow.anim(Beats.cardIn(c.el))
        .then(function () { return Flow.anim(Beats.ruleIn(c.title)); })
        .then(function () { return Flow.anim(Beats.drawShape(c.shape, { time: 1.0 })); })
        .then(function () { return Flow.anim(Beats.labelsIn(c.shape.labels, 0.12)); })
        .then(function () {
          return Promise.all([
            K.voiceOver(c.say),
            Flow.anim(Beats.rowIn(c.sub)).then(function () { return Flow.anim(Beats.ruleIn(c.row)); }),
            Flow.anim(Beats.walk(c.shape, 2.0))
          ]);
        })
        .then(function () { return Flow.wait(SHORT); });
    }

    return K.birdAway()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return cards.reduce(function (chain, c) { return chain.then(function () { return build(c); }); }, Promise.resolve());
      })
      .then(function () { return Flow.wait(BEAT); })
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
