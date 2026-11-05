/* 방문자 화면: 방명록 등록·개수·마스킹 알림(서버가 준 마스킹 이름과 날짜만 표시) + 타임라인 필터·접기/펴기·포스터 확대·영상 재생. 출력은 항상 textContent. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function fmt(d) { return d.replace(/-/g, '.'); }
  function loadList() {
    fetch('/api/guestbook', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var c = $('#gb-count'); c.textContent = '지금까지 남겨진 방명록 ';
      var b = document.createElement('b'); b.textContent = String(j.count); c.appendChild(b); c.appendChild(document.createTextNode('개'));
      var ul = $('#gb-list'); ul.textContent = '';
      j.items.slice(0, 5).forEach(function (it) {
        var li = document.createElement('li'), s = document.createElement('span'), t = document.createElement('time');
        s.textContent = it.masked_name + ' 님이 방명록을 남겼습니다'; t.textContent = '(' + fmt(it.created_at) + ')';
        li.appendChild(s); li.appendChild(t); ul.appendChild(li);
      });
      $('#gb-empty').classList.toggle('show', j.count === 0);
    }).catch(function () {});
  }
  function showState(k) { ['ok', 'err', 'limit'].forEach(function (s) { $('#st-' + s).classList.toggle('show', s === k); }); }
  var form = $('#gb-form');
  /* 정적 판(GitHub Pages)에서는 서버 API가 없으므로 guestbook-static.js(Supabase)가 방명록을 맡는다 */
  if (form && document.documentElement.dataset.static !== '1') {
    $('#gb-msg').addEventListener('input', function (e) { $('#cnt').textContent = e.target.value.length; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); showState();
      var n = $('#gb-name').value.trim(), m = $('#gb-msg').value.trim();
      $('#f-name').classList.toggle('invalid', !n); $('#f-msg').classList.toggle('invalid', !m);
      if (!n || !m) return;
      $('#gb-submit').disabled = true;
      fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, message: m, website: $('#gb-hp').value }) })
        .then(function (r) {
          if (r.ok) { showState('ok'); form.reset(); $('#cnt').textContent = 0; loadList(); }
          else if (r.status === 429) showState('limit'); else showState('err');
        }).catch(function () { showState('err'); })
        .then(function () { $('#gb-submit').disabled = false; });
    });
    loadList();
  }
  /* ---- 접기/펴기: JS가 켜져 있을 때만 접는다(꺼져 있으면 전체가 그대로 보인다) ---- */
  var tl = $('#tl');
  function setTimeline(open) {
    if (!tl) return;
    tl.classList.toggle('is-folded', !open);
    var tb = document.querySelector('.tgl[data-kind="timeline"]');
    if (tb) { tb.setAttribute('aria-expanded', String(open)); tb.textContent = open ? tb.dataset.close : tb.dataset.open; }
  }
  document.querySelectorAll('.tgl').forEach(function (btn) {
    var tgt = document.getElementById(btn.dataset.target);
    if (!tgt) return;
    btn.hidden = false;
    var timeline = btn.dataset.kind === 'timeline';
    if (timeline) setTimeline(false); else tgt.hidden = true;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      if (timeline) { setTimeline(open); return; }
      tgt.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? btn.dataset.close : btn.dataset.open;
    });
  });

  /* ---- 크게 보기(dialog): data-lb 묶음(포스터·오피스 화면)별로 이전/다음. 닫기 버튼·Esc·바깥 클릭·←/→ ---- */
  var lb = $('#lightbox');
  if (lb && lb.showModal) {
    var group = [], cur = 0;
    var show = function (i) {
      cur = (i + group.length) % group.length;
      var b = group[cur], im = b.querySelector('img');
      $('#lb-img').src = im.src; $('#lb-img').alt = im.alt;
      $('#lb-cap').textContent = (b.dataset.cap || im.alt.replace(/ (포스터|화면)$/, '')) + ' (' + (cur + 1) + '/' + group.length + ')';
    };
    document.querySelectorAll('[data-lb]').forEach(function (b) {
      b.addEventListener('click', function () {
        group = Array.prototype.slice.call(document.querySelectorAll('[data-lb="' + b.dataset.lb + '"]'));
        show(group.indexOf(b)); lb.showModal();
      });
    });
    $('#lb-prev').addEventListener('click', function () { show(cur - 1); });
    $('#lb-next').addEventListener('click', function () { show(cur + 1); });
    $('#lb-close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ---- 음악 영상: 누르기 전에는 외부 요청 없음. 누르면 youtube-nocookie 임베드로 바꾼다 ---- */
  var EMB = 'https://www.youtube-nocookie.com/embed/';
  var coarse = window.matchMedia ? window.matchMedia('(hover: none), (pointer: coarse)') : { matches: false };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function mkFrame(src, btn, params) {
    var f = document.createElement('iframe');
    f.src = src + '?' + params; f.title = btn.getAttribute('aria-label').replace(' 재생하기', '') + ' 영상';
    f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    return f;
  }
  document.querySelectorAll('.song-player').forEach(function (box) {
    var btn = box.querySelector('.song-play'), src = box.dataset.embed || '';
    if (!btn || src.indexOf(EMB) !== 0 || !/^[\w-]{11}$/.test(src.slice(EMB.length))) return;
    var hov = null, clicked = false;
    /* 호버·포커스: 이때 처음 유튜브(youtube-nocookie)에 연결해 음소거로 처음부터 재생, 떼면 iframe을 제거해 썸네일로 되돌린다 */
    function hoverStart() {
      if (hov || clicked || reduceMotion || coarse.matches) return;
      hov = mkFrame(src, btn, 'autoplay=1&mute=1&controls=0&playsinline=1&rel=0');
      hov.tabIndex = -1; hov.setAttribute('aria-hidden', 'true');
      box.insertBefore(hov, btn); box.classList.add('hovering');
    }
    function hoverStop() {
      if (hov && hov.parentNode) hov.parentNode.removeChild(hov);
      hov = null; box.classList.remove('hovering');
    }
    box.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') hoverStart(); });
    box.addEventListener('pointerleave', hoverStop);
    box.addEventListener('focusin', hoverStart);
    box.addEventListener('focusout', hoverStop);
    btn.addEventListener('click', function () {
      clicked = true; hoverStop();
      var f = mkFrame(src, btn, 'autoplay=1&playsinline=1&rel=0');
      box.textContent = ''; box.appendChild(f); box.classList.add('playing');
      var a = document.createElement('a');
      a.href = 'https://www.youtube.com/watch?v=' + src.slice(EMB.length); a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'yt-fallback'; a.textContent = '영상이 안 열리면 유튜브에서 보기 ↗';
      box.parentNode.appendChild(a);
    });
  });

  document.querySelectorAll('.filter').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      var f = b.dataset.f;
      if (f !== 'all') setTimeline(true);
      document.querySelectorAll('.tl-item').forEach(function (i) { i.hidden = !(f === 'all' || i.dataset.type === f); });
      document.querySelectorAll('.tl-year').forEach(function (y) { y.hidden = !y.querySelector('.tl-item:not([hidden])'); });
    });
  });

  /* ---- 호버·포커스 미리보기: [data-pv-t]에 마우스를 올리거나 키보드로 포커스하면 옆에 정보 카드가 나온다.
     가장자리에서는 반대편으로 열린다. 모바일(좁은 화면·터치)은 하단 시트. 내용은 textContent로만 그린다. ---- */
  var pv = $('#pv'), sheet = $('#pv-sheet'), pvEl = null, bypass = false;
  /* 터치 전용 기기(hover: none 또는 pointer: coarse)에서만 모바일 방식. 창 폭과는 무관하다(마우스가 있으면 좁은 창에서도 호버 미리보기가 동작) */
  var mq = window.matchMedia ? window.matchMedia('(hover: none), (pointer: coarse)') : { matches: false };
  function fill(box, el, sheetMode) {
    box.textContent = '';
    var d = el.dataset;
    if (d.pvP) { var p = document.createElement('p'); p.className = 'pv-p'; p.textContent = d.pvP; box.appendChild(p); }
    var h = document.createElement('p'); h.className = 'pv-t'; h.textContent = d.pvT; box.appendChild(h);
    if (d.pvS) { var s = document.createElement('p'); s.className = 'pv-s'; s.textContent = d.pvS; box.appendChild(s); }
    if (d.pvG) {
      var u = document.createElement('p'); u.className = 'pv-g';
      d.pvG.split('|').forEach(function (t) { var c = document.createElement('span'); c.textContent = t; u.appendChild(c); });
      box.appendChild(u);
    }
    var a = document.createElement('p'); a.className = 'pv-a'; a.textContent = d.pvA || ''; if (!sheetMode) box.appendChild(a);
  }
  function hidePv() { if (pv) { pv.classList.remove('on'); pv.hidden = true; } pvEl = null; }
  function place(el, mx) {
    var r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, g = 14;
    var w = pv.offsetWidth, h = pv.offsetHeight, x, y;
    if (r.width > vw * 0.6 && mx != null) { x = mx < vw / 2 ? mx + 18 : mx - w - 18; }   /* 넓은 카드: 포인터 옆 */
    else if (vw - r.right >= w + g) x = r.right + g;                                       /* 오른쪽 여유 */
    else if (r.left >= w + g) x = r.left - w - g;                                          /* 가장자리면 반대편(왼쪽) */
    else x = r.left + r.width / 2 < vw / 2 ? r.left : r.right - w;
    x = Math.max(8, Math.min(x, vw - w - 8));
    y = Math.max(8, Math.min(r.top, vh - h - 8));
    if (x < r.right && x + w > r.left) {                                                   /* 좁은 창: 카드를 가리면 아래, 안 되면 위로 */
      if (r.bottom + g + h <= vh) y = r.bottom + g;
      else if (r.top - g - h >= 0) y = r.top - g - h;
    }
    pv.style.left = x + 'px'; pv.style.top = y + 'px';
  }
  function showPv(el, mx) {
    if (!pv || mq.matches || !el.dataset.pvT) return;
    pvEl = el; fill(pv, el, false); pv.hidden = false; place(el, mx);
    requestAnimationFrame(function () { if (pvEl === el) pv.classList.add('on'); });
  }
  function closeSheet() { if (sheet) sheet.hidden = true; document.body.classList.remove('pv-open'); }
  function openSheet(el) {
    fill(sheet, el, true);
    var row = document.createElement('div'); row.className = 'pv-actions';
    var go;
    if (el.tagName === 'A') { go = document.createElement('a'); go.href = el.getAttribute('href'); }
    else { go = document.createElement('button'); go.type = 'button'; go.addEventListener('click', function () { closeSheet(); bypass = true; el.click(); bypass = false; }); }
    go.className = 'btn btn-primary'; go.textContent = el.tagName === 'A' ? '자세히 보기 →' : '열기';
    var cl = document.createElement('button'); cl.type = 'button'; cl.className = 'btn btn-ghost'; cl.textContent = '닫기';
    cl.addEventListener('click', closeSheet);
    row.appendChild(go); row.appendChild(cl); sheet.appendChild(row);
    sheet.hidden = false; document.body.classList.add('pv-open'); go.focus();
  }
  if (pv && sheet) {
    document.querySelectorAll('[data-pv-t]').forEach(function (el) {
      el.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') showPv(el, ev.clientX); });
      el.addEventListener('pointerleave', hidePv);
      el.addEventListener('focus', function () { showPv(el, null); });
      el.addEventListener('blur', hidePv);
      el.addEventListener('click', function (ev) {
        if (bypass || !mq.matches) return;
        ev.preventDefault(); ev.stopImmediatePropagation(); hidePv(); openSheet(el);
      }, true);
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { hidePv(); closeSheet(); } });
    document.addEventListener('scroll', hidePv, true);
    window.addEventListener('resize', function () { hidePv(); if (!mq.matches) closeSheet(); });
  }
})();

