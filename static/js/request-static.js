/* 정적 판: 이력서·포트폴리오 요청 폼 → Supabase resume_requests 에 INSERT만(익명 키). 읽기 권한이 없어 요청 내용은 되돌려 받지 않는다.
   스팸 방어: 길이 제약 + 허니팟 + 같은 브라우저 연속 전송 간격(클라이언트, 우회 가능). 화면에 값을 쓰는 코드는 없다. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#rq-form');
  if (!form) return;
  var cfg = window.SUPABASE_CONFIG || {};
  var configured = !!(window.supabase && cfg.url && cfg.anonKey && !/^PASTE_/.test(cfg.url) && !/^PASTE_/.test(cfg.anonKey) &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url));
  var off = $('#rq-off'), ids = ['#rq-name', '#rq-email', '#rq-doc', '#rq-msg', '#rq-consent', '#rq-submit'];
  function setEnabled(v) { ids.forEach(function (s) { var e = $(s); if (e) e.disabled = !v; }); if (off) off.hidden = v; }
  function showState(k) { ['ok', 'err', 'limit'].forEach(function (s) { var e = $('#rq-' + s); if (e) e.classList.toggle('show', s === k); }); }
  if (!configured) { setEnabled(false); return; }
  setEnabled(true);
  var client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  var GAP_MS = 30000, KEY = 'rq_last_sent', MAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
  form.addEventListener('submit', function (e) {
    e.preventDefault(); showState();
    var n = $('#rq-name').value.replace(/[\r\n\t]+/g, ' ').trim(), m = $('#rq-email').value.trim();
    var doc = $('#rq-doc').value, msg = $('#rq-msg').value.replace(/\r\n?/g, '\n').trim(), ok = $('#rq-consent').checked;
    $('#rq-f-name').classList.toggle('invalid', !n || n.length > 40);
    $('#rq-f-email').classList.toggle('invalid', !MAIL.test(m) || m.length > 100);
    $('#rq-f-consent').classList.toggle('invalid', !ok);
    if (!n || n.length > 40 || !MAIL.test(m) || m.length > 100 || !ok) return;
    if (['resume', 'portfolio', 'both'].indexOf(doc) < 0 || msg.length > 300) { showState('err'); return; }
    if ($('#rq-hp').value) { showState('ok'); form.reset(); return; }          /* 허니팟: 봇이면 저장하지 않고 성공처럼 보인다 */
    var last = 0; try { last = Number(window.localStorage.getItem(KEY)) || 0; } catch (x) {}
    if (Date.now() - last < GAP_MS) { showState('limit'); return; }
    $('#rq-submit').disabled = true;
    client.from('resume_requests').insert({ name: n, email: m, doc: doc, message: msg }).then(function (r) {
      if (r.error) { showState('err'); return; }
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (x) {}
      showState('ok'); form.reset();
    }).catch(function () { showState('err'); }).then(function () { $('#rq-submit').disabled = false; });
  });
})();
