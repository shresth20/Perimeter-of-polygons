/* ==========================================================================
 * scenery.js -- the snow
 * --------------------------------------------------------------------------
 * A few dozen flakes drifting down behind the whole lesson, and snowflakes
 * falling slowly from the sky of the welcome painting. Plain GSAP, not
 * Motion: these loops belong to the page, not to a scene, so a Replay must
 * not kill them. Nothing under reduced motion.
 * ========================================================================== */
(function (global) {
  'use strict';

  var gsap = global.gsap;
  var FLAKES = 26;
  var FLAKE_D = 'M12 1 V23 M1 12 H23 M4.2 4.2 L19.8 19.8 M19.8 4.2 L4.2 19.8 ' +
    'M12 4 L9.5 6.5 M12 4 L14.5 6.5 M12 20 L9.5 17.5 M12 20 L14.5 17.5 ' +
    'M4 12 L6.5 9.5 M4 12 L6.5 14.5 M20 12 L17.5 9.5 M20 12 L17.5 14.5';

  function reduced() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function snowfall(host) {
    if (!host || !gsap || reduced()) return;
    for (var i = 0; i < FLAKES; i++) {
      var f = document.createElement('i');
      f.className = 'snow__flake';
      host.appendChild(f);
      drift(f, true);
    }
  }
  /* One flake, falling: a slow drop with a sway, then again from the top. */
  function drift(f, first) {
    var vw = global.innerWidth || 1000, vh = global.innerHeight || 600;
    var size = 5 + Math.random() * 9;
    var x = Math.random() * vw;
    var fall = 9 + Math.random() * 9;
    gsap.set(f, { x: x, y: first ? Math.random() * vh : -20, width: size, height: size,
                  opacity: 0.35 + Math.random() * 0.5 });
    gsap.to(f, { y: vh + 30, duration: first ? fall * (1 - Math.random() * 0.6) : fall,
                 ease: 'none', onComplete: function () { drift(f, false); } });
    gsap.to(f, { x: x + (Math.random() - 0.5) * 120, duration: 2.5 + Math.random() * 2,
                 ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  function flakeSvg() {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', FLAKE_D);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    s.appendChild(p);
    return s;
  }

  /* ---- the welcome's snowflakes, falling --------------------------------
     Snowflakes fall slowly over the welcome painting
     (assets/images/welcome-bg.jpg, 1672 x 941), turning and swaying, and
     come back in from the top; a dusting of small specks falls further
     away. The flakes' box sits exactly over the art, so they are sized and
     placed in art pixels at any window size.
     One gsap.ticker loop, time-based, transform and opacity only. It does no
     work while the welcome is hidden. Reduced motion: a few flakes stand
     still in the sky. */
  var ART_W = 1672, ART_H = 941;
  var STILL = [                 /* where flakes stand under reduced motion,
                                   and where five of them start (art px)      */
    { x: 250, y: 120, d: 52 }, { x: 1400, y: 150, d: 50 }, { x: 640, y: 70, d: 44 },
    { x: 1500, y: 470, d: 62 }, { x: 120, y: 520, d: 46 }
  ];
  var EXTRA_FLAKES = 6;         /* more flakes, spread about the sky         */
  var SPECKS = 18;              /* small soft dots, further away             */

  /* The flake: six thick arms, each with one V of branches. */
  var FLAKE6_D = (function () {
    var d = '';
    for (var k = 0; k < 6; k++) {
      var a = k * Math.PI / 3;
      var ax = Math.cos(a), ay = Math.sin(a);
      d += 'M0 0 L' + (ax * 42).toFixed(1) + ' ' + (ay * 42).toFixed(1) + ' ';
      var bx = ax * 22, by = ay * 22;
      [-1, 1].forEach(function (side) {
        var b = a + side * 0.9;
        d += 'M' + bx.toFixed(1) + ' ' + by.toFixed(1) + ' L' +
             (bx + Math.cos(b) * 15).toFixed(1) + ' ' + (by + Math.sin(b) * 15).toFixed(1) + ' ';
      });
    }
    return d.trim();
  })();

  function flake6Svg() {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '-50 -50 100 100');
    s.setAttribute('class', 'wflake');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', FLAKE6_D);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '10');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }

  function welcomeSnow(host, welcome) {
    if (!host) return;
    welcome = welcome || host.parentNode;
    var calm = !gsap || reduced();
    var flakes = [];
    var box = { w: ART_W, h: ART_H, k: 1 };   /* the art's on-screen size    */

    /* The flakes' box sits exactly over the art as `cover` fits it. */
    function fit() {
      var vw = welcome.clientWidth || global.innerWidth;
      var vh = welcome.clientHeight || global.innerHeight;
      var k = Math.max(vw / ART_W, vh / ART_H);
      box.w = ART_W * k; box.h = ART_H * k; box.k = k;
      host.style.width = box.w + 'px';
      host.style.height = box.h + 'px';
      host.style.left = (vw - box.w) / 2 + 'px';
      host.style.top = (vh - box.h) / 2 + 'px';
      flakes.forEach(function (f) {
        var px = f.d * k;
        f.el.style.width = px + 'px';
        f.el.style.height = px + 'px';
        place(f);
      });
    }
    function place(f) {
      var k = box.k, px = f.d * k;
      var sway = f.amp * Math.sin(f.phase);
      f.el.style.transform = 'translate(' + ((f.x + sway) * k - px / 2).toFixed(1) + 'px,' +
        (f.y * k - px / 2).toFixed(1) + 'px) rotate(' + f.rot.toFixed(1) + 'deg)';
    }

    function make(kind, x, y, d) {
      var el;
      if (kind === 'speck') { el = document.createElement('i'); el.className = 'wflake wflake--speck'; }
      else el = flake6Svg();
      host.appendChild(el);
      var depth = kind === 'speck' ? 0.45 + Math.random() * 0.3 : Math.min(1, d / 66);
      var f = {
        el: el, kind: kind, x: x, y: y, d: d,
        vy: (22 + Math.random() * 14) * depth,         /* art px per second   */
        amp: 10 + Math.random() * 22,                  /* sway, art px        */
        phase: Math.random() * Math.PI * 2,
        vphase: 0.35 + Math.random() * 0.4,            /* sway, rad per second*/
        rot: Math.random() * 60,
        vr: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 14)
      };
      el.style.opacity = kind === 'speck' ? (0.45 + Math.random() * 0.4).toFixed(2) : '0.96';
      flakes.push(f);
      return f;
    }

    STILL.forEach(function (p) { make('flake', p.x, p.y, p.d); });
    if (!calm) {
      for (var i = 0; i < EXTRA_FLAKES; i++) {
        make('flake', Math.random() * ART_W, Math.random() * ART_H, 30 + Math.random() * 30);
      }
      for (var j = 0; j < SPECKS; j++) {
        make('speck', Math.random() * ART_W, Math.random() * ART_H, 7 + Math.random() * 9);
      }
    }
    fit();
    global.addEventListener('resize', fit);
    if (calm) return;

    /* Back in from the top, somewhere new, once a flake has left the bottom. */
    function respawn(f) {
      f.y = -f.d;
      f.x = Math.random() * ART_W;
      f.phase = Math.random() * Math.PI * 2;
    }
    gsap.ticker.add(function (time, deltaMs) {
      if (welcome.hidden) return;
      var dt = Math.min(deltaMs, 100) / 1000;    /* a hidden tab does not leap */
      for (var n = 0; n < flakes.length; n++) {
        var f = flakes[n];
        f.y += f.vy * dt;
        f.phase += f.vphase * dt;
        f.rot += f.vr * dt;
        if (f.y - f.d > ART_H) respawn(f);
        place(f);
      }
    });
  }

  global.Scenery = { snowfall: snowfall, welcomeSnow: welcomeSnow, flakeSvg: flakeSvg, FLAKE_D: FLAKE_D };
})(window);
