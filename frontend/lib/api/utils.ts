export function getFilteredPublicationsEndoint(
  args: {
    title: string;
    tag: string[];
  } = {
    title: "",
    tag: [],
  }
) {
  const { title, tag } = args;

  return `/api/publications/filter/?title=${title}&tag=${tag}`;
}

export function getPaginatedFilteredPublicationsEndoint(
  args: {
    title: string;
    tag: string[];
  } = {
    title: "",
    tag: [],
  }
) {
  const { title, tag } = args;

  return `/api/publications/p/filter/?title=${title}&tag=${tag ? tag : ""}`;
}

export function getPublicationEndpoint(slug: string) {
  return getPublicationsEndpoint + slug + "/";
}

export const getPublicationsEndpoint = "/api/publications/";
export const getPaginatedPublicationsEndpoint = getPublicationsEndpoint + "p/";
export const getOrthogroupsEndpoint = "/api/orthogroups/";
export function getOrthogroupFastaDownloadEndpoint(orthogroupId: string) {
  return `/api/orthogroups/${orthogroupId}/download/`;
}
export const getAnnotationEndpoint = "/api/annotation/";
export const getGeneTreesEndpoint = "/api/gene-trees/";
export const getDifferentialExpressionEndpoint = "/api/differential-expression/";
export const getEnrichmentAnalysisEndpoint = "/api/enrichment/";
export const getEnrichmentExampleGenesEndpoint = "/api/enrichment/example-genes/";
export function getGeneTreeDetailEndpoint(treeId: string) {
  return `/api/gene-trees/${treeId}/`;
}
