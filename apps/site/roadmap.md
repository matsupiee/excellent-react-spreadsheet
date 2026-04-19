# Roadmap

The library is pre-1.0. Here is what ships today, what is landing next, and what is intentionally out of scope.

## Shipped today

- `useSpreadsheet` headless hook with controlled rows, selection, and active cell
- JSON-patch history engine with coalescing and `maxHistory` (default 200)
- TSV/CSV-compatible clipboard (`copy`, `paste`, `cut`) with typed serializers per column
- Row virtualization via `useRowVirtualizer`
- Column presets: `textColumn`, `intColumn`, `floatColumn`, `dateColumn`, `selectColumn`, `checkboxColumn`, `customColumn`
- Tailwind preset (`@excellent-react-spreadsheet/tailwind`) exposing CSS variables

## Working on next (v1.0)

- `<Spreadsheet>` pre-styled component that sits on top of `useSpreadsheet`
- `height="auto"` / `parentFill` layout modes bundled with the component
- Row reordering (drag) and built-in add/remove row UI
- Fill handle (drag bottom-right corner to copy)
- E2E tests on the component itself, not just the gallery

## Formula engine (v1.0 scope, not yet public)

`@excellent-react-spreadsheet/formula` ships as a separate entry point so apps that do not use formulas pay zero bundle cost.

Planned for v1.0:

- Cell references: `=A1`, `=A1+B1`
- Range references: `=SUM(A1:A10)`
- Functions: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `IF`, `AND`, `OR`, `ROUND`
- Error propagation (`#REF!`, `#DIV/0!`, `#NAME?`)
- Incremental recomputation from a dependency graph

Today the package exports a stub interface only. Follow the repo for progress.

## Considered but deferred

- **Column virtualization** (v1.1+) — row virtualization is enough for most data shapes.
- **Cell merging** (v1.1+) — requires a rethink of the selection model.
- **Validation decorators** — will land as a column-level option, not a cross-cutting concern.
- **Custom formula functions at runtime** — v1.1 once the core function set is stable.

## Out of scope

- Full Excel-compatible formulas (we pick a small, documented subset)
- Pivot tables, charts, group/aggregate rows
- Mobile-first touch interactions (desktop is the v1 target)

If you want to push on one of these items, please open an issue first so we can talk about scope.
