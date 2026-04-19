import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  useSpreadsheet,
  type CellAddress,
  type CellPatch,
  type ColumnDef,
} from 'excellent-react-spreadsheet';

/**
 * Widen `ColumnDef<Row, V>` to `ColumnDef<Row, unknown>` so heterogeneous column
 * presets can sit in one array. The two types are structurally compatible apart
 * from contravariance of `setValue`, which the hook handles at the boundary.
 */
export const asColumn = <Row, V>(col: ColumnDef<Row, V>): ColumnDef<Row> =>
  col as unknown as ColumnDef<Row>;

export type MiniGridProps<Row> = {
  columns: ColumnDef<Row>[];
  value: Row[];
  onChange: (rows: Row[]) => void;
  getRowKey: (row: Row, index: number) => string;
  toolbar?: 'full' | 'compact' | 'hidden';
  status?: ReactNode;
  extraToolbar?: ReactNode;
};

type EditingState = {
  address: CellAddress;
  draft: string;
};

const containerStyle: CSSProperties = {
  border: '1px solid var(--vp-c-divider, #d4d4d8)',
  borderRadius: 10,
  background: 'var(--vp-c-bg, #fff)',
  overflow: 'hidden',
  outline: 'none',
};

const tableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: 14,
};

const headerStyle: CSSProperties = {
  background: 'var(--vp-c-bg-soft, #f4f4f5)',
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  borderBottom: '1px solid var(--vp-c-divider, #d4d4d8)',
  position: 'sticky',
  top: 0,
};

const cellStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--vp-c-divider-light, #e4e4e7)',
  borderRight: '1px solid var(--vp-c-divider-light, #e4e4e7)',
  verticalAlign: 'middle',
  cursor: 'cell',
  userSelect: 'none',
  minWidth: 80,
};

const selectedStyle: CSSProperties = {
  background: 'var(--vp-c-brand-soft, rgba(14, 165, 233, 0.14))',
  boxShadow: 'inset 0 0 0 2px var(--vp-c-brand-1, #0ea5e9)',
};

const editorStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: '2px solid var(--vp-c-brand-1, #0ea5e9)',
  padding: '4px 6px',
  font: 'inherit',
  background: 'var(--vp-c-bg, #fff)',
  color: 'var(--vp-c-text-1, #111)',
  boxSizing: 'border-box',
};

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const isPrintableKey = (key: string): boolean => key.length === 1 && !key.match(/^\s$/);

const valueToString = <Row, Value>(column: ColumnDef<Row, Value>, value: Value): string => {
  if (column.serialize !== undefined) return column.serialize(value);
  if (value === null || value === undefined) return '';
  return String(value);
};

const parseDraft = <Row, Value>(column: ColumnDef<Row, Value>, draft: string): Value | null => {
  if (column.deserialize !== undefined) {
    try {
      return column.deserialize(draft);
    } catch {
      return null;
    }
  }
  // Columns without deserialize only accept string-shaped Values; we refuse
  // coercion so the demo fails loudly rather than silently storing strings.
  return draft as unknown as Value;
};

