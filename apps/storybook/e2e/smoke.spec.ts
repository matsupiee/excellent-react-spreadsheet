import { expect, test } from '@playwright/test';

test('storybook loads welcome page', async ({ page }) => {
  await page.goto('/?path=/story/welcome--default');
  await expect(page.frameLocator('iframe').getByText('excellent-react-spreadsheet')).toBeVisible();
});
