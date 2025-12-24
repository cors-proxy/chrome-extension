import { getStorage } from "./storage";

// Store detected CORS errors per tab
const detectedErrors: Map<number, Set<string>> = new Map();

// Cache of proxied domains for quick lookup
let proxiedDomains: Set<string> = new Set();

// Update proxied domains cache
async function updateProxiedDomainsCache(): Promise<void> {
  const { domains, globalEnabled } = await getStorage();
  if (globalEnabled) {
    proxiedDomains = new Set(domains.filter((d) => d.enabled).map((d) => d.hostname));
  } else {
    proxiedDomains = new Set();
  }
}

// Initialize cache
updateProxiedDomainsCache();

// CORS-related error patterns (excluding adblocker errors)
const CORS_ERROR_PATTERNS = [
  "net::ERR_FAILED",
];

// Errors caused by adblockers, not CORS
const IGNORED_ERROR_PATTERNS = [
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_UNSAFE_REDIRECT",
  "net::ERR_ABORTED",
];

// Update badge for a specific tab
async function updateBadge(tabId: number): Promise<void> {
  const errors = detectedErrors.get(tabId);
  const count = errors?.size ?? 0;

  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ tabId, text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#f44" });
    } else {
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  } catch {
    // Tab might be closed
  }
}

// Extract hostname from URL
function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Check if request is cross-origin
function isCrossOrigin(requestUrl: string, initiatorUrl: string | undefined): boolean {
  if (!initiatorUrl) return false;

  const requestHost = getHostname(requestUrl);
  const initiatorHost = getHostname(initiatorUrl);

  return requestHost !== null && initiatorHost !== null && requestHost !== initiatorHost;
}

// Listen for failed requests (potential CORS errors)
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const { tabId, url, error, initiator } = details;

    if (tabId < 0) return;

    // Skip errors caused by adblockers
    if (IGNORED_ERROR_PATTERNS.some((p) => error.includes(p))) return;

    // Only process CORS-related errors
    if (!CORS_ERROR_PATTERNS.some((p) => error.includes(p))) return;

    if (!isCrossOrigin(url, initiator)) return;

    const hostname = getHostname(url);
    if (!hostname) return;

    // Skip if already proxied or in proxy list
    if (hostname === "corsproxy.io") return;
    if (proxiedDomains.has(hostname)) return;

    // Add to detected errors
    if (!detectedErrors.has(tabId)) {
      detectedErrors.set(tabId, new Set());
    }
    detectedErrors.get(tabId)!.add(hostname);

    updateBadge(tabId);
  },
  { urls: ["<all_urls>"] }
);

// Listen for response headers to detect CORS issues
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const { tabId, url, responseHeaders, initiator, statusCode } = details;

    if (tabId < 0) return;
    if (!isCrossOrigin(url, initiator)) return;
    if (statusCode < 400) return;

    const hostname = getHostname(url);
    if (!hostname) return;

    // Skip if already proxied or in proxy list
    if (hostname === "corsproxy.io") return;
    if (proxiedDomains.has(hostname)) return;

    // Check for missing CORS headers
    const hasAccessControl = responseHeaders?.some(
      (h) => h.name.toLowerCase() === "access-control-allow-origin"
    );

    if (!hasAccessControl) {
      if (!detectedErrors.has(tabId)) {
        detectedErrors.set(tabId, new Set());
      }
      detectedErrors.get(tabId)!.add(hostname);

      updateBadge(tabId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Clear detected errors when tab is updated or closed
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    detectedErrors.delete(tabId);
    updateBadge(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detectedErrors.delete(tabId);
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CONFIG") {
    getStorage().then((data) => {
      sendResponse({
        domains: data.domains.map((d) => ({
          hostname: d.hostname,
          enabled: d.enabled,
        })),
        globalEnabled: data.globalEnabled,
      });
    });
    return true;
  }

  if (message.type === "GET_DETECTED") {
    const { tabId } = message;
    const errors = detectedErrors.get(tabId);
    // Filter out domains that are now in the proxy list
    const filtered = errors
      ? Array.from(errors).filter((d) => !proxiedDomains.has(d))
      : [];
    sendResponse({ domains: filtered });
    return true;
  }

  if (message.type === "CLEAR_DETECTED") {
    const { tabId } = message;
    detectedErrors.delete(tabId);
    updateBadge(tabId);
    sendResponse({ success: true });
    return true;
  }
});

// Notify all tabs when storage changes and update cache
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && (changes.domains || changes.globalEnabled)) {
    // Update cache first
    await updateProxiedDomainsCache();

    const data = await getStorage();
    const config = {
      domains: data.domains.map((d) => ({
        hostname: d.hostname,
        enabled: d.enabled,
      })),
      globalEnabled: data.globalEnabled,
    };

    // Send to all tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "CONFIG_UPDATE", config }).catch(() => {});

        // Also update badge for this tab (remove detected domains that are now proxied)
        const errors = detectedErrors.get(tab.id);
        if (errors) {
          for (const hostname of Array.from(errors)) {
            if (proxiedDomains.has(hostname)) {
              errors.delete(hostname);
            }
          }
          updateBadge(tab.id);
        }
      }
    }
  }
});
