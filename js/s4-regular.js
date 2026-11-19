/* ==========================================================================
 * s4-regular.js -- the perimeter of regular polygons
 * --------------------------------------------------------------------------
 * The equilateral triangle, tapped side by side into a + a + a = 3a; the
 * square and the pentagon walked the same way; the pattern in a table; and
 * 6a, 7a, 8a dragged onto a hexagon, a heptagon and an octagon.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s4-regular.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var NUDGE_AFTER = 2400;
  var CARD_AT = { right: '4%', top: '12%', width: '42%' };

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figRegular'); }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function aLabels(n) { var a = []; for (var i = 0; i < n; i++) a.push('a'); return a; }
  function clearPage(g, cardEls) {
    return Promise.all([Flow.anim(Beats.cardOut(cardEls)), Flow.anim(Beats.clearFigure([g]))]).then(function () {
      cardEls.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); layerNodes = layerNodes.filter(function (n) { return n !== c; }); });
      if (g.parentNode) g.parentNode.removeChild(g);
    });
  }

  /* ---- page 1: the triangle, tapped --------------------------------------- */
  function pageTriangle() {
    var g = S.el('g'); group.appendChild(g);
    var shape = S.build(g, S.regular(3, 300, 220, 118), { inks: true, labels: aLabels(3), offset: 30, hits: true });
    var card = W.sumCard(dom.layer, { title: T('lblAddSides'), style: CARD_AT });
    layerNodes.push(card.el);
    card.hint(T('lblTapBegin'));
    var stopHand = null, touched = false;
    return Flow.anim(Beats.drawShape(shape, { time: 1.2 }))
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        K.onPhrase('r1Start', 'Let each side', function () { return Flow.anim(Beats.labelsIn(shape.labels)); });
        return K.speakBySentence('r1Start');
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () { return Flow.anim(Beats.cardIn(card.el)); })
      .then(function () { return K.speakBySentence('r1Walk'); })
      .then(function () {
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () { if (!touched) stopHand = W.handNudge(shape.hits[0], { x: 0.5, y: 0.5 }); }));
        return K.armTapSides(shape, {
          onTap: function (i) {
            touched = true;
            if (stopHand) { stopHand(); stopHand = null; }
            Beats.lightSide(shape, i, { label: true });
            card.term('a', i);
          }
        });
      })
      .then(function () { if (stopHand) stopHand(); return Flow.wait(SHORT); })
      .then(function () { return card.result(T('lblEq3a')); })
      .then(function () { return card.row(T('lblEq3side'), 'is-soft').show(); })
      .then(function () {
        var c = shape.centre(); K.burstAt(c.x, c.y);
        return K.speakBySentence('r1Done', 'happy');
      })
      .then(function () { return K.handOver(); })
      .then(function () { return clearPage(g, [card.el]); });
  }

  /* ---- pages 2 and 3: the square and the pentagon, walked ------------------ */
  function pageWalked(o) {
    var g = S.el('g'); group.appendChild(g);
    var shape = S.build(g, o.pts, { inks: true, labels: aLabels(o.pts.length), offset: 30 });
    var card = W.sumCard(dom.layer, { title: T(o.title), sub: T(o.sub), style: CARD_AT });
    layerNodes.push(card.el);
    return Flow.anim(Beats.drawShape(shape, { time: 1.0 }))
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels)); })
      .then(function () { return Flow.anim(Beats.cardIn(card.el)); })
      .then(function () {
        return Flow.anim(Beats.walk(shape, 2.2, {
          onSide: function (k) { Beats.lightSide(shape, k, { label: true }); card.term('a', k); }
        }));
      })
      .then(function () { return card.result(T(o.eq)); })
      .then(function () { return card.row(T(o.rule), 'is-soft').show(); })
      .then(function () { return K.speakBySentence(o.say); })
      .then(function () { return K.handOver(); })
      .then(function () { return clearPage(g, [card.el]); });
  }

  /* ---- page 4: the pattern ------------------------------------------------- */
  function miniShape(pts) {
    var svg = S.el('svg', { viewBox: '0 0 120 110' });
    S.build(svg, pts, { inks: true });
    return svg;
  }
  function pagePattern() {
    var table = h('div', 'ptable', dom.layer);
    layerNodes.push(table);
    var head = h('p', 'ptable__head', table); head.textContent = T('r4Title');
    var rows = [
      { pts: S.regular(3, 60, 60, 46), name: 'r4Row1Name', sides: 'r4Row1Sides', eq: 'r4Row1Eq' },
      { pts: S.rect(22, 17, 76, 76), name: 'r4Row2Name', sides: 'r4Row2Sides', eq: 'r4Row2Eq' },
      { pts: S.regular(5, 60, 58, 46), name: 'r4Row3Name', sides: 'r4Row3Sides', eq: 'r4Row3Eq' }
    ].map(function (r) {
      var card = h('div', 'card', table);
      card.appendChild(miniShape(r.pts));
      var n = h('span', 'ptable__name', card); n.textContent = T(r.name);
      var s = h('span', 'ptable__sides', card); s.textContent = T(r.sides);
      var e = h('span', 'ptable__eq', card); global.MathText.write(e, T(r.eq));
      return card;
    });
    return K.birdAway()
      .then(function () { return Flow.anim(K.collapseHeader(true)); })
      .then(function () { return Flow.anim(Beats.rowIn(head)); })
      .then(function () { return Flow.anim(Beats.cardsIn(rows, 0.3)); })
      .then(function () { return Flow.wait(LOOK); })
      .then(function () { return K.speakBySentence('r4Say'); })
      .then(function () { return K.handOver(); });
  }

  /* ---- page 5: 6a, 7a, 8a --------------------------------------------------- */
  var DRAG = [
    { name: 'lblHexagon',  n: 6, cx: 200, opt: 'opt6a', wrong: 'r5WrongHex' },
    { name: 'lblHeptagon', n: 7, cx: 500, opt: 'opt7a', wrong: 'r5WrongHept' },
    { name: 'lblOctagon',  n: 8, cx: 800, opt: 'opt8a', wrong: 'r5WrongOct' }
  ];
  function pageDrag() {
    var shapes = [], boxes = [];
    return K.wipeBoard()
      .then(function () {
        group.removeAttribute('hidden');
        return DRAG.reduce(function (chain, f) {
          return chain.then(function () {
            var s = S.build(group, S.regular(f.n, f.cx, 150, 72), { inks: true, labels: aLabels(f.n), offset: 20, name: f.name, nameGap: 34 });
            s.labels.forEach(function (l) { l.setAttribute('font-size', '20'); });
            shapes.push(s);
            return Flow.anim(Beats.drawShape(s, { time: 0.7 })).then(function () {
              return Flow.anim(Beats.labelsIn(s.labels.concat([s.name]), 0.06));
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        boxes = DRAG.map(function (f) { return K.buildBox(group, { name: f.opt, x: f.cx - 80, y: 296, w: 160 }); });
        return boxes.reduce(function (chain, b) { return chain.then(function () { return Flow.anim(Beats.boxIn(b)); }); }, Promise.resolve());
      })
      .then(function () {
        var chips = K.buildChips(dom.tray, K.shuffle(DRAG.map(function (f) { return f.opt; })));
        K.chips(chips);
        return Flow.anim(Beats.trayIn(dom.tray, chips));
      })
      .then(function () { return K.say('r5Ask'); })
      .then(function () { return K.speakBySentence('r5Say'); })
      .then(function () {
        var guide = null, touched = false;
        K.quiet(Flow.wait(NUDGE_AFTER).then(function () { if (!touched) guide = K.dragGuide(boxes[0].rect); }));
        return K.armQuiz(boxes, K.chips(), {
          group: group,
          onTouch: function () { touched = true; if (guide) guide(); },
          onWrong: function (box, chip) {
            var f = DRAG.filter(function (d) { return d.opt === box.name; })[0];
            K.quiet(K.speakBySentence(f.wrong, 'confused', { m: parseInt(T(chip.dataset.name), 10) }));
          },
          onRight: function (box, chip, placed) {
            K.burstAt(box.centre.x, box.centre.y);
            var s = shapes[DRAG.map(function (d) { return d.opt; }).indexOf(box.name)];
            if (s) K.quiet(Flow.anim(Beats.partPulse(s.sides, 1)));
            if (placed < boxes.length) K.quiet(K.speak(K.keyed('fbCorrect'), 'happy'));
          }
        }).then(function () { if (guide) guide(); });
      })
      .then(function () { return Flow.anim(Beats.trayOut(dom.tray, K.chips())); })
      .then(function () { return K.speakBySentence('r5Done1'); })
      .then(function () {
        K.celebrate();
        return Flow.wait(Beats.ringing()).then(function () { return K.speakBySentence('r5Done2', 'happy'); });
      })
      .then(function () { return K.handOver(); });
  }

  function sceneRegular() {
    return K.wipeBoard()
      .then(function () { group.removeAttribute('hidden'); })
      .then(pageTriangle)
      .then(function () { return pageWalked({ pts: S.rect(215, 128, 160, 160), title: 'r2Title', sub: 'r2Sub', eq: 'r2Eq', rule: 'r2Rule', say: 'r2Say' }); })
      .then(function () { return pageWalked({ pts: S.regular(5, 295, 212, 118), title: 'r3Title', sub: 'r3Sub', eq: 'r3Eq', rule: 'r3Rule', say: 'r3Say' }); })
      .then(pagePattern)
      .then(pageDrag);
  }

  function parts() { return [group]; }
  function wipe() {
    var nodes = layerNodes.slice();
    return nodes.length ? [Flow.anim(Beats.cardOut(nodes))] : [];
  }
  function reset() {
    group.setAttribute('hidden', '');
    group.textContent = '';
    layerNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = [];
  }
  function stage() {}

  Pages.addSection({
    name: 'Regular polygons',
    scenes: [{ name: 'Regular perimeters', play: sceneRegular }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
