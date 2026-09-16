import os

import pandas as pd
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from backend.R.run_deg import DESEQ2Runner, EDGERRunner, DATA_DIR, TEMP_DIR


class DifferentialExpressionAnalysisEndpoint(APIView):
    """
    API endpoint for differential gene expression analysis
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        print(
            "From api.views.diff_gene_analysis. activate differential_expression_analysis"
        )
        try:
            # 1. 確保 body 有內容
            if not request.body:
                return Response(
                    {"error": "Empty request body"}, status=status.HTTP_400_BAD_REQUEST
                )

            # 2. 解析 JSON (這步會把 null 轉成 None)
            data = request.data
            species = data.get("species")
            print("Species:", species)
            method = data.get("method")
            size_ = data.get("size")
            fdr = float(data.get("fdr", 0.05))
            logfc = float(data.get("logfc", 1))
            meta_data = data.get("all_columns_map", [])
            print("Meta Columns:", meta_data)
            print("Method: {0}, Size: {1}.".format(method, size_))
            if not species:
                return Response(
                    {"error": "Missing required field: species"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if method not in {"edgeR", "DESeq2"}:
                return Response(
                    {"error": "Invalid method. Use edgeR or DESeq2."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(meta_data, list) or not meta_data:
                return Response(
                    {"error": "all_columns_map must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if method == "edgeR":
                runner = EDGERRunner(species, meta_data, fdr=fdr, logfc=logfc)
            else:
                runner = DESEQ2Runner(species, meta_data, size_, fdr=fdr, logfc=logfc)
            cache_result = runner.check_cache()
            if cache_result["exists"]:
                print("--- 找到快取，直接回傳 ---")
                return Response(
                    {
                        "status": "success",
                        "volcano_path": cache_result["volcano_path"],
                        "ma_path": cache_result["ma_path"],
                        "csv_path": cache_result.get("csv_path", ""),
                        "jobID": runner.job_id,
                        "cached": True,
                    }
                )
            print("--- 無快取，製作表格並執行分析中... ---")
            rows = []
            for item in meta_data:
                col_name = item["col"]
                status_value = item["stat"]

                if status_value == "control":
                    rows.append({"columns": col_name, "condition": "A"})
                elif status_value == "comparison":
                    rows.append({"columns": col_name, "condition": "B"})
            df = pd.DataFrame(rows, columns=["columns", "condition"])
            print(df["columns"].tolist())  # 供count table選擇欄位做使用
            # 測試：印出 DataFrame 看看結果
            print("--- Generated Design Matrix ---")
            print(df)
            df.to_csv(os.path.join(TEMP_DIR, "temp_meta.csv"), index=False)
            # 讀取表現量表格，並篩選必要欄位
            # Try to read as TSV first, then fall back to CSV
            count_file_tsv = os.path.join(DATA_DIR, "{0}_counts.tsv".format(species))
            count_file_csv = os.path.join(DATA_DIR, "{0}_counts.csv".format(species))

            if os.path.exists(count_file_tsv):
                df_count = pd.read_csv(count_file_tsv, sep="\t")
            elif os.path.exists(count_file_csv):
                df_count = pd.read_csv(count_file_csv)
            else:
                return Response(
                    {"error": f"Count file not found for species: {species}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            keep_cols = ["gene_id"] + df["columns"].dropna().tolist()
            # 避免 keep_cols 有些不在 count table 裡造成 KeyError #keep_existing = [c for c in keep_cols if c in df_count.columns]
            df_count_tmp = df_count[keep_cols]
            df_count_tmp.to_csv(os.path.join(TEMP_DIR, "temp_count.csv"), index=False)
            """
            輸入：
            TEMP_DIR/temp_count.csv
            TEMP_DIR/temp_meta.csv
            method 
            若兩個組別各選一個 則作edgeR -exact Test
            若選擇多個樣本 則使用Deseq2 並且根據樣本選擇最少邊 進行size輸入

            例如:image_path = '/static/DGA/Vsh/jobID/Vsh_MA.png'
            跑差異分析程式碼
            獲得結果圖片路徑
            """
            if method == "edgeR":
                analysis_results = runner.run_edgeR()
            else:
                analysis_results = runner.run_deseq2()
            return Response(
                {
                    "status": "success",
                    "volcano_path": analysis_results["volcano_path"],
                    "ma_path": analysis_results["ma_path"],
                    "csv_path": analysis_results.get("csv_path", ""),
                    "jobID": runner.job_id,
                    "method": method,
                }
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
