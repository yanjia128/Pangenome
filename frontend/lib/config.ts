export function getSecrets() {
  const nodeEnv = process.env.NODE_ENV;
  const authToken = process.env.AUTH_TOKEN;
  const browserApiBaseUrl =
    typeof window !== "undefined"
      ? window.location.pathname.startsWith("/dendrobium")
        ? `${window.location.origin}/dendrobium`
        : `${window.location.protocol}//${window.location.hostname}:8866`
      : "http://127.0.0.1:8866";
  const apiBaseUrl = process.env.API_BASE_URL || browserApiBaseUrl;
  const jbrowseServerUrl = process.env.JBROWSE_SERVER_URL || "/dendrobium/SyntneyViewer/";
  const isProd = nodeEnv === "production";

  return { nodeEnv, authToken, apiBaseUrl, jbrowseServerUrl, isProd };
}
