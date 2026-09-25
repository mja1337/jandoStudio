/* Embedded by value into exported packs; no hosted dependencies at view time. */
function jandoReviewRuntime() {
  'use strict';
  const pack = JSON.parse(document.getElementById('review-pack-data').textContent);
  const $ = id => document.getElementById(id);
  let index = 0, zoom = 1;
  const storageKey = 'jandostudio.processPack.v1:' + JSON.stringify([pack.packId, pack.reviewRound]);
  const TIP_KEY = 'jandostudio.processPack.tip.v1';
  const SIDEBAR_KEY = 'jandostudio.processPack.sidebar.v1';
  const pageIndexById = new Map(pack.pages.map((p, i) => [p.pageId, i]));
  // outgoingPageIds: this page has a shape that links OUT to another process.
  // incomingPageIds: this page is the TARGET of a link from some other process.
  const outgoingPageIds = new Set();
  const incomingPageIds = new Set();
  pack.pages.forEach(p => {
    const targets = (p.renderedSvg.match(/data-link-page="[^"]+"/g) || []).map(m => m.slice(16, -1));
    if (targets.length) outgoingPageIds.add(p.pageId);
    targets.forEach(id => incomingPageIds.add(id));
  });
  const hasCrossLinks = outgoingPageIds.size > 0 || incomingPageIds.size > 0;
  const XREF_OUT_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2.5 7.5L7.5 2.5M7.5 2.5H3.5M7.5 2.5V6.5" stroke="#d97706" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const XREF_IN_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.5 2.5L2.5 7.5M2.5 7.5H6.5M2.5 7.5V3.5" stroke="#246bfd" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  $('rpTitle').textContent = pack.packName;
  $('rpSubtitle').textContent = pack.pages.length + ' process' + (pack.pages.length === 1 ? '' : 'es');

  const areas = [...new Set(pack.pages.map(p => p.area).filter(Boolean))].sort();
  areas.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; $('areaFilter').appendChild(o); });

  function renderList() {
    $('rpList').replaceChildren();
    const term = $('pageSearch').value.toLowerCase(), area = $('areaFilter').value;
    pack.pages.forEach((p, i) => {
      if (term && !p.pageName.toLowerCase().includes(term)) return;
      if (area && p.area !== area) return;
      const b = document.createElement('button'); b.type = 'button'; b.title = p.pageName;
      b.className = i === index ? 'active' : '';
      const idx = document.createElement('span'); idx.className = 'rp-row-index'; idx.textContent = (i + 1) + '.';
      const name = document.createElement('span'); name.className = 'rp-row-name'; name.textContent = p.pageName;
      b.append(idx, name);
      const isOut = outgoingPageIds.has(p.pageId), isIn = incomingPageIds.has(p.pageId);
      if (isOut || isIn) {
        const mark = document.createElement('span'); mark.className = 'rp-row-xref';
        mark.title = isOut && isIn ? 'Links to and from other processes' : isOut ? 'Links out to another process' : 'Referenced by another process';
        mark.innerHTML = (isOut ? XREF_OUT_ICON : '') + (isIn ? XREF_IN_ICON : '');
        b.appendChild(mark);
      }
      b.onclick = () => go(i);
      $('rpList').appendChild(b);
    });
  }
  function size() {
    const svgEl = $('rpSlide').querySelector('svg');
    if (svgEl) { svgEl.style.width = Number(svgEl.getAttribute('width')) * zoom + 'px'; svgEl.style.height = Number(svgEl.getAttribute('height')) * zoom + 'px'; }
    $('rpZoom').textContent = Math.round(zoom * 100) + '%';
  }
  function fit() {
    const p = pack.pages[index], doc = new DOMParser().parseFromString(p.renderedSvg, 'image/svg+xml').documentElement;
    zoom = Math.max(.05, Math.min(4, ($('rpCanvas').clientWidth - 48) / Number(doc.getAttribute('width'))));
    size();
  }
  // Zooms toward a fixed point in the viewport (offsetX/offsetY, relative to the canvas's own
  // box) instead of the scroll-top-left corner, so the thing under the cursor/center stays put
  // as the page scales. Captures the content-space point before resizing — reading scrollLeft
  // back out after size() runs isn't safe, since the browser can silently clamp it during reflow
  // when zooming out shrinks the scrollable area.
  function zoomAround(factor, offsetX, offsetY) {
    const canvas = $('rpCanvas'), prevZoom = zoom;
    zoom = Math.max(.05, Math.min(8, zoom * factor));
    if (zoom === prevZoom) return;
    const ratio = zoom / prevZoom;
    const cx = canvas.scrollLeft + offsetX, cy = canvas.scrollTop + offsetY;
    size();
    canvas.scrollLeft = cx * ratio - offsetX;
    canvas.scrollTop = cy * ratio - offsetY;
  }
  function zoomAroundCenter(factor) {
    const canvas = $('rpCanvas');
    zoomAround(factor, canvas.clientWidth / 2, canvas.clientHeight / 2);
  }
  function render() {
    const p = pack.pages[index];
    $('rpSlide').innerHTML = p.renderedSvg;
    $('rpCounter').textContent = 'Process ' + (index + 1) + ' of ' + pack.pages.length;
    $('rpPageMeta').textContent = p.pageName;
    $('rpFingerprint').textContent = 'Fingerprint ' + p.diagramFingerprint;
    $('rpPrev').disabled = index === 0; $('rpNext').disabled = index === pack.pages.length - 1;
    if (p.jiraLink) { $('rpJira').href = p.jiraLink; $('rpJira').hidden = false; } else { $('rpJira').hidden = true; }
    renderList(); fit(); $('rpCanvas').scrollTo(0, 0);
    try { localStorage.setItem(storageKey, JSON.stringify({ index })); } catch {}
  }
  let returnStack = [];
  function updateBackButton() {
    if (!returnStack.length) { $('rpBack').hidden = true; return; }
    const fromPage = pack.pages[returnStack[returnStack.length - 1]];
    const label = fromPage.pageName.replace(/^Operational Process\s*[-:]\s*/i, '');
    $('rpBack').hidden = false;
    $('rpBack').title = 'Back to ' + fromPage.pageName;
    $('rpBackLabel').textContent = 'Back to ' + label;
  }
  function go(i) {
    if (i < 0 || i >= pack.pages.length) return;
    if (returnStack.length && returnStack[returnStack.length - 1] === i) returnStack.pop();
    index = i;
    render();
    updateBackButton();
  }
  $('rpBack').onclick = () => { if (returnStack.length) go(returnStack.pop()); };

  $('rpPrev').onclick = () => go(index - 1);
  $('rpNext').onclick = () => go(index + 1);
  $('rpFit').onclick = fit;
  $('rpZoomIn').onclick = () => zoomAroundCenter(1.25);
  $('rpZoomOut').onclick = () => zoomAroundCenter(1 / 1.25);
  $('pageSearch').oninput = renderList;
  $('areaFilter').onchange = renderList;

  $('rpCanvas').addEventListener('wheel', e => {
    e.preventDefault();
    const rect = $('rpCanvas').getBoundingClientRect();
    zoomAround(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; fit(); });
  });

  let sidebarOpen = false;
  try { sidebarOpen = localStorage.getItem(SIDEBAR_KEY) === 'open'; } catch {}
  function applySidebar() {
    document.querySelector('.rp-main').classList.toggle('sidebar-open', sidebarOpen);
    $('rpSidebarToggle').setAttribute('aria-expanded', String(sidebarOpen));
  }
  $('rpSidebarToggle').onclick = () => {
    sidebarOpen = !sidebarOpen;
    applySidebar();
    try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? 'open' : 'closed'); } catch {}
    requestAnimationFrame(fit);
  };
  applySidebar();

  $('rpSlide').addEventListener('click', e => {
    const el = e.target.closest('[data-link-page]');
    if (!el) return;
    const i = pageIndexById.get(el.getAttribute('data-link-page'));
    if (i === undefined || i === index) return;
    returnStack.push(index);
    go(i);
  });

  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  }, true);

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Number.isInteger(saved.index) && saved.index >= 0 && saved.index < pack.pages.length) index = saved.index;
    }
  } catch {}

  render();
  updateBackButton();

  $('rpTipClose').onclick = () => { $('rpTip').hidden = true; try { localStorage.setItem(TIP_KEY, 'seen'); } catch {} };
  try {
    if (hasCrossLinks && localStorage.getItem(TIP_KEY) !== 'seen') $('rpTip').hidden = false;
  } catch { if (hasCrossLinks) $('rpTip').hidden = false; }
}
