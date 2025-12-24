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
const globalToggle = document.getElementById(
  "globalToggle"
) as HTMLInputElement;

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  setTimeout(() => {
    errorEl.classList.remove("show");
  }, 3000);
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

async function render(): Promise<void> {
  const { domains, globalEnabled } = await getStorage();

  globalToggle.checked = globalEnabled;

  domainList.innerHTML = "";

  if (domains.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    // Sort by creation date, newest first
    const sorted = [...domains].sort((a, b) => b.createdAt - a.createdAt);
    for (const domain of sorted) {
      domainList.appendChild(createDomainItem(domain));
    }
  }
}

async function handleAdd(): Promise<void> {
  const value = domainInput.value.trim();
  if (!value) return;

  try {
    await addDomain(value);
    domainInput.value = "";
    await render();
  } catch (e) {
    showError(e instanceof Error ? e.message : "Failed to add domain");
  }
}

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

// Initial render
render();
