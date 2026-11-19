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
     z: { name, side: 'left'|'right', x, y, w, h, cap }. A tall frosted panel
     with its name on a band at the top and a shelf below, where the cards
     swiped into it are kept, small, in a row. `cap` is how many it will
     hold (the seats are laid out for that many). */
  var ZONE_W = 240, ZONE_H = 300, ZONE_Y = 58, ZONE_M = 26;
  function buildZone(group, z) {
    var w = z.w || ZONE_W, hh = z.h || ZONE_H, y = z.y == null ? ZONE_Y : z.y;
    var x = z.x != null ? z.x : (z.side === 'right' ? VB_W - ZONE_M - w : ZONE_M);
    var g = el('g', { 'class': 'zone zone--' + (z.side || 'left'), 'data-name': z.name, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', T('a11yZone', { name: T(z.name) }));
    var shadow = el('rect', { 'class': 'zone__shadow', x: x, y: y + 8, width: w, height: hh, rx: 28 });
    var body = el('rect', { 'class': 'zone__body', x: x, y: y, width: w, height: hh, rx: 28 });
    var band = el('rect', { 'class': 'zone__band', x: x + 16, y: y + 16, width: w - 32, height: 58, rx: 18 });
    var label = el('text', { 'class': 'figure-label zone__label', x: x + w / 2, y: y + 46, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    label.textContent = T(z.name);
    var shelf = { x: x + 14, y: y + 88, w: w - 28, h: hh - 102 };
    var tray = el('rect', { 'class': 'zone__shelf', x: shelf.x, y: shelf.y, width: shelf.w, height: shelf.h, rx: 18 });
    [shadow, body, band, label, tray].forEach(function (n) { g.appendChild(n); });
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
  function buildChoices(host, labels) {
    host.textContent = '';
    return labels.map(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      global.MathText.write(b, text);
      b.dataset.name = text;
      host.appendChild(b);
      return b;
    });
  }
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
    if (slot === dom.slotHeader) Flow.anim(openHeader());
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
    var shut = function () { if (closes) Flow.anim(collapseHeader(true)); };
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

  /* ---- praise ------------------------------------------------------------- */
  var PRAISE = ['praiseWellDone', 'praiseExcellent', 'praiseAwesome', 'praiseFantastic', 'praisePerfect'];
  var praised = 0;
  function celebrate() {
    Beats.sfx('cheer');
    quiet(Flow.anim(Beats.confettiRain(dom.board)));
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
    var gone = mascotJumpOut();
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
     short of it and it springs home. Right: it flies into its panel and is
     kept there, small, and the promise resolves { right }. Wrong: the panel
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
      var seat = z.seat(z.kept.length);
      z.kept.push(card);
      Beats.zoneRight(z);
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
      .then(function () { dom.startBtn.removeAttribute('hidden'); return Flow.frame(); })
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

  /* The board opened over the bird: the bubble goes, the board grows in. */
  function openBoard() {
    if (dom.board.classList.contains('show')) return Promise.resolve();
    return Flow.anim(Beats.bubbleOut(dom.bubble))
      .then(function () { sayBubble.clear(); return Flow.anim(Beats.boardIn(dom.board)); })
      .then(function () { return Flow.wait(SHORT); });
  }

  /* The end: the bird's last line, then Play again. */
  function sceneEnd() {
    return wipeBoard()
      .then(function () { return Flow.anim(openHeader()); })
      .then(function () { return say('endDone', 'happy'); })
      .then(function () { mascot.state('celebrating'); celebrate(); return Flow.wait(1600); })
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
    openBoard: openBoard, wipeBoard: wipeBoard, collapseHeader: collapseHeader, openHeader: openHeader,
    say: say, speak: speakLine, arriveSaying: speakLine, speakBySentence: speakBySentence,
    keyed: keyed, hear: hear, voiceOver: voiceOver, birdVoice: birdVoice, typedFor: typedFor,
    onWord: onWord, onPhrase: onPhrase,
    birdAway: birdAway, lineAway: lineAway, clearPrompt: clearPrompt, birdOnHeader: birdOnHeader,
    mascotJumpIn: mascotJumpIn, mascotJumpOut: mascotJumpOut,
    celebrate: celebrate, praise: praise, burstAt: burstAt,
    askChoice: askChoice, askUntilRight: askUntilRight,
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
