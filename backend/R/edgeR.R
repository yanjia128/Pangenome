#!/usr/bin/env Rscript
# 輸入參數說明：
# --counts    : 計數矩陣 CSV 檔案路徑
# --metadata  : 樣本資訊 CSV 檔案路徑 (需包含 condition 欄位)
# --outdir    : 輸出目錄 (預設為 ./edgeR_results)
# --prefix    : 輸出檔案物種前綴 (預設為 Vsh)
suppressPackageStartupMessages(library(optparse))
suppressPackageStartupMessages(library(edgeR))
suppressPackageStartupMessages(library(ggplot2))
suppressPackageStartupMessages(library(dplyr))
# 1. 設定參數
option_list <- list(
  make_option(c("-c", "--counts"), type="character", default=NULL, help="counts CSV 路徑"),
  make_option(c("-m", "--metadata"), type="character", default=NULL, help="metadata CSV 路徑"),
  make_option(c("-d", "--outdir"), type="character", default="./edgeR_results", help="輸出目錄"),
  make_option(c("-p", "--prefix"), type="character", default="Vsh", help="檔案前綴")
)

opt_parser <- OptionParser(option_list=option_list)
opt <- parse_args(opt_parser)

if (is.null(opt$counts) || is.null(opt$metadata)) {
  print_help(opt_parser)
  stop("錯誤：請提供 --counts 與 --metadata 參數。", call.=FALSE)
}

if (!dir.exists(opt$outdir)) dir.create(opt$outdir, recursive = TRUE)

# 2. 讀取資料
counts_data <- read.csv(opt$counts, row.names=1)
meta_data <- read.csv(opt$metadata, row.names=1)

# 確保 metadata 的 condition 是 Factor，這會決定比較的方向
# 預設會是字母排序，例如 Control vs Treatment
group <- as.factor(meta_data$condition)

# 3. edgeR 流程：Exact Test
message("--- 執行 edgeR Exact Test 流程 ---")

# 建立 DGEList 物件
y <- DGEList(counts=counts_data, group=group)

# 執行過濾 (使用 edgeR 推薦的 filterByExpr)
keep <- filterByExpr(y)
y <- y[keep, , keep.lib.sizes=FALSE]

# 標準化 (TMM)
y <- calcNormFactors(y)

# 估算離散度 (Dispersion) - Exact Test 必經步驟
# 它會估算 Common, Trended, Tagwise dispersion
# y <- estimateDisp(y) 
# et <- exactTest(y) 
# --- 核心修改：執行 Exact Test ---
# 這裡會比較 group 中的兩個層級
bcv <- 0.2  
et <- exactTest(y, dispersion = bcv^2)


# 取得所有結果並排序
res_all <- topTags(et, n = Inf)
res_table <- as.data.frame(res_all)

# 4. 輸出結果
csv_out <- file.path(opt$outdir, paste0(opt$prefix, "_edgeR_exactTest.csv"))
write.csv(res_table, file=csv_out)

message(paste("分析完成！結果已存至:", csv_out))
message(paste("保留基因數:", nrow(y)))
volcano_data <- res_table %>%
  mutate(is_significant = ifelse(FDR < 0.05 & abs(logFC) > 1, "Yes", "No"))
p1 <- ggplot(volcano_data, aes(x = logFC, y = -log10(FDR), color = is_significant)) +
  geom_point(alpha = 0.6, size = 1.5) +
 theme_minimal() +
 scale_color_manual(values = c("grey", "red")) + 
 labs(title = "Volcano Plot by edgeR(P < 0.05 & |log2FC| > 1)",
       x = "Log2 Fold Change",
       y = "-Log10 adjust-P") +
  geom_vline(xintercept = c(-1, 1), linetype = "dashed") +
  geom_hline(yintercept = -log10(0.05), linetype = "dashed")
ggsave(file.path(opt$outdir, paste0(opt$prefix, "_edgeR_Volcano.png")), plot = p1, width = 8, height = 6, dpi = 300)
message(paste("火山圖已儲存至:", file.path(opt$outdir, paste0(opt$prefix, "_edgeR_Volcano.png"))))
# 5. 繪製 MA Plot
p2 <- ggplot(volcano_data, aes(x = logCPM, y = logFC, color = is_significant)) +
  geom_point(alpha = 0.5, size = 1.2) + # alpha 設透明度，避免點太擠
  scale_color_manual(values = c("Yes" = "red", "No" = "grey")) + 
  geom_hline(yintercept = 0, color = "black") + 
  theme_minimal() +
  labs(
    title = "MA Plot by edgeR(P < 0.05 & |log2FC| > 1)",
    x = "Average Log2 CPM",
    y = "Log2 Fold Change",
    color = "Significant"
  )
ggsave(file.path(opt$outdir, paste0(opt$prefix, "_edgeR_MA.png")), plot = p2, width = 8, height = 6, dpi = 300)
message(paste("MA 圖已儲存至:", file.path(opt$outdir, paste0(opt$prefix, "_edgeR_MA.png"))))