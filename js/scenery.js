/* ==========================================================================
 * scenery.js -- the snow
 * --------------------------------------------------------------------------
 * A few dozen flakes drifting down behind the whole lesson, and a ring of
 * snowflakes turning slowly round the welcome's title. Plain GSAP, not
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

  /* Snowflakes round the title: placed by hand, each turning at its own
     pace and bobbing a little. */
  var RING = [
    { x: 14, y: 16, s: 1.0 }, { x: 24, y: 42, s: 0.7 }, { x: 10, y: 60, s: 0.85 },
    { x: 82, y: 18, s: 0.9 }, { x: 88, y: 46, s: 0.7 }, { x: 76, y: 62, s: 1.1 },
    { x: 36, y: 10, s: 0.6 }, { x: 62, y: 8, s: 0.75 }, { x: 50, y: 66, s: 0.65 }
  ];
  function titleFlakes(host) {
    if (!host) return;
    RING.forEach(function (r, i) {
      var s = flakeSvg();
      s.style.left = r.x + '%';
      s.style.top = r.y + '%';
      s.style.transform = 'scale(' + r.s + ')';
      host.appendChild(s);
      if (!gsap || reduced()) return;
      gsap.to(s, { rotation: 360, duration: 18 + i * 3, ease: 'none', repeat: -1 });
      gsap.to(s, { y: -10 - (i % 3) * 4, duration: 2.2 + (i % 4) * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });
  }

  global.Scenery = { snowfall: snowfall, titleFlakes: titleFlakes, flakeSvg: flakeSvg, FLAKE_D: FLAKE_D };
})(window);
