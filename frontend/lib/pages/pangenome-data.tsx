import { PANGENOME_DATA } from "./data";
import { KS_DATA } from "./ks_data";

export interface PangenomeData {
  overall: {
    n_species: number;
    n_genes: number;
    n_orthogroups: number;
    n_core: number;
    n_single_copy: number;
    pct_in_orthogroups: number;
  };
  classification: {
    labels: string[];
    values: number[];
  };
  per_species: {
    species: string[];
    display: string[];
    n_genes: number[];
    n_in_orthogroups: number[];
    n_unassigned: number[];
    n_orthogroups: number[];
    n_species_specific: number[];
  };
  accumulation: {
    x: number[];
    pan_upper: number[];
    pan_lower: number[];
    pan_mean: number[];
    core_upper: number[];
    core_lower: number[];
    core_mean: number[];
  };
  overlap: {
    species: string[];
    matrix: number[][];
    display: string[];
  };
  pca: {
    species: string[];
    pc1: number[];
    pc2: number[];
    var_explained: number[];
    display: string[];
  };
  duplications: {
    species: string[];
    display: string[];
    counts: number[];
  };
}

export interface KsDistribution {
  bins: number[];
  counts: number[];
  median: number;
  n: number;
}

export interface KsData {
  display: string[];
  assemblies: string[];
  medians: Array<Array<number | null>>;
  distributions: Record<string, KsDistribution>;
}

export interface PlotlyLike {
  newPlot: (
    target: string | HTMLElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<unknown>;
  react: (
    target: string | HTMLElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<unknown>;
  relayout: (
    target: string | HTMLElement,
    layout: Record<string, unknown>
  ) => Promise<unknown>;
  purge: (target: string | HTMLElement) => void;
}

declare global {
  interface Window {
    Plotly?: PlotlyLike;
    PANGENOME_DATA?: PangenomeData;
    KS_DATA?: KsData;
  }
}

let plotlyLoadPromise: Promise<PlotlyLike> | null = null;

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "發生未知錯誤";
}

export async function loadPlotly(): Promise<PlotlyLike> {
  if (window.Plotly) {
    return window.Plotly;
  }

  if (!plotlyLoadPromise) {
    plotlyLoadPromise = import("plotly.js-dist-min")
      .then((module) => {
        const loadedPlotly = (
          ("default" in module ? module.default : module) as PlotlyLike
        );
        if (!loadedPlotly) {
          throw new Error("Plotly 載入失敗");
        }
        window.Plotly = loadedPlotly;
        return loadedPlotly;
      })
      .catch((error: unknown) => {
        plotlyLoadPromise = null;
        throw error;
      });
  }

  return plotlyLoadPromise;
}

export async function loadPangenomeData(): Promise<PangenomeData> {
  if (!PANGENOME_DATA) {
    throw new Error(
      "找不到 PANGENOME_DATA。請確認 frontend/lib/pages/data.js 已匯出資料。"
    );
  }
  return PANGENOME_DATA as PangenomeData;
}

export async function loadKsData(): Promise<KsData> {
  if (!KS_DATA) {
    throw new Error(
      "找不到 KS_DATA。請確認 frontend/lib/pages/ks_data.js 已匯出資料。"
    );
  }
  return KS_DATA as KsData;
}

export type EnrichmentDomainKey = "GO" | "Pathway" | "pfam";

export type EnrichmentRow = {
  target: string;
  description: string;
  "p-value": number;
  observed_ratio: string;
  expected_ratio: string;
  fold_enrichment: number | null;
  count: number;
};

export type EnrichmentResponse = Partial<Record<EnrichmentDomainKey, EnrichmentRow[]>> & {
  error?: string;
};

export type EnrichmentPValueOption = 0.05 | 0.01 | 0.001;
export type EnrichmentCorrectionMethod = "None" | "FDR" | "Bonferroni";

export const ENRICHMENT_DOMAINS: EnrichmentDomainKey[] = ["GO", "Pathway", "pfam"];

export const ENRICHMENT_DOMAIN_LABELS: Record<EnrichmentDomainKey, string> = {
  GO: "GO",
  Pathway: "Pathway",
  pfam: "Pfam",
};

export type EnrichmentSortConfig = { key: keyof EnrichmentRow; direction: "asc" | "desc" } | null;
export type EnrichmentDomainTableState = {
  search: string;
  sortConfig: EnrichmentSortConfig;
  page: number;
};

export function defaultEnrichmentDomainTableState(): EnrichmentDomainTableState {
  return { search: "", sortConfig: null, page: 1 };
}

export function defaultEnrichmentDomainTableStates(): Record<EnrichmentDomainKey, EnrichmentDomainTableState> {
  return {
    GO: defaultEnrichmentDomainTableState(),
    Pathway: defaultEnrichmentDomainTableState(),
    pfam: defaultEnrichmentDomainTableState(),
  };
}
