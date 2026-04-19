# @excellent-react-spreadsheet/site

Marketing, documentation, and playground site for `excellent-react-spreadsheet`. Built with [VitePress 1.x](https://vitepress.dev/) plus a small React-island bridge so demos can be written as plain React components.

## Local development

From the **repo root**:

```sh
pnpm site           # dev server at http://localhost:5173
pnpm site:build     # static build → apps/site/.vitepress/dist/
pnpm site:preview   # serve the built output locally
```

The `site:build` script routes through Turborepo so the workspace dependencies (`excellent-react-spreadsheet`, `@excellent-react-spreadsheet/tailwind`) are built first and cached.

## Deploying to Cloudflare Pages

Three options. Pick one.

### Option A. GitHub Actions (recommended)

The repo already ships [`.github/workflows/deploy-site.yml`](../../.github/workflows/deploy-site.yml). Each push to `main` triggers a production deploy; each PR gets a preview URL posted as a check.

One-time setup:

1. On Cloudflare, create a Pages project named `excellent-react-spreadsheet` (or update `PROJECT_NAME` in the workflow).
   - Choose **Direct Upload** — the workflow uploads the built `dist/`.
2. Generate a Cloudflare API token with scope **Cloudflare Pages → Edit** and **Account → Read**.
3. On GitHub → `Settings` → `Secrets and variables` → `Actions`, add:
   - `CLOUDFLARE_API_TOKEN` = the API token
   - `CLOUDFLARE_ACCOUNT_ID` = your Cloudflare account ID

That's it. Merge to `main`, the site deploys.

### Option B. Manual deploy from your laptop

```sh
pnpm site:deploy
```

This builds the site and calls `wrangler pages deploy` via `pnpm dlx` (no install needed). The first run will prompt you to log in via `wrangler login`, or you can set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell.

If the Pages project does not exist yet:

```sh
pnpm dlx wrangler pages project create excellent-react-spreadsheet --production-branch=main
```

### Option C. Dashboard Git integration

Skip the workflow entirely and point Cloudflare Pages at the GitHub repo. Use these build settings:

| Setting                | Value                                               |
| ---------------------- | --------------------------------------------------- |
| Framework preset       | None                                                |
| Build command          | `pnpm install --frozen-lockfile && pnpm site:build` |
| Build output directory | `apps/site/.vitepress/dist`                         |
| Root directory         | _(leave blank — the monorepo root)_                 |
| Environment variable   | `NODE_VERSION=20.11.0`                              |

This option is simplest to set up but runs the build on Cloudflare's slower builders (5–8 min) instead of GitHub's (~1 min).

## Caching

[`public/_headers`](./public/_headers) tells Cloudflare to cache content-hashed assets immutably and always revalidate HTML. No config is needed on the Pages dashboard.

## Folder layout

```
apps/site/
├── .vitepress/
│   ├── config.ts        # nav, sidebar, search, theme
│   ├── vite.config.ts   # adds @vitejs/plugin-react
│   └── theme/
│       ├── index.ts     # registers <ReactIsland>
│       ├── custom.css   # brand tokens, demo frame styling
│       └── components/ReactIsland.vue
├── demos/               # React TSX — mounted via <ReactIsland>
├── guide/               # long-form docs
├── api/                 # API reference
├── public/              # copied as-is (logo, favicon, _headers)
├── index.md             # landing page
├── comparison.md
├── playground.md
└── roadmap.md
```
