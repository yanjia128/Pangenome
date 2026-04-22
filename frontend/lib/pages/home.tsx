import React, { useEffect, useMemo, useState } from "react";
import "./home-analsis.css";
import {
  type PangenomeData,
  type PlotlyLike,
  formatErrorMessage,
  loadPangenomeData,
  loadPlotly,
} from "./pangenome-data";

type SpeciesMetric =
  | "n_genes"
  | "n_in_orthogroups"
  | "n_unassigned"
  | "n_orthogroups"
  | "n_species_specific";

const CHART_IDS = [
  "home-chart-donut",
  "home-chart-species-bar",
  "home-chart-accum",
  "home-chart-heatmap",
  "home-chart-pca",
  "home-chart-dup",
];

const COLORS: Record<string, string> = {
  Core: "#00A087",
  Softcore: "#3C5488",
  Dispensable: "#F39B7F",
  Private: "#E64B35",
};

const SP_COLORS = [
  "#E64B35",
  "#4DBBD5",
  "#00A087",
  "#3C5488",
  "#F39B7F",
  "#8491B4",
  "#91D1C2",
  "#DC0000",
  "#7E6148",
  "#B09C85",
  "#AE482A",
  "#1B79B2",
  "#198063",
  "#2A3E6C",
  "#C97B63",
  "#6B75A0",
  "#74B0A3",
  "#AE0000",
  "#5E4A34",
  "#8A7868",
  "#D4785A",
  "#3A92C4",
  "#2DA87D",
  "#4A5E8E",
  "#E0A07A",
  "#9EAACB",
];

const METRIC_OPTIONS: Array<{ value: SpeciesMetric; label: string }> = [
  { value: "n_genes", label: "Total genes" },
  { value: "n_in_orthogroups", label: "Genes in orthogroups" },
  { value: "n_unassigned", label: "Unassigned genes" },
  { value: "n_orthogroups", label: "Orthogroups present" },
  { value: "n_species_specific", label: "Species-specific OGs" },
];

const METRIC_DESC: Record<SpeciesMetric, string> = {
  n_genes: "各物種基因組中預測的蛋白質編碼基因總數。",
  n_in_orthogroups: "成功歸入 Orthogroup（與其他物種有同源關係）的基因數量。",
  n_unassigned: "未能歸入任何 Orthogroup 的基因數量。",
  n_orthogroups: "該物種至少含有一個基因的 Orthogroup 總數。",
  n_species_specific: "僅在該物種中出現、其他物種不含有的 Orthogroup 數量。",
};

const LAYOUT_BASE: Record<string, unknown> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: {
    family: "Source Sans 3, Helvetica Neue, Arial, sans-serif",
    size: 13,
    color: "#1A1A1A",
  },
  margin: { t: 30, r: 20, b: 60, l: 60 },
};

const PLOT_CONFIG: Record<string, unknown> = {
  responsive: true,
  displayModeBar: false,
};

