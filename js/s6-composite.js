/* ==========================================================================
 * s6-composite.js -- composite shapes
 * --------------------------------------------------------------------------
 * Shapes made of simpler shapes: what they are, walking only the outer
 * boundary, pushing an L-shape's sides out into a rectangle, and four
 * questions -- a six-sided shape, an arrow, a staircase and a rangoli.
 * ========================================================================== */
(function (global) {
  'use strict';

  var Flow = global.Flow, Beats = global.Beats, Pages = global.Pages, S = global.Shapes, W = global.W, M = global.Motion;
  if (!Pages || !Pages.addSection) { console.error('s6-composite.js: load js/pages.js first.'); return; }
  var K = Pages.kit;
  function T(k, r) { return global.T ? global.T(k, r) : k; }
  var BEAT = K.BEAT, SHORT = K.SHORT, LOOK = K.LOOK;
  var CARD_AT = { right: '4%', top: '12%', width: '42%' };

  var dom = null, group = null, layerNodes = [];
  function build(kit) { dom = kit.dom(); group = document.getElementById('figComposite'); }
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function cm(n) { return T('lblCm', { n: n }); }
  function px(list, k, ox, oy) { return list.map(function (p) { return { x: S.round2(ox + p[0] * k), y: S.round2(oy + p[1] * k) }; }); }
  function keep(n) { layerNodes.push(n); return n; }
  function drop(nodes) {
    nodes.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    layerNodes = layerNodes.filter(function (n) { return nodes.indexOf(n) < 0; });
  }
  function clearPage(g, cardEls) {
    return Promise.all([Flow.anim(Beats.cardOut(cardEls)), Flow.anim(Beats.clearFigure([g]))]).then(function () {
      drop(cardEls);
      if (g.parentNode) g.parentNode.removeChild(g);
    });
  }

  /* A little composite drawn in a card: a list of polygons, in two fills. */
  function miniComposite(polys, w, hh) {
    var svg = S.el('svg', { viewBox: '0 0 ' + w + ' ' + hh });
    polys = polys.map(function (p) { return p.map(function (q) { return { x: q[0], y: q[1] }; }); });
    polys.forEach(function (p, i) {
      var path = S.el('path', { d: S.pathOf(p), 'class': 'shape__fill' + (i ? ' is-deep' : '') });
      path.style.opacity = 1;
      svg.appendChild(path);
    });
    polys.forEach(function (p) {
      var o = S.el('path', { d: S.pathOf(p), 'class': 'shape__outline' });
      o.style.opacity = 1;
      svg.appendChild(o);
    });
    return svg;
  }

  /* ---- page 1: what a composite shape is ---------------------------------- */
  function pageIntro() {
    var head = keep(h('p', 'ptable__head', dom.layer));
    head.style.cssText = 'position:absolute;left:0;right:0;top:2%;';
    head.textContent = T('c0Title');
    var grid = keep(h('div', 'grid grid--3', dom.layer));
    grid.style.top = '16%';
    var cards = [
      { svg: miniComposite([[[30, 30], [170, 30], [170, 80], [30, 80]], [[30, 80], [100, 80], [100, 150], [30, 150]]], 200, 170), title: 'lblLShape', sub: 'lblTwoRects' },
      { svg: miniComposite([[[50, 70], [150, 70], [150, 150], [50, 150]], [[40, 70], [100, 20], [160, 70]]], 200, 170), title: 'lblHouse', sub: 'lblSquareTri' },
      { svg: miniComposite([[[30, 30], [170, 30], [170, 75], [30, 75]], [[75, 75], [125, 75], [125, 150], [75, 150]]], 200, 170), title: 'lblTShape', sub: 'lblTwoRects' }
    ].map(function (c) {
      var card = h('div', 'card', grid);
      card.appendChild(c.svg);
      var t = h('p', 'card__title', card); t.textContent = T(c.title);
      var s = h('p', 'card__sub', card); s.textContent = T(c.sub);
      return card;
    });
    return Flow.anim(Beats.rowIn(head))
      .then(function () { return Flow.anim(Beats.cardsIn(cards, 0.22)); })
      .then(function () { return K.speakBySentence('c0Say'); })
      .then(function () { return K.handOver(); })
      .then(function () { return Flow.anim(Beats.cardOut([head, grid])); })
      .then(function () { drop([head, grid]); });
  }

  /* The L-shape, 12 by 9, in figure units (20 per cm). */
  var L_PTS = px([[0, 0], [12, 0], [12, 5], [7, 5], [7, 9], [0, 9]], 20, 112, 96);
  var L_JOIN = { a: { x: 112, y: 196 }, b: { x: 252, y: 196 } };

  /* ---- page 2: walk the outer boundary -------------------------------------- */
  function pageWalk() {
    var g = S.el('g'); group.appendChild(g);
    var shape = S.build(g, L_PTS, { inks: true });
    var inner = S.el('path', { 'class': 'inner-line', d: S.seg(L_JOIN.a, L_JOIN.b) });
    g.appendChild(inner);
    var card = keep(h('div', 'card', dom.layer));
    Object.keys(CARD_AT).forEach(function (k) { card.style[k] = CARD_AT[k]; });
    var t = h('p', 'card__title', card); t.textContent = T('c1Title');
    var r1 = h('div', 'card__row is-note', card); r1.textContent = T('c1Outer'); r1.style.color = 'var(--gold-deep)';
    var r2 = h('div', 'card__row is-note', card); r2.textContent = T('c1Inner'); r2.style.color = 'var(--wrong-border)';
    var r3 = h('div', 'card__row is-note', card); r3.textContent = T('c1Rule');
    M.set([r1, r2, r3], { opacity: 0 });
    return Flow.anim(Beats.drawShape(shape, { time: 1.4 }))
      .then(function () { return Flow.anim(M.to(inner, { opacity: 1, duration: M.dur(0.4) })); })
      .then(function () { return Flow.anim(Beats.cardIn(card)); })
      .then(function () {
        K.onPhrase('c1Say', 'outer boundary', function () {
          Flow.anim(Beats.rowIn(r1));
          return Flow.anim(Beats.walk(shape, 3.0, { onSide: function (k) { Beats.lightSide(shape, k); } }));
        });
        K.onPhrase('c1Say', 'inside', function () {
          inner.classList.add('is-no');
          Flow.anim(Beats.rowIn(r2));
          return Flow.anim(M.fromTo(inner, { strokeWidth: 3.5 }, { strokeWidth: 7, duration: M.dur(0.4), yoyo: true, repeat: 3, autoRound: false }));
        });
        return K.speakBySentence('c1Say');
      })
      .then(function () { return Flow.anim(Beats.rowIn(r3)); })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () { return K.handOver(); })
      .then(function () { return clearPage(g, [card]); });
  }

  /* ---- page 3: two rectangles make an L ------------------------------------- */
  function pageJoin() {
    var g = S.el('g'); group.appendChild(g);
    var top = S.build(g, px([[0, 0], [12, 0], [12, 5], [0, 5]], 20, 112, 96), { inks: [0, 0, 0, 0] });
    var low = S.build(g, px([[0, 5], [7, 5], [7, 9], [0, 9]], 20, 112, 96), { inks: [1, 1, 1, 1] });
    low.fill.classList.add('is-deep');
    var plus = S.el('text', { 'class': 'figure-label', x: 182, y: 230, 'text-anchor': 'middle', 'font-size': 44 });
    plus.textContent = '+';
    g.appendChild(plus);
    M.set(low.g, { y: 70 });
    M.set(plus, { opacity: 0 });
    var card = keep(h('div', 'card', dom.layer));
    Object.keys(CARD_AT).forEach(function (k) { card.style[k] = CARD_AT[k]; });
    var t = h('p', 'card__title', card); t.textContent = T('c2Title');
    var r = h('div', 'card__row is-note', card); r.textContent = T('c2Cap');
    return Flow.anim(Beats.drawShape(top, { time: 0.9, deep: false }))
      .then(function () { return Flow.anim(Beats.drawShape(low, { time: 0.7 })); })
      .then(function () { return Flow.anim(Beats.labelIn(plus)); })
      .then(function () { return Flow.wait(LOOK); })
      .then(function () {
        return Promise.all([
          Flow.anim(M.to(plus, { opacity: 0, duration: M.dur(0.3) })),
          Flow.anim(Beats.moveGroup(low.g, { y: 0 }, 0.9))
        ]);
      })
      .then(function () { return Flow.anim(Beats.cardIn(card)); })
      .then(function () { return K.speakBySentence('c2Say'); })
      .then(function () { return K.handOver(); })
      .then(function () { return clearPage(g, [card]); });
  }

  /* ---- page 4: push the sides out ------------------------------------------- */
  function pagePush() {
    var g = S.el('g'); group.appendChild(g);
    var shape = S.build(g, L_PTS, { inks: [0, 1, 2, 5, 4, 3], labels: [cm(12), '', '', '', '', cm(9)], offset: 30 });
    shape.sides[2].style.setProperty('--c', 'var(--lavender-deep)');
    shape.sides[3].style.setProperty('--c', 'var(--pink-deep)');
    var ghost = S.el('path', { 'class': 'inner-line', d: S.pathOf(px([[0, 0], [12, 0], [12, 9], [0, 9]], 20, 112, 96)) });
    g.appendChild(ghost);

    var pane = keep(h('div', 'pane', dom.layer));
    var card = h('div', 'card', pane);
    var t = h('p', 'card__title', card); t.textContent = T('c3Title');
    var s = h('p', 'card__sub', card); s.textContent = T('c3Push');
    var pink = W.slider(card, { label: T('c3Vert'), cls: 'slider--pink', min: 0, max: 1, value: 0, target: 1, snap: 0.08, fmt: function () { return ''; },
      onChange: function (v) { M.set(shape.sides[3], { x: v * 100 }); } });
    var vert = h('div', 'card__row', card); vert.textContent = T('c3Unknown'); vert.style.color = 'var(--pink-deep)';
    var purple = W.slider(card, { label: T('c3Horz'), cls: 'slider--purple', min: 0, max: 1, value: 0, target: 1, snap: 0.08, fmt: function () { return ''; },
      onChange: function (v) { M.set(shape.sides[2], { y: v * 80 }); } });
    var horz = h('div', 'card__row', card); horz.textContent = T('c3Unknown'); horz.style.color = 'var(--lavender-deep)';
    var tot = h('p', 'card__sub', card); tot.textContent = T('c3Perim');
    var total = h('div', 'card__row is-result', card); total.textContent = T('c3Unknown');
    card.classList.add('card--push');
    M.set(pane, { opacity: 0 });

    function setRow(el, key) {
      return Flow.anim(M.to(el, { opacity: 0, duration: M.dur(0.15) })).then(function () {
        el.textContent = T(key);
        return Flow.anim(Beats.rowIn(el));
      });
    }
    return Flow.anim(Beats.drawShape(shape, { time: 1.3 }))
      .then(function () { return Flow.anim(Beats.labelsIn([shape.labels[0], shape.labels[5]])); })
      .then(function () { return Flow.anim(Beats.cardIn(pane)); })
      .then(function () { return Flow.anim(Beats.rowIn(pink.row)); })
      .then(function () { return Flow.anim(Beats.rowIn(purple.row)); })
      .then(function () { return K.speakBySentence('c3Say1'); })
      .then(function () { return pink.ask(); })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.lightSide(shape, 5)), Flow.anim(Beats.lightSide(shape, 1)), Flow.anim(Beats.lightSide(shape, 3)),
          setRow(vert, 'c3Vert18')
        ]);
      })
      .then(function () { return K.speakBySentence('c3Say2'); })
      .then(function () { return purple.ask(); })
      .then(function () {
        return Promise.all([
          Flow.anim(Beats.lightSide(shape, 0)), Flow.anim(Beats.lightSide(shape, 2)), Flow.anim(Beats.lightSide(shape, 4)),
          setRow(horz, 'c3Horz24'),
          Flow.anim(M.to(ghost, { opacity: 1, duration: M.dur(0.5) }))
        ]);
      })
      .then(function () { return setRow(total, 'c3Total'); })
      .then(function () {
        var c = shape.centre(); K.burstAt(c.x + 60, c.y);
        return K.speakBySentence('c3Say3', 'happy');
      })
      .then(function () { return K.handOver(); })
      .then(function () { return clearPage(g, [pane]); });
  }

  /* ---- a question on a shape: ask, answer, walk ------------------------------ */
  function question(q) {
    var g = S.el('g'); group.appendChild(g);
    var shape = S.build(g, q.pts, { inks: true, labels: q.labels.map(function (n) { return n == null ? '' : cm(n); }), offset: q.offset || 28 });
    var extra = q.extra ? q.extra(g, shape) : null;
    var card = null;
    return Flow.anim(Beats.drawShape(shape, { time: 1.4 }))
      .then(function () { return extra && extra.after ? extra.after() : null; })
      .then(function () { return Flow.anim(Beats.labelsIn(shape.labels.filter(function (l) { return l.textContent; }))); })
      .then(function () { return K.say(q.ask); })
      .then(function () { return K.offerChoices(q.opts.map(cm)); })
      .then(function (btns) {
        return K.speakBySentence(q.say).then(function () { return btns; });
      })
      .then(function (btns) {
        return K.askUntilRight(btns, q.right, {
          onWrong: function (k) { return K.speakBySentence(q.wrong[k] || q.generic || 'bWrongGeneric', 'confused'); }
        });
      })
      .then(function () {
        card = W.sumCard(dom.layer, { title: T('lblPerimeter'), style: CARD_AT });
        keep(card.el);
        return Flow.anim(Beats.cardIn(card.el));
      })
      .then(function () { return q.walk(shape, card, extra); })
      .then(function () {
        var c = shape.centre(); K.burstAt(c.x, c.y);
        return K.speakBySentence(q.told, 'happy');
      })
      .then(function () { return K.handOver(); })
      .then(function () { return Promise.all([K.clearChoices(), clearPage(g, [card.el])]); });
  }
  function walkSum(sum, total) {
    return function (shape, card) {
      return Flow.anim(Beats.walk(shape, 2.8, {
        onSide: function (k) { if (sum[k]) { Beats.lightSide(shape, k, { label: true }); card.term(String(sum[k]), k); } }
      })).then(function () { return card.result('= ' + cm(total)); });
    };
  }

  var SIX = px([[0, 0], [9, 0], [9, 3], [4, 3], [4, 8], [0, 8]], 24, 130, 100);
  var ARROW = px([[0, 2], [7, 2], [7, 0], [10, 4], [7, 8], [7, 6], [0, 6]], 26, 110, 92);
  var STAIR = px([[0, 8], [0, 0], [4, 0], [4, 2], [6, 2], [6, 4], [8, 4], [8, 6], [10, 6], [10, 8]], 24, 120, 100);
  var STAIR_OUT = px([[0, 8], [0, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 0], [10, 8]], 24, 120, 100);
  var RS = 84, RO = { x: 160, y: 72 };
  var RANG = px([[1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [2, 2], [2, 3], [1, 3], [1, 2], [0, 2], [0, 1], [1, 1]], RS, RO.x, RO.y);

  var QS = [
    { pts: SIX, labels: [9, 3, 5, 5, 4, 8], ask: 'c4Ask', say: 'c4Say', opts: [34, 29, 17, 25], right: 0,
      wrong: { 1: 'c4Wrong29' }, told: 'c4Right', walk: walkSum([9, 3, 5, 5, 4, 8], 34) },
    { pts: ARROW, labels: [7, 2, 5, 5, 2, 7, 4], offset: 26, ask: 'c5Ask', say: 'c5Say', opts: [28, 32, 27, 25], right: 1,
      wrong: { 0: 'c5Wrong28' }, told: 'c5Right', walk: walkSum([7, 2, 5, 5, 2, 7, 4], 32) },
    { pts: STAIR, labels: [8, null, null, null, null, null, null, null, null, 10], ask: 'c6Ask', say: 'c6Say', opts: [18, 36, 80, 28], right: 1,
      wrong: { 3: 'c6Wrong28' }, told: 'c6Right',
      walk: function (shape, card) {
        /* the steps pushed out into a rectangle, then 2 x (10 + 8) */
        return Flow.anim(Beats.morphShape(shape, STAIR_OUT, 1.3))
          .then(function () { return Flow.anim(Beats.partPulse(shape.sides, 1)); })
          .then(function () { return card.row('2 × (10 + 8)').show(); })
          .then(function () { return card.result('= ' + cm(36)); });
      } },
    { pts: RANG, labels: [20, null, null, null, null, null, null, null, null, null, null, null], ask: 'c7Ask', say: 'c7Say', opts: [120, 240, 400, 200], right: 1,
      wrong: { 2: 'c7Wrong400' }, generic: 'cWrongGeneric', told: 'c7Right',
      extra: function (g) {
        /* the five squares: the middle one's sides, dashed, and the lights */
        var mid = px([[1, 1], [2, 1], [2, 2], [1, 2]], RS, RO.x, RO.y);
        var inner = S.el('path', { 'class': 'inner-line', d: S.pathOf(mid) });
        g.appendChild(inner);
        var dots = [];
        for (var i = 0; i < RANG.length; i++) {
          var a = RANG[i], b = RANG[(i + 1) % RANG.length];
          for (var k = 0; k < 4; k++) {
            var d = S.el('circle', { 'class': 'light', r: 5, cx: S.round2(a.x + (b.x - a.x) * (k + 0.5) / 4), cy: S.round2(a.y + (b.y - a.y) * (k + 0.5) / 4) });
            g.appendChild(d); dots.push(d);
          }
        }
        return { inner: inner, dots: dots, after: function () { return Flow.anim(M.to(inner, { opacity: 0.8, duration: M.dur(0.4) })); } };
      },
      walk: function (shape, card, extra) {
        return Promise.all([
          Flow.anim(Beats.lightsOn(extra.dots, 0.05)),
          Flow.anim(Beats.walk(shape, 2.8, { onSide: function (k) { Beats.lightSide(shape, k); } }))
        ]).then(function () { return card.row('12 × 20').show(); })
          .then(function () { return card.result('= ' + cm(240)); });
      } }
  ];

  function sceneComposite() {
    return K.wipeBoard()
      .then(function () { group.removeAttribute('hidden'); })
      .then(pageIntro)
      .then(pageWalk)
      .then(pageJoin)
      .then(pagePush)
      .then(function () {
        return QS.reduce(function (chain, q) { return chain.then(function () { return question(q); }); }, Promise.resolve());
      });
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
    name: 'Composite shapes',
    scenes: [{ name: 'Composite shapes', play: sceneComposite }],
    build: build, parts: parts, wipe: wipe, reset: reset, stage: stage
  });
})(window);
