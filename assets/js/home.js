/* Home page behavior: the logo intro, the "See How It Works" link, and the
   screenshot spotlight. The inline script in index.html's head decides
   whether the intro plays (adds the "intro" class) and starts downloading the
   player and animation data early. Everything here degrades to the static
   page if it fails. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scrollBehavior = reduceMotion ? 'auto' : 'smooth';

  /* ---------- Logo intro ---------- */

  /* When the logo finishes, the tagline rises in, then the button this much later. */
  var BUTTON_DELAY_MS = 500;

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
      window.setTimeout(function () {
        hero.classList.add('is-cta');
      }, BUTTON_DELAY_MS);
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
        anim.addEventListener('complete', reveal);
        anim.play();
      });
    }).catch(fallBack);
  }

  /* ---------- "See How It Works" ---------- */

  function initSeeHow() {
    var link = document.querySelector('.see-how');
    var target = document.getElementById('how-it-works');

    if (!link || !target) {
      return;
    }

    /* Without JavaScript the link still jumps to the section. */
    link.addEventListener('click', function (e) {
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    });
  }

  /* ---------- Screenshot spotlight ---------- */

  var ENTER_STAGGER_MS = 90;
  var ENTER_MS = 800;

  function initSpotlight() {
    var section = document.querySelector('.how');
    var strip = section && section.querySelector('.spot-strip');

    if (!strip) {
      return;
    }

    var slots = Array.prototype.slice.call(strip.children);
    var dots = Array.prototype.slice.call(section.querySelectorAll('.spot-dot'));
    var prev = section.querySelector('.spot-prev');
    var next = section.querySelector('.spot-next');
    var last = slots.length - 1;
    var active = -1;
    var target = null;
    var pending = false;
    var settleTimer = null;

    /* scrollLeft that puts card i in the middle of the strip. */
    function centerLeft(i) {
      var slot = slots[i];
      return slot.offsetLeft + slot.offsetWidth / 2 - strip.clientWidth / 2;
    }

    function nearest() {
      var mid = strip.scrollLeft + strip.clientWidth / 2;
      var best = 0;
      var bestDistance = Infinity;
      for (var i = 0; i <= last; i++) {
        var distance = Math.abs(slots[i].offsetLeft + slots[i].offsetWidth / 2 - mid);
        if (distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      }
      return best;
    }

    function go(i) {
      i = Math.max(0, Math.min(last, i));
      target = i;
      strip.scrollTo({ left: centerLeft(i), behavior: scrollBehavior });
    }

    /* Step from where a scroll in progress is heading, so repeated presses
       move one card each instead of repeating the same card. */
    function step(direction) {
      go((target !== null ? target : active) + direction);
    }

    function setActive(i) {
      if (i === active) {
        return;
      }
      active = i;

      slots.forEach(function (slot, k) {
        slot.classList.toggle('is-active', k === i);
      });
      dots.forEach(function (dot, k) {
        if (k === i) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });

      if (prev && next) {
        /* Enable first, then move focus off a button that is about to be
           disabled, so keyboard users are not dropped back to the page. */
        var focused = document.activeElement;
        if (i > 0) {
          prev.disabled = false;
        }
        if (i < last) {
          next.disabled = false;
        }
        if (i === 0 && focused === prev) {
          next.focus();
        } else if (i === last && focused === next) {
          prev.focus();
        }
        prev.disabled = i === 0;
        next.disabled = i === last;
      }
    }

    function update() {
      pending = false;
      setActive(nearest());
    }

    function requestUpdate() {
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(update);
      }
    }

    strip.addEventListener('scroll', function () {
      requestUpdate();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(function () {
        target = null;
      }, 150);
    }, { passive: true });
    window.addEventListener('resize', requestUpdate);

    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });

    slots.forEach(function (slot, k) {
      slot.addEventListener('click', function () {
        if (k !== active) {
          go(k);
        }
      });
    });

    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () {
        go(k);
      });
    });

    if (prev && next) {
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
    }

    section.classList.add('is-ready');
    update();
    initEntrance(section, strip, slots);
  }

  /* Cards slide in from the right, staggered, the first time the section's
     top reaches 70% of the viewport height. Skipped with reduced motion. */
  function initEntrance(section, strip, slots) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      return;
    }

    strip.classList.add('is-pre-enter');

    var observer = new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      /* Intersecting the top 70% of the viewport, or already scrolled past. */
      if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) {
        return;
      }
      observer.disconnect();

      slots.forEach(function (slot, k) {
        slot.style.transitionDelay = (k * ENTER_STAGGER_MS) + 'ms';
      });
      strip.classList.add('is-entering');
      strip.classList.remove('is-pre-enter');

      window.setTimeout(function () {
        strip.classList.remove('is-entering');
        slots.forEach(function (slot) {
          slot.style.transitionDelay = '';
        });
      }, (slots.length - 1) * ENTER_STAGGER_MS + ENTER_MS + 100);
    }, { rootMargin: '0px 0px -30% 0px' });

    observer.observe(section);
  }

  initIntro();
  initSeeHow();
  initSpotlight();
})();