function toScientificTag(name: string): string {
  return `<i>${name}</i>`;
}

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotly, setPlotly] = useState<PlotlyLike | null>(null);
  const [data, setData] = useState<PangenomeData | null>(null);
  const [metric, setMetric] = useState<SpeciesMetric>("n_genes");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const [plotlyLib, pangenomeData] = await Promise.all([
          loadPlotly(),
          loadPangenomeData(),
        ]);
        if (!mounted) {
          return;
        }
        setPlotly(plotlyLib);
        setData(pangenomeData);
      } catch (initError: unknown) {
        if (!mounted) {
          return;
        }
        setError(formatErrorMessage(initError));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!plotly || !data) {
      return;
    }

    void plotly.newPlot(
      CHART_IDS[0],
      [
        {
          type: "pie",
          labels: data.classification.labels,
          values: data.classification.values,
          hole: 0.5,
          marker: {
            colors: data.classification.labels.map(
              (label: string): string => COLORS[label] || "#8892a0"
            ),
          },
          textinfo: "label+percent",
          hovertemplate:
            "<b>%{label}</b><br>%{value:,} orthogroups<br>%{percent}<extra></extra>",
        },
      ],
      {
        ...LAYOUT_BASE,
        showlegend: true,
        legend: { orientation: "h", y: -0.15 },
        margin: { t: 20, r: 20, b: 40, l: 20 },
        annotations: [
          {
            text: `${data.overall.n_orthogroups.toLocaleString()}<br>OGs`,
            x: 0.5,
            y: 0.5,
            showarrow: false,
            font: { size: 15, color: "#2d3436" },
          },
        ],
      },
      PLOT_CONFIG
    );

    void plotly.newPlot(
      CHART_IDS[2],
      [
        {
          x: data.accumulation.x,
          y: data.accumulation.pan_upper,
          showlegend: false,
          type: "scatter",
          mode: "lines",
          line: { width: 0 },
          fill: "none",
          hoverinfo: "skip",
        },
        {
          x: data.accumulation.x,
          y: data.accumulation.pan_lower,
          name: "Pangenome ±SD",
          type: "scatter",
          mode: "lines",
          fill: "tonexty",
          fillcolor: "rgba(255,127,14,0.2)",
          line: { width: 0 },
          showlegend: false,
          hoverinfo: "skip",
        },
        {
          x: data.accumulation.x,
          y: data.accumulation.pan_mean,
          name: "Pangenome",
          type: "scatter",
          mode: "lines+markers",
          line: { color: "#ff7f0e", width: 2.5 },
          marker: { size: 5 },
          hovertemplate: "N=%{x}<br>Pan: %{y:.0f}<extra></extra>",
        },
        {
          x: data.accumulation.x,
          y: data.accumulation.core_upper,
          showlegend: false,
          type: "scatter",
          mode: "lines",
          line: { width: 0 },
          fill: "none",
          hoverinfo: "skip",
        },
        {
          x: data.accumulation.x,
          y: data.accumulation.core_lower,
          name: "Core ±SD",
          type: "scatter",
          mode: "lines",
          fill: "tonexty",
          fillcolor: "rgba(44,160,44,0.2)",
          line: { width: 0 },
          showlegend: false,
          hoverinfo: "skip",
        },
        {
          x: data.accumulation.x,
          y: data.accumulation.core_mean,
          name: "Core Genome",
          type: "scatter",
          mode: "lines+markers",
          line: { color: "#2ca02c", width: 2.5 },
          marker: { size: 5 },
          hovertemplate: "N=%{x}<br>Core: %{y:.0f}<extra></extra>",
        },
      ],
      {
        ...LAYOUT_BASE,
        xaxis: { title: "Number of Species", dtick: 2, gridcolor: "#e9ecef" },
        yaxis: { title: "Orthogroups", gridcolor: "#e9ecef" },
        legend: { x: 0.7, y: 0.9 },
      },
      PLOT_CONFIG
    );

    void plotly.newPlot(
      CHART_IDS[3],
      [
        {
          type: "heatmap",
          z: data.overlap.matrix,
          x: data.overlap.display.map(toScientificTag),
          y: data.overlap.display.map(toScientificTag),
          colorscale: "YlGn",
          hovertemplate:
            "<b>%{y}</b> ∩ <b>%{x}</b><br>%{z:,} OGs<extra></extra>",
          colorbar: { title: "Shared OGs", thickness: 15 },
        },
      ],
      {
        ...LAYOUT_BASE,
        xaxis: { tickangle: -45, tickfont: { size: 9 } },
        yaxis: { tickfont: { size: 9 }, autorange: "reversed" },
        margin: { t: 20, r: 60, b: 130, l: 130 },
      },
      PLOT_CONFIG
    );

    void plotly.newPlot(
      CHART_IDS[4],
      [
        {
          type: "scatter",
          mode: "markers+text",
          x: data.pca.pc1,
          y: data.pca.pc2,
          text: data.pca.display.map(toScientificTag),
          textposition: "top center",
          textfont: { size: 9 },
          marker: {
            size: 10,
            color: "#2566a8",
            opacity: 0.85,
            line: { width: 1, color: "white" },
          },
          hovertemplate:
            "<b>%{text}</b><br>PC1:%{x:.3f}<br>PC2:%{y:.3f}<extra></extra>",
        },
      ],
      {
        ...LAYOUT_BASE,
        xaxis: {
          title: `PC1 (${data.pca.var_explained[0]}%)`,
          gridcolor: "#e9ecef",
          zeroline: true,
        },
        yaxis: {
          title: `PC2 (${data.pca.var_explained[1]}%)`,
          gridcolor: "#e9ecef",
          zeroline: true,
        },
        margin: { t: 30, r: 40, b: 60, l: 70 },
      },
      PLOT_CONFIG
    );

    void plotly.newPlot(
      CHART_IDS[5],
      [
        {
          type: "bar",
          orientation: "h",
          y: data.duplications.display.map(toScientificTag),
          x: data.duplications.counts,
          marker: { color: "#c0392b", opacity: 0.8 },
          hovertemplate: "<b>%{y}</b>: %{x:,}<extra></extra>",
        },
      ],
      {
        ...LAYOUT_BASE,
        xaxis: { title: "Duplication Events", gridcolor: "#e9ecef" },
        yaxis: { tickfont: { size: 11 }, autorange: true },
        margin: { t: 20, r: 40, b: 60, l: 150 },
      },
      PLOT_CONFIG
    );

    return () => {
      CHART_IDS.forEach((id: string) => {
        const chartEl = document.getElementById(id);
        if (chartEl) {
          plotly.purge(chartEl);
        }
      });
    };
  }, [plotly, data]);

  useEffect(() => {
    if (!plotly || !data) {
      return;
    }

    const values = data.per_species[metric];
    const sortedIndex = values
      .map((_: number, idx: number): number => idx)
      .sort((a: number, b: number): number => values[b] - values[a]);

    void plotly.react(
      CHART_IDS[1],
      [
        {
          type: "bar",
          x: sortedIndex.map((idx: number): string =>
            toScientificTag(data.per_species.display[idx])
          ),
          y: sortedIndex.map((idx: number): number => values[idx]),
          marker: {
            color: sortedIndex.map(
              (idx: number): string => SP_COLORS[idx % SP_COLORS.length]
            ),
          },
          hovertemplate: "<b>%{x}</b>: %{y:,}<extra></extra>",
        },
      ],
      {
        ...LAYOUT_BASE,
        xaxis: { tickangle: -40 },
        yaxis: { title: "Count", gridcolor: "#e9ecef" },
        margin: { t: 20, r: 20, b: 100, l: 80 },
      },
      PLOT_CONFIG
    );
  }, [data, metric, plotly]);

  const stats = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      {
        icon: "🌿",
        label: "Species",
        value: data.overall.n_species.toLocaleString(),
        color: "#2566a8",
      },
      {
        icon: "🧬",
        label: "Total Genes",
        value: data.overall.n_genes.toLocaleString(),
        color: "#1f77b4",
      },
      {
        icon: "🔗",
        label: "Orthogroups",
        value: data.overall.n_orthogroups.toLocaleString(),
        color: "#6c3d91",
      },
    ];
  }, [data]);

  if (loading) {
    return <div className="pa-loading">Home（Pangenome）資料載入中...</div>;
  }

  if (error || !data) {
    return (
      <div className="pa-page">
        <div className="pa-error">
          Home（Pangenome）頁面初始化失敗：{error || "資料不存在"}
        </div>
      </div>
    );
  }

  return (
    <div className="pa-page">
      <h2 className="text-2xl font-semibold">home · Pangenome</h2>

      <div className="pa-section-title">Overview</div>
      <div className="pa-stats">
        {stats.map((item) => (
          <div className="pa-stat-card" key={item.label}>
            <div style={{ fontSize: "1.5rem" }}>{item.icon}</div>
            <div className="pa-stat-value" style={{ color: item.color }}>
              {item.value}
            </div>
            <div className="pa-stat-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="pa-section-title">Gene Classification</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="pa-card">
          <div className="pa-card-header">Distribution by Category</div>
          <div className="pa-card-body">
            <div id={CHART_IDS[0]} className="pa-chart" />
          </div>
        </div>
        <div className="pa-card">
          <div className="pa-card-header">
            Pangenome &amp; Core Genome Size vs. Number of Species
          </div>
          <div className="pa-card-body">
            <div id={CHART_IDS[2]} className="pa-chart" />
          </div>
        </div>
      </div>

      <div className="pa-section-title">Per-Species Statistics</div>
      <div className="pa-card">
        <div className="pa-card-header">
          <div className="flex items-center justify-between gap-2">
            <span>Gene Counts by Species</span>
            <select
              value={metric}
              onChange={(event) =>
                setMetric(event.target.value as SpeciesMetric)
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pa-card-body">
          <div id={CHART_IDS[1]} className="pa-chart-tall" />
          <div className="pa-desc">{METRIC_DESC[metric]}</div>
        </div>
      </div>

      <div className="pa-section-title">Species Orthogroup Overlap</div>
      <div className="pa-card">
        <div className="pa-card-header">
          Number of shared orthogroups between species pairs
        </div>
        <div className="pa-card-body">
          <div id={CHART_IDS[3]} className="pa-chart-tall" />
        </div>
      </div>

      <div className="pa-section-title">PCA — Gene Presence/Absence</div>
      <div className="pa-card">
        <div className="pa-card-header">
          Principal Component Analysis of Orthogroup Presence/Absence Profiles
        </div>
        <div className="pa-card-body">
          <div id={CHART_IDS[4]} className="pa-chart" />
        </div>
      </div>

      <div className="pa-section-title">Gene Duplication Events</div>
      <div className="pa-card">
        <div className="pa-card-header">
          Duplications per Species (OrthoFinder gene tree inference)
        </div>
        <div className="pa-card-body">
          <div id={CHART_IDS[5]} className="pa-chart" />
          <div className="pa-desc">
            Data source:
            <code>
              {" "}
              OrthoFinder/Comparative_Genomics_Statistics/Duplications_per_Species_Tree_Node.tsv
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

export { HomePage as default };
