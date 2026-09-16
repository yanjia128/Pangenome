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
import { HiSearch, HiChevronUp, HiChevronDown, HiDownload } from "react-icons/hi";
import {
  loadPlotly,
  type PlotlyLike,
  ENRICHMENT_DOMAINS,
  ENRICHMENT_DOMAIN_LABELS,
  defaultEnrichmentDomainTableState,
  defaultEnrichmentDomainTableStates,
  type EnrichmentDomainKey,
  type EnrichmentRow,
  type EnrichmentResponse,
  type EnrichmentPValueOption,
  type EnrichmentCorrectionMethod,
  type EnrichmentDomainTableState,
} from "./pangenome-data";
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
  csv_path?: string;
  jobID?: string;
  cached?: boolean;
  method?: string;
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

// Enrichment analysis keys species by their full name (matching api/data/enrichment/<name>),
// while transcriptome samples use short codes.
const ENRICHMENT_SPECIES_MAP: Partial<Record<string, string>> = {
  Dbullen: "Dbullenianum",
  Dcar: "Dcariniferum",
  Dexile: "Dexile",
  Dlindle: "Dlindleyi",
  Dnobile: "Dnobile",
  Dparcum: "Dparcum",
  Dporphy: "Dporphyrochilum",
  Dsecund: "Dsecundum",
};

const ENRICHMENT_PAGE_SIZE = 25;

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

const TISSUE_KEYWORDS = ["Leaf", "Root", "Stem", "Flower"];

function getTissueGroup(header: string): string {
  const match = header.match(/_(Leaf|Root|Stem|Flower)_/i);
  if (!match) return header;
  const canonical = TISSUE_KEYWORDS.find(
    (tissue) => tissue.toLowerCase() === match[1].toLowerCase()
  );
  return canonical ?? match[1];
}

// Groups sample columns by tissue type first, keeping each tissue's
// original (replicate-ascending) order intact, per user request to sort
// columns "組織優先、重複組其次" instead of interleaved by replicate.
function reorderColumnsByTissue(sampleColumns: string[]): string[] {
  const order: string[] = [];
  const groups = new Map<string, string[]>();

  sampleColumns.forEach((column) => {
    const tissue = getTissueGroup(column);
    if (!groups.has(tissue)) {
      groups.set(tissue, []);
      order.push(tissue);
    }
    groups.get(tissue)!.push(column);
  });

  return order.flatMap((tissue) => groups.get(tissue)!);
}

function withCacheBuster(url: string): string {
  const timestamp = new Date().getTime();
  return `${url}?_t=${timestamp}`;
}

