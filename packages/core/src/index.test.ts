import { describe, expect, it } from 'vitest';
import { VERSION } from './index.js';

describe('core package', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
