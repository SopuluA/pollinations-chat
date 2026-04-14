# Flow — Visual HTTP Automation

**Flow** is a browser-native visual automation builder. Drag nodes onto a canvas, wire them together, and run HTTP pipelines — no backend, no account, no install. Everything runs in your browser and persists to `localStorage`.

Live: **[pollinations-chat-kohl.vercel.app](https://pollinations-chat-kohl.vercel.app)**

---

## What it is

Flow is what you get if n8n had no server and no Electron wrapper. You build directed graphs of typed nodes — HTTP requests, auth, transforms, conditions, AI calls — wire them together with bezier edges, and hit Run. The execution engine topologically sorts the graph and executes each node in dependency order, passing the output of each upstream node downstream as `{{input}}`.

No backend. No keys. No login. Deploys as a single static HTML file.

---

## Node types

| Node | Icon | What it does |
|---|---|---|
| **Trigger** | ⚡ | Entry point. Provides static text or a manual start signal. Supports `{{varName}}` interpolation. |
| **HTTP Request** | 🌐 | Fires a `fetch()` call: GET, POST, PUT, PATCH, DELETE, HEAD. Configurable URL, headers, body, and inline auth. Supports `{{input}}` and `{{varName}}` in all fields. |
| **Auth** | 🔑 | Standalone auth node. Bearer token, API key (custom header), or HTTP Basic. Wire it upstream of any HTTP Request node to inject auth automatically. |
| **Paginate** | 📄 | Loops over an upstream HTTP Request node, appending `?page=N` (or a configurable param). Concatenates all array results. Stops early on an empty page. |
| **Extract** | 🔍 | Picks a field from upstream JSON using dot-notation paths (`data.items[0].name`, `results[*]`). Optionally saves the extracted value to a named variable. |
| **Transform** | ⚙ | Reshapes upstream text via a Mustache-style template (`{{input}}`, `{{varName}}`). Prefix with `return` to write a raw JS function body with access to `input` (string) and `vars` (object). |
| **Set Variable** | 📌 | Stores a value under a named variable. Passes upstream data through unchanged. Variables are visible in the sidebar and available via `{{varName}}` in all subsequent nodes. |
| **Condition** | 🔀 | Branches on HTTP status, response body, or a response header. Operators: `eq`, `neq`, `gt`, `lt`, `contains`, `starts_with`. If the condition is not met, the node passes `null` downstream and silently stops that branch. |
| **AI Process** | 🤖 | Sends upstream data to [Pollinations AI](https://pollinations.ai) (free, no API key required). Configurable system prompt and user message template. `{{input}}` interpolates upstream text. |
| **Output** | 📤 | Terminal node. Displays the final result in the execution log. Configurable label and format (`auto`, `json`, `text`). |

---

## Example workflows

### Fetch and summarize a public API

```
Trigger
  → HTTP Request  GET https://jsonplaceholder.typicode.com/posts
  → Extract       path: [*]
  → AI Process    prompt: "Summarize these posts in 3 bullet points:\n\n{{input}}"
  → Output
```

### Paginate a results API

```
Trigger
  → HTTP Request  GET https://api.example.com/items
  → Paginate      page_param=page, start=1, max_pages=10
  → Extract       path: data.items[*]
  → Output
```

### Auth-protected POST with a condition gate

```
Trigger  input: {"name": "test record"}
  → Auth          type: bearer  value: {{API_TOKEN}}
  → HTTP Request  POST https://api.example.com/records
                  body: {"name": "{{input}}"}
  → Condition     check: status  eq  201
  → Output        label: Created record
```

### Extract a token, reuse it in a second request

```
Trigger
  → HTTP Request  GET https://api.example.com/session
  → Extract       path: token  →  save_as: session_token
  → HTTP Request  GET https://api.example.com/data
                  auth_type: bearer  value: {{session_token}}
  → Output
```

---

## How to use

1. **Drag** a node from the left sidebar onto the canvas.
2. **Click** a node to open its config panel on the right.
3. **Wire nodes** by dragging from the bottom port (output) of one node to the top port (input) of the next. Click an edge to delete it.
4. **Use `{{input}}`** in any text field to reference the upstream node's output.
5. **Use `{{varName}}`** to reference any value stored by a Set Variable or Extract node.
6. **Hit Run** in the header. Nodes execute in topological order. The log panel shows per-node status, HTTP details, and timing.
7. **Save / Load** to persist your canvas to `localStorage`. Clear wipes everything.

**Keyboard shortcuts:**
- `Escape` — cancel a connection in progress, deselect node
- `Delete` / `Backspace` — delete selected node (when no input field is focused)

---

## Tech stack

| Concern | Choice |
|---|---|
| Runtime | Browser — no Node, no bundler, no framework |
| Canvas | Absolute-positioned `div` elements + SVG bezier edges |
| Fetch | Native `fetch()` API |
| AI | [Pollinations AI](https://text.pollinations.ai/openai) — free, no key required |
| Persistence | `localStorage` (key: `flow-v2`) |
| Deployment | Vercel static hosting |
| Routing | `vercel.json` rewrites all paths to `index.html` |
| Dependencies | None |

---

## Local development

No build step required.

```bash
git clone https://github.com/SopuluA/pollinations-chat
cd pollinations-chat

# Option 1: Python
python3 -m http.server 8080

# Option 2: Node
npx serve .

# Option 3: VS Code
# Install the "Live Server" extension, right-click index.html → Open with Live Server
```

Open `http://localhost:8080`.

To deploy: push to any branch connected to a Vercel project. The `vercel.json` rewrites handle SPA routing.

---

## Current architecture

The entire app lives in `index.html`. The JavaScript (~680 lines) is organized into named sections:

| Section | Responsibility |
|---|---|
| State | `nodes[]`, `edges[]`, `vars{}`, run/drag/connect flags |
| `NODE_DEF` / `DEFAULTS` | Node type registry and default configs per type |
| DOM helpers | `createNode`, `mountNode`, `preview`, `chip` |
| Canvas interaction | Drag, port wiring, bezier SVG edge rendering |
| Config panel | `buildConfig`, field builders (`addField`, `addKVSection`, etc.) |
| Execution engine | `runFlow`, `execNode` dispatch, `topoSort`, `resolveVars` |
| Persistence | save, load, clear via `localStorage` |

---

## Planned multi-file architecture

The current single-file approach works but does not scale to new node types or collaborators. The target structure for a proper static SPA — still no backend, still Vercel-deployable, still zero build step required:

```
src/
├── index.html               # Shell only — loads modules via <script type="module">
├── main.js                  # Entry point: init state, bind UI, wire events
├── state.js                 # Centralized mutable state with getters/setters
│
├── nodes/
│   ├── registry.js          # NODE_DEF and DEFAULTS — single source of truth
│   ├── trigger.js           # execNode for trigger type
│   ├── request.js           # execNode for HTTP request
│   ├── auth.js
│   ├── paginate.js
│   ├── extract.js
│   ├── transform.js
│   ├── set_var.js
│   ├── condition.js
│   ├── ai.js
│   └── output.js
│
├── engine/
│   ├── runner.js            # runFlow, topoSort, per-node execution loop
│   ├── resolver.js          # resolveVars, template interpolation, getPath
│   └── context.js           # per-run context: outputs{}, nodeCtx{}, vars{}
│
├── canvas/
│   ├── canvas.js            # Drop zone, canvas mousedown, showEmpty
│   ├── node-element.js      # mountNode, refreshBody, chip, preview
│   ├── edges.js             # redrawEdges, bezier, portXY, connect/cancelConn
│   └── drag.js              # mousemove/mouseup drag logic
│
├── config/
│   ├── panel.js             # openConfig, buildConfig, deselect
│   ├── fields.js            # addField, addSelectField, addKVSection, addHint
│   └── response-preview.js  # showResponsePreview
│
├── log/
│   └── log.js               # lg(), getTagColor, esc, log-clear handler
│
├── persistence/
│   └── storage.js           # save, load, clear — localStorage abstraction
│
└── styles/
    ├── base.css
    ├── layout.css
    ├── nodes.css
    ├── config-panel.css
    └── log.css
```

**Migration path (in order, each step independently deployable):**

1. Extract CSS into `styles/` — no behavior change, safe first PR.
2. Extract `state.js` with a minimal pub/sub or event emitter — all state mutations go through it.
3. Extract `nodes/registry.js` and one node file at a time — start with `ai.js` (most isolated, no DOM).
4. Extract `engine/` — `topoSort` and `execNode` dispatch are pure logic with zero DOM dependency.
5. Extract `canvas/edges.js` and `canvas/drag.js` — DOM-coupled but no business logic.
6. Extract `config/` — build the panel against centralized state.
7. Wire everything in `main.js` via ES module imports.

ES modules load natively in every modern browser. Vercel serves them without a bundler. If tree-shaking or TypeScript becomes desirable later, Vite works with this directory structure without reorganization.

---

Built with [Pollinations AI](https://pollinations.ai) · Deployed on [Vercel](https://vercel.com)
