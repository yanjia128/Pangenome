import React, { useEffect, useMemo, useState } from "react";
import "./home-analsis.css";
import {
  type KsData,
  type PlotlyLike,
  type PangenomeData,
  formatErrorMessage,
  loadKsData,
  loadPangenomeData,
  loadPlotly,
} from "./pangenome-data";

interface PlotlyClickPoint {
  x: unknown;
  y: unknown;
  z: unknown;
}

interface PlotlyClickEvent {
  points: PlotlyClickPoint[];
}

interface PlotlyEventTarget extends HTMLElement {
  on: (event: string, handler: (data: PlotlyClickEvent) => void) => void;
}

const ORTHO_HEATMAP_ID = "analsis-chart-ortho-heatmap";
const ORTHO_DETAIL_ID = "analsis-chart-ortho-detail";
const KS_HEATMAP_ID = "analsis-chart-ks-heatmap";
const KS_DETAIL_ID = "analsis-chart-ks-detail";

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

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function AnalsisPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotly, setPlotly] = useState<PlotlyLike | null>(null);
  const [pangenomeData, setPangenomeData] = useState<PangenomeData | null>(null);
  const [ksData, setKsData] = useState<KsData | null>(null);

  const [orthoDetailTitle, setOrthoDetailTitle] = useState("← 點擊左側熱圖中任一格");
  const [orthoDetailText, setOrthoDetailText] = useState("請先點擊左側熱圖。");
  const [ksDetailTitle, setKsDetailTitle] = useState("← 點擊左側熱圖中任一格");
  const [ksDetailText, setKsDetailText] = useState("請先點擊左側熱圖。");

  const [speciesA, setSpeciesA] = useState("");
  const [speciesB, setSpeciesB] = useState("");
  const [dotplotTitle, setDotplotTitle] = useState("請選擇物種對");
  const [dotplotSrc, setDotplotSrc] = useState<string | null>(null);
  const [dotplotFallbackSrc, setDotplotFallbackSrc] = useState<string | null>(null);
  const [dotplotTriedFallback, setDotplotTriedFallback] = useState(false);
  const [dotplotError, setDotplotError] = useState("");
  const [speciesTreeMissing, setSpeciesTreeMissing] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const [plotlyLib, loadedPangenomeData, loadedKsData] = await Promise.all([
          loadPlotly(),
          loadPangenomeData(),
          loadKsData(),
        ]);
        if (!mounted) {
          return;
        }
        setPlotly(plotlyLib);
        setPangenomeData(loadedPangenomeData);
        setKsData(loadedKsData);

        if (loadedKsData.assemblies.length >= 2) {
          setSpeciesA(loadedKsData.assemblies[0]);
          setSpeciesB(loadedKsData.assemblies[1]);
        }
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
    if (loading || !plotly || !pangenomeData || !ksData) {
      return;
    }

    const orthoHeatmapEl = document.getElementById(ORTHO_HEATMAP_ID);
    const orthoDetailEl = document.getElementById(ORTHO_DETAIL_ID);
    const ksHeatmapEl = document.getElementById(KS_HEATMAP_ID);
    const ksDetailEl = document.getElementById(KS_DETAIL_ID);
    if (!orthoHeatmapEl || !orthoDetailEl || !ksHeatmapEl || !ksDetailEl) {
      return;
    }

    void plotly.newPlot(
      orthoHeatmapEl,
      [
        {
          type: "heatmap",
          z: pangenomeData.overlap.matrix,
          x: pangenomeData.overlap.display.map(toScientificTag),
          y: pangenomeData.overlap.display.map(toScientificTag),
          colorscale: "Blues",
          reversescale: true,
          hovertemplate:
            "<b>%{y}</b> ∩ <b>%{x}</b><br>%{z:,} shared OGs<extra></extra>",
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

    const orthoChart = orthoHeatmapEl as PlotlyEventTarget | null;
    orthoChart?.on("plotly_click", (event: PlotlyClickEvent) => {
      const point = event.points[0];
      if (!point) {
        return;
      }

      const xLabel = stripTags(String(point.x));
      const yLabel = stripTags(String(point.y));
      const shared = Number(point.z);
      const xIndex = pangenomeData.overlap.display.indexOf(xLabel);
      const yIndex = pangenomeData.overlap.display.indexOf(yLabel);
      if (xIndex === -1 || yIndex === -1 || xIndex === yIndex) {
        return;
      }

      const totalA = pangenomeData.per_species.n_orthogroups[xIndex];
      const totalB = pangenomeData.per_species.n_orthogroups[yIndex];
      const uniqueA = totalA - shared;
      const uniqueB = totalB - shared;

      setOrthoDetailTitle(`${xLabel} ∩ ${yLabel}`);
      setOrthoDetailText(
        `${xLabel} 共 ${totalA.toLocaleString()} OGs，${(
          (shared / totalA) *
          100
        ).toFixed(1)}% 與 ${yLabel} 共有；${yLabel} 共 ${totalB.toLocaleString()} OGs，${(
          (shared / totalB) *
          100
        ).toFixed(1)}% 與 ${xLabel} 共有。`
      );

      void plotly.newPlot(
        orthoDetailEl,
        [
          {
            type: "bar",
            x: ["Shared", `${xLabel} 特有`, `${yLabel} 特有`],
            y: [shared, uniqueA, uniqueB],
            marker: { color: ["#2ca02c", "#1f77b4", "#ff7f0e"] },
            text: [
              shared.toLocaleString(),
              uniqueA.toLocaleString(),
              uniqueB.toLocaleString(),
            ],
            textposition: "outside",
            hovertemplate: "%{x}: %{y:,}<extra></extra>",
          },
        ],
        {
          ...LAYOUT_BASE,
          yaxis: { title: "Orthogroups", gridcolor: "#e9ecef" },
          margin: { t: 20, r: 20, b: 80, l: 70 },
        },
        PLOT_CONFIG
      );
    });

    const ksMatrix = ksData.medians.map((row, rowIdx) =>
      row.map((value, colIdx) => (rowIdx === colIdx ? null : value))
    );

    void plotly.newPlot(
      ksHeatmapEl,
      [
        {
          type: "heatmap",
          z: ksMatrix,
          x: ksData.display.map(toScientificTag),
          y: ksData.display.map(toScientificTag),
          colorscale: "RdYlGn_r",
          zauto: false,
          zmin: 0,
          zmax: 2,
          hovertemplate:
            "<b>%{y}</b> vs <b>%{x}</b><br>Ks median: %{z:.3f}<extra></extra>",
          colorbar: { title: "Median Ks", thickness: 15 },
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

    const ksChart = ksHeatmapEl as PlotlyEventTarget | null;
    ksChart?.on("plotly_click", (event: PlotlyClickEvent) => {
      const point = event.points[0];
      if (!point) {
        return;
      }

      const xLabel = stripTags(String(point.x));
      const yLabel = stripTags(String(point.y));
      const xIndex = ksData.display.indexOf(xLabel);
      const yIndex = ksData.display.indexOf(yLabel);
      if (xIndex === -1 || yIndex === -1 || xIndex === yIndex) {
        return;
      }

      const assemblyA = ksData.assemblies[xIndex];
      const assemblyB = ksData.assemblies[yIndex];
      const key = Object.keys(ksData.distributions).find((pairKey) => {
        const species = pairKey.split(":");
        if (species.length !== 2) {
          return false;
        }
        const left = species[0];
        const right = species[1];
        return (
          (left === assemblyA && right === assemblyB) ||
          (left === assemblyB && right === assemblyA)
        );
      });

      setKsDetailTitle(`${yLabel} vs ${xLabel} — Ks 分佈`);
      if (!key) {
        setKsDetailText("此物種對無 Ks 資料");
        return;
      }

      const distribution = ksData.distributions[key];
      const maxCount =
        distribution.counts.length > 0 ? Math.max(...distribution.counts) : 0;

      setKsDetailText(
        `n = ${distribution.n.toLocaleString()} 基因對 · 中位數 Ks = ${distribution.median.toFixed(
          4
        )}`
      );

      void plotly.newPlot(
        ksDetailEl,
        [
          {
            type: "bar",
            x: distribution.bins,
            y: distribution.counts,
            name: "Count",
            marker: { color: "#2566a8", opacity: 0.8 },
            hovertemplate: "Ks %{x:.2f}: %{y} pairs<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: `median ${distribution.median.toFixed(3)}`,
            x: [distribution.median, distribution.median],
            y: [0, maxCount],
            line: { color: "#c0392b", width: 2, dash: "dash" },
            hovertemplate: "Median Ks: %{x:.3f}<extra></extra>",
          },
        ],
        {
          ...LAYOUT_BASE,
          xaxis: { title: "Ks", gridcolor: "#e9ecef" },
          yaxis: { title: "Gene pairs", gridcolor: "#e9ecef" },
          legend: { x: 0.6, y: 0.95, bgcolor: "rgba(255,255,255,0.7)" },
          margin: { t: 20, r: 20, b: 60, l: 70 },
        },
        PLOT_CONFIG
      );
    });

    return () => {
      [ORTHO_HEATMAP_ID, ORTHO_DETAIL_ID, KS_HEATMAP_ID, KS_DETAIL_ID].forEach(
        (chartId) => {
          const chartEl = document.getElementById(chartId);
          if (chartEl) {
            plotly.purge(chartEl);
          }
        }
      );
    };
  }, [loading, ksData, pangenomeData, plotly]);

  const displayByAssembly = useMemo((): Record<string, string> => {
    if (!ksData) {
      return {};
    }
    const map: Record<string, string> = {};
    ksData.assemblies.forEach((assembly: string, index: number) => {
      map[assembly] = ksData.display[index];
    });
    return map;
  }, [ksData]);

  const showDotplot = () => {
    if (!speciesA || !speciesB) {
      return;
    }
    if (speciesA === speciesB) {
      setDotplotError("請選擇不同的兩個物種");
      return;
    }

    const primary = `/dendrobium/dotplots/${speciesA}.${speciesB}.png`;
    const fallback = `/dendrobium/dotplots/${speciesB}.${speciesA}.png`;
    setDotplotTitle(
      `${displayByAssembly[speciesA] || speciesA} vs ${
        displayByAssembly[speciesB] || speciesB
      }`
    );
    setDotplotSrc(primary);
    setDotplotFallbackSrc(fallback);
    setDotplotTriedFallback(false);
    setDotplotError("");
  };

  const showDotplotOverview = () => {
    setDotplotTitle("D. nobile × 25 物種總覽");
    setDotplotSrc("/dotplots/Dnobile_vs_all_dotplots.png");
    setDotplotFallbackSrc(null);
    setDotplotTriedFallback(true);
    setDotplotError("");
  };

  if (loading) {
    return <div className="pa-loading">Statistics（Analysis Figures）資料載入中...</div>;
  }

  if (error || !pangenomeData || !ksData) {
    return (
      <div className="pa-page">
        <div className="pa-error">
          Statistics（Analysis Figures）頁面初始化失敗：{error || "資料不存在"}
        </div>
      </div>
    );
  }

  return (
    <div className="pa-page">
      <h2 className="text-2xl font-semibold">Statistics · Analysis Figures</h2>

      <div className="pa-section-title">Species Phylogeny</div>
      <div className="pa-card">
        <div className="pa-card-header">Species Tree with Gene Category Distribution</div>
        <div className="pa-card-body">
          <div className="pa-desc">
            左側為物種樹，右側堆疊長條圖顯示 Core / Softcore / Dispensable / Private
            基因類別分佈。
          </div>
          {!speciesTreeMissing && (
            <img
              src="/dendrobium/species_tree.png"
              alt="Species Tree"
              style={{ cursor: "zoom-in", maxWidth: "100%" }}
              onClick={() => setLightboxSrc("/dendrobium/species_tree.png")}
              onError={() => setSpeciesTreeMissing(true)}
            />
          )}
          {speciesTreeMissing && (
            <div className="pa-warning">
              缺少圖片：/dendrobium/species_tree.png
            </div>
          )}
        </div>
      </div>

      <div className="pa-section-title">Ortholog Relationships</div>
      <div className="pa-grid-2">
        <div className="pa-card">
          <div className="pa-card-header">
            物種間共享 Orthogroup 數量熱圖（點擊查看右側詳情）
          </div>
          <div className="pa-card-body">
            <div id={ORTHO_HEATMAP_ID} className="pa-chart-tall" />
          </div>
        </div>
        <div className="pa-card">
          <div className="pa-card-header">{orthoDetailTitle}</div>
          <div className="pa-card-body">
            <div id={ORTHO_DETAIL_ID} className="pa-chart" />
            <div className="pa-desc">{orthoDetailText}</div>
          </div>
        </div>
      </div>

      <div className="pa-section-title">Ks Analysis</div>
      <div className="pa-grid-2">
        <div className="pa-card">
          <div className="pa-card-header">26×26 物種對 Ks 中位數熱圖</div>
          <div className="pa-card-body">
            <div id={KS_HEATMAP_ID} className="pa-chart-tall" />
          </div>
        </div>
        <div className="pa-card">
          <div className="pa-card-header">{ksDetailTitle}</div>
          <div className="pa-card-body">
            <div id={KS_DETAIL_ID} className="pa-chart" />
            <div className="pa-desc">{ksDetailText}</div>
          </div>
        </div>
      </div>

      <div className="pa-section-title">Gene Collinearity Dotplots</div>
      <div className="pa-select-row">
        <div className="pa-select-box">
          <label>物種 A</label>
          <select
            value={speciesA}
            onChange={(event) => setSpeciesA(event.target.value)}
          >
            {ksData.assemblies.map((assembly: string, index: number) => (
              <option key={assembly} value={assembly}>
                {ksData.display[index]}
              </option>
            ))}
          </select>
        </div>
        <div className="pa-select-box">
          <label>物種 B</label>
          <select
            value={speciesB}
            onChange={(event) => setSpeciesB(event.target.value)}
          >
            {ksData.assemblies.map((assembly: string, index: number) => (
              <option key={assembly} value={assembly}>
                {ksData.display[index]}
              </option>
            ))}
          </select>
        </div>
        <button className="pa-button" onClick={showDotplot}>
          顯示點圖
        </button>
        <button
          className="pa-button pa-button-secondary"
          onClick={showDotplotOverview}
        >
          全覽（D. nobile × 25）
        </button>
      </div>

      <div className="pa-card">
        <div className="pa-card-header">{dotplotTitle}</div>
        <div className="pa-dotplot-wrap">
          {!dotplotSrc && <span style={{ color: "#999" }}>請先選擇物種對</span>}
          {dotplotSrc && (
            <img
              src={dotplotSrc}
              alt="Dotplot"
              onError={() => {
                if (!dotplotTriedFallback && dotplotFallbackSrc) {
                  setDotplotSrc(dotplotFallbackSrc);
                  setDotplotTriedFallback(true);
                  return;
                }
                setDotplotError(`找不到點圖檔案：${dotplotSrc}`);
              }}
            />
          )}
        </div>
      </div>

      {dotplotError && <div className="pa-warning">{dotplotError}</div>}

      {lightboxSrc && (
        <div className="pa-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Lightbox" />
        </div>
      )}
    </div>
  );
}

export { AnalsisPage as default };
