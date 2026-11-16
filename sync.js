(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HintSync = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const key = item => JSON.stringify([item.theme, item.code]);
  const required = ['theme', 'code', 'title', 'hint', 'answer'];

  function validate(records) {
    if (!Array.isArray(records) || !records.length) throw new Error('힌트 데이터 형식이 올바르지 않습니다.');
    const seen = new Set();
    for (const item of records) {
      if (!item || required.some(name => typeof item[name] !== 'string' || !item[name])) throw new Error('힌트 데이터에 누락된 항목이 있습니다.');
      const id = key(item);
      if (seen.has(id)) throw new Error('같은 테마에 중복된 힌트 코드가 있습니다.');
      seen.add(id);
    }
    return records;
  }
  function parseDataScript(text) {
    const match = /^\s*window\.HINT_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/.exec(text.replace(/^\uFEFF/, ''));
    if (!match) throw new Error('GitHub의 힌트 데이터 파일을 읽을 수 없습니다.');
    try { return validate(JSON.parse(match[1])); }
    catch (error) { throw new Error('GitHub의 힌트 데이터 형식을 확인해 주세요.'); }
  }
  function dataScript(records) {
    validate(records);
    return 'window.HINT_DATA = ' + JSON.stringify(records) + ';\n';
  }
  function move(records, theme, from, step) {
    const positions = [];
    records.forEach((item, index) => { if (item.theme === theme) positions.push(index); });
    const to = from + step;
    if (!Number.isInteger(from) || !Number.isInteger(step) || from < 0 || to < 0 || from >= positions.length || to >= positions.length) return records.slice();
    const next = records.slice();
    [next[positions[from]], next[positions[to]]] = [next[positions[to]], next[positions[from]]];
    return next;
  }
  function isPermutation(before, after) {
    validate(before); validate(after);
    if (before.length !== after.length) return false;
    const original = new Map(before.map(item => [key(item), JSON.stringify(item)]));
    return after.every(item => original.get(key(item)) === JSON.stringify(item));
  }
  function encode64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  function decode64(text) {
    const binary = atob(String(text).replace(/\s/g, ''));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
  }
  function inferRepository(location) {
    const match = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname || '');
    if (!match) return '';
    const name = (location.pathname || '').split('/').filter(Boolean)[0];
    return `${match[1]}/${name ? decodeURIComponent(name) : match[1] + '.github.io'}`;
  }
  function validateSettings(settings) {
    const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(String(settings.repository || '').trim());
    if (!match || match[1] === '.' || match[1] === '..' || match[2] === '.' || match[2] === '..') throw new Error('저장소를 아이디/저장소 이름 형식으로 입력해 주세요.');
    const branch = String(settings.branch || '').trim();
    if (!branch || /[\s?#\\]/.test(branch) || branch.includes('..')) throw new Error('GitHub Pages에서 사용하는 브랜치를 입력해 주세요.');
    if (!['', 'docs/'].includes(settings.folder || '')) throw new Error('저장 폴더 설정을 확인해 주세요.');
    const token = String(settings.token || '').trim();
    if (!token || /\s/.test(token)) throw new Error('저장소의 Contents 쓰기 권한이 있는 GitHub 토큰을 입력해 주세요.');
    return { owner: match[1], repo: match[2], branch, path: (settings.folder || '') + 'data.js', token };
  }
  async function saveToGitHub(fetcher, settings, before, after) {
    const target = validateSettings(settings);
    if (!isPermutation(before, after)) throw new Error('힌트 내용이 바뀌어 저장을 중단했습니다. 새로고침한 뒤 다시 시도해 주세요.');
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${target.path.split('/').map(encodeURIComponent).join('/')}`;
    const headers = { 'Accept':'application/vnd.github+json', 'Authorization':`Bearer ${target.token}`, 'X-GitHub-Api-Version':'2022-11-28' };
    let response;
    try { response = await fetcher(`${endpoint}?ref=${encodeURIComponent(target.branch)}`, { method:'GET', headers, cache:'no-store' }); }
    catch (_) { throw new Error('GitHub에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) throw new Error('저장소·브랜치·토큰과 Contents 읽기 및 쓰기 권한을 확인해 주세요.');
      throw new Error(`GitHub 파일을 확인하지 못했습니다. (오류 ${response.status})`);
    }
    const file = await response.json();
    if (!file.sha || file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('GitHub에서 힌트 데이터 파일을 읽지 못했습니다.');
    let remote;
    try { remote = parseDataScript(decode64(file.content)); }
    catch (_) { throw new Error('GitHub에 올린 data.js 파일을 확인해 주세요.'); }
    if (JSON.stringify(remote) !== JSON.stringify(before)) throw new Error('GitHub의 힌트가 이미 변경되었습니다. 배포 완료 후 새로고침하고 다시 편집해 주세요.');
    try {
      response = await fetcher(endpoint, { method:'PUT', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({message:'직원 힌트 목록 순서 변경', content:encode64(dataScript(after)), sha:file.sha, branch:target.branch}) });
    } catch (_) { throw new Error('저장 결과를 확인하지 못했습니다. GitHub에서 파일 변경 여부를 먼저 확인해 주세요.'); }
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) throw new Error('저장 중 다른 변경이 생겼거나 브랜치 보호 규칙이 적용되어 있습니다. GitHub에서 확인해 주세요.');
      if (response.status === 401 || response.status === 403 || response.status === 404) throw new Error('토큰의 저장소 Contents 쓰기 권한과 브랜치 설정을 확인해 주세요.');
      throw new Error(`GitHub 저장에 실패했습니다. (오류 ${response.status})`);
    }
    const result = await response.json();
    return { sha:result.commit && result.commit.sha ? result.commit.sha : '' };
  }
  return { key, validate, parseDataScript, dataScript, move, isPermutation, inferRepository, saveToGitHub, encode64, decode64 };
});
