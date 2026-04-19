// Constrain the editor input so its intrinsic min-content width cannot push the
// column wider under `tableLayout: fixed` — without `size={1}`, the implicit
// size=20 forces a ~145px min-width that leaks into the column sizing pass.
export const editorInputBaseStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box' as const,
};
