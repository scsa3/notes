(() => {
  'use strict';
  const data = window.GAMES_DATA;
  if (!data) return;
  const libraryById = new Map(data.library.map(game => [game.appid, game]));
  const recommendationById = new Map(data.recommendations.map(game => [game.appid, game]));
  const wishlist = data.wishlist.map(game => ({...game, ownership: libraryById.get(game.appid), recommendation: recommendationById.get(game.appid)}));
  const wishlistById = new Map(wishlist.map(game => [game.appid, game]));
  const recommendations = data.recommendations.filter(rec => wishlistById.has(rec.appid)).map(rec => ({...wishlistById.get(rec.appid), ...rec}));
  const sources = {library: data.library, wishlist, recommendations};
  const defaults = {library: 'hours', wishlist: 'price', recommendations: 'rank'};
  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();
  const compareNumber = (a, b, direction = 1) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return (a - b) * direction;
  };
  const isSale = row => row.price != null && row.price > 0 && row.discount > 0;
  function selectRows(tab, state = {}) {
    const query = normalize(state.query).trim();
    const filter = state.filter || 'all';
    const quick = state.quick || 'all';
    const rows = sources[tab].filter(row => {
      if (query && !normalize(row.name).includes(query)) return false;
      if (tab === 'library') {
        if (filter === 'owned' && !row.owned) return false;
        if (filter === 'shared' && row.owned) return false;
        if (quick === 'played' && !(row.hours > 0)) return false;
        if (quick === 'long' && !(row.hours >= 50)) return false;
        if (quick === 'unknown' && row.hours != null) return false;
      } else {
        if (tab === 'recommendations' && filter !== 'all' && row.category !== filter) return false;
        if (tab === 'wishlist' && filter === 'sale' && !isSale(row)) return false;
        if (tab === 'wishlist' && filter === 'recommended' && !row.recommendation) return false;
        if (tab === 'wishlist' && filter === 'available' && !row.ownership) return false;
        if (quick === '200' && !(row.price != null && row.price <= 200)) return false;
        if (quick === '500' && !(row.price != null && row.price <= 500)) return false;
        if (quick === '50' && !(row.discount >= 50 && row.price > 0)) return false;
      }
      return true;
    });
    const sort = state.sort || defaults[tab];
    return rows.sort((a, b) => {
      let result = 0;
      if (sort === 'hours') result = compareNumber(a.hours, b.hours, -1);
      else if (sort === 'reviews') result = compareNumber(a.reviewPercent, b.reviewPercent, -1) || compareNumber(a.reviewCount, b.reviewCount, -1);
      else if (sort === 'price') result = compareNumber(a.price, b.price);
      else if (sort === 'discount') result = compareNumber(a.discount, b.discount, -1);
      else if (sort === 'recent') result = compareNumber(a.lastPlayed ? Date.parse(a.lastPlayed) : null, b.lastPlayed ? Date.parse(b.lastPlayed) : null, -1);
      else if (sort === 'added') result = compareNumber(a.added ? Date.parse(a.added) : null, b.added ? Date.parse(b.added) : null, -1);
      else if (sort === 'rank') result = compareNumber(a.rank, b.rank);
      else if (sort === 'name') result = a.name.localeCompare(b.name, 'zh-Hant');
      return result || a.appid - b.appid;
    });
  }
  const formatHours = value => value == null ? '尚無紀錄' : `${value.toLocaleString('zh-TW', {maximumFractionDigits: 1})} 小時`;
  const reviewSummary = row => row.reviewPercent == null
    ? row.reviewStatus === 'no_reviews' ? '尚無評論' : row.reviewStatus === 'lookup_failed' ? '評價未取得' : '評價未提供'
    : `${row.reviewDescription || '整體評價'} · ${row.reviewPercent}% 正面`;
  // Pure operations are also used by the local verification script.
  window.GameCollection = {selectRows, formatHours, compareNumber, isSale, reviewSummary};
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const url = appid => `https://store.steampowered.com/app/${appid}/?cc=tw`;
  const art = appid => recommendationById.get(appid)?.headerImage || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  const date = (value, withTime = false) => value ? new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', year:'numeric',month:'2-digit',day:'2-digit',...(withTime ? {hour:'2-digit',minute:'2-digit',hour12:false} : {})}).format(new Date(value)) : '—';
  const price = row => row.price == null ? '價格未提供' : row.price === 0 ? '免費' : `${row.currency === 'TWD' ? 'NT$' : row.currency || ''} ${row.price.toLocaleString('zh-TW', {maximumFractionDigits: 2})}`;
  const oldPrice = row => row.price != null && row.originalPrice != null && row.originalPrice > row.price ? `${row.currency === 'TWD' ? 'NT$' : row.currency || ''} ${row.originalPrice.toLocaleString('zh-TW')}` : '';
  const state = {tab: 'recommendations', query:'',filter:'all',quick:'all',sort:'rank',page:1};
  const pageSize = 30;
  const configs = {
    recommendations: {eyebrow:'A GOOD NEXT GAME',title:'這次，從這幾款開始。',description:'依遊玩偏好挑選，價格為查詢當下的快照。',filters:[['all','所有玩法'],...new Set(recommendations.map(rec => rec.category))].map(item => typeof item === 'string' ? [item,item] : item), sorts:[['rank','按推薦順序'],['price','價格：由低到高'],['discount','折扣：由高到低'],['reviews','正面評價：由高到低']], quick:[['all','全部推薦'],['200','NT$200 以下'],['500','NT$500 以下'],['50','折扣 50% 以上']]},
    library: {eyebrow:'WORLDS ALREADY WITH YOU',title:'每個世界，都可以再回去。',description:'依本人的遊玩時數整理，也包含家庭可玩的遊戲。',filters:[['all','全部遊戲'],['owned','自己擁有'],['shared','家庭可玩']],sorts:[['hours','時數：由多到少'],['recent','最近遊玩'],['reviews','正面評價：由高到低'],['name','遊戲名稱']],quick:[['all','全部時數'],['played','有遊玩紀錄'],['long','50 小時以上'],['unknown','尚無紀錄']]},
    wishlist: {eyebrow:'SOMEDAY, MAYBE TODAY',title:'留在心上的下一款。',description:'願望清單與台灣商店價格，一起慢慢挑。',filters:[['all','全部願望清單'],['sale','有折扣（快照）'],['recommended','本次推薦'],['available','遊戲庫已可玩']],sorts:[['price','價格：由低到高'],['discount','折扣：由高到低'],['reviews','正面評價：由高到低'],['added','最近加入'],['name','遊戲名稱']],quick:[['all','所有價格'],['200','NT$200 以下'],['500','NT$500 以下'],['50','折扣 50% 以上']]},
  };
  const options = rows => rows.map(([value,label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
  function configure() {
    const config = configs[state.tab];
    $('section-eyebrow').textContent = config.eyebrow;
    $('section-title').textContent = config.title;
    $('section-description').textContent = config.description;
    $('filter').innerHTML = options(config.filters);
    $('filter-label').textContent = state.tab === 'library' ? '擁有方式' : state.tab === 'recommendations' ? '遊戲玩法' : '願望清單分類';
    $('sort').innerHTML = options(config.sorts);
    $('sort').value = state.sort;
    $('quick-filters').innerHTML = config.quick.map(([value,label]) => `<button type="button" data-quick="${value}" aria-pressed="${value === state.quick}">${label}</button>`).join('');
    const expired = new Date() >= new Date(data.recommendationSaleEnd);
    $('snapshot-notice').hidden = state.tab === 'library';
    $('snapshot-notice').textContent = expired
      ? `這是 ${date(data.updated)} 的價格快照。當次推薦優惠期限已過，購買前請到 Steam 確認最新價格。`
      : `價格快照：${date(data.updated, true)}。本次推薦的優惠標示至 ${date(data.recommendationSaleEnd, true)}，以 Steam 購買頁為準。`;
  }
  function reviewMarkup(row) {
    const available = row.reviewPercent != null;
    const title = `整體評價（所有語言）${row.reviewChecked ? ` · 查詢於 ${date(row.reviewChecked, true)}` : ''}`;
    return `<div class="review-summary${available ? '' : ' missing-review'}" title="${escape(title)}"><span>${escape(reviewSummary(row))}</span>${available && row.reviewCount != null ? `<small>${row.reviewCount.toLocaleString('zh-TW')} 則評論</small>` : ''}</div>`;
  }
  function recommendationCard(row) {
    return `<article class="game-card"><div class="game-art"><span class="art-fallback" aria-hidden="true">CHAPTER ${String(row.rank).padStart(2,'0')}</span><img src="${art(row.appid)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="rank-badge">${String(row.rank).padStart(2,'0')} / ${escape(row.label)}</span>${row.discount > 0 ? `<span class="discount-badge">−${row.discount}%</span>` : ''}</div><div class="card-body"><div class="category"><span>${escape(row.category)}</span><span>願望清單精選</span></div><h3><a href="${url(row.appid)}" target="_blank" rel="noopener noreferrer">${escape(row.name)}</a></h3>${reviewMarkup(row)}<p class="card-reason">${escape(row.reason)}</p><div class="evidence"><span class="evidence-label">喜歡的線索 · 本人遊玩時間</span>${row.evidence.map(e => `<p><span>${escape(e.name)}</span><strong>${e.hours == null ? '尚無紀錄' : `${Math.round(e.hours)} h`}</strong></p>`).join('')}</div><div class="card-bottom"><div>${oldPrice(row) ? `<span class="price-old">${escape(oldPrice(row))}</span>` : ''}<span class="price-main">${escape(price(row))}</span></div><a class="store-link" href="${url(row.appid)}" target="_blank" rel="noopener noreferrer">到商店看看 ↗</a></div>${row.offer && row.offer !== row.name ? `<p class="card-offer">購買方案：${escape(row.offer)}</p>` : ''}</div></article>`;
  }
  function nameCell(row) {
    const tags = state.tab === 'wishlist' ? `${row.recommendation ? '<span class="tag recommended">本次推薦</span>' : ''}${row.ownership ? `<span class="tag ${row.ownership.owned ? '' : 'shared'}">${row.ownership.owned ? '已擁有' : '家庭可玩'}</span>` : ''}` : '';
    return `<div class="table-name"><img class="table-art" src="${art(row.appid)}" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="name-copy"><a href="${url(row.appid)}" target="_blank" rel="noopener noreferrer">${escape(row.name || `App ${row.appid}`)}</a>${tags ? `<div class="row-labels">${tags}</div>` : ''}${state.tab === 'wishlist' && row.offer && row.offer !== row.name ? `<small>方案：${escape(row.offer)}</small>` : ''}</div></div>`;
  }
  function table(rows) {
    const library = state.tab === 'library';
    const heading = library ? '<th scope="col">擁有方式</th><th scope="col">本人遊玩時間</th><th scope="col">最近遊玩</th>' : '<th scope="col">快照售價</th><th scope="col">折扣</th><th scope="col">加入日期</th>';
    return `<div class="table-wrap"><table class="game-table"><thead><tr><th scope="col">遊戲</th>${heading}<th scope="col">整體評價</th><th scope="col"><span class="sr-only">Steam 商店</span></th></tr></thead><tbody>${rows.map(row => {
      const middle = library ? `<td><span class="tag ${row.owned ? '' : 'shared'}">${row.owned ? '自己擁有' : '家庭可玩'}</span></td><td class="hours-cell">${row.hours == null ? '<span class="unknown">尚無紀錄</span>' : `<strong>${escape(formatHours(row.hours))}</strong><span class="hours-bar" aria-hidden="true"><i style="width:${Math.min(100,row.hours/350*100)}%"></i></span>`}</td><td class="date-cell">${row.lastPlayed ? date(row.lastPlayed) : '—'}</td>` : `<td><span class="table-price">${escape(price(row))}${oldPrice(row) ? `<small><s>${escape(oldPrice(row))}</s></small>` : ''}</span></td><td>${row.discount > 0 ? `<span class="table-discount">−${row.discount}%</span>` : '<span class="unknown">—</span>'}</td><td class="date-cell">${date(row.added)}</td>`;
      return `<tr><td>${nameCell(row)}</td>${middle}<td class="review-cell">${reviewMarkup(row)}</td><td><a class="table-link" href="${url(row.appid)}" target="_blank" rel="noopener noreferrer" aria-label="查看 ${escape(row.name)} 的 Steam 商店頁">↗</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function render() {
    const allRows = selectRows(state.tab, state);
    const pages = Math.max(1,Math.ceil(allRows.length/pageSize));
    state.page = Math.min(state.page,pages);
    const rows = allRows.slice((state.page-1)*pageSize,state.page*pageSize);
    $('result-count').textContent = `顯示 ${allRows.length.toLocaleString()} / ${sources[state.tab].length.toLocaleString()} 款`;
    $('empty-state').hidden = allRows.length > 0;
    $('results').innerHTML = allRows.length ? state.tab === 'recommendations' ? `<div class="recommendation-grid">${rows.map(recommendationCard).join('')}</div>` : table(rows) : '';
    $('pagination').hidden = pages === 1;
    $('page-label').textContent = `${state.page} / ${pages} 頁`;
    $('previous-page').disabled = state.page === 1;
    $('next-page').disabled = state.page === pages;
  }
  function reset() {
    state.query = ''; state.filter = 'all'; state.quick = 'all'; state.page = 1; state.sort = defaults[state.tab];
    $('search').value = ''; configure(); render();
  }
  function changeTab(tab, focus = false) {
    state.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === tab;
      button.setAttribute('aria-selected',selected);
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    $('collection-panel').setAttribute('aria-labelledby',`tab-${tab}`);
    reset();
    history.replaceState(null,'',`#${tab}`);
  }
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click',() => changeTab(button.dataset.tab));
    button.addEventListener('keydown', event => {
      const tabs = ['recommendations','library','wishlist'];
      let index = tabs.indexOf(state.tab);
      if (event.key === 'ArrowRight') index = (index+1)%tabs.length;
      else if (event.key === 'ArrowLeft') index = (index+2)%tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = 2;
      else return;
      event.preventDefault(); changeTab(tabs[index],true);
    });
  });
  $('search').addEventListener('input',event => {state.query=event.target.value;state.page=1;render();});
  $('filter').addEventListener('change',event => {state.filter=event.target.value;state.page=1;render();});
  $('sort').addEventListener('change',event => {state.sort=event.target.value;state.page=1;render();});
  $('quick-filters').addEventListener('click',event => {
    const button = event.target.closest('[data-quick]');
    if (!button) return;
    state.quick=button.dataset.quick;state.page=1;
    document.querySelectorAll('[data-quick]').forEach(item => item.setAttribute('aria-pressed',item === button));
    render();
  });
  $('results').addEventListener('error',event => {if(event.target.tagName === 'IMG') event.target.hidden=true;},true);
  $('previous-page').addEventListener('click',() => {state.page--;render();$('collection-panel').scrollIntoView({block:'start'});});
  $('next-page').addEventListener('click',() => {state.page++;render();$('collection-panel').scrollIntoView({block:'start'});});
  $('reset').addEventListener('click',reset);
  const owned = data.library.filter(game => game.owned).length;
  $('owned-count').textContent = owned.toLocaleString();
  $('shared-count').textContent = (data.library.length-owned).toLocaleString();
  $('wishlist-count').textContent = wishlist.length.toLocaleString();
  $('recommended-count').textContent = recommendations.length;
  $('tab-library-count').textContent = data.library.length;
  $('tab-wishlist-count').textContent = wishlist.length;
  $('tab-recommendations-count').textContent = recommendations.length;
  $('updated-at').textContent = date(data.updated);
  $('updated-at').dateTime = data.updated;
  $('library-updated').textContent = date(data.libraryUpdated,true);
  $('wishlist-updated').textContent = date(data.wishlistUpdated,true);
  $('reviews-updated').textContent = date(data.reviewsUpdated,true);
  const initial = location.hash.slice(1);
  if (initial in sources) changeTab(initial); else {configure();render();}
})();
