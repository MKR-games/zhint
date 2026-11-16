(() => {
  'use strict';
  const records = Array.isArray(window.HINT_DATA) ? window.HINT_DATA : [];
  const THEME_ORDER = ['태화여고','중화만두','시크릿제트','삐에로','연애편지','캣츠앤도그','지하묘지','매직트레인','올림푸스의 초대'];
  const icons = {
    '태화여고': ['#8d82c4',['00011000','00111100','01111110','11111111','01122110','01122110','01100110','01111110']],
    '중화만두': ['#d08a70',['00000000','00111100','01122110','11222211','12222221','11222211','01111110','00000000']],
    '시크릿제트': ['#74b9a0',['00111100','00011000','00011000','00122100','01122110','01122110','01111110','00111100']],
    '삐에로': ['#db8fa7',['00100100','01111110','11211211','11111111','12111121','11122111','01111110','00100100']],
    '연애편지': ['#d8899b',['00000000','11111111','12211221','12122121','11211211','11122111','11111111','00000000']],
    '캣츠앤도그': ['#d6a15f',['01011010','11011011','01011010','00111100','01122110','11222211','01111110','00100100']],
    '지하묘지': ['#868a95',['00111100','01111110','11211211','11211211','11111111','01122110','00111100','00101000']],
    '매직트레인': ['#7c9dbb',['00111100','01122110','01122110','01111110','01111110','01111110','01011010','10000001']],
    '올림푸스의 초대': ['#d4ac54',['00011100','00111000','00110000','01111100','00011000','00110000','01100000','01000000']]
  };
  const els = {
    form: document.querySelector('#search-form'), query: document.querySelector('#query'), clear: document.querySelector('#clear-query'),
    grid: document.querySelector('#theme-grid'), all: document.querySelector('#all-themes'), recent: document.querySelector('#recent'),
    results: document.querySelector('#results'), resultSection: document.querySelector('#results-section'),
    themePanel:document.querySelector('.theme-panel'), submitLabel:document.querySelector('#submit-label'),
    submit:document.querySelector('.search-submit'), saveStatus:document.querySelector('#save-status')
  };
  const state = { theme: '전체', query: '', detail: null, showAll: false, admin:false, saving:false, draft:null, baseline:null, adminTheme:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase();
  const codeQuery = value => normalize(value).replace(/[\s-]/g, '').toUpperCase();
  const count = theme => records.filter(item => item.theme === theme).length;
  let occurrences = Object.create(null);
  function updateOccurrences() { occurrences = records.reduce((map, item) => { map[item.code] = (map[item.code] || 0) + 1; return map; }, Object.create(null)); }
  updateOccurrences();
  const indexOf = item => records.indexOf(item);
  const recentKey = 'z-hint-book-recent-v2';
  const recordKey = item => JSON.stringify([item.theme, item.code]);
  function pixelIcon(theme) {
    const [color, pixels] = icons[theme] || icons['태화여고'];
    let squares = '';
    pixels.forEach((line,y) => [...line].forEach((v,x) => { if(v !== '0') squares += `<rect x="${x}" y="${y}" width="1" height="1" fill="${v === '2' ? '#fffefa' : color}"/>`; }));
    return `<svg class="theme-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${squares}</svg>`;
  }
  function getRecent() {
    try {
      let stored = localStorage.getItem(recentKey);
      if (stored === null) {
        // Reconstruct the original 119-item positions, keeping the removed
        // eleventh 삐에로 item as an empty slot so later entries do not shift.
        const legacyRecords = records.filter(item => !(item.theme === '삐에로' && item.code === 'BOMINI') && !(item.theme === '매직트레인' && item.code === 'EUNGYO'))
          .slice().sort((a,b) => THEME_ORDER.indexOf(a.theme) - THEME_ORDER.indexOf(b.theme) || Number(a.order) - Number(b.order));
        const removedSlot = legacyRecords.findIndex(item => item.theme === '삐에로' && Number(item.order) > 11);
        legacyRecords.splice(removedSlot < 0 ? legacyRecords.length : removedSlot, 0, null);
        const legacy = JSON.parse(localStorage.getItem('z-hint-book-recent-v1') || '[]');
        const migrated = Array.isArray(legacy) ? legacy.filter(Number.isInteger).map(i => legacyRecords[i]).filter(Boolean).map(recordKey).slice(0,3) : [];
        stored = JSON.stringify(migrated);
        localStorage.setItem(recentKey, stored);
      }
      const saved = JSON.parse(stored);
      return Array.isArray(saved) ? saved.map(key => records.findIndex(item => recordKey(item) === key)).filter(i => i >= 0).slice(0,3) : [];
    } catch (_) { return []; }
  }
  function remember(index) {
    try { localStorage.setItem(recentKey, JSON.stringify([index, ...getRecent().filter(i => i !== index)].slice(0,3).map(i => recordKey(records[i])))); } catch (_) {}
    renderRecent();
  }
  function renderRecent() {
    if (state.admin) { els.recent.hidden = true; return; }
    const recent = getRecent();
    els.recent.hidden = recent.length === 0;
    els.recent.innerHTML = recent.length ? `<p class="recent-title">최근에 본 힌트</p><div class="recent-list">${recent.map(i => `<button type="button" class="recent-button" data-recent="${i}">${esc(records[i].theme)} · ${esc(records[i].code)}</button>`).join('')}</div>` : '';
  }
  function renderThemes() {
    els.all.setAttribute('aria-pressed', String(state.theme === '전체'));
    els.grid.innerHTML = THEME_ORDER.map(theme => `<button type="button" class="theme-tile" data-theme="${esc(theme)}" aria-pressed="${state.theme === theme}">${pixelIcon(theme)}<span class="theme-name">${esc(theme)}</span><span class="theme-count">${count(theme)} HINTS</span></button>`).join('');
  }
  function matches() {
    const q = normalize(state.query);
    const compact = codeQuery(state.query);
    const selected = records.filter(item => state.theme === '전체' || item.theme === state.theme);
    if (!q) return selected;
    return selected.filter(item => (compact && item.code.includes(compact)) || [item.title,item.theme,item.hint,item.answer].some(field => normalize(field).includes(q)))
      .sort((a,b) => Number(b.code === compact) - Number(a.code === compact));
  }
  function scrollResults() {
    if (window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => els.resultSection.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}));
  }
  function openDetail(index) {
    if (!records[index]) return;
    state.detail = index;
    remember(index);
    renderResults();
    scrollResults();
  }
  function card(item) {
    const duplicate = occurrences[item.code] > 1;
    return `<button type="button" class="hint-card" data-detail="${indexOf(item)}" aria-label="${esc(item.theme)} ${esc(item.title)} ${esc(item.code)} 열기"><span class="card-icon">${pixelIcon(item.theme)}</span><span class="card-main"><span class="card-meta"><span>${esc(item.theme)}</span>${duplicate ? '<span class="bar"></span><span>중복 코드</span>' : ''}</span><span class="card-title">${esc(item.title)}</span><span class="card-code">CODE <b>${esc(item.code)}</b></span></span><span class="card-arrow" aria-hidden="true">›</span></button>`;
  }
  function renderDetail(item) {
    const mask = item.theme === '중화만두' && item.code === 'L44TCG';
    const answer = item.answer;
    const image = mask ? '<a class="image-link" href="mask-order.png" target="_blank" rel="noopener noreferrer"><img class="answer-image" src="mask-order.png" alt="중화만두 가면 4개의 배치 정답 이미지"><span class="image-caption">이미지를 누르면 크게 볼 수 있어요 ↗</span></a>' : '';
    return `<article class="detail-shell"><div class="detail-top"><div class="detail-actions"><button class="back-button" type="button" data-back>← 검색 결과로</button><button class="new-search-link" type="button" data-new-search>다른 코드 찾기 ↑</button></div><div class="detail-chip-row"><span class="detail-tag">${pixelIcon(item.theme)} ${esc(item.theme)}</span><span class="detail-code">CODE ${esc(item.code)}</span></div><h2 class="detail-title" tabindex="-1">${esc(item.title)}</h2></div><div class="detail-body"><div class="detail-label"><span class="label-icon answer-icon" aria-hidden="true">✓</span> 정답 · 진행 방법</div><div class="answer-box"><p class="answer-text">${esc(answer)}</p>${image}</div><div class="detail-label"><span class="label-icon" aria-hidden="true">?</span> 힌트 내용 · 풀이</div><div class="hint-box"><p class="hint-text">${esc(item.hint)}</p></div><button class="detail-search-button" type="button" data-new-search>⌕ &nbsp;다른 코드 찾기</button><div class="detail-foot">${esc(item.theme)} <span aria-hidden="true">·</span> CODE ${esc(item.code)}</div></div></article>`;
  }
  function githubPreferences() {
    try { return JSON.parse(localStorage.getItem('z-hint-book-github-settings') || '{}'); }
    catch (_) { return {}; }
  }
  function adminList() {
    const list = document.querySelector('#admin-list');
    if (!list) return;
    const themed = state.draft.filter(item => item.theme === state.adminTheme);
    list.innerHTML = themed.map((item, index) => `<div class="admin-row"><span class="admin-row-text"><strong>${esc(item.title)}</strong><small>${esc(item.code)}</small></span><span class="admin-arrows"><button type="button" data-move="-1" data-position="${index}" aria-label="${esc(item.title)} 위로 이동" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-position="${index}" aria-label="${esc(item.title)} 아래로 이동" ${index === themed.length - 1 ? 'disabled' : ''}>↓</button></span></div>`).join('');
    document.querySelector('#admin-count').textContent = `${themed.length}개`;
  }
  function renderAdmin() {
    const saved = githubPreferences();
    const repository = window.HintSync.inferRepository(window.location) || saved.repository || '';
    const branch = saved.branch || 'main';
    const folder = saved.folder === 'docs/' ? 'docs/' : '';
    const siteNotice = location.hostname.endsWith('.chatgpt.site') ? '<p class="admin-site-note">이 주소는 기존 ChatGPT 사이트입니다. GitHub에 올린 사이트 주소에서 관리자 저장을 이용해 주세요.</p>' : '';
    els.results.innerHTML = `<section class="admin-shell"><div class="admin-head"><div><div class="section-kicker"><span class="pixel-mini"></span> ADMIN MODE</div><h2>힌트 순서 변경</h2><p>테마를 선택하고 화살표로 순서를 바꿔주세요.</p></div><button type="button" class="admin-cancel" data-admin-cancel>취소</button></div><div class="admin-content">${siteNotice}<div id="admin-message" class="admin-message" role="alert" hidden></div><div class="admin-theme-line"><label for="admin-theme">테마 선택</label><span id="admin-count"></span></div><select id="admin-theme" class="admin-field">${THEME_ORDER.map(t=>`<option value="${esc(t)}" ${state.adminTheme === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><p class="admin-help">각 항목의 ↑ ↓ 버튼을 눌러 위치를 바꿉니다.</p><div id="admin-list" class="admin-list"></div><p id="order-announcement" class="sr-only" role="status"></p><div class="github-settings"><div class="section-kicker"><span class="pixel-mini lavender"></span> SAVE TO GITHUB</div><h3>GitHub 저장 설정</h3><p>변경한 순서를 GitHub의 data.js에 저장합니다.</p><label for="github-repo">저장소 <small>아이디/저장소 이름</small></label><input class="admin-field" id="github-repo" placeholder="예: myname/z-hint-book" value="${esc(repository)}" autocomplete="off" autocapitalize="none" spellcheck="false"><div class="github-settings-grid"><div><label for="github-branch">브랜치</label><input class="admin-field" id="github-branch" value="${esc(branch)}" autocomplete="off" autocapitalize="none" spellcheck="false"></div><div><label for="github-folder">Pages 폴더</label><select class="admin-field" id="github-folder"><option value="" ${folder === '' ? 'selected' : ''}>/ (루트)</option><option value="docs/" ${folder === 'docs/' ? 'selected' : ''}>/docs</option></select></div></div><label for="github-token">GitHub 토큰 <small>Contents 읽기 및 쓰기</small></label><input class="admin-field" type="password" id="github-token" placeholder="토큰 입력" autocomplete="off" autocapitalize="none" spellcheck="false"><p class="admin-token-note">토큰은 앱에 저장하지 않습니다. ‘관리자’는 화면을 여는 명령이며, 저장에는 토큰이 필요합니다.</p></div><button type="button" class="admin-apply-bottom" data-admin-apply>변경사항 적용 ↗</button></div></section>`;
    adminList();
  }
  function enterAdmin() {
    state.admin = true;
    state.query = '';
    state.detail = null;
    state.baseline = records.slice();
    state.draft = records.slice();
    state.adminTheme = state.theme === '전체' ? THEME_ORDER[0] : state.theme;
    els.query.value = '관리자';
    els.query.disabled = true;
    els.query.blur();
    els.clear.hidden = true;
    els.saveStatus.hidden = true;
    els.submitLabel.textContent = '변경사항 적용';
    els.themePanel.hidden = true;
    els.recent.hidden = true;
    renderAdmin();
    scrollResults();
  }
  function exitAdmin(message) {
    state.admin = false;
    state.saving = false;
    state.draft = null;
    state.baseline = null;
    state.query = '';
    state.detail = null;
    state.showAll = false;
    els.query.value = '';
    els.query.disabled = false;
    els.submit.disabled = false;
    els.submitLabel.textContent = '찾아보기';
    els.themePanel.hidden = false;
    els.saveStatus.textContent = message || '';
    els.saveStatus.hidden = !message;
    render();
  }
  function adminMessage(message) {
    const box = document.querySelector('#admin-message');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
    if (message) box.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function applyAdmin() {
    if (!state.admin || state.saving) return;
    if (JSON.stringify(state.draft) === JSON.stringify(state.baseline)) { exitAdmin('변경된 순서가 없어 기존 화면으로 돌아왔습니다.'); return; }
    if (location.hostname.endsWith('.chatgpt.site')) { adminMessage('이곳은 기존 ChatGPT 사이트입니다. ZIP을 GitHub에 올린 뒤 GitHub Pages 주소에서 순서를 저장해 주세요.'); return; }
    const settings = {
      repository:document.querySelector('#github-repo').value.trim(), branch:document.querySelector('#github-branch').value.trim(),
      folder:document.querySelector('#github-folder').value, token:document.querySelector('#github-token').value.trim()
    };
    state.saving = true;
    els.submit.disabled = true;
    els.submitLabel.textContent = '저장 중…';
    document.querySelectorAll('.admin-shell button, .admin-shell input, .admin-shell select').forEach(el => { el.disabled = true; });
    adminMessage('');
    try {
      await window.HintSync.saveToGitHub(window.fetch.bind(window), settings, state.baseline, state.draft);
      records.splice(0, records.length, ...state.draft);
      state.pendingOrder = JSON.stringify(records);
      updateOccurrences();
      try { localStorage.setItem('z-hint-book-github-settings', JSON.stringify({repository:settings.repository,branch:settings.branch,folder:settings.folder})); } catch (_) {}
      exitAdmin('GitHub에 저장했습니다. Pages 배포가 끝나면 다른 기기에도 반영됩니다.');
      window.scrollTo({top:0,behavior:'smooth'});
    } catch (error) {
      state.saving = false;
      els.submit.disabled = false;
      els.submitLabel.textContent = '변경사항 적용';
      document.querySelectorAll('.admin-shell button, .admin-shell input, .admin-shell select').forEach(el => { el.disabled = false; });
      adminList();
      adminMessage(error && error.message ? error.message : '저장하지 못했습니다. GitHub 설정을 확인해 주세요.');
    }
  }
  function renderResults() {
    if (state.admin) { renderAdmin(); return; }
    if (state.detail !== null && records[state.detail]) {
      els.results.innerHTML = renderDetail(records[state.detail]);
      return;
    }
    const found = matches();
    const q = state.query.trim();
    const visible = !q && state.theme === '전체' && !state.showAll ? found.slice(0, 12) : found;
    const title = q ? '검색 결과' : state.theme === '전체' ? '전체 힌트' : `${state.theme} 힌트`;
    const exactDuplicates = q && found.filter(item => item.code === codeQuery(q)).length > 1;
    const note = exactDuplicates ? '<div class="helper-line"><span class="helper-icon">!</span><span><strong>같은 코드가 여러 테마에 있어요.</strong><br>해당하는 테마를 확인하고 선택해 주세요.</span></div>' : '';
    let body = '';
    if (found.length) {
      body = `<div class="hint-list">${visible.map(card).join('')}</div>${visible.length < found.length ? `<button type="button" class="more-button" data-more>나머지 ${found.length - visible.length}개 더 보기 ↓</button>` : ''}`;
    } else {
      const compact = codeQuery(q);
      const elsewhere = state.theme !== '전체' && q && records.some(item => (compact && item.code.includes(compact)) || [item.title,item.theme,item.hint,item.answer].some(field => normalize(field).includes(normalize(q))));
      body = `<div class="empty"><span class="empty-art" aria-hidden="true">?</span><strong>일치하는 힌트가 없어요</strong><p>코드를 다시 확인하거나<br>다른 문제 이름으로 검색해 보세요.</p>${elsewhere ? '<button type="button" class="empty-button" data-search-all>전체 테마에서 다시 찾기</button>' : ''}</div>`;
    }
    els.results.innerHTML = `<div class="results-head"><div><div class="result-eyebrow">${q ? 'SEARCH RESULTS' : 'HINT LIST'}</div><h2 class="result-heading">${esc(title)}</h2></div><span class="result-summary" aria-live="polite"><b>${found.length}</b>개의 힌트</span></div>${note}${body}`;
  }
  function render() {
    document.querySelector('#theme-total').textContent = `${THEME_ORDER.length}개 테마`;
    document.querySelector('#hint-total').textContent = `${records.length}개 힌트`;
    document.querySelector('#all-hint-total').textContent = records.length;
    renderThemes(); renderRecent(); renderResults();
  }
  function queryChanged(event) {
    if (state.admin || (event && event.isComposing)) return;
    if (normalize(els.query.value) === '관리자') { enterAdmin(); return; }
    state.query = els.query.value;
    state.detail = null;
    state.showAll = false;
    els.clear.hidden = !state.query;
    els.saveStatus.hidden = true;
    renderResults();
  }
  els.query.addEventListener('input', queryChanged);
  els.query.addEventListener('compositionend', () => setTimeout(() => queryChanged(), 0));
  els.form.addEventListener('submit', event => {
    event.preventDefault();
    if (state.admin) { applyAdmin(); return; }
    els.query.blur();
    const found = matches();
    const exact = state.query.trim() ? found.filter(item => item.code === codeQuery(state.query)) : [];
    if (exact.length === 1) openDetail(indexOf(exact[0]));
    else if (found.length === 1) openDetail(indexOf(found[0]));
    else { state.detail = null; renderResults(); scrollResults(); }
  });
  els.clear.addEventListener('click', () => {
    els.query.value=''; state.query=''; state.detail=null; state.showAll=false; els.clear.hidden=true; renderResults(); els.query.focus();
  });
  els.grid.addEventListener('click', event => {
    const button = event.target.closest('[data-theme]'); if (!button) return;
    state.theme=button.dataset.theme; state.detail=null; state.showAll=false; renderThemes(); renderResults();
  });
  els.all.addEventListener('click', () => { state.theme='전체'; state.detail=null; state.showAll=false; renderThemes(); renderResults(); });
  els.recent.addEventListener('click', event => {
    const button=event.target.closest('[data-recent]'); if (button) openDetail(Number(button.dataset.recent));
  });
  els.results.addEventListener('change', event => {
    if (state.admin && event.target.id === 'admin-theme') { state.adminTheme = event.target.value; adminList(); }
  });
  els.results.addEventListener('click', event => {
    if (state.admin) {
      if (state.saving) return;
      if (event.target.closest('[data-admin-cancel]')) { exitAdmin(''); return; }
      if (event.target.closest('[data-admin-apply]')) { els.form.requestSubmit(); return; }
      const move = event.target.closest('[data-move]');
      if (move) {
        const from = Number(move.dataset.position), step = Number(move.dataset.move);
        const item = state.draft.filter(record => record.theme === state.adminTheme)[from];
        state.draft = window.HintSync.move(state.draft, state.adminTheme, from, step);
        adminList();
        document.querySelector('#order-announcement').textContent = `${item.title} ${step < 0 ? '위로' : '아래로'} 이동했습니다.`;
      }
      return;
    }
    const detail=event.target.closest('[data-detail]');
    if (detail) { openDetail(Number(detail.dataset.detail)); return; }
    if (event.target.closest('[data-back]')) { state.detail=null; renderResults(); scrollResults(); return; }
    if (event.target.closest('[data-new-search]')) {
      els.query.value=''; state.query=''; state.detail=null; state.showAll=false; els.clear.hidden=true;
      renderResults(); els.query.focus(); els.query.scrollIntoView({behavior:'smooth',block:'center'}); return;
    }
    if (event.target.closest('[data-more]')) { state.showAll=true; renderResults(); return; }
    if (event.target.closest('[data-search-all]')) { state.theme='전체'; state.detail=null; renderThemes(); renderResults(); }
  });
  if (!records.length) els.results.innerHTML='<div class="empty"><strong>힌트 데이터를 불러오지 못했어요.</strong><p>페이지를 새로고침해 주세요.</p></div>';
  else { els.query.disabled = false; els.submit.disabled = false; render(); }

  let refreshing = false;
  async function refreshPublishedData() {
    if (refreshing || state.admin || document.hidden || location.protocol === 'file:') return;
    refreshing = true;
    try {
      const response = await fetch(`data.js?fresh=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) return;
      const latest = window.HintSync.parseDataScript(await response.text());
      if (state.admin) return;
      const latestSnapshot = JSON.stringify(latest);
      if (state.pendingOrder && latestSnapshot !== state.pendingOrder) return;
      if (state.pendingOrder === latestSnapshot) state.pendingOrder = null;
      if (latestSnapshot === JSON.stringify(records)) return;
      const detailKey = state.detail === null ? null : recordKey(records[state.detail]);
      records.splice(0, records.length, ...latest);
      updateOccurrences();
      state.detail = detailKey ? records.findIndex(item => recordKey(item) === detailKey) : null;
      if (state.detail === -1) state.detail = null;
      render();
    } catch (_) {} finally { refreshing = false; }
  }
  setInterval(refreshPublishedData, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPublishedData(); });
})();
