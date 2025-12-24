import { type StorageData, type ProxyDomain, defaultStorage } from "./types";

export async function getStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(["domains", "globalEnabled"]);
  return {
    domains: result.domains ?? defaultStorage.domains,
    globalEnabled: result.globalEnabled ?? defaultStorage.globalEnabled,
  };
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

export async function addDomain(hostname: string): Promise<ProxyDomain> {
  const { domains } = await getStorage();

  // Normalize hostname
  const normalized = hostname
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

  // Check for duplicates
  if (domains.some((d) => d.hostname === normalized)) {
    throw new Error("Domain already exists");
  }

  const newDomain: ProxyDomain = {
    id: crypto.randomUUID(),
    hostname: normalized,
    enabled: true,
    createdAt: Date.now(),
  };

  await setStorage({ domains: [...domains, newDomain] });
  return newDomain;
}

export async function removeDomain(id: string): Promise<void> {
  const { domains } = await getStorage();
  await setStorage({ domains: domains.filter((d) => d.id !== id) });
}

export async function toggleDomain(id: string): Promise<void> {
  const { domains } = await getStorage();
  await setStorage({
    domains: domains.map((d) =>
      d.id === id ? { ...d, enabled: !d.enabled } : d
    ),
  });
}

export async function toggleGlobal(): Promise<boolean> {
  const { globalEnabled } = await getStorage();
  const newState = !globalEnabled;
  await setStorage({ globalEnabled: newState });
  return newState;
}
