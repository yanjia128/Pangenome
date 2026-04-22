# Home / Analsis 缺少靜態資料清單

以下檔案是 `home.tsx`、`analsis.tsx` 目前會讀取的靜態資料。  
請將檔案放到 `frontend/public` 底下對應路徑，建置後會自動複製到 `static/frontend/`。

| 類型 | 需要檔案 | 專案內路徑 | 對應頁面/用途 |
|---|---|---|---|
| 資料腳本 | `data.js`（需包含 `window.PANGENOME_DATA`） | `frontend/public/pangenome/data.js` | Home 頁面所有 Pangenome 圖表資料 |
| 資料腳本 | `ks_data.js`（需包含 `window.KS_DATA`） | `frontend/public/pangenome/ks_data.js` | Analsis 頁面 Ks 熱圖、dotplot 物種列表與分佈資料 |
| 圖片 | `species_tree.png` | `frontend/public/pangenome/img/species_tree.png` | Analsis 頁面 Species Phylogeny 圖 |
| 圖片群組 | `*.png`（物種對 dotplot 圖） | `frontend/public/pangenome/img/dotplots/` | Analsis 頁面物種對點圖 |
| 圖片 | `Dnobile_vs_all_dotplots.png` | `frontend/public/pangenome/img/dotplots/Dnobile_vs_all_dotplots.png` | Analsis 頁面「全覽（D. nobile × 25）」圖 |

## Dotplot 檔名規則

- 主要規則：`{speciesA}.{speciesB}.png`
- 備援規則：若主檔名找不到，會自動嘗試 `{speciesB}.{speciesA}.png`

## 目前可直接拷貝的來源（你可自行抓檔）

- `frontend/lib/pages/data.js` → 複製到 `frontend/public/pangenome/data.js`
- `frontend/lib/pages/ks_data.js` → 複製到 `frontend/public/pangenome/ks_data.js`
- 圖片目前在專案內未找到，需你自行補齊到 `frontend/public/pangenome/img/...`

## 目前程式中的外部依賴

- Plotly 目前由 CDN 載入：`https://cdn.plot.ly/plotly-2.27.0.min.js`
- 若你的執行環境不能連外，需改成本地 Plotly 檔案或改用 npm 套件載入。
