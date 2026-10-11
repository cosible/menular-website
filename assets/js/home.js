/* Home page behavior: the logo intro, the "See How It Works" link, the
   screenshot spotlight, and the full-screen screenshot viewer. The inline script in index.html's head decides
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

  /* Sets up the strip and returns what the viewer needs from it. */
  function initSpotlight() {
    var section = document.querySelector('.how');
    var strip = section && section.querySelector('.spot-strip');

    if (!strip) {
      return null;
    }

    var head = section.querySelector('.how-head');
    var slots = Array.prototype.slice.call(strip.children);
    var cards = slots.map(function (slot) {
      return slot.querySelector('.spot-card');
    });
    var dots = Array.prototype.slice.call(section.querySelectorAll('.spot-dot'));
    var last = slots.length - 1;
    var active = -1;
    var target = null;
    var pending = false;
    var settleTimer = null;
    var ignoreFocus = false;
    var stripWidth = 0;
    var cardWidth = 0;

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

    function clamp(i) {
      return Math.max(0, Math.min(last, i));
    }

    function go(i) {
      i = clamp(i);
      target = i;
      strip.scrollTo({ left: centerLeft(i), behavior: scrollBehavior });
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

    /* Card size follows the stacked heading's height (see .how in the CSS).
       When the card or strip size changes, keep the same card centered. */
    function measure() {
      if (head) {
        section.style.setProperty('--how-head-h', head.getBoundingClientRect().height + 'px');
      }
      var w = strip.clientWidth;
      var c = slots[0].offsetWidth;
      if (w !== stripWidth || c !== cardWidth) {
        stripWidth = w;
        cardWidth = c;
        if (active >= 0) {
          strip.scrollLeft = centerLeft(target !== null ? target : active);
        }
      }
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(measure).observe(head || strip);
    } else if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }
    window.addEventListener('resize', function () {
      measure();
      requestUpdate();
    });
    measure();

    strip.addEventListener('scroll', function () {
      requestUpdate();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(function () {
        target = null;
      }, 150);
    }, { passive: true });

    /* Left and Right move one card each (stepping from where a scroll in
       progress is heading, so repeated presses do not repeat a card) and
       carry keyboard focus along. */
    strip.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }
      e.preventDefault();
      var i = clamp((target !== null ? target : active) + (e.key === 'ArrowLeft' ? -1 : 1));
      go(i);
      if (strip.contains(document.activeElement) && document.activeElement !== strip) {
        ignoreFocus = true;
        cards[i].focus({ preventScroll: true });
        ignoreFocus = false;
      }
    });

    /* Tabbing to a card brings it to the center. */
    cards.forEach(function (card, k) {
      card.addEventListener('focus', function () {
        var keyboard = true;
        try {
          keyboard = card.matches(':focus-visible');
        } catch (err) {}
        if (!ignoreFocus && keyboard && k !== active) {
          go(k);
        }
      });
    });

    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () {
        go(k);
      });
    });

    section.classList.add('is-ready');
    update();
    initEntrance(section, strip, slots);

    return {
      strip: strip,
      cards: cards,

      /* Centers card i with no scrolling or scaling animation, then focuses
         the given card without moving anything. */
      restore: function (i, focusCard) {
        strip.classList.add('is-instant');
        target = null;
        strip.scrollTo({ left: centerLeft(i), behavior: 'auto' });
        setActive(i);
        void strip.offsetWidth;
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            strip.classList.remove('is-instant');
          });
        });
        if (focusCard) {
          ignoreFocus = true;
          focusCard.focus({ preventScroll: true });
          ignoreFocus = false;
        }
      }
    };
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

  /* ---------- Full-screen viewer ---------- */

  var VIEWER_FADE_MS = 200;
  var ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/></svg>';
  var ICON_PREV = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_NEXT = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Tapping a card opens its screenshot full screen. Swipe or use the arrows
     to move between screenshots; the X, Escape, the dark backdrop, and the
     browser's Back button all close it. */
  function initViewer(spot) {
    if (!spot) {
      return;
    }

    var cards = spot.cards;
    var thumbs = cards.map(function (card) {
      return card.querySelector('img');
    });
    var last = cards.length - 1;
    var isOpen = false;
    var current = 0;
    var target = null;
    var pending = false;
    var settleTimer = null;
    var hideTimer = null;
    var origin = null;
    var savedY = 0;
    var pushed = false;
    var inerted = [];

    /* There is no larger copy of the screenshots yet, so the viewer shows the
       750px images the carousel uses. */
    function fullSource(thumb) {
      return thumb.getAttribute('src');
    }

    /* The first sentence of the alt text is the screenshot's caption. */
    function headline(thumb) {
      return (thumb.getAttribute('alt') || '').split('. ')[0].replace(/\.$/, '');
    }

    /* ----- Build the dialog ----- */

    var viewer = document.createElement('div');
    viewer.className = 'viewer';
    viewer.hidden = true;
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'App screenshots');
    viewer.innerHTML =
      '<div class="viewer-track"></div>' +
      '<button type="button" class="viewer-close" aria-label="Close">' + ICON_CLOSE + '</button>' +
      '<p class="viewer-count" aria-live="polite"></p>' +
      '<button type="button" class="viewer-arrow viewer-prev" aria-label="Previous screenshot">' + ICON_PREV + '</button>' +
      '<button type="button" class="viewer-arrow viewer-next" aria-label="Next screenshot">' + ICON_NEXT + '</button>';

    var track = viewer.querySelector('.viewer-track');
    var closeButton = viewer.querySelector('.viewer-close');
    var counter = viewer.querySelector('.viewer-count');
    var prevButton = viewer.querySelector('.viewer-prev');
    var nextButton = viewer.querySelector('.viewer-next');

    var images = thumbs.map(function (thumb) {
      var slide = document.createElement('div');
      slide.className = 'viewer-slide';
      var img = document.createElement('img');
      img.className = 'viewer-img';
      img.alt = thumb.getAttribute('alt') || '';
      img.decoding = 'async';
      img.draggable = false;
      slide.appendChild(img);
      track.appendChild(slide);
      return img;
    });

    document.body.appendChild(viewer);

    /* ----- Cards become buttons ----- */

    cards.forEach(function (card, k) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'View full screen: ' + headline(thumbs[k]));
      card.addEventListener('click', function () {
        open(k, card);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(k, card);
        }
      });
    });

    /* The cards are now the keyboard stops, so the strip itself is not one. */
    spot.strip.removeAttribute('tabindex');

    /* ----- Images: the current one first, then its neighbors ----- */

    function ensure(k) {
      if (k >= 0 && k <= last && !images[k].getAttribute('src')) {
        images[k].src = fullSource(thumbs[k]);
      }
    }

    function load(i) {
      var img = images[i];
      ensure(i);
      function neighbors() {
        ensure(i - 1);
        ensure(i + 1);
      }
      if (img.complete) {
        neighbors();
      } else {
        img.addEventListener('load', neighbors, { once: true });
        img.addEventListener('error', neighbors, { once: true });
      }
    }

    /* ----- Position ----- */

    function slideWidth() {
      return track.clientWidth || 1;
    }

    function clamp(i) {
      return Math.max(0, Math.min(last, i));
    }

    function show(i) {
      current = i;
      counter.textContent = (i + 1) + ' / ' + cards.length;
      prevButton.disabled = i === 0;
      nextButton.disabled = i === last;
      /* Never leave focus on an arrow that just became disabled. */
      if (document.activeElement === prevButton && prevButton.disabled) {
        nextButton.focus();
      } else if (document.activeElement === nextButton && nextButton.disabled) {
        prevButton.focus();
      }
      load(i);
    }

    function go(i) {
      i = clamp(i);
      target = i;
      track.scrollTo({ left: i * slideWidth(), behavior: scrollBehavior });
    }

    function step(direction) {
      go((target !== null ? target : current) + direction);
    }

    track.addEventListener('scroll', function () {
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(function () {
          pending = false;
          var i = clamp(Math.round(track.scrollLeft / slideWidth()));
          if (isOpen && i !== current) {
            show(i);
          }
        });
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(function () {
        target = null;
      }, 150);
    }, { passive: true });

    /* Rotating the phone keeps the same screenshot in view. */
    window.addEventListener('resize', function () {
      if (isOpen) {
        track.scrollLeft = current * slideWidth();
      }
    });

    prevButton.addEventListener('click', function () {
      step(-1);
    });
    nextButton.addEventListener('click', function () {
      step(1);
    });
    closeButton.addEventListener('click', requestClose);

    /* The backdrop closes the viewer; the screenshot itself does nothing.
       The image box fills the slide, so check where the picture is drawn. */
    track.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('.viewer-img') : null;
      if (img) {
        var r = img.getBoundingClientRect();
        var nw = img.naturalWidth || 750;
        var nh = img.naturalHeight || 1630;
        var scale = Math.min(r.width / nw, r.height / nh);
        var w = nw * scale;
        var h = nh * scale;
        var x = r.left + (r.width - w) / 2;
        var y = r.top + (r.height - h) / 2;
        if (e.clientX >= x && e.clientX <= x + w && e.clientY >= y && e.clientY <= y + h) {
          return;
        }
      }
      requestClose();
    });

    /* ----- Keyboard ----- */

    function focusables() {
      return [closeButton, prevButton, nextButton].filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'Tab') {
        var list = focusables();
        var first = list[0];
        var end = list[list.length - 1];
        var inside = viewer.contains(document.activeElement);
        if (e.shiftKey && (!inside || document.activeElement === first)) {
          e.preventDefault();
          end.focus();
        } else if (!e.shiftKey && (!inside || document.activeElement === end)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    /* ----- Page behind the viewer ----- */

    function lockPage() {
      savedY = window.pageYOffset;
      document.body.style.top = -savedY + 'px';
      root.classList.add('viewer-lock');

      inerted = Array.prototype.filter.call(document.body.children, function (el) {
        return el !== viewer && !el.inert && el.tagName !== 'SCRIPT';
      });
      inerted.forEach(function (el) {
        el.inert = true;
      });
    }

    function unlockPage() {
      inerted.forEach(function (el) {
        el.inert = false;
      });
      inerted = [];

      root.classList.remove('viewer-lock');
      document.body.style.top = '';
      window.scrollTo(0, savedY);
    }

    /* ----- Open and close ----- */

    function open(i, card) {
      if (isOpen) {
        return;
      }
      isOpen = true;
      origin = card;
      target = null;
      window.clearTimeout(hideTimer);

      /* Back closes the viewer instead of leaving the page. The entry is added
         before the page is locked, so the browser remembers the real scroll
         position and returns to it on Back. */
      if (window.history && history.pushState) {
        history.pushState({ menularViewer: true }, '');
        pushed = true;
      }

      lockPage();
      viewer.hidden = false;
      track.scrollLeft = i * slideWidth();
      show(i);
      void viewer.offsetWidth;
      viewer.classList.add('is-open');
      closeButton.focus({ preventScroll: true });
      document.addEventListener('keydown', onKeydown);
    }

    /* Closing through history keeps it clean: every open adds one entry and
       every close removes it. */
    function requestClose() {
      if (!isOpen) {
        return;
      }
      if (pushed) {
        history.back();
      } else {
        close();
      }
    }

    function close() {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      pushed = false;
      document.removeEventListener('keydown', onKeydown);

      unlockPage();
      spot.restore(current, origin);
      origin = null;

      viewer.classList.remove('is-open');
      if (reduceMotion) {
        viewer.hidden = true;
      } else {
        hideTimer = window.setTimeout(function () {
          viewer.hidden = true;
        }, VIEWER_FADE_MS);
      }
    }

    window.addEventListener('popstate', function () {
      if (isOpen) {
        pushed = false;
        close();
      }
    });

    /* A reload while the viewer was open leaves its history entry behind;
       clear the marker so it is treated as the plain page. */
    if (history.state && history.state.menularViewer) {
      history.replaceState(null, '');
    }
  }

  initIntro();
  initSeeHow();
  initViewer(initSpotlight());
})();
