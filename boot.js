(() => {
  'use strict';
  const scripts = ['data.js?fresh=' + Date.now(), 'sync.js?v=4', 'app.js?v=4'];
  function next(index) {
    if (index >= scripts.length) return;
    const script = document.createElement('script');
    script.src = scripts[index];
    script.onload = () => next(index + 1);
    script.onerror = () => {
      const results = document.querySelector('#results');
      if (results) results.textContent = '앱을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.';
    };
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => next(0), { once:true });
  else next(0);
})();
