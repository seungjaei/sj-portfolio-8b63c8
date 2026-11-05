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

  function loadList() {
    client.rpc('guestbook_public', { lim: 5 }).then(function (r) {
      if (r.error || !r.data) return;
      var j = r.data, c = $('#gb-count'); c.textContent = '지금까지 남겨진 방명록 ';
      var b = document.createElement('b'); b.textContent = String(j.count); c.appendChild(b); c.appendChild(document.createTextNode('개'));
      var ul = $('#gb-list'); ul.textContent = '';
      (j.items || []).slice(0, 5).forEach(function (it) {
        var li = document.createElement('li'), s = document.createElement('span'), t = document.createElement('time');
        s.textContent = it.masked_name + ' 님이 방명록을 남겼습니다'; t.textContent = '(' + fmt(it.created_at) + ')';
        li.appendChild(s); li.appendChild(t); ul.appendChild(li);
      });
      $('#gb-empty').classList.toggle('show', j.count === 0);
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
      showState('ok'); form.reset(); $('#cnt').textContent = 0; loadList();
    }).catch(function () { showState('err'); }).then(function () { $('#gb-submit').disabled = false; });
  });
  loadList();
})();
