// Run with: node games/tools/test_reviews.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../assets/js/games.js'), 'utf8');
const context = vm.createContext({window: {GAMES_DATA: {
  library: [
    {appid: 1, name: '中文・日本語', hours: 87, owned: false, reviewPercent: 85, reviewCount: 30000, reviewDescription: '極度好評'},
    {appid: 2, name: 'Unknown', hours: null, reviewPercent: null, reviewCount: null},
    {appid: 3, name: 'Zero', hours: 0, reviewPercent: 0, reviewCount: 10, reviewDescription: '壓倒性負評'},
    {appid: 4, name: 'Small sample', hours: 10, reviewPercent: 85, reviewCount: 20},
  ],
  wishlist: [
    {appid: 1, name: '中文・日本語', price: 200, discount: 50, reviewPercent: 85, reviewCount: 30000},
    {appid: 5, name: 'Better rated', price: 500, discount: 30, reviewPercent: 98, reviewCount: 1000},
    {appid: 6, name: 'No reviews', price: null, reviewPercent: null, reviewStatus: 'no_reviews'},
  ],
  recommendations: [{appid: 1, rank: 1}, {appid: 5, rank: 2}],
}}});
vm.runInContext(script, context);
const api = context.window.GameCollection;
const ids = (tab, state) => Array.from(api.selectRows(tab, state), row => row.appid);
assert.deepEqual(ids('library', {sort:'reviews'}), [1, 4, 3, 2]);
assert.deepEqual(ids('wishlist', {sort:'reviews'}), [5, 1, 6]);
assert.deepEqual(ids('recommendations', {sort:'reviews'}), [5, 1]);
assert.deepEqual(ids('wishlist', {sort:'reviews',quick:'200'}), [1]);
assert.deepEqual(ids('library', {sort:'reviews',filter:'shared',query:'中文'}), [1]);
assert.equal(api.selectRows('library', {query:'中文'})[0].hours, 87);
assert.equal(api.reviewSummary({reviewPercent:0,reviewDescription:'壓倒性負評'}), '壓倒性負評 · 0% 正面');
assert.equal(api.reviewSummary({reviewPercent:null,reviewStatus:'no_reviews'}), '尚無評論');
assert.equal(api.reviewSummary({reviewPercent:null,reviewStatus:'lookup_failed'}), '評價未取得');
assert.equal(api.reviewSummary({}), '評價未提供');
assert.equal(api.reviewSummary({reviewPercent:85,reviewDescription:'極度好評'}), '極度好評 · 85% 正面');
console.log('Review sorting, sample-size ties, filters, missing values, and Unicode passed.');
