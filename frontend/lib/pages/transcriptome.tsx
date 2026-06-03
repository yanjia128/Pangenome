import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Spinner,
} from "flowbite-react";
import { HeatMapComponent, Inject, Legend, Tooltip, type ITooltipEventArgs, type ICellEventArgs } from "@syncfusion/ej2-react-heatmap";
import { HiSearch, HiChevronUp, HiChevronDown } from "react-icons/hi";
import { registerLicense } from '@syncfusion/ej2-base';
registerLicense('Ngo9BigBOggjHTQxAR8/V1JHaF1cXmhOYVBpR2NbeU5xdl9HaFZTTGY/P1ZhSXxVdkNjWn5ccXxWRWhdWEx9XEE=');
type SpeciesOption = {
  label: string;
  countsTsvPath: string;
  tpmTsvPath: string;
  backendSpecies: string;
};

type DiffMethod = "edgeR" | "DESeq2";
type ExpressionTableMode = "counts" | "tpm";

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

type HeatmapData = {
  genes: string[];
  samples: string[];
  matrix: number[][];
  rawMatrix: number[][];
  height: number;
  width: number;
  minValue: number;
  maxValue: number;
};

const SPECIES_OPTIONS: SpeciesOption[] = [
  {
    label: "D. bullen",
    countsTsvPath: "/dendrobium/table/Dbullen_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dbullen_tpm.tsv",
    backendSpecies: "Dbullen",
  },
  {
    label: "D. carini",
    countsTsvPath: "/dendrobium/table/Dcar_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dcar_tpm.tsv",
    backendSpecies: "Dcar",
  },
  {
    label: "D. exile",
    countsTsvPath: "/dendrobium/table/Dexile_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dexile_tpm.tsv",
    backendSpecies: "Dexile",
  },
  {
    label: "D. lindle",
    countsTsvPath: "/dendrobium/table/Dlindle_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dlindle_tpm.tsv",
    backendSpecies: "Dlindle",
  },
  {
    label: "D. nobile",
    countsTsvPath: "/dendrobium/table/Dnobile_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dnobile_tpm.tsv",
    backendSpecies: "Dnobile",
  },
  {
    label: "D. parcum",
    countsTsvPath: "/dendrobium/table/Dparcum_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dparcum_tpm.tsv",
    backendSpecies: "Dparcum",
  },
  {
    label: "D. porphy",
    countsTsvPath: "/dendrobium/table/Dporphy_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dporphy_tpm.tsv",
    backendSpecies: "Dporphy",
  },
  {
    label: "D. secund",
    countsTsvPath: "/dendrobium/table/Dsecund_counts.tsv",
    tpmTsvPath: "/dendrobium/table/Dsecund_tpm.tsv",
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

function buildTpmHeatmapData(
  headers: string[],
  rows: Record<string, string>[]
): HeatmapData | null {
  if (headers.length < 2 || rows.length === 0) {
    return null;
  }

  const geneColumn = headers[0];
  const sampleColumns = headers.slice(1);
  if (sampleColumns.length === 0) {
    return null;
  }

  const selectedRows = rows
    .map((row) => {
      const rawValues = sampleColumns.map((sample) => {
        const numericValue = Number.parseFloat(row[sample] ?? "");
        return Number.isFinite(numericValue) ? numericValue : 0;
      });

      return {
        gene: row[geneColumn] || "",
        values: rawValues.map((value) => Math.log2(value + 1)),
      };
    })
    .filter((row) => row.gene.length > 0);

  if (selectedRows.length === 0) {
    return null;
  }

  const matrix = sampleColumns.map((_, sampleIndex) =>
    selectedRows.map((row) => row.values[sampleIndex])
  );
  const rawMatrix = sampleColumns.map((sample) =>
    selectedRows.map((row) => {
      const rawValue = Number.parseFloat(rows.find((sourceRow) => sourceRow[geneColumn] === row.gene)?.[sample] ?? "");
      return Number.isFinite(rawValue) ? rawValue : 0;
    })
  );
  const flattenedValues = matrix.flat();
  const minValue = flattenedValues.length > 0 ? Math.min(...flattenedValues) : 0;
  const maxValue = flattenedValues.length > 0 ? Math.max(...flattenedValues) : 0;

  return {
    genes: selectedRows.map((row) => row.gene),
    samples: sampleColumns,
    matrix,
    rawMatrix,
    height: Math.max(420, selectedRows.length * 26),
    width: Math.max(900, sampleColumns.length * 52 + 220),
    minValue,
    maxValue,
  };
}

export default function TranscriptomePage() {
  const { submitDifferentialExpression } = useApi();
  const heatmapRef = useRef<HeatMapComponent | null>(null);

  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesOption>(SPECIES_OPTIONS[0]);
  const [tableMode, setTableMode] = useState<ExpressionTableMode>("counts");
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<{ headers: string[]; rows: Record<string, string>[] }>({
    headers: [],
    rows: [],
  });

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
    void loadTableData();
  }, [selectedSpecies, tableMode]);

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
      const selectedPath =
        tableMode === "counts" ? selectedSpecies.countsTsvPath : selectedSpecies.tpmTsvPath;

      const response = await fetch(selectedPath);
      const text = await response.text();
      const { headers, rows } = parseTsv(text);
      setTableData({ headers, rows });

      if (tableMode === "counts") {
        const sampleColumns = headers.slice(1);
        const statuses: ColumnStatus[] = sampleColumns.map((col) => ({
          col,
          stat: "unselected",
        }));
        setColumnStatuses(statuses);
        setShowDiffAnalysis(true);
      }
    } catch (error) {
      console.error("Failed to load TSV data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return tableData.rows;

    return tableData.rows.filter((row) => {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [tableData.rows, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startRecord = sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, sortedData.length);
  const currentTablePath =
    tableMode === "counts" ? selectedSpecies.countsTsvPath : selectedSpecies.tpmTsvPath;
  const currentTableFileName =
    currentTablePath.split("/").pop() ?? selectedSpecies.backendSpecies + "_" + tableMode + ".tsv";

  const tpmHeatmapData = useMemo(() => {
    if (tableMode !== "tpm") {
      return null;
    }

    return buildTpmHeatmapData(tableData.headers, paginatedData);
  }, [paginatedData, tableData.headers, tableMode]);

  const heatmapKey = useMemo(() => {
    if (tableMode !== "tpm") {
      return "tpm-heatmap-hidden";
    }

    const geneColumn = tableData.headers[0] ?? "gene";
    const visibleIds = paginatedData.map((row) => row[geneColumn] ?? "").join("|");
    return `${selectedSpecies.backendSpecies}-${tableMode}-${currentPage}-${pageSize}-${visibleIds}`;
  }, [currentPage, pageSize, paginatedData, selectedSpecies.backendSpecies, tableData.headers, tableMode]);

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
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDownloadTable = () => {
    const link = document.createElement("a");
    link.href = currentTablePath;
    link.download = currentTableFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadHeatmap = () => {
    if (!heatmapRef.current || tableMode !== "tpm") {
      return;
    }

    const fileName = `${selectedSpecies.backendSpecies}_${tableMode}_heatmap_page_${currentPage}`;
    heatmapRef.current.export("PNG", fileName);
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
      }
      if (selectedComparison.includes(cs.col)) {
        return { ...cs, stat: "comparison" };
      }
      return { ...cs, stat: "unselected" };
    });

    const method = getMethodBySelection(selectedControl.length, selectedComparison.length);
    const size = method === "DESeq2" ? Math.min(selectedControl.length, selectedComparison.length) : 0;

    setAnalysisMethod(method);
    setAnalysisSize(size);
    setAnalysisResult(null);
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Whole Gene Expression ({tableMode === "counts" ? "Counts" : "TPM"})
        </h3>

        <div className="mb-4 flex flex-wrap gap-4 items-end">
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

          <div className="flex-shrink-0">
            <label htmlFor="table-mode-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Type:
            </label>
            <select
              id="table-mode-select"
              className="block w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={tableMode}
              onChange={(e) => setTableMode(e.target.value as ExpressionTableMode)}
            >
              <option value="counts">Read Counts（可做差異分析）</option>
              <option value="tpm">TPM（僅供瀏覽）</option>
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
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              className="max-w-md"
            />
          </div>

          <div className="flex-shrink-0">
            <Button
              type="button"
              color="light"
              onClick={handleDownloadTable}
              disabled={loading || tableData.headers.length === 0}
            >
              Download Table
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading data...</p>
          </div>
        )}

        {!loading && tableMode === "tpm" && tpmHeatmapData && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">TPM Heatmap (Syncfusion)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  依目前表格這一頁顯示的 {tpmHeatmapData.genes.length} 個 ID 繪製 heatmap，並在格子中顯示 log2(TPM + 1) 數值。
                </p>
              </div>
              <Button
                type="button"
                color="light"
                onClick={handleDownloadHeatmap}
                disabled={!tpmHeatmapData || tpmHeatmapData.genes.length === 0}
              >
                Download Heatmap
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
              <div style={{ minWidth: `${tpmHeatmapData.width}px` }}>
                <HeatMapComponent
                  ref={(instance: HeatMapComponent | null) => {
                    heatmapRef.current = instance;
                  }}
                  key={heatmapKey}
                  id="transcriptome-tpm-heatmap"
                  dataSource={tpmHeatmapData.matrix}
                  dataSourceSettings={{
                    isJsonData: false,
                    adaptorType: "Table",
                  }}
                  height={`${tpmHeatmapData.height}px`}
                  width={`${tpmHeatmapData.width}px`}
                  showTooltip={true}
                  xAxis={{
                    valueType: "Category",
                    labels: tpmHeatmapData.samples,
                    labelRotation: 315,
                    labelIntersectAction: "None",
                    textStyle: { size: "11px" },
                  }}
                  yAxis={{
                    valueType: "Category",
                    labels: tpmHeatmapData.genes,
                    isInversed: true,
                    labelIntersectAction: "None",
                    textStyle: { size: "10px" },
                  }}
                  paletteSettings={{
                    type: "Gradient",
                    palette: [
                      { value: tpmHeatmapData.minValue, color: "#fef3c7" },
                      {
                        value: (tpmHeatmapData.minValue + tpmHeatmapData.maxValue) / 2,
                        color: "#f59e0b",
                      },
                      { value: tpmHeatmapData.maxValue, color: "#b91c1c" },
                    ],
                  }}
                  legendSettings={{ visible: true, position: "Bottom" }}
                  cellSettings={{
                    border: { width: 0 },
                    showLabel: true,
                    enableCellHighlighting: true,
                    textStyle: {
                      size: "9px",
                      fontWeight: "500",
                    },
                  }}
                  cellRender={(args: ICellEventArgs) => {
                    const sampleIndex = tpmHeatmapData.samples.indexOf(String(args.xLabel));
                    const geneIndex = tpmHeatmapData.genes.indexOf(String(args.yLabel));
                    const rawValue =
                      sampleIndex >= 0 && geneIndex >= 0
                        ? tpmHeatmapData.rawMatrix[sampleIndex]?.[geneIndex]
                        : undefined;

                    args.displayText =
                      typeof rawValue === "number" && Number.isFinite(rawValue)
                        ? rawValue.toFixed(1)
                        : "";
                  }}
                  tooltipRender={(args: ITooltipEventArgs) => {
                    const sampleIndex = tpmHeatmapData.samples.indexOf(String(args.xLabel));
                    const geneIndex = tpmHeatmapData.genes.indexOf(String(args.yLabel));
                    const rawValue =
                      sampleIndex >= 0 && geneIndex >= 0
                        ? tpmHeatmapData.rawMatrix[sampleIndex]?.[geneIndex]
                        : undefined;

                    args.content = [
                      `Gene: ${args.yLabel}`,
                      `Sample: ${args.xLabel}`,
                      `TPM: ${typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue.toFixed(2) : "N/A"}`,
                      `Heatmap value: ${Number(args.value).toFixed(2)} log2(TPM + 1)`,
                    ];
                  }}
                >
                  <Inject services={[Legend, Tooltip]} />
                </HeatMapComponent>
              </div>
            </div>
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
                        {sortConfig?.key === header &&
                          (sortConfig.direction === "asc" ? (
                            <HiChevronUp className="w-4 h-4" />
                          ) : (
                            <HiChevronDown className="w-4 h-4" />
                          ))}
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

        {!loading && tableMode === "tpm" && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-200 rounded-md text-sm">
            目前顯示 TPM 表格（僅供瀏覽），不提供差異表達分析。
          </div>
        )}
      </div>

      {showDiffAnalysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Differential Expression Analysis by Read Counts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleRunAnalysis(e);
            }}
            disabled={
              runningAnalysis ||
              selectedControl.length === 0 ||
              selectedComparison.length === 0
            }
            isProcessing={runningAnalysis}
            processingSpinner={<Spinner size="sm" />}
            color="blue"
          >
            {runningAnalysis ? "Running Analysis..." : "Run Analysis"}
          </Button>

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

          {analysisError && (
            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
              <strong>錯誤：</strong> {analysisError}
            </div>
          )}
        </div>
      )}

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
