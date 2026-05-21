# 斛基對鑑（Dendrobium PhyloGenomics Compare）

> 石斛多物種比較基因組平台  
> 以 Django + React 建構，整合 **26 個石斛物種** 的親緣、基因組結構比較與轉錄體差異表現分析。

---

## 專案簡介

本專案是石斛 pangenome 網站，前端由 React/TypeScript 實作，後端由 Django + DRF 提供資料 API。  
目前前端核心重點為：

1. 物種親緣關係與基因樹視覺化（Phylogenetic tree）
2. 物種間基因組結構/同源關係比較（Orthogroup、Ks、Dotplot）
3. 差異表現分析流程（edgeR / DESeq2）
4. JBrowse 基因組瀏覽器整合

網路與部署連線說明請見：[docs/network-architecture.md](docs/network-architecture.md)

---

## 技術堆疊

| 層級 | 技術 |
| --- | --- |
| Frontend | React 19, TypeScript 5, React Router 6, Flowbite React, Tailwind CSS, Plotly, Phylocanvas, phyloxonium |
| Backend | Django, Django REST Framework, Token Authentication |
| Database | PostgreSQL |
| 建置工具 | Webpack 5, pnpm, Poetry |

---

## 伺服器營運方式統整（目前）

| 版本 | 主要用途 | 啟動方式 | 對外位址 |
| --- | --- | --- | --- |
| 原生開發版（目前主要） | 日常開發與資料調整 | `pnpm dev`（或 `pnpm dev:full`） | Frontend `:4000`、Backend `:8866` |
| Docker 版 | 模擬生產流程與容器化佈署 | `docker compose -f docker-compose.yml up` | Web `:8000`（含 postgres/memcached） |
| Bare-metal 舊版 | 歷史部署流程參考 | supervisor + nginx（見 `config/` 與 workflow） | 依主機設定 |

---

## 0.0.0.0 架設（雙版本）

### 1. 安裝相依

```bash
pnpm run bootstrap
```

### 2. 設定環境變數

1. 複製根目錄 `.env.example` 為 `.env`，填入資料庫與 Django 設定。  
2. 複製 `frontend/.env.example`，至少設定 `AUTH_TOKEN`（DRF Token）。

### 3A. 原生版本（你目前使用的方式）

```bash
pnpm dev
```

- Frontend: `http://0.0.0.0:4000`
- Backend API: `http://0.0.0.0:8866`
- 若需本地 PostgreSQL 容器：

```bash
pnpm dev:full
```

### 3B. Docker 版本（容器化）

```bash
docker compose -f docker-compose.yml -f docker-compose.localhost.yml up -d
```

- Web: `http://0.0.0.0:8000`
- 停止：

```bash
docker compose -f docker-compose.yml -f docker-compose.localhost.yml down
```

---

## Frontend 目前功能總覽

### 路由與功能

| 路由 | 頁面 | 目前功能 |
| --- | --- | --- |
| `/` | Landing | 首頁摘要、最新文章預覽 |
| `/home` | Pangenome Dashboard | 26 物種總覽統計、基因分類圓環圖、Pangenome/Core 累積曲線、物種別指標長條圖、Orthogroup overlap 熱圖、PCA、重複事件統計 |
| `/analysis` | Analysis Figures | 物種樹圖、Ortholog 熱圖與細節、26×26 Ks 中位數熱圖與分佈、兩兩物種 dotplot 與總覽圖 |
| `/orthogroups` | Orthogroups Table | Orthogroup 表格搜尋/分頁、欄位結果展開、FASTA 下載、可跳轉基因樹檢視 |
| `/phylocanvas` | Gene Tree Viewer | 以 gene tree ID 載入 Newick、切換 tree layout（Rectangular/Radial/Circular...）、節點子樹高亮 |
| `/phyloxonium` | Gene Tree Viewer (GL) | 以 phyloxonium 呈現替代版基因樹互動檢視 |
| `/transcriptome` | Differential Expression | 載入 counts 表格、搜尋/排序/分頁、選 control/comparison 樣本、自動選 edgeR/DESeq2、顯示 Volcano/MA 圖 |
| `/jbrowse` | Genome Browser | iframe 整合 JBrowse，啟動檢查與縮放操作 |
| `/blog` | Publications | 文章列表、搜尋 |
| `/blog/:publication` | Publication Detail | 單篇文章內容 |
| `/contact` | Contact | 聯絡資訊頁面 |

