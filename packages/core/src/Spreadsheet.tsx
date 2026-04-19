import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from 'react';

import type {
  CellAddress,
  CellPatch,
  ColumnDef,
  ColumnWidth,
  CommitMove,
  Selection,
  SpreadsheetRef,
  UseSpreadsheetProps,
} from './types.js';
import { useSpreadsheet } from './useSpreadsheet.js';
import { useRowVirtualizer } from './virtual.js';

/**
 * Minimal DOM layer on top of {@link useSpreadsheet}. Supports click/drag
 * selection, keyboard navigation, inline editing via column `renderEditor`,
 * copy/cut/paste through native clipboard events, and undo/redo shortcuts.
 *
 * Rows are virtualized via {@link useRowVirtualizer} so that large datasets
 * (≥10,000 rows) scroll smoothly. The root `<div>` is the scroll container;
 * out-of-window rows are replaced with two spacer `<tr>` elements so that the
 * `<table>` preserves its intrinsic height without per-row absolute positioning
 * (which would break the sticky `<thead>` and default table layout).
 */
export type SpreadsheetProps<Row> = UseSpreadsheetProps<Row> & {
  rowHeight?: number;
  maxHeight?: number | string;
  className?: string;
  /** Extra rows rendered above/below the visible band. Defaults to `4`. */
  overscan?: number;
};

type EditingState = {
  address: CellAddress;
  draft: unknown;
};

const resolveWidthPx = (w: ColumnWidth | undefined): number => {
  if (w === undefined) return 120;
  if (typeof w === 'number') return w;
  const n = Number.parseFloat(w);
  if (Number.isNaN(n)) return 120;
  return Math.max(60, Math.round(n * 80));
};

const inRange = (addr: CellAddress, range: Selection | null): boolean => {
  if (range === null) return false;
  const r0 = Math.min(range.start.row, range.end.row);
  const r1 = Math.max(range.start.row, range.end.row);
  const c0 = Math.min(range.start.col, range.end.col);
  const c1 = Math.max(range.start.col, range.end.col);
  return addr.row >= r0 && addr.row <= r1 && addr.col >= c0 && addr.col <= c1;
};

const addrEqual = (a: CellAddress, b: CellAddress): boolean => a.row === b.row && a.col === b.col;

const ROW_GUTTER_WIDTH = 48;

const headerStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  padding: '6px 10px',
  background: '#f4f4f5',
  textAlign: 'left',
  fontWeight: 600,
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const headerActiveStyle: CSSProperties = {
  ...headerStyle,
  background: '#e8eaed',
  color: '#1a73e8',
};

const cornerHeaderStyle: CSSProperties = {
  ...headerStyle,
  left: 0,
  zIndex: 3,
  width: ROW_GUTTER_WIDTH,
  minWidth: ROW_GUTTER_WIDTH,
  padding: 0,
};

const baseGutterStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  padding: '4px 6px',
  textAlign: 'center',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: '#52525b',
  background: '#f4f4f5',
  position: 'sticky',
  left: 0,
  zIndex: 1,
  width: ROW_GUTTER_WIDTH,
  minWidth: ROW_GUTTER_WIDTH,
  cursor: 'default',
  userSelect: 'none',
};

const gutterActiveStyle: CSSProperties = {
  ...baseGutterStyle,
  background: '#e8eaed',
  color: '#1a73e8',
  fontWeight: 700,
};

const colInRange = (col: number, range: Selection | null): boolean => {
  if (range === null) return false;
  const c0 = Math.min(range.start.col, range.end.col);
  const c1 = Math.max(range.start.col, range.end.col);
  return col >= c0 && col <= c1;
};

const rowInRange = (row: number, range: Selection | null): boolean => {
  if (range === null) return false;
  const r0 = Math.min(range.start.row, range.end.row);
  const r1 = Math.max(range.start.row, range.end.row);
  return row >= r0 && row <= r1;
};

const baseRootStyle: CSSProperties = {
  outline: 'none',
  userSelect: 'none',
  overflow: 'auto',
  border: '1px solid #d4d4d8',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  background: '#fff',
  width: 'fit-content',
  maxWidth: '100%',
};

