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

  /* Flags fade in one at a time, in a steady stream, measured from when the
     logo animation starts. The first starts at FIRST_START_MS, so the logo
     opens on an empty background, and the last at LAST_START_MS, with even
     intervals between. Each start time wobbles by up to JITTER of one
     interval either way, so the stream doesn't look mechanical (it never
     changes the order). Each flag fades over FADE_MS, ease-out, opacity only.
     For reference: the logo runs about 2.47 s (74 frames at 29.97 fps), the
     tagline has risen in by about 3.4 s, the button and badges by about
     3.9 s, and the last flag lands at about 5.1 s. */
  var FIRST_START_MS = 500;
  var LAST_START_MS = 4400;
  var FADE_MS = 700;
  var JITTER = 0.25;

  /* A flag never starts next to (diagonals included) any of the last
     NO_NEIGHBOR_RECENT flags that started. */
  var NO_NEIGHBOR_RECENT = 3;

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
     strength (the wall itself stays at its 5%). */
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

  /* True when cells a and b touch, diagonals included, at the current
     column count. */
  function touching(a, b) {
    return Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1 &&
      Math.abs(a % cols - b % cols) <= 1;
  }

  /* Cell indexes in the order they start: shuffled, then each time the first
     remaining cell that doesn't touch any of the last NO_NEIGHBOR_RECENT
     picks (or simply the first remaining one if none qualifies). That
     fallback happens on roughly a third of shuffles, almost always for the
     last flag or two, so a fresh shuffle is tried, up to ORDER_TRIES in
     all, until one needs no fallback. */
  var ORDER_TRIES = 20;

  function fadeOrder(count) {
    var order = null;

    for (var t = 0; t < ORDER_TRIES; t++) {
      order = tryOrder(count);
      if (!order.fellBack) {
        break;
      }
    }
    return order;
  }

  function tryOrder(count) {
    var remaining = [];
    var order = [];
    var i;

    for (i = 0; i < count; i++) {
      remaining.push(i);
    }
    for (i = remaining.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = remaining[i];
      remaining[i] = remaining[j];
      remaining[j] = swap;
    }

    while (remaining.length) {
      var recent = order.slice(-NO_NEIGHBOR_RECENT);
      var pick = -1;
      for (i = 0; i < remaining.length; i++) {
        if (!recent.some(touching.bind(null, remaining[i]))) {
          pick = i;
          break;
        }
      }
      if (pick === -1) {
        pick = 0;
        order.fellBack = true;
      }
      order.push(remaining.splice(pick, 1)[0]);
    }
    return order;
  }

  function fadeIn() {
    var flags = grid.children;
    var order = fadeOrder(flags.length);
    var interval = flags.length > 1 ? (LAST_START_MS - FIRST_START_MS) / (flags.length - 1) : 0;

    order.forEach(function (cell, k) {
      var wobble = (Math.random() * 2 - 1) * JITTER * interval;
      var delay = Math.max(0, Math.round(FIRST_START_MS + k * interval + wobble));
      flags[cell].style.transition = 'opacity ' + FADE_MS + 'ms ease-out ' + delay + 'ms';
    });

    /* Commit the hidden state with the transitions in place, then let go. */
    void grid.offsetWidth;
    wall.classList.remove('is-fade-pending');
    fadeTimer = window.setTimeout(stopFade, LAST_START_MS + JITTER * interval + FADE_MS + 100);
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