### 導覽列功能

- Home、Analysis、Phylogene Tree、Group、Differential Expression (DEG)、Genome Browser、Contact
- 外部工具連結：BLAST（開新分頁）

---

## Frontend 與後端 API 對接

前端 API client：`frontend/lib/api/use-api.ts`  
主要端點：

| API | 用途 |
| --- | --- |
| `/api/publications/` | 文章列表/分頁/篩選 |
| `/api/orthogroups/` | Orthogroup 表格資料（含搜尋與分頁） |
| `/api/gene-trees/` | Gene tree 清單 |
| `/api/gene-trees/{tree_id}/` | 單棵 gene tree Newick 內容 |
| `/api/differential-expression/` | 差異表現分析（edgeR/DESeq2） |

> API 需 Token 驗證，前端透過 `AUTH_TOKEN` 送出 `Authorization: Token ...`。

---

## 前端資料來源（目前實作）

| 類型 | 來源 |
| --- | --- |
| Pangenome 統計資料 | `frontend/lib/pages/data.ts`（內建於前端 bundle） |
| Ks 資料 | `frontend/lib/pages/ks_data.ts`（內建於前端 bundle） |
| Species tree 圖 | `frontend/public/species_tree.png` |
| Dotplot 圖群 | `frontend/public/dotplots/*.png` |
| Transcriptome table | `frontend/public/table/*_counts.tsv` |
| DEG 輸出圖（執行後） | `frontend/public/Data/DGA/...` |

---

## JBrowse 整合說明

- 前端頁面：`/jbrowse`
- 預設來源：`/dendrobium/syntney/`（`frontend/lib/pages/jbrowse.tsx`）
- 可用 `frontend/.env` 的 `JBROWSE_SERVER_URL` 覆寫
- 透過 Django 由路由 `^dendrobium/syntney/` 提供檔案（`core/urls.py`）
- 路徑可由根目錄 `.env` 的 `JBROWSE_DIR` 覆寫；未設定時預設 `../JBrowse2_MultiWay`

若有獨立 JBrowse 專案，可用：

```bash
pnpm run Jbrowse
```

> 也支援 `pnpm run jbrowse`（小寫別名）。
>
> 此啟動腳本會先檢查並停止占用 `9000` 的既有進程，再啟動 JBrowse 伺服器（備援用途）。  
> 可用環境變數覆寫：
> - `JBROWSE_DIR`：JBrowse 專案目錄（預設 `./../JBrowse2_MultiWay`）
> - `JBROWSE_PORT`：伺服器埠號（預設 `9000`）
> - `JBROWSE_BASE_PATH`：子路徑（預設 `/dendrobium/syntney`）

正式環境（方案 A）建議由 nginx 直接提供靜態檔案並做路徑分流：

- `/dendrobium/`：React
- `/dendrobium/syntney/`：JBrowse

此模式下不需要在正式環境額外啟動 `http-server`。

範例（請依你的實際目錄調整）：

```nginx
location /dendrobium/ {
    root /var/www;
    try_files $uri $uri/ /dendrobium/index.html;
}

location /dendrobium/syntney/ {
    alias /data/JBrowse2_MultiWay/;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

完整範例檔可參考：`config/nginx/dendrobium-path-routing.example.conf`

---

## 目錄重點

```text
frontend/
  lib/
    api/            # 前端 API client
    pages/          # 各功能頁面（home / analysis / transcriptome ...）
    routes/         # React Router 路由定義
    components/     # 共用元件
  public/
    dotplots/       # 物種對比 dotplot 圖
    table/          # transcriptome counts 檔
    species_tree.png
```

---

## 備註

- 本專案目前已從一般 boilerplate 擴充為石斛多物種比較平台，README 內容以現行功能為主。
- 若新增物種、dotplot、或 transcriptome library，請同步更新前端資料與頁面選單設定。
