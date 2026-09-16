import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Button,
  Spinner,
} from "flowbite-react";
import { HiChevronUp, HiChevronDown } from "react-icons/hi";
import { useApi } from "../api/use-api";
import {
  loadPlotly,
  type PlotlyLike,
  ENRICHMENT_DOMAINS as ALL_DOMAINS,
  ENRICHMENT_DOMAIN_LABELS as DOMAIN_LABELS,
  defaultEnrichmentDomainTableState as defaultDomainTableState,
  defaultEnrichmentDomainTableStates,
  type EnrichmentDomainKey as DomainKey,
  type EnrichmentRow,
  type EnrichmentResponse,
  type EnrichmentPValueOption as PValueOption,
  type EnrichmentCorrectionMethod as CorrectionMethod,
  type EnrichmentSortConfig as SortConfig,
  type EnrichmentDomainTableState as DomainTableState,
} from "./pangenome-data";

type SpeciesOption = { label: string; backendSpecies: string };

const SPECIES_OPTIONS: SpeciesOption[] = [
  { label: "D. bullenianum", backendSpecies: "Dbullenianum" },
  { label: "D. cariniferum", backendSpecies: "Dcariniferum" },
  { label: "D. exile", backendSpecies: "Dexile" },
  { label: "D. lindleyi", backendSpecies: "Dlindleyi" },
  { label: "D. nobile", backendSpecies: "Dnobile" },
  { label: "D. parcum", backendSpecies: "Dparcum" },
  { label: "D. porphyrochilum", backendSpecies: "Dporphyrochilum" },
  { label: "D. secundum", backendSpecies: "Dsecundum" },
  { label: "D. thyrsiflorum", backendSpecies: "Dthyrsiflorum" },
];

const PAGE_SIZE = 25;

// Sequential blue ramp (light -> dark), used for the -log10(p) color scale in the bubble plot.
const SEQUENTIAL_BLUE_COLORSCALE: Array<[number, string]> = [
  [0, "#cde2fb"],
  [0.2, "#9ec5f4"],
  [0.4, "#6da7ec"],
  [0.6, "#2a78d6"],
  [0.8, "#184f95"],
  [1, "#0d366b"],
];

