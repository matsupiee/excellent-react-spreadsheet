# Styling

The core ships no default CSS — rendering is yours. We provide a Tailwind preset and a published set of CSS variables so every adopter can plug into whatever styling system their app already has.

## Tailwind preset

Install the preset:

```sh
pnpm add @excellent-react-spreadsheet/tailwind
```

Wire it into your `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import ersPreset from '@excellent-react-spreadsheet/tailwind';

export default {
  presets: [ersPreset],
  content: ['./src/**/*.{ts,tsx}'],
} satisfies Config;
```

The preset extends `theme.extend.colors` with CSS-variable-driven tokens. You get classes like `bg-ers-header`, `border-ers-border`, and `bg-ers-selection` out of the box.

## CSS variables

Override any of these at any scope:

| Variable          | Default                    | Purpose                  |
| ----------------- | -------------------------- | ------------------------ |
| `--ers-selection` | `rgba(14, 165, 233, 0.14)` | Active selection fill    |
| `--ers-border`    | `#d4d4d8`                  | Grid line color          |
| `--ers-header-bg` | `#f4f4f5`                  | Column header background |

```css
:root {
  --ers-selection: rgba(99, 102, 241, 0.18);
  --ers-border: #334155;
}

[data-theme='dark'] {
  --ers-border: #475569;
}
```

## Going theme-less

If you don't use Tailwind, define the variables in your own stylesheet and reference them from your renderer:

```css
.my-grid {
  --ers-selection: rgba(14, 165, 233, 0.14);
  --ers-border: #d4d4d8;
}
.my-grid td {
  border: 1px solid var(--ers-border);
}
.my-grid td.selected {
  background: var(--ers-selection);
}
```

The library is indifferent about which approach you pick.

## Dark mode

Both Tailwind's `dark:` variant and manual `[data-theme='dark']` attribute selectors work — the variables cascade through the DOM tree like any other CSS custom property. Test the [playground](/playground) with your browser's dark mode toggle to see the effect on this site.
