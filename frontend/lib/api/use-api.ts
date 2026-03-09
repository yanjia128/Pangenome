import {
  getPaginatedPublicationsEndpoint,
  getPublicationsEndpoint,
  getPublicationEndpoint,
  getFilteredPublicationsEndoint,
  getPaginatedFilteredPublicationsEndoint,
  getOrthogroupsEndpoint,
  getGeneTreesEndpoint,
  getGeneTreeDetailEndpoint,
} from "./utils";
import { getSecrets } from "../config";
import type { GetPaginatedPublicationsResponse, Publication } from "./types";

const { isProd, authToken } = getSecrets();

const LOCAL_API_URL = "http://localhost:8866";

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
        return isProd ? filtered : LOCAL_API_URL + filtered;
      }
      return isProd ? getPublicationsEndpoint : LOCAL_API_URL + getPublicationsEndpoint;
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

        return LOCAL_API_URL + getPaginatedPublicationsEndpoint;
      }

      if (args.querystring) {
        return args.querystring;
      }

      if (args.page && !args.filter) {
        if (isProd) {
          return getPaginatedPublicationsEndpoint + `?page=${args.page}`;
        }

        return (
          LOCAL_API_URL +
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
          LOCAL_API_URL +
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
        : LOCAL_API_URL + getPublicationEndpoint(slug),
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
      : LOCAL_API_URL + getOrthogroupsEndpoint + query;

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
      : LOCAL_API_URL + getGeneTreesEndpoint + query;

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
    const endpoint = isProd ? path : LOCAL_API_URL + path;

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

  return {
    getPublications,
    getPaginatedPublications,
    getPublication,
    getOrthogroups,
    getGeneTreeList,
    getGeneTree,
  };
}
