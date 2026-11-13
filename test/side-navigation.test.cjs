const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const draft = '/drafts/capabilities/creating-audiences';
let browser;

before(async () => {
  browser = await chromium.launch({ channel: 'chrome' });
});

after(async () => {
  await browser?.close();
});

async function openPage(path = draft, fixture, metadata = 'on') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (fixture) {
    await page.route(`${baseURL}${draft}`, async (route) => {
      const response = await route.fetch();
      const original = await response.text();
      const meta = metadata === null ? '' : `<meta name="side-navigation" content="${metadata}">`;
      const body = original
        .replace(/<main>[\s\S]*?<\/main>/, `<main>${fixture}</main>`)
        .replace(/<meta name="side-navigation" content="[^"]*">/, meta);
      await route.fulfill({ response, body });
    });
  }
  await page.goto(`${baseURL}${path}`);
  await page.waitForFunction(() => {
    const sections = [...document.querySelectorAll('main > .section')];
    return sections.length && sections.every((section) => section.dataset.sectionStatus === 'loaded');
  });
  assert.deepEqual(errors, []);
  return page;
}

test('draft headings generate nested links; navigation, history, and direct hashes work', async () => {
  const page = await openPage();
  try {
    const nav = page.locator('.side-navigation nav');
    assert.equal(await page.locator('.side-navigation').count(), 1);
    assert.equal(await nav.locator(':scope > ul:first-of-type > li').count(), 8);
    assert.deepEqual(await nav.locator('.side-navigation-related a').evaluateAll((links) => (
      links.map((link) => [link.textContent, link.getAttribute('href')])
    )), [
      ['Journeys', '/use-cases'],
      ['Dashboards', '/how-to-use'],
      ['Modeling and AI Capabilities', '/how-to-use'],
      ['Content Creation', '/use-cases'],
    ]);

    await nav.getByRole('link', { name: 'How to Segment and Activate', exact: true }).click();
    await page.waitForFunction(() => location.hash === '#how-to-segment-and-activate');
    await page.locator('main img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const image = document.querySelector('main img');
      return image.complete && image.naturalWidth > 0;
    });
    await nav.getByRole('link', { name: 'Attributes and Events', exact: true }).click();
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.hash === '#attributes-and-events'
    ));
    assert.equal(await page.locator('#attributes-and-events').evaluate((heading) => (
      Math.round(heading.getBoundingClientRect().top)
    )), 74);
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#how-to-segment-and-activate');
    await page.reload();
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.hash === '#how-to-segment-and-activate'
    ));

    const glossary = nav.getByRole('link', { name: 'Glossary', exact: true });
    await glossary.click();
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.hash === '#glossary'
    ));
    await page.locator('#best-practices').evaluate((heading) => heading.scrollIntoView());
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.hash === '#best-practices'
    ));
    await nav.getByRole('link', { name: 'Support', exact: true }).click();
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.hash === '#support'
    ));
  } finally {
    await page.close();
  }
});

