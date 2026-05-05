import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useApi } from "../api/use-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Button,
  Spinner
} from "flowbite-react";
import { HiSearch, HiChevronUp, HiChevronDown } from "react-icons/hi";
//需要新增tpkm表現量
type SpeciesOption = {
  label: string;
  tsvPath: string;
  backendSpecies: string;
};

type DiffMethod = "edgeR" | "DESeq2";

type ColumnStatus = {
  col: string;
  stat: "control" | "comparison" | "unselected";
};

type DiffResponse = {
  status?: string;
  volcano_path?: string;
  ma_path?: string;
  jobID?: string;
  cached?: boolean;
  error?: string;
};
//現有物種清單
const SPECIES_OPTIONS: SpeciesOption[] = [
  {
    label: "D. bullen",
    tsvPath: "/table/Dbullen_counts.tsv",
    backendSpecies: "Dbullen",
  },
  {
    label: "D. carini",
    tsvPath: "/table/Dcarini_counts.tsv",
    backendSpecies: "Dcarini",
  },
  {
    label: "D. exile",
    tsvPath: "/table/Dexile_counts.tsv",
    backendSpecies: "Dexile",
  },
  {
    label: "D. lindle",
    tsvPath: "/table/Dlindle_counts.tsv",
    backendSpecies: "Dlindle",
  },
  {
    label: "D. nobile",
    tsvPath: "/table/Dnobile_counts.tsv",
    backendSpecies: "Dnobile",
  },
  {
    label: "D. parcum",
    tsvPath: "/table/Dparcum_counts.tsv",
    backendSpecies: "Dparcum",
  },
  {
    label: "D. porphy",
    tsvPath: "/table/Dporphy_counts.tsv",
    backendSpecies: "Dporphy",
  },
  {
    label: "D. secund",
    tsvPath: "/table/Dsecund_counts.tsv",
    backendSpecies: "Dsecund",
  },
];

function parseTsv(tsvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = tsvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split("\t");
  const rows = lines.slice(1).map((line) => {
    const values = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });

  return { headers, rows };
}

function withCacheBuster(url: string): string {
  const timestamp = new Date().getTime();
  return `${url}?_t=${timestamp}`;
}

