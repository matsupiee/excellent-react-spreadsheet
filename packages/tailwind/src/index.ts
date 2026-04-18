export const preset = {
  theme: {
    extend: {
      colors: {
        'ers-selection': 'var(--ers-selection, rgb(59 130 246 / 0.2))',
        'ers-border': 'var(--ers-border, rgb(226 232 240))',
        'ers-header-bg': 'var(--ers-header-bg, rgb(248 250 252))',
      },
    },
  },
} as const;

export default preset;
