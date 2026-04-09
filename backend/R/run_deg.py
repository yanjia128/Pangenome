import subprocess
import time
import os

# 讀取計數矩陣和樣本資訊
# species = "Vsh"
# counts_path = "../table/Vsh_counts.csv"
# metadata_path = "../table/Vsh_metadata_2.csv"
"""
透過metadata製作目錄
"""

# Define base paths relative to project root
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
DATA_DIR = os.path.join(PROJECT_ROOT, "backend", "R", "Data", "table")
TEMP_DIR = os.path.join(DATA_DIR, "temp")
STATIC_DIR = os.path.join(PROJECT_ROOT, "frontend", "public", "Data", "DGA")

# Create temp directory if it doesn't exist
os.makedirs(TEMP_DIR, exist_ok=True)


class DESEQ2Runner:
    def __init__(self, species, status_list, size):
        print("Start DESEQ2Runner")
        self.species = species
        self.job_id = generate_job_id(status_list)
        self.size_ = size
        self.counts_path = os.path.join(TEMP_DIR, "temp_count.csv")
        self.metadata_path = os.path.join(TEMP_DIR, "temp_meta.csv")
        base_output_path = os.path.join(STATIC_DIR, species)
        self.output_path = os.path.join(base_output_path, self.job_id)
        os.makedirs(self.output_path, exist_ok=True)

    def run_deseq2(self):
        start = time.time()
        print("開始執行 DESeq2 分析...")
        conda_bin = "/home/user/miniforge3/envs/DGA/bin/Rscript"
        deseq2_script_path = os.path.join(os.path.dirname(__file__), "deseq2.R")
        R_script = """
        {conda_bin} {script_path} \
        --counts {self.counts_path} \
        --metadata {self.metadata_path} \
        --outdir {self.output_path} \
        --prefix {self.species} \
        --size {self.size_}
        """.format(self=self, conda_bin=conda_bin, script_path=deseq2_script_path)
        subprocess.run(R_script, shell=True, check=True)
        print("DESeq2 分析完成，總耗時: %.2f 秒" % (time.time() - start))
        return {
            "volcano_path": "/Data/DGA/{0}/{1}/{2}_DESeq2_MA.png".format(
                self.species, self.job_id, self.species
            ),
            "ma_path": "/Data/DGA/{0}/{1}/{2}_DESeq2_Volcano.png".format(
                self.species, self.job_id, self.species
            ),
        }

    def check_cache(self):
        """檢查是否有現成的圖片，若有則回傳網址路徑"""
        # 定義預期的檔名
        volcano_name = "{0}_DESeq2_Volcano.png".format(self.species)
        ma_name = "{0}_DESeq2_MA.png".format(self.species)

        # 實體路徑 (用於檢查)
        volcano_file = os.path.join(self.output_path, volcano_name)
        ma_file = os.path.join(self.output_path, ma_name)

        if os.path.exists(volcano_file) and os.path.exists(ma_file):
            # 構建網址路徑 (用於回傳前端)
            url_base = "/Data/DGA/{0}/{1}".format(self.species, self.job_id)
            return {
                "exists": True,
                "volcano_path": "{0}/{1}".format(url_base, volcano_name),
                "ma_path": "{0}/{1}".format(url_base, ma_name),
            }
        return {"exists": False}