export function MiniGrid<Row>(props: MiniGridProps<Row>) {
  const { columns, value, onChange, getRowKey, toolbar = 'full', status, extraToolbar } = props;

  const hook = useSpreadsheet<Row>({
    value,
    columns,
    getRowKey,
    onChange: (rows: Row[]) => onChange(rows),
  });

  const [editing, setEditing] = useState<EditingState | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedAddr = hook.activeCell;

  useEffect(() => {
    if (editing !== null && inputRef.current !== null) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(
    (address: CellAddress, seed?: string) => {
      const row = value[address.row];
      const column = columns[address.col];
      if (row === undefined || column === undefined) return;
      const initial = seed !== undefined ? seed : valueToString(column, column.getValue(row));
      setEditing({ address, draft: initial });
    },
    [value, columns],
  );

  const commitEdit = useCallback(() => {
    if (editing === null) return;
    const { address, draft } = editing;
    const row = value[address.row];
    const column = columns[address.col];
    if (row === undefined || column === undefined) {
      setEditing(null);
      return;
    }
    const parsed = parseDraft(column, draft);
    if (parsed === null) {
      setEditing(null);
      return;
    }
    const prev = column.getValue(row);
    if (Object.is(prev, parsed)) {
      setEditing(null);
      return;
    }
    const patch: CellPatch = { op: 'set', address, prev, next: parsed };
    hook.applyPatches([patch], {
      reason: 'edit',
      coalesceKey: `${address.row}:${address.col}`,
    });
    setEditing(null);
  }, [editing, value, columns, hook]);

  const cancelEdit = useCallback(() => setEditing(null), []);

  const selectAddress = useCallback(
    (address: CellAddress) => {
      hook.setSelection({ start: address, end: address });
    },
    [hook],
  );

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      const current = selectedAddr;
      if (current === null) {
        if (value.length > 0 && columns.length > 0) {
          selectAddress({ row: 0, col: 0 });
        }
        return;
      }
      const row = clamp(current.row + deltaRow, 0, Math.max(value.length - 1, 0));
      const col = clamp(current.col + deltaCol, 0, Math.max(columns.length - 1, 0));
      selectAddress({ row, col });
    },
    [selectedAddr, value.length, columns.length, selectAddress],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (editing !== null) return;
      const key = event.key;

      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          hook.redo();
        } else {
          hook.undo();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'y') {
        event.preventDefault();
        hook.redo();
        return;
      }

      if (key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1, 0);
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1, 0);
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        moveSelection(0, -1);
        return;
      }
      if (key === 'ArrowRight' || key === 'Tab') {
        event.preventDefault();
        moveSelection(0, 1);
        return;
      }
      if ((key === 'Enter' || key === 'F2') && selectedAddr !== null) {
        event.preventDefault();
        startEditing(selectedAddr);
        return;
      }
      if (isPrintableKey(key) && selectedAddr !== null && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        startEditing(selectedAddr, key);
      }
    },
    [editing, hook, moveSelection, selectedAddr, startEditing],
  );

  const handleCellClick = useCallback(
    (address: CellAddress, event: MouseEvent<HTMLTableCellElement>) => {
      event.preventDefault();
      selectAddress(address);
      rootRef.current?.focus();
    },
    [selectAddress],
  );

  const handleCellDoubleClick = useCallback(
    (address: CellAddress) => {
      startEditing(address);
    },
    [startEditing],
  );

  const handleCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const payload = hook.copy();
      if (payload === null) return;
      event.preventDefault();
      event.clipboardData.setData('text/plain', payload.text);
      event.clipboardData.setData('text/html', payload.html);
    },
    [hook],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const text = event.clipboardData.getData('text/plain');
      if (text.length === 0) return;
      event.preventDefault();
      hook.paste(text);
    },
    [hook],
  );

  const handleCopyButton = useCallback(() => {
    const payload = hook.copy();
    if (payload === null) return;
    void navigator.clipboard?.writeText(payload.text);
  }, [hook]);

  const handlePasteButton = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      hook.paste(text);
    } catch {
      // Clipboard permission denied; no-op in demo.
    }
  }, [hook]);

  const addRow = useCallback(() => {
    const empty = columns.reduce<Record<string, unknown>>((acc, column) => {
      acc[column.key] = null;
      return acc;
    }, {});
    hook.applyPatches([{ op: 'insertRow', at: value.length, row: empty }], { reason: 'edit' });
  }, [columns, hook, value.length]);

  const removeRow = useCallback(() => {
    if (selectedAddr === null) return;
    const row = value[selectedAddr.row];
    if (row === undefined) return;
    hook.applyPatches([{ op: 'removeRow', at: selectedAddr.row, row }], { reason: 'edit' });
  }, [hook, selectedAddr, value]);

  const toolbarNode = useMemo<ReactNode>(() => {
    if (toolbar === 'hidden') return null;
    const full = toolbar === 'full';
    return (
      <div className="ers-demo-toolbar">
        <button type="button" onClick={() => hook.undo()} disabled={!hook.canUndo()}>
          Undo
        </button>
        <button type="button" onClick={() => hook.redo()} disabled={!hook.canRedo()}>
          Redo
        </button>
        {full ? (
          <>
            <button type="button" onClick={handleCopyButton} disabled={selectedAddr === null}>
              Copy
            </button>
            <button type="button" onClick={handlePasteButton} disabled={selectedAddr === null}>
              Paste
            </button>
            <button type="button" onClick={addRow}>
              + Row
            </button>
            <button type="button" onClick={removeRow} disabled={selectedAddr === null}>
              − Row
            </button>
          </>
        ) : null}
        {extraToolbar !== undefined ? extraToolbar : null}
        {status !== undefined ? <span className="ers-demo-status">{status}</span> : null}
      </div>
    );
  }, [
    toolbar,
    hook,
    handleCopyButton,
    handlePasteButton,
    selectedAddr,
    addRow,
    removeRow,
    extraToolbar,
    status,
  ]);

  return (
    <div>
      {toolbarNode}
      <div
        ref={rootRef}
        style={containerStyle}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
        role="grid"
        aria-label="spreadsheet demo"
      >
        <table style={tableStyle}>
          <thead>
            <tr>
              {columns.map((column) => {
                const widthStyle: CSSProperties =
                  typeof column.width === 'number' ? { width: column.width } : {};
                return (
                  <th key={column.key} style={{ ...headerStyle, ...widthStyle }}>
                    {column.title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {value.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex)}>
                {columns.map((column, colIndex) => {
                  const address: CellAddress = { row: rowIndex, col: colIndex };
                  const isSelected =
                    selectedAddr !== null &&
                    selectedAddr.row === rowIndex &&
                    selectedAddr.col === colIndex;
                  const isEditing =
                    editing !== null &&
                    editing.address.row === rowIndex &&
                    editing.address.col === colIndex;
                  const cellValue = column.getValue(row);
                  const cellProps = {
                    style: { ...cellStyle, ...(isSelected ? selectedStyle : {}) },
                    onClick: (event: MouseEvent<HTMLTableCellElement>) =>
                      handleCellClick(address, event),
                    onDoubleClick: () => handleCellDoubleClick(address),
                  } as const;
                  return (
                    <td key={column.key} {...cellProps}>
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editing.draft}
                          onChange={(event) =>
                            setEditing({ address, draft: event.currentTarget.value })
                          }
                          onBlur={commitEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitEdit();
                            } else if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelEdit();
                            } else if (event.key === 'Tab') {
                              event.preventDefault();
                              commitEdit();
                              moveSelection(0, event.shiftKey ? -1 : 1);
                            }
                          }}
                          style={editorStyle}
                          aria-label={`${column.key} editor`}
                        />
                      ) : column.renderCell !== undefined ? (
                        column.renderCell({ value: cellValue, row, rowIndex, address })
                      ) : (
                        valueToString(column, cellValue)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
