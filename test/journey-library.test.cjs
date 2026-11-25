const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const path = '/use-cases';
let browser;

before(async () => {
  browser = await chromium.launch({ channel: 'chrome' });
});

after(async () => {
  await browser?.close();
});

async function openLibrary() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${baseURL}${path}`);
  await page.locator('.journey-library[data-block-status="loaded"]').waitFor();
  await page.locator('.journey-card').first().waitFor();
  return { page, errors };
}

async function visibleCards(page) {
  return page.locator('.journey-card:not([hidden])').count();
}

test('renders 23 journeys and supports search, filters, and clear state', async () => {
  const { page, errors } = await openLibrary();
  try {
    assert.equal(await visibleCards(page), 23);
    assert.equal(await page.locator('.journey-result-count').textContent(), '23 journeys');

    await page.getByRole('searchbox', { name: 'Search journeys' }).fill('lapsed ticket buyer');
    assert.equal(await visibleCards(page), 1);
    assert.equal(
      await page.locator('.journey-card:not([hidden]) h2').textContent(),
      'Lapsed Ticket Buyer Win-Back',
    );
    assert.equal(await page.locator('.journey-result-count').textContent(), '1 journey');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.locator('[data-filter="level"]').selectOption('Club');
    assert.equal(await visibleCards(page), 9);

    await page.locator('[data-filter="readiness"]').selectOption('Foundation');
    assert.equal(await visibleCards(page), 4);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.locator('[data-filter="value"]').selectOption('Not rated');
    assert.equal(await visibleCards(page), 6);

    await page.locator('[data-filter="complexity"]').selectOption('Not rated');
    assert.equal(await visibleCards(page), 6);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    assert.equal(await visibleCards(page), 23);
    assert.equal(await page.getByRole('searchbox', { name: 'Search journeys' }).inputValue(), '');
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('opens, navigates, and closes journey dialogs', async () => {
  const { page, errors } = await openLibrary();
  try {
    const learnMore = page.locator('.journey-card')
      .filter({ has: page.getByRole('heading', { name: 'Registration Welcome', exact: true }) })
      .getByRole('button', { name: 'Learn more' });
    await learnMore.click();
    let dialog = page.locator('dialog[open]');
    assert.equal(await dialog.locator('h2').textContent(), 'Registration Welcome');
    assert.equal(await dialog.getByRole('heading', { name: 'Audience definition' }).count(), 1);

    await dialog.getByRole('button', { name: 'Player Affinity', exact: true }).click();
    dialog = page.locator('dialog[open]');
    assert.equal(await dialog.locator('h2').textContent(), 'Player Affinity');

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);

    await learnMore.click();
    dialog = page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Close Registration Welcome details' }).click();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await learnMore.evaluate((button) => button === document.activeElement), true);

    await learnMore.click();
    await page.mouse.click(4, 4);
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('keeps controls, cards, and dialogs within mobile, tablet, and desktop viewports', async () => {
  const { page, errors } = await openLibrary();
  try {
    for (const width of [375, 768, 1200, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => (
        document.documentElement.scrollWidth > window.innerWidth
      ));
      assert.equal(overflow, false, `page overflows at ${width}px`);

      await page.locator('.journey-card').first().getByRole('button', { name: 'Learn more' }).click();
      const dialogFits = await page.locator('dialog[open]').evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      });
      assert.equal(dialogFits, true, `dialog overflows at ${width}px`);

      if (process.env.SCREENSHOT_DIR) {
        await page.locator('dialog[open]').screenshot({
          path: `${process.env.SCREENSHOT_DIR}/journey-library-dialog-${width}.png`,
        });
      }

      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
