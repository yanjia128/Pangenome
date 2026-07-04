# DGA Interactive Plots & Configurable Thresholds — Change Log

## Overview

將差異基因分析 (Differential Gene Analysis) 的結果從靜態圖片改為前端互動式 Plotly 散點圖，並將顯著性門檻值 (FDR, |log2FC|) 從 R 腳本中的硬編碼改為全端可配置參數。

---

## 1. R Script — 新增 `--fdr` / `--logfc` 命令列參數

### `backend/R/edgeR.R`

- 新增 `--fdr`（預設 0.05）和 `--logfc`（預設 1）兩個 CLI 選項。
- `is_significant` 判斷改用 `opt$fdr` / `opt$logfc` 取代硬編碼值。
- Volcano Plot / MA Plot 標題動態顯示門檻值。
- Volcano Plot 虛線 (`geom_vline`, `geom_hline`) 使用動態門檻值。

### `backend/R/deseq2.R`

- 同樣新增 `--fdr`（預設 0.05）和 `--logfc`（預設 1）兩個 CLI 選項。
- `res_df$is_sig` 判斷改用 `opt$fdr` / `opt$logfc`。
- MA Plot / Volcano Plot 標題與虛線同步使用動態門檻值。

**使用範例：**

```bash
Rscript edgeR.R   --counts counts.csv --metadata meta.csv --fdr 0.03 --logfc 2
Rscript deseq2.R  --counts counts.csv --metadata meta.csv --fdr 0.03 --logfc 2
```

---

## 2. Python Runner — 傳遞參數 & 回傳 CSV 路徑

### `backend/R/run_deg.py`

#### DESEQ2Runner

- `__init__` 新增 `fdr=0.05`, `logfc=1` 參數。
- `run_deseq2()` 將 `--fdr` / `--logfc` 傳入 R 腳本命令。
- `run_deseq2()` 回傳值新增 `csv_path`（DESeq2 結果 CSV 的 URL）。
- `check_cache()` 回傳值新增 `csv_path`。

#### EDGERRunner

- `__init__` 新增 `fdr=0.05`, `logfc=1` 參數。
- `run_edgeR()` 將 `--fdr` / `--logfc` 傳入 R 腳本命令。
- `run_edgeR()` 回傳值新增 `csv_path`（edgeR 結果 CSV 的 URL）。
- `check_cache()` 回傳值新增 `csv_path`。

---

## 3. Django Backend API

### `api/views/diff_gene_analysis.py`

- 從前端 request body 接收 `fdr`（預設 0.05）和 `logfc`（預設 1）。
- 建立 Runner 時傳入 `fdr` / `logfc`。
- Response 新增 `csv_path` 和 `method` 欄位。
- 快取命中 (cache hit) 時同樣回傳 `csv_path`。

**API Request 新增欄位：**

| 欄位    | 類型   | 預設值 | 說明             |
| ------- | ------ | ------ | ---------------- |
| `fdr`   | number | 0.05   | FDR 門檻值       |
| `logfc` | number | 1      | \|log2FC\| 門檻值 |

**API Response 新增欄位：**

| 欄位       | 類型   | 說明                          |
| ---------- | ------ | ----------------------------- |
| `csv_path` | string | 分析結果 CSV 檔案的 URL 路徑  |
| `method`   | string | 使用的分析方法 (edgeR/DESeq2) |

---

## 4. Frontend API Layer

### `frontend/lib/api/use-api.ts`

- `submitDifferentialExpression` payload 新增 `fdr: number` 和 `logfc: number`。
- Response 型別新增 `csv_path?: string` 和 `method?: string`。

---

## 5. Frontend Page — 互動式圖表 & UI

### `frontend/lib/pages/transcriptome.tsx`

#### 新增 Import

- `HiDownload` icon（下載按鈕圖示）。
- `loadPlotly`, `PlotlyLike`（從 `pangenome-data.tsx` 載入 Plotly.js）。

#### 新增 Helper Function

- `parseCsvResult(csvText)` — 解析 R 輸出的 CSV 文字為 JavaScript 物件陣列。

#### 新增 State

| State        | 類型                          | 說明                          |
| ------------ | ----------------------------- | ----------------------------- |
| `analysisFdr`   | `number`                   | 使用者選擇的 FDR 門檻值（預設 0.05） |
| `analysisLogfc` | `number`                   | 使用者選擇的 \|log2FC\| 門檻值（預設 1） |
| `csvData`       | `Record<string, string>[]` | 從後端取得的 CSV 解析資料     |
| `loadingCsv`    | `boolean`                  | CSV 資料載入中的緩衝狀態      |

#### 新增 Refs

| Ref              | 說明                    |
| ---------------- | ----------------------- |
| `volcanoPlotRef` | Volcano Plot 的 DOM ref |
| `maPlotRef`      | MA Plot 的 DOM ref      |
| `plotlyRef`      | Plotly 實例快取         |

#### 互動式 Plotly 圖表（`useEffect`）

當 `csvData` 更新時，自動：

1. 根據分析方法 (edgeR/DESeq2) 對應欄位名稱：
   - edgeR: `logFC`, `FDR`, `logCPM`
   - DESeq2: `log2FoldChange`, `padj`, `baseMean`
2. 依使用者設定的 FDR / logFC 門檻判斷顯著性，標記紅色/灰色。
3. 繪製 **Volcano Plot**（x: log2FC, y: -log10(p)）含門檻虛線。
4. 繪製 **MA Plot**（x: mean expression, y: log2FC）含 y=0 基準線。
5. 滑鼠 hover 顯示 Gene name, fold change, p-value。
6. 元件 unmount 時自動 `Plotly.purge()` 清理。

#### 三階段載入緩衝

| 階段                | 狀態               | 顯示內容                          |
| ------------------- | ------------------ | --------------------------------- |
| R 分析執行中        | `runningAnalysis`  | 藍色 spinner：「分析進行中，請稍候...」 |
| CSV 資料傳輸中      | `loadingCsv`       | 綠色 spinner：「正在載入分析結果資料...」 |
| 完成                | 兩者皆 `false`     | 顯示互動式 Plotly 圖表            |

#### FDR / |log2FC| 門檻值選擇器

將原本的自由輸入改為下拉選單：

- **FDR Threshold**: `0.03` / `0.05`（預設） / `0.07`
- **|log2FC| Threshold**: `0.5` / `1`（預設） / `2`

#### 下載功能

| 按鈕           | 位置               | 功能                                      |
| -------------- | ------------------ | ----------------------------------------- |
| Download CSV   | 結果區塊標題列右側 | 下載分析結果 CSV 原始檔案                 |
| PNG (Volcano)  | Volcano Plot 標題右側 | 透過 `Plotly.downloadImage` 匯出 PNG   |
| PNG (MA)       | MA Plot 標題右側      | 透過 `Plotly.downloadImage` 匯出 PNG   |

#### Fallback

若 CSV 載入失敗，仍會顯示後端生成的靜態 PNG 圖片（原有行為）。

---

## 檔案異動總覽

| 檔案路徑                                        | 異動類型 |
| ----------------------------------------------- | -------- |
| `backend/R/edgeR.R`                             | 修改     |
| `backend/R/deseq2.R`                            | 修改     |
| `backend/R/run_deg.py`                          | 修改     |
| `api/views/diff_gene_analysis.py`               | 修改     |
| `frontend/lib/api/use-api.ts`                   | 修改     |
| `frontend/lib/pages/transcriptome.tsx`          | 修改     |
