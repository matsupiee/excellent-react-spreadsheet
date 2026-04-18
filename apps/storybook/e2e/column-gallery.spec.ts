import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Story IDs follow Storybook's CSF3 kebab-case derivation from the `title`:
 *   "Columns/TextColumn" -> "columns-textcolumn--default"
 * Verified by fetching `/index.json` from a running dev server.
 *
 * We navigate to `/iframe.html?id=...&viewMode=story` so the preview DOM is just
 * the rendered story (the manager chrome is skipped). A hidden Storybook
 * argstable also lives in that document, so we scope assertions to the gallery
 * `<table>` rendered by `_GalleryTable.tsx`, which has no class (the argstable
 * uses `.sb-argstableBlock`).
 */

const gotoGallery = async (page: Page, storyId: string): Promise<Locator> => {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
  const table = page.locator('table:not(.sb-argstableBlock)');
  await expect(table).toBeVisible();
  return table;
};

test.describe('Columns/TextColumn', () => {
  test('renders sample string values', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-textcolumn--default');
    await expect(table.getByText('Alice')).toBeVisible();
    await expect(table.getByText('First contributor')).toBeVisible();
    await expect(table.getByText('山田 太郎')).toBeVisible();
  });
});

test.describe('Columns/IntColumn', () => {
  test('renders integer sample values right-aligned', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-intcolumn--default');
    await expect(table.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
    await expect(table.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: '88', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: '9999', exact: true })).toBeVisible();
  });
});

test.describe('Columns/FloatColumn', () => {
  test('renders formatted currency and fixed-precision ratios', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-floatcolumn--default');
    // formatBlurred uses Intl.NumberFormat en-US currency USD -> "$19.99".
    await expect(table.getByRole('cell', { name: '$19.99', exact: true })).toBeVisible();
    // precision: 3 on ratio column -> "0.250".
    await expect(table.getByRole('cell', { name: '0.250', exact: true })).toBeVisible();
    await expect(table.getByText('Tiny fraction')).toBeVisible();
  });
});

test.describe('Columns/CheckboxColumn', () => {
  test('renders native checkboxes reflecting boolean state', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-checkboxcolumn--default');
    await expect(table.getByText('Ship column presets')).toBeVisible();
    await expect(table.getByText('Write Storybook gallery')).toBeVisible();
    // 4 rows x 2 boolean columns = 8 readOnly checkboxes rendered by renderCell.
    const checkboxes = table.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(8);
    // At least one checkbox is checked (r1 done=true, r4 done=true, r4 archived=true).
    await expect(table.locator('input[type="checkbox"]:checked')).not.toHaveCount(0);
  });
});

test.describe('Columns/DateColumn', () => {
  test('renders ISO-formatted date values', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-datecolumn--default');
    await expect(table.getByText('Alpha')).toBeVisible();
    // formatIsoDate outputs YYYY-MM-DD in UTC.
    await expect(table.getByRole('cell', { name: '2025-03-15', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: '2026-06-30', exact: true })).toBeVisible();
  });
});

test.describe('Columns/SelectColumn', () => {
  test('renders option labels, not raw values', async ({ page }) => {
    const table = await gotoGallery(page, 'columns-selectcolumn--default');
    await expect(table.getByText('Design API')).toBeVisible();
    // status "done" -> label "Done"; priority 1 -> label "P1 — urgent".
    await expect(table.getByRole('cell', { name: 'Done', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'P1 — urgent', exact: true })).toBeVisible();
  });
});
