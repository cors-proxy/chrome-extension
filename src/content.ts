// Content script - runs in ISOLATED world
// Injects the interceptor into MAIN world and bridges config from background

interface ProxyDomain {
  hostname: string;
  enabled: boolean;
}

interface StorageConfig {
  domains: ProxyDomain[];
  globalEnabled: boolean;
}

// Inject the interceptor script into page context
function injectScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

// Send config to the injected script in MAIN world
function sendConfig(config: StorageConfig) {
  const proxyConfig = {
    domains: config.domains.filter((d) => d.enabled).map((d) => d.hostname),
    globalEnabled: config.globalEnabled,
  };

  window.dispatchEvent(
    new CustomEvent("__CORSPROXY_CONFIG__", { detail: proxyConfig })
  );
}

// Get config from background and send to page
async function updateConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
    if (response) {
      sendConfig(response);
    }
  } catch {
    // Extension context may be invalidated, ignore
  }
}

// Listen for config updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONFIG_UPDATE") {
    sendConfig(message.config);
  }
});

// Initialize
injectScript();

// Wait for injected script to load, then send config
setTimeout(updateConfig, 50);

// Also listen for storage changes directly
chrome.storage.onChanged.addListener(() => {
  updateConfig();
});
