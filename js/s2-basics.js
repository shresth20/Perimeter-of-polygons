/* ==========================================================================
 * s2-basics.js -- the perimeter of a rectangle, a square and a triangle
 * --------------------------------------------------------------------------
 * Three questions, each on a shape drawn by the pen with its lengths
 * written on, answered by tapping; a right answer is walked: a light runs
 * round the boundary and each side's length lands in the sum as it is
 * passed. Then the three formulas, side by side.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s2-basics.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;

  function cm(n) { return T('lblCm', { n: n }); }

  var QS = [
    { pts: S.rect(190, 150, 176, 110), sum: [8, 5, 8, 5], total: 26,
      ask: 'b1Ask', opts: [13, 40, 21, 26], right: 3, wrong: { 1: 'b1Wrong40' }, told: 'b1Right' },
    { pts: S.rect(205, 122, 150, 150), sum: [15, 15, 15, 15], total: 60,
      ask: 'b2Ask', opts: [30, 225, 60, 19], right: 2, wrong: { 1: 'b2Wrong225' }, told: 'b2Right' },
    { pts: [{ x: 186, y: 122 }, { x: 366, y: 122 }, { x: 366, y: 257 }], sum: [12, 9, 15], total: 36,
      ask: 'b3Ask', opts: [45, 36, 72, 27], right: 1, wrong: { 0: 'b3Wrong45' }, told: 'b3Right' }
  ];
  var CARD_AT = { right: '4%', top: '16%', width: '42%' };

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

  /* One question: the shape, the ask, the answer, the walk. */
  function question(q, i) {
    var g = S.el('g');
    group.appendChild(g);
    var shape = S.build(g, q.pts, { inks: true, labels: q.sum.map(cm), offset: 30 });
    var card = null, btns = null;
    var c = shape.centre();

    return (i === 0 ? K.say('b0Intro').then(function () { return Flow.wait(BEAT); }) : Promise.resolve())
      .then(function () { return Flow.anim(Beats.drawShape(shape, { time: i === 0 ? 1.6 : 1.1 })); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.say(q.ask); })
      .then(function () { return K.offerChoices(q.opts.map(cm)); })
      .then(function (list) {
        btns = list;
        return K.speak(K.keyed('bTap'));
      })
      .then(function () {
        return K.askUntilRight(btns, q.right, {
          onWrong: function (k) { return K.speakBySentence(q.wrong[k] || 'bWrongGeneric', 'confused'); }
        });
      })
      /* right: the walk, the sum, the word */
      .then(function () {
        card = W.sumCard(dom.layer, { title: T('lblPerimeter'), style: CARD_AT });
        layerNodes.push(card.el);
        return Flow.anim(Beats.cardIn(card.el));
      })
      .then(function () {
        return Flow.anim(Beats.walk(shape, 2.4, {
          onSide: function (k) {
            Beats.lightSide(shape, k, { label: true });
            card.term(String(q.sum[k]), k);
          }
        }));
      })
      .then(function () { return card.result('= ' + cm(q.total)); })
      .then(function () {
        K.burstAt(c.x, c.y);
        return K.speakBySentence(q.told, 'happy');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      .then(function () {
        return Promise.all([K.clearChoices(), Flow.anim(Beats.cardOut(card.el)), Flow.anim(Beats.clearFigure([g]))]);
      })
      .then(function () {
        card.remove();
        layerNodes = layerNodes.filter(function (n) { return n !== card.el; });
        if (g.parentNode) g.parentNode.removeChild(g);
      });
  }

  /* A small shape for a summary card, in its own little picture. */
  function miniShape(pts, labels, w, hh) {
    var svg = S.el('svg', { viewBox: '0 0 ' + w + ' ' + hh });
    var s = S.build(svg, pts, { inks: true, labels: labels, offset: 22 });
    s.labels.forEach(function (l) { l.setAttribute('font-size', '26'); });
    return svg;
  }

  function sceneSummary() {
    var grid = h('div', 'grid grid--3', dom.layer);
    layerNodes.push(grid);
    var cards = [
      { svg: miniShape(S.rect(40, 36, 170, 100), ['l', 'b', 'l', 'b'], 250, 170), title: 'lblRectangle', eq: 'fRect' },
      { svg: miniShape(S.rect(65, 26, 120, 120), ['a', 'a', 'a', 'a'], 250, 170), title: 'lblSquare', eq: 'fSquare' },
      { svg: miniShape([{ x: 125, y: 30 }, { x: 215, y: 140 }, { x: 35, y: 140 }], ['b', 'c', 'a'], 250, 170), title: 'lblTriangle', eq: 'fTriangle' }
    ].map(function (c) {
      var card = h('div', 'card', grid);
      card.appendChild(c.svg);
      var t = h('p', 'card__title', card); t.textContent = T(c.title);
      var lbl = h('p', 'card__sub', card); lbl.textContent = T('lblPerimeter');
      var row = h('div', 'card__row', card); global.MathText.write(row, T(c.eq));
      return card;
    });
    var rule = h('div', 'rule-line', dom.layer);
    rule.textContent = T('b4Sum');
    layerNodes.push(rule);

    return K.birdAway()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.cardsIn(cards, 0.22)); })
      .then(function () { return Flow.wait(LOOK); })
      .then(function () { return Flow.anim(Beats.ruleIn(rule)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.say('b4Sum', 'happy'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); });
  }

  function sceneBasics() {
    group.removeAttribute('hidden');
    return QS.reduce(function (chain, q, i) {
      return chain.then(function () { return question(q, i); });
    }, Promise.resolve()).then(sceneSummary);
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
