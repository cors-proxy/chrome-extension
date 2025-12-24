import { getStorage } from "./storage";

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    return true; // Keep channel open for async response
  }
});

// Notify all tabs when storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && (changes.domains || changes.globalEnabled)) {
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
        chrome.tabs.sendMessage(tab.id, { type: "CONFIG_UPDATE", config }).catch(() => {
          // Tab might not have content script, ignore
        });
      }
    }
  }
});

