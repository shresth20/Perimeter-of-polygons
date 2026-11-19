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
      figure: $('figure'), layer: $('layer'), burst: $('figBurst'), counter: $('counter'),
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

  /* ---- a bucket --------------------------------------------------------- */
  function buildBucket(group, b) {
    var w = b.w || 230, hh = b.h || 150, x = b.x, y = b.y;
    var g = el('g', { 'class': 'bucket', 'data-name': b.name, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', T('a11yBucket', { name: T(b.name) }));
    var inset = w * 0.1;
    var body = el('path', { 'class': 'bucket__body',
      d: 'M' + x + ' ' + (y + 18) + ' L' + (x + w) + ' ' + (y + 18) + ' L' + (x + w - inset) + ' ' + (y + hh) +
         ' Q' + (x + w / 2) + ' ' + (y + hh + 16) + ' ' + (x + inset) + ' ' + (y + hh) + ' Z' });
    var sheen = el('path', { 'class': 'bucket__sheen',
      d: 'M' + (x + 22) + ' ' + (y + 34) + ' L' + (x + 34) + ' ' + (y + 34) + ' L' + (x + 40) + ' ' + (y + hh - 24) + ' L' + (x + 30) + ' ' + (y + hh - 24) + ' Z' });
    var rim = el('rect', { 'class': 'bucket__rim', x: x - 6, y: y, width: w + 12, height: 26, rx: 13 });
    var label = el('text', { 'class': 'figure-label bucket__label', x: x + w / 2, y: y + hh * 0.62, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    label.textContent = T(b.name);
    g.appendChild(body); g.appendChild(sheen); g.appendChild(rim); g.appendChild(label);
    group.appendChild(g);
    return { name: b.name, g: g, body: body, label: label, centre: { x: x + w / 2, y: y + hh * 0.55 }, w: w, h: hh, x: x, y: y };
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
    dom.counter.setAttribute('hidden', '');
    dom.counter.textContent = '';
    Array.prototype.forEach.call(dom.figure.querySelectorAll('.is-lit, .is-pulsing, .is-dim'), function (e) {
      e.classList.remove('is-lit', 'is-pulsing', 'is-dim');
      e.style.removeProperty('--pulse-times');
    });
    clearInline([dom.figure, dom.counter].concat(Array.prototype.slice.call(dom.figure.querySelectorAll('*'))));
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

  /* The "n of m" counter in the board's corner. */
  function counter(n, m) {
    dom.counter.textContent = T('nOfM', { n: n, m: m });
    if (dom.counter.hasAttribute('hidden')) return Flow.anim(Beats.counterIn(dom.counter));
    return Flow.anim(Beats.emphasise(dom.counter));
  }
  function counterOff() {
    if (dom.counter.hasAttribute('hidden')) return Promise.resolve();
    return Flow.anim(Beats.counterOut(dom.counter));
  }

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
  /* fn, run as `phrase` is heard (or typed) in the line `text`. */
  function onWord(text, phrase, fn) {
    return lineBegins(text)
      .then(function (t0) { return Flow.wait(t0 + wordAt(text, phrase) - performance.now()); })
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
  /* Say a line from wherever the bird is: on the header already, or up to it. */
  function say(key, mood, along) {
    var line = typeof key === 'string' ? keyed(key) : key;
    return birdOnHeader() ? speak(line, mood, along) : arriveSaying(line, mood, along);
  }
  function keyed(key, repl) {
    return { text: global.I18n ? global.I18n.t(key, repl) : key, vo: key };
  }

  /* A line of more than one sentence, said a sentence at a time. */
  var OUT_LEAD = 280;
  function sentencesOf(text) {
    var parts = text.match(/[^.!?]+[.!?]+\s*/g);
    return parts && parts.length > 1 && parts.join('') === text ? parts : null;
  }
  function speakBySentence(key, mood, repl) {
    var line = keyed(key, repl);
    var I = global.I18n;
    var parts = sentencesOf(line.text);
    if (!parts || Flow.isFast()) return say(line, mood);
    var cues = I && I.cues ? I.cues(key) : null;
    if (!cues) {
      if (I && I.voiced && I.voiced().indexOf(key) >= 0) return say(line, mood);
      return parts.reduce(function (chain, s, i) {
        return chain.then(function (n) {
          if (i > 0 && n !== speaking) return n;
          /* the whole line begins with its first sentence, so a beat armed
             on a phrase of the line (onPhrase) is counted from here */
          if (i === 0) began(line.text);
          var said = i === 0 ? say(s.trim(), mood) : speak(s.trim(), mood);
          var mine = speaking;
          return said.then(function () { return mine; });
        });
      }, Promise.resolve(speaking));
    }
    var w = 0;
    var split = parts.map(function (s) {
      var n = (s.match(/\S+\s*/g) || []).length;
      var at2 = cues.slice(w, w + n);
      w += n;
      return { text: s.trim(), at: at2 };
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
        var heard = quiet(voiceOf(line));
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
        return Promise.all([typed, heard]);
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
    footer.push(counterOff());
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

  /* ---- a shape into a bucket -----------------------------------------------
     One SVG shape group dragged into one of the buckets. Right: it drops
     in and resolves { right }. Wrong: it shakes and goes home, o.onWrong is
     told, and the learner tries again. Keyboard: Enter on the shape picks
     it up, Enter on a bucket drops it. */
  function armSort(shape, buckets, answer, o) {
    o = o || {};
    var g = shape.g, failed = false, live = true, drag = null, picked = false;
    g.classList.add('is-draggable', 'is-live');
    shape.hitbox.setAttribute('tabindex', '0');
    shape.hitbox.setAttribute('role', 'button');
    shape.hitbox.setAttribute('aria-label', T('a11yShape'));
    function k() { var m = dom.figure.getScreenCTM(); return m ? m.a : 1; }
    function bucketAt(x, y) {
      for (var i = 0; i < buckets.length; i++) {
        var r = buckets[i].body.getBoundingClientRect();
        if (x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 30 && y <= r.bottom + 20) return buckets[i];
      }
      return null;
    }
    function hover(b) { buckets.forEach(function (x) { x.g.classList.toggle('is-over', x === b); }); }
    function attempt(b) {
      hover(null);
      if (!b) return Flow.anim(Beats.shapeHome(g));
      if (b.name === answer) return right(b);
      return wrong(b);
    }
    function right(b) {
      live = false;
      g.classList.remove('is-lifted', 'is-picked');
      var c = shape.centre();
      var x = gsap.getProperty(g, 'x') || 0, y = gsap.getProperty(g, 'y') || 0;
      Beats.bucketRight(b);
      Flow.anim(Beats.shapeInto(g, b.centre.x - (c.x + x), b.centre.y - (c.y + y), c.x + 'px ' + c.y + 'px'))
        .then(function () { dom.gate.dispatchEvent(new MouseEvent('click')); }, function () {});
    }
    function wrong(b) {
      failed = true;
      g.classList.remove('is-picked');
      picked = false;
      if (o.onWrong) o.onWrong(b);
      Beats.bucketWrong(b);
      Flow.anim(Beats.shapeWrong(g)).then(function () { return Flow.anim(Beats.shapeHome(g)); }, function () {});
    }
    function onDown(ev) {
      if (!live || drag) return;
      ev.preventDefault();
      drag = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, moved: false,
               x0: gsap.getProperty(g, 'x') || 0, y0: gsap.getProperty(g, 'y') || 0 };
      try { shape.hitbox.setPointerCapture(ev.pointerId); } catch (e) {}
      g.classList.add('is-lifted');
      var c = shape.centre();
      M.to(g, { scale: 1.06, transformOrigin: c.x + 'px ' + c.y + 'px', duration: M.dur(0.12), ease: 'power2.out', overwrite: 'auto' });
      if (o.onTouch) o.onTouch();
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = ev.clientX - drag.ox, dy = ev.clientY - drag.oy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > TAP_SLOP) drag.moved = true;
      if (!drag.moved) return;
      M.set(g, { x: drag.x0 + dx / k(), y: drag.y0 + dy / k() });
      hover(bucketAt(ev.clientX, ev.clientY));
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var d = drag; drag = null;
      g.classList.remove('is-lifted');
      if (!d.moved) {
        picked = !picked;
        g.classList.toggle('is-picked', picked);
        if (!picked) Beats.shapeHome(g);
        return;
      }
      attempt(bucketAt(ev.clientX, ev.clientY));
    }
    function onCancel(ev) { if (drag && ev.pointerId === drag.id) { drag = null; hover(null); Beats.shapeHome(g); } }
    function onShapeKey(ev) {
      if (!live || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      picked = !picked;
      g.classList.toggle('is-picked', picked);
    }
    function bucketOf(ev) { for (var i = 0; i < buckets.length; i++) if (buckets[i].g === ev.currentTarget) return buckets[i]; return null; }
    function onBucketUp(ev) { if (live && !drag && picked) attempt(bucketOf(ev)); }
    function onBucketKey(ev) {
      if (!live || !picked || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      attempt(bucketOf(ev));
    }
    function off() {
      live = false;
      shape.hitbox.removeEventListener('pointerdown', onDown);
      shape.hitbox.removeEventListener('keydown', onShapeKey);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      buckets.forEach(function (b) { b.g.removeEventListener('pointerup', onBucketUp); b.g.removeEventListener('keydown', onBucketKey); });
      g.classList.remove('is-draggable', 'is-live', 'is-lifted', 'is-picked');
      hover(null);
    }
    shape.hitbox.addEventListener('pointerdown', onDown);
    shape.hitbox.addEventListener('keydown', onShapeKey);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    buckets.forEach(function (b) { b.g.addEventListener('pointerup', onBucketUp); b.g.addEventListener('keydown', onBucketKey); });

    return Flow.once(dom.gate, { auto: true }).then(
      function () {
        if (live) {                       /* a skip answered it */
          var b = buckets.filter(function (x) { return x.name === answer; })[0];
          live = false;
          Beats.bucketRight(b);
          M.set(g, { opacity: 0 });
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
    buildBox: buildBox, emptyBox: emptyBox, buildBucket: buildBucket,
    buildChips: buildChips, buildChoices: buildChoices, shuffle: shuffle,
    chips: function (list) { if (list) chips = list; return chips; },
    choices: function (list) { if (list) choiceBtns = list; return choiceBtns; },
    offerChoices: offerChoices, clearChoices: clearChoices,
    handOver: handOver, autoTurn: autoTurn,
    openBoard: openBoard, wipeBoard: wipeBoard, collapseHeader: collapseHeader, openHeader: openHeader,
    say: say, speak: speak, arriveSaying: arriveSaying, speakBySentence: speakBySentence,
    keyed: keyed, hear: hear, voiceOver: voiceOver, birdVoice: birdVoice, typedFor: typedFor,
    onWord: onWord, onPhrase: onPhrase,
    birdAway: birdAway, lineAway: lineAway, clearPrompt: clearPrompt, birdOnHeader: birdOnHeader,
    mascotJumpIn: mascotJumpIn, mascotJumpOut: mascotJumpOut,
    celebrate: celebrate, praise: praise, burstAt: burstAt,
    counter: counter, counterOff: counterOff,
    askChoice: askChoice, askUntilRight: askUntilRight,
    armQuiz: armQuiz, armSort: armSort, armTapSides: armTapSides,
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
