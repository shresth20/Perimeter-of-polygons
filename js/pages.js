/* ==========================================================================
 * pages.js -- the board's kit, the welcome, and the lesson's scene list
 * --------------------------------------------------------------------------
 * One scene is one `await` chain. Everything it waits on -- a stretch of
 * time, an animation, a tap -- is taken out through Flow, so the whole chain
 * unwinds in one go if the scene is replayed, and collapses to a few frames
 * if Skip is pressed. Nothing in here sets a timeout of its own.
 *
 * The sections (js/s1-*.js ...) register through Pages.addSection and speak
 * through the kit handed to them: the bird's moves, the header line, the
 * hand-over, the activities, the board's housekeeping.
 *
 * Load order: motion.js -> flow.js -> mathtext.js -> typer.js -> mascot.js
 *             -> shapes.js -> animations.js -> widgets.js -> pages.js
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = global.Motion;
  var Flow = global.Flow;
  var Beats = global.Beats;
  var S = global.Shapes;
  var W = global.W;

  function T(key, repl) { return global.T ? global.T(key, repl) : key; }

  /* ---- pacing ---------------------------------------------------------- */
  var BEAT  = 560;      /* between one line and the next                   */
  var SHORT = 280;      /* between two marks of one drawing                */
  var LOOK  = 1400;     /* a finished mark, left to be looked at           */
  var AUTO_TURN = 2500; /* a self-turning page, held to be read            */

  var VB_W = 1000, VB_H = 420;
  var BOX_W = 200, BOX_H = 44;

  var dom = null;
  var mascot = null;
  var chips = [];
  var choiceBtns = [];
  var sayBubble, sayPrompt;

  function $(id) { return document.getElementById(id); }
  function collect() {
    return {
      welcome: $('welcome'), title: $('welcomeTitle'), flakes: $('welcomeFlakes'), startBtn: $('startBtn'),
      frame: $('frame'), slotHero: $('slotHero'), bubble: $('bubble'), hopper: $('hopper'),
      board: $('board'), slotHeader: $('slotHeader'), promptLine: document.querySelector('.prompt__line'),
      figure: $('figure'), layer: $('layer'), burst: $('figBurst'),
      tray: $('tray'), choices: $('choices'), gate: $('gate'),
      nextBtn: $('nextBtn'), restartBtn: $('restartBtn')
    };
  }

  var el = S.el, round2 = S.round2;

  /* ---- a name box, hung under a figure ------------------------------------
     b: { name, x, y, w, h }; the pill, the tick and the word inside. */
  function buildBox(group, b) {
    var w = b.w || BOX_W, hh = b.h || BOX_H;
    var cy = b.y + hh / 2;
    var g = el('g', { 'class': 'q-box', 'data-name': b.name, tabindex: 0, role: 'button' });
    var rect = el('rect', { 'class': 'q-box__rect', x: b.x, y: b.y, width: w, height: hh, rx: hh / 2 });
    var badge = el('g', { 'class': 'q-badge' });
    badge.appendChild(el('circle', { 'class': 'q-badge__ring', cx: b.x + 24, cy: cy, r: 10 }));
    badge.appendChild(el('path', { 'class': 'q-badge__tick',
      d: 'M' + (b.x + 18.5) + ' ' + cy + ' L' + (b.x + 22.5) + ' ' + (cy + 4) + ' L' + (b.x + 29.5) + ' ' + (cy - 4) }));
    var text = el('text', { 'class': 'figure-label q-box__text', x: b.x + w / 2 + 9, y: cy + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    g.appendChild(rect); g.appendChild(badge); g.appendChild(text);
    group.appendChild(g);
    var box = { name: b.name, g: g, rect: rect, badge: badge, text: text, filled: false,
                centre: { x: b.x + w / 2, y: cy } };
    emptyBox(box);
    return box;
  }
  function emptyBox(box) {
    box.filled = false;
    box.text.textContent = '';
    box.g.classList.remove('is-right', 'is-wrong', 'is-over', 'is-shown', 'is-quiet', 'is-target');
    box.g.setAttribute('aria-label', T('a11yBox'));
  }

  /* ---- a side panel, for the swipe sort -----------------------------------
     z: { name, side: 'left'|'right', x, y, w, h, m, cap, depth }. A tall
     frosted panel with its name on a band at the top and a shelf below,
     where the cards swiped into it are kept, small, in a row. `cap` is how
     many it will hold (the seats are laid out for that many); `m` is its
     gap from the figure's edge; `depth: false` leaves off the slab under it. */
  var ZONE_W = 240, ZONE_H = 300, ZONE_Y = 58, ZONE_M = 26;
  function buildZone(group, z) {
    var w = z.w || ZONE_W, hh = z.h || ZONE_H, y = z.y == null ? ZONE_Y : z.y;
    var m = z.m == null ? ZONE_M : z.m;
    var x = z.x != null ? z.x : (z.side === 'right' ? VB_W - m - w : m);
    var g = el('g', { 'class': 'zone zone--' + (z.side || 'left'), 'data-name': z.name, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', T('a11yZone', { name: T(z.name) }));
    var shadow = z.depth === false ? null
      : el('rect', { 'class': 'zone__shadow', x: x, y: y + 8, width: w, height: hh, rx: 28 });
    var body = el('rect', { 'class': 'zone__body', x: x, y: y, width: w, height: hh, rx: 28 });
    var band = el('rect', { 'class': 'zone__band', x: x + 16, y: y + 16, width: w - 32, height: 58, rx: 18 });
    var label = el('text', { 'class': 'figure-label zone__label', x: x + w / 2, y: y + 46, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    label.textContent = T(z.name);
    var shelf = { x: x + 14, y: y + 88, w: w - 28, h: hh - 102 };
    var tray = el('rect', { 'class': 'zone__shelf', x: shelf.x, y: shelf.y, width: shelf.w, height: shelf.h, rx: 18 });
    [shadow, body, band, label, tray].forEach(function (n) { if (n) g.appendChild(n); });
    group.appendChild(g);
    var cap = Math.max(1, z.cap || 3), cols = Math.min(2, cap), rows = Math.ceil(cap / cols);
    var zone = {
      name: z.name, side: z.side || 'left', g: g, body: body, label: label, shelf: shelf, kept: [],
      centre: { x: x + w / 2, y: y + hh / 2 }, x: x, y: y, w: w, h: hh,
      /* where the i-th card kept here sits, and how small it is: a grid of
         two columns, a short last row centred */
      seat: function (i) {
        var cw = shelf.w / cols, rh = shelf.h / rows;
        var row = Math.floor(i / cols), col = i % cols;
        var inRow = row === rows - 1 ? cap - row * cols : cols;
        return { x: shelf.x + shelf.w / 2 + (col - (inRow - 1) / 2) * cw,
                 y: shelf.y + rh * (row + 0.5),
                 k: Math.min(Math.min(cw, rh) * 0.8 / 180, 0.5) };
      }
    };
    return zone;
  }

  /* ---- the holder a shape is sorted on --------------------------------------
     An invisible grab area centred on (cx, cy); the shape is built into
     card.g after it, so the whole shape moves as one when swiped. */
  var CARD_W = 270, CARD_H = 250;
  function buildCard(group, cx, cy) {
    var w = CARD_W, hh = CARD_H, x = cx - w / 2, y = cy - hh / 2;
    var g = el('g', { 'class': 'swipe-card', tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', T('a11yCard'));
    /* no visible card: only an invisible grab area round the shape (it
       shows a soft outline only under keyboard focus) */
    var face = el('g', { 'class': 'swipe-card__face' });
    face.appendChild(el('rect', { 'class': 'swipe-card__hit', x: x, y: y, width: w, height: hh, rx: 30 }));
    g.appendChild(face);
    group.appendChild(g);
    M.set(g, { svgOrigin: cx + ' ' + cy });
    return { g: g, face: face, centre: { x: cx, y: cy }, w: w, h: hh };
  }

  /* ---- the names in the tray, the answers ------------------------------- */
  function buildChips(tray, names) {
    tray.textContent = '';
    return names.map(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = T(name);
      b.dataset.name = name;
      b.setAttribute('aria-label', T('a11yChip', { name: T(name) }));
      tray.appendChild(b);
      return b;
    });
  }
  /* Each answer's words in a span of their own, so they can be hidden and
     rewritten while the pill itself stays put (perchAsk's shuffle). */
  function buildChoices(host, labels) {
    host.textContent = '';
    return labels.map(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      var t = document.createElement('span');
      t.className = 'choice__txt';
      b.appendChild(t);
      global.MathText.write(t, text);
      b.dataset.name = text;
      host.appendChild(b);
      return b;
    });
  }
  function choiceText(btn) { return btn.querySelector('.choice__txt') || btn; }
  function shuffle(list) {
    var a = list.slice();
    for (var tries = 0; tries < 8; tries++) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      if (a.join() !== list.join()) break;
    }
    return a;
  }

  /* ---- the figure as a whole ---------------------------------------------- */
  function figureParts() {
    return sections.reduce(function (all, s) { return s.parts ? all.concat(s.parts()) : all; }, []);
  }
  function clearInline(els) {
    M.set(els, { clearProps: 'opacity,transform,strokeWidth' });
    els.forEach(function (p) {
      if (!p.style) return;
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });
  }
  function resetFigure() {
    sections.forEach(function (s) { if (s.reset) s.reset(); });
    dom.burst.textContent = '';
    Array.prototype.forEach.call(dom.figure.querySelectorAll('.is-lit, .is-pulsing, .is-dim'), function (e) {
      e.classList.remove('is-lit', 'is-pulsing', 'is-dim');
      e.style.removeProperty('--pulse-times');
    });
    clearInline([dom.figure].concat(Array.prototype.slice.call(dom.figure.querySelectorAll('*'))));
  }
  function resetFooter() {
    dom.tray.setAttribute('hidden', ''); dom.tray.textContent = ''; chips = [];
    dom.choices.setAttribute('hidden', ''); dom.choices.textContent = ''; choiceBtns = [];
  }
  function ripple(ev, target) {
    var r = target.getBoundingClientRect();
    M.tapRipple((ev && ev.clientX) || (r.left + r.width / 2), (ev && ev.clientY) || (r.top + r.height / 2));
  }
  function quiet(p) { if (p && p.catch) p.catch(function () {}); return p; }


  /* ---- Next --------------------------------------------------------------- */
  function handOver(btn) {
    btn = btn || dom.nextBtn;
    note(at, page);
    announce();
    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();
    M.button3d(btn, { edge: 5 });
    Beats.controlIn(btn);
    return Flow.once(btn).then(function () {
      Beats.sfx('click');
      turned();
      return Flow.anim(Beats.controlOut(btn));
    });
  }
  function autoTurn(ms) {
    note(at, page);
    announce();
    if (seek > 0) {
      seek--;
      turned();
      if (!seek) Flow.resume();
      return Promise.resolve();
    }
    Flow.resume();
    return Flow.wait(ms == null ? AUTO_TURN : ms).then(turned);
  }

  /* ---- the header line ----------------------------------------------------- */
  function clearPrompt() {
    sayPrompt.clear();
    M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
  }
  function sayInHeader(text, over) {
    var slot = dom.slotHeader;
    var before = slot.getBoundingClientRect().left;
    var reveal = sayPrompt.reserve(text, over);
    var shift = before - slot.getBoundingClientRect().left;
    if (Math.abs(shift) > 0.5) {
      M.set(slot, { x: shift });
      M.to(slot, { x: 0, duration: M.dur(0.42), ease: 'power2.inOut' });
    }
    return reveal();
  }

  var speaking = 0;
  function lineOf(text) {
    if (text && typeof text === 'object') return text;
    return { text: String(text), vo: null };
  }
  function hear(key) {
    if (!key || !global.I18n || Flow.isFast()) return Promise.resolve(false);
    var done = false, ok = false;
    quiet(global.I18n.say(key)).then(function (r) { done = true; ok = r; }, function () { done = true; });
    function heard() {
      if (Flow.isFast()) { global.I18n.stop(); return false; }
      if (done) return ok;
      return Flow.wait(80).then(heard, function (err) { global.I18n.stop(); throw err; });
    }
    return heard();
  }
  function voiceOf(line) { return line.vo ? hear(line.vo) : Promise.resolve(false); }

  /* A line on its recording's clock (see the circle game's pages.js). */
  var keyOfText = null, patterns = null;
  function plain(text) { return String(text).replace(/ /g, ' '); }
  function cuesFor(text, key) {
    var I = global.I18n;
    if (!I || !I.cues) return null;
    if (key && I.voiced().indexOf(key) >= 0) return I.cues(key, plain(text));
    if (!keyOfText) {
      keyOfText = {}; patterns = [];
      I.voiced().forEach(function (k) {
        var s = I.t(k);
        keyOfText[s] = k;
        if (/\{\w+\}/.test(s)) {
          patterns.push({ key: k, re: new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+?') + '$') });
        }
      });
    }
    var line = plain(text);
    var k2 = keyOfText[line];
    if (!k2) patterns.some(function (p) { if (p.re.test(line)) { k2 = p.key; return true; } });
    return k2 ? I.cues(k2, line) : null;
  }
  function wordAt(text, phrase) {
    var i = plain(text).indexOf(plain(phrase));
    if (i < 0) return 0;
    var cues = cuesFor(text);
    if (!cues) return i * global.Typer.TYPE_MS;
    var cuts = global.Typer.wordCuts(plain(text));
    for (var w = 0; w < cuts.length && w < cues.length; w++) if (i < cuts[w]) return cues[w];
    return cues[cues.length - 1];
  }
  var begun = { text: null, at: 0 };
  var awaiting = [];
  function began(text) {
    begun = { text: text, at: performance.now() };
    awaiting = awaiting.filter(function (w) {
      if (w.text !== text) return true;
      w.resolve(begun.at);
      return false;
    });
  }
  function lineBegins(text) {
    if (begun.text === text && performance.now() - begun.at < 100) return Promise.resolve(begun.at);
    return new Promise(function (resolve) { awaiting.push({ text: text, resolve: resolve }); });
  }
  /* fn, run as `phrase` is heard (or typed) in the line `text`. A line of
     several sentences is shown a sentence at a time, so the phrase is
     timed from the start of ITS sentence. */
  function onWord(text, phrase, fn) {
    var parts = sentencesOf(text), from = text;
    if (parts) {
      parts.some(function (s) {
        if (plain(s).indexOf(plain(phrase)) < 0) return false;
        from = s.trim();
        return true;
      });
    }
    return lineBegins(from)
      .then(function (t0) {
        var into = from === text ? wordAt(text, phrase) : Math.max(0, wordAt(text, phrase) - wordAt(text, from));
        return Flow.wait(t0 + into - performance.now());
      })
      .then(fn);
  }
  /* The same by key: armed BEFORE the line is said. */
  function onPhrase(key, phrase, fn) {
    return quiet(onWord(T(key), phrase, fn));
  }
  function onVoice(say) {
    function reserve(text, over) {
      var key = text && typeof text === 'object' ? text.vo : null;
      text = text && typeof text === 'object' ? text.text : text;
      var cues = over ? null : cuesFor(text, key);
      var reveal = say.reserve(text, over || (cues ? { at: cues } : undefined));
      return function () { began(text); return reveal(); };
    }
    function said(text, over) { return reserve(text, over)(); }
    said.reserve = reserve;
    said.clear = say.clear;
    return said;
  }

  /* The bird on the header saying its next line. `along(line)` is acted out
     on the figure while it is said. */
  function speak(text, mood, along) {
    var line = lineOf(text);
    var mine = ++speaking;
    var has = dom.promptLine.textContent.trim().length > 0;
    var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
    return gone.then(function () {
      if (mine !== speaking) return;
      M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
      mascot.state(mood || 'talking');
      var heard = quiet(voiceOf(line));
      var said = sayInHeader(line);
      return Promise.all([said, heard, along ? along(line) : null]);
    }).then(function () {
      if (mine === speaking) mascot.settle();
    });
  }

  /* ---- the mascot's jump on and off the board ---------------------------- */
  var FOOT = 0.90, CLEAR = 8, PARK = 14;
  function flightPlan(cell) {
    var b = dom.board.getBoundingClientRect();
    return { centre: b.top - CLEAR - (FOOT - 0.5) * cell.height, park: b.top + PARK };
  }
  function hopperOff() {
    dom.hopper.classList.remove('on');
    mascot.unmirror(dom.hopper);
  }
  function jumpDone() {
    hopperOff();
    M.set([mascot.el, dom.hopper], { clearProps: 'transform' });
  }
  function mascotJumpIn(slot) {
    var e = mascot.el;
    slot = slot || dom.slotHeader;
    if (slot === dom.slotHeader) quiet(Flow.anim(openHeader()));
    e.classList.add('is-away');
    e.hidden = false;
    mascot.placeIn(slot);
    var cell = e.getBoundingClientRect();
    if (!cell.width || M.reducedMotion()) { e.classList.remove('is-away'); return Promise.resolve(); }
    var plan = flightPlan(cell);
    M.set(dom.hopper, { left: cell.left, top: plan.park, width: cell.width, height: cell.height, y: 0 });
    mascot.mirror(dom.hopper);
    dom.hopper.classList.add('on');
    return Flow.anim(Beats.hopUp(dom.hopper, plan.centre - (plan.park + cell.height / 2)))
      .then(function () {
        var at2 = e.getBoundingClientRect();
        var from = plan.centre - (at2.top + at2.height / 2);
        M.set(e, { y: from });
        e.classList.remove('is-away');
        hopperOff();
        return Flow.anim(Beats.landOn(e, from));
      })
      .then(jumpDone, function (err) { jumpDone(); throw err; });
  }
  function mascotJumpOut(keep) {
    var e = mascot.el;
    if (e.hidden || e.classList.contains('is-away')) return Promise.resolve();
    if (e.parentNode === dom.slotHero && !dom.board.classList.contains('show')) return Promise.resolve();
    var closes = e.parentNode === dom.slotHeader && !keep;
    var shut = function () { if (closes) quiet(Flow.anim(collapseHeader(true))); };
    var cell = e.getBoundingClientRect();
    if (!cell.width || M.reducedMotion()) { e.classList.add('is-away'); shut(); return Promise.resolve(); }
    var plan = flightPlan(cell);
    return Flow.anim(Beats.springOff(e, plan.centre - (cell.top + cell.height / 2)))
      .then(function () {
        var at2 = e.getBoundingClientRect();
        M.set(dom.hopper, { left: cell.left, top: cell.top, width: cell.width, height: cell.height,
                            y: (at2.top + at2.height / 2) - (cell.top + cell.height / 2) });
        mascot.mirror(dom.hopper);
        dom.hopper.classList.add('on');
        e.classList.add('is-away');
        return Flow.anim(Beats.hopDown(dom.hopper, plan.park - cell.top));
      })
      .then(function () { jumpDone(); shut(); }, function (err) { jumpDone(); throw err; });
  }
  function arriveSaying(text, mood, along) {
    var line = lineOf(text);
    speaking++;
    var reveal = sayPrompt.reserve(line);
    return mascotJumpIn().then(function () {
      mascot.state(mood || 'talking');
      var heard = quiet(voiceOf(line));
      return Promise.all([reveal(), heard, along ? along(line) : null]);
    });
  }
  /* ONE sentence on screen at a time, everywhere: every line the bird says
     comes through say(), and a line of several sentences is shown a
     sentence at a time -- each one replacing the one before. */

  /* One sentence (or a line of one), from wherever the bird is: on the
     header already, or up to it. */
  function sayOne(line, mood, along) {
    return birdOnHeader() ? speak(line, mood, along) : arriveSaying(line, mood, along);
  }
  /* Say a line: a key, or a { text, vo } line. */
  function say(key, mood, along) {
    var line = typeof key === 'string' ? keyed(key) : lineOf(key);
    /* the bird on its perch says everything in the perch's bubble */
    if (perch && perch.open) return perchLine(line, mood);
    var parts = sentencesOf(line.text);
    if (!parts) return sayOne(line, mood, along);
    parts = parts.map(function (s) { return s.trim(); });
    /* Skipped over: only where the line ENDS is left on the board, its last
       sentence. The beats armed on its words (onPhrase) are let go all the
       same, so nothing they bring in is lost to the skip. */
    if (Flow.isFast()) {
      began(line.text);
      parts.forEach(function (s) { began(s); });
      return sayOne({ text: parts[parts.length - 1], vo: null }, mood, along);
    }
    return bySentence(line, parts, mood, along);
  }
  /* The same by key, with its {placeholders} filled. */
  function speakBySentence(key, mood, repl) {
    return say(keyed(key, repl), mood);
  }
  /* A line given as text or { text, vo }, never as a key. */
  function speakLine(text, mood, along) {
    return say(lineOf(text), mood, along);
  }
  function keyed(key, repl) {
    return { text: global.I18n ? global.I18n.t(key, repl) : key, vo: key };
  }

  /* A sentence ends at . ! or ? followed by a space or the end of the line
     (so a "4.5" is never cut in two). */
  var OUT_LEAD = 280;
  function sentencesOf(text) {
    var parts = String(text).match(/[\s\S]*?[.!?]+(?=\s|$)\s*/g);
    return parts && parts.length > 1 && parts.join('') === String(text) ? parts : null;
  }
  function bySentence(line, parts, mood, along) {
    var acting = along ? quiet(along(line)) : null;
    var cues = cuesFor(line.text, line.vo);

    /* No word timings: each sentence typed in turn, replacing the last. A
       recording (if there is one) plays the whole line underneath. */
    if (!cues) {
      var heard = null;
      var chain = parts.reduce(function (c, s, i) {
        return c.then(function (n) {
          if (i > 0 && n !== speaking) return n;        /* talked over: stop */
          /* the whole line begins with its first sentence */
          if (i === 0) began(line.text);
          var said = sayOne({ text: s, vo: null }, mood);
          if (i === 0) heard = quiet(voiceOf(line));
          var mine = speaking;
          return said.then(function () { return mine; });
        });
      }, Promise.resolve(speaking));
      return Promise.all([chain.then(function () { return heard; }), acting]);
    }

    /* On the recording's clock: each sentence comes in as its first word is
       heard, the one before going out just ahead of it. */
    var w = 0;
    var split = parts.map(function (s) {
      var n = (s.match(/\S+\s*/g) || []).length;
      var at2 = cues.slice(w, w + n);
      w += n;
      return { text: s, at: at2 };
    });
    var up = birdOnHeader() ? Promise.resolve() : mascotJumpIn();
    return up.then(function () {
      var mine = ++speaking;
      var has = dom.promptLine.textContent.trim().length > 0;
      var gone = has ? Flow.anim(Beats.lineOut(dom.promptLine)) : Promise.resolve();
      return gone.then(function () {
        if (mine !== speaking) return;
        M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
        mascot.state(mood || 'talking');
        var t0 = performance.now();
        began(line.text);
        var heard2 = quiet(voiceOf(line));
        var typed = split.reduce(function (chain, s, i) {
          return chain.then(function () {
            if (mine !== speaking) return;
            var out = i === 0 ? Promise.resolve() :
              Flow.wait(t0 + s.at[0] - OUT_LEAD - performance.now()).then(function () {
                if (mine !== speaking) return;
                return Flow.anim(Beats.lineOut(dom.promptLine));
              });
            return out.then(function () {
              if (mine !== speaking) return;
              M.set(dom.promptLine, { clearProps: 'opacity,transform,filter' });
              var late = performance.now() - t0;
              return sayInHeader(s.text, { at: s.at.map(function (c) { return Math.max(0, c - late); }) });
            });
          });
        }, Promise.resolve());
        return Promise.all([typed, heard2, acting]);
      }).then(function () { if (mine === speaking) mascot.settle(); });
    });
  }
  function typedFor(text) {
    var cues = cuesFor(text);
    if (cues) return (cues[cues.length - 1] + global.Typer.WORD_IN * 2) / 1000;
    return text.length * global.Typer.TYPE_MS / 1000;
  }
  /* A line said by the voice alone; a line not yet recorded is given the
     time it would take, so the beats round it keep their pace. */
  var VO_MIN = 1600, VO_PACE = 65;
  function voiceOver(key) {
    if (Flow.isFast() || !global.I18n) return Flow.wait(0);
    var from = Date.now();
    var floor = Math.max(VO_MIN, global.I18n.t(key).length * VO_PACE);
    return hear(key).then(function (played) {
      if (!played) return Flow.wait(floor - (Date.now() - from));
    });
  }
  /* When `phrase` is heard into a line said by the voice alone, in ms from
     the line's start: by its recording's word cues, else at the pace
     voiceOver() gives the line -- so a beat set on such a line (there is no
     typing to time it by) comes in with its words. 0 when the phrase is
     not in the line. */
  function voiceAt(key, phrase) {
    var I = global.I18n;
    if (!I || Flow.isFast()) return 0;
    var text = plain(I.t(key));
    var i = text.indexOf(plain(phrase));
    if (i <= 0) return 0;
    var cues = I.cues ? I.cues(key, text) : null;
    if (!cues) return i * VO_PACE;
    var cuts = global.Typer.wordCuts(text);
    for (var w = 0; w < cuts.length && w < cues.length; w++) if (i < cuts[w]) return cues[w];
    return cues[cues.length - 1];
  }
  function birdVoice(key) {
    mascot.state('talking');
    return voiceOver(key).then(function () { mascot.settle(); });
  }
  function birdAway() {
    return Promise.all([mascotJumpOut(true), Flow.anim(Beats.lineOut(dom.promptLine))]).then(clearPrompt);
  }
  function lineAway() {
    return Flow.anim(Beats.lineOut(dom.promptLine)).then(function () {
      var slot = dom.slotHeader;
      var before = slot.getBoundingClientRect().left;
      clearPrompt();
      var shift = before - slot.getBoundingClientRect().left;
      if (Math.abs(shift) <= 0.5) return;
      M.set(slot, { x: shift });
      return Flow.anim(M.to(slot, { x: 0, duration: M.dur(0.42), ease: 'power2.inOut' }));
    });
  }
  function birdOnHeader() {
    var e = mascot.el;
    return e.parentNode === dom.slotHeader && !e.hidden && !e.classList.contains('is-away');
  }

  /* ======================================================================
   * The bird beside the shape -- the perch
   * ----------------------------------------------------------------------
   * A question asked beside the figure rather than from the header: the
   * shape stands on the left of the board, and on the right the bird has a
   * spot of its own, with a bubble over its head and a row under its feet
   * for the answers (and, once answered, for the working). While the perch
   * is up, the question and every verdict on it are said in that bubble and
   * the header stays shut. The bird jumps onto it the way it jumps onto the
   * header: up from behind the board and down onto its spot.
   *   Laid out and behaving as the circle game's formula pane (circle-skill-2,
   * #cfPane: circum.js / circum.css): the board split 50 / 50, the bird at
   * the one size it is beside a figure, the bubble growing out of its head
   * across the half, the answers arriving one by one under its feet, a wrong
   * one spent and answered before any is live again, the answer lit for the
   * learner once it is the only one left, and the rest stepping back from
   * the right one. Only the mechanics are the circle's; the colours are the
   * ice theme's (style.css).
   * ====================================================================== */
  var perch = null;
  var SENTENCE_HOLD = 560;   /* ms a sentence is held before the next replaces it */

  function div(cls, parent) {
    var e = document.createElement('div');
    e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function perchBuild() {
    var root = div('perch', dom.layer);
    var stand = div('perch__stand', root);
    /* the centre-stage bubble (index.html) stamped again, so the bird's box
       is the same object wherever it speaks */
    var bubble = dom.bubble.cloneNode(true);
    bubble.removeAttribute('id');
    bubble.removeAttribute('style');
    Array.prototype.forEach.call(bubble.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    bubble.querySelector('.type-wrap').removeAttribute('style');
    bubble.querySelector('.type-ghost').textContent = '';
    bubble.querySelector('.type .txt').textContent = '';
    bubble.classList.add('bubble--perch');
    bubble.setAttribute('hidden', '');
    stand.appendChild(bubble);
    var answers = div('perch__answers', root);
    answers.setAttribute('role', 'group');
    answers.setAttribute('aria-label', T('a11yAnswers'));
    var typer = global.Typer.create(bubble.querySelector('.type-wrap'), { box: bubble, fit: true });
    return { root: root, stand: stand, bubble: bubble, answers: answers, say: onVoice(typer), open: false, shown: false };
  }
  /* The header emptied and shut, then the bird up onto its spot. */
  function perchOpen(P) {
    var away = birdOnHeader() || dom.promptLine.textContent.trim() ? birdAway() : Promise.resolve();
    return away
      .then(function () { return Flow.anim(collapseHeader(true)); })
      .then(function () { return mascotJumpIn(P.stand); })
      .then(function () { Beats.bubbleArm(P.bubble); P.open = true; });
  }
  function tint(P, verdict) {
    P.bubble.classList.toggle('is-yes', verdict === 'yes');
    P.bubble.classList.toggle('is-no', verdict === 'no');
  }
  /* A line in the perch's bubble (the perch made, and the bird brought up,
     if they are not yet): a key or a { text, vo } line, shown a sentence at
     a time -- each replacing the one before, as on the header -- with its
     recording under it. `verdict` ('yes' | 'no') tints the bubble green or
     red for an answer's feedback; none puts it back to white. A newer line
     cuts an older one off. */
  function perchLine(text, mood, verdict) {
    var P = perch || (perch = perchBuild());
    var line = typeof text === 'string' ? keyed(text) : lineOf(text);
    var mine = ++speaking;
    var parts = sentencesOf(line.text);
    parts = parts ? parts.map(function (s) { return s.trim(); }) : [line.text];
    var fast = Flow.isFast();
    /* Skipped over: only its last sentence is shown, but every beat armed on
       its words (onPhrase) is let go all the same, as say() does. */
    if (fast) { began(line.text); parts.forEach(function (s) { began(s); }); parts = parts.slice(-1); }
    var cues = fast ? null : cuesFor(line.text, line.vo);
    var up = P.open ? Promise.resolve() : perchOpen(P);
    return up.then(function () {
      if (mine !== speaking || perch !== P) return;
      tint(P, verdict);
      mascot.state(mood || 'talking');
      var t0 = performance.now();
      began(line.text);
      var heard = fast ? null : quiet(voiceOf(line));
      var w = 0;
      var typed = parts.reduce(function (chain, s, i) {
        var n = (s.match(/\S+\s*/g) || []).length;
        var at = cues ? cues.slice(w, w + n) : null;
        w += n;
        return chain.then(function () {
          if (mine !== speaking || perch !== P) return;
          var hold = !i ? null : Flow.wait(at ? t0 + at[0] - performance.now() : SENTENCE_HOLD);
          return Promise.resolve(hold).then(function () {
            if (mine !== speaking || perch !== P) return;
            var late = performance.now() - t0;
            var said = P.say(s, at ? { at: at.map(function (c) { return Math.max(0, c - late); }) } : undefined);
            if (!P.shown) { P.shown = true; quiet(Flow.anim(Beats.bubbleIn(P.bubble))); }
            return said;
          });
        });
      }, Promise.resolve());
      return Promise.all([typed, heard]);
    }).then(function () { if (mine === speaking) mascot.settle(); });
  }
  /* A line heard and not written ("Tap the correct answer."), in the
     background: nothing waits on it, the bubble keeps the question, and the
     bird talks for as long as it lasts -- unless a newer line has the bird
     by then. */
  function perchVoice(key) {
    if (Flow.isFast() || !global.I18n) return Promise.resolve();
    var mine = speaking;
    mascot.state('talking');
    return quiet(voiceOver(key).then(function () { if (mine === speaking) mascot.settle(); }));
  }
  /* The bird brought up onto its spot with nothing said yet -- for a page
     that puts its working under the bird before the bird has a line. */
  function perchUp() {
    var P = perch || (perch = perchBuild());
    return P.open ? Promise.resolve() : perchOpen(P);
  }
  /* The answers, in a row under the bird, one by one. One size for the row,
     as the circle's formulas are: every pill as tall as the tallest and --
     while three that wide still stand in one row -- as wide as the widest,
     so no answer is the odd one out. */
  function perchChoices(labels) {
    var P = perch || (perch = perchBuild());
    P.answers.classList.remove('is-working', 'is-hearing');
    var btns = buildChoices(P.answers, labels);
    var w = 0, hh = 0;
    btns.forEach(function (b) {
      var r = b.getBoundingClientRect();
      w = Math.max(w, r.width); hh = Math.max(hh, r.height);
    });
    var row = P.answers.getBoundingClientRect();
    var cs = getComputedStyle(P.answers);
    var room = row.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
             - (parseFloat(cs.columnGap || cs.gap) || 0) * (btns.length - 1);
    var same = w * btns.length <= room;
    /* in the pill's own ems, not pixels: the pills are sized against the
       pane, so a turned tablet or a resized window scales them with it */
    btns.forEach(function (b) {
      var fs = parseFloat(getComputedStyle(b).fontSize) || 16;
      if (same) b.style.minWidth = (Math.ceil(w) / fs).toFixed(3) + 'em';
      b.style.minHeight = (Math.ceil(hh) / fs).toFixed(3) + 'em';
    });
    return Flow.anim(Beats.optsIn(btns)).then(function () { return btns; });
  }
  /* Whatever is under the bird -- the answers, or a card -- taken away. */
  function perchClear() {
    var P = perch;
    if (!P) return Promise.resolve();
    var kids = Array.prototype.slice.call(P.answers.children);
    var pills = kids.filter(function (k) { return k.classList.contains('choice'); });
    var rest = kids.filter(function (k) { return pills.indexOf(k) < 0; });
    return Promise.all([Flow.anim(Beats.optsOut(pills)), Flow.anim(Beats.cardOut(rest))]).then(function () {
      if (perch !== P) return;
      P.answers.textContent = '';
      P.answers.classList.remove('is-hearing');
    });
  }
  /* The row under the bird, handed to a section for a card of its own (the
     heptagon's facts, s5): laid out as the working is, from under the
     bird's feet down. */
  function perchRow() {
    var P = perch || (perch = perchBuild());
    P.answers.classList.add('is-working');
    return P.answers;
  }
  /* The working is set at one size in every section; a card laid out
     wider than the bird's half (it is laid out at its finished width, so
     this is known before anything is in it) has every row set smaller by
     just as much as it needs (--fit, css/polygons.css). */
  function fitPerch(card) {
    var row = card.el.parentNode;
    if (!row) return card;
    card.el.style.removeProperty('--fit');
    var cs = getComputedStyle(row);
    var room = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var w = card.el.offsetWidth;
    if (room > 0 && w > room) card.el.style.setProperty('--fit', (Math.floor(room / w * 1000) / 1000).toFixed(3));
    return card;
  }
  /* A sum card under the bird, where the answers stood (W.sumCard);
     `reserve` ({ terms, total }) sizes it for the finished sum up front;
     `cls` adds a look of the section's own. */
  function perchSum(title, reserve, cls) {
    return fitPerch(W.sumCard(perchRow(), { title: title, reserve: reserve,
      cls: 'card--perch' + (cls ? ' ' + cls : '') }));
  }
  /* The steps card under the bird (W.stepsCard): "a + a + a = 3a" over
     "= 3 × side", the "=" signs one above the other. */
  function perchSteps(o) {
    return fitPerch(W.stepsCard(perchRow(), { terms: o.terms, eq: o.eq, rule: o.rule, cls: 'card--perch' }));
  }

  /* ---- the question under the bird ---------------------------------------
     The question is asked in the bubble; each verdict is said there after
     it, written and heard (o.onWrong, a promise: the wrong answer's line --
     handed the answer tapped, so the line can be the one for that answer --
     and the section's own line for the right answer).
       A wrong pill shakes and goes red. Then the answers are shuffled where
     the learner cannot see it happen: the pills stay where they are, only
     their numbers go for a moment and come back in a new order, every pill
     plain again. No pill is live until the wrong line is over; then every
     one is (a wrong answer is not spent -- it may be anywhere now).
       After MAX_TRIES wrong taps the answer is revealed for the learner. The
     right one goes green; either way the others step back from it, so the
     green one is what the eye is left on. Resolves { tries, revealed }. */
  var MAX_TRIES = 3;
  var SHUFFLE_GONE = 0.8;    /* s: the numbers away, while they are shuffled */
  function reshuffle(btns) {
    var labels = shuffle(btns.map(function (b) { return b.dataset.name; }));
    var txts = btns.map(choiceText);
    var tl = M.timeline({ willChange: txts, willChangeValue: 'opacity' });
    tl.to(txts, { opacity: 0, duration: M.dur(0.2), ease: 'power2.in' })
      .call(function () {
        btns.forEach(function (b, i) {
          b.classList.remove('is-wrong');
          b.dataset.name = labels[i];
          global.MathText.write(choiceText(b), labels[i]);
        });
      })
      .to(txts, { opacity: 1, duration: M.dur(0.28), ease: 'power2.out' }, '+=' + M.dur(SHUFFLE_GONE));
    return tl;
  }
  function perchAsk(btns, right, o) {
    o = o || {};
    var P = perch;
    var key = btns[right].dataset.name;
    var most = o.tries || MAX_TRIES;
    var live = true, busy = false, tries = 0, wrongs = 0, revealed = false;
    function hearing(on) { if (P) P.answers.classList.toggle('is-hearing', on); }
    function answerBtn() {
      for (var i = 0; i < btns.length; i++) if (btns[i].dataset.name === key) return btns[i];
      return btns[right];
    }
    function onPick(ev) {
      if (!live || busy) return;
      var btn = ev.currentTarget;
      ripple(ev, btn);
      tries++;
      if (btn.dataset.name === key) {
        live = false;
        Beats.choiceRight(btn);
        dom.gate.dispatchEvent(new MouseEvent('click'));
        return;
      }
      wrongs++;
      busy = true;
      hearing(true);
      /* the answer tapped, read now: the shuffle rewrites the pills */
      var picked = btn.dataset.name;
      var shook = Flow.anim(Beats.choiceWrong(btn));
      if (wrongs >= most) {
        /* out of tries: once it has shaken, the answer is shown */
        quiet(shook.then(function () {
          if (!live) return;
          live = false;
          revealed = true;
          dom.gate.dispatchEvent(new MouseEvent('click'));
        }));
        return;
      }
      quiet(Promise.all([
        shook.then(function () { return live ? Flow.anim(reshuffle(btns)) : null; }),
        o.onWrong ? o.onWrong(wrongs, picked) : null
      ]).then(function () {
        busy = false;
        hearing(false);
      }));
    }
    function off() {
      live = false;
      hearing(false);
      btns.forEach(function (b) {
        b.removeEventListener('click', onPick);
        b.classList.add('is-done');
      });
    }
    btns.forEach(function (b) { b.addEventListener('click', onPick); });
    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        off();
        var answer = answerBtn();
        btns.forEach(function (b) { if (b !== answer) b.classList.remove('is-wrong'); });
        M.set(btns.map(choiceText), { opacity: 1 });
        /* lit for the learner (revealed, or answered by a skip) */
        if (!answer.classList.contains('is-right')) {
          answer.classList.add('is-right');
          if (revealed) quiet(Flow.anim(M.correct(answer)));
        }
        quiet(Flow.anim(M.focus(answer, btns, { opacity: 0.4 })));
        return { tries: tries, revealed: revealed };
      },
      function (err) { off(); throw err; });
  }
  /* A verdict heard and not written: the bubble keeps the question while
     the bird says the line. Resolves when it is over (or, for a line not yet
     recorded, when the time it would take is up). */
  function perchHear(key, mood) {
    var mine = ++speaking;
    mascot.state(mood || 'talking');
    return voiceOver(key).then(function () { if (mine === speaking) mascot.settle(); });
  }
  /* The perch taken down: the bubble shuts, the bird jumps away behind the
     board, the row under it goes. */
  function perchDown() {
    var P = perch;
    if (!P) return Promise.resolve();
    speaking++;
    var shut = P.bubble.hasAttribute('hidden') ? Promise.resolve() : Flow.anim(Beats.bubbleOut(P.bubble));
    var bird = mascot.el.parentNode === P.stand ? mascotJumpOut() : Promise.resolve();
    var rest = Flow.anim(Beats.cardOut(Array.prototype.slice.call(P.answers.children)));
    return Promise.all([shut, bird, rest]).then(function () { if (perch === P) perchReset(); });
  }
  /* ...and at once, for a replay or a jump. The bird is never left inside
     the panel that is being thrown away. */
  function perchReset() {
    var P = perch;
    perch = null;
    if (!P) return;
    if (mascot.el.parentNode === P.stand) {
      mascot.el.classList.add('is-away');
      mascot.placeIn(dom.slotHero);
    }
    P.say.clear();
    if (P.root.parentNode) P.root.parentNode.removeChild(P.root);
  }

  /* ---- praise ------------------------------------------------------------- */
  var PRAISE = ['praiseWellDone', 'praiseExcellent', 'praiseAwesome', 'praiseFantastic', 'praisePerfect'];
  var praised = 0;
  /* Confetti over the board, or over `host` (the frame, when the board is
     closed -- as at the end). */
  function celebrate(host) {
    Beats.sfx('cheer');
    quiet(Flow.anim(Beats.confettiRain(host || dom.board)));
  }
  function praise(key) {
    celebrate();
    key = key || PRAISE[praised++ % PRAISE.length];
    return Flow.wait(Beats.ringing())
      .then(function () { return say(keyed(key), 'happy'); })
      .then(function () { mascot.settle(); });
  }
  /* A burst beside a right answer, in the figure's units. */
  function burstAt(x, y) {
    quiet(Flow.anim(Beats.confetti(dom.burst, x, y)));
  }

  /* ---- the bubble --------------------------------------------------------- */
  function restoreBubble() {
    sayBubble.clear();
    dom.bubble.setAttribute('hidden', '');
    M.set(dom.bubble, { clearProps: 'opacity,transform' });
  }

  /* ---- the header, taken away and given back ------------------------------ */
  function pictureAt(rect) {
    return { scale: Math.min(rect.width / VB_W, rect.height / VB_H), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  var rowsMove = null;
  function collapseHeader(on, cls, pop) {
    if (dom.board.classList.contains(cls || 'is-headless') === !!on) {
      return rowsMove && rowsMove.progress() < 1 ? rowsMove : null;
    }
    return moveRows(function () { dom.board.classList.toggle(cls || 'is-headless', !!on); }, pop);
  }
  function openHeader() {
    if (!dom.board.classList.contains('is-headless') && !dom.board.classList.contains('is-bare')) return null;
    return moveRows(function () { dom.board.classList.remove('is-headless', 'is-bare'); });
  }
  function moveRows(change, pop) {
    var was = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = 'none';
    change();
    var now = pictureAt(dom.figure.getBoundingClientRect());
    dom.board.style.transition = '';
    if (!was.scale || !now.scale || M.reducedMotion()) return (rowsMove = null);
    var els = [dom.figure, dom.layer];
    M.set(els, { scale: was.scale / now.scale, x: was.x - now.x, y: was.y - now.y, transformOrigin: 'center center' });
    var tl = M.timeline({ willChange: els, willChangeValue: 'transform' });
    tl.to(els, pop
      ? { scale: 1, x: 0, y: 0, duration: M.dur(0.7), ease: 'back.out(1.6)' }
      : { scale: 1, x: 0, y: 0, duration: M.dur(0.66), ease: 'power2.inOut' });
    return (rowsMove = tl);
  }

  /* ---- a scene, over ------------------------------------------------------- */
  function wipeBoard() {
    /* a bird on its perch goes with the perch */
    var gone = perch ? perchDown() : mascotJumpOut();
    var shut = Flow.anim(Beats.bubbleOut(dom.bubble));
    var line = Flow.anim(Beats.lineOut(dom.promptLine));
    var figure = Flow.anim(Beats.clearFigure(figureParts().filter(function (g) { return !g.hasAttribute || !g.hasAttribute('hidden'); })));
    var footer = [];
    if (!dom.tray.hasAttribute('hidden')) footer.push(Flow.anim(Beats.trayOut(dom.tray, chips)));
    if (!dom.choices.hasAttribute('hidden')) footer.push(Flow.anim(Beats.trayOut(dom.choices, choiceBtns)));
    var extra = sections.reduce(function (all, s) { return s.wipe ? all.concat(s.wipe()) : all; }, []);
    return Promise.all([gone, shut, line, figure].concat(footer, extra)).then(function () {
      clearPrompt();
      restoreBubble();
      resetFigure();
      resetFooter();
    });
  }

  /* ======================================================================
   * Waiting on an answer
   * ====================================================================== */

  /* One of several buttons pressed: resolves with its index. Under Skip,
     `opts.answer`. */
  function askChoice(buttons, opts) {
    var o = opts || {};
    var picked = -1, live = true;
    function onPick(ev) {
      if (!live) return;
      live = false;
      picked = buttons.indexOf(ev.currentTarget);
      ripple(ev, ev.currentTarget);
      dom.gate.dispatchEvent(new MouseEvent('click'));
    }
    function off() {
      live = false;
      buttons.forEach(function (b) { b.removeEventListener('click', onPick); });
    }
    buttons.forEach(function (b) { b.addEventListener('click', onPick); });
    return Flow.once(dom.gate, { auto: true }).then(
      function () { off(); if (picked < 0) picked = (o.answer == null ? 0 : o.answer); return picked; },
      function (err) { off(); throw err; });
  }

  /* Asked until right: a wrong press is shaken, struck out and answered
     (`o.onWrong(i)`, awaited), and the question stays open; the right one
     goes green and the rest are spent. Resolves with { tries }. */
  function askUntilRight(buttons, right, o) {
    o = o || {};
    var tries = 0;
    function round() {
      var open = buttons.filter(function (b) { return !b.classList.contains('is-struck'); });
      return askChoice(open, { answer: open.indexOf(buttons[right]) }).then(function (i) {
        var btn = open[i];
        tries++;
        if (btn === buttons[right]) {
          buttons.forEach(function (b) { b.classList.add('is-done'); });
          return Flow.anim(Beats.choiceRight(btn)).then(function () { return { tries: tries }; });
        }
        var shook = Flow.anim(Beats.choiceWrong(btn));
        btn.classList.add('is-struck');
        /* The reason is said while the question stays open: a learner who
           already sees their mistake can tap again at once. */
        if (o.onWrong) quiet(o.onWrong(buttons.indexOf(btn)));
        return shook.then(function () { return Flow.wait(SHORT); }).then(round);
      });
    }
    return round();
  }

  /* Every answer is also a button to tap; the choices arrive in the footer
     and leave it again. */
  function offerChoices(labels) {
    choiceBtns = buildChoices(dom.choices, labels);
    return Flow.anim(Beats.trayIn(dom.choices, choiceBtns)).then(function () { return choiceBtns; });
  }
  function clearChoices() {
    return Flow.anim(Beats.trayOut(dom.choices, choiceBtns)).then(function () {
      dom.choices.setAttribute('hidden', '');
      dom.choices.textContent = '';
      choiceBtns = [];
    });
  }

  /* ---- names into boxes ------------------------------------------------------
     Chips in the tray dragged (or tapped, then the box tapped) into SVG
     boxes. Resolves { right } once every box is filled; wrong drops go
     home and are told so through o.onWrong(box, chip). */
  var TAP_SLOP = 8, DROP_SLACK = 12;
  function armQuiz(boxes, names, o) {
    o = o || {};
    var failed = false, live = true, picked = null, drag = null, placed = 0;
    var group = o.group;
    if (group) group.classList.add('is-live');

    function boxAt(x, y) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (b.filled) continue;
        var r = b.rect.getBoundingClientRect();
        if (x >= r.left - DROP_SLACK && x <= r.right + DROP_SLACK && y >= r.top - DROP_SLACK && y <= r.bottom + DROP_SLACK) return b;
      }
      return null;
    }
    function hover(box) { boxes.forEach(function (b) { b.g.classList.toggle('is-over', b === box); }); }
    function pick(chip) {
      if (picked) picked.classList.remove('is-picked');
      picked = chip;
      if (chip) chip.classList.add('is-picked');
    }
    function home(chip) { chip.classList.remove('is-lifted'); Beats.chipHome(chip); }
    function attempt(box, chip) {
      hover(null);
      if (!box || box.filled) return home(chip);
      if (box.name === chip.dataset.name) return right(box, chip);
      return wrong(box, chip);
    }
    function dock(box, chip) {
      box.filled = true; placed++;
      pick(null);
      chip.classList.remove('is-lifted');
      var c = chip.getBoundingClientRect(), r = box.rect.getBoundingClientRect();
      Beats.chipDock(chip, (r.left + r.width / 2) - (c.left + c.width / 2), (r.top + r.height / 2) - (c.top + c.height / 2));
      box.text.textContent = T(box.name);
      box.g.setAttribute('aria-label', T('a11yBoxRight', { name: T(box.name) }));
      Beats.boxRight(box);
      if (o.onRight) o.onRight(box, chip, placed);
    }
    function right(box, chip) {
      dock(box, chip);
      if (placed >= boxes.length) { live = false; dom.gate.dispatchEvent(new MouseEvent('click')); }
    }
    function wrong(box, chip) {
      failed = true;
      pick(null);
      if (o.onWrong) o.onWrong(box, chip);
      Beats.boxWrong(box);
      home(chip);
    }
    function onDown(ev) {
      if (!live || drag) return;
      var chip = ev.currentTarget;
      if (chip.classList.contains('is-docked')) return;
      ev.preventDefault();
      drag = { chip: chip, id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, moved: false,
               x0: gsap.getProperty(chip, 'x') || 0, y0: gsap.getProperty(chip, 'y') || 0 };
      try { chip.setPointerCapture(ev.pointerId); } catch (e) {}
      chip.classList.add('is-lifted');
      M.to(chip, { scale: 1.06, duration: M.dur(0.12), ease: 'power2.out', overwrite: 'auto' });
      if (o.onTouch) o.onTouch();
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = ev.clientX - drag.ox, dy = ev.clientY - drag.oy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > TAP_SLOP) drag.moved = true;
      if (!drag.moved) return;
      M.set(drag.chip, { x: drag.x0 + dx, y: drag.y0 + dy });
      hover(boxAt(ev.clientX, ev.clientY));
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (!d.moved) {
        d.chip.classList.remove('is-lifted');
        M.to(d.chip, { scale: 1, duration: M.dur(0.15), ease: 'power2.out', overwrite: 'auto' });
        pick(picked === d.chip ? null : d.chip);
        return;
      }
      attempt(boxAt(ev.clientX, ev.clientY), d.chip);
    }
    function onCancel(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      hover(null); home(d.chip);
    }
    function onChipKey(ev) {
      if (!live || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      var chip = ev.currentTarget;
      if (chip.classList.contains('is-docked')) return;
      pick(picked === chip ? null : chip);
    }
    function boxOf(ev) {
      for (var i = 0; i < boxes.length; i++) if (boxes[i].g === ev.currentTarget) return boxes[i];
      return null;
    }
    function onBoxUp(ev) { if (live && !drag && picked) { var b = boxOf(ev); if (b) attempt(b, picked); } }
    function onBoxKey(ev) {
      if (!live || !picked || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      var b = boxOf(ev); if (b) attempt(b, picked);
    }
    function onBoxEnter(ev) { if (live && !drag) hover(boxOf(ev)); }
    function onBoxLeave() { if (live && !drag) hover(null); }
    function off() {
      live = false;
      names.forEach(function (c) { c.removeEventListener('pointerdown', onDown); c.removeEventListener('keydown', onChipKey); });
      boxes.forEach(function (b) {
        b.g.removeEventListener('pointerup', onBoxUp); b.g.removeEventListener('keydown', onBoxKey);
        b.g.removeEventListener('pointerenter', onBoxEnter); b.g.removeEventListener('pointerleave', onBoxLeave);
      });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (group) group.classList.remove('is-live');
      hover(null); pick(null); drag = null;
    }
    names.forEach(function (c) { c.addEventListener('pointerdown', onDown); c.addEventListener('keydown', onChipKey); });
    boxes.forEach(function (b) {
      b.g.addEventListener('pointerup', onBoxUp); b.g.addEventListener('keydown', onBoxKey);
      b.g.addEventListener('pointerenter', onBoxEnter); b.g.addEventListener('pointerleave', onBoxLeave);
    });
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);

    function fill() {
      boxes.forEach(function (b) {
        if (b.filled) return;
        for (var i = 0; i < names.length; i++) if (names[i].dataset.name === b.name) { dock(b, names[i]); return; }
      });
    }
    return Flow.once(dom.gate, { auto: true }).then(
      function () { live = false; fill(); off(); return { right: !failed }; },
      function (err) { off(); throw err; });
  }

  /* ---- a card swiped left or right ----------------------------------------
     The card follows the finger sideways only, tilting as it goes. Past
     SWIPE_AT (figure units) the panel on that side leans in to say "here";
     let go there -- or flick it that way -- and the card is sorted. Let go
     short of it and it springs home. Right: o.onRight is told, it flies into
     its panel and is kept there, small, and the promise resolves { right }. Wrong: the panel
     shakes, the card springs home with a head-shake, o.onWrong is told and
     the learner tries again. A tap on the card wiggles it (the hint that it
     moves sideways); a tap on a panel sorts it there; the arrow keys on the
     card and Enter on a panel do the same from the keyboard. */
  var SWIPE_AT = 80, FLICK_V = 0.55, FLICK_MIN = 28, TILT = 9;
  function armSwipe(card, zones, answer, o) {
    o = o || {};
    var g = card.g, failed = false, live = true, busy = false, drag = null, lean = null, lastDrag = 0;
    var left = zones.filter(function (z) { return z.side === 'left'; })[0];
    var right = zones.filter(function (z) { return z.side === 'right'; })[0];
    g.classList.add('is-live');

    function k() { var m = dom.figure.getScreenCTM(); return m ? m.a : 1; }
    function zoneFor(dx) { return dx <= -SWIPE_AT ? left : dx >= SWIPE_AT ? right : null; }
    function tiltOf(dx) { return Math.max(-1, Math.min(1, dx / (SWIPE_AT * 2.2))) * TILT; }
    function leanTo(z) {
      if (z === lean) return;
      if (lean) { lean.g.classList.remove('is-over'); Beats.zoneLean(lean, false); }
      lean = z;
      if (z) { z.g.classList.add('is-over'); Beats.zoneLean(z, true); }
    }
    function attempt(z) {
      leanTo(null);
      if (!z) return Flow.anim(Beats.swipeHome(card));
      if (z.name === answer) return sorted(z);
      return refused(z);
    }
    function sorted(z) {
      live = false; busy = true;
      g.classList.remove('is-live', 'is-lifted');
      g.classList.add('is-kept');   /* sorted: its highlight stops glowing */
      var seat = z.seat(z.kept.length);
      z.kept.push(card);
      Beats.zoneRight(z);
      if (o.onRight) o.onRight(z);
      Flow.anim(Beats.swipeInto(card, seat.x - card.centre.x, seat.y - card.centre.y, seat.k))
        .then(function () { dom.gate.dispatchEvent(new MouseEvent('click')); }, function () {});
    }
    function refused(z) {
      failed = true; busy = true;
      if (o.onWrong) o.onWrong(z);
      Beats.zoneWrong(z);
      Flow.anim(Beats.swipeWrong(card)).then(function () { busy = false; }, function () { busy = false; });
    }

    function onDown(ev) {
      if (!live || busy || drag) return;
      ev.preventDefault();
      var x0 = gsap.getProperty(g, 'x') || 0;
      drag = { id: ev.pointerId, ox: ev.clientX, x0: x0, dx: x0, moved: false, t: performance.now(), v: 0 };
      try { g.setPointerCapture(ev.pointerId); } catch (e) {}
      g.classList.add('is-lifted');
      gsap.killTweensOf(g);
      M.to(g, { scale: 1.04, duration: M.dur(0.12), ease: 'power2.out', overwrite: 'auto' });
      if (o.onTouch) o.onTouch();
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = drag.x0 + (ev.clientX - drag.ox) / k();
      if (!drag.moved && Math.abs(ev.clientX - drag.ox) > TAP_SLOP) drag.moved = true;
      if (!drag.moved) return;
      var now = performance.now(), dt = Math.max(1, now - drag.t);
      drag.v = drag.v * 0.6 + ((dx - drag.dx) / dt) * 0.4;   /* figure units per ms, smoothed */
      drag.dx = dx; drag.t = now;
      M.set(g, { x: dx, y: -Math.min(14, Math.abs(dx) * 0.05), rotation: tiltOf(dx) });
      leanTo(zoneFor(dx));
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      g.classList.remove('is-lifted');
      if (!d.moved) { Flow.anim(Beats.swipeNudge(card)); return; }
      lastDrag = performance.now();
      var z = zoneFor(d.dx);
      if (!z && Math.abs(d.dx) >= FLICK_MIN && Math.abs(d.v) >= FLICK_V) z = d.v < 0 ? left : right;
      attempt(z);
    }
    function onCancel(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      drag = null;
      g.classList.remove('is-lifted');
      leanTo(null);
      Flow.anim(Beats.swipeHome(card));
    }
    function onCardKey(ev) {
      if (!live || busy) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); attempt(left); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); attempt(right); }
    }
    function zoneOf(ev) { for (var i = 0; i < zones.length; i++) if (zones[i].g === ev.currentTarget) return zones[i]; return null; }
    function onZoneClick(ev) {
      if (!live || busy || drag || performance.now() - lastDrag < 300) return;
      if (o.onTouch) o.onTouch();
      attempt(zoneOf(ev));
    }
    function onZoneKey(ev) {
      if (!live || busy || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      attempt(zoneOf(ev));
    }
    function off() {
      live = false;
      g.removeEventListener('pointerdown', onDown);
      g.removeEventListener('keydown', onCardKey);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      zones.forEach(function (z) { z.g.removeEventListener('click', onZoneClick); z.g.removeEventListener('keydown', onZoneKey); });
      g.classList.remove('is-live', 'is-lifted');
      leanTo(null);
    }
    g.addEventListener('pointerdown', onDown);
    g.addEventListener('keydown', onCardKey);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    zones.forEach(function (z) { z.g.addEventListener('click', onZoneClick); z.g.addEventListener('keydown', onZoneKey); });

    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        if (live) {                       /* a skip answered it: straight onto its shelf */
          var z = zones.filter(function (x) { return x.name === answer; })[0];
          var seat = z.seat(z.kept.length);
          z.kept.push(card);
          live = false;
          M.set(card.face, { opacity: 0 });
          M.set(g, { x: seat.x - card.centre.x, y: seat.y - card.centre.y, rotation: 0, scale: seat.k });
        }
        off();
        return { right: !failed };
      },
      function (err) { off(); throw err; });
  }

  /* ---- every side tapped ----------------------------------------------------
     The shape's sides each tapped once, in any order. Each tap lights the
     side and calls o.onTap(i, count); the promise resolves once all are
     tapped (at once, with every side counted, under Skip). */
  function armTapSides(shape, o) {
    o = o || {};
    var done = [], live = true, count = 0;
    shape.g.classList.add('is-live');
    function tap(i, ev) {
      if (!live || done[i]) return;
      done[i] = true; count++;
      shape.hits[i].classList.add('is-done');
      shape.hits[i].setAttribute('tabindex', '-1');
      if (ev) ripple(ev, shape.hits[i]);
      Beats.pop();
      if (o.onTap) o.onTap(i, count);
      if (count >= shape.n) { live = false; dom.gate.dispatchEvent(new MouseEvent('click')); }
    }
    var handlers = shape.hits.map(function (hit, i) {
      var h = { click: function (ev) { tap(i, ev); },
                key: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tap(i, null); } } };
      hit.setAttribute('tabindex', '0');
      hit.addEventListener('click', h.click);
      hit.addEventListener('keydown', h.key);
      return h;
    });
    function off() {
      live = false;
      shape.hits.forEach(function (hit, i) {
        hit.removeEventListener('click', handlers[i].click);
        hit.removeEventListener('keydown', handlers[i].key);
        hit.setAttribute('tabindex', '-1');
      });
      shape.g.classList.remove('is-live');
    }
    return Flow.once(dom.gate, { auto: true }).then(
      function () { for (var i = 0; i < shape.n; i++) if (!done[i]) { live = true; tap(i, null); } off(); },
      function (err) { off(); throw err; });
  }

  /* ======================================================================
   * Scene 0 -- welcome
   * ====================================================================== */
  function sceneWelcome() {
    mascot.placeIn(dom.slotHero);
    mascot.state('waving');
    return Flow.wait(SHORT)
      .then(function () { return Flow.anim(global.Loader ? global.Loader.ready() : null); })
      .then(function () {
        centreHero([keyed('p01Hey'), keyed('p02Warm')]);
        dom.startBtn.removeAttribute('hidden');
        return Flow.frame();
      })
      .then(function () {
        dom.startBtn.classList.add('in');
        M.button3d(dom.startBtn, { edge: 5 });
        return Flow.once(dom.startBtn, { auto: true });
      })
      .then(function () {
        Beats.sfx('click');
        mascot.settle();
        return Flow.anim(Beats.welcomeOut(dom.welcome, dom.title, dom.startBtn, [dom.flakes]));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        mascot.state('talking');
        Beats.bubbleArm(dom.bubble);
        var hello = keyed('p01Hey');
        var heard = quiet(voiceOf(hello));
        var said = sayBubble(hello);
        Beats.bubbleIn(dom.bubble);
        return Promise.all([said, heard]);
      })
      .then(function () { return Flow.wait(BEAT); })
      .then(function () {
        var warm = keyed('p02Warm');
        var heard = quiet(voiceOf(warm));
        return Promise.all([sayBubble(warm), heard]);
      })
      .then(function () { mascot.settle(); return Flow.wait(SHORT); })
      .then(function () { return handOver(dom.nextBtn); });
  }

  /* ---- the bird centre stage ----------------------------------------------
     The bird and its bubble read as ONE group, centred on the frame. The
     bubble's width differs line to line (it morphs between them), so the
     group is centred on the WIDEST line it will say, measured up front --
     the bird then stands still while the bubble changes under it. Set while
     nothing is on show (behind the welcome, or behind the board). */
  var BIRD_INSET = 0.13;   /* the bird's painted left edge, as a share of its slot */
  function centreHero(lines) {
    var slot = dom.slotHero;
    var fw = dom.frame.getBoundingClientRect().width;
    var sw = slot.offsetWidth;
    if (!fw || !sw) return;
    var probe = dom.bubble.cloneNode(true);
    probe.removeAttribute('id');
    probe.removeAttribute('hidden');
    probe.removeAttribute('style');
    probe.setAttribute('aria-hidden', 'true');
    Array.prototype.forEach.call(probe.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    var ghost = probe.querySelector('.type-ghost');
    var txt = probe.querySelector('.type .txt');
    if (txt) txt.textContent = '';
    probe.style.visibility = 'hidden';
    slot.appendChild(probe);
    var widest = 0, offL = 0;
    lines.forEach(function (line) {
      if (ghost) ghost.textContent = plain(line.text);
      widest = Math.max(widest, probe.offsetWidth);
      offL = probe.offsetLeft;
    });
    slot.removeChild(probe);
    /* the group's middle, from the slot's left edge */
    var mid = (BIRD_INSET * sw + offL + widest) / 2;
    slot.style.left = ((fw / 2 - mid + sw / 2) / fw * 100) + '%';
  }

  /* An interlude between sections, as at the welcome: the bird says its
     lines centre stage, hands over to Next, and the board opens again. */
  function interlude(keys) {
    return centreStage(keys)
      .then(function () { mascot.settle(); return Flow.wait(SHORT); })
      .then(function () { return handOver(); })
      .then(openBoard);
  }

  /* Centre stage, as at the welcome: the board is cleared and closed, the
     bird is left standing centre stage (it stands behind the board, so the
     board's fade uncovers it) and says its lines in the bubble -- the first
     popping the bubble in, each next one morphing it. */
  function centreStage(keys) {
    var e = mascot.el;
    var lines = keys.map(function (k) { return keyed(k); });
    return wipeBoard()
      .then(function () {
        mascot.placeIn(dom.slotHero);
        centreHero(lines);
        M.set(e, { clearProps: 'transform' });
        e.hidden = false;
        e.classList.remove('is-away');
        mascot.idle();
        if (!dom.board.classList.contains('show')) return null;
        return Flow.anim(Beats.boardOut(dom.board));
      })
      .then(function () { return Flow.wait(SHORT); })
      .then(function () {
        return lines.reduce(function (chain, line, i) {
          return chain
            .then(function () { return i ? Flow.wait(BEAT) : null; })
            .then(function () {
              mascot.state('talking');
              if (!i) Beats.bubbleArm(dom.bubble);
              var heard = quiet(voiceOf(line));
              var said = sayBubble(line);
              if (!i) Beats.bubbleIn(dom.bubble);
              return Promise.all([said, heard]);
            });
        }, Promise.resolve());
      });
  }

  /* The board opened: the bird and its bubble leave centre stage first (so
     the bird is never left standing behind the board), then the board grows
     in. */
  function openBoard() {
    if (dom.board.classList.contains('show')) return Promise.resolve();
    var e = mascot.el;
    var bird = e.parentNode === dom.slotHero && !e.hidden && !e.classList.contains('is-away')
      ? Flow.anim(Beats.heroOut(e)) : Promise.resolve();
    return Promise.all([Flow.anim(Beats.bubbleOut(dom.bubble)), bird])
      .then(function () { sayBubble.clear(); return Flow.anim(Beats.boardIn(dom.board)); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* The end, as at the welcome: the board closes, the bird says its last
     lines centre stage in the bubble, confetti over the frame, then Play
     again. */
  function sceneEnd() {
    return centreStage(['endGood', 'endDone'])
      .then(function () { mascot.state('celebrating'); celebrate(dom.frame); return Flow.wait(1600); })
      .then(function () { mascot.settle(); return Flow.wait(SHORT); })
      .then(function () {
        M.button3d(dom.restartBtn, { edge: 4 });
        Beats.controlIn(dom.restartBtn);
        return Flow.once(dom.restartBtn);
      })
      .then(function () {
        Beats.sfx('click');
        return Flow.anim(Beats.controlOut(dom.restartBtn));
      })
      .then(function () { global.Pages.run(); });
  }

  /* ======================================================================
   * The lesson's scenes and the sections that bring them
   * ====================================================================== */
  var SCENES = [{ name: 'Welcome', play: sceneWelcome }];
  var sections = [];
  var ended = false;

  function addSection(spec) {
    if (!spec || !spec.scenes) return;
    spec.first = SCENES.length;
    spec.count = spec.scenes.length;
    sections.push(spec);
    spec.scenes.forEach(function (sc) { SCENES.push(sc); });
    if (dom && spec.build) spec.build(kit);
  }
  function sectionOf(index) {
    for (var i = sections.length - 1; i >= 0; i--) if (sections[i].count && index >= sections[i].first) return sections[i];
    return null;
  }
  function closeLesson() {
    if (ended) return;
    ended = true;
    SCENES.push({ name: 'The end', play: sceneEnd });
  }

  var at = 0, page = 0, seen = [], seek = 0, seekIn = -1, watchers = [];
  function note(scene, p) { if (!(seen[scene] > p + 1)) seen[scene] = p + 1; }
  function turned() { page++; announce(); }
  function announce() {
    var where = { scene: at, scenes: SCENES.length, name: SCENES[at].name, page: page, pages: seen.slice() };
    watchers.forEach(function (fn) { try { fn(where); } catch (e) {} });
  }
  function play(from) {
    var chain = Promise.resolve();
    for (var i = from || 0; i < SCENES.length; i++) chain = chain.then(enter(i));
    return chain;
  }
  function enter(i) {
    return function () {
      at = i; page = 0;
      note(i, 0);
      if (seek && i !== seekIn) { seek = 0; Flow.resume(); }
      announce();
      return SCENES[i].play();
    };
  }

  function rewind() {
    if (sayBubble) sayBubble.clear();
    if (sayPrompt) sayPrompt.clear();
    speaking++;
    awaiting = [];
    begun = { text: null, at: 0 };
    if (global.I18n) global.I18n.stop();
    hopperOff();
    perchReset();
    mascot.el.hidden = false;
    mascot.el.classList.remove('is-away');
    mascot.idle();
    rowsMove = null;
    dom.welcome.removeAttribute('hidden');
    dom.startBtn.setAttribute('hidden', '');
    dom.startBtn.classList.remove('in');
    dom.nextBtn.setAttribute('hidden', '');
    dom.restartBtn.setAttribute('hidden', '');
    dom.bubble.setAttribute('hidden', '');
    dom.board.classList.remove('show', 'is-animating', 'is-headless', 'is-bare');
    dom.board.setAttribute('aria-hidden', 'true');
    restoreBubble();
    resetFigure();
    resetFooter();
    M.set([dom.welcome, dom.title, dom.flakes, dom.startBtn, dom.nextBtn, dom.restartBtn, dom.bubble,
           dom.board, dom.promptLine, dom.slotHeader, dom.figure, dom.layer, mascot.el, dom.hopper],
          { clearProps: 'opacity,transform,filter' });
  }

  /* The board as the scene at `index` expects to FIND it, written in. */
  function stageFor(index) {
    if (index <= 0) return;
    dom.welcome.setAttribute('hidden', '');
    mascot.placeIn(dom.slotHero);
    mascot.idle();
    if (index === 1) return;                 /* the first section opens the board itself */
    dom.board.classList.add('show');
    dom.board.setAttribute('aria-hidden', 'false');
    mascot.el.classList.add('is-away');
    var s = sectionOf(index);
    if (s && s.stage) s.stage(index - s.first);
  }

  function init() {
    if (dom) return { dom: dom, mascot: mascot };
    dom = collect();
    mascot = global.Mascot.create({ slot: dom.slotHero });
    sayBubble = onVoice(global.Typer.create($('bubbleType'), { box: dom.bubble }));
    sayPrompt = onVoice(global.Typer.create($('promptType')));
    closeLesson();
    sections.forEach(function (s) { if (s.build) s.build(kit); });
    return { dom: dom, mascot: mascot };
  }

  var started = false;
  function runFrom(index, wanted) {
    if (!dom) init();
    started = true;
    index = Math.max(0, Math.min(SCENES.length - 1, index | 0));
    seek = Math.max(0, wanted | 0);
    seekIn = index;
    Flow.reset();
    dom.board.style.transition = 'none';
    rewind();
    stageFor(index);
    void dom.board.offsetHeight;
    dom.board.style.transition = '';
    return Flow.run(function () {
      if (seek > 0) Flow.skip();
      return play(index);
    });
  }
  function run() { return runFrom(0, 0); }

  /* ---- what a section needs ------------------------------------------------- */
  var kit = {
    BEAT: BEAT, SHORT: SHORT, LOOK: LOOK, AUTO_TURN: AUTO_TURN, VB_W: VB_W, VB_H: VB_H,
    BOX_W: BOX_W, BOX_H: BOX_H,
    dom: function () { return dom; },
    mascot: function () { return mascot; },
    el: el, round2: round2,
    buildBox: buildBox, emptyBox: emptyBox, buildZone: buildZone, buildCard: buildCard,
    buildChips: buildChips, buildChoices: buildChoices, shuffle: shuffle,
    chips: function (list) { if (list) chips = list; return chips; },
    choices: function (list) { if (list) choiceBtns = list; return choiceBtns; },
    offerChoices: offerChoices, clearChoices: clearChoices,
    handOver: handOver, autoTurn: autoTurn,
    openBoard: openBoard, wipeBoard: wipeBoard, interlude: interlude, collapseHeader: collapseHeader, openHeader: openHeader,
    say: say, speak: speakLine, arriveSaying: speakLine, speakBySentence: speakBySentence,
    keyed: keyed, hear: hear, voiceOver: voiceOver, voiceAt: voiceAt, birdVoice: birdVoice, typedFor: typedFor,
    onWord: onWord, onPhrase: onPhrase,
    birdAway: birdAway, lineAway: lineAway, clearPrompt: clearPrompt, birdOnHeader: birdOnHeader,
    mascotJumpIn: mascotJumpIn, mascotJumpOut: mascotJumpOut,
    celebrate: celebrate, praise: praise, burstAt: burstAt,
    askChoice: askChoice, askUntilRight: askUntilRight,
    perchSay: perchLine, perchVoice: perchVoice, perchChoices: perchChoices,
    perchClear: perchClear, perchSum: perchSum, perchSteps: perchSteps, perchDown: perchDown,
    perchUp: perchUp, perchRow: perchRow, perchAsk: perchAsk, perchHear: perchHear,
    armQuiz: armQuiz, armSwipe: armSwipe, armTapSides: armTapSides,
    dragGuide: function (to) { return W.dragGuide(dom.tray, to); },
    ripple: ripple, quiet: quiet, clearInline: clearInline
  };

  global.Pages = {
    init: init,
    addSection: addSection,
    kit: kit,
    run: run,
    runFrom: runFrom,
    rewind: rewind,
    started: function () { return started; },
    levels: function () { return SCENES.map(function (s) { return s.name; }); },
    skills: function () { return [{ first: 0, name: 'Perimeter of polygons', n: 1 }]; },
    level: function () { return at; },
    page: function () { return page; },
    pages: function () { return seen.slice(); },
    onLevel: function (fn) {
      if (typeof fn !== 'function') return;
      watchers.push(fn);
      fn({ scene: at, scenes: SCENES.length, name: SCENES[at].name, page: page, pages: seen.slice() });
    },
    mascot: function () { return mascot; },
    dom: function () { return dom; }
  };
})(window);
