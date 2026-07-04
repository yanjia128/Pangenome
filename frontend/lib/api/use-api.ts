import {
  getPaginatedPublicationsEndpoint,
  getPublicationsEndpoint,
  getPublicationEndpoint,
  getFilteredPublicationsEndoint,
  getPaginatedFilteredPublicationsEndoint,
  getOrthogroupsEndpoint,
  getOrthogroupFastaDownloadEndpoint,
  getGeneTreesEndpoint,
  getGeneTreeDetailEndpoint,
  getDifferentialExpressionEndpoint,
} from "./utils";
import { getSecrets } from "../config";
import type { GetPaginatedPublicationsResponse, Publication } from "./types";

const { isProd, authToken, apiBaseUrl } = getSecrets();

export function useApi() {
  const getHeaders = new Headers({
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    Authorization: "Token " + authToken,
  });

  async function getPublications(args?: {
    title?: string;
    tag?: string[];
  }): Promise<Publication[]> {
    const endpoint = (() => {
      if (args?.title || (args?.tag && args.tag.length > 0)) {
        const filtered = getFilteredPublicationsEndoint({
          title: args.title ?? "",
          tag: args.tag ?? [],
        });
        return isProd ? filtered : apiBaseUrl + filtered;
      }
      return isProd ? getPublicationsEndpoint : apiBaseUrl + getPublicationsEndpoint;
    })();

    return fetch(endpoint, {
      cache: "default",
      method: "GET",
      headers: getHeaders,
    })
      .then((response) => response.json() as Promise<Publication[]>)
      .catch((error) => {
        console.error(error);
        return [] as Publication[];
      });
  }

  async function getPaginatedPublications(args?: {
    page?: number;
    querystring?: string;
    filter?: {
      title?: string;
      tags?: string[];
    };
  }): Promise<GetPaginatedPublicationsResponse> {
    const endpoint = (() => {
      if (!args) {
        if (isProd) {
          return getPaginatedPublicationsEndpoint;
        }

        return apiBaseUrl + getPaginatedPublicationsEndpoint;
      }

      if (args.querystring) {
        return args.querystring;
      }

      if (args.page && !args.filter) {
        if (isProd) {
          return getPaginatedPublicationsEndpoint + `?page=${args.page}`;
        }

        return (
          apiBaseUrl +
          getPaginatedPublicationsEndpoint +
          `?page=${args.page}`
        );
      } else if (args.filter) {
        if (isProd) {
          return getPaginatedFilteredPublicationsEndoint({
            title: args.filter.title,
            tag: args.filter.tags,
          });
        }

        return (
          apiBaseUrl +
          getPaginatedFilteredPublicationsEndoint({
            title: args.filter.title,
            tag: args.filter.tags,
          })
        );
      }
    })();

    return fetch(endpoint, {
      cache: "default",
      method: "GET",
      headers: getHeaders,
    })
      .then((response) => response.json() as Promise<GetPaginatedPublicationsResponse>)
      .catch((error) => {
        console.error(error);
        return { count: 0, current_page: 1, total_pages: 0, next: null, previous: null, results: [] } as GetPaginatedPublicationsResponse;
      });
  }

  async function getPublication(slug: string): Promise<Publication> {
    return fetch(
      isProd
        ? getPublicationEndpoint(slug)
        : apiBaseUrl + getPublicationEndpoint(slug),
      {
        cache: "default",
        method: "GET",
        headers: getHeaders,
      }
    )
      .then((response) => response.json() as Promise<Publication>)
      .catch((error) => {
        console.error(error);
        return {} as Publication;
      });
  }

  async function getOrthogroups(args?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<{ count: number; num_pages: number; results: Record<string, unknown>[] }> {
    const params = new URLSearchParams();
    if (args?.page) params.set("page", args.page.toString());
    if (args?.page_size) params.set("page_size", args.page_size.toString());
    if (args?.search) params.set("search", args.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    const endpoint = isProd
      ? getOrthogroupsEndpoint + query
      : apiBaseUrl + getOrthogroupsEndpoint + query;

    return fetch(endpoint, {
      cache: "default",
      method: "GET",
      headers: getHeaders,
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error(error);
        return { count: 0, num_pages: 0, results: [] as Record<string, unknown>[] };
      });
  }

  async function downloadOrthogroupFasta(orthogroupId: string): Promise<Blob> {
    const path = getOrthogroupFastaDownloadEndpoint(orthogroupId);
    const endpoint = isProd ? path : apiBaseUrl + path;

    const response = await fetch(endpoint, {
      cache: "no-cache",
      method: "GET",
      headers: getHeaders,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = await response.json();
        if (typeof errorData?.error === "string" && errorData.error.length > 0) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parsing errors and keep the HTTP-based message.
      }

      throw new Error(errorMessage);
    }

    return response.blob();
  }

  async function getGeneTreeList(args?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<{ count: number; results: { id: string; filename: string }[] }> {
    const params = new URLSearchParams();
    if (args?.page) params.set("page", args.page.toString());
    if (args?.page_size) params.set("page_size", args.page_size.toString());
    if (args?.search) params.set("search", args.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    const endpoint = isProd
      ? getGeneTreesEndpoint + query
      : apiBaseUrl + getGeneTreesEndpoint + query;

    return fetch(endpoint, {
      cache: "default",
      method: "GET",
      headers: getHeaders,
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error(error);
        return { count: 0, results: [] as { id: string; filename: string }[] };
      });
  }

  async function getGeneTree(treeId: string): Promise<{ id: string; newick: string } | null> {
    const path = getGeneTreeDetailEndpoint(treeId);
    const endpoint = isProd ? path : apiBaseUrl + path;

    return fetch(endpoint, {
      cache: "default",
      method: "GET",
      headers: getHeaders,
    })
      .then((response): Promise<{ id: string; newick: string }> => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch((error): null => {
        console.error(error);
        return null;
      });
  }

  async function submitDifferentialExpression(payload: {
    species: string;
    method: "edgeR" | "DESeq2";
    control_samples: string[];
    comparison_samples: string[];
    all_columns_map: { col: string; stat: "control" | "comparison" | "unselected" }[];
    size: string;
    fdr: number;
    logfc: number;
  }): Promise<{
    status?: string;
    volcano_path?: string;
    ma_path?: string;
    csv_path?: string;
    jobID?: string;
    cached?: boolean;
    method?: string;
    error?: string;
  } | null> {
    const mappedMethod = payload.method === "DESeq2" ? "DESeq2" : "edgeR";
    const endpoint = isProd
      ? getDifferentialExpressionEndpoint
      : apiBaseUrl + getDifferentialExpressionEndpoint;

    return fetch(endpoint, {
      cache: "no-cache",
      method: "POST",
      headers: new Headers({
        ...Object.fromEntries(getHeaders.entries()),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        ...payload,
        method: mappedMethod,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          return { error: data?.error ?? `HTTP ${response.status}` };
        }
        return data;
      })
      .catch((error) => {
        console.error(error);
        return { error: "Differential expression request failed." };
      });
  }

  return {
    getPublications,
    getPaginatedPublications,
    getPublication,
    getOrthogroups,
    downloadOrthogroupFasta,
    getGeneTreeList,
    getGeneTree,
    submitDifferentialExpression,
  };
}
