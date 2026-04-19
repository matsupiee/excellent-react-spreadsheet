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

  const startEdit = useCallback((addr: CellAddress): void => {
    const col = columnsRef.current[addr.col];
    const row = rowsRef.current[addr.row];
    if (col === undefined || row === undefined) return;
    if (col.renderEditor === undefined) return;
    setEditing({ address: addr, draft: col.getValue(row) });
  }, []);

  const commitEdit = useCallback((): void => {
    const current = editingRef.current;
    if (current === null) return;
    const col = columnsRef.current[current.address.col];
    const row = rowsRef.current[current.address.row];
    setEditing(null);
    if (col === undefined || row === undefined) return;
    const prev = col.getValue(row);
    if (Object.is(prev, current.draft)) return;
    applyPatches([{ op: 'set', address: current.address, prev, next: current.draft }], {
      reason: 'edit',
      label: 'edit cell',
      coalesceKey: `edit:${String(current.address.row)}:${String(current.address.col)}`,
    });
  }, [applyPatches]);

  const cancelEdit = useCallback((): void => {
    setEditing(null);
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

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (editingRef.current !== null) return;
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

      const active = activeCell;
      if (active === null) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveActive(-1, 0, e.shiftKey);
          return;
        case 'ArrowDown':
          e.preventDefault();
          moveActive(1, 0, e.shiftKey);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          moveActive(0, -1, e.shiftKey);
          return;
        case 'ArrowRight':
          e.preventDefault();
          moveActive(0, 1, e.shiftKey);
          return;
        case 'Tab':
          e.preventDefault();
          moveActive(0, e.shiftKey ? -1 : 1, false);
          return;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          startEdit(active);
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          clearSelection();
          return;
        default:
          if (!mod && e.key.length === 1) {
            startEdit(active);
          }
      }
    },
    [activeCell, redo, undo, moveActive, startEdit, clearSelection],
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

  useEffect(() => {
    const up = (): void => {
      draggingRef.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const rowH = rowHeight ?? 28;
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
          {columns.map((col, i) => (
            <col key={col.key} style={{ width: `${String(colWidths[i] ?? 120)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={headerStyle}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virt.paddingTop > 0 ? (
            <tr aria-hidden="true" style={spacerStyle(virt.paddingTop)} data-spacer="top">
              <td colSpan={columns.length} style={spacerStyle(virt.paddingTop)} />
            </tr>
          ) : null}
          {visibleMeta.map((meta) => {
            const r = meta.index;
            const row = rows[r];
            if (row === undefined) return null;
            return (
              <tr key={meta.key} style={{ height: rowH }} data-row-index={r}>
                {columns.map((col, c) => {
                  const addr: CellAddress = { row: r, col: c };
                  const isActive = activeCell !== null && addrEqual(activeCell, addr);
                  const isInSel = inRange(addr, selection);
                  const isEditingHere = editing !== null && addrEqual(editing.address, addr);
                  const cellStyle: CSSProperties = {
                    border: isActive ? '2px solid #2563eb' : '1px solid #e4e4e7',
                    padding: isEditingHere ? 0 : '4px 8px',
                    background: isActive ? '#dbeafe' : isInSel ? '#eff6ff' : '#fff',
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
                        setEditing({ address: addr, draft: next });
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
              <td colSpan={columns.length} style={spacerStyle(virt.paddingBottom)} />
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