function parseCsvResult(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || "";
    });
    return row;
  });
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
        values: rawValues.map((value: number) => Math.log2(value + 1)),
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
  const { submitDifferentialExpression, submitEnrichmentAnalysis } = useApi();
  const heatmapRef = useRef<HeatMapComponent | null>(null);

  const handleHeatmapRef = (instance: HeatMapComponent | null) => {
    heatmapRef.current = instance;
  };

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
  const [analysisFdr, setAnalysisFdr] = useState<number>(0.05);
  const [analysisLogfc, setAnalysisLogfc] = useState<number>(1);
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const volcanoPlotRef = useRef<HTMLDivElement | null>(null);
  const maPlotRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyLike | null>(null);
  const enrichmentBubblePlotRef = useRef<HTMLDivElement | null>(null);
  const enrichmentVolcanoPlotRef = useRef<HTMLDivElement | null>(null);

  const [enrichmentPValue, setEnrichmentPValue] = useState<EnrichmentPValueOption>(0.05);
  const [enrichmentCorrection, setEnrichmentCorrection] = useState<EnrichmentCorrectionMethod>("FDR");
  const [enrichmentRunning, setEnrichmentRunning] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResponse | null>(null);
  const [enrichmentError, setEnrichmentError] = useState("");
  const [enrichmentActiveDomain, setEnrichmentActiveDomain] = useState<EnrichmentDomainKey | null>(null);
  const [enrichmentDomainTableState, setEnrichmentDomainTableState] = useState<
    Record<EnrichmentDomainKey, EnrichmentDomainTableState>
  >(defaultEnrichmentDomainTableStates());

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

  useEffect(() => {
    if (!csvData || !analysisResult) return;

    const method = analysisResult.method ?? analysisMethod;
    const isEdgeR = method === "edgeR";

    const fcCol = isEdgeR ? "logFC" : "log2FoldChange";
    const pCol = isEdgeR ? "FDR" : "padj";
    const meanCol = isEdgeR ? "logCPM" : "baseMean";

    const genes: string[] = [];
    const fc: number[] = [];
    const pvals: number[] = [];
    const means: number[] = [];

    for (const row of csvData) {
      const fcVal = parseFloat(row[fcCol]);
      const pVal = parseFloat(row[pCol]);
      const meanVal = parseFloat(row[meanCol]);
      if (isNaN(fcVal) || isNaN(pVal)) continue;
      const gene = row[Object.keys(row)[0]] || "";
      genes.push(gene);
      fc.push(fcVal);
      pvals.push(pVal);
      means.push(isEdgeR ? meanVal : Math.log10(meanVal + 1));
    }

    const sigColors = fc.map((f, i) => {
      if (pvals[i] < analysisFdr && f > analysisLogfc) return "red";
      if (pvals[i] < analysisFdr && f < -analysisLogfc) return "blue";
      return "grey";
    });

    void (async () => {
      try {
        const Plotly = plotlyRef.current ?? (await loadPlotly());
        plotlyRef.current = Plotly;

        if (volcanoPlotRef.current) {
          const upIdx    = fc.map((f, i) => pvals[i] < analysisFdr && f >  analysisLogfc ? i : -1).filter(i => i >= 0);
          const downIdx  = fc.map((f, i) => pvals[i] < analysisFdr && f < -analysisLogfc ? i : -1).filter(i => i >= 0);
          const nsIdx    = fc.map((_, i) => sigColors[i] === "grey" ? i : -1).filter(i => i >= 0);

          const pick = (arr: number[], idx: number[]) => idx.map(i => arr[i]);
          const pickStr = (arr: string[], idx: number[]) => idx.map(i => arr[i]);
          const negLog10 = pvals.map(p => -Math.log10(p));

          const volcanoTraces = [
            {
              name: "Not significant",
              x: pick(fc, nsIdx), y: pick(negLog10, nsIdx),
              mode: "markers", type: "scatter",
              marker: { color: "grey", size: 5, opacity: 0.4 },
              text: pickStr(genes, nsIdx),
              hovertemplate: "Gene: %{text}<br>log2FC: %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>",
            },
            {
              name: "Up-regulated",
              x: pick(fc, upIdx), y: pick(negLog10, upIdx),
              mode: "markers", type: "scatter",
              marker: { color: "red", size: 6, opacity: 0.7 },
              text: pickStr(genes, upIdx),
              hovertemplate: "Gene: %{text}<br>log2FC: %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>",
            },
            {
              name: "Down-regulated",
              x: pick(fc, downIdx), y: pick(negLog10, downIdx),
              mode: "markers", type: "scatter",
              marker: { color: "blue", size: 6, opacity: 0.7 },
              text: pickStr(genes, downIdx),
              hovertemplate: "Gene: %{text}<br>log2FC: %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>",
            },
          ];

          const volcanoLayout: Record<string, unknown> = {
            title: `Volcano Plot (${method}) — P < ${analysisFdr} & |log2FC| > ${analysisLogfc}`,
            xaxis: { title: "log2(Fold Change)", automargin: true },
            yaxis: { title: "-log(FDR)", automargin: true },
            shapes: [
              { type: "line", x0: -analysisLogfc, x1: -analysisLogfc, y0: 0, y1: 1, yref: "paper", line: { dash: "dash", color: "black", width: 1 } },
              { type: "line", x0: analysisLogfc, x1: analysisLogfc, y0: 0, y1: 1, yref: "paper", line: { dash: "dash", color: "black", width: 1 } },
              { type: "line", x0: 0, x1: 1, xref: "paper", y0: -Math.log10(analysisFdr), y1: -Math.log10(analysisFdr), line: { dash: "dash", color: "black", width: 1 } },
            ],
            margin: { t: 50, b: 50, l: 60, r: 30 },
          };

          await Plotly.newPlot(volcanoPlotRef.current, volcanoTraces, volcanoLayout, { responsive: true });
        }

        if (maPlotRef.current) {
          const xAxisTitle = "log10(Mean Express)";
          const maHover = `Gene: %{text}<br>${xAxisTitle}: %{x:.2f}<br>log2FC: %{y:.2f}<extra></extra>`;

          const pick = (arr: number[], idx: number[]) => idx.map(i => arr[i]);
          const pickStr = (arr: string[], idx: number[]) => idx.map(i => arr[i]);
          const upIdx   = fc.map((_, i) => sigColors[i] === "red"  ? i : -1).filter(i => i >= 0);
          const downIdx = fc.map((_, i) => sigColors[i] === "blue" ? i : -1).filter(i => i >= 0);
          const nsIdx   = fc.map((_, i) => sigColors[i] === "grey" ? i : -1).filter(i => i >= 0);

          const maTraces = [
            {
              name: "Not significant",
              x: pick(means, nsIdx), y: pick(fc, nsIdx),
              mode: "markers", type: "scatter",
              marker: { color: "grey", size: 5, opacity: 0.4 },
              text: pickStr(genes, nsIdx),
              hovertemplate: maHover,
            },
            {
              name: "Up-regulated",
              x: pick(means, upIdx), y: pick(fc, upIdx),
              mode: "markers", type: "scatter",
              marker: { color: "red", size: 6, opacity: 0.7 },
              text: pickStr(genes, upIdx),
              hovertemplate: maHover,
            },
            {
              name: "Down-regulated",
              x: pick(means, downIdx), y: pick(fc, downIdx),
              mode: "markers", type: "scatter",
              marker: { color: "blue", size: 6, opacity: 0.7 },
              text: pickStr(genes, downIdx),
              hovertemplate: maHover,
            },
          ];

          const maLayout: Record<string, unknown> = {
            title: `MA Plot (${method}) — P < ${analysisFdr} & |log2FC| > ${analysisLogfc}`,
            xaxis: { title: xAxisTitle, automargin: true },
            yaxis: { title: "log2(Fold Change)", automargin: true },
            shapes: [
              { type: "line", x0: 0, x1: 1, xref: "paper", y0: 0, y1: 0, line: { color: "black", width: 1 } },
            ],
            margin: { t: 50, b: 50, l: 60, r: 30 },
          };

          await Plotly.newPlot(maPlotRef.current, maTraces, maLayout, { responsive: true });
        }
      } catch (err) {
        console.error("Failed to render Plotly plots:", err);
      }
    })();

    return () => {
      if (plotlyRef.current) {
        if (volcanoPlotRef.current) plotlyRef.current.purge(volcanoPlotRef.current);
        if (maPlotRef.current) plotlyRef.current.purge(maPlotRef.current);
      }
    };
  }, [csvData, analysisResult, analysisFdr, analysisLogfc, analysisMethod]);

  const enrichmentSpeciesName = ENRICHMENT_SPECIES_MAP[selectedSpecies.backendSpecies];

  const significantGenes = useMemo(() => {
    if (!csvData || !analysisResult || csvData.length === 0) return [];

    const method = analysisResult.method ?? analysisMethod;
    const isEdgeR = method === "edgeR";
    const fcCol = isEdgeR ? "logFC" : "log2FoldChange";
    const pCol = isEdgeR ? "FDR" : "padj";
    const geneCol = Object.keys(csvData[0])[0];

    const genes: string[] = [];
    for (const row of csvData) {
      const fcVal = parseFloat(row[fcCol]);
      const pVal = parseFloat(row[pCol]);
      if (isNaN(fcVal) || isNaN(pVal)) continue;
      if (pVal < analysisFdr && Math.abs(fcVal) > analysisLogfc) {
        const gene = row[geneCol];
        if (gene) genes.push(gene);
      }
    }
    return genes;
  }, [csvData, analysisResult, analysisMethod, analysisFdr, analysisLogfc]);

  const handleRunEnrichment = async () => {
    if (!enrichmentSpeciesName || significantGenes.length === 0) return;

    setEnrichmentRunning(true);
    setEnrichmentError("");
    setEnrichmentResult(null);
    setEnrichmentActiveDomain(null);
    setEnrichmentDomainTableState(defaultEnrichmentDomainTableStates());

    try {
      const response = (await submitEnrichmentAnalysis({
        species: enrichmentSpeciesName,
        input: significantGenes.join(","),
        p_value: enrichmentPValue,
        correctionMethod: enrichmentCorrection,
      })) as EnrichmentResponse;

      if (response.error) {
        setEnrichmentError(response.error);
        return;
      }

      setEnrichmentResult(response);
      const firstDomain = ENRICHMENT_DOMAINS.find((domain) => (response[domain]?.length ?? 0) > 0);
      setEnrichmentActiveDomain(firstDomain ?? ENRICHMENT_DOMAINS[0]);
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "富集分析失敗，請稍後再試。");
    } finally {
      setEnrichmentRunning(false);
    }
  };

  const enrichmentDomainsWithResults = useMemo(() => {
    if (!enrichmentResult) return [];
    return ENRICHMENT_DOMAINS.filter((domain) => (enrichmentResult[domain]?.length ?? 0) > 0);
  }, [enrichmentResult]);

  const enrichmentActiveRows = useMemo(() => {
    if (!enrichmentResult || !enrichmentActiveDomain) return [];
    return enrichmentResult[enrichmentActiveDomain] ?? [];
  }, [enrichmentResult, enrichmentActiveDomain]);

  useEffect(() => {
    if (!enrichmentActiveDomain || enrichmentActiveRows.length === 0) {
      return;
    }

    const rows = enrichmentActiveRows;
    const domainLabel = ENRICHMENT_DOMAIN_LABELS[enrichmentActiveDomain];
    const pThreshold = -Math.log10(enrichmentPValue);

    void (async () => {
      try {
        const Plotly = plotlyRef.current ?? (await loadPlotly());
        plotlyRef.current = Plotly;

        if (enrichmentBubblePlotRef.current) {
          const bubbleRows = [...rows]
            .sort((a, b) => b["p-value"] - a["p-value"])
            .slice(0, 20)
            .reverse();
          const maxCount = Math.max(...bubbleRows.map((r) => r.count), 1);

          const truncateLabel = (label: string, max = 50) =>
            label.length > max ? `${label.slice(0, max - 1)}…` : label;

          const bubbleTrace = [
            {
              x: bubbleRows.map((r) => r.fold_enrichment ?? 0),
              y: bubbleRows.map((r) => truncateLabel(r.description || r.target)),
              mode: "markers",
              type: "scatter",
              marker: {
                size: bubbleRows.map((r) => r.count),
                sizemode: "area",
                sizeref: (2 * maxCount) / 40 ** 2,
                sizemin: 4,
                color: bubbleRows.map((r) => r["p-value"]),
                colorscale: "YlOrRd",
                showscale: true,
                colorbar: { title: "-log10(p)" },
                line: { color: "rgba(0,0,0,0.2)", width: 1 },
              },
              text: bubbleRows.map((r) => `${r.target}: ${r.description ?? ""}`),
              hovertemplate:
                "%{text}<br>log2(Fold Enrichment): %{x:.2f}<br>Count: %{marker.size}<extra></extra>",
            },
          ];

          const bubbleLayout: Record<string, unknown> = {
            title: `${domainLabel} Bubble Plot (Top ${bubbleRows.length})`,
            xaxis: { title: "log2(Fold Enrichment)" },
            yaxis: { automargin: true },
            margin: { t: 50, b: 50, l: 320, r: 30 },
            height: Math.max(360, bubbleRows.length * 28),
          };

          await Plotly.newPlot(enrichmentBubblePlotRef.current, bubbleTrace, bubbleLayout, {
            responsive: true,
          });
        }

        if (enrichmentVolcanoPlotRef.current) {
          const fc = rows.map((r) => r.fold_enrichment ?? 0);
          const pvals = rows.map((r) => r["p-value"]);
          const targets = rows.map((r) => r.target);

          const upIdx = fc
            .map((f, i) => (pvals[i] > pThreshold && f > 0 ? i : -1))
            .filter((i) => i >= 0);
          const downIdx = fc
            .map((f, i) => (pvals[i] > pThreshold && f < 0 ? i : -1))
            .filter((i) => i >= 0);
          const significantIdx = new Set([...upIdx, ...downIdx]);
          const nsIdx = fc.map((_, i) => i).filter((i) => !significantIdx.has(i));

          const pick = (arr: number[], idx: number[]) => idx.map((i) => arr[i]);
          const pickStr = (arr: string[], idx: number[]) => idx.map((i) => arr[i]);
          const hover =
            "Term: %{text}<br>log2(Fold Enrichment): %{x:.2f}<br>-log10(p): %{y:.2f}<extra></extra>";

          const volcanoTraces = [
            {
              name: "Not significant",
              x: pick(fc, nsIdx),
              y: pick(pvals, nsIdx),
              mode: "markers",
              type: "scatter",
              marker: { color: "grey", size: 6, opacity: 0.4 },
              text: pickStr(targets, nsIdx),
              hovertemplate: hover,
            },
            {
              name: "Enriched",
              x: pick(fc, upIdx),
              y: pick(pvals, upIdx),
              mode: "markers",
              type: "scatter",
              marker: { color: "red", size: 7, opacity: 0.75 },
              text: pickStr(targets, upIdx),
              hovertemplate: hover,
            },
            {
              name: "Depleted",
              x: pick(fc, downIdx),
              y: pick(pvals, downIdx),
              mode: "markers",
              type: "scatter",
              marker: { color: "blue", size: 7, opacity: 0.75 },
              text: pickStr(targets, downIdx),
              hovertemplate: hover,
            },
          ];

          const volcanoLayout: Record<string, unknown> = {
            title: `${domainLabel} Volcano Plot — P < ${enrichmentPValue}`,
            xaxis: { title: "log2(Fold Enrichment)", automargin: true },
            yaxis: { title: "-log10(p-value)", automargin: true },
            shapes: [
              {
                type: "line",
                x0: 0,
                x1: 1,
                xref: "paper",
                y0: pThreshold,
                y1: pThreshold,
                line: { dash: "dash", color: "black", width: 1 },
              },
            ],
            margin: { t: 50, b: 50, l: 60, r: 30 },
          };

          await Plotly.newPlot(enrichmentVolcanoPlotRef.current, volcanoTraces, volcanoLayout, {
            responsive: true,
          });
        }
      } catch (err) {
        console.error("Failed to render enrichment plots:", err);
      }
    })();

    return () => {
      if (plotlyRef.current) {
        if (enrichmentBubblePlotRef.current) plotlyRef.current.purge(enrichmentBubblePlotRef.current);
        if (enrichmentVolcanoPlotRef.current) plotlyRef.current.purge(enrichmentVolcanoPlotRef.current);
      }
    };
  }, [enrichmentActiveRows, enrichmentActiveDomain, enrichmentPValue]);

  const enrichmentActiveTableState = enrichmentActiveDomain
    ? enrichmentDomainTableState[enrichmentActiveDomain]
    : defaultEnrichmentDomainTableState();

  const enrichmentFilteredRows = useMemo(() => {
    if (!enrichmentActiveTableState.search) return enrichmentActiveRows;
    const term = enrichmentActiveTableState.search.toLowerCase();
    return enrichmentActiveRows.filter(
      (row) =>
        row.target.toLowerCase().includes(term) ||
        row.description?.toLowerCase().includes(term)
    );
  }, [enrichmentActiveRows, enrichmentActiveTableState.search]);

  const enrichmentSortedRows = useMemo(() => {
    const { sortConfig } = enrichmentActiveTableState;
    if (!sortConfig) return enrichmentFilteredRows;

    return [...enrichmentFilteredRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      const aNum = typeof aVal === "number" ? aVal : parseFloat(String(aVal));
      const bNum = typeof bVal === "number" ? bVal : parseFloat(String(bVal));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichmentFilteredRows, enrichmentActiveTableState]);

  const enrichmentTotalPages = Math.max(1, Math.ceil(enrichmentSortedRows.length / ENRICHMENT_PAGE_SIZE));
  const enrichmentCurrentPage = Math.min(enrichmentActiveTableState.page, enrichmentTotalPages);
  const enrichmentPaginatedRows = useMemo(() => {
    const start = (enrichmentCurrentPage - 1) * ENRICHMENT_PAGE_SIZE;
    return enrichmentSortedRows.slice(start, start + ENRICHMENT_PAGE_SIZE);
  }, [enrichmentSortedRows, enrichmentCurrentPage]);

  const updateEnrichmentActiveTableState = (patch: Partial<EnrichmentDomainTableState>) => {
    if (!enrichmentActiveDomain) return;
    setEnrichmentDomainTableState((prev) => ({
      ...prev,
      [enrichmentActiveDomain]: { ...prev[enrichmentActiveDomain], ...patch },
    }));
  };

  const handleEnrichmentSort = (key: keyof EnrichmentRow) => {
    const current = enrichmentActiveTableState.sortConfig;
    const direction: "asc" | "desc" =
      current?.key === key && current.direction === "asc" ? "desc" : "asc";
    updateEnrichmentActiveTableState({ sortConfig: { key, direction }, page: 1 });
  };

  const enrichmentStartRecord =
    enrichmentSortedRows.length === 0 ? 0 : (enrichmentCurrentPage - 1) * ENRICHMENT_PAGE_SIZE + 1;
  const enrichmentEndRecord = Math.min(
    enrichmentCurrentPage * ENRICHMENT_PAGE_SIZE,
    enrichmentSortedRows.length
  );

  const handleDownloadCsv = () => {
    if (!analysisResult?.csv_path) return;
    const link = document.createElement("a");
    link.href = analysisResult.csv_path;
    link.download = analysisResult.csv_path.split("/").pop() ?? "results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPlot = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current || !plotlyRef.current) return;
    const Plotly = plotlyRef.current as PlotlyLike & {
      downloadImage: (el: HTMLElement, opts: Record<string, unknown>) => Promise<void>;
    };
    if (typeof Plotly.downloadImage === "function") {
      await Plotly.downloadImage(ref.current, { format: "png", width: 1200, height: 800, filename });
    }
  };

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
      const { headers: parsedHeaders, rows } = parseTsv(text);
      const headers =
        parsedHeaders.length > 0
          ? [parsedHeaders[0], ...reorderColumnsByTissue(parsedHeaders.slice(1))]
          : parsedHeaders;
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
      return Object.values(row).some((value: string) =>
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

  const availableTissues = useMemo(() => {
    const seen: string[] = [];
    columnStatuses.forEach((cs) => {
      const tissue = getTissueGroup(cs.col);
      if (!seen.includes(tissue)) seen.push(tissue);
    });
    return seen;
  }, [columnStatuses]);

  const handleQuickSelectTissue = (group: "control" | "comparison", tissue: string) => {
    const tissueCols = columnStatuses
      .map((cs) => cs.col)
      .filter((col) => getTissueGroup(col) === tissue);
    if (tissueCols.length === 0) return;

    if (group === "control") {
      const allSelected = tissueCols.every((col) => selectedControl.includes(col));
      if (allSelected) {
        setSelectedControl(selectedControl.filter((col) => !tissueCols.includes(col)));
      } else {
        setSelectedControl(Array.from(new Set([...selectedControl, ...tissueCols])));
        setSelectedComparison(selectedComparison.filter((col) => !tissueCols.includes(col)));
      }
    } else {
      const allSelected = tissueCols.every((col) => selectedComparison.includes(col));
      if (allSelected) {
        setSelectedComparison(selectedComparison.filter((col) => !tissueCols.includes(col)));
      } else {
        setSelectedComparison(Array.from(new Set([...selectedComparison, ...tissueCols])));
        setSelectedControl(selectedControl.filter((col) => !tissueCols.includes(col)));
      }
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
    setCsvData(null);
    setRunningAnalysis(true);

    try {
      const response = await submitDifferentialExpression({
        species: selectedSpecies.backendSpecies,
        method,
        control_samples: selectedControl,
        comparison_samples: selectedComparison,
        all_columns_map: allColumnsMap,
        size: String(size),
        fdr: analysisFdr,
        logfc: analysisLogfc,
      });

      if (!response || response.error) {
        throw new Error(response?.error ?? "Differential expression request failed.");
      }

      setAnalysisResult(response);
      setRunningAnalysis(false);

      if (response.csv_path) {
        setLoadingCsv(true);
        try {
          const csvResponse = await fetch(response.csv_path);
          const csvText = await csvResponse.text();
          const parsed = parseCsvResult(csvText);
          setCsvData(parsed);
        } finally {
          setLoadingCsv(false);
        }
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "差異分析失敗，請稍後再試。");
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

        {!loading && tableMode === "tpm" && tpmHeatmapData && tableData.headers.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">TPM Heatmap (Syncfusion)</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Based on the {tpmHeatmapData.genes.length} IDs displayed on this current page of the table, a heatmap is drawn, and the log2(TPM + 1) value is displayed in the cells.
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
                <div className="flex justify-center">
                  <div style={{ minWidth: `${tpmHeatmapData.width}px` }}>
                    <HeatMapComponent
                      ref={handleHeatmapRef}
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
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">TPM Table</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The table on the right stays synchronized with the current TPM page, search term, and sort order.
                </p>
              </div>
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

              <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
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
          </div>
        )}

        {!loading && !(tableMode === "tpm" && tpmHeatmapData) && tableData.headers.length > 0 && (
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

            <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
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
              {availableTissues.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {availableTissues.map((tissue) => (
                    <button
                      type="button"
                      key={tissue}
                      onClick={() => handleQuickSelectTissue("control", tissue)}
                      className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      {tissue} 全選
                    </button>
                  ))}
                </div>
              )}
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
              {availableTissues.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {availableTissues.map((tissue) => (
                    <button
                      type="button"
                      key={tissue}
                      onClick={() => handleQuickSelectTissue("comparison", tissue)}
                      className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      {tissue} 全選
                    </button>
                  ))}
                </div>
              )}
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

          <div className="mb-6 flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                FDR Threshold:
              </label>
              <select
                value={analysisFdr}
                onChange={(e) => setAnalysisFdr(parseFloat(e.target.value))}
                className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value={0.05}>0.05</option>
                <option value={0.01}>0.01</option>
                <option value={0.001}>0.001</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                |log2FC| Threshold:
              </label>
              <select
                value={analysisLogfc}
                onChange={(e) => setAnalysisLogfc(parseFloat(e.target.value))}
                className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value={0.5}>0.5</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>

          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleRunAnalysis(e);
            }}
            disabled={
              runningAnalysis ||
              loadingCsv ||
              selectedControl.length === 0 ||
              selectedComparison.length === 0
            }
            isProcessing={runningAnalysis || loadingCsv}
            processingSpinner={<Spinner size="sm" />}
            color="blue"
          >
            {runningAnalysis ? "Running Analysis..." : loadingCsv ? "Loading Results..." : "Run Analysis"}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis Result</h3>
            {analysisResult?.csv_path && (
              <Button type="button" color="light" onClick={handleDownloadCsv} disabled={loadingCsv}>
                <HiDownload className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>

          {runningAnalysis && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">分析進行中，請稍候...</p>
            </div>
          )}

          {loadingCsv && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">正在載入分析結果資料...</p>
            </div>
          )}

          {analysisResult && !loadingCsv && (
            <div>
              {analysisResult.cached && (
                <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-md">
                  快取結果 (JobID: {analysisResult.jobID})
                </div>
              )}

              {csvData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-lg font-medium text-gray-900 dark:text-white">Volcano Plot</h5>
                      <Button
                        type="button"
                        size="xs"
                        color="light"
                        disabled={loadingCsv}
                        onClick={() => void handleDownloadPlot(volcanoPlotRef, `${selectedSpecies.backendSpecies}_Volcano`)}
                      >
                        <HiDownload className="mr-1 h-3 w-3" />
                        PNG
                      </Button>
                    </div>
                    <div className="flex items-stretch gap-1">
                      <span
                        className="flex-shrink-0 whitespace-nowrap self-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        -log(FDR)
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          ref={volcanoPlotRef}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                          style={{ minHeight: "450px" }}
                        />
                        <div className="mt-1 text-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400">
                          log2(Fold Change)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-lg font-medium text-gray-900 dark:text-white">MA Plot</h5>
                      <Button
                        type="button"
                        size="xs"
                        color="light"
                        disabled={loadingCsv}
                        onClick={() => void handleDownloadPlot(maPlotRef, `${selectedSpecies.backendSpecies}_MA`)}
                      >
                        <HiDownload className="mr-1 h-3 w-3" />
                        PNG
                      </Button>
                    </div>
                    <div className="flex items-stretch gap-1">
                      <span
                        className="flex-shrink-0 whitespace-nowrap self-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        log2(Fold Change)
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          ref={maPlotRef}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                          style={{ minHeight: "450px" }}
                        />
                        <div className="mt-1 text-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400">
                          log10(Mean Express)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}

      {showDiffAnalysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Enrichment Analysis (Significant DEGs)
          </h3>

          {!enrichmentSpeciesName ? (
            <p className="text-gray-600 dark:text-gray-400">
              此物種尚無 Enrichment 對照資料，暫不支援富集分析。
            </p>
          ) : !analysisResult || !csvData ? (
            <p className="text-gray-600 dark:text-gray-400">
              請先完成上方差異表達分析，才能使用其顯著基因進行富集分析。
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-4 items-end">
                <div className="flex-shrink-0">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Significant Genes:
                  </label>
                  <div className="text-sm text-gray-900 dark:text-white px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                    {significantGenes.length} genes (P &lt; {analysisFdr} & |log2FC| &gt; {analysisLogfc})
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <label htmlFor="enrichment-pvalue-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    P-Value (Cut Off):
                  </label>
                  <select
                    id="enrichment-pvalue-select"
                    className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    value={enrichmentPValue}
                    onChange={(e) => setEnrichmentPValue(parseFloat(e.target.value) as EnrichmentPValueOption)}
                  >
                    <option value={0.05}>0.05</option>
                    <option value={0.01}>0.01</option>
                    <option value={0.001}>0.001</option>
                  </select>
                </div>

                <div className="flex-shrink-0">
                  <label htmlFor="enrichment-correction-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Correction Method:
                  </label>
                  <select
                    id="enrichment-correction-select"
                    className="block w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    value={enrichmentCorrection}
                    onChange={(e) => setEnrichmentCorrection(e.target.value as EnrichmentCorrectionMethod)}
                  >
                    <option value="None">None</option>
                    <option value="FDR">FDR</option>
                    <option value="Bonferroni">Bonferroni</option>
                  </select>
                </div>

                <div className="flex-shrink-0">
                  <Button
                    type="button"
                    color="blue"
                    onClick={() => void handleRunEnrichment()}
                    disabled={enrichmentRunning || significantGenes.length === 0}
                    isProcessing={enrichmentRunning}
                    processingSpinner={<Spinner size="sm" />}
                  >
                    {enrichmentRunning ? "Running Enrichment..." : "Run Enrichment Analysis"}
                  </Button>
                </div>
              </div>

              {enrichmentError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
                  <strong>錯誤：</strong> {enrichmentError}
                </div>
              )}

              {enrichmentResult && !enrichmentError && (
                enrichmentDomainsWithResults.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400">
                    沒有符合目前 P-value 門檻與校正方法的結果，請嘗試調整條件。
                  </p>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
                      {enrichmentDomainsWithResults.map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => setEnrichmentActiveDomain(domain)}
                          className={
                            "px-4 py-2 text-sm font-medium rounded-t-md " +
                            (enrichmentActiveDomain === domain
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600")
                          }
                        >
                          {ENRICHMENT_DOMAIN_LABELS[domain]}
                        </button>
                      ))}
                    </div>

                    {enrichmentActiveDomain && (
                      <div>
                        {enrichmentActiveRows.length > 0 && (
                          <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-lg font-medium text-gray-900 dark:text-white">Bubble Plot</h5>
                                <Button
                                  type="button"
                                  size="xs"
                                  color="light"
                                  onClick={() =>
                                    void handleDownloadPlot(
                                      enrichmentBubblePlotRef,
                                      `${selectedSpecies.backendSpecies}_${enrichmentActiveDomain}_Bubble`
                                    )
                                  }
                                >
                                  <HiDownload className="mr-1 h-3 w-3" />
                                  PNG
                                </Button>
                              </div>
                              <div
                                ref={enrichmentBubblePlotRef}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                                style={{ minHeight: "400px" }}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-lg font-medium text-gray-900 dark:text-white">Volcano Plot</h5>
                                <Button
                                  type="button"
                                  size="xs"
                                  color="light"
                                  onClick={() =>
                                    void handleDownloadPlot(
                                      enrichmentVolcanoPlotRef,
                                      `${selectedSpecies.backendSpecies}_${enrichmentActiveDomain}_Volcano`
                                    )
                                  }
                                >
                                  <HiDownload className="mr-1 h-3 w-3" />
                                  PNG
                                </Button>
                              </div>
                              <div className="flex items-stretch gap-1">
                                <span
                                  className="flex-shrink-0 whitespace-nowrap self-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400"
                                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                                >
                                  -log10(p-value)
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div
                                    ref={enrichmentVolcanoPlotRef}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                                    style={{ minHeight: "400px" }}
                                  />
                                  <div className="mt-1 text-center text-xs font-mono font-medium text-gray-600 dark:text-gray-400">
                                    log2(Fold Enrichment)
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-4 flex justify-between items-center">
                          <input
                            type="text"
                            placeholder="Search target..."
                            value={enrichmentActiveTableState.search}
                            onChange={(e) => updateEnrichmentActiveTableState({ search: e.target.value, page: 1 })}
                            className="max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>

                        <div className="overflow-x-auto">
                          <Table hoverable>
                            <TableHead>
                              {(
                                [
                                  ["target", "Target ID"],
                                  ["description", "Description"],
                                  ["p-value", "P-Value (-log10)"],
                                  ["observed_ratio", "Observed Ratio"],
                                  ["expected_ratio", "Expected Ratio"],
                                  ["fold_enrichment", "Fold Enrichment (log2)"],
                                  ["count", "Count"],
                                ] as [keyof EnrichmentRow, string][]
                              ).map(([key, label]) => (
                                <TableHeadCell
                                  key={key}
                                  onClick={() => handleEnrichmentSort(key)}
                                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{label}</span>
                                    {enrichmentActiveTableState.sortConfig?.key === key &&
                                      (enrichmentActiveTableState.sortConfig.direction === "asc" ? (
                                        <HiChevronUp className="w-4 h-4" />
                                      ) : (
                                        <HiChevronDown className="w-4 h-4" />
                                      ))}
                                  </div>
                                </TableHeadCell>
                              ))}
                            </TableHead>
                            <TableBody className="divide-y">
                              {enrichmentPaginatedRows.map((row, index) => (
                                <TableRow key={`${row.target}-${index}`}>
                                  <TableCell>{row.target}</TableCell>
                                  <TableCell>{row.description}</TableCell>
                                  <TableCell>{row["p-value"]}</TableCell>
                                  <TableCell>{row.observed_ratio}</TableCell>
                                  <TableCell>{row.expected_ratio}</TableCell>
                                  <TableCell>{row.fold_enrichment ?? "-"}</TableCell>
                                  <TableCell>{row.count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Showing {enrichmentStartRecord} to {enrichmentEndRecord} of {enrichmentSortedRows.length} entries
                          </div>
                          <div className="flex gap-2 items-center">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                updateEnrichmentActiveTableState({ page: Math.max(1, enrichmentCurrentPage - 1) })
                              }
                              disabled={enrichmentCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {enrichmentCurrentPage} / {enrichmentTotalPages}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                updateEnrichmentActiveTableState({
                                  page: Math.min(enrichmentTotalPages, enrichmentCurrentPage + 1),
                                })
                              }
                              disabled={enrichmentCurrentPage === enrichmentTotalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
