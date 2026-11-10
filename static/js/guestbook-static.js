/* 정적 판(GitHub Pages) 방명록: 서버 API 대신 Supabase를 쓴다. 출력은 항상 textContent.
   - 방문자 화면: RPC guestbook_public → 개수와 마스킹 이름·날짜만(내용은 오지 않는다)
   - 쓰기: guestbook_posts 에 INSERT만(익명 키). 읽기·수정·삭제 권한은 DB 규칙(RLS)이 막는다.
   - 스팸: 길이 제약 + 허니팟 + 같은 브라우저 연속 전송 간격(클라이언트). 서버 쪽 속도 제한은 없다(SECURITY.md). */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#gb-form');
  if (!form) return;
  var cfg = window.SUPABASE_CONFIG || {};
  var configured = !!(window.supabase && cfg.url && cfg.anonKey && !/^PASTE_/.test(cfg.url) && !/^PASTE_/.test(cfg.anonKey) &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url));
  var off = $('#gb-off');
  function setEnabled(v) {
    ['#gb-name', '#gb-msg', '#gb-submit'].forEach(function (s) { var e = $(s); if (e) e.disabled = !v; });
    if (off) off.hidden = v;
  }
  function fmt(d) { return String(d).replace(/-/g, '.'); }
  function showState(k) { ['ok', 'err', 'limit'].forEach(function (s) { var e = $('#st-' + s); if (e) e.classList.toggle('show', s === k); }); }
  if (!configured) { setEnabled(false); return; }
  setEnabled(true);
  var client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  var GAP_MS = 30000, KEY = 'gb_last_sent';

  var pageRpc = false;       /* guestbook_page 함수가 DB에 있으면 true(없으면 예전 함수로 최신 10개만 보여 준다) */
  function loadList(page) {
    page = page || 1;
    var q = pageRpc ? client.rpc('guestbook_page', { lim: 10, off: (page - 1) * 10 }) : client.rpc('guestbook_public', { lim: 10 });
    q.then(function (r) {
      if (r.error && pageRpc) { pageRpc = false; return loadList(1); }     /* 새 함수가 아직 없음 → 예전 함수로 */
      if (r.error || !r.data) return;
      window.GBPager.show(r.data, page, loadList, pageRpc);
    });
  }
  $('#gb-msg').addEventListener('input', function (e) { $('#cnt').textContent = e.target.value.length; });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); showState();
    var n = $('#gb-name').value.replace(/[\r\n\t]+/g, ' ').trim(), m = $('#gb-msg').value.replace(/\r\n?/g, '\n').trim();
    $('#f-name').classList.toggle('invalid', !n); $('#f-msg').classList.toggle('invalid', !m);
    if (!n || !m) return;
    if (n.length > 20 || m.length > 300) { showState('err'); return; }
    if ($('#gb-hp').value) { showState('ok'); form.reset(); return; }          /* 허니팟: 봇이면 저장하지 않고 성공처럼 보인다 */
    var last = 0; try { last = Number(window.localStorage.getItem(KEY)) || 0; } catch (x) {}
    if (Date.now() - last < GAP_MS) { showState('limit'); return; }
    $('#gb-submit').disabled = true;
    client.from('guestbook_posts').insert({ name: n, message: m }).then(function (r) {
      if (r.error) { showState('err'); return; }
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (x) {}
      showState('ok'); form.reset(); $('#cnt').textContent = 0; loadList(1);
    }).catch(function () { showState('err'); }).then(function () { $('#gb-submit').disabled = false; });
  });
  loadList();
})();
