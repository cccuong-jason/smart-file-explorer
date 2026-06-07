import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('shows Vietnamese by default with inline toolbar controls on the main UI', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByPlaceholder('Tìm kiếm tệp theo tên hoặc nội dung...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'VI', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chuyển giao diện' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở Cài đặt' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Hộp thư công việc', selected: true })).toBeVisible();
  await expect(page.getByText('Mở ứng dụng và thấy ngay tài liệu nào cần bạn xử lý lúc này.')).toBeVisible();
});

test('toggles language directly from the main toolbar and keeps light mode', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await expect(page.getByPlaceholder('Search files by name or content...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toHaveCount(0);
  await expect.poll(async () => {
    return page.evaluate(() => ({
      theme: window.localStorage.getItem('theme_mode'),
      dark: document.documentElement.classList.contains('dark'),
    }));
  }).toEqual({ theme: 'light', dark: false });
});

test('opens the localized settings modal from the main UI', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Mở Cài đặt' }).click();

  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chung' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dữ liệu & riêng tư' })).toBeVisible();
});
