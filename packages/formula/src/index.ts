export const FORMULA_VERSION = '0.0.0';

export interface FormulaEngine {
  getValue(address: string): unknown;
  getFormula(address: string): string | null;
}

export function createFormulaEngine(): FormulaEngine {
  return {
    getValue: () => undefined,
    getFormula: () => null,
  };
}