/* 「↑ 맨 위로」 떠 있는 버튼: 스크롤이 내려가면 보이고, 누르면 맨 위로 */
(function () {
  var b = document.getElementById('to-top');
  if (!b) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function upd() { b.hidden = window.scrollY < 500; }
  window.addEventListener('scroll', upd, { passive: true }); upd();
  b.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var skip = document.querySelector('.skip'); if (skip) { skip.focus({ preventScroll: true }); }
  });
})();

/* ---- v4: 「자세히 보기 ▼ / 접기 ▲」 — 한 줄(작품 3개)을 넘으면 처음엔 한 줄만. JS가 꺼져 있으면 전부 보인다 ---- */
(function () {
  var uid = 0;
  document.querySelectorAll('[data-fold]').forEach(function (list) {
    var items = Array.prototype.slice.call(list.children);
    if (items.length < 2) return;
    if (!list.id) list.id = 'fold-auto-' + (++uid);
    var wrap = document.createElement('div'); wrap.className = 'fold-more';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tgl';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', list.id);
    wrap.appendChild(btn); list.parentNode.insertBefore(wrap, list.nextSibling);
    function rowCount() {
      items.forEach(function (it) { it.hidden = false; });
      var top = items[0].offsetTop, n = 0;
      items.forEach(function (it) { if (it.offsetTop === top) n++; });
      return n > 1 ? n : 3;
    }
    function apply() {
      var open = btn.getAttribute('aria-expanded') === 'true', n = rowCount(), over = items.length > n;
      wrap.hidden = !over;
      items.forEach(function (it, i) { it.hidden = !open && over && i >= n; });
      btn.textContent = open ? '접기 ▲' : '자세히 보기 ▼';
    }
    btn.addEventListener('click', function () {
      btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true')); apply();
    });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(apply, 150); });
    apply();
  });
  /* 긴 설명 글: 3줄을 넘으면 처음엔 3줄만 */
  document.querySelectorAll('p.clampable').forEach(function (p) {
    p.classList.add('clamped');
    if (p.scrollHeight <= p.clientHeight + 1) { p.classList.remove('clamped'); return; }
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tgl clamp-btn';
    btn.setAttribute('aria-expanded', 'false'); btn.textContent = '자세히 보기 ▼';
    p.parentNode.insertBefore(btn, p.nextSibling);
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      p.classList.toggle('clamped', !open); btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? '접기 ▲' : '자세히 보기 ▼';
    });
  });
})();

