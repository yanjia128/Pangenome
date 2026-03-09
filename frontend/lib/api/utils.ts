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
export const getGeneTreesEndpoint = "/api/gene-trees/";
export function getGeneTreeDetailEndpoint(treeId: string) {
  return `/api/gene-trees/${treeId}/`;
}
