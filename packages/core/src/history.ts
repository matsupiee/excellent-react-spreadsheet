import type { CellPatch } from './types.js';

export type HistoryEntry = {
  id: string;
  timestamp: number;
  patches: CellPatch[];
  label?: string;
  coalesceKey?: string;
};

export type CreateHistoryOptions = {
  maxHistory?: number;
  coalesceMs?: number;
};

export type PushOptions = {
  label?: string;
  coalesceKey?: string;
  timestamp?: number;
};

export type History = {
  push: (patches: CellPatch[], opts?: PushOptions) => void;
  undo: () => CellPatch[] | null;
  redo: () => CellPatch[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  entries: () => readonly HistoryEntry[];
};

const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_COALESCE_MS = 500;

type CryptoLike = { randomUUID?: () => string };

const getCrypto = (): CryptoLike | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const maybe = (globalThis as { crypto?: unknown }).crypto;
  if (maybe && typeof maybe === 'object') {
    return maybe as CryptoLike;
  }
  return undefined;
};

const createIdFactory = (): (() => string) => {
  const crypto = getCrypto();
  if (crypto && typeof crypto.randomUUID === 'function') {
    const randomUUID = crypto.randomUUID.bind(crypto);
    return () => randomUUID();
  }
  let counter = 0;
  return () => {
    counter += 1;
    return `hist-${counter.toString(36)}-${Date.now().toString(36)}`;
  };
};

/**
 * Invert a single patch so that applying the inverse undoes the forward patch.
 */
export const invertPatch = (patch: CellPatch): CellPatch => {
  switch (patch.op) {
    case 'set':
      return { op: 'set', address: patch.address, prev: patch.next, next: patch.prev };
    case 'insertRow':
      return { op: 'removeRow', at: patch.at, row: patch.row };
    case 'removeRow':
      return { op: 'insertRow', at: patch.at, row: patch.row };
    case 'moveRow':
      return { op: 'moveRow', from: patch.to, to: patch.from };
  }
};

/**
 * Invert a full patch list. Because patches are applied in order, the inverse
 * list must also reverse the order so the last forward mutation is undone first.
 */
export const invertPatches = (patches: CellPatch[]): CellPatch[] => {
  const inverse: CellPatch[] = [];
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const patch = patches[i];
    if (patch === undefined) continue;
    inverse.push(invertPatch(patch));
  }
  return inverse;
};

const now = (): number => Date.now();

export const createHistory = (options: CreateHistoryOptions = {}): History => {
  const maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
  const coalesceMs = options.coalesceMs ?? DEFAULT_COALESCE_MS;
  const nextId = createIdFactory();

  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];

  const evict = (): void => {
    if (maxHistory <= 0) {
      undoStack = [];
      return;
    }
    while (undoStack.length > maxHistory) {
      undoStack.shift();
    }
  };

  const push: History['push'] = (patches, opts) => {
    if (patches.length === 0) return;
    const timestamp = opts?.timestamp ?? now();
    const top = undoStack.length > 0 ? undoStack[undoStack.length - 1] : undefined;

    const canCoalesce =
      top !== undefined &&
      opts?.coalesceKey !== undefined &&
      top.coalesceKey !== undefined &&
      top.coalesceKey === opts.coalesceKey &&
      timestamp - top.timestamp <= coalesceMs;

    if (canCoalesce && top !== undefined) {
      top.patches.push(...patches);
      top.timestamp = timestamp;
      if (opts?.label !== undefined) {
        top.label = opts.label;
      }
    } else {
      const entry: HistoryEntry = {
        id: nextId(),
        timestamp,
        patches: [...patches],
      };
      if (opts?.label !== undefined) entry.label = opts.label;
      if (opts?.coalesceKey !== undefined) entry.coalesceKey = opts.coalesceKey;
      undoStack.push(entry);
      evict();
    }

    // Any new edit invalidates the redo stack.
    redoStack = [];
  };

  const undo: History['undo'] = () => {
    const entry = undoStack.pop();
    if (entry === undefined) return null;
    redoStack.push(entry);
    return invertPatches(entry.patches);
  };

  const redo: History['redo'] = () => {
    const entry = redoStack.pop();
    if (entry === undefined) return null;
    undoStack.push(entry);
    return [...entry.patches];
  };

  const canUndo: History['canUndo'] = () => undoStack.length > 0;
  const canRedo: History['canRedo'] = () => redoStack.length > 0;

  const clear: History['clear'] = () => {
    undoStack = [];
    redoStack = [];
  };

  const entries: History['entries'] = () => undoStack;

  return { push, undo, redo, canUndo, canRedo, clear, entries };
};