/* ---- v4: 영상 카드 호버/포커스 시 음소거로 처음부터 자동 재생, 떼면 정지하고 포스터로 초기화(움직임 줄이기 설정이면 클릭 재생) ---- */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.vidcard').forEach(function (card) {
    var v = card.querySelector('video');
    if (!v) return;
    v.muted = true;
    if (reduce) { card.classList.add('rm'); v.controls = true; v.removeAttribute('aria-hidden'); v.removeAttribute('tabindex'); return; }
    /* 소리 있는 영상: 브라우저는 사용자가 페이지를 한 번이라도 누른 뒤에만 소리 있는 자동재생을 허용한다.
       허용되면 소리와 함께, 아니면 음소거로 재생하고 눌러서 들어가면 상세 페이지에서 소리와 함께 재생한다. */
    var snd = v.hasAttribute('data-sound');
    function start() {
      v.currentTime = 0;
      var ok = snd && navigator.userActivation && navigator.userActivation.hasBeenActive;
      v.muted = !ok; v.volume = ok ? 0.6 : 1;
      var p = v.play();
      if (p && p.catch) p.catch(function () { v.muted = true; var q = v.play(); if (q && q.catch) q.catch(function () {}); });
    }
    function stop() { v.pause(); v.muted = true; v.load(); }
    card.addEventListener('pointerenter', start); card.addEventListener('pointerleave', stop);
    card.addEventListener('focusin', start); card.addEventListener('focusout', stop);
  });
})();

/* ---- v4: 상단 「AI 작업물 ▾」 하위 메뉴: aria-expanded 갱신, Esc로 닫기 ---- */
(function () {
  document.querySelectorAll('.nav-dd').forEach(function (dd) {
    var top = dd.querySelector('.dd-top');
    function set(v) { top.setAttribute('aria-expanded', String(v)); }
    function open() { dd.classList.remove('closed'); set(true); }
    dd.addEventListener('mouseenter', open); dd.addEventListener('focusin', open);
    dd.addEventListener('mouseleave', function () { set(false); });
    dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) set(false); });
    dd.addEventListener('keydown', function (e) { if (e.key === 'Escape') { dd.classList.add('closed'); set(false); top.focus(); } });
  });
})();
