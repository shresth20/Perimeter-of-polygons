/* ==========================================================================
 * s1-warmup.js -- the warm-up: perimeter or area?
 * --------------------------------------------------------------------------
 * Six shapes, one at a time, each on an ice card with either its boundary
 * lit (yellow) or its inside lit (light blue); the learner swipes the card
 * left (Perimeter) or right (Area). The two side panels stay for the whole
 * sorting and keep every card sorted into them. Each page turns by itself
 * once its shape is sorted, and the next shape comes in. After the last one
 * the panels go and a square, a triangle and a rectangle come back on their
 * own, their boundaries running yellow while the bird says what the
 * perimeter is; only then does Next appear.
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

  /* a right sort is answered "Correct!" alone; a wrong one is told why */
  var ITEMS = [
    { pts: SQUARE, hi: 'perim', answer: 'lblPerimeter', wrong: 'w1Wrong1' },
    { pts: TRI,    hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong2' },
    { pts: RECT,   hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong3' },
    { pts: TRI,    hi: 'perim', answer: 'lblPerimeter', wrong: 'w1Wrong4' },
    { pts: SQUARE, hi: 'area',  answer: 'lblArea',      wrong: 'w1Wrong5' },
    { pts: RECT,   hi: 'perim', answer: 'lblPerimeter', wrong: 'w1Wrong6' }
  ];
  /* the recap after the sorting: a square, a triangle and a rectangle in a
     row across the board */
  var RECAP = [
    S.rect(98, 125, 165, 165),
    [{ x: 500, y: 112 }, { x: 602, y: 290 }, { x: 398, y: 290 }],
    S.rect(722, 138, 220, 140)
  ];
  /* the two sides, and how many cards each will end up holding: big, flat
     panels (no slab under them) close to the figure's edges */
  var ZONES = [{ name: 'lblPerimeter', side: 'left' }, { name: 'lblArea', side: 'right' }].map(function (z) {
    z.cap = ITEMS.filter(function (it) { return it.answer === z.name; }).length;
    z.w = 290; z.h = 356; z.y = 32; z.m = 12; z.depth = false;
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
    /* every card wears the same look -- a light blue inside with a plain
       blue edge -- so only the highlight tells the two apart */
    var shape = S.build(card.g, it.pts, { perim: it.hi === 'perim', area: it.hi === 'area',
                                          cls: 'shape--area' });
    var last = i === ITEMS.length - 1;
    var answered = false, stopHand = null;

    return Flow.anim(Beats.swipeIn(card))
      /* a lit boundary gets the light blue inside poured in with its outline
         (then the golden stroke runs round it); a lit inside is drawn as an
         outline only and gets its one fill from the wash poured in next */
      .then(function () { return Flow.anim(Beats.drawShape(shape, { time: 0.9, fill: it.hi === 'perim' })); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return Flow.anim(it.hi === 'perim' ? Beats.perimOn(shape, 1.0) : Beats.areaOn(shape, 0.8));
      })
      .then(function () { return Flow.wait(SHORT); })
      /* the instruction, once */
      .then(function () { return i === 0 ? K.say('w1Ask') : null; })
      .then(function () {
        /* the hint sways the card both ways: it never points at the answer */
        var left = zones.filter(function (z) { return z.side === 'left'; })[0];
        var right = zones.filter(function (z) { return z.side === 'right'; })[0];
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (answered) return;
          stopHand = W.handSway(function () { return centreOf(card.face); },
                                function () { return centreOf(left.body); },
                                function () { return centreOf(right.body); }, 60);
        }));
        return K.armSwipe(card, zones, it.answer, {
          onTouch: function () { if (stopHand) { stopHand(); stopHand = null; } },
          onWrong: function () { K.quiet(K.speakBySentence(it.wrong, 'confused')); }
        });
      })
      .then(function () {
        answered = true;
        if (stopHand) { stopHand(); stopHand = null; }
        /* landed in its panel: the golden boundary fades out, leaving the
           shape's plain outline -- nothing glows once it is sorted */
        if (shape.perim) K.quiet(Flow.anim(Beats.highlightOff(shape)));
        return Flow.wait(Beats.ringing());
      })
      .then(function () { return K.speakBySentence('fbCorrect', 'happy'); })
      .then(function () {
        if (!last) return null;
        K.celebrate();
        return Flow.wait(Beats.ringing()).then(function () { return K.say('w1Done', 'happy'); });
      })
      .then(function () { return Flow.wait(SHORT); })
      /* no Next between shapes, nor after the last: the page turns itself
         and the next card (or the recap) comes in; Next waits for the end
         of the warm-up */
      .then(function () { return K.autoTurn(BEAT); });
  }

  /* The sorting done: the panels and the sorted cards go, and the three
     shapes come back on their own, drawn by the pen; then their boundaries
     run yellow, one after another, while the bird says what the perimeter
     is. The board is left so for the next section's wipe. */
  function recap() {
    var shapes = [];
    return Flow.anim(Beats.zonesOut(zones))
      .then(function () {
        zones.forEach(function (z) {
          z.kept.forEach(function (c) { if (c.g.parentNode) c.g.parentNode.removeChild(c.g); });
          if (z.g.parentNode) z.g.parentNode.removeChild(z.g);
        });
        zones = [];
        shapes = RECAP.map(function (pts) { return S.build(group, pts, { perim: true }); });
        return Promise.all(shapes.map(function (s, i) {
          return Flow.wait(i * 260).then(function () { return Flow.anim(Beats.drawShape(s, { time: 0.8, fill: false })); });
        }));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return Promise.all([
          K.say('w1Define'),
          Promise.all(shapes.map(function (s, i) {
            return Flow.wait(i * 420).then(function () { return Flow.anim(Beats.perimOn(s, 1.1)); });
          }))
        ]);
      })
      .then(function () { return Flow.wait(BEAT); })
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
      /* the panels go, and the three shapes' boundaries are recapped; the
         wrap-up lines ("We have identified...", "Let's recall...") open the
         next section, in the bubble with the board away -- see s2-basics.js,
         whose wipe takes the recap's shapes away */
      .then(recap);
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
