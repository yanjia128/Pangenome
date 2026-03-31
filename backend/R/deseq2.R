# 輸入參數說明：
# --counts    : 計數矩陣 CSV 檔案路徑
# --metadata  : 樣本資訊 CSV 檔案路徑 (需包含 condition 欄位)
# --outdir    : 輸出目錄 (預設為 ./edgeR_results)
# --prefix    : 輸出檔案前綴 (預設為 Vsh)
# --size      : 最小群組樣本數 (預設為 3)

suppressPackageStartupMessages(library(optparse))
suppressPackageStartupMessages(library(DESeq2))
suppressPackageStartupMessages(library(ggplot2))
option_list <- list(
  make_option(c("-c", "--counts"), type="character", default=NULL, help="counts CSV 路徑"),
  make_option(c("-m", "--metadata"), type="character", default=NULL, help="metadata CSV 路徑"),
  make_option(c("-s", "--size"), type="integer", default=3, help="Smallest group size [預設 %default]"),
  make_option(c("-d", "--outdir"), type="character", default="./results", 
              help="圖片與結果儲存目錄 [預設 %default]", metavar="DIR"),
  make_option(c("-p", "--prefix"), type="character", default="Vsh", 
              help="檔案名稱前綴 (例如 Vsh) [預設 %default]", metavar="STR")
)

opt_parser <- OptionParser(option_list=option_list)
opt <- parse_args(opt_parser)

if (is.null(opt$counts) || is.null(opt$metadata)) {
  print_help(opt_parser)
  stop("錯誤：請提供 --counts 與 --metadata 參數。", call.=FALSE)
}
if (!dir.exists(opt$outdir)) {
  dir.create(opt$outdir, recursive = TRUE)
  message(paste("建立目錄:", opt$outdir))
}
csv_out     <- file.path(opt$outdir, paste0(opt$prefix, "_DESeq2_results.csv"))
ma_png_out  <- file.path(opt$outdir, paste0(opt$prefix, "_DESeq2_MA.png"))
vol_png_out <- file.path(opt$outdir, paste0(opt$prefix, "_DESeq2_Volcano.png"))

message("--- 讀取檔案中 ---")
counts <- read.csv(opt$counts, row.names=1)
df     <- read.csv(opt$metadata, row.names=1)
message(paste("使用的 smallestGroupSize:", opt$size))
# 執行物件建立與分析
dds <- DESeqDataSetFromMatrix(countData = counts,colData =df, design=~condition)
keep <- rowSums(counts(dds)>= 10 ) >= opt$size
dds<-dds[keep,]
dds <- DESeq(dds)
res <- results(dds)
summary(res)
write.csv(as.data.frame(res), file=csv_out)
res_df <- as.data.frame(res)
res_df$is_sig <- ifelse(res_df$padj < 0.05 & abs(res_df$log2FoldChange) > 1, "Yes", "No")
res_df$is_sig[is.na(res_df$is_sig)] <- "No"
p1 <- ggplot(res_df, aes(x = log10(baseMean), y = log2FoldChange, color = is_sig)) +
  geom_point(alpha = 0.6, size = 1.5) +
  theme_minimal() +
  scale_color_manual(values = c("grey", "red")) +
  geom_hline(yintercept = 0, color = "black", linewidth = 0.8) +
  labs(
    title = "MA Plot by DESeq2 with pvalue < 0.05 & |LFC| > 1",
    x = "log10(Mean Expression)",
    y = "log2(Fold Change)"
  ) + coord_cartesian(xlim = c(-5, 15), ylim = c(-15, 10))
ggsave(ma_png_out, plot=p1,width = 8, height = 6, dpi = 300)
p2 <- ggplot(res_df, aes(x = log2FoldChange, y = -log10(padj), color = is_sig)) +
  geom_point(alpha = 0.6, size = 1.5) +
  theme_minimal() +
  scale_color_manual(values = c("grey", "red")) +
  labs(
    title = "Volcano Plot by DESeq2 with pvalue < 0.05 & |LFC| > 1",
    x = "log2(Fold Change)",
    y = "-log10(adjust-P)"
  ) +
  geom_vline(xintercept = c(-1, 1), linetype = "dashed", color = "black") +
  geom_hline(yintercept = -log10(0.05), linetype = "dashed", color = "black") +
  coord_cartesian(xlim = c(-15, 10), ylim = c(0, 5))
ggsave(vol_png_out, plot = p2, width = 8, height = 6, dpi = 300)
message(paste("分析完成！檔案已儲存至:", opt$outdir))
message(paste("產生檔案:", basename(csv_out), ",", basename(ma_png_out), ",", basename(vol_png_out)))