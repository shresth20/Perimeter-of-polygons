/* ==========================================================================
 * s3-polygons.js -- other polygons: their names, and regular or irregular
 * --------------------------------------------------------------------------
 * Two scenes. "Name the polygons": four regular polygons in a row, a box
 * under each, four names to drag. "Regular or irregular": six polygons, one
 * at a time, each on an ice card swiped left (Regular) or right
 * (Irregular), the panels keeping every card sorted into them; then the two
 * kinds side by side.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s3-polygons.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var NUDGE_AFTER = 2400;

  var SIDES = { lblPentagon: 5, lblHexagon: 6, lblHeptagon: 7, lblOctagon: 8 };
  /* the four figures, left to right: not in the order of their sides */
  var FIGS = [
    { name: 'lblHexagon', n: 6, cx: 140 }, { name: 'lblOctagon', n: 8, cx: 380 },
    { name: 'lblPentagon', n: 5, cx: 620 }, { name: 'lblHeptagon', n: 7, cx: 860 }
  ];
  var FIG_Y = 158, FIG_R = 76, BOX_Y = 282, BOX_W = 196;

  function at(cx, cy, pts) { return pts.map(function (p) { return { x: cx + p[0], y: cy + p[1] }; }); }
  var IRR_HEX  = [[-20, -85], [60, -60], [85, 10], [30, 80], [-50, 70], [-80, -10]];
  var IRR_HEPT = [[0, -88], [55, -62], [88, 0], [60, 55], [10, 85], [-60, 65], [-80, -20]];
  var IRR_PENT = [[-10, -90], [80, -30], [55, 70], [-40, 85], [-85, 0]];
  var SC = { x: 500, y: 196 };
  var ITEMS = [
    { pts: S.regular(5, SC.x, SC.y, 86), answer: 'zoneRegular',   wrong: 'o3Wrong1', right: 'o3Right1' },
    { pts: at(SC.x, SC.y, IRR_HEX),      answer: 'zoneIrregular', wrong: 'o3Wrong2', right: 'o3Right2' },
    { pts: S.regular(8, SC.x, SC.y, 86), answer: 'zoneRegular',   wrong: 'o3Wrong3', right: 'o3Right3' },
    { pts: at(SC.x, SC.y, IRR_HEPT),     answer: 'zoneIrregular', wrong: 'o3Wrong4', right: 'o3Right4' },
    { pts: at(SC.x, SC.y, IRR_PENT),     answer: 'zoneIrregular', wrong: 'o3Wrong5', right: 'o3Right5' },
    { pts: S.regular(7, SC.x, SC.y, 86), answer: 'zoneRegular',   wrong: 'o3Wrong6', right: 'o3Right6' }
  ];
  /* the two sides, and how many cards each will end up holding: the same
     big, flat panels as the warm-up's (no slab under them), close to the
     figure's edges -- see s1-warmup.js */
  var ZONES = [{ name: 'zoneRegular', side: 'left' }, { name: 'zoneIrregular', side: 'right' }].map(function (z) {
    z.cap = ITEMS.filter(function (it) { return it.answer === z.name; }).length;
    z.w = 290; z.h = 356; z.y = 32; z.m = 12; z.depth = false;
    return z;
  });

  var dom = null, gNames = null, gSort = null, layerNodes = [], zones = [];

  function build(kit) {
    dom = kit.dom();
    gNames = document.getElementById('figNames');
    gSort = document.getElementById('figSort');
  }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function centreOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ---- Scene 1: name the polygons ---------------------------------------- */
  function sceneNames() {
    var shapes = [], boxes = [];
    return K.interlude(['o0Intro'])
      /* the four figures, drawn one after another */
      .then(function () {
        gNames.removeAttribute('hidden');
        return FIGS.reduce(function (chain, f, i) {
          return chain.then(function () {
            var s = S.build(gNames, S.regular(f.n, f.cx, FIG_Y, FIG_R), { inks: true });
            shapes.push(s);
            return Flow.anim(Beats.drawShape(s, { time: 0.7 }));
          });
        }, Promise.resolve());
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        boxes = FIGS.map(function (f) { return K.buildBox(gNames, { name: f.name, x: f.cx - BOX_W / 2, y: BOX_Y, w: BOX_W }); });
        return boxes.reduce(function (chain, b) {
          return chain.then(function () { return Flow.anim(Beats.boxIn(b)); });
        }, Promise.resolve());
      })
      .then(function () {
        var chips = K.buildChips(dom.tray, K.shuffle(FIGS.map(function (f) { return f.name; })));
        K.chips(chips);
        return Flow.anim(Beats.trayIn(dom.tray, chips));
      })
      .then(function () { return K.say('o1Ask'); })
      .then(function () {
        var guide = null, touched = false;
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () { if (!touched) guide = K.dragGuide(boxes[0].rect); }));
        return K.armQuiz(boxes, K.chips(), {
          group: gNames,
          onTouch: function () { touched = true; if (guide) guide(); },
          onWrong: function (box, chip) {
            K.quiet(K.speakBySentence('o1Wrong' + SIDES[box.name], 'confused', { m: SIDES[chip.dataset.name] }));
          },
          onRight: function (box, chip, placed) {
            K.burstAt(box.centre.x, box.centre.y);
            if (placed < boxes.length) K.quiet(K.speak(K.keyed('fbCorrect'), 'happy'));
          }
        }).then(function () { if (guide) guide(); });
      })
      .then(function () { return Flow.anim(Beats.trayOut(dom.tray, K.chips())); })
      .then(function () {
        K.celebrate();
        return Flow.wait(Beats.ringing()).then(function () { return K.speakBySentence('o1Done', 'happy'); });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); })
      /* the sides of these polygons */
      .then(function () { return K.say('o2Look'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        var all = shapes.reduce(function (a, s) { return a.concat(s.sides); }, []);
        return K.speakBySentence('o2Regular', null).then(function () { return all; });
      })
      .then(function (all) {
        return Flow.anim(Beats.partPulse(all, 2));
      })
      .then(function () { return K.handOver(); });
  }

  /* ---- Scene 2: regular or irregular -------------------------------------- */
  function playItem(it, i) {
    var card = K.buildCard(gSort, SC.x, SC.y);
    var shape = S.build(card.g, it.pts, { inks: true });
    var last = i === ITEMS.length - 1, answered = false, stopHand = null;
    return Flow.anim(Beats.swipeIn(card))
      .then(function () { return Flow.anim(Beats.drawShape(shape, { time: 0.9 })); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return i === 0 ? K.say('o3Ask') : null; })
      .then(function () {
        var target = zones.filter(function (z) { return z.name === it.answer; })[0];
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (answered) return;
          stopHand = W.handDrag(function () { return centreOf(card.face); }, function () { return centreOf(target.body); }, 60);
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
        return Flow.wait(Beats.ringing()).then(function () { return K.say('o3Done', 'happy'); });
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }

  function miniShape(pts, w, hh) {
    var svg = S.el('svg', { viewBox: '0 0 ' + w + ' ' + hh });
    S.build(svg, pts, { inks: true });
    return svg;
  }
  function summary() {
    var grid = h('div', 'grid grid--2 grid--kinds', dom.layer);
    layerNodes.push(grid);
    var cards = [
      { svg: miniShape(S.regular(6, 125, 85, 70), 250, 170), title: 'o4RegTitle', lines: ['o4RegA', 'o4RegB'] },
      { svg: miniShape(at(125, 88, IRR_HEX.map(function (p) { return [p[0] * 0.85, p[1] * 0.85]; })), 250, 170), title: 'o4IrrTitle', lines: ['o4IrrA'] }
    ].map(function (c) {
      var card = h('div', 'card', grid);
      card.appendChild(c.svg);
      var text = h('div', 'card__text', card);
      var t = h('p', 'card__title', text); t.textContent = T(c.title);
      c.lines.forEach(function (k) { var r = h('div', 'card__row is-note', text); r.textContent = T(k); });
      return card;
    });
    return K.birdAway()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.cardsIn(cards, 0.22)); })
      .then(function () { return Flow.wait(LOOK); })
      .then(function () { return K.speakBySentence('o4Great', 'happy'); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.say('o4Next'); })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return K.handOver(); });
  }
  function sceneSort() {
    return K.wipeBoard()
      .then(function () { gSort.removeAttribute('hidden'); })
      .then(function () {
        zones = ZONES.map(function (z) { return K.buildZone(gSort, z); });
        return Flow.anim(Beats.zonesIn(zones));
      })
      .then(function () {
        return ITEMS.reduce(function (chain, it, i) { return chain.then(function () { return playItem(it, i); }); }, Promise.resolve());
      })
      .then(function () { return Flow.anim(Beats.zonesOut(zones)); })
      .then(summary);
  }

  function parts() { return [gNames, gSort]; }
  function wipe() {
    var nodes = layerNodes.slice();
    return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : [];
  }
  function reset() {
    [gNames, gSort].forEach(function (g) { g.setAttribute('hidden', ''); g.textContent = ''; });
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
    zones = [];
  }
  function stage() { /* both scenes wipe the board first */ }

  Pages.addSection({
    name: 'Polygons',
    scenes: [
      { name: 'Name the polygons', play: sceneNames },
      { name: 'Regular or irregular', play: sceneSort }
    ],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
