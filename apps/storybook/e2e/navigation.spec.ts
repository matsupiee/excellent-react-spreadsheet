import { expect, test } from '@playwright/test';

/**
 * Storybook's sidebar tags each tree node with `data-item-id`. Components get the
 * story-group id (e.g. `columns-intcolumn`); a story is `<group>--<story>`.
 * The "Columns" root (`data-item-id="columns"`) is expanded by default so all six
 * component entries are visible without a manual click.
 */

const COLUMN_COMPONENT_IDS = [
  'columns-textcolumn',
  'columns-intcolumn',
  'columns-floatcolumn',
  'columns-checkboxcolumn',
  'columns-datecolumn',
  'columns-selectcolumn',
] as const;

test.describe('Storybook navigation', () => {
  test('sidebar lists every column gallery entry under the Columns group', async ({ page }) => {
    await page.goto('/?path=/story/welcome--default');
    await expect(page.locator('[data-item-id="columns"][data-nodetype="root"]')).toBeVisible();
    for (const id of COLUMN_COMPONENT_IDS) {
      await expect(page.locator(`[data-item-id="${id}"]`)).toBeVisible();
    }
  });

  test('clicking IntColumn in the sidebar renders numeric cells', async ({ page }) => {
    await page.goto('/?path=/story/welcome--default');
    await page.locator('[data-item-id="columns-intcolumn"]').click();
    await expect(page).toHaveURL(/columns-intcolumn/);
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
    await expect(frame.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  });
});
