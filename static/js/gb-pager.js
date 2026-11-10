/* 방명록 목록 공통: 최신순 알림 10개씩 + 페이지 넘김. 서버판(home.js)과 정적판(guestbook-static.js)이 함께 쓴다.
   출력은 항상 textContent. window.GBPager.show(data, page, goto) — data: { count, items:[{masked_name, created_at}] } */
(function () {
  var SIZE = 10;
  var HIDDEN = /^니x+마$/;   /* 목록에서 제외할 마스킹 이름(사용자 요청 2026-11-10: 니xxx마) */
  function fmt(d) { return String(d).replace(/-/g, '.'); }
  function btn(label, page, goto, opts) {
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    if (opts.aria) b.setAttribute('aria-label', opts.aria);
    if (opts.current) { b.setAttribute('aria-current', 'page'); b.disabled = true; }
    else if (opts.disabled) { b.disabled = true; }
    else { b.addEventListener('click', function () { goto(page); }); }
    return b;
  }
  function pages(total, page) {      /* 현재 페이지 주변 5개 */
    var start = Math.max(1, Math.min(page - 2, total - 4)), end = Math.min(total, start + 4), out = [];
    for (var i = start; i <= end; i++) out.push(i);
    return out;
  }
  window.GBPager = {
    size: SIZE,
    show: function (data, page, goto, canPage) {
      var $ = function (s) { return document.querySelector(s); };
      var shown = (data.items || []).filter(function (it) { return !HIDDEN.test(it.masked_name); });
      var hidden = (data.items || []).length - shown.length;
      data = { count: Math.max(0, data.count - hidden), items: shown };
      var c = $('#gb-count'); c.textContent = '지금까지 남겨진 방명록 ';
      var b = document.createElement('b'); b.textContent = data.count >= 10 ? '10+' : String(data.count); c.appendChild(b); if (data.count < 10) c.appendChild(document.createTextNode('개'));
      var ul = $('#gb-list'); ul.textContent = '';
      (data.items || []).forEach(function (it) {
        var li = document.createElement('li'), s = document.createElement('span'), t = document.createElement('time');
        s.textContent = it.masked_name + ' 님이 방명록을 남겼습니다.'; t.textContent = '(' + fmt(it.created_at) + ')';
        li.appendChild(s); li.appendChild(t); ul.appendChild(li);
      });
      $('#gb-empty').classList.toggle('show', data.count === 0);
      var nav = $('#gb-pager'); if (!nav) return;
      var total = Math.max(1, Math.ceil(data.count / SIZE));
      nav.textContent = '';
      nav.hidden = true; return;   /* 사용자 결정(2026-11-10): 페이지 번호 없이 목록을 위아래로 넘겨 본다 */
      nav.hidden = false;
      nav.appendChild(btn('‹ 이전', page - 1, goto, { disabled: page <= 1, aria: '이전 페이지' }));
      pages(total, page).forEach(function (n) { nav.appendChild(btn(String(n), n, goto, { current: n === page, aria: n + '페이지' })); });
      nav.appendChild(btn('다음 ›', page + 1, goto, { disabled: page >= total, aria: '다음 페이지' }));
      var info = document.createElement('span'); info.className = 'pager-info'; info.textContent = page + ' / ' + total + ' 페이지';
      nav.appendChild(info);
    }
  };
})();
