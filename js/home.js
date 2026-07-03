/* home.js — ホーム＋ピラーページ共通の挙動 */
(function(){

  // お気に入り♡トグル（カードのリンク遷移を止める）
  document.querySelectorAll('[data-save]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); el.classList.toggle('on'); });
  });

  // ピラータブ切替（ホームのパネル方式のみ。ピラーページはタブが<a>リンクなので対象外）
  var tabBtns = document.querySelectorAll('button.tab[data-tab]');
  var panels  = document.querySelectorAll('.panel[data-panel]');
  if (tabBtns.length && panels.length){
    tabBtns.forEach(function(t){
      t.addEventListener('click', function(){
        tabBtns.forEach(function(x){ x.classList.remove('active'); });
        t.classList.add('active');
        var key = t.dataset.tab;
        panels.forEach(function(p){ p.classList.toggle('active', p.dataset.panel === key); });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // 検索バー → explore へパラメータ付きで遷移
  document.querySelectorAll('form.searchbar').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      function val(name){ var el = form.querySelector('[name="'+name+'"]'); return el ? el.value.trim() : ''; }
      var area = val('area');
      var kw   = val('q');
      var intent = val('intent');
      var base = form.getAttribute('data-target') || 'explore/index.html';
      var params = new URLSearchParams();
      var q = [kw, area].filter(Boolean).join(' ').trim();
      if (q) params.set('q', q);
      if (area) params.set('area', area);
      if (intent) params.set('intent', intent);
      var qs = params.toString();
      window.location.href = base + (qs ? ('?' + qs) : '');
    });
  });

})();