function SpreadsheetImpl<Row>(
  props: SpreadsheetProps<Row>,
  forwardedRef: ForwardedRef<SpreadsheetRef>,
): ReactElement {
  const { rowHeight, maxHeight, className, overscan, ...hookProps } = props;
  const api = useSpreadsheet<Row>(hookProps);
  const {
    columns,
    rows,
    rowMeta,
    selection,
    setSelection,
    activeCell,
    setActiveCell,
    applyPatches,
    undo,
    redo,
    copy,
    paste,
    cut,
  } = api;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const selectionRef = useRef<Selection | null>(selection);
  selectionRef.current = selection;
  const columnsRef = useRef<ColumnDef<Row>[]>(columns);
  columnsRef.current = columns;
  const rowsRef = useRef<Row[]>(rows);
  rowsRef.current = rows;
  const editingRef = useRef<EditingState | null>(editing);
  editingRef.current = editing;

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => rootRef.current?.focus(),
      undo: () => {
        undo();
      },
      redo: () => {
        redo();
      },
      setSelection,
      getSelection: () => selectionRef.current,
    }),
    [undo, redo, setSelection],
  );

  /**
   * Enter edit mode at `addr`. By default the editor opens with the cell's
   * current value (Enter / F2 behaviour). Pass `initialDraft` to override —
   * used for Google-Sheets-style type-to-overwrite, where the first printable
   * keypress replaces the cell value rather than appending to it.
   */
  const startEdit = useCallback((addr: CellAddress, initialDraft?: unknown): void => {
    const col = columnsRef.current[addr.col];
    const row = rowsRef.current[addr.row];
    if (col === undefined || row === undefined) return;
    if (col.renderEditor === undefined) return;
    const draft = initialDraft === undefined ? col.getValue(row) : initialDraft;
    setEditing({ address: addr, draft });
  }, []);

  const commitEdit = useCallback(
    (move: CommitMove = 'none'): void => {
      const current = editingRef.current;
      if (current === null) return;
      const col = columnsRef.current[current.address.col];
      const row = rowsRef.current[current.address.row];
      // Clear the ref synchronously so the editor's unmount-driven blur
      // (which fires *after* setEditing(null) but *before* the next render
      // refreshes the ref) can't re-enter and double-commit the same draft.
      editingRef.current = null;
      setEditing(null);
      if (col !== undefined && row !== undefined) {
        const prev = col.getValue(row);
        if (!Object.is(prev, current.draft)) {
          applyPatches([{ op: 'set', address: current.address, prev, next: current.draft }], {
            reason: 'edit',
            label: 'edit cell',
            coalesceKey: `edit:${String(current.address.row)}:${String(current.address.col)}`,
          });
        }
      }
      if (move === 'none') {
        rootRef.current?.focus();
        return;
      }
      const rowCount = rowsRef.current.length;
      const colCount = columnsRef.current.length;
      const dr = move === 'down' ? 1 : move === 'up' ? -1 : 0;
      const dc = move === 'right' ? 1 : move === 'left' ? -1 : 0;
      const nextRow = Math.min(Math.max(current.address.row + dr, 0), rowCount - 1);
      const nextCol = Math.min(Math.max(current.address.col + dc, 0), colCount - 1);
      const target: CellAddress = { row: nextRow, col: nextCol };
      setSelection({ start: target, end: target });
      setActiveCell(target);
      rootRef.current?.focus();
    },
    [applyPatches, setSelection, setActiveCell],
  );

  const cancelEdit = useCallback((): void => {
    // See commitEdit: clear the ref synchronously so the unmount-driven blur
    // can't fall through to onCommit and accidentally save the discarded draft.
    editingRef.current = null;
    setEditing(null);
    rootRef.current?.focus();
  }, []);

  const moveActive = useCallback(
    (dr: number, dc: number, extend: boolean): void => {
      const active = activeCell;
      if (active === null) return;
      const rowCount = rowsRef.current.length;
      const colCount = columnsRef.current.length;
      if (rowCount === 0 || colCount === 0) return;
      const nextRow = Math.min(Math.max(active.row + dr, 0), rowCount - 1);
      const nextCol = Math.min(Math.max(active.col + dc, 0), colCount - 1);
      const target: CellAddress = { row: nextRow, col: nextCol };
      if (extend && selectionRef.current !== null) {
        setSelection({ start: selectionRef.current.start, end: target });
      } else {
        setSelection({ start: target, end: target });
      }
      setActiveCell(target);
    },
    [activeCell, setSelection, setActiveCell],
  );

  const clearSelection = useCallback((): void => {
    const active = activeCell;
    const sel = selectionRef.current ?? (active === null ? null : { start: active, end: active });
    if (sel === null) return;
    const r0 = Math.min(sel.start.row, sel.end.row);
    const r1 = Math.max(sel.start.row, sel.end.row);
    const c0 = Math.min(sel.start.col, sel.end.col);
    const c1 = Math.max(sel.start.col, sel.end.col);
    const patches: CellPatch[] = [];
    for (let r = r0; r <= r1; r += 1) {
      const row = rowsRef.current[r];
      if (row === undefined) continue;
      for (let c = c0; c <= c1; c += 1) {
        const col = columnsRef.current[c];
        if (col === undefined) continue;
        if (col.deserialize === undefined) continue;
        const prev = col.getValue(row);
        const next = col.deserialize('');
        if (!Object.is(prev, next)) {
          patches.push({ op: 'set', address: { row: r, col: c }, prev, next });
        }
      }
    }
    if (patches.length > 0) {
      applyPatches(patches, { reason: 'delete', label: `clear ${String(patches.length)} cells` });
    }
  }, [activeCell, applyPatches]);

  const rowH = rowHeight ?? 28;

  /**
   * Move active cell to an absolute address. Used by Home/End/PageUp/PageDown
   * and Ctrl+Home/Ctrl+End — anything where the destination isn't a simple
   * delta from the current position.
   */
  const moveActiveTo = useCallback(
    (target: CellAddress, extend: boolean): void => {
      const rowCount = rowsRef.current.length;
      const colCount = columnsRef.current.length;
      if (rowCount === 0 || colCount === 0) return;
      const clamped: CellAddress = {
        row: Math.min(Math.max(target.row, 0), rowCount - 1),
        col: Math.min(Math.max(target.col, 0), colCount - 1),
      };
      if (extend && selectionRef.current !== null) {
        setSelection({ start: selectionRef.current.start, end: clamped });
      } else {
        setSelection({ start: clamped, end: clamped });
      }
      setActiveCell(clamped);
    },
    [setSelection, setActiveCell],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (editingRef.current !== null) return;
      // Ignore keys that bubbled up from a descendant (e.g. an editor input
      // that already handled and committed Enter/Tab). Without this guard the
      // bubbled Enter would re-trigger startEdit at the freshly-moved active
      // cell, putting the spreadsheet right back into edit mode.
      if (e.target !== e.currentTarget) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const lastRow = rowsRef.current.length - 1;
        const lastCol = columnsRef.current.length - 1;
        if (lastRow >= 0 && lastCol >= 0) {
          setSelection({ start: { row: 0, col: 0 }, end: { row: lastRow, col: lastCol } });
          setActiveCell({ row: 0, col: 0 });
        }
        return;
      }

      const active = activeCell;
      if (active === null) return;

      const lastRow = rowsRef.current.length - 1;
      const lastCol = columnsRef.current.length - 1;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (mod) moveActiveTo({ row: 0, col: active.col }, e.shiftKey);
          else moveActive(-1, 0, e.shiftKey);
          return;
        case 'ArrowDown':
          e.preventDefault();
          if (mod) moveActiveTo({ row: lastRow, col: active.col }, e.shiftKey);
          else moveActive(1, 0, e.shiftKey);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          if (mod) moveActiveTo({ row: active.row, col: 0 }, e.shiftKey);
          else moveActive(0, -1, e.shiftKey);
          return;
        case 'ArrowRight':
          e.preventDefault();
          if (mod) moveActiveTo({ row: active.row, col: lastCol }, e.shiftKey);
          else moveActive(0, 1, e.shiftKey);
          return;
        case 'Tab':
          e.preventDefault();
          moveActive(0, e.shiftKey ? -1 : 1, false);
          return;
        case 'Enter':
          e.preventDefault();
          startEdit(active);
          return;
        case 'F2':
          e.preventDefault();
          startEdit(active);
          return;
        case 'Home':
          e.preventDefault();
          if (mod) moveActiveTo({ row: 0, col: 0 }, e.shiftKey);
          else moveActiveTo({ row: active.row, col: 0 }, e.shiftKey);
          return;
        case 'End':
          e.preventDefault();
          if (mod) moveActiveTo({ row: lastRow, col: lastCol }, e.shiftKey);
          else moveActiveTo({ row: active.row, col: lastCol }, e.shiftKey);
          return;
        case 'PageUp': {
          e.preventDefault();
          const pageRows = Math.max(
            1,
            Math.floor((rootRef.current?.clientHeight ?? rowH * 10) / rowH) - 1,
          );
          moveActive(-pageRows, 0, e.shiftKey);
          return;
        }
        case 'PageDown': {
          e.preventDefault();
          const pageRows = Math.max(
            1,
            Math.floor((rootRef.current?.clientHeight ?? rowH * 10) / rowH) - 1,
          );
          moveActive(pageRows, 0, e.shiftKey);
          return;
        }
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          clearSelection();
          return;
        default:
          // Type-to-overwrite: a printable character (no modifier) replaces
          // the cell value rather than appending to it. We seed the editor's
          // draft with `deserialize(char)` when the column supports it; if
          // deserialize is missing, fall back to the existing value (Enter/F2
          // semantics) so we don't silently drop the keypress.
          if (!mod && e.key.length === 1) {
            const col = columnsRef.current[active.col];
            if (col?.deserialize !== undefined) {
              startEdit(active, col.deserialize(e.key));
            } else {
              startEdit(active);
            }
          }
      }
    },
    [
      activeCell,
      redo,
      undo,
      moveActive,
      moveActiveTo,
      startEdit,
      clearSelection,
      setSelection,
      setActiveCell,
      rowH,
    ],
  );

  const handleCopy = useCallback(
    (e: ReactClipboardEvent<HTMLDivElement>): void => {
      if (editingRef.current !== null) return;
      const payload = copy();
      if (payload === null) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', payload.text);
      e.clipboardData.setData('text/html', payload.html);
    },
    [copy],
  );

  const handleCut = useCallback(
    (e: ReactClipboardEvent<HTMLDivElement>): void => {
      if (editingRef.current !== null) return;
      const payload = cut();
      if (payload === null) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', payload.text);
      e.clipboardData.setData('text/html', payload.html);
    },
    [cut],
  );

  const handlePaste = useCallback(
    (e: ReactClipboardEvent<HTMLDivElement>): void => {
      if (editingRef.current !== null) return;
      const text = e.clipboardData.getData('text/plain');
      if (text === '') return;
      e.preventDefault();
      paste(text);
    },
    [paste],
  );

  const handleCellMouseDown = useCallback(
    (addr: CellAddress, e: ReactMouseEvent<HTMLTableCellElement>): void => {
      const current = editingRef.current;
      if (current !== null) {
        if (addrEqual(current.address, addr)) return;
        commitEdit();
      }
      draggingRef.current = true;
      rootRef.current?.focus();
      if (e.shiftKey && selectionRef.current !== null) {
        setSelection({ start: selectionRef.current.start, end: addr });
      } else {
        setSelection({ start: addr, end: addr });
      }
      setActiveCell(addr);
    },
    [commitEdit, setSelection, setActiveCell],
  );

  const handleCellMouseEnter = useCallback(
    (addr: CellAddress): void => {
      if (!draggingRef.current) return;
      const cur = selectionRef.current;
      if (cur === null) return;
      setSelection({ start: cur.start, end: addr });
    },
    [setSelection],
  );

  /** Row-gutter click → select the entire row (Sheets behaviour). */
  const handleRowHeaderMouseDown = useCallback(
    (rowIndex: number, e: ReactMouseEvent<HTMLTableCellElement>): void => {
      if (editingRef.current !== null) commitEdit();
      rootRef.current?.focus();
      const lastCol = columnsRef.current.length - 1;
      if (lastCol < 0) return;
      const start: CellAddress = { row: rowIndex, col: 0 };
      const end: CellAddress = { row: rowIndex, col: lastCol };
      if (e.shiftKey && selectionRef.current !== null) {
        setSelection({ start: selectionRef.current.start, end });
      } else {
        setSelection({ start, end });
      }
      setActiveCell(start);
    },
    [commitEdit, setSelection, setActiveCell],
  );

  /** Column-header click → select the entire column (Sheets behaviour). */
  const handleColHeaderMouseDown = useCallback(
    (colIndex: number, e: ReactMouseEvent<HTMLTableCellElement>): void => {
      if (editingRef.current !== null) commitEdit();
      rootRef.current?.focus();
      const lastRow = rowsRef.current.length - 1;
      if (lastRow < 0) return;
      const start: CellAddress = { row: 0, col: colIndex };
      const end: CellAddress = { row: lastRow, col: colIndex };
      if (e.shiftKey && selectionRef.current !== null) {
        setSelection({ start: selectionRef.current.start, end });
      } else {
        setSelection({ start, end });
      }
      setActiveCell(start);
    },
    [commitEdit, setSelection, setActiveCell],
  );

  /** Corner click → select the entire sheet. */
  const handleCornerMouseDown = useCallback((): void => {
    if (editingRef.current !== null) commitEdit();
    rootRef.current?.focus();
    const lastRow = rowsRef.current.length - 1;
    const lastCol = columnsRef.current.length - 1;
    if (lastRow < 0 || lastCol < 0) return;
    setSelection({ start: { row: 0, col: 0 }, end: { row: lastRow, col: lastCol } });
    setActiveCell({ row: 0, col: 0 });
  }, [commitEdit, setSelection, setActiveCell]);

  useEffect(() => {
    const up = (): void => {
      draggingRef.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const colWidths = useMemo(() => columns.map((c) => resolveWidthPx(c.width)), [columns]);

  const rootStyle: CSSProperties = {
    ...baseRootStyle,
    ...(maxHeight !== undefined ? { maxHeight } : {}),
  };

  // --- Virtualization -----------------------------------------------------
  //
  // The root div is the scroll container (overflow: auto). We track its
  // scrollTop via onScroll and its clientHeight via ResizeObserver (with a
  // window-resize fallback for environments that don't implement RO — some
  // older test runners included). The pure `useRowVirtualizer` hook turns
  // those numbers into a [startIndex, endIndex] slice plus pre/post padding.
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const measureViewport = useCallback((): void => {
    const el = rootRef.current;
    if (el === null) return;
    setViewportHeight(el.clientHeight);
  }, []);

  useLayoutEffect(() => {
    measureViewport();
  }, [measureViewport]);

  useEffect(() => {
    const el = rootRef.current;
    if (el === null) return;
    if (typeof ResizeObserver === 'undefined') {
      const onResize = (): void => {
        measureViewport();
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }
    const ro = new ResizeObserver(() => {
      measureViewport();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [measureViewport]);

  const handleScroll = useCallback((e: ReactUIEvent<HTMLDivElement>): void => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const virt = useRowVirtualizer({
    rowCount: rowMeta.length,
    rowHeight: rowH,
    viewportHeight,
    scrollTop,
    overscan: overscan ?? 4,
  });

  // Scroll the active cell into view when it leaves the rendered window
  // (e.g. arrow-key navigation past the visible band). Uniform heights only —
  // the minimal impl doesn't support variable row heights yet.
  useLayoutEffect(() => {
    if (activeCell === null) return;
    const el = rootRef.current;
    if (el === null) return;
    const rowIndex = activeCell.row;
    const top = rowIndex * rowH;
    const bottom = top + rowH;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (top < viewTop) {
      el.scrollTop = top;
    } else if (bottom > viewBottom) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }, [activeCell, rowH]);

  const visibleMeta = useMemo(
    () => rowMeta.slice(virt.startIndex, virt.endIndex + 1),
    [rowMeta, virt.startIndex, virt.endIndex],
  );

  const spacerStyle = (height: number): CSSProperties => ({
    height,
    padding: 0,
    border: 0,
    pointerEvents: 'none',
  });

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={className}
      style={rootStyle}
      role="grid"
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
      onScroll={handleScroll}
    >
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col data-gutter="row-number" style={{ width: `${String(ROW_GUTTER_WIDTH)}px` }} />
          {columns.map((col, i) => (
            <col key={col.key} style={{ width: `${String(colWidths[i] ?? 120)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              style={{ ...cornerHeaderStyle, cursor: 'cell' }}
              aria-label="Select all"
              onMouseDown={handleCornerMouseDown}
            />
            {columns.map((col, i) => {
              const isColActive = activeCell !== null && activeCell.col === i;
              const isColInSel = colInRange(i, selection);
              const baseStyle = isColActive || isColInSel ? headerActiveStyle : headerStyle;
              return (
                <th
                  key={col.key}
                  style={{ ...baseStyle, cursor: 'cell' }}
                  onMouseDown={(ev) => {
                    handleColHeaderMouseDown(i, ev);
                  }}
                >
                  {col.title}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {virt.paddingTop > 0 ? (
            <tr aria-hidden="true" style={spacerStyle(virt.paddingTop)} data-spacer="top">
              <td colSpan={columns.length + 1} style={spacerStyle(virt.paddingTop)} />
            </tr>
          ) : null}
          {visibleMeta.map((meta) => {
            const r = meta.index;
            const row = rows[r];
            if (row === undefined) return null;
            const isRowActive = activeCell !== null && activeCell.row === r;
            const isRowInSel = rowInRange(r, selection);
            const rowGutterHighlight = isRowActive || isRowInSel;
            return (
              <tr key={meta.key} style={{ height: rowH }} data-row-index={r}>
                <th
                  scope="row"
                  data-gutter="row-number"
                  style={{
                    ...(rowGutterHighlight ? gutterActiveStyle : baseGutterStyle),
                    cursor: 'cell',
                  }}
                  onMouseDown={(ev) => {
                    handleRowHeaderMouseDown(r, ev);
                  }}
                >
                  {r + 1}
                </th>
                {columns.map((col, c) => {
                  const addr: CellAddress = { row: r, col: c };
                  const isActive = activeCell !== null && addrEqual(activeCell, addr);
                  const isInSel = inRange(addr, selection);
                  const isEditingHere = editing !== null && addrEqual(editing.address, addr);
                  // Use box-shadow inset for the active-cell ring so the cell's
                  // intrinsic border width never changes — that previously
                  // shifted column widths by 1px when active moved between
                  // cells. The anchor cell itself stays white (Sheets-style)
                  // so the user can read its value clearly within a range.
                  const cellStyle: CSSProperties = {
                    border: '1px solid #e4e4e7',
                    padding: isEditingHere ? 0 : '4px 8px',
                    background: isInSel && !isActive ? '#e8f0fe' : '#fff',
                    boxShadow: isActive ? 'inset 0 0 0 2px #1a73e8' : undefined,
                    position: 'relative',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    cursor: 'cell',
                  };
                  let content: ReactNode;
                  if (isEditingHere && col.renderEditor !== undefined) {
                    content = col.renderEditor({
                      value: editing.draft,
                      onChange: (next: unknown) => {
                        // Sync the ref before scheduling the state update so
                        // a commit fired in the same tick (e.g. selectColumn
                        // committing immediately after onChange) reads the
                        // fresh draft instead of the pre-change value.
                        const nextState: EditingState = { address: addr, draft: next };
                        editingRef.current = nextState;
                        setEditing(nextState);
                      },
                      onCommit: commitEdit,
                      onCancel: cancelEdit,
                      row,
                      rowIndex: r,
                      address: addr,
                    });
                  } else {
                    const value = col.getValue(row);
                    content =
                      col.renderCell !== undefined
                        ? col.renderCell({ value, row, rowIndex: r, address: addr })
                        : value === null || value === undefined
                          ? ''
                          : String(value);
                  }
                  return (
                    <td
                      key={col.key}
                      style={cellStyle}
                      role="gridcell"
                      aria-selected={isInSel || isActive}
                      onMouseDown={(ev) => {
                        handleCellMouseDown(addr, ev);
                      }}
                      onMouseEnter={() => {
                        handleCellMouseEnter(addr);
                      }}
                      onDoubleClick={() => {
                        startEdit(addr);
                      }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {virt.paddingBottom > 0 ? (
            <tr aria-hidden="true" style={spacerStyle(virt.paddingBottom)} data-spacer="bottom">
              <td colSpan={columns.length + 1} style={spacerStyle(virt.paddingBottom)} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `<Spreadsheet>` is a generic component, so we cast the forwardRef result to
 * preserve `Row` inference at the call site (the canonical generic-forwardRef
 * idiom). The implementation function is `SpreadsheetImpl`.
 */
export const Spreadsheet = forwardRef(SpreadsheetImpl) as <Row>(
  props: SpreadsheetProps<Row> & { ref?: ForwardedRef<SpreadsheetRef> },
) => ReactElement;
