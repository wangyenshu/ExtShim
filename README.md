# ExtShim

Runs Chrome (MV2, MV3) and Firefox WebExtensions in a web page without installing them.

Input: an unpacked extension directory, `.zip`, `.crx` or `.xpi`.
Output: a script, bookmarklets, a userscript and an install page.

Tested with Chrome 153 and Firefox 155.

## Setup

```
npm install
npm run build
```

## Build

```
npx extshim build <extension> [options]
```

Output goes to `build/<name>/`, where `<name>` is the manifest `name` in lower-case with hyphens (override with `--name`).

| File | Purpose |
|---|---|
| `<name>.js` | Starts the extension when loaded with `<script src>`. |
| `<name>.bookmarklet.txt` | Bookmarklet containing the full bundle. Does not use `eval`, so it works under strict CSP and Trusted Types. |
| `<name>.bookmarklet-compressed.txt` | Deflate-compressed bookmarklet, about half the size. Requires a page that allows `eval`. |
| `<name>.bookmarklet-loader.txt` | Loads `<name>.js` from `--host-url`. Requires a page whose CSP allows that origin. Only produced with `--host-url`. |
| `<name>.user.js` | Userscript for Tampermonkey or Violentmonkey. Storage is shared across sites; cross-origin requests go through `GM_xmlhttpRequest`. |
| `index.html` | Install page with the files above and compatibility notes. |

Bundles include only the API modules the manifest permissions require. A typical extension is about 200 KB, or 75 KB gzipped. Firefox limits bookmark length to about 64 KB, so use the compressed or loader bookmarklet there.

| Option | Default | Description |
|---|---|---|
| `-o, --out <dir>` | `build/<name>` | Output directory |
| `--name <slug>` | manifest name | File name prefix |
| `--host-url <url>` | — | URL of `<name>.js`; enables the loader bookmarklet |
| `--no-minify` | — | Do not minify the runtime |
| `--no-launcher` | — | Hide the toolbar button |
| `--position <pos>` | `bottom-right` | Toolbar position: `bottom-right`, `bottom-left`, `top-right` or `top-left` |
| `--content-scripts <mode>` | `manifest` | `all` injects on every page, ignoring match patterns |
| `--storage <backend>` | `auto` | `indexedDB`, `localStorage` or `memory` |
| `--cors-proxy <url>` | — | Proxy prefix for cross-origin requests covered by `host_permissions`; `{url}` is replaced with the request URL |
| `--locale <code>` | browser | UI locale |
| `--menu-modifier <key>` | `altKey` | Modifier key that opens extension context menus on right-click: `shiftKey`, `ctrlKey`, `always` or `none` |
| `--id <id>` | derived | Extension ID, which also namespaces storage |

Other commands:

```
npx extshim serve <extension> [--port 8080]   serve an unpacked extension on a test page
npx extshim info <extension>                  list APIs used and page-specific limitations
```

## Runtime API

`dist/extshim.js` (produced by `npm run build`) contains the full runtime. `ExtShim.load()` compiles scripts at runtime, so the page must allow `eval`.

```js
const ext = await ExtShim.load(source, options);
```

`source` can be any of:
- a directory URL or manifest URL
- a `.zip`, `.crx` or `.xpi` URL
- a `File`, `Blob` or `ArrayBuffer`
- a `FileList` from `<input webkitdirectory>`
- a `Map` of path to bytes

| Option | Description |
|---|---|
| `contentScripts` | `'manifest'` (default), `'all'` or `false` |
| `ui` | `{ launcher: true, position: 'bottom-right' }` |
| `storage` | `'auto'`, `'indexedDB'`, `'localStorage'`, `'memory'`, or an object `{ load(area), save(area, data), subscribe?(area, cb) }` |
| `corsProxy` | Same as `--cors-proxy` |
| `locale` | UI locale |
| `log` | `'debug'`, `'info'` (default), `'warn'` or `'silent'` |
| `identity` | `{ redirectUrl, getAuthToken(details), profile }`, used by `chrome.identity` |
| `nativeMessaging` | `(app) => ({ postMessage, onMessage(cb), onDisconnect(cb), disconnect })`, used by `runtime.connectNative` and `runtime.sendNativeMessage` |
| `searchEngine` | URL with a `{searchTerms}` placeholder, used by `chrome.search` |
| `dnsResolver` | DNS-over-HTTPS endpoint, used by `chrome.dns` (default: Cloudflare) |
| `evalFunctions` | `true` re-evaluates `scripting.executeScript({ func })` source, as Chrome does (requires `eval`) |

Instance methods: `clickAction()`, `openOptions()`, `openSidePanel()`, `openDevTools()`, `reload()`, `stop()`.

`ExtShim.list()` returns the running extensions.

Alternatively, load from markup: `<script src="dist/extshim.js" data-extension="/path/to/extension/"></script>`.

## API coverage

Every member listed in `@types/chrome` (860) and `@types/firefox-webext-browser` (510) is defined.

