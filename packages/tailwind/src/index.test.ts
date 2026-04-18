import { describe, expect, it } from 'vitest';
import { preset } from './index.js';

describe('tailwind preset', () => {
  it('exposes theme.extend.colors for ERS CSS variables', () => {
    expect(preset.theme.extend.colors).toMatchObject({
      'ers-selection': expect.any(String),
      'ers-border': expect.any(String),
      'ers-header-bg': expect.any(String),
    });
  });
});
