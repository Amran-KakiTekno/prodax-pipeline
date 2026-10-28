import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://127.0.0.1:4101';

async function expectCounts(
  page: Page,
  counts: { inserted: string; updated: string; skipped: string },
): Promise<void> {
  await expect(page.getByTestId('count-inserted')).toHaveText(counts.inserted);
  await expect(page.getByTestId('count-updated')).toHaveText(counts.updated);
  await expect(page.getByTestId('count-skipped')).toHaveText(counts.skipped);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pipeline Sync Lab' })).toBeVisible();
});

test('initial load inserts every source row into an empty target store', async ({ page }) => {
  await expect(page.getByTestId('target-row-count')).toHaveText('0');
  await expect(page.getByTestId('target-empty')).toBeVisible();

  await page.getByRole('button', { name: 'Run initial load' }).click();

  await expectCounts(page, { inserted: '6', updated: '0', skipped: '0' });
  await expect(page.getByTestId('target-row-count')).toHaveText('6');
  await expect(page.getByTestId('checkpoint-run')).toHaveText('run 1 / rev 1');
  await expect(page.getByTestId('last-run-mode')).toHaveText('initial');
  await expect(page.getByTestId('execution-log').getByRole('listitem')).toHaveCount(1);
});

test('simulating source changes revises two records and adds one', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await expect(page.getByTestId('target-row-count')).toHaveText('6');

  await page.getByRole('button', { name: 'Simulate source changes' }).click();

  await expect(page.getByTestId('source-record-count')).toHaveText('7');
  await expect(page.getByTestId('source-document-count')).toHaveText('4');
});

test('incremental sync processes only the changed and new rows', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();

  await page.getByRole('button', { name: 'Run incremental sync' }).click();

  await expectCounts(page, { inserted: '1', updated: '2', skipped: '4' });
  await expect(page.getByTestId('target-row-count')).toHaveText('7');
  await expect(page.getByTestId('checkpoint-run')).toHaveText('run 2 / rev 2');
  await expect(page.getByTestId('last-run-mode')).toHaveText('incremental');
});

test('running the incremental sync again proves idempotency', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();
  await page.getByRole('button', { name: 'Run incremental sync' }).click();
  await expectCounts(page, { inserted: '1', updated: '2', skipped: '4' });

  await page.getByRole('button', { name: 'Run incremental sync' }).click();

  await expectCounts(page, { inserted: '0', updated: '0', skipped: '7' });
  await expect(page.getByTestId('target-row-count')).toHaveText('7');
  await expect(page.getByTestId('checkpoint-run')).toHaveText('run 3 / rev 2');
});

test('selecting a target row opens its linked synthetic document', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await expect(page.getByTestId('target-empty')).toHaveCount(0);
  await expect(page.getByTestId('document-empty')).toBeVisible();

  await page.getByRole('button', { name: 'Inspect rec-003' }).click();

  await expect(page.getByTestId('document-title')).toHaveText('Survey Summary — Mid Basin');
  await expect(page.getByTestId('document-id')).toHaveText('doc-002');
  await expect(page.getByTestId('document-body')).toContainText('mid-basin survey');
  await expect(page.getByTestId('document-empty')).toHaveCount(0);
});

test('reset restores the initial pre-run state', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();
  await page.getByRole('button', { name: 'Run incremental sync' }).click();
  await expect(page.getByTestId('target-row-count')).toHaveText('7');

  await page.getByRole('button', { name: 'Reset demo' }).click();

  await expect(page.getByTestId('source-record-count')).toHaveText('6');
  await expect(page.getByTestId('source-document-count')).toHaveText('3');
  await expect(page.getByTestId('target-row-count')).toHaveText('0');
  await expect(page.getByTestId('log-empty')).toBeVisible();
  await expect(page.getByTestId('execution-log')).toHaveCount(0);
  await expectCounts(page, { inserted: '0', updated: '0', skipped: '0' });
  await expect(page.getByTestId('checkpoint-run')).toHaveText('run 0 / rev 0');
});

test('the page does not overflow horizontally at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();
  await page.getByRole('button', { name: 'Run incremental sync' }).click();
  await page.getByRole('button', { name: 'Inspect rec-007' }).click();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test('the page has no serious or critical accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();
  await page.getByRole('button', { name: 'Run incremental sync' }).click();
  await page.getByRole('button', { name: 'Inspect rec-003' }).click();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(blocking).toEqual([]);
});

test('the running page makes no request to a non-local origin', async ({ page }) => {
  const externalRequests: string[] = [];

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (
      !url.startsWith(BASE_URL) &&
      !url.startsWith('data:') &&
      !url.startsWith('blob:') &&
      !url.startsWith('about:')
    ) {
      externalRequests.push(url);
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Run initial load' }).click();
  await page.getByRole('button', { name: 'Simulate source changes' }).click();
  await page.getByRole('button', { name: 'Run incremental sync' }).click();
  await page.getByRole('button', { name: 'Inspect rec-007' }).click();
  await expect(page.getByTestId('document-title')).toBeVisible();

  expect(externalRequests).toEqual([]);
});
