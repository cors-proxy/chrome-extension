# API Reference

Internal APIs and interfaces used by CORSPROXY.

## Storage API

### `getStorage(): Promise<StorageData>`

Retrieves the current storage state.

```typescript
const { domains, globalEnabled } = await getStorage();
```

### `addDomain(hostname: string): Promise<ProxyDomain>`

Adds a new domain to the proxy list.

```typescript
const domain = await addDomain("api.example.com");
// { id: "uuid", hostname: "api.example.com", enabled: true, createdAt: 1234567890 }
```

Throws if domain already exists.

### `removeDomain(id: string): Promise<void>`

Removes a domain by ID.

```typescript
await removeDomain("uuid-here");
```

### `toggleDomain(id: string): Promise<void>`

Toggles a domain's enabled state.

```typescript
await toggleDomain("uuid-here");
```

### `toggleGlobal(): Promise<boolean>`

Toggles global enabled state. Returns new state.

```typescript
const isEnabled = await toggleGlobal();
```

## Message Protocol

### Content Script → Background

#### GET_CONFIG

Request current configuration.

```typescript
chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (response) => {
  // response: { domains: [...], globalEnabled: boolean }
});
```

### Background → Content Script

#### CONFIG_UPDATE

Broadcast configuration changes.

```typescript
{
  type: "CONFIG_UPDATE",
  config: {
    domains: [{ hostname: "api.example.com", enabled: true }],
    globalEnabled: true
  }
}
```

## Custom Events

### Content Script → Page (MAIN world)

#### __CORSPROXY_CONFIG__

Sends proxy configuration to injected script.

```typescript
window.dispatchEvent(
  new CustomEvent("__CORSPROXY_CONFIG__", {
    detail: {
      domains: ["api.example.com"],
      globalEnabled: true
    }
  })
);
```

## Types

```typescript
interface ProxyDomain {
  id: string;
  hostname: string;
  enabled: boolean;
  createdAt: number;
}

interface StorageData {
  domains: ProxyDomain[];
  globalEnabled: boolean;
}

interface ProxyConfig {
  domains: string[];      // Just hostnames
  globalEnabled: boolean;
}
```