| Behaviour | APIs |
|---|---|
| Same as in the browser | runtime, extension, i18n, storage, permissions, management, alarms, commands, scripting, offscreen, idle, tts, ttsEngine, webNavigation, action, browserAction, pageAction, contextMenus, menus, notifications, sidePanel, sidebarAction, omnibox, declarativeContent, userScripts, contentScripts, dom, find, theme, downloads, pageCapture, system.\*, power, clipboard |
| Limited to the current page or site | webRequest, declarativeNetRequest, cookies, browsingData, tabs.captureVisibleTab, tabCapture, desktopCapture, debugger, devtools.\*, input.ime, webAuthenticationProxy, audio, dns, identity, printing |
| Separate data per extension, not the browser's | bookmarks, history, topSites, sessions, readingList, tabGroups, contextualIdentities |
| Values stored and returned; no effect on the browser | privacy, proxy, contentSettings, fontSettings, browserSettings, accessibilityFeatures |
| Behave as on a device without the hardware or account | ChromeOS-only APIs (certificateProvider, documentScan, fileSystemProvider, vpnProvider, wallpaper, loginState, enterprise.\*, platformKeys, printerProvider), gcm message delivery, Firefox internals (telemetry, geckoProfiler, normandyAddonStudy, pkcs11, urlbar), mimeHandler |

How the in-page versions differ:

- **Browser UI.** Toolbar buttons, popups, side panels, notifications and the omnibox appear as in-page UI. Context menus open on Alt + right-click, or on right-click of the toolbar button.
- **webRequest and declarativeNetRequest.** These intercept the page's `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, resource URLs set from script, and link navigations. Resources requested by the HTML parser are reported but not blocked.
- **cookies.** Only the current site's non-HttpOnly cookies are accessible.
- **Capture.** `captureVisibleTab`, `tabCapture` and `desktopCapture` use `getDisplayMedia`. The browser shows a sharing prompt, and the call needs a recent user gesture.
- **debugger.** Supports `Runtime.evaluate`, `DOM.*`, `Input.*`, `Page.navigate`, `Page.reload`, `Page.captureScreenshot` and `Network.*`. Other methods fail with `'<method>' wasn't found`.
- **devtools.** Panels open in an in-page drawer, which has an element picker that sets `$0`.
- **bookmarks.** Bookmarks can be imported from an exported `bookmarks.html` through the toolbar button's menu.
- **history.** Records the pages the extension runs on.
- **identity.** `launchWebAuthFlow` requires a redirect URL on the page's origin. `getAuthToken` requires `options.identity.getAuthToken`.

`npx extshim info` and the install page list the notes that apply to a given extension.

## Limitations

- **One tab.** The current page is the extension's only tab. Each page load starts a new session: the background restarts, and alarms, MV3 context menus, DNR rules and registered scripts are restored.
- **Origin-bound storage.** Storage is per origin. The userscript build shares storage across sites. The toolbar button's menu can export and import storage.
- **CORS.** Cross-origin requests are subject to CORS unless you use the userscript build or `corsProxy`.
- **Partial isolation.** Content scripts get an isolated global scope, but built-ins (`Array`, `Promise`, …) are shared with the page. Reading an undeclared variable returns `undefined` instead of throwing.
- **executeScript.** `executeScript({ files })` returns `null` results. Without `evalFunctions`, `func` resolves free variables in the target page only during synchronous execution.
- **Classic scripts only.** Bundles use `with`; load them as classic scripts, not `type="module"`.

## Implementation

- **Extension pages.** The background, popup, options, side panel, offscreen and DevTools pages run in same-origin iframes inside a closed shadow root. Each has its own `chrome` object, prefixed `localStorage`/`indexedDB`, an emulated `location` (`chrome-extension://<id>/…`), and a `fetch`/`XMLHttpRequest` that serves extension files from memory.
- **Scope.** Each script is compiled into a function that runs inside `with (scope)`, where `scope` is a `Proxy`. Top-level declarations are shared between files of the same context.
- **No eval.** The CLI precompiles scripts and bundles ES modules with esbuild, so bundles need no `eval` and no injected `<script>`. Styles use constructable stylesheets. HTML is parsed through a Trusted Types policy, or a fallback parser when policies are not allowed.
- **Network interception.** Installed only for extensions that use webRequest, declarativeNetRequest, debugger or devtools.

## Development

```
npm run build       # dist/: extshim.js, extshim.min.js, extshim-builder.js, playground.html
npm run test:unit   # node test/unit.mjs
npm run test:e2e    # python3 test/e2e.py (Playwright); BROWSER=firefox for Firefox
npm run inventory   # regenerate test/api-inventory.json and src/runtime/api/enums.js
```

The end-to-end tests cover:
- the examples on normal, strict-CSP, script-less and Trusted Types pages;
- loading from a directory, zip and crx;
- userscript adapters and the playground;
- API coverage and API behaviour (`test/api-ext`);
- Google's chrome-extensions-samples, if present at `/tmp/chrome-extensions-samples`. The last run passed 100 of 100 buildable samples; 5 that need an npm build were skipped.

`dist/playground.html` is a standalone page that loads an extension directory, zip or crx, and builds a bookmarklet without Node.

| Path | Contents |
|---|---|
| `src/core/` | Shared code: manifest, match patterns, zip/crx, declaration scanner, code generation |
| `src/runtime/` | Browser runtime: `core.js` plus `api/*.js` modules |
| `src/cli/` | CLI: `build`, `serve`, `info` |
| `src/builder/` | In-browser builder used by the playground |
| `examples/` | `highlighter-mv3`, `classic-mv2`, `modules-mv3` |
| `test/` | Unit tests, end-to-end tests, API inventory, probe extensions |
