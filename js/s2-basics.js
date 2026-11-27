/* ==========================================================================
 * s2-basics.js -- the perimeter of a rectangle, a square and a triangle
 * --------------------------------------------------------------------------
 * Three questions. Each shape is drawn large by the pen in the middle of
 * the board, its lengths written on, then carried to the left; the bird
 * jumps up on the right and asks in its bubble, three answers under it
 * ("Tap the correct answer." is heard only) -- the circle game's formula
 * pane, in ice (pages.js: the perch). Every verdict is said in the bubble,
 * written and heard: a wrong answer shakes, is told why (the line for the
 * answer tapped, the bubble red; the shape's sides breathe as the line
 * gets to them) and the answers are shuffled out of sight; after three
 * wrong tries the answer is shown. A right (or shown) answer: its line in
 * the bubble (green when right) while the answers make way for the
 * working -- "Perimeter:" over the sum -- and, as the line gets to the
 * adding ("8 + 5 + 8 + 5 = 26 cm." / "Add all four sides."), a light runs
 * round the boundary and each side's length, as it is passed, is carried
 * off its label on the shape and dropped into the sum. Then the three
 * formulas, built one card at a time -- the shape's name over it, its rule
 * on one line under it: as its line is heard, a light runs round its sides
 * ("A rectangle has two lengths and two breadths."), and its rule is
 * written as it is said ("So, its perimeter is 2 × (l + b).").
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
     two slips worth answering, each with its own line (`wrong`, by the
     answer, with the words at which the shape's sides breathe). `told` is
     said on a right answer, `reveal` when the answer is shown after three
     wrong tries; the light walks the sides as each gets to its adding
     (`toldAt`, REVEAL_AT).
       Every side has its length written on -- all four of the rectangle's
     too -- and sides of one length share one ink. The triangle is drawn a
     size up (12 : 9 : 15, 25 figure units to the cm). */
  var MID_X = 500, ASIDE_X = 250;
  var WALK_PER_SIDE = 1.0;   /* s: the light's pace round the boundary -- a side a length's carry (Beats.termFly) */
  var QS = [
    { pts: S.rect(332, 105, 336, 210), sum: [8, 5, 8, 5], total: 26,
      ask: 'b1Ask', opts: [13, 40, 26], right: 2,
      wrong: { 13: { key: 'b1Wrong13', at: 'has four' }, 40: { key: 'b1Wrong40', at: 'add the sides' } },
      told: 'b1Right', toldAt: '8 + 5', reveal: 'b1Reveal' },
    { pts: S.rect(386, 96, 228, 228), sum: [15, 15, 15, 15], total: 60,
      ask: 'b2Ask', opts: [30, 60, 225], right: 1,
      wrong: { 30: { key: 'b2Wrong30', at: 'has four' }, 225: { key: 'b2Wrong225', at: 'add the sides' } },
      told: 'b2Right', toldAt: '15 + 15', reveal: 'b2Reveal' },
    { pts: [{ x: 350, y: 97.5 }, { x: 650, y: 97.5 }, { x: 650, y: 322.5 }], sum: [12, 9, 15], total: 36,
      ask: 'b3Ask', opts: [36, 45, 27], right: 0,
      wrong: { 45: { key: 'b3Wrong45', at: 'Add 12' }, 27: { key: 'b3Wrong27', at: 'has three' } },
      told: 'b3Right', toldAt: '12 + 9', reveal: 'b3Reveal' }
  ];
  /* a wrong answer with no line of its own: the general one */
  var NOT_QUITE = { key: 'bNotQuite', at: 'all the sides' };
  var REVEAL_AT = 'Add all';
  /* a formula card's rule is written as its line gets to it */
  var RULE_AT = 'So, its perimeter';
  /* ...then read along with the voice: "Perimeter:" lights up as this word
     is heard, then each mark of the rule as its own word is */
  var NAME_AT = 'perimeter';
  var LET_GO = 500;          /* ms the last mark stays lit after it is said */

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

  /* The light's time round the shape for a right answer: over the adding
     its recording says ("8 + 5 + 8 + 5 ="), so each length joins the sum as
     it is heard -- `said` is when the line began. Its own pace when the
     line has no word timings, and never slower than that pace. */
  function walkSecs(key, said, pace) {
    var I = global.I18n;
    if (!said || !I || !I.cues || !I.cues(key)) return pace;
    var left = (K.voiceAt(key, '=') - (performance.now() - said)) / 1000;
    return Math.max(pace * 0.5, Math.min(pace, left));
  }

  /* The line for the wrong answer tapped (a pill's label, "13 cm"). */
  function wrongFor(q, label) {
    for (var k = 0; k < q.opts.length; k++) {
      if (cm(q.opts[k]) === label && q.wrong[q.opts[k]]) return q.wrong[q.opts[k]];
    }
    return NOT_QUITE;
  }

  /* One question: the shape in the middle, carried aside; the bird's ask;
     the answer; the walk. */
  function question(q, i) {
    var g = S.el('g');
    group.appendChild(g);
    var shape = S.build(g, q.pts, { inks: true, labels: q.sum.map(cm), cls: 'shape--big' });
    var dx = ASIDE_X - MID_X;
    var c = shape.centre();
    var answered = false;

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
          /* the wrong answer told why, in the bubble (red); as the line
             gets to the sides, they breathe on the shape -- unless the
             question is answered by then */
          onWrong: function (n, picked) {
            var w = wrongFor(q, picked);
            K.onPhrase(w.key, w.at, function () {
              if (!answered) return Flow.anim(Beats.partPulse(shape.sides, 1));
            });
            return K.perchSay(w.key, 'confused', 'no');
          }
        });
      })
      /* right (or shown): its line in the bubble while the answers make way
         for the working; as the line gets to the adding, the light walks
         the boundary, each side's length carried from its label on the
         shape into the sum as it is passed */
      .then(function (res) {
        answered = true;
        var key = res.revealed ? q.reveal : q.told;
        /* armed before the line is said; should the line be cut short, the
           walk goes once it is over */
        var adding = K.onPhrase(key, res.revealed ? REVEAL_AT : q.toldAt, function () {});
        var said = res.revealed ? 0 : performance.now();
        var told = res.revealed ? K.perchSay(q.reveal) : K.perchSay(q.told, 'happy', 'yes');
        var card = null;
        /* a revealed answer is left lit a moment longer: the learner did not find it */
        var work = Flow.wait(res.revealed ? LOOK : BEAT)
          .then(function () { return K.perchClear(); })
          .then(function () {
            card = K.perchSum(T('lblPerimeterIs'), { terms: q.sum, total: '= ' + cm(q.total) });
            return Flow.anim(Beats.cardIn(card.el));
          })
          .then(function () { return Promise.race([adding, told]); })
          .then(function () {
            /* as the light sets off along a side, the side swells and its
               length leaves its label for the sum -- the two arrive
               together; once walked, the side is left in the perimeter's
               yellow, so the boundary is seen to fill in as it is added
               (on a square, whose sides all wear one ink, this is what
               shows which 15 is being added) */
            var pace = WALK_PER_SIDE * q.sum.length, secs = walkSecs(key, said, pace);
            return Flow.anim(Beats.walk(shape, secs, {
              /* on the voice's clock: an even pace, a side as its length is said */
              ease: secs !== pace ? 'none' : undefined,
              onEnter: function (k) {
                Beats.lightSide(shape, k, { label: true });
                card.term(String(q.sum[k]), shape.ink(k), shape.labels[k]);
              },
              onSide: function (k) { shape.sides[k].classList.add('is-tapped'); }
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
  /* A rule written one mark to a span ("2", "×", "(", "l" ...), so each can
     light up on its own as it is said; a rule with a fraction in it is
     written whole, as before, and is not read along. */
  function writeMarks(el, text) {
    if (global.MathText.has(text)) { global.MathText.write(el, text); return []; }
    el.textContent = '';
    var marks = [];
    String(text).split('').forEach(function (ch) {
      if (/\s/.test(ch)) { el.appendChild(document.createTextNode(ch)); return; }
      var m = h('span', 'fx-ch', el); m.textContent = ch; marks.push(m);
    });
    return marks;
  }
  /* When each mark is heard in the line (ms into its recording): the marks,
     in order, are the line's last words that spell them -- "2 × ( l + b )."
     -- and take those words' timings. None without word timings. */
  function markTimes(key, marks) {
    var I = global.I18n, cues = I && I.cues ? I.cues(key) : null;
    if (!cues || !marks.length) return null;
    var words = (T(key).match(/\S+\s*/g) || []).map(function (w) { return w.trim().replace(/[.,!?:;]+$/, ''); });
    var chars = marks.map(function (m) { return m.textContent; });
    for (var s = words.length - chars.length; s >= 0; s--) {
      var k = 0;
      while (k < chars.length && words[s + k] === chars[k]) k++;
      if (k === chars.length) return cues.slice(s, s + k);
    }
    return null;
  }
  /* One mark lit: the highlighter behind it (css/polygons.css .fx-ch) and a
     small lift, out quick and back easy. */
  function liftMark(el) {
    var tl = M.timeline({ willChange: el, willChangeValue: 'transform',
                          revert: function () { M.set(el, { clearProps: 'transform' }); } });
    tl.to(el, { scale: 1.28, duration: M.dur(0.14), ease: 'power2.out' })
      .to(el, { scale: 1, duration: M.dur(0.26), ease: 'power2.in' });
    return tl;
  }
  /* The rule read along with its line, on the recording's clock: one mark
     lit at a time, each as its word is heard, the last let go after LET_GO.
     `t0` is when the line began. Nothing to do when skipped over, or when
     the line has no word timings (the rule is simply written, as before). */
  function readAlong(c, t0) {
    var times = Flow.isFast() ? null : markTimes(c.say, c.marks);
    if (!times) return Promise.resolve();
    var steps = c.marks.map(function (m, i) { return { el: m, at: times[i] }; });
    var named = K.voiceAt(c.say, NAME_AT);
    if (named > 0 && named < times[0]) steps.unshift({ el: c.sub, at: named });
    var lit = null;
    function light(el) {
      if (lit) lit.classList.remove('is-said');
      lit = el;
      if (el) { el.classList.add('is-said'); K.quiet(Flow.anim(liftMark(el))); }
    }
    return steps.reduce(function (chain, s) {
      return chain
        .then(function () { return Flow.wait(t0 + s.at - performance.now()); })
        .then(function () { light(s.el); });
    }, Promise.resolve())
      .then(function () { return Flow.wait(LET_GO); })
      .then(function () { light(null); }, function (err) { light(null); throw err; });
  }

  var KINDS = [
    { pts: S.rect(40, 36, 170, 100), labels: ['l', 'b', 'l', 'b'], title: 'lblRectangle', eq: 'fRect', say: 'b4Rect' },
    { pts: S.rect(65, 26, 120, 120), labels: ['a', 'a', 'a', 'a'], title: 'lblSquare', eq: 'fSquare', say: 'b4Square' },
    { pts: [{ x: 125, y: 30 }, { x: 215, y: 140 }, { x: 35, y: 140 }], labels: ['b', 'c', 'a'], title: 'lblTriangle', eq: 'fTriangle', say: 'b4Tri' }
  ];

  /* The three formulas, one card at a time -- the rectangle, the square,
     the triangle: the card comes in, its name is set down at the top, its
     shape is drawn by the pen under it and its sides named; then its line
     is heard (the voice only): as "A rectangle has two lengths and two
     breadths." is said a light runs once round the boundary, and as "So,
     its perimeter is 2 × (l + b)." begins its rule is written on one line
     under the shape -- "Perimeter: 2 × (l + b)" -- and then read along with
     the voice: "Perimeter:" lights up on "perimeter", "2" on "two", "×" on
     "times", "(" on "open bracket", and so on. Then the bird's own lines:
     as "...made of straight sides." is said, every side of the three shapes
     breathes; then the sum of the sides, for any polygon. */
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
      var lbl = h('span', 'card__sub fx-ch', row); lbl.textContent = T('lblPerimeterIs');
      var eq = h('span', 'card__eq', row);
      var marks = writeMarks(eq, T(c.eq));
      M.set([t, lbl, eq], { opacity: 0 });
      return { el: card, shape: mini.shape, title: t, sub: lbl, row: eq, marks: marks, say: c.say };
    });
    function build(c) {
      return Flow.anim(Beats.cardIn(c.el))
        .then(function () { return Flow.anim(Beats.ruleIn(c.title)); })
        .then(function () { return Flow.anim(Beats.drawShape(c.shape, { time: 1.0 })); })
        .then(function () { return Flow.anim(Beats.labelsIn(c.shape.labels, 0.12)); })
        .then(function () {
          var t0 = performance.now();
          return Promise.all([
            K.voiceOver(c.say),
            Flow.anim(Beats.walk(c.shape, 2.0)),
            Flow.wait(K.voiceAt(c.say, RULE_AT)).then(function () {
              return Flow.anim(Beats.rowIn(c.sub)).then(function () { return Flow.anim(Beats.ruleIn(c.row)); });
            }),
            readAlong(c, t0)
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
      .then(function () {
        var sides = cards.reduce(function (a, c) { return a.concat(c.shape.sides); }, []);
        K.onPhrase('b4Polygon', 'straight sides', function () { return Flow.anim(Beats.partPulse(sides, 1)); });
        return K.say('b4Polygon');
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
