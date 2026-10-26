let playwrightChromium = null;
try {
  // Prefer Playwright for persistent real-Chrome behavior.
  ({ chromium: playwrightChromium } = require('playwright'));
} catch (_) {
  playwrightChromium = null;
}

const fs = require('fs');
const puppeteer = require('puppeteer');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(min = 2000, max = 8000) {
  await sleep(randomBetween(min, max));
}

async function wiggleMouse(page) {
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.move(
      randomBetween(50, 1200),
      randomBetween(50, 800),
      { steps: randomBetween(8, 20) }
    );
    await randomDelay(200, 600);
  }
}

async function humanScroll(page) {
  await page.mouse.move(
    randomBetween(80, 900),
    randomBetween(80, 700),
    { steps: randomBetween(8, 16) }
  );
  await page.mouse.wheel(0, randomBetween(400, 1100));
  await randomDelay(1600, 4200);
}

async function extractPostsFromPage(page) {
  return page.evaluate(() => {
    const selectors = [
      'div.feed-shared-update-v2',
      'article[data-id]',
      'article'
    ];

    const rows = [];
    const seenElements = new Set();

    const toText = (el) => (el?.innerText || '').trim();

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (seenElements.has(node)) continue;
        seenElements.add(node);

        const text = toText(
          node.querySelector('.feed-shared-update-v2__description, .update-components-text, .break-words')
        ) || toText(node);

        if (!text || text.length < 30) continue;

        const author = toText(
          node.querySelector('span.update-components-actor__name, .update-components-actor__title span[aria-hidden="true"], .feed-shared-actor__name')
        );

        const profileLink = node.querySelector('a.update-components-actor__meta-link, a.app-aware-link[href*="/in/"], a.app-aware-link[href*="/company/"]')?.href || '';
        const postedTime = toText(
          node.querySelector('span.update-components-actor__sub-description, .feed-shared-actor__sub-description')
        );

        const imageUrl = node.querySelector('img.ivm-view-attr__img--centered, img.update-components-image__image-link, img')?.src || '';

        const comments = toText(
          node.querySelector('span.social-details-social-counts__comments, button[aria-label*="comment"] span')
        );

        const postLink = node.querySelector('a[href*="/feed/update/"], a[href*="/posts/"], a.feed-shared-control-menu__trigger')?.href || '';

        const mentions = Array.from(node.querySelectorAll('a[href*="/in/"], a[href*="/company/"]'))
          .map((a) => a.href)
          .filter(Boolean);

        rows.push({
          author,
          profileLink,
          postText: text,
          postLink,
          imageUrl,
          comments,
          postedTime,
          mentions,
        });
      }
    }

    const deduped = [];
    const seen = new Set();

    for (const row of rows) {
      const key = `${row.postLink}|${row.author}|${String(row.postText).slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    return deduped;
  });
}

async function scrapeLinkedInHomeFeed({ maxPosts = 30, chromeProfilePath = '', profileDirectory = '' } = {}) {
  const safeMaxPosts = Math.max(1, Math.min(100, Number(maxPosts) || 30));
  const userDataDir = String(chromeProfilePath || process.env.LINKEDIN_CHROME_PROFILE_PATH || '').trim();
  const safeProfileDirectory = String(profileDirectory || process.env.LINKEDIN_CHROME_PROFILE_DIRECTORY || 'Default').trim() || 'Default';

  if (!userDataDir) {
    throw new Error('Chrome profile path is required. Configure it in the LinkedIn Feed tab.');
  }

  if (process.platform !== 'win32' && /^[a-zA-Z]:\\/.test(userDataDir)) {
    throw new Error('Windows Chrome path cannot be read from Linux Docker backend. Use a path inside the container (mounted volume) or run backend locally outside Docker.');
  }

  if (!fs.existsSync(userDataDir)) {
    throw new Error(`Chrome user data path not found: ${userDataDir}`);
  }

  let browser = null;
  let context = null;
  let page = null;

  if (playwrightChromium) {
    const launchAttempts = [
      {
        headless: false,
        channel: 'chrome',
        viewport: null,
        args: ['--start-maximized', `--profile-directory=${safeProfileDirectory}`],
      },
      {
        headless: false,
        viewport: null,
        args: ['--start-maximized', `--profile-directory=${safeProfileDirectory}`],
      },
    ];

    let lastError = null;
    for (const options of launchAttempts) {
      try {
        context = await playwrightChromium.launchPersistentContext(userDataDir, options);
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!context) throw lastError || new Error('Failed to launch Playwright browser context');
    page = context.pages()[0] || await context.newPage();
  } else {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir,
      args: ['--start-maximized', `--profile-directory=${safeProfileDirectory}`],
    });
    page = (await browser.pages())[0] || await browser.newPage();
  }

  try {
    await page.bringToFront();
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });

    if (String(page.url()).includes('/login')) {
      throw new Error('LinkedIn session not found in this Chrome profile. Log in once manually in that profile and retry.');
    }

    await randomDelay(2500, 6000);
    await wiggleMouse(page);

    const all = [];
    const seenKeys = new Set();

    for (let cycle = 0; cycle < 14 && all.length < safeMaxPosts; cycle += 1) {
      const batch = await extractPostsFromPage(page);
      for (const post of batch) {
        const key = `${post.postLink}|${post.author}|${String(post.postText).slice(0, 120)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        all.push(post);
        if (all.length >= safeMaxPosts) break;
      }

      if (all.length >= safeMaxPosts) break;

      await humanScroll(page);
      if (cycle % 3 === 2) await wiggleMouse(page);
      await randomDelay(1200, 3600);
    }

    return all.slice(0, safeMaxPosts);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

module.exports = {
  scrapeLinkedInHomeFeed,
};
