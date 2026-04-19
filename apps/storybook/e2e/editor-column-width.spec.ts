import { test, expect } from '@playwright/test';

// Regression: entering edit mode used to inflate a narrow column because the
// <input>'s implicit size=20 forced a ~145px min-content width under
// `tableLayout: fixed`. All cells in the column widened, not just the editing
// one. The editors now set `size={1}` + width:100% so column widths stay
// locked while editing.
test('edit mode keeps narrow column widths locked', async ({ page }) => {
  await page.goto('/iframe.html?id=playground-spreadsheet--large-dataset&viewMode=story');
  await page.locator('tr[data-row-index="0"] td[role="gridcell"]').first().waitFor();

  const columnWidths = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLTableCellElement>(
          'tr[data-row-index] td[role="gridcell"]:first-of-type',
        ),
      )
        .slice(0, 15)
        .map((c) => +c.getBoundingClientRect().width.toFixed(3)),
    );

  const before = await columnWidths();
  await page.locator('tr[data-row-index="8"] td[role="gridcell"]').first().click();
  await page.keyboard.press('Enter');
  await page.locator('tr[data-row-index="8"] td[role="gridcell"] input').first().waitFor();
  const editing = await columnWidths();

  expect(editing).toEqual(before);
  expect(before.every((w) => w === before[0])).toBe(true);
});
