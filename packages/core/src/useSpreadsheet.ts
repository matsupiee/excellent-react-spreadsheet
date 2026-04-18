import { useCallback, useMemo, useState } from 'react';

import type {
  CellAddress,
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

export const useSpreadsheet = <Row>(props: UseSpreadsheetProps<Row>): UseSpreadsheetReturn<Row> => {
  const {
    value,
    columns,
    getRowKey,
    selection: selectionProp,
    onSelectionChange,
    activeCell: activeCellProp,
    onActiveCellChange,
  } = props;

  const [internalSelection, setInternalSelection] = useState<Selection | null>(null);
  const [internalActiveCell, setInternalActiveCell] = useState<CellAddress | null>(null);

  const selection = selectionProp !== undefined ? selectionProp : internalSelection;

  const derivedActive = activeCellProp !== undefined ? activeCellProp : internalActiveCell;
  const activeCell = derivedActive ?? selectionStart(selection);

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
  };
};
