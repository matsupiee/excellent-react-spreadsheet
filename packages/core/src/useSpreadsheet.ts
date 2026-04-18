import { useCallback, useMemo, useRef, useState } from 'react';

import { createHistory, type History } from './history.js';
import type {
  ApplyPatchesOptions,
  CellAddress,
  CellPatch,
  ChangeReason,
  ColumnDef,
  ColumnMeta,
  RowMeta,
  Selection,
  UseSpreadsheetProps,
  UseSpreadsheetReturn,
} from './types.js';

const cellEquals = (a: CellAddress | null, b: CellAddress | null): boolean => {
  if (a === null || b === null) return a === b;
  return a.row === b.row && a.col === b.col;
};

const selectionStart = (selection: Selection | null): CellAddress | null =>
  selection === null ? null : selection.start;

const isRow = <Row>(value: unknown): value is Row => value !== null && typeof value === 'object';

/**
 * Apply a single forward patch to the rows array using the provided column
 * definitions for `set` operations. Returns a new array reference when the
 * patch causes a change, otherwise the original.
 */
const applyPatch = <Row>(rows: Row[], patch: CellPatch, columns: ColumnDef<Row>[]): Row[] => {
  switch (patch.op) {
    case 'set': {
      const { row: rowIndex, col } = patch.address;
      const row = rows[rowIndex];
      const column = columns[col];
      if (row === undefined || column === undefined) return rows;
      const next = [...rows];
      next[rowIndex] = column.setValue(row, patch.next);
      return next;
    }
    case 'insertRow': {
      if (!isRow<Row>(patch.row)) return rows;
      const next = [...rows];
      const at = Math.min(Math.max(patch.at, 0), next.length);
      next.splice(at, 0, patch.row);
      return next;
    }
    case 'removeRow': {
      if (patch.at < 0 || patch.at >= rows.length) return rows;
      const next = [...rows];
      next.splice(patch.at, 1);
      return next;
    }
    case 'moveRow': {
      const { from, to } = patch;
      if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) {
        return rows;
      }
      const next = [...rows];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return rows;
      next.splice(to, 0, moved);
      return next;
    }
  }
};

const applyPatchList = <Row>(
  rows: Row[],
  patches: CellPatch[],
  columns: ColumnDef<Row>[],
): Row[] => {
  let current = rows;
  for (const patch of patches) {
    current = applyPatch(current, patch, columns);
  }
  return current;
};

export const useSpreadsheet = <Row>(props: UseSpreadsheetProps<Row>): UseSpreadsheetReturn<Row> => {
  const {
    value,
    onChange,
    columns,
    getRowKey,
    selection: selectionProp,
    onSelectionChange,
    activeCell: activeCellProp,
    onActiveCellChange,
    maxHistory,
  } = props;

  const [internalSelection, setInternalSelection] = useState<Selection | null>(null);
  const [internalActiveCell, setInternalActiveCell] = useState<CellAddress | null>(null);

  const selection = selectionProp !== undefined ? selectionProp : internalSelection;

  const derivedActive = activeCellProp !== undefined ? activeCellProp : internalActiveCell;
  const activeCell = derivedActive ?? selectionStart(selection);

  // Keep latest value/columns/onChange in refs so undo/redo/applyPatches are
  // stable identities that still observe the freshest props.
  const valueRef = useRef(value);
  valueRef.current = value;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const historyRef = useRef<History | null>(null);
  if (historyRef.current === null) {
    const options = maxHistory !== undefined ? { maxHistory } : {};
    historyRef.current = createHistory(options);
  }
  const history = historyRef.current;

  const setSelection = useCallback(
    (next: Selection | null) => {
      if (selectionProp === undefined) {
        setInternalSelection(next);
      }
      onSelectionChange?.(next);

      const nextActive = selectionStart(next);
      if (activeCellProp === undefined) {
        setInternalActiveCell(nextActive);
      }
      if (!cellEquals(nextActive, activeCell)) {
        onActiveCellChange?.(nextActive);
      }
    },
    [selectionProp, onSelectionChange, activeCellProp, onActiveCellChange, activeCell],
  );

  const setActiveCell = useCallback(
    (next: CellAddress | null) => {
      if (activeCellProp === undefined) {
        setInternalActiveCell(next);
      }
      if (!cellEquals(next, activeCell)) {
        onActiveCellChange?.(next);
      }
    },
    [activeCellProp, onActiveCellChange, activeCell],
  );

  const rowMeta = useMemo<RowMeta[]>(
    () => value.map((row, index) => ({ index, key: getRowKey(row, index) })),
    [value, getRowKey],
  );

  const columnMeta = useMemo<ColumnMeta[]>(
    () => columns.map((column, index) => ({ index, key: column.key })),
    [columns],
  );

  const dispatchPatches = useCallback((patches: CellPatch[], reason: ChangeReason): void => {
    if (patches.length === 0) return;
    const prevRows = valueRef.current;
    const nextRows = applyPatchList(prevRows, patches, columnsRef.current);
    if (nextRows === prevRows) return;
    onChangeRef.current(nextRows, { reason, patches, prevRows, nextRows });
  }, []);

  const applyPatches = useCallback(
    (patches: CellPatch[], opts?: ApplyPatchesOptions): void => {
      if (patches.length === 0) return;
      const reason: ChangeReason = opts?.reason ?? 'edit';
      dispatchPatches(patches, reason);
      if (opts?.skipHistory === true) return;
      const pushOpts: { label?: string; coalesceKey?: string } = {};
      if (opts?.label !== undefined) pushOpts.label = opts.label;
      if (opts?.coalesceKey !== undefined) pushOpts.coalesceKey = opts.coalesceKey;
      history.push(patches, pushOpts);
    },
    [dispatchPatches, history],
  );

  const undo = useCallback((): boolean => {
    const inverse = history.undo();
    if (inverse === null) return false;
    dispatchPatches(inverse, 'undo');
    return true;
  }, [dispatchPatches, history]);

  const redo = useCallback((): boolean => {
    const forward = history.redo();
    if (forward === null) return false;
    dispatchPatches(forward, 'redo');
    return true;
  }, [dispatchPatches, history]);

  const canUndo = useCallback((): boolean => history.canUndo(), [history]);
  const canRedo = useCallback((): boolean => history.canRedo(), [history]);
  const clearHistory = useCallback((): void => {
    history.clear();
  }, [history]);

  const startEdit = useCallback((_address?: CellAddress): void => {}, []);
  const commitEdit = useCallback((): void => {}, []);
  const cancelEdit = useCallback((): void => {}, []);

  return {
    rows: value,
    columns,
    rowMeta,
    columnMeta,
    selection,
    setSelection,
    activeCell,
    setActiveCell,
    startEdit,
    commitEdit,
    cancelEdit,
    applyPatches,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
};
