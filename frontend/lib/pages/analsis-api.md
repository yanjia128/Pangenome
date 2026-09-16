# Analsis 頁面 API 使用紀錄

此頁面對外「不直接呼叫後端 REST API」。主要資料來源為前端內建資料與靜態資源。

| 類型 | 名稱/路徑 | 用途 |
| --- | --- | --- |
| 前端套件 | `plotly.js-dist-min` | 由前端 bundle 載入 Plotly（`loadPlotly`，非 CDN） |
| 前端資料模組 | `PANGENOME_DATA`（`frontend/lib/pages/data.js`） | 提供 orthogroup 與 overlap 等分析資料（`loadPangenomeData`） |
| 前端資料模組 | `KS_DATA`（`frontend/lib/pages/ks_data.js`） | 提供 Ks median 與 distribution 資料（`loadKsData`） |
| 靜態圖片 | `/pangenome/img/species_tree.png` | Species tree 圖 |
| 靜態圖片 | `/pangenome/img/dotplots/{speciesA}.{speciesB}.png` | 兩物種 dotplot（主路徑） |
| 靜態圖片 | `/pangenome/img/dotplots/{speciesB}.{speciesA}.png` | 兩物種 dotplot（fallback 路徑） |
| 靜態圖片 | `/pangenome/img/dotplots/Dnobile_vs_all_dotplots.png` | Dotplot 全覽圖 |

## 補充

- 目前 `analsis.tsx` 內沒有使用 `fetch()` 或 `useApi()` 去打 `/api/...` 端點。
- 若未來要改成即時後端 API，建議先在 `pangenome-data.tsx` 集中封裝請求邏輯，再由頁面呼叫。