export default function EnrichmentPage() {
  const { submitEnrichmentAnalysis, getEnrichmentExampleGenes } = useApi();

  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesOption>(SPECIES_OPTIONS[0]);
  const [pValue, setPValue] = useState<PValueOption>(0.05);
  const [correctionMethod, setCorrectionMethod] = useState<CorrectionMethod>("None");
  const [geneInput, setGeneInput] = useState("");

  const [loadingExample, setLoadingExample] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<EnrichmentResponse | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [activeDomainTab, setActiveDomainTab] = useState<DomainKey | null>(null);

  const [domainTableState, setDomainTableState] = useState<Record<DomainKey, DomainTableState>>(
    defaultEnrichmentDomainTableStates()
  );

  const bubblePlotRef = useRef<HTMLDivElement | null>(null);
  const volcanoPlotRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyLike | null>(null);

  const domainsWithResults = useMemo(() => {
    if (!analysisResult) return [];
    return ALL_DOMAINS.filter((domain) => (analysisResult[domain]?.length ?? 0) > 0);
  }, [analysisResult]);

  const activeRows = useMemo(() => {
    if (!analysisResult || !activeDomainTab) return [];
    return analysisResult[activeDomainTab] ?? [];
  }, [analysisResult, activeDomainTab]);

  const activeTableState = activeDomainTab
    ? domainTableState[activeDomainTab]
    : defaultDomainTableState();

  const filteredRows = useMemo(() => {
    if (!activeTableState.search) return activeRows;
    const term = activeTableState.search.toLowerCase();
    return activeRows.filter(
      (row) =>
        row.target.toLowerCase().includes(term) ||
        row.description?.toLowerCase().includes(term)
    );
  }, [activeRows, activeTableState.search]);

  const sortedRows = useMemo(() => {
    const { sortConfig } = activeTableState;
    if (!sortConfig) return filteredRows;

    return [...filteredRows].sort((a, b) => {
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
  }, [filteredRows, activeTableState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(activeTableState.page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, currentPage]);

  const updateActiveTableState = (patch: Partial<DomainTableState>) => {
    if (!activeDomainTab) return;
    setDomainTableState((prev) => ({
      ...prev,
      [activeDomainTab]: { ...prev[activeDomainTab], ...patch },
    }));
  };

  const handleSort = (key: keyof EnrichmentRow) => {
    const current = activeTableState.sortConfig;
    const direction: "asc" | "desc" =
      current?.key === key && current.direction === "asc" ? "desc" : "asc";
    updateActiveTableState({ sortConfig: { key, direction }, page: 1 });
  };

  const handleReset = () => {
    setGeneInput("");
  };

  const handleExample = async () => {
    setLoadingExample(true);
    try {
      const response = await getEnrichmentExampleGenes(selectedSpecies.backendSpecies);
      setGeneInput(response.geneList.join(","));
    } finally {
      setLoadingExample(false);
    }
  };

  const handleSubmit = async () => {
    setAnalysisError("");

    if (!geneInput.trim()) {
      setAnalysisError("請輸入至少一個基因名稱。");
      return;
    }

    setRunningAnalysis(true);
    setAnalysisResult(null);
    setActiveDomainTab(null);
    setDomainTableState(defaultEnrichmentDomainTableStates());

    try {
      const response = (await submitEnrichmentAnalysis({
        species: selectedSpecies.backendSpecies,
        input: geneInput,
        p_value: pValue,
        correctionMethod,
      })) as EnrichmentResponse;

      if (response.error) {
        setAnalysisError(response.error);
        return;
      }

      setAnalysisResult(response);
      const firstDomainWithData = ALL_DOMAINS.find((domain) => (response[domain]?.length ?? 0) > 0);
      setActiveDomainTab(firstDomainWithData ?? ALL_DOMAINS[0]);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "富集分析失敗，請稍後再試。");
    } finally {
      setRunningAnalysis(false);
    }
  };

  useEffect(() => {
    if (!activeDomainTab || activeRows.length === 0) {
      return;
    }

    void (async () => {
      const Plotly = plotlyRef.current ?? (await loadPlotly());
      plotlyRef.current = Plotly;

      const rows = activeRows.filter(
        (row) => row.fold_enrichment !== null && Number.isFinite(row.fold_enrichment)
      );
      if (rows.length === 0) return;

      // Shared x-axis (log2 Fold Enrichment) range AND shared margins so the
      // bubble plot and volcano plot's plot areas start/end at the same pixel
      // offsets and their x-axes line up when stacked.
      const xValues = rows.map((r) => r.fold_enrichment as number);
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const xPadding = Math.max((xMax - xMin) * 0.08, 0.5);
      const sharedXRange: [number, number] = [xMin - xPadding, xMax + xPadding];
      // Fixed (non-auto) margin shared by both plots. automargin would let the
      // bubble plot's long category labels resize its own margin independently
      // of the volcano plot, breaking the alignment.
      const sharedMargin = { t: 50, l: 220, r: 30, b: 50 };
      const truncateLabel = (label: string, maxLen = 30) =>
        label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label;

      if (bubblePlotRef.current) {
        const sorted = [...rows].sort(
          (a, b) => (b.fold_enrichment ?? 0) - (a.fold_enrichment ?? 0)
        );
        const maxCount = Math.max(...rows.map((r) => r.count), 1);

        await Plotly.newPlot(
          bubblePlotRef.current,
          [
            {
              x: sorted.map((r) => r.fold_enrichment),
              y: sorted.map((r) => truncateLabel(r.description || r.target)),
              mode: "markers",
              type: "scatter",
              marker: {
                size: sorted.map((r) => 8 + (r.count / maxCount) * 22),
                color: sorted.map((r) => r["p-value"]),
                colorscale: SEQUENTIAL_BLUE_COLORSCALE,
                showscale: true,
                colorbar: { title: { text: "-log10(P)" } },
                line: { color: "#fcfcfb", width: 1 },
              },
              text: sorted.map(
                (r) => `Target: ${r.target}<br>Description: ${r.description || r.target}<br>Count: ${r.count}`
              ),
              hovertemplate:
                "Fold Enrichment (log2): %{x}<br>%{text}<br>-log10(P): %{marker.color}<extra></extra>",
            },
          ],
          {
            title: { text: `Bubble Plot for ${DOMAIN_LABELS[activeDomainTab]}` },
            xaxis: { title: { text: "log2(Fold Enrichment)" }, range: sharedXRange },
            yaxis: { title: { text: "Description" }, automargin: false },
            margin: sharedMargin,
          },
          { responsive: true }
        );
      }

      if (volcanoPlotRef.current) {
        const cutoff = pValue > 0 ? -Math.log10(pValue) : 0;

        await Plotly.newPlot(
          volcanoPlotRef.current,
          [
            {
              x: rows.map((r) => r.fold_enrichment),
              y: rows.map((r) => r["p-value"]),
              mode: "markers",
              type: "scatter",
              marker: { color: "#2a78d6", size: 8, line: { color: "#fcfcfb", width: 1 } },
              text: rows.map((r) => r.target),
              hovertemplate:
                "Target: %{text}<br>Fold Enrichment (log2): %{x}<br>-log10(P): %{y}<extra></extra>",
            },
          ],
          {
            title: { text: `Volcano Plot for ${DOMAIN_LABELS[activeDomainTab]}` },
            xaxis: { title: { text: "log2(Fold Enrichment)" }, range: sharedXRange },
            yaxis: { title: { text: "-log10(P-Value)" } },
            shapes: [
              {
                type: "line",
                x0: 0,
                x1: 1,
                xref: "paper",
                y0: cutoff,
                y1: cutoff,
                line: { dash: "dash", color: "#d03b3b", width: 2 },
              },
            ],
            margin: sharedMargin,
          },
          { responsive: true }
        );
      }
    })();

    return () => {
      if (plotlyRef.current) {
        if (bubblePlotRef.current) plotlyRef.current.purge(bubblePlotRef.current);
        if (volcanoPlotRef.current) plotlyRef.current.purge(volcanoPlotRef.current);
      }
    };
  }, [activeDomainTab, activeRows, pValue]);

  const startRecord = sortedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(currentPage * PAGE_SIZE, sortedRows.length);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Enrichment Analysis</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex-shrink-0">
            <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Choose Species:
            </label>
            <select
              id="species-select"
              className="block w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white italic"
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
            <label htmlFor="p-value-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              P-Value (Cut Off):
            </label>
            <select
              id="p-value-select"
              className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={pValue}
              onChange={(e) => setPValue(parseFloat(e.target.value) as PValueOption)}
            >
              <option value={0.05}>0.05</option>
              <option value={0.01}>0.01</option>
              <option value={0.001}>0.001</option>
            </select>
          </div>

          <div className="flex-shrink-0">
            <label htmlFor="correction-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Correction Method:
            </label>
            <select
              id="correction-select"
              className="block w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={correctionMethod}
              onChange={(e) => setCorrectionMethod(e.target.value as CorrectionMethod)}
            >
              <option value="None">None</option>
              <option value="FDR">FDR</option>
              <option value="Bonferroni">Bonferroni</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="gene-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Input Gene for Enrichment Analysis
          </label>
          <textarea
            id="gene-input"
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter gene names, separated by newlines or commas."
            value={geneInput}
            onChange={(e) => setGeneInput(e.target.value)}
          />
          <small className="text-gray-500 dark:text-gray-400">
            Separate multiple gene names by new lines or commas.
          </small>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" color="light" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="button"
            color="light"
            onClick={() => void handleExample()}
            isProcessing={loadingExample}
            processingSpinner={<Spinner size="sm" />}
          >
            Example
          </Button>
          <Button
            type="button"
            color="blue"
            onClick={() => void handleSubmit()}
            disabled={runningAnalysis || !geneInput.trim()}
            isProcessing={runningAnalysis}
            processingSpinner={<Spinner size="sm" />}
          >
            {runningAnalysis ? "Running Analysis..." : "Submit Analysis"}
          </Button>
        </div>

        {analysisError && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">
            <strong>錯誤：</strong> {analysisError}
          </div>
        )}
      </div>

      {analysisResult && !analysisError && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {domainsWithResults.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              沒有符合目前 P-value 門檻與校正方法的結果，請嘗試調整條件。
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
                {domainsWithResults.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setActiveDomainTab(domain)}
                    className={
                      "px-4 py-2 text-sm font-medium rounded-t-md " +
                      (activeDomainTab === domain
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600")
                    }
                  >
                    {DOMAIN_LABELS[domain]}
                  </button>
                ))}
              </div>

              {activeDomainTab && (
                <div>
                  <div className="mb-4 flex justify-between items-center">
                    <input
                      type="text"
                      placeholder="Search target..."
                      value={activeTableState.search}
                      onChange={(e) => updateActiveTableState({ search: e.target.value, page: 1 })}
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
                            onClick={() => handleSort(key)}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="flex items-center gap-1">
                              <span>{label}</span>
                              {activeTableState.sortConfig?.key === key &&
                                (activeTableState.sortConfig.direction === "asc" ? (
                                  <HiChevronUp className="w-4 h-4" />
                                ) : (
                                  <HiChevronDown className="w-4 h-4" />
                                ))}
                            </div>
                          </TableHeadCell>
                        ))}
                      </TableHead>
                      <TableBody className="divide-y">
                        {paginatedRows.map((row, index) => (
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
                      Showing {startRecord} to {endRecord} of {sortedRows.length} entries
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateActiveTableState({ page: Math.max(1, currentPage - 1) })}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          updateActiveTableState({ page: Math.min(totalPages, currentPage + 1) })
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6">
                    <div>
                      <h5 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Bubble Plot</h5>
                      <div
                        ref={bubblePlotRef}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                        style={{ minHeight: "450px" }}
                      />
                    </div>
                    <div>
                      <h5 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Volcano Plot</h5>
                      <div
                        ref={volcanoPlotRef}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg"
                        style={{ minHeight: "450px" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
