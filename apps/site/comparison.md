# Why another spreadsheet?

`excellent-react-spreadsheet` exists to solve the papercuts that pile up when you try to use `react-datasheet-grid` in a real product. It is not a replacement for full grids like AG Grid — it intentionally stays small and focused on editing.

## The five issues driving this library

| #   | Papercut in existing React grids                                                                                   | How this library fixes it                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Cell editors are hard to swap for your design system. Portal handling, outside-click, and keyboard are all manual. | `renderEditor` hands you a plain `EditorContext` — mount a Chakra/MUI component and let the library handle focus/commit. |
| 2   | Callbacks (`rowClassName`, etc.) capture stale state, forcing `Ref` workarounds.                                   | Every callback runs with fresh closures. Use React state normally.                                                       |
| 3   | `height` is required and `ResizeObserver` is your problem.                                                         | `height="auto"` and parent-fill modes ship out of the box. (coming with `<Spreadsheet>`)                                 |
| 4   | No typed column presets. You hand-roll parsers and formatters every time.                                          | `textColumn` / `intColumn` / `floatColumn` / `dateColumn` / `selectColumn` / `checkboxColumn` are all in the box.        |
| 5   | No undo/redo. Deep-cloning rows is the only recourse.                                                              | Built-in history with JSON-Patch diffs and coalescing. 200 entries by default.                                           |

## Against the alternatives

| Concern                        | excellent-react-spreadsheet      | react-datasheet-grid | AG Grid Community               |
| ------------------------------ | -------------------------------- | -------------------- | ------------------------------- |
| Core bundle (gzip)             | **≤ 30 kB**                      | ~60 kB               | ~300 kB                         |
| Typed column presets           | 6 in core                        | 3 (limited)          | Requires value formatters       |
| Undo/Redo                      | **Built in**                     | None                 | Enterprise only                 |
| Controlled selection           | Yes (hybrid)                     | Partial              | Via API                         |
| Headless hook API              | **`useSpreadsheet()`**           | No                   | No                              |
| Custom editor DX               | `renderEditor` + `EditorContext` | Manual portals       | Cell editor interface           |
| Row virtualization             | Built in (hook)                  | Built in             | Built in                        |
| Formula engine                 | Opt-in subpackage (coming)       | No                   | Enterprise only                 |
| License                        | MIT                              | MIT                  | MIT (Community) / commercial    |
| TypeScript inference from rows | **Yes**                          | Partial              | Generic `ColDef<TData, TValue>` |

## What this library is **not**

- It is not an Excel clone. We pick a small formula subset and document it.
- It is not a tree/group grid. Pivot, grouping, and aggregation are out of scope.
- It is not a server-side data layer. Fetching and pagination stay in your app.

If you need those, AG Grid Enterprise or Handsontable Pro are the right choice. If you want a fast, typed, controlled spreadsheet you can bend to your design system, read [Quick Start](/guide/quick-start) next.
