/* ==========================================================================
 * widgets.js -- the controls a page puts in front of the learner
 * --------------------------------------------------------------------------
 *   W.slider(host, o)         a track with a thumb; locks at o.target
 *   W.handNudge(el)           a faint hand tapping el, until stopped
 *   W.handDrag(from, to, px)  a faint hand carrying something from a to b
 *   W.handSway(from, l, r, px) a faint hand swaying a card left, then right
 *   W.dragGuide(tray, to)     a blank card and a hand, tray -> box, twice
 * Every loop is endless and marked so Skip leaves it; the caller stops it
 * the moment the learner moves. Nothing under reduced motion.
 *
 * Load order: js/animations.js -> js/widgets.js -> js/pages.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;
  var NS = 'http://www.w3.org/2000/svg';

  function T(key, r) { return global.T ? global.T(key, r) : key; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function gate() { return document.getElementById('gate'); }
  function quiet(p) { if (p && p.catch) p.catch(function () {}); return p; }

  /* ---- the hand -----------------------------------------------------------
     A flat pointing hand, drawn once per use into a fixed layer over the
     page, placed in client pixels. */
  /* One closed outline (so the palm fills solid, with no gap between the
     knuckles), then the three finger lines as open strokes on top. */
  var HAND_D =
    'M-3.5 26 C-5 24 -7 23 -9.5 23.5 C-13 24.5 -14 28 -12 31 L-6 39 C-3 44 3 47 9 47 ' +
    'C18 47 24.5 41 24.5 31 L24.5 18.5 A3.5 3.5 0 0 0 17.5 18.5 ' +
    'L17.5 16 A3.5 3.5 0 0 0 10.5 16 ' +
    'L10.5 13.5 A3.5 3.5 0 0 0 3.5 13.5 ' +
    'L3.5 3.5 A3.5 3.5 0 0 0 -3.5 3.5 Z ' +
    'M17.5 18.5 L17.5 22 M10.5 16 L10.5 22 M3.5 13.5 L3.5 22';
  var HAND_H = 50;

  function handLayer() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'hand-layer');
    svg.setAttribute('aria-hidden', 'true');
    var ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('class', 'hand__ring');
    var hand = document.createElementNS(NS, 'path');
    hand.setAttribute('class', 'hand');
    hand.setAttribute('d', HAND_D);
    svg.appendChild(ring);
    svg.appendChild(hand);
    document.body.appendChild(svg);
    return { svg: svg, hand: hand, ring: ring };
  }
  function stopper(tl, L) {
    var stopped = false;
    return function stop() {
      if (stopped) return;
      stopped = true;
      if (tl) tl.kill();
      M.to(L.hand, { opacity: 0, duration: M.dur(0.2), ease: 'power2.in', overwrite: 'auto',
        onComplete: function () { if (L.svg.parentNode) L.svg.parentNode.removeChild(L.svg); } });
      L.ring.style.opacity = 0;
    };
  }
  function none() { return function () {}; }
  /* A hand's endless loop. Its layer is taken off the page if the scene is
     torn down under it (a Replay, a jump) before anyone stops it. */
  function handLoop(L) {
    return M.timeline({ revert: function () { if (L.svg.parentNode) L.svg.parentNode.removeChild(L.svg); } });
  }

  /* Tap here: the hand over `el`, pressing and lifting, twice, then again. */
  function handNudge(el, at) {
    if (Flow.isFast() || M.reducedMotion()) return none();
    var L = handLayer();
    function tip() {
      var r = el.getBoundingClientRect();
      var fx = at ? at.x : 0.62, fy = at ? at.y : 0.62;
      return { x: r.left + r.width * fx, y: r.top + r.height * fy, h: Math.max(28, Math.min(r.height, r.width, 90)) };
    }
    var p = { s: 1 }, q = { k: 0.7, a: 0 };
    function move() {
      var t = tip();
      L.hand.setAttribute('transform', 'translate(' + round2(t.x) + ' ' + round2(t.y) + ') scale(' + round2(t.h / HAND_H * p.s) + ')');
    }
    function wave() {
      var t = tip();
      L.ring.setAttribute('cx', round2(t.x)); L.ring.setAttribute('cy', round2(t.y));
      L.ring.setAttribute('r', round2(t.h * 0.42 * q.k));
      L.ring.style.opacity = q.a;
    }
    move(); wave();
    var tl = handLoop(L);
    tl.__motionEndless = true;
    tl.call(function () { p.s = 1; q.k = 0.7; q.a = 0; move(); wave(); }, null, 0);
    tl.to(L.hand, { opacity: 0.92, duration: 0.3, ease: 'power2.out' }, 0);
    [0.35, 1.05].forEach(function (t0) {
      tl.to(p, { s: 1.22, duration: 0.22, ease: 'power2.out', onUpdate: move }, t0)
        .to(p, { s: 1, duration: 0.36, ease: 'power2.inOut', onUpdate: move }, t0 + 0.22);
      tl.fromTo(q, { k: 0.7, a: 0.9 }, { k: 1.15, a: 0, duration: 0.62, ease: 'power2.out', onUpdate: wave }, t0);
    });
    tl.to(L.hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.85);
    tl.to({}, { duration: 0.8 });
    tl.repeat(-1);
    return stopper(tl, L);
  }

  /* Carry it there: from point `from()` to point `to()` (client px, read
     every frame), the hand `size` px tall. */
  function handDrag(from, to, size) {
    if (Flow.isFast() || M.reducedMotion()) return none();
    var L = handLayer();
    var p = { t: 0, g: 14 };
    function move() {
      var a = from(), b = to();
      var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t + p.g * 0.6;
      L.hand.setAttribute('transform', 'translate(' + round2(x) + ' ' + round2(y) + ') scale(' + round2((size || 56) / HAND_H) + ')');
    }
    move();
    var tl = handLoop(L);
    tl.__motionEndless = true;
    tl.call(function () { p.t = 0; p.g = 14; move(); }, null, 0);
    tl.to(L.hand, { opacity: 0.92, duration: 0.3, ease: 'power2.out' }, 0);
    tl.to(p, { g: 1.5, duration: 0.24, ease: 'power2.in', onUpdate: move }, 0.2);
    tl.to(p, { t: 1, duration: 1.3, ease: 'power1.inOut', onUpdate: move }, 0.5);
    tl.to(p, { g: 14, duration: 0.24, ease: 'power2.out', onUpdate: move }, 1.85);
    tl.to(L.hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.9);
    tl.to({}, { duration: 0.7 });
    tl.repeat(-1);
    return stopper(tl, L);
  }

  /* Either way: the hand presses on the card at `from()` and sways it most of
     the way to the left target `left()`, back, then most of the way to the
     right target `right()` and back -- it can go to either side, and neither
     is pointed out as the answer -- then lifts, and again. Points in client
     px, read every frame; the hand `size` px tall. */
  var SWAY_REACH = 0.8;
  function handSway(from, left, right, size) {
    if (Flow.isFast() || M.reducedMotion()) return none();
    var L = handLayer();
    var p = { t: 0, g: 14 };            /* t: -1 left, 0 the card, 1 right */
    function move() {
      var a = from(), b = p.t < 0 ? left() : right(), k = Math.abs(p.t) * SWAY_REACH;
      var x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k + p.g * 0.6;
      L.hand.setAttribute('transform', 'translate(' + round2(x) + ' ' + round2(y) + ') scale(' + round2((size || 56) / HAND_H) + ')');
    }
    move();
    var tl = handLoop(L);
    tl.__motionEndless = true;
    tl.call(function () { p.t = 0; p.g = 14; move(); }, null, 0);
    tl.to(L.hand, { opacity: 0.92, duration: 0.3, ease: 'power2.out' }, 0);
    tl.to(p, { g: 1.5, duration: 0.24, ease: 'power2.in', onUpdate: move }, 0.2);
    tl.to(p, { t: -1, duration: 0.8, ease: 'power1.inOut', onUpdate: move }, 0.5);
    tl.to(p, { t: 0, duration: 0.6, ease: 'power1.inOut', onUpdate: move }, 1.4);
    tl.to(p, { t: 1, duration: 0.8, ease: 'power1.inOut', onUpdate: move }, 2.1);
    tl.to(p, { t: 0, duration: 0.6, ease: 'power1.inOut', onUpdate: move }, 3.0);
    tl.to(p, { g: 14, duration: 0.24, ease: 'power2.out', onUpdate: move }, 3.65);
    tl.to(L.hand, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3.7);
    tl.to({}, { duration: 0.7 });
    tl.repeat(-1);
    return stopper(tl, L);
  }

  /* Slide it: the hand along `track`, from fraction `from` to `to`. */
  function handSlide(track, from, to) {
    return handDrag(function () {
      var r = track.getBoundingClientRect();
      return { x: r.left + r.width * from, y: r.top + r.height / 2 };
    }, function () {
      var r = track.getBoundingClientRect();
      return { x: r.left + r.width * to, y: r.top + r.height / 2 };
    }, 52);
  }

  /* A blank card the size of a name, carried from the tray to the box
     `to` by the hand, twice. Stops the moment a name is pressed. */
  function dragGuide(tray, to) {
    var stop = none();
    if (!to || Flow.isFast() || M.reducedMotion() || tray.hasAttribute('hidden')) return stop;
    var sample = tray.querySelector('[data-name]');
    var tr = tray.getBoundingClientRect(), end = to.getBoundingClientRect();
    if (!sample || !tr.width || !end.width) return stop;
    var size = sample.getBoundingClientRect();
    var wrap = document.createElement('div');
    wrap.className = 'drag-guide';
    wrap.setAttribute('aria-hidden', 'true');
    var card = document.createElement('div');
    card.className = 'drag-guide__card';
    card.style.width = size.width + 'px'; card.style.height = size.height + 'px';
    card.style.left = -size.width / 2 + 'px'; card.style.top = -size.height / 2 + 'px';
    wrap.appendChild(card);
    var hand = document.createElementNS(NS, 'svg');
    hand.setAttribute('class', 'drag-guide__hand');
    hand.setAttribute('viewBox', '-16 -2 44 52');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', HAND_D);
    hand.appendChild(path);
    wrap.appendChild(hand);
    document.body.appendChild(wrap);

    var sx = tr.left + tr.width / 2, sy = tr.top;
    var ex = end.left + end.width / 2, ey = end.top + end.height / 2;
    var tl = M.timeline({
      willChange: [wrap, card], willChangeValue: 'transform, opacity',
      revert: function () {
        tray.removeEventListener('pointerdown', halt, true);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    });
    function halt() { if (tl.totalProgress() < 1) tl.totalProgress(1); }
    tl.set(wrap, { x: sx, y: sy, opacity: 0 })
      .to(wrap, { opacity: 0.5, duration: M.dur(0.3), ease: 'power2.out' })
      .to(card, { scale: 0.94, duration: M.dur(0.15), ease: 'power2.out' })
      .to(wrap, { x: ex, y: ey, duration: M.dur(1.0), ease: 'power2.inOut' })
      .to(card, { scale: 1, duration: M.dur(0.2), ease: 'back.out(2)' })
      .to(wrap, { opacity: 0, duration: M.dur(0.3), ease: 'power2.in' }, '+=' + M.dur(0.25));
    tl.repeat(1).repeatDelay(M.dur(0.4));
    tray.addEventListener('pointerdown', halt, true);
    return halt;
  }

  /* ---- the slider ---------------------------------------------------------
     o: { label, cls, min, max, value, target, snap, step, fmt, onChange }
     The thumb follows the finger 1:1; let go within `snap` of the target it
     is caught there and locked, and ask() resolves. */
  function h(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function slider(host, o) {
    var row = h('div', 'slider' + (o.cls ? ' ' + o.cls : ''), host);
    var head = h('div', 'slider__head', row);
    var lab = h('span', 'slider__label', head);
    lab.textContent = o.label || '';
    var out = h('span', 'slider__value', head);
    var track = h('div', 'slider__track', row);
    track.setAttribute('role', 'slider');
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', T('a11ySlider', { name: o.label || '' }));
    track.setAttribute('aria-valuemin', o.min);
    track.setAttribute('aria-valuemax', o.max);
    var fill = h('div', 'slider__fill', track);
    var thumb = h('div', 'slider__thumb', track);

    var min = o.min, max = o.max, v = o.value, target = o.target;
    var snap = o.snap == null ? (max - min) * 0.06 : o.snap;
    var fmt = o.fmt || function (n) { return String(Math.round(n)); };
    var locked = false, live = false, stopHand = null;

    function frac(n) { return (n - min) / (max - min); }
    function paint() {
      var w = track.clientWidth || 1, p = frac(v);
      thumb.style.transform = 'translate(' + round2(p * w) + 'px, -50%)';
      fill.style.transform = 'scaleX(' + round2(p) + ')';
      out.textContent = fmt(v);
      track.setAttribute('aria-valuenow', Math.round(v));
    }
    function setValue(n, silent) {
      v = Math.max(min, Math.min(max, n));
      paint();
      if (!silent && o.onChange) o.onChange(v);
    }
    setValue(v, true);
    requestAnimationFrame(paint);

    var grabbing = false, pid = null;
    function valueAt(ev) {
      var r = track.getBoundingClientRect();
      var p = (ev.clientX - r.left) / (r.width || 1);
      return min + Math.max(0, Math.min(1, p)) * (max - min);
    }
    function lock() {
      locked = true; live = false;
      row.classList.remove('is-asking');
      row.classList.add('is-done');
      thumb.classList.remove('is-held');
      setValue(target);
      Beats.pop();
      quiet(Flow.anim(M.correct(thumb)));
      gate().dispatchEvent(new MouseEvent('click'));
    }
    function tryLock() {
      if (locked || target == null) return false;
      if (Math.abs(v - target) <= snap) { lock(); return true; }
      return false;
    }
    function onDown(ev) {
      if (!live) return;
      grabbing = true; pid = ev.pointerId;
      if (stopHand) { stopHand(); stopHand = null; }
      thumb.classList.add('is-held');
      try { track.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
      setValue(valueAt(ev));
    }
    function onMove(ev) { if (grabbing && ev.pointerId === pid) setValue(valueAt(ev)); }
    function onUp(ev) {
      if (!grabbing || ev.pointerId !== pid) return;
      grabbing = false;
      thumb.classList.remove('is-held');
      if (!tryLock() && target != null && Math.abs(v - target) <= snap * 3) {
        var from = v, p = { t: 0 };
        quiet(Flow.anim(M.to(p, { t: 1, duration: M.dur(0.3), ease: M.SNAP,
          onUpdate: function () { setValue(from + (target - from) * p.t); } })).then(tryLock));
      }
    }
    function onKey(ev) {
      if (!live) return;
      var step = (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') ? 1 : (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      if (stopHand) { stopHand(); stopHand = null; }
      setValue(v + step * (o.step || (max - min) / 20));
      tryLock();
    }
    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
    track.addEventListener('pointercancel', onUp);
    track.addEventListener('keydown', onKey);

    var NUDGE_AFTER = 2200;
    var api = {
      row: row, track: track, thumb: thumb,
      value: function () { return v; },
      set: function (n) { setValue(n, true); },
      /* The learner's turn: the thumb calls, the hand shows the slide
         after a pause, and the promise resolves when the target is reached
         -- at once, with the value put in, under Skip. */
      ask: function () {
        live = true;
        row.classList.add('is-asking');
        quiet(Flow.wait(NUDGE_AFTER).then(function () {
          if (live && !locked) stopHand = handSlide(track, frac(v), frac(target));
        }));
        return Flow.once(gate(), { auto: true }).then(function () {
          if (stopHand) { stopHand(); stopHand = null; }
          if (!locked) { setValue(target); locked = true; live = false; row.classList.remove('is-asking'); row.classList.add('is-done'); if (o.onChange) o.onChange(target); }
          return v;
        }, function (err) { if (stopHand) stopHand(); live = false; throw err; });
      },
      /* Put straight at its target, with no asking. */
      fill: function () { setValue(target); locked = true; live = false; row.classList.add('is-done'); row.classList.remove('is-asking'); }
    };
    return api;
  }


  /* ---- the terms of a sum ---------------------------------------------------
     A row the terms land in one by one -- each in its side's ink, a "+"
     before every one after the first -- shared by the sum card and the
     steps card below.
       row.term(text, ink, from)  a term (and its "+") in --side-ink; with
                                  `from` (the side's label on the shape) the
                                  number is carried over from the label and
                                  dropped into place (Beats.termFly)
       row.landed()               resolves once every term carried over is in */
  function termRow(terms) {
    var count = 0, flying = [];
    var inks = (global.Shapes && global.Shapes.INKS) || 6;
    return {
      landed: function () { return Promise.all(flying); },
      term: function (text, ink, from) {
        var hint = terms.querySelector('.card__hint');
        if (hint) hint.parentNode.removeChild(hint);
        var made = [];
        if (count > 0) { var op = h('span', 'term is-op', terms); op.textContent = '+'; made.push(op); }
        var e = h('span', 'term', terms);
        if (ink != null) e.style.setProperty('--c', 'var(--side-' + (ink % inks) + ')');
        global.MathText.write(e, text);
        made.push(e);
        count++;
        M.set(made, { opacity: 0 });
        var p = Flow.anim(from && !Flow.isFast() ? Beats.termFly(made, e, from, String(text)) : Beats.termIn(made));
        flying.push(quiet(p));
        return p;
      }
    };
  }
  /* The finished terms laid out unseen under the live row, so the row is its
     final width from the start and the terms land left to right in it
     rather than pushing it wider. */
  function ghostRow(parent, terms, total) {
    var ghost = h('div', 'card__row card__row--terms card__ghost', parent);
    ghost.setAttribute('aria-hidden', 'true');
    terms.forEach(function (t, i) {
      if (i) h('span', 'term is-op', ghost).textContent = '+';
      global.MathText.write(h('span', 'term', ghost), String(t));
    });
    if (total) global.MathText.write(h('span', 'term is-total', ghost), total);
    return ghost;
  }

  /* ---- the sum card ---------------------------------------------------------
     The working beside a shape: a title, the terms of the sum landing one
     by one -- each in its side's ink -- and the result under them.
       card.term(text, ink, from)  as termRow's
       card.landed()          resolves once every term carried over is in
       card.total(text)       "= 26 cm", in green, on the terms' own line
       card.result(text)      "= 26 cm", in green, on a line of its own
       card.row(text, cls)    any other row
     The total and any row wait for the terms still in the air, so the
     answer is never written ahead of the sum it adds up. */
  function sumCard(host, o) {
    o = o || {};
    var card = h('div', 'card card--sum' + (o.cls ? ' ' + o.cls : ''), host);
    if (o.style) Object.keys(o.style).forEach(function (k) { card.style[k] = o.style[k]; });
    if (o.title) { var t = h('p', 'card__title', card); t.textContent = o.title; }
    if (o.sub) { var sb = h('p', 'card__sub', card); sb.textContent = o.sub; }
    var terms = h('div', 'card__row card__row--terms', card);
    /* o.reserve: { terms: [...], total }, the finished sum (ghostRow) */
    if (o.reserve) ghostRow(card, o.reserve.terms, o.reserve.total);
    var row = termRow(terms), landed = row.landed;
    var api = {
      el: card, terms: terms, landed: landed, term: row.term,
      /* the hint shown in the terms row until the first term lands */
      hint: function (text) {
        var e = h('span', 'term is-op card__hint', terms);
        e.textContent = text;
        return e;
      },
      total: function (text) {
        return landed().then(function () {
          var e = h('span', 'term is-total', terms);
          global.MathText.write(e, text);
          M.set(e, { opacity: 0 });
          return Flow.anim(Beats.termIn(e)).then(function () { return e; });
        });
      },
      row: function (text, cls) {
        var r = h('div', 'card__row' + (cls ? ' ' + cls : ''), card);
        global.MathText.write(r, text);
        M.set(r, { opacity: 0 });
        return { el: r, show: function () { return landed().then(function () { return Flow.anim(Beats.rowIn(r)); }); } };
      },
      result: function (text) { var r = api.row(text, 'is-result'); return r.show().then(function () { return r.el; }); },
      remove: function () { if (card.parentNode) card.parentNode.removeChild(card); }
    };
    return api;
  }

  /* ---- the steps card -------------------------------------------------------
     The working beside a regular polygon (s4-regular.js): the sum and what
     it comes to on ONE line -- "a + a + a = 3a" -- and under it the same
     result written again with the side named -- "= 3 × side" -- the two
     "=" signs one above the other. A grid of two columns: the terms on the
     left, everything from "=" on the right, so both lines' "=" stand at the
     right column's left edge.
       o: { terms: ['a', 'a', 'a'], eq: '= 3a', rule: '= 3 × side', cls }
       card.term(text, ink, from)  as termRow's
       card.equals()   "= 3a" set at the end of the sum, once every term is in
       card.rewrite()  a copy of "= 3a" carried down a line, and its "a"
                       turned into "× side" (Beats.rewriteDown)
     The two results are cut where they stop agreeing ("= 3" + "a", "= 3" +
     " × side"), so the part they share never moves and only the end of it
     changes; the second line holds both ends, stacked, so every cell is its
     final size from the start and nothing on the card shifts. */
  function shared(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a.charAt(n) === b.charAt(n)) n++;
    return { head: a.slice(0, n), a: a.slice(n), b: b.slice(n) };
  }
  function resultLine(parent, cls, head, tails) {
    var line = h('div', 'card__row steps__rhs ' + cls, parent);
    var hd = h('span', 'steps__head', line);
    hd.textContent = head;
    var tail = h('span', 'steps__tail', line);
    var ends = tails.map(function (t) { var e = h('span', 'steps__end', tail); e.textContent = t; return e; });
    M.set(line, { opacity: 0 });
    return { el: line, head: hd, ends: ends };
  }
  function stepsCard(host, o) {
    o = o || {};
    var card = h('div', 'card card--sum card--steps' + (o.cls ? ' ' + o.cls : ''), host);
    var grid = h('div', 'steps', card);
    var lhs = h('div', 'steps__lhs', grid);
    var terms = h('div', 'card__row card__row--terms', lhs);
    ghostRow(lhs, o.terms || []);
    var cut = shared(String(o.eq || ''), String(o.rule || ''));
    var eq = resultLine(grid, 'steps__eq', cut.head, [cut.a]);
    var rule = resultLine(grid, 'steps__rule', cut.head, [cut.a, cut.b]);
    var row = termRow(terms), landed = row.landed;
    return {
      el: card, terms: terms, landed: landed, term: row.term,
      equals: function () {
        return landed().then(function () { return Flow.anim(Beats.termIn(eq.el)); });
      },
      rewrite: function () {
        if (Flow.isFast() || M.reducedMotion()) {
          M.set(rule.el, { opacity: 1 });
          M.set(rule.ends[0], { opacity: 0 });
          M.set(rule.ends[1], { opacity: 1 });
          rule.ends[0].setAttribute('aria-hidden', 'true');
          return Promise.resolve();
        }
        return Flow.anim(Beats.rewriteDown(eq.el, rule.el, rule.ends[0], rule.ends[1]));
      },
      remove: function () { if (card.parentNode) card.parentNode.removeChild(card); }
    };
  }

  global.W = {
    HAND_D: HAND_D, HAND_H: HAND_H,
    sumCard: sumCard, stepsCard: stepsCard, slider: slider, handNudge: handNudge, handDrag: handDrag, handSway: handSway, handSlide: handSlide, dragGuide: dragGuide
  };
})(window);