class EDGERRunner:
    def __init__(self, species, status_list):
        self.species = species
        self.job_id = generate_job_id(status_list)
        self.counts_path = os.path.join(TEMP_DIR, "temp_count.csv")
        self.metadata_path = os.path.join(TEMP_DIR, "temp_meta.csv")
        base_output_path = os.path.join(STATIC_DIR, species)
        self.output_path = os.path.join(base_output_path, self.job_id)
        os.makedirs(self.output_path, exist_ok=True)

    def save_metadata(self):
        """儲存 metadata 檔案"""
        self.df_metadata.to_csv(self.metadata_path, index=True)
        print("Metadata 儲存至: {self.metadata_path}".format(self=self))

    def run_edgeR(self):
        start = time.time()
        print("開始執行 edgeR 分析...")
        conda_bin = "/home/user/miniforge3/envs/DGA/bin/Rscript"
        edge_r_script_path = os.path.join(os.path.dirname(__file__), "edgeR.R")
        R_script = """
        {conda_bin} {script_path} \
        --counts {self.counts_path} \
        --metadata {self.metadata_path} \
        --outdir {self.output_path} \
        --prefix {self.species}
        """.format(self=self, conda_bin=conda_bin, script_path=edge_r_script_path)
        subprocess.run(R_script, shell=True, check=True)
        print("edgeR 分析完成，總耗時: %.2f 秒" % (time.time() - start))
        return {
            "volcano_path": "/Data/DGA/{0}/{1}/{2}_edgeR_Volcano.png".format(
                self.species, self.job_id, self.species
            ),
            "ma_path": "/Data/DGA/{0}/{1}/{2}_edgeR_MA.png".format(
                self.species, self.job_id, self.species
            ),
        }

    def check_cache(self):
        """檢查是否有現成的圖片，若有則回傳網址路徑"""
        # 定義預期的檔名
        volcano_name = "{0}_edgeR_Volcano.png".format(self.species)
        ma_name = "{0}_edgeR_MA.png".format(self.species)

        # 實體路徑 (用於檢查)
        volcano_file = os.path.join(self.output_path, volcano_name)
        ma_file = os.path.join(self.output_path, ma_name)

        if os.path.exists(volcano_file) and os.path.exists(ma_file):
            # 構建網址路徑 (用於回傳前端)
            url_base = "/Data/DGA/{0}/{1}".format(self.species, self.job_id)
            return {
                "exists": True,
                "volcano_path": "{0}/{1}".format(url_base, volcano_name),
                "ma_path": "{0}/{1}".format(url_base, ma_name),
            }
        return {"exists": False}


def generate_job_id(column_status_list):
    """
    獨立函式：讀取 metadata 內的 X, A, B 欄位並產出 jobID 序列。
    """
    # 定義想要抓取的欄位
    mapping = {"control": "A", "comparison": "B", "unselected": "X"}

    # 2. 根據清單順序組合成字串
    # 例如: ['A', 'A', 'X', 'B', 'X'] -> "AAXBX"
    codes = []
    for item in column_status_list:
        status = item.get("stat", "unselected")
        codes.append(mapping.get(status, "X"))

    job_id = "".join(codes)

    # 3. 為了讓 jobID 具有唯一性，通常會加上時間戳記
    # 如果你只需要純 A/B/X 字串，拿掉 time 部分即可
    return job_id if job_id else "default_job"


if __name__ == "__main__":
    # species = "Vsh"
    # counts_path = "../table/{species}_counts.csv".format(species=species)
    # metadata_path = "../table/{species}_metadata_2.csv".format(species=species)
    # df_metadata = pd.read_csv(metadata_path, index_col=0)
    # job_id = 'test'

    # # DESeq2 分析
    # deseq2_runner = DESEQ2Runner(species, job_id, df_metadata, size=3)
    # deseq2_runner.run_deseq2()

    # # edgeR 分析
    # edger_runner = EDGERRunner(species, job_id, df_metadata)
    # edger_runner.save_metadata()  # 儲存 metadata 檔案
    # edger_runner.run_edgeR()
    selected_columns = [
        {"stat": "unselected", "col": "Root"},
        {"stat": "unselected", "col": "Column"},
        {"stat": "control", "col": "Floral"},
        {"stat": "control", "col": "Flower"},
        {"stat": "comparison", "col": "Leaf"},
        {"stat": "unselected", "col": "Lip"},
        {"stat": "unselected", "col": "NodeLeaf"},
        {"stat": "unselected", "col": "Pollinia"},
        {"stat": "unselected", "col": "Sepal"},
        {"stat": "unselected", "col": "Stem"},
    ]
    job_id = generate_job_id(selected_columns)
    print("Generated job ID:", job_id)
