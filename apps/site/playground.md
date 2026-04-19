---
title: Playground
outline: deep
---

# Playground

Switch column sets on the fly and watch the grid react. Every change goes through the same `applyPatches` / `undo` / `redo` surface you use in your app — no demo-only hacks.

<ClientOnly>
  <ReactIsland :component="() => import('./demos/PlaygroundDemo')" />
</ClientOnly>

## What to try

- Press **Enter** or start typing to edit a cell.
- **⌘Z** undoes the last edit. Continuous typing into the same cell collapses into one history entry.
- Copy a range, click another cell, paste — values round-trip through the column serializers, so pasting `"2030-01-15"` into a `dateColumn` produces a `Date` object, not a string.
- Switch the column set in the toolbar. The underlying data stays the same; only the columns view changes.
