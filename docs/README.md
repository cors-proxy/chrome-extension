# CORSPROXY Developer Documentation

Technical documentation for developers who want to understand, modify, or contribute to CORSPROXY.

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Build System](#build-system)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Contributing](#contributing)

## Architecture

CORSPROXY uses a three-layer architecture required by Chrome's Manifest V3:

```
┌─────────────────────────────────────────────────────────┐
│ Page Context (MAIN world)                               │
│   └─ injected.js                                        │
│       - Intercepts fetch() and XMLHttpRequest           │
│       - Rewrites URLs to use CORS proxy                 │
│       - Receives config via CustomEvent                 │
│                     ▲                                   │
│                     │ CustomEvent                       │
├─────────────────────┼───────────────────────────────────┤
│ Content Script (ISOLATED world)                         │
│   └─ content.js                                         │
│       - Injects injected.js into page                   │
│       - Bridges config from background to page          │
│       - Listens for storage changes                     │
│                     ▲                                   │
│                     │ chrome.runtime.sendMessage        │
├─────────────────────┼───────────────────────────────────┤
│ Service Worker                                          │
│   └─ background.js                                      │
│       - Manages chrome.storage                          │
│       - Responds to config requests                     │
│       - Broadcasts config updates to tabs               │
└─────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **MAIN world injection** - Required to intercept `fetch`/`XHR` in page context
2. **Web Accessible Resources** - `injected.js` loaded via `<script src>` to bypass CSP
3. **ISOLATED world content script** - Can use `chrome.*` APIs to communicate with background
4. **Service Worker** - Persistent storage and cross-tab coordination

## Project Structure

```
chrome-extension/
├── src/
│   ├── background.ts    # Service worker - storage & messaging
│   ├── content.ts       # Content script - injection & bridging
│   ├── injected.ts      # Page script - fetch/XHR interception
│   ├── popup.ts         # Extension popup logic
│   ├── popup.html       # Popup markup
│   ├── popup.css        # Popup styles (dark theme)
│   ├── storage.ts       # Storage utilities
│   └── types.ts         # TypeScript interfaces
├── assets/
│   ├── icon.png         # Extension icon
│   └── logo.png         # Logo for popup header
├── dist/                # Built extension (git-ignored)
├── docs/                # Developer documentation
├── build.ts             # Bun build script
├── manifest.json        # Chrome extension manifest
├── package.json
└── tsconfig.json
```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Google Chrome

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd chrome-extension

# Install dependencies
bun install
```

### Development Mode

```bash
# Start watch mode - rebuilds on file changes
bun run dev
```

### Loading the Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
5. After code changes, click the refresh icon on the extension card

## Build System

The build uses Bun's native bundler (`build.ts`):

```bash
bun run build    # Production build (minified)
bun run dev      # Watch mode (with sourcemaps)
bun run clean    # Remove dist folder
```

### Build Output

| File | Format | Description |
|------|--------|-------------|
| `popup.js` | ESM | Popup script |
| `background.js` | ESM | Service worker |
| `content.js` | IIFE | Content script (isolated world) |
| `injected.js` | IIFE | Page script (main world) |

Content and injected scripts use IIFE format for compatibility.

## How It Works

### 1. Injection Flow

```
Page Load
    │
    ▼
content.js runs (document_start)
    │
    ├─► Creates <script src="injected.js">
    │
    ├─► Requests config from background.js
    │
    └─► Dispatches CustomEvent with config
            │
            ▼
      injected.js receives config
            │
            ▼
      fetch/XHR interception active
```

### 2. Request Interception

```javascript
// Original request
fetch('https://api.example.com/data')

// Intercepted and rewritten to:
fetch('https://corsproxy.io/?url=https%3A%2F%2Fapi.example.com%2Fdata')
```

### 3. URL Transformation

```typescript
function getProxiedUrl(url: string): string {
  const fullUrl = new URL(url, window.location.href).href;
  return "https://corsproxy.io/?url=" + encodeURIComponent(fullUrl);
}
```

## Configuration

### Storage Schema

```typescript
interface StorageData {
  domains: ProxyDomain[];
  globalEnabled: boolean;
}

interface ProxyDomain {
  id: string;           // UUID
  hostname: string;     // e.g., "api.example.com"
  enabled: boolean;     // Per-domain toggle
  createdAt: number;    // Timestamp
}
```

### Manifest Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Persist domain list |
| `tabs` | Send config updates to all tabs |
| `<all_urls>` | Inject content script on any page |

## Contributing

### Code Style

- TypeScript strict mode
- No semicolons (Bun default)
- 2-space indentation

### Testing Changes

1. Make changes to `src/` files
2. Run `bun run build`
3. Reload extension in Chrome
4. Test on a page with CORS errors

### Adding Features

1. **New proxy service**: Update `CORS_PROXY_URL` in `injected.ts` and `types.ts`
2. **New storage fields**: Update `types.ts` and `storage.ts`
3. **UI changes**: Modify `popup.html`, `popup.css`, `popup.ts`

## Troubleshooting

### Extension not intercepting requests

- Ensure the domain is added and enabled in popup
- Reload the target page after adding domain
- Check console for `[CORSPROXY]` logs

### CSP errors

- The extension uses `web_accessible_resources` to bypass CSP
- If issues persist, check if the site has unusual CSP rules

### Service worker errors

- Remove and re-add the extension to clear cached workers
- Check `chrome://serviceworker-internals/` for stuck workers
