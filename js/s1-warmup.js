/* ==========================================================================
 * s1-warmup.js -- the warm-up: perimeter or area?
 * --------------------------------------------------------------------------
 * Five shapes, one at a time, each on an ice card with either its boundary
 * or its inside lit; the learner swipes the card left (Perimeter) or right
 * (Area). The two side panels stay for the whole scene and keep every card
 * sorted into them. One scene, five pages (a Next after each shape), then
 * the line that closes the warm-up.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s1-warmup.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT;
  var NUDGE_AFTER = 2400;

  var SQUARE = S.rect(425, 112, 150, 150);
  var RECT = S.rect(400, 122, 200, 130);
  var TRI = [{ x: 500, y: 96 }, { x: 592, y: 254 }, { x: 408, y: 254 }];

  var ITEMS = [
    { pts: SQUARE, hi: 'perim', answer: 'lblPerimeter', wrong: 'w1Wrong1', right: 'w1Right1' },
    { pts: RECT,   hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong2', right: 'w1Right2' },
    { pts: TRI,    hi: 'perim', answer: 'lblPerimeter', wrong: 'w1Wrong3', right: 'w1Right3' },
    { pts: SQUARE, hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong4', right: 'w1Right4' },
    { pts: TRI,    hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong5', right: 'w1Right5' }
  ];
  /* the two sides, and how many cards each will end up holding */
  var ZONES = [{ name: 'lblPerimeter', side: 'left' }, { name: 'lblArea', side: 'right' }].map(function (z) {
    z.cap = ITEMS.filter(function (it) { return it.answer === z.name; }).length;
    return z;
  });

  var dom = null, group = null, zones = [];

  function build(kit) {
    dom = kit.dom();
    group = document.getElementById('figWarm');
  }
  function centreOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function middleOf(pts) {
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    return { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2,
             y: (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 };
  }

  /* One shape, on its card, lit, swiped, told. The card stays where it
     was sorted. */
  function playItem(it, i) {
    var mid = middleOf(it.pts);
    var card = K.buildCard(group, mid.x, mid.y);
    var shape = S.build(card.g, it.pts, { perim: it.hi === 'perim', area: it.hi === 'area' });
    var last = i === ITEMS.length - 1;
    var answered = false, stopHand = null;

    return Flow.anim(Beats.swipeIn(card))
      .then(function () { return Flow.anim(Beats.drawShape(shape, { time: 0.9 })); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return Flow.anim(it.hi === 'perim' ? Beats.perimOn(shape, 1.0) : Beats.areaOn(shape, 0.8));
      })
      .then(function () { return Flow.wait(SHORT); })
      /* the instruction, once */
      .then(function () { return i === 0 ? K.say('w1Ask') : null; })
      .then(function () {
        var target = zones.filter(function (z) { return z.name === it.answer; })[0];
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (answered) return;
          stopHand = W.handDrag(function () { return centreOf(card.face); },
                                function () { return centreOf(target.body); }, 60);
        }));
        return K.armSwipe(card, zones, it.answer, {
          onTouch: function () { if (stopHand) { stopHand(); stopHand = null; } },
          onWrong: function () { K.quiet(K.speakBySentence(it.wrong, 'confused')); }
        });
      })
      .then(function () {
        answered = true;
        if (stopHand) { stopHand(); stopHand = null; }
        return Flow.wait(Beats.ringing());
      })
      .then(function () { return K.speakBySentence(it.right, 'happy'); })
      .then(function () {
        if (!last) return null;
        K.celebrate();
        return Flow.wait(Beats.ringing()).then(function () { return K.say('w1Done', 'happy'); });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  function sceneSort() {
    return K.openBoard()
      .then(function () { group.removeAttribute('hidden'); })
      .then(function () {
        zones = ZONES.map(function (z) { return K.buildZone(group, z); });
        return Flow.anim(Beats.zonesIn(zones));
      })
      .then(function () {
        return ITEMS.reduce(function (chain, it, i) {
          return chain.then(function () { return playItem(it, i); });
        }, Promise.resolve());
      })
      .then(function () { return K.say('w1Identified'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })
      /* the panels and the sorted shapes go before the next scene draws */
      .then(function () { return Flow.anim(Beats.zonesOut(zones)); })
      .then(reset);
  }

  function parts() { return [group]; }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    zones = [];
  }
  function stage() { /* the scene opens the board itself */ }

  Pages.addSection({
    name: 'Warm-up',
    scenes: [{ name: 'Perimeter or area?', play: sceneSort }],
    build: build, parts: parts, reset: reset, stage: stage
  });
})(window);
