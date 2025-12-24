export interface ProxyDomain {
  id: string;
  hostname: string;
  enabled: boolean;
  createdAt: number;
}

export interface StorageData {
  domains: ProxyDomain[];
  globalEnabled: boolean;
}

export const CORS_PROXY_URL = "https://corsproxy.io/?url=";

export const defaultStorage: StorageData = {
  domains: [],
  globalEnabled: true,
};
