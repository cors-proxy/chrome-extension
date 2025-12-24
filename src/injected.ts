// This script runs in the MAIN world (page context)
// It intercepts fetch and XMLHttpRequest and routes through CORS proxy

const CORS_PROXY_URL = "https://corsproxy.io/?url=";

interface ProxyConfig {
  domains: string[];
  globalEnabled: boolean;
}

let config: ProxyConfig = { domains: [], globalEnabled: true };

// Listen for config updates from content script
// Config is passed via DOM data attribute (CustomEvent.detail doesn't cross worlds)
window.addEventListener("__CORSPROXY_CONFIG__", () => {
  const configStr = document.documentElement.dataset.corsproxyConfig;
  if (!configStr) return;

  try {
    const prev = config.domains.length;
    config = JSON.parse(configStr);
    if (prev === 0 && config.domains.length > 0) {
      console.log(`%c[CORSPROXY]%c Active for ${config.domains.length} domain(s)`, "color:#0070f3;font-weight:bold", "color:inherit");
    }
  } catch {
    // Invalid JSON, ignore
  }
});

function shouldProxy(url: string): boolean {
  if (!config.globalEnabled || config.domains.length === 0) return false;

  try {
    const urlObj = new URL(url, window.location.href);
    return config.domains.includes(urlObj.hostname);
  } catch {
    return false;
  }
}

function getProxiedUrl(url: string): string {
  const fullUrl = new URL(url, window.location.href).href;
  return CORS_PROXY_URL + encodeURIComponent(fullUrl);
}

// Override fetch
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  if (shouldProxy(url)) {
    const proxiedUrl = getProxiedUrl(url);
    console.log(`%c[CORSPROXY]%c ${new URL(url, location.href).hostname}`, "color:#0070f3;font-weight:bold", "color:#888");

    if (typeof input === "string" || input instanceof URL) {
      return originalFetch.call(this, proxiedUrl, init);
    } else {
      // Clone request with new URL
      const newRequest = new Request(proxiedUrl, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        mode: "cors",
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
      });
      return originalFetch.call(this, newRequest);
    }
  }

  return originalFetch.apply(this, arguments as any);
};

// Override XMLHttpRequest.open
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(
  method: string,
  url: string | URL,
  async: boolean = true,
  username?: string | null,
  password?: string | null
): void {
  const urlString = url instanceof URL ? url.href : url;

  if (shouldProxy(urlString)) {
    const proxiedUrl = getProxiedUrl(urlString);
    console.log(`%c[CORSPROXY]%c ${new URL(urlString, location.href).hostname}`, "color:#0070f3;font-weight:bold", "color:#888");
    return originalXHROpen.call(this, method, proxiedUrl, async, username, password);
  }

  return originalXHROpen.call(this, method, url, async, username, password);
};

