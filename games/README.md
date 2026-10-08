# 遊戲手記

靜態網頁，包含本人與家庭可玩的遊戲、願望清單價格與整體評價，以及依高遊玩時數挑選的推薦。入口是 `games/index.html`，Notes 首頁也有連結。

搜尋、擁有方式、時數、價格與折扣篩選，以及正面評價百分比排序都在瀏覽器執行，不需要登入 Steam。價格與遊玩資料是快照；推薦是人工挑選，不會隨資料更新自動重選。

## 本機預覽

在 Notes 根目錄執行：

```sh
python3 -m http.server 8788 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8788/games/>。

## 更新資料

先在 Steam 匯出工具重新匯出遊戲庫、願望清單與價格。只更新評價時，可在匯出工具目錄執行以下指令，不需要 token：

```sh
uv run python -m steam_family_export --refresh-reviews
```

接著於 Notes 根目錄執行：

```sh
python3 games/tools/build_data.py \
  --library /path/to/steam_family_library.json \
  --wishlist /path/to/steam_wishlist.json \
  --prices /path/to/steam_wishlist_prices.csv
```

產生的 `games/assets/js/data.js` 只包含網頁需要的欄位，不複製 SteamID、家庭成員 ID、家庭群組 ID、token 或原始 API response。遊戲名稱、擁有狀態、本人時數與遊玩日期仍屬個人收藏資料，網站發布後訪客都能閱讀。

推薦內容在 `games/tools/build_data.py` 的 `RECOMMENDATIONS`；推薦日期與當次優惠期限也在該檔案，重新挑選時應一起更新。價格更新不代表舊推薦期限已延長。缺少時數顯示「尚無紀錄」，不會當成零小時，也不視為不喜歡。

## 檔案

- `index.html`：頁面與基本結構。
- `assets/css/games.css`：Notes 風格與響應式排版。
- `assets/js/games.js`：搜尋、篩選、排序、分頁與清單呈現。
- `assets/js/data.js`：可公開閱讀的收藏快照。
- `tools/build_data.py`：由匯出檔建立網頁資料。

## 評價

遊戲庫、願望清單與推薦卡片均顯示跨語言的整體正面百分比、Steam 評價描述（如「極度好評」）及評論數。按百分比排序時，比例相同者依評論數排序；缺少評價放在最後。評價日期與價格日期分開標示。

無評論顯示「尚無評論」；查不到資料顯示「評價未提供」或「評價未取得」，不顯示成 0%。真實 0% 會保留顯示。評價百分比只代表 Steam 商店整體評論，個人推薦仍採用高遊玩時數作為偏好線索。
