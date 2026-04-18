import { describe, expect, it } from 'vitest';
import { createFormulaEngine } from './index.js';

describe('formula engine (stub)', () => {
  it('creates an engine with required methods', () => {
    const engine = createFormulaEngine();
    expect(typeof engine.getValue).toBe('function');
    expect(typeof engine.getFormula).toBe('function');
  });
});
