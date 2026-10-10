/* Home page behavior: the logo intro and the screenshot gallery arrows.
   The inline script in index.html's head decides whether the intro plays
   (adds the "intro" class) and starts downloading the player and animation
   data early. Everything here degrades to the static page if it fails. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Logo intro ---------- */

  /* Matches the app's onboarding welcome screen. The tagline starts rising
     this long after the logo starts playing (the logo itself runs about
     2470ms), so the two overlap slightly, exactly as in the app. */
  var TAGLINE_START_MS = 1900;

  function initIntro() {
    var intro = window.menularIntro;
    var hero = document.querySelector('.hero');
    var holder = hero && hero.querySelector('.hero-logo-anim');
    var anim = null;
    var revealed = false;

    if (!intro || !holder || !root.classList.contains('intro')) {
      return;
    }

    function reveal() {
      if (revealed) {
        return;
      }
      revealed = true;
      hero.classList.add('is-revealed');
    }

    function fallBack() {
      if (anim) {
        anim.destroy();
        anim = null;
      }
      root.classList.remove('intro');
    }

    Promise.all([intro.data, intro.lib]).then(function (results) {
      if (!root.classList.contains('intro') || !window.lottie) {
        fallBack();
        return;
      }

      anim = window.lottie.loadAnimation({
        container: holder,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: results[0],
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });

      anim.addEventListener('data_failed', fallBack);
      anim.addEventListener('DOMLoaded', function () {
        /* The head script's timeout may have already shown the static logo. */
        if (!anim || !root.classList.contains('intro')) {
          fallBack();
          return;
        }
        intro.started = true;

        /* Driven by animation frames, not a wall clock, so the tagline stays
           in step with the logo even if the tab was in the background. */
        var revealFrame = (TAGLINE_START_MS / 1000) * anim.frameRate;
        anim.addEventListener('enterFrame', function (e) {
          if (e.currentTime >= revealFrame) {
            reveal();
          }
        });
        anim.addEventListener('complete', reveal);
        anim.play();
      });
    }).catch(fallBack);
  }

  /* ---------- Screenshot gallery arrows ---------- */

  function initGallery() {
    var gallery = document.querySelector('.gallery');
    var track = gallery && gallery.querySelector('.gallery-track');
    var prev = gallery && gallery.querySelector('.gallery-prev');
    var next = gallery && gallery.querySelector('.gallery-next');
    var pending = false;

    if (!track || !prev || !next) {
      return;
    }

    function update() {
      pending = false;
      var max = track.scrollWidth - track.clientWidth;
      var atStart = track.scrollLeft <= 2;
      var atEnd = track.scrollLeft >= max - 2;
      var focused = document.activeElement;

      /* Enable first, then move focus off a button that is about to be
         disabled, so keyboard users are not dropped back to the page. */
      if (!atStart) {
        prev.disabled = false;
      }
      if (!atEnd) {
        next.disabled = false;
      }
      if (atStart && focused === prev && !atEnd) {
        next.focus();
      } else if (atEnd && focused === next && !atStart) {
        prev.focus();
      }
      prev.disabled = atStart;
      next.disabled = atEnd;
    }

    function requestUpdate() {
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(update);
      }
    }

    /* Scroll by however many screenshots are fully visible, like the App Store. */
    function page(direction) {
      var items = track.children;
      if (items.length < 2) {
        return;
      }
      var step = items[1].offsetLeft - items[0].offsetLeft;
      var style = window.getComputedStyle(track);
      var inner = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      var gap = step - items[0].offsetWidth;
      var visible = Math.max(1, Math.floor((inner + gap + 1) / step));
      track.scrollBy({ left: direction * visible * step, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    track.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  initIntro();
  initGallery();
})();