test('sidebar is responsive, sticky on desktop, and does not reserve a print rail', async () => {
  const page = await openPage();
  try {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      const geometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        overflowing: [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 8).map((element) => `${element.tagName}.${element.className}`),
        nav: document.querySelector('.side-navigation-section').getBoundingClientRect().toJSON(),
        article: document.querySelector('.side-navigation-content').getBoundingClientRect().toJSON(),
      }));
      if (process.env.SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/side-navigation-${width}.png` });
      }
      assert.equal(geometry.overflow, false, `overflow at ${width}px: ${geometry.overflowing.join(', ')}`);
      if (width < 900) {
        assert.ok(geometry.nav.bottom <= geometry.article.top + 1);
      } else {
        assert.ok(geometry.nav.right < geometry.article.left);
        await page.locator('#how-to-segment-and-activate').evaluate((heading) => heading.scrollIntoView());
        const top = await page.locator('.side-navigation').evaluate((nav) => nav.getBoundingClientRect().top);
        assert.ok(Math.abs(top - 24) < 1, `sticky offset was ${top}`);
      }
    }
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.side-navigation-section').isVisible(), false);
    assert.equal(await page.locator('main').evaluate((main) => getComputedStyle(main).display), 'block');
  } finally {
    await page.close();
  }
});

test('generated anchors handle collisions, Unicode IDs, exclusions, focus, and heading edits', async () => {
  const fixture = `<div><div class="hero"><div><div><h1>Guide</h1><h2>Hero heading</h2></div></div></div></div>
    <div><h3 id="repeated">Orphan</h3><h2>Repeated</h2>
    <h3 id="caf&#233;">Caf&#233;</h3><h2>Repeated</h2><h3>Nested</h3>
    <h2> </h2><div class="cards"><div><div><h2>Card heading</h2></div></div></div>
    <h2>Edited heading</h2><p>${'Additional guide content. '.repeat(400)}</p></div>`;
  const page = await openPage(draft, fixture);
  try {
    const links = page.locator('.side-navigation nav > ul:first-of-type a');
    assert.deepEqual(await links.allTextContents(), ['Repeated', 'Café', 'Repeated', 'Nested', 'Edited heading']);
    const ids = await page.locator('[id]').evaluateAll((elements) => elements.map((element) => element.id));
    assert.equal(ids.length, new Set(ids).size);
    assert.deepEqual(await page.locator('main h2').evaluateAll((headings) => (
      headings.filter((heading) => heading.textContent === 'Repeated').map((heading) => heading.id)
    )), ['repeated-2', 'repeated-3']);
    const repeated = links.filter({ hasText: /^Repeated$/ }).nth(1);
    await repeated.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Nested');
    await links.filter({ hasText: 'Café' }).click();
    await page.waitForFunction(() => (
      document.querySelector('.side-navigation a[aria-current="location"]')?.textContent === 'Café'
    ));
    assert.equal(new URL(page.url()).hash, '#caf%C3%A9');
    await page.reload();
    await page.waitForFunction(() => (
      Math.abs(document.getElementById('café').getBoundingClientRect().top - 74) < 1
    ));
    assert.equal(await page.locator('.side-navigation a[href="#edited-heading"]').count(), 1);
    await page.evaluate(async () => {
      const { default: decorate } = await import('/blocks/anchor-nav/anchor-nav.js');
      decorate(document.querySelector('.side-navigation'));
    });
    assert.equal(await page.locator('.side-navigation nav').count(), 1);
    assert.equal(await links.count(), 5);
  } finally {
    await page.close();
  }
});

test('metadata off/missing preserves inline related navigation; an empty guide has no sidebar', async () => {
  const fixture = `<div><h1>Guide</h1></div><div><div class="anchor-nav related"><div><div>
    <a href="/use-cases">Journeys</a></div></div></div></div><div><h2>Overview</h2><h3>Details</h3></div>`;
  for (const metadata of ['off', null]) {
    const page = await openPage(draft, fixture, metadata);
    try {
      assert.equal(await page.locator('.has-side-navigation, .side-navigation').count(), 0);
      assert.equal(await page.getByRole('navigation', { name: 'Related capabilities' }).count(), 1);
      assert.equal(await page.locator('.anchor-nav a').getAttribute('href'), '/use-cases');
    } finally {
      await page.close();
    }
  }
  const page = await openPage(draft, '<div><h1>Empty guide</h1><h3>Orphan</h3><h2> </h2></div>');
  try {
    assert.equal(await page.locator('.has-side-navigation, .side-navigation').count(), 0);
  } finally {
    await page.close();
  }
});

test('the original page and a non-opted-in NHL page retain their navigation', async () => {
  const page = await openPage('/capabilities/creating-audiences');
  try {
    assert.equal(await page.locator('.side-navigation').count(), 0);
    assert.equal(await page.locator('.anchor-nav .section-anchor-nav a').count(), 7);
    await page.locator('.anchor-nav a[href="#evaluation"]').click();
    assert.equal(new URL(page.url()).hash, '#evaluation');
    await page.goto(`${baseURL}/capabilities`);
    await page.locator('main .cards[data-block-status="loaded"]').first().waitFor();
    assert.equal(await page.locator('.has-side-navigation, .side-navigation').count(), 0);
  } finally {
    await page.close();
  }
});
