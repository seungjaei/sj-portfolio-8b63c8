/* 정적 판 관리자 화면: Supabase Auth 이메일 로그인 → 방명록 목록·삭제. 비밀번호는 코드에 없고, 로그인 전에는 데이터를 요청하지 않는다.
   누가 볼 수 있는지는 DB 규칙(RLS: 지정한 관리자 이메일 1명)이 정한다. 출력은 항상 textContent. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var cfg = window.SUPABASE_CONFIG || {}, items = [], reqs = [], target = null, kind = 'gb', client = null;
  var DOC = { resume: '이력서', portfolio: '포트폴리오', both: '이력서와 포트폴리오' };
  var configured = !!(window.supabase && cfg.url && cfg.anonKey && !/^PASTE_/.test(cfg.url) && !/^PASTE_/.test(cfg.anonKey));
  function show(v) { $('#view-login').hidden = v !== 'login'; $('#view-list').hidden = v !== 'list'; }
  function flags(m) { Object.keys(m).forEach(function (k) { $(k).classList.toggle('show', m[k]); }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function render() {
    $('#n').textContent = items.length;
    $('#latest').textContent = items.length ? String(items[0].created_at).slice(0, 10).replace(/-/g, '.') : '-';
    var list = $('#list'); list.textContent = '';
    items.forEach(function (x) {
      var a = el('article', 'entry'), h = el('header'), f = el('footer');
      h.appendChild(el('b', '', x.name)); h.appendChild(el('time', '', String(x.created_at).slice(0, 16).replace('T', ' ')));
      var btn = el('button', 'btn btn-danger btn-sm', '삭제');
      btn.type = 'button'; btn.setAttribute('aria-label', x.name + ' 님의 방명록 삭제');
      btn.addEventListener('click', function () { target = x; kind = 'gb'; $('#dlg-q').textContent = x.name + ' · ' + x.message.slice(0, 40); $('#dlg').showModal(); });
      f.appendChild(btn); a.appendChild(h); a.appendChild(el('p', '', x.message)); a.appendChild(f); list.appendChild(a);
    });
    $('#empty').classList.toggle('show', !items.length);
  }
  function tab(which) {
    ['gb', 'rq'].forEach(function (k) {
      $('#tab-' + k).setAttribute('aria-selected', String(k === which)); $('#panel-' + k).hidden = k !== which;
    });
  }
  function mailto(x) {
    var doc = DOC[x.doc] || '요청하신 문서';
    var subject = '[이승재] 요청하신 ' + doc + ' 보내 드립니다';
    var body = '안녕하세요, ' + x.name + '님.\n\n요청하신 ' + doc + '를 첨부해 보내 드립니다.\n확인 후 궁금한 점은 편하게 회신 주세요.\n\n감사합니다.\n이승재';
    return 'mailto:' + encodeURIComponent(x.email).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function renderReqs() {
    var n = reqs.filter(function (x) { return x.status === 'new'; }).length;
    $('#rq-new').textContent = n ? '(새 ' + n + ')' : '';
    var list = $('#rq-list'); list.textContent = '';
    reqs.forEach(function (x) {
      var a = el('article', 'entry'), h = el('header'), f = el('footer'), meta = el('p', 'req-meta');
      h.appendChild(el('b', '', x.name));
      if (x.status === 'new') h.appendChild(el('span', 'badge-new', '새 요청')); else h.appendChild(el('span', 'muted small', '보냄'));
      h.appendChild(el('time', '', String(x.created_at).slice(0, 16).replace('T', ' ')));
      meta.appendChild(el('span', '', '이메일: ' + x.email)); meta.appendChild(el('span', '', '요청 문서: ' + (DOC[x.doc] || x.doc)));
      a.appendChild(h); a.appendChild(meta);
      if (x.message) a.appendChild(el('p', '', x.message));
      var mb = el('a', 'btn btn-primary btn-sm', '메일 보내기'); mb.href = mailto(x); mb.setAttribute('aria-label', x.name + ' 님에게 메일 보내기(메일 작성 창이 열려요)');
      f.appendChild(mb);
      if (x.status === 'new') {
        var sb = el('button', 'btn btn-ghost btn-sm', '보냄으로 표시'); sb.type = 'button';
        sb.addEventListener('click', function () {
          client.from('resume_requests').update({ status: 'sent' }).eq('id', x.id).select('id').then(function (r) {
            var ok = !r.error && r.data && r.data.length > 0; flags({ '#rq-toast': ok, '#rq-toast-err': !ok }); return loadReqs();
          });
        });
        f.appendChild(sb);
      }
      var db = el('button', 'btn btn-danger btn-sm', '삭제'); db.type = 'button'; db.setAttribute('aria-label', x.name + ' 님의 요청 삭제');
      db.addEventListener('click', function () { target = x; kind = 'rq'; $('#dlg-q').textContent = x.name + ' · ' + (DOC[x.doc] || x.doc); $('#dlg').showModal(); });
      f.appendChild(db); a.appendChild(f); list.appendChild(a);
    });
    $('#rq-empty').classList.toggle('show', !reqs.length);
  }
  function loadReqs() {
    return client.from('resume_requests').select('id,name,email,doc,message,status,created_at').order('created_at', { ascending: false }).then(function (r) {
      reqs = r.error ? [] : (r.data || []); renderReqs();
    });
  }
  function load() {
    return client.from('guestbook_posts').select('id,name,message,created_at').order('created_at', { ascending: false }).then(function (r) {
      if (r.error) { show('login'); return; }
      items = r.data || []; show('list'); render(); loadReqs();
    });
  }
  if (!configured) { show('login'); flags({ '#st-off': true }); $('#login-btn').disabled = true; $('#em').disabled = true; $('#pw').disabled = true; return; }
  client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true } });
  client.auth.getSession().then(function (r) { if (r.data && r.data.session) load(); else show('login'); });
  $('#login').addEventListener('submit', function (e) {
    e.preventDefault(); flags({ '#st-bad': false, '#st-lock': false });
    var em = $('#em').value.trim(), pw = $('#pw').value;
    $('#f-pw').classList.toggle('invalid', !pw || !em); if (!pw || !em) return;
    client.auth.signInWithPassword({ email: em, password: pw }).then(function (r) {
      $('#pw').value = '';
      if (!r.error) return load();
      flags({ '#st-bad': r.error.status !== 429, '#st-lock': r.error.status === 429 });
    });
  });
  $('#logout').addEventListener('click', function (e) { e.preventDefault(); client.auth.signOut().then(function () { items = []; reqs = []; show('login'); }); });
  $('#tab-gb').addEventListener('click', function () { tab('gb'); });
  $('#tab-rq').addEventListener('click', function () { tab('rq'); });
  $('#no').addEventListener('click', function () { $('#dlg').close(); });
  $('#yes').addEventListener('click', function () {
    if (!target) return;
    var id = target.id, isReq = kind === 'rq'; $('#dlg').close();
    client.from(isReq ? 'resume_requests' : 'guestbook_posts').delete().eq('id', id).select('id').then(function (r) {
      var ok = !r.error && r.data && r.data.length > 0;
      flags(isReq ? { '#rq-toast': ok, '#rq-toast-err': !ok } : { '#toast': ok, '#toast-err': !ok });
      return isReq ? loadReqs() : load();
    });
  });
})();
