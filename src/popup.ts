import {
  getStorage,
  addDomain,
  removeDomain,
  toggleDomain,
  toggleGlobal,
} from "./storage";
import type { ProxyDomain } from "./types";

const domainInput = document.getElementById("domainInput") as HTMLInputElement;
const addBtn = document.getElementById("addBtn") as HTMLButtonElement;
const domainList = document.getElementById("domainList") as HTMLUListElement;
const emptyState = document.getElementById("emptyState") as HTMLDivElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const globalToggle = document.getElementById("globalToggle") as HTMLInputElement;
const detectedSection = document.getElementById("detectedSection") as HTMLDivElement;
const detectedList = document.getElementById("detectedList") as HTMLUListElement;
const reloadBanner = document.getElementById("reloadBanner") as HTMLDivElement;
const reloadBtn = document.getElementById("reloadBtn") as HTMLButtonElement;

let currentTabId: number | null = null;
let existingDomains: Set<string> = new Set();
let needsReload = false;

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  setTimeout(() => {
    errorEl.classList.remove("show");
  }, 3000);
}

function showReloadBanner(): void {
  needsReload = true;
  reloadBanner.classList.remove("hidden");
}

async function reloadCurrentTab(): Promise<void> {
  if (currentTabId) {
    await chrome.tabs.reload(currentTabId);
    window.close();
  }
}

function createDeleteIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.innerHTML = `
    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
  `;
  return svg;
}

function createDomainItem(domain: ProxyDomain): HTMLLIElement {
  const li = document.createElement("li");
  li.className = `domain-item ${domain.enabled ? "enabled" : "disabled"}`;
  li.dataset.id = domain.id;

  const toggle = document.createElement("label");
  toggle.className = "domain-toggle";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = domain.enabled;
  checkbox.addEventListener("change", async () => {
    await toggleDomain(domain.id);
    await render();
  });

  const slider = document.createElement("span");
  slider.className = "toggle-slider";

  toggle.appendChild(checkbox);
  toggle.appendChild(slider);

  const hostname = document.createElement("span");
  hostname.className = "hostname";
  hostname.textContent = domain.hostname;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-delete";
  deleteBtn.title = "Remove domain";
  deleteBtn.appendChild(createDeleteIcon());
  deleteBtn.addEventListener("click", async () => {
    await removeDomain(domain.id);
    await render();
  });

  li.appendChild(deleteBtn);
  li.appendChild(hostname);
  li.appendChild(toggle);

  return li;
}

function createDetectedItem(hostname: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "detected-item";

  const hostnameEl = document.createElement("span");
  hostnameEl.className = "hostname";
  hostnameEl.textContent = hostname;

  const quickAddBtn = document.createElement("button");
  quickAddBtn.className = "btn-quick-add";
  quickAddBtn.textContent = "Add";
  quickAddBtn.addEventListener("click", async () => {
    try {
      await addDomain(hostname);
      showReloadBanner();
      await render();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add domain");
    }
  });

  li.appendChild(hostnameEl);
  li.appendChild(quickAddBtn);

  return li;
}

async function loadDetectedDomains(): Promise<string[]> {
  if (!currentTabId) return [];

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_DETECTED", tabId: currentTabId },
      (response) => {
        resolve(response?.domains ?? []);
      }
    );
  });
}

async function render(): Promise<void> {
  const { domains, globalEnabled } = await getStorage();

  globalToggle.checked = globalEnabled;
  existingDomains = new Set(domains.map((d) => d.hostname));

  domainList.innerHTML = "";

  if (domains.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    const sorted = [...domains].sort((a, b) => b.createdAt - a.createdAt);
    for (const domain of sorted) {
      domainList.appendChild(createDomainItem(domain));
    }
  }

  // Load and render detected domains
  const detected = await loadDetectedDomains();
  const newDetected = detected.filter((d) => !existingDomains.has(d));

  detectedList.innerHTML = "";

  if (newDetected.length > 0) {
    detectedSection.classList.remove("hidden");
    for (const hostname of newDetected) {
      detectedList.appendChild(createDetectedItem(hostname));
    }
  } else {
    detectedSection.classList.add("hidden");
  }
}

async function handleAdd(): Promise<void> {
  const value = domainInput.value.trim();
  if (!value) return;

  try {
    await addDomain(value);
    domainInput.value = "";
    showReloadBanner();
    await render();
  } catch (e) {
    showError(e instanceof Error ? e.message : "Failed to add domain");
  }
}

// Get current tab ID
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.id) {
    currentTabId = tabs[0].id;
    render();
  }
});

// Event listeners
addBtn.addEventListener("click", handleAdd);

domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleAdd();
  }
});

globalToggle.addEventListener("change", async () => {
  await toggleGlobal();
  await render();
});

reloadBtn.addEventListener("click", reloadCurrentTab);

// Initial render
render();
