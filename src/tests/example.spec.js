// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Example test that demonstrates basic Playwright functionality
 */
test('basic test', async ({ page }) => {
  // Navigate to the Skyvern UI
  await page.goto('/');
  
  // Verify the page title contains expected text
  await expect(page).toHaveTitle(/Skyvern/);
  
  // Take a screenshot
  await page.screenshot({ path: 'artifacts/screenshots/home-page.png' });
});

/**
 * Example test that demonstrates form interaction
 */
test('form interaction', async ({ page }) => {
  // Navigate to a form page (this is a placeholder - adjust to your actual form URL)
  await page.goto('/');
  
  // Example of filling out a form
  // await page.fill('input[name="username"]', 'testuser');
  // await page.fill('input[name="password"]', 'password123');
  // await page.click('button[type="submit"]');
  
  // Example of verifying navigation after form submission
  // await expect(page).toHaveURL(/dashboard/);
});

/**
 * Example test that demonstrates working with multiple pages/tabs
 */
test('multiple pages', async ({ browser }) => {
  // Create a new browser context
  const context = await browser.newContext();
  
  // Open a new page in this context
  const page1 = await context.newPage();
  await page1.goto('/');
  
  // Open another page in the same context (shared session)
  const page2 = await context.newPage();
  await page2.goto('/');
  
  // Interact with both pages
  await page1.screenshot({ path: 'artifacts/screenshots/page1.png' });
  await page2.screenshot({ path: 'artifacts/screenshots/page2.png' });
  
  // Close the context when done
  await context.close();
});