/* Home page flag wall: a faded wall of flags behind the opening, like the
   last frame of the launch video. Decorative only: the wall is aria-hidden,
   ignores the pointer, and every flag has empty alt text. This script fills
   the grid that index.html provides; the CSS there sizes and fades it.
   Flags are the 4x3 SVGs from flag-icons (MIT), copied to /assets/flags/. */
(function () {
  'use strict';

  var root = document.documentElement;
  var wall = document.querySelector('.flag-wall');
  var grid = wall && wall.querySelector('.flag-wall-grid');

  if (!grid) {
    return;
  }

  /* Row by row for the 12-column desktop layout. Narrower layouts keep this
     order for every flag except the pinned ones. Taller heroes than these
     rows cover start again from the top, skipping the pinned flags. */
  var FLAGS = (
    'uy cn gb gr kr nz cr es no kh tr my ' +
    'ug kz sn co do cz jp na ge tw mx tz ' +
    'ua ng in eg tn it bg lk rw ma ie mt ' +
    'at sk ph lt mu np fi al la id bo cm ' +
    'cy mn au is gt ec pe bt bd th ke dk ' +
    'se us uz de et om gh qa fr za cl hu ' +
    'ro rs ch sg jm be ci vn ca br nl jo ' +
    'sv me ar si mv py hr ee pa ae pt fj'
  ).split(' ');

  /* Friends' flags: always in the first two rows, in this order. */
  var PINNED = ['cn', 'kr', 'es', 'tr', 'kz', 'co', 'tw'];

  /* Where the pinned flags sit at each column count, as the 0-based columns
     used in row 1 and in row 2. They are filled in reading order. At 12
     columns this is exactly where FLAGS already puts them. At 5 columns only
     six cells in the first two rows are off the edge columns, so the seventh
     pinned flag has to sit at the end of row 2. */
  var PINNED_SLOTS = {
    5: [[1, 2, 3], [1, 2, 3, 4]],
    8: [[1, 3, 5, 6], [2, 4, 6]],
    10: [[1, 3, 6, 8], [2, 5, 7]],
    12: [[1, 4, 7, 10], [1, 3, 9]]
  };

  var OTHERS = FLAGS.filter(function (code) {
    return PINNED.indexOf(code) === -1;
  });

  /* Wait this long at most for the logo animation's files before building. */
  var INTRO_WAIT_MS = 4000;
  var RESIZE_DEBOUNCE_MS = 150;

  /* FLAG_WALL_ANIMATE is the one switch for the fade-in on load. Set it to
     false to keep the static wall with nothing else changed. The fade only
     plays with the logo intro: never with reduced motion, never when the
     intro is skipped or falls back, and never after a resize rebuild. */
  var FLAG_WALL_ANIMATE = true;

  /* Each flag fades in over FADE_MS (ease-out), starting in random order
     when the logo animation starts. Slow version: the wall keeps filling in
     after the rest of the hero has settled. From the logo's start, the logo
     runs about 2.47 s (74 frames at 29.97 fps), the tagline has risen in by
     about 3.4 s, and the button and badges by about 3.9 s; the last flag
     lands at 5 s. Opacity only, no movement. */
  var FADE_MS = 1200;
  var FADE_TOTAL_MS = 5000;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fadeActive = false;
  var fadeTimer = null;

  var cols = 0;
  var rows = 0;

  function columnsFor(width) {
    if (width < 600) {
      return 5;
    }
    if (width < 1024) {
      return 8;
    }
    if (width < 1280) {
      return 10;
    }
    return 12;
  }

  /* The flag codes for the first `count` cells at a column count. The result
     for a smaller count is always a prefix of the result for a larger one,
     so rows can be added or removed at the end without a rebuild. */
  function codesFor(columns, count) {
    var codes = new Array(count);
    var next = 0;

    PINNED_SLOTS[columns].forEach(function (slotCols, row) {
      slotCols.forEach(function (col) {
        codes[row * columns + col] = PINNED[next++];
      });
    });

    next = 0;
    for (var i = 0; i < count; i++) {
      if (!codes[i]) {
        codes[i] = OTHERS[next++ % OTHERS.length];
      }
    }
    return codes;
  }

  function makeFlag(code) {
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.setAttribute('fetchpriority', 'low');
    img.src = '/assets/flags/' + code + '.svg';
    return img;
  }

  /* Columns come from the width. Rows are as many as fill the height with
     cells closest to 4:3, and never fewer than the two that hold the pinned
     flags. */
  function measure() {
    var width = wall.clientWidth;
    var height = wall.clientHeight;
    var columns = columnsFor(width);
    var gap = parseFloat(window.getComputedStyle(grid).rowGap) || 0;
    var cellHeight = (width - gap * (columns + 1)) / columns * 3 / 4;
    var rowCount = Math.round((height - gap) / (cellHeight + gap));

    return { cols: columns, rows: Math.max(2, rowCount || 0) };
  }

  /* Rebuilds the wall when the column count changes, and only adds or
     removes whole rows at the end when just the row count does. */
  function layout() {
    var next = measure();

    if (next.cols === cols && next.rows === rows) {
      return;
    }

    /* After the first build, any change shows every flag at full strength. */
    if (cols) {
      stopFade();
    }

    if (next.cols !== cols) {
      grid.textContent = '';
    }

    var codes = codesFor(next.cols, next.cols * next.rows);
    var fragment = document.createDocumentFragment();

    while (grid.children.length > codes.length) {
      grid.removeChild(grid.lastChild);
    }
    for (var i = grid.children.length; i < codes.length; i++) {
      fragment.appendChild(makeFlag(codes[i]));
    }
    grid.appendChild(fragment);

    grid.style.setProperty('--fw-cols', next.cols);
    grid.style.setProperty('--fw-rows', next.rows);
    cols = next.cols;
    rows = next.rows;
  }

  /* ---------- Fade-in on load ---------- */

  /* Ends the fade, or cancels it before it starts: every flag shows at full
     strength (the wall itself stays at its 10%). */
  function stopFade() {
    if (!fadeActive) {
      return;
    }
    fadeActive = false;
    window.clearTimeout(fadeTimer);
    wall.classList.remove('is-fade-pending');
    Array.prototype.forEach.call(grid.children, function (img) {
      img.style.transition = '';
    });
  }

  function fadeIn() {
    var flags = Array.prototype.slice.call(grid.children);
    var ranks = flags.map(function (flag, i) {
      return i;
    });
    var spread = FADE_TOTAL_MS - FADE_MS;
    var last = Math.max(1, flags.length - 1);

    /* Random order, start times spread evenly across the spread. */
    for (var i = ranks.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = ranks[i];
      ranks[i] = ranks[j];
      ranks[j] = swap;
    }

    flags.forEach(function (img, k) {
      img.style.transition = 'opacity ' + FADE_MS + 'ms ease-out ' + Math.round(ranks[k] / last * spread) + 'ms';
    });

    /* Commit the hidden state with the transitions in place, then let go. */
    void grid.offsetWidth;
    wall.classList.remove('is-fade-pending');
    fadeTimer = window.setTimeout(stopFade, FADE_TOTAL_MS + 100);
  }

  /* The flags wait hidden until the logo animation starts playing (home.js
     sets intro.started right before it plays). If the intro falls back to
     the static logo instead, so does the wall. */
  function watchIntro() {
    (function check() {
      if (!fadeActive) {
        return;
      }
      if (intro.started) {
        fadeIn();
        return;
      }
      if (!root.classList.contains('intro')) {
        stopFade();
        return;
      }
      window.requestAnimationFrame(check);
    })();
  }

  /* ---------- Start ---------- */

  function start() {
    var timer = null;

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(layout, RESIZE_DEBOUNCE_MS);
    }

    if (FLAG_WALL_ANIMATE && !reduceMotion && intro && root.classList.contains('intro')) {
      fadeActive = true;
      wall.classList.add('is-fade-pending');
    }

    layout();

    if (fadeActive) {
      watchIntro();
    }

    if (window.ResizeObserver) {
      new window.ResizeObserver(schedule).observe(wall);
    } else {
      window.addEventListener('resize', schedule);
    }
  }

  /* So the flags never compete with the logo animation for bandwidth, wait
     until its player and data have arrived (the head script fetches them)
     before requesting any flags. */
  var intro = window.menularIntro;

  if (root.classList.contains('intro') && intro && intro.data && intro.lib) {
    var started = false;
    var once = function () {
      if (!started) {
        started = true;
        start();
      }
    };
    Promise.all([intro.data, intro.lib]).then(once, once);
    window.setTimeout(once, INTRO_WAIT_MS);
  } else {
    start();
  }
})();
