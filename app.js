/* ============================================================
   Presidents in Time — grid application
   Vanilla JS. Loads presidents.json at runtime; no inline data.
   ============================================================ */
(function () {
  'use strict';

  // Rows are aligned to INAUGURATION years (…1729, 1733, 1737… ≡ 1 mod 4), so each
  // row is a single term slot [y, y+4). The 1729 row exists so Washington's 1732
  // birth is covered by the first row's window.
  const GRID_START = 1729;
  const STEP = 4;
  const CURRENT_YEAR = new Date().getFullYear();

  // last inauguration-aligned row <= current year
  const GRID_END = GRID_START + Math.floor((CURRENT_YEAR - GRID_START) / STEP) * STEP;

  const YEARS = [];
  for (let y = GRID_START; y <= GRID_END; y += STEP) YEARS.push(y);

  const els = {
    scroll: document.getElementById('grid-scroll'),
    grid: document.getElementById('grid'),
    popover: document.getElementById('popover'),
    filterBtn: document.getElementById('filter-btn'),
    filterCount: document.getElementById('filter-count'),
    filterPanel: document.getElementById('filter-panel'),
    filterSearch: document.getElementById('filter-search'),
    filterList: document.getElementById('filter-list'),
    enableAll: document.getElementById('enable-all'),
    disableAll: document.getElementById('disable-all'),
  };

  let PRES = [];
  let hidden = new Set();        // disabled president ids
  let imgObserver = null;

  /* ---------- helpers ---------- */

  // Does a president ring the term slot [y, y+STEP)?
  // Half-open [termStart, termEnd): the slot that BEGINS at a president's termEnd
  // belongs to their successor, so a two-term president (e.g. Grant 1869-1877)
  // rings exactly two rows, not three. Presidents who died or resigned in office
  // keep the slot they were (re)inaugurated into even when it starts in their final
  // year — so Harrison & Tyler both ring 1841, and Lincoln (2) and FDR (4) are not
  // undercounted — while the successor rings that same slot too.
  function inTerm(p, y) {
    const end = y + STEP;
    if (p.diedInOffice) return p.termStart < end && p.termEnd >= y;
    return p.termStart < end && p.termEnd > y;
  }
  // Window-based birth: a president appears once their birth year falls within the
  // row's 4-year window (so 1732 shows in the 1729 row). Death is point-based so a
  // president stays present through the window in which they died.
  function notYetBorn(p, y) { return p.birthYear >= y + STEP; }
  function deceased(p, y) { return p.deathYear !== null && p.deathYear < y; }

  // Self-contained cream NAME card for any cell without a real portrait.
  // Kept independent of defaultPortraitUrl so that field can hold the real
  // popover portrait without turning placeholder cells into faded photos.
  function namePlaceholder(name) {
    return 'https://placehold.co/300x300/e9e3d4/736a5b?text=' +
           encodeURIComponent(name) + '&font=playfair-display';
  }

  // Resolve a portrait path. Bare relative paths (e.g. "01-washington-default.jpg")
  // are assumed to live under images/, so the JSON can omit that prefix. Absolute
  // URLs (http(s)://, //, data:) and empty strings are returned untouched.
  function resolveImg(url) {
    if (!url) return url;
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) return url;
    return url.replace(/^\.?\/*/, '').replace(/^images\//, '') // tolerate either form
              .replace(/^/, 'images/');
  }

  // Pick the portrait period to show in a given grid row [y, y+STEP).
  // Periods are authored as contiguous ranges, but term-boundary ranges don't always
  // line up with the 4-year rows — a president who dies or takes office mid-row shares
  // that row with their predecessor/successor. So we match by OVERLAP with the row
  // window, not a single point:
  //   • If any period overlaps [y, y+STEP), use the most recent (latest fromYear) one.
  //     This keeps "one term = one row" (1801–1805 rings only the 1801 row) while
  //     letting a successor's in-office portrait fill a partial first row (e.g. Fillmore
  //     in the 1849 row he enters in 1850).
  //   • Otherwise fall back to the latest period that has already begun — so a
  //     died-in-office president's final row past their last range still shows their
  //     portrait (e.g. Lincoln's 1849–1865 portrait in the 1865 row he rings), and
  //     never collapses to a blank/name-card cell.
  function portraitFor(p, y) {
    const end = y + STEP;
    let overlap = null, latestStarted = null, earliest = null;
    for (const pt of p.portraits) {
      if (!earliest || pt.fromYear < earliest.fromYear) earliest = pt;
      if (pt.fromYear < end && pt.toYear > y) {
        if (!overlap || pt.fromYear > overlap.fromYear) overlap = pt;
      }
      if (pt.fromYear <= y && (!latestStarted || pt.fromYear > latestStarted.fromYear)) {
        latestStarted = pt;
      }
    }
    return overlap || latestStarted || earliest;
  }

  /* ---------- URL state (filter) ---------- */

  function readHiddenFromURL() {
    const params = new URLSearchParams(location.search);
    const raw = params.get('hidden');
    hidden = new Set();
    if (raw) raw.split(',').forEach(s => { const n = parseInt(s, 10); if (n) hidden.add(n); });
  }
  function writeHiddenToURL() {
    const params = new URLSearchParams(location.search);
    if (hidden.size) params.set('hidden', [...hidden].sort((a, b) => a - b).join(','));
    else params.delete('hidden');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  /* ---------- column width (driven by longest displayName) ---------- */

  function computeColWidth() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = "500 13px 'Spectral', Georgia, serif";
    let max = 0;
    for (const p of PRES) max = Math.max(max, ctx.measureText(p.displayName).width);
    // text + horizontal breathing room, clamped to a tasteful tile size
    const w = Math.round(Math.max(72, Math.min(132, max + 26)));
    document.documentElement.style.setProperty('--col-w', w + 'px');
  }

  /* ---------- build grid ---------- */

  function buildGrid() {
    els.grid.innerHTML = '';

    // ---- year axis column ----
    const yearCol = document.createElement('div');
    yearCol.className = 'col col-years';

    const corner = document.createElement('div');
    corner.className = 'corner';
    corner.innerHTML = '<span>Year</span>';
    yearCol.appendChild(corner);

    for (const y of YEARS) {
      const yl = document.createElement('div');
      yl.className = 'year-label';
      yl.id = 'year-' + y;
      yl.innerHTML =
        '<span class="yr">' + y + '</span>' +
        '<button class="copy-link" title="Copy permalink to ' + y + '" aria-label="Copy link to ' + y + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
        '</button>';
      yl.querySelector('.copy-link').addEventListener('click', (e) => {
        e.stopPropagation();
        copyYearLink(y, e.currentTarget);
      });
      yearCol.appendChild(yl);
    }
    els.grid.appendChild(yearCol);

    // ---- president columns ----
    for (const p of PRES) {
      const col = document.createElement('div');
      col.className = 'col president';
      col.dataset.id = p.id;
      if (hidden.has(p.id)) col.classList.add('collapsed');

      const head = document.createElement('div');
      head.className = 'colhead';
      head.innerHTML =
        '<span class="term">#' + p.id + '</span>' +
        '<span class="name">' + p.displayName + '</span>';
      col.appendChild(head);

      for (const y of YEARS) {
        col.appendChild(buildCell(p, y));
      }
      els.grid.appendChild(col);
    }

    setupLazyLoad();
    updateFilterCount();
  }

  function buildCell(p, y) {
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (notYetBorn(p, y)) {
      cell.classList.add('empty', 'unborn');
      return cell;
    }
    if (deceased(p, y)) {
      cell.classList.add('empty', 'deceased');
      return cell;
    }

    // alive this row.
    // A cell renders a full-colour image ONLY when it points to a genuine photo.
    // Any placeholder (empty url, or a placehold.co stand-in) gets the unified
    // cream name-placeholder treatment, so all of a president's pre-photo cells match.
    const pt = portraitFor(p, y);
    const realImg = (pt && pt.url && !/placehold\.co/i.test(pt.url)) ? resolveImg(pt.url) : null;
    const src = realImg || namePlaceholder(p.displayName);

    const img = document.createElement('img');
    img.className = 'thumb' + (realImg ? '' : ' is-placeholder');
    img.alt = p.displayName + ', ' + y;
    img.loading = 'lazy';
    img.dataset.src = src;
    cell.appendChild(img);

    if (inTerm(p, y)) cell.classList.add('in-term');

    // hover popover — shows the portrait paired with THIS cell's period
    cell.addEventListener('mouseenter', () => showPopover(p, cell, y));
    cell.addEventListener('mouseleave', hidePopover);

    return cell;
  }

  /* ---------- lazy loading (Intersection Observer) ---------- */

  function setupLazyLoad() {
    if (imgObserver) imgObserver.disconnect();
    imgObserver = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.addEventListener('load', () => img.classList.add('loaded'));
          img.addEventListener('error', () => { img.classList.add('errored'); });
        }
        obs.unobserve(img);
      }
    }, { root: els.scroll, rootMargin: '700px 400px' });

    els.grid.querySelectorAll('img.thumb').forEach(img => imgObserver.observe(img));
  }

  /* ---------- popover ---------- */

  let popoverTimer = null;

  function showPopover(p, cell, y) {
    clearTimeout(popoverTimer);
    const po = els.popover;
    const inOffice = p.termStart + '–' + p.termEnd;
    const lifespan = p.deathYear === null
      ? '(born ' + p.birthYear + ') '
      : '(b. ' + p.birthYear + ' — d. ' + p.deathYear + ') ';

    // Per-period popover: hovering a cell shows the portrait paired with THAT
    // period's portraits[] entry (popoverUrl). Periods without their own
    // popoverUrl fall back to the president's defaultPortraitUrl.
    const pt = portraitFor(p, y);
    const periodPopover = (pt && pt.popoverUrl && !/placehold\.co/i.test(pt.popoverUrl))
      ? pt.popoverUrl : null;
    const portraitSrc = resolveImg(periodPopover || p.defaultPortraitUrl);

    // Credit follows the image being shown: the period's credit when it has its
    // own popover image, otherwise the default credit (only for a real default).
    let creditText = '';
    if (periodPopover) {
      creditText = pt.credit || '';
    } else if (p.defaultPortraitUrl && !/placehold\.co/i.test(p.defaultPortraitUrl)) {
      creditText = p.defaultPortraitCredit || '';
    }
    const creditHtml = creditText
      ? '<div class="po-credit">' + creditText + '</div>'
      : '';
    po.innerHTML =
      '<div class="po-portrait"><img src="' + portraitSrc + '" alt="' + p.fullName + '"></div>' +
      '<div class="po-body">' +
        '<div class="po-term">#' + p.id + '</div>' +
        '<div class="po-name">' + p.fullName + '</div>' +
        '<div class="po-meta">In office ' + inOffice + ' · ' + p.party + '</div>' +
        '<p class="po-summary"><span class="po-life">' + lifespan + '</span>' + p.summary + '</p>' +
        '<a class="po-wiki" href="' + p.wikipediaUrl + '" target="_blank" rel="noopener">Wikipedia ↗</a>' +
        creditHtml +
      '</div>';
    po.classList.add('visible');
    positionPopover(cell);
  }

  function positionPopover(cell) {
    const po = els.popover;
    const r = cell.getBoundingClientRect();
    const pw = po.offsetWidth, ph = po.offsetHeight;
    const margin = 12, vw = window.innerWidth, vh = window.innerHeight;

    // prefer right of cell; flip to left if it would clip
    let left = r.right + margin;
    if (left + pw > vw - margin) left = r.left - margin - pw;
    if (left < margin) left = Math.min(Math.max(margin, r.left), vw - pw - margin);

    // vertically center on cell, clamp to viewport
    let top = r.top + r.height / 2 - ph / 2;
    if (top < margin) top = margin;
    if (top + ph > vh - margin) top = vh - margin - ph;

    po.style.left = left + 'px';
    po.style.top = top + 'px';
  }

  function hidePopover() {
    popoverTimer = setTimeout(() => els.popover.classList.remove('visible'), 60);
  }
  // keep open while hovering the popover itself
  els.popover.addEventListener('mouseenter', () => clearTimeout(popoverTimer));
  els.popover.addEventListener('mouseleave', () => els.popover.classList.remove('visible'));

  /* ---------- year permalinks ---------- */

  function copyYearLink(y, btn) {
    const url = location.origin + location.pathname + location.search + '#year-' + y;
    const done = () => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
    } else {
      fallbackCopy(url, done);
    }
    history.replaceState(null, '', location.pathname + location.search + '#year-' + y);
  }
  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); cb && cb();
  }

  function scrollToHash() {
    const m = (location.hash || '').match(/^#year-(\d+)$/);
    if (!m) return;
    const target = document.getElementById('year-' + m[1]);
    if (!target) return;
    const top = target.offsetTop - els.scroll.clientHeight / 2 + target.offsetHeight / 2;
    els.scroll.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1400);
  }

  /* ---------- filter panel ---------- */

  function buildFilterList() {
    els.filterList.innerHTML = '';
    for (const p of PRES) {
      const row = document.createElement('label');
      row.className = 'filter-row';
      row.dataset.id = p.id;
      row.dataset.search = (p.displayName + ' ' + p.fullName + ' ' + p.party).toLowerCase();
      row.innerHTML =
        '<input type="checkbox" ' + (hidden.has(p.id) ? '' : 'checked') + '>' +
        '<span class="fr-term">#' + p.id + '</span>' +
        '<span class="fr-name">' + p.displayName + '</span>' +
        '<span class="fr-party">' + p.party + '</span>';
      row.querySelector('input').addEventListener('change', (e) => {
        setHidden(p.id, !e.target.checked);
      });
      els.filterList.appendChild(row);
    }
  }

  function setHidden(id, isHidden) {
    if (isHidden) hidden.add(id); else hidden.delete(id);
    const col = els.grid.querySelector('.col.president[data-id="' + id + '"]');
    if (col) col.classList.toggle('collapsed', isHidden);
    writeHiddenToURL();
    updateFilterCount();
  }

  function setAll(isHidden) {
    PRES.forEach(p => {
      if (isHidden) hidden.add(p.id); else hidden.delete(p.id);
    });
    els.grid.querySelectorAll('.col.president').forEach(c => c.classList.toggle('collapsed', isHidden));
    els.filterList.querySelectorAll('input').forEach(i => i.checked = !isHidden);
    writeHiddenToURL();
    updateFilterCount();
  }

  function updateFilterCount() {
    const shown = PRES.length - hidden.size;
    els.filterCount.textContent = shown === PRES.length
      ? 'All ' + PRES.length + ' presidents'
      : shown + ' of ' + PRES.length + ' shown';
  }

  function filterTypeahead() {
    const q = els.filterSearch.value.trim().toLowerCase();
    els.filterList.querySelectorAll('.filter-row').forEach(row => {
      row.style.display = (!q || row.dataset.search.includes(q)) ? '' : 'none';
    });
  }

  function wireFilterPanel() {
    els.filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = els.filterPanel.classList.toggle('open');
      els.filterBtn.classList.toggle('active', open);
      if (open) { els.filterSearch.value = ''; filterTypeahead(); els.filterSearch.focus(); }
    });
    els.filterPanel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => {
      els.filterPanel.classList.remove('open');
      els.filterBtn.classList.remove('active');
    });
    els.filterSearch.addEventListener('input', filterTypeahead);
    els.enableAll.addEventListener('click', () => setAll(false));
    els.disableAll.addEventListener('click', () => setAll(true));
  }

  /* ---------- init ---------- */

  fetch('presidents.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      PRES = data;
      readHiddenFromURL();
      computeColWidth();
      buildGrid();
      buildFilterList();
      wireFilterPanel();
      // defer hash scroll until layout settles
      requestAnimationFrame(() => requestAnimationFrame(scrollToHash));
      window.addEventListener('hashchange', scrollToHash);
    })
    .catch(err => {
      els.grid.innerHTML = '<div class="load-error">Could not load president data.<br><small>' +
        err.message + '</small></div>';
    });
})();