export default function TranscriptomePage() {
  const { submitDifferentialExpression } = useApi();

  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesOption>(SPECIES_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<{ headers: string[]; rows: Record<string, string>[] }>({
    headers: [],
    rows: [],
  });

  // Table state management
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const [columnStatuses, setColumnStatuses] = useState<ColumnStatus[]>([]);
  const [selectedControl, setSelectedControl] = useState<string[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<string[]>([]);
  const [showDiffAnalysis, setShowDiffAnalysis] = useState(false);

  const [analysisMethod, setAnalysisMethod] = useState<DiffMethod>("edgeR");
  const [analysisSize, setAnalysisSize] = useState<number>(0);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DiffResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string>("");

  const getMethodBySelection = useCallback(
    (controlCount: number, comparisonCount: number): DiffMethod =>
      controlCount > 1 || comparisonCount > 1 ? "DESeq2" : "edgeR",
    []
  );

  useEffect(() => {
    loadTableData();
  }, [selectedSpecies]);

  useEffect(() => {
    const method = getMethodBySelection(selectedControl.length, selectedComparison.length);
    const size = method === "DESeq2" ? Math.min(selectedControl.length, selectedComparison.length) : 0;
    setAnalysisMethod(method);
    setAnalysisSize(size);
  }, [selectedControl.length, selectedComparison.length, getMethodBySelection]);

  const loadTableData = async () => {
    setLoading(true);
    setShowDiffAnalysis(false);
    setColumnStatuses([]);
    setSelectedControl([]);
    setSelectedComparison([]);
    setAnalysisResult(null);
    setAnalysisError("");
    setSearchTerm("");
    setCurrentPage(1);
    setSortConfig(null);

    try {
      const response = await fetch(selectedSpecies.tsvPath);
      const text = await response.text();
      const { headers, rows } = parseTsv(text);
      setTableData({ headers, rows });

      const sampleColumns = headers.slice(2);
      const statuses: ColumnStatus[] = sampleColumns.map((col) => ({
        col,
        stat: "unselected",
      }));
      setColumnStatuses(statuses);
      setShowDiffAnalysis(true);
    } catch (error) {
      console.error("Failed to load TSV data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Search and filter logic
  const filteredData = useMemo(() => {
    if (!searchTerm) return tableData.rows;

    return tableData.rows.filter((row) => {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [tableData.rows, searchTerm]);

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Try to parse as numbers for numeric sorting
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String sorting
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  // Pagination logic
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startRecord = sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, sortedData.length);

  const handleSort = (columnKey: string) => {
    setSortConfig((current) => {
      if (current?.key === columnKey) {
        return {
          key: columnKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
    setCurrentPage(1); // Reset to first page when sorting
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleControlCheckbox = (col: string, checked: boolean) => {
    if (checked) {
      setSelectedControl([...selectedControl, col]);
      setSelectedComparison(selectedComparison.filter((c) => c !== col));
    } else {
      setSelectedControl(selectedControl.filter((c) => c !== col));
    }
  };

  const handleComparisonCheckbox = (col: string, checked: boolean) => {
    if (checked) {
      setSelectedComparison([...selectedComparison, col]);
      setSelectedControl(selectedControl.filter((c) => c !== col));
    } else {
      setSelectedComparison(selectedComparison.filter((c) => c !== col));
    }
  };

  const handleMethodChange = () => {
    const method = getMethodBySelection(selectedControl.length, selectedComparison.length);
    setAnalysisMethod(method);
    if (method === "DESeq2") {
      const size = Math.min(selectedControl.length, selectedComparison.length);
      setAnalysisSize(size);
    } else {
      setAnalysisSize(0);
    }
  };

  const handleRunAnalysis = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior and stop propagation
    e?.preventDefault();
    e?.stopPropagation();
    setAnalysisError("");

    if (selectedControl.length === 0 || selectedComparison.length === 0) {
      alert("請至少選擇一個控制組和一個對照組樣本！");
      return;
    }

    const allColumnsMap: ColumnStatus[] = columnStatuses.map((cs) => {
      if (selectedControl.includes(cs.col)) {
        return { ...cs, stat: "control" };
      } else if (selectedComparison.includes(cs.col)) {
        return { ...cs, stat: "comparison" };
      } else {
        return { ...cs, stat: "unselected" };
      }
    });

    const method = getMethodBySelection(selectedControl.length, selectedComparison.length);
    const size = method === "DESeq2" ? Math.min(selectedControl.length, selectedComparison.length) : 0;

    setAnalysisMethod(method);
    setAnalysisSize(size);
    setAnalysisResult(null); // 清空之前的分析結果圖片
    setRunningAnalysis(true);

    try {
      const response = await submitDifferentialExpression({
        species: selectedSpecies.backendSpecies,
        method,
        control_samples: selectedControl,
        comparison_samples: selectedComparison,
        all_columns_map: allColumnsMap,
        size: String(size),
      });

      if (!response || response.error) {
        throw new Error(response?.error ?? "Differential expression request failed.");
      }

      setAnalysisResult(response);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "差異分析失敗，請稍後再試。");
    } finally {
      setRunningAnalysis(false);
    }
  };

  return (
      <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transcriptome Analysis</h2>

      {/* Species Selection and Table Display Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Whole Gene Expression</h3>
        
        <div className="mb-4 flex gap-4 items-end">
          <div className="flex-shrink-0">
            <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Library:
            </label>
            <select
              id="species-select"
              className="block w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={selectedSpecies.label}
              onChange={(e) => {
                const species = SPECIES_OPTIONS.find((s) => s.label === e.target.value);
                if (species) setSelectedSpecies(species);
              }}
            >
              {SPECIES_OPTIONS.map((species) => (
                <option key={species.label} value={species.label}>
                  {species.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-grow">
            <label htmlFor="table-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search:
            </label>
            <TextInput
              id="table-search"
              type="text"
              icon={HiSearch}
              placeholder="Search in table..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="max-w-md"
            />
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading data...</p>
          </div>
        )}

        {!loading && tableData.headers.length > 0 && (
          <div>
            <div className="overflow-x-auto">
              <Table hoverable>
                <TableHead>
                  {tableData.headers.map((header) => (
                    <TableHeadCell
                      key={header}
                      onClick={() => handleSort(header)}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-1">
                        <span>{header}</span>
                        {sortConfig?.key === header && (
                          sortConfig.direction === "asc" ? (
                            <HiChevronUp className="w-4 h-4" />
                          ) : (
                            <HiChevronDown className="w-4 h-4" />
                          )
                        )}
                      </div>
                    </TableHeadCell>
                  ))}
                </TableHead>
                <TableBody className="divide-y">
                  {paginatedData.map((row, index) => (
                    <TableRow key={index}>
                      {tableData.headers.map((header) => (
                        <TableCell key={header}>{row[header]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {startRecord} to {endRecord} of {sortedData.length} entries
                {searchTerm && <span> (filtered from {tableData.rows.length} total entries)</span>}
              </div>

              <div className="flex gap-2 items-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        type="button"
                        key={pageNum}
                        size="sm"
                        color={currentPage === pageNum ? "blue" : "gray"}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ml-2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Differential Expression Analysis Section */}
      {showDiffAnalysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Differential Expression Analysis by Read Counts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Control Group */}
            <div>
              <h4 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">控制組 (Control Group)</h4>
              <div className="border border-gray-200 dark:border-gray-600 rounded p-4 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  {columnStatuses.map((cs) => (
                    <label key={cs.col} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedControl.includes(cs.col)}
                        onChange={(e) => handleControlCheckbox(cs.col, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cs.col}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison Group */}
            <div>
              <h4 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">對照組 (Comparison Group)</h4>
              <div className="border border-gray-200 dark:border-gray-600 rounded p-4 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  {columnStatuses.map((cs) => (
                    <label key={cs.col} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedComparison.includes(cs.col)}
                        onChange={(e) => handleComparisonCheckbox(cs.col, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cs.col}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Method:</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="diff_method"
                  value="edgeR"
                  checked={analysisMethod === "edgeR"}
                  onChange={handleMethodChange}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">edgeR</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="diff_method"
                  value="DESeq2"
                  checked={analysisMethod === "DESeq2"}
                  onChange={handleMethodChange}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">DESeq2</span>
              </label>
            </div>
          </div>

          {/* DESeq2 Size Input */}
          {analysisMethod === "DESeq2" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auto-calculated Size (Min Replicates):
              </label>
              <input
                type="number"
                value={Math.min(selectedControl.length, selectedComparison.length)}
                readOnly
                className="block w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              />
            </div>
          )}

          {/* Run Analysis Button */}
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault(); // 在 inline 層級先攔截一次
              handleRunAnalysis(e);
            }}
            disabled={
              runningAnalysis ||
              selectedControl.length === 0 ||
              selectedComparison.length === 0
            }
            isProcessing={runningAnalysis} // 當為 true 時，按鈕會顯示載入動畫
            processingSpinner={<Spinner size="sm" />} // 可自定義 Spinner
            color="blue"
          >
            {runningAnalysis ? "Running Analysis..." : "Run Analysis"}
          </Button>

          {/* Current Analysis Setup Display */}
          {(selectedControl.length > 0 || selectedComparison.length > 0) && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
              <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Current Analysis Setup</h5>
              <div className="space-y-1 text-sm">
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">Analysis Method:</strong>{" "}
                  <span className="text-gray-900 dark:text-white">{analysisMethod}</span>
                </div>
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">Control Samples:</strong>{" "}
                  <span className="text-blue-600 dark:text-blue-400">{selectedControl.join(", ") || "None"}</span>
                </div>
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">Comparison Samples:</strong>{" "}
                  <span className="text-red-600 dark:text-red-400">{selectedComparison.join(", ") || "None"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {analysisError && (
            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
              <strong>錯誤：</strong> {analysisError}
            </div>
          )}
        </div>
      )}

      {/* Analysis Result Display */}
      {(analysisResult || runningAnalysis) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Analysis Result</h3>

          {runningAnalysis && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">分析進行中，請稍候...</p>
            </div>
          )}

          {analysisResult && (
            <div>
              {analysisResult.cached && (
                <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-md">
                  快取結果 (JobID: {analysisResult.jobID})
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Volcano Plot */}
                {analysisResult.volcano_path && (
                  <div>
                    <h5 className="text-center text-lg font-medium mb-2 text-gray-900 dark:text-white">Volcano Plot</h5>
                    <img
                      src={withCacheBuster(analysisResult.volcano_path)}
                      alt="Volcano Plot"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                )}

                {/* MA Plot */}
                {analysisResult.ma_path && (
                  <div>
                    <h5 className="text-center text-lg font-medium mb-2 text-gray-900 dark:text-white">MA Plot</h5>
                    <img
                      src={withCacheBuster(analysisResult.ma_path)}
                      alt="MA Plot"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
