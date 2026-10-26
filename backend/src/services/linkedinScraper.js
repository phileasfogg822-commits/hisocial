const puppeteer = require('puppeteer');
const axios = require('axios');
const { extractContact } = require('./deduplicationService');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractLiAtCookieValue(rawValue = '') {
  const text = String(rawValue || '').trim();
  if (!text) return '';

  const fullCookieMatch = text.match(/(?:^|;\s*)li_at=([^;]+)/i);
  if (fullCookieMatch?.[1]) return fullCookieMatch[1].trim();
  return text;
}

function extractLinkedInCookies(rawValue = '') {
  const text = String(rawValue || '').trim();
  if (!text) return [];

  const allowedNames = new Set([
    'li_at',
    'JSESSIONID',
    'bcookie',
    'bscookie',
    'li_gc',
    'lang',
    'lidc',
    'li_rm',
    'li_mc',
  ]);

  const cookiePairs = text.includes(';')
    ? text.split(';').map((part) => part.trim()).filter(Boolean)
    : [text];

  const cookies = [];
  for (const pair of cookiePairs) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim().replace(/^"|"$/g, '');
    if (!name || !value) continue;
    if (!allowedNames.has(name)) continue;

    cookies.push({
      name,
      value,
      domain: '.linkedin.com',
      path: '/',
      secure: true,
      sameSite: 'None',
    });
  }

  if (cookies.length === 0) {
    const liAt = extractLiAtCookieValue(text);
    if (!liAt) return [];
    cookies.push({
      name: 'li_at',
      value: liAt,
      domain: '.linkedin.com',
      path: '/',
      secure: true,
      sameSite: 'None',
    });
  }

  return cookies;
}

async function extractPostsFromCurrentPage(page) {
  return page.evaluate(() => {
    const textFrom = (el) => (el?.innerText || '').trim();
    const snippets = [];

    const cardSelectors = [
      'main li.reusable-search__result-container',
      'main li.search-result',
      'main li.artdeco-list__item',
      'main div.feed-shared-update-v2',
      'article',
    ];

    const cards = cardSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).slice(0, 30);
    for (const card of cards) {
      const content = textFrom(card);
      if (!content || content.length < 60) continue;

      const anchor = card.querySelector('a[href*="linkedin.com/"]');
      const authorEl = card.querySelector('span[aria-hidden="true"], .entity-result__title-text, .update-components-actor__title, h3');
      snippets.push({
        content,
        url: anchor?.href || '',
        author: textFrom(authorEl) || (content.split('\n')[0] || '').trim(),
        company: '',
        jobTitle: '',
        scannedAt: new Date().toISOString(),
      });
    }

    const uniq = [];
    const seen = new Set();
    for (const row of snippets) {
      const key = `${(row.url || '').trim()}|${row.content.slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(row);
    }
    return uniq;
  });
}

async function extractFromDuckDuckGo(page, keyword) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:linkedin.com/posts ${keyword} hiring`)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(1200);

  return page.evaluate(() => {
    const rows = [];
    const cards = Array.from(document.querySelectorAll('.result, .web-result')).slice(0, 25);
    for (const card of cards) {
      const linkEl = card.querySelector('a.result__a, a[data-testid="result-title-a"]');
      const snippetEl = card.querySelector('.result__snippet, .result-snippet');
      const title = (linkEl?.innerText || '').trim();
      const snippet = (snippetEl?.innerText || '').trim();
      const href = linkEl?.href || '';
      if (!href || !/linkedin\.com\/(posts|feed|jobs|company|in)\//i.test(href)) continue;
      const content = [title, snippet].filter(Boolean).join('\n');
      if (content.length < 40) continue;

      rows.push({
        content,
        url: href,
        author: title || 'LinkedIn result',
        company: '',
        jobTitle: '',
        scannedAt: new Date().toISOString(),
      });
    }

    return rows;
  });
}

function decodeHtmlEntities(input = '') {
  return String(input)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function extractFromDuckDuckGoHttp(keyword) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:linkedin.com/posts ${keyword} hiring`)}`;
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  });

  const html = String(response.data || '');
  const blocks = html.match(/<div class="result[\s\S]*?<\/div>\s*<\/div>/gi) || [];
  const rows = [];

  for (const block of blocks.slice(0, 25)) {
    const hrefMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

    const href = decodeHtmlEntities(hrefMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    const title = decodeHtmlEntities((titleMatch?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const snippetRaw = snippetMatch?.[1] || snippetMatch?.[2] || '';
    const snippet = decodeHtmlEntities(String(snippetRaw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

    if (!href || !/linkedin\.com\/(posts|feed|jobs|company|in)\//i.test(href)) continue;
    const content = [title, snippet].filter(Boolean).join('\n');
    if (content.length < 40) continue;

    rows.push({
      content,
      url: href,
      author: title || 'LinkedIn result',
      company: '',
      jobTitle: '',
      scannedAt: new Date().toISOString(),
    });
  }

  return rows;
}

async function extractFromBingRss(keyword) {
  const query = `linkedin ${keyword} hiring freelance job`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/rss+xml,text/xml',
    },
  });

  const xml = String(response.data || '');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const parsed = items.map((item) => {
    const title = decodeHtmlEntities((item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim());
    const link = decodeHtmlEntities((item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim());
    const description = decodeHtmlEntities((item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').trim());

    if (!link) return null;
    const content = [title, description].filter(Boolean).join('\n');
    if (content.length < 40) return null;

    return {
      content,
      url: link,
      author: title || 'Bing result',
      company: '',
      jobTitle: '',
      scannedAt: new Date().toISOString(),
    };
  }).filter(Boolean);

  const linkedInOnly = parsed.filter((row) => /linkedin\.com/i.test(row.url));
  return linkedInOnly.length > 0 ? linkedInOnly : parsed;
}

async function scrapeLinkedInPosts({ keywords = [], includeWords = [], excludeWords = [], linkedInSessionCookie = '' }) {
  let browser = null;
  let page = null;
  const allowPublicFallback = String(process.env.MONITOR_ALLOW_PUBLIC_FALLBACK || 'false').toLowerCase() === 'true';

  try {
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--disable-features=site-per-process,Translate,BackForwardCache',
          '--enable-logging=stderr',
          '--v=1',
        ]
      });
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1400, height: 920 });
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      page.setDefaultNavigationTimeout(60000);
      const linkedInCookies = extractLinkedInCookies(linkedInSessionCookie);
      if (linkedInCookies.length > 0) {
        // Navigate to linkedin.com first so the domain context is established,
        // then inject the cookie before navigating to the actual target.
        try {
          await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (_) {
          // non-fatal — proceed with cookie injection anyway
        }
        await page.setCookie(...linkedInCookies);
        const cookieNames = linkedInCookies.map((cookie) => cookie.name).join(',');
        console.log('LinkedIn cookies injected:', cookieNames);
      }
      page.on('requestfailed', (request) => {
        console.warn('Puppeteer request failed:', request.url(), request.failure()?.errorText || 'unknown_error');
      });
    } catch (initErr) {
      console.warn('Headless browser init failed, using HTTP fallback only:', initErr.message || initErr);
      page = null;
    }

    if (!page && !allowPublicFallback) {
      console.warn('LinkedIn browser is unavailable and MONITOR_ALLOW_PUBLIC_FALLBACK is disabled; returning empty feed.');
      return [];
    }

    const allPosts = [];
    const uniqueKeywords = Array.from(new Set((keywords || []).map((k) => String(k).trim()).filter(Boolean))).slice(0, 8);

    for (const keyword of uniqueKeywords) {
      let rows = [];
      if (page) {
        try {
          const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&origin=GLOBAL_SEARCH_HEADER`;
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
          await sleep(1800);
          // Detect login wall — if still on login page the cookie didn't work
          const pageTitle = await page.title();
          if (/log in|sign in/i.test(pageTitle)) {
            console.warn('LinkedIn cookie auth failed for keyword:', keyword, '— still on login page. Cookie may be expired or invalid.');
            rows = [];
          } else {
            rows = await extractPostsFromCurrentPage(page);
            console.log('LinkedIn scrape got', rows.length, 'raw rows for keyword:', keyword);
          }
        } catch (err) {
          console.warn('LinkedIn content search failed, switching to public fallback:', keyword, err.message || err);
        }
      }

      if (rows.length === 0 && page) {
        try {
          rows = await extractFromDuckDuckGo(page, keyword);
        } catch (fallbackErr) {
          console.warn('Public fallback search failed:', keyword, fallbackErr.message || fallbackErr);
          rows = [];
        }
      }

      if (rows.length === 0) {
        try {
          rows = await extractFromDuckDuckGoHttp(keyword);
        } catch (httpFallbackErr) {
          console.warn('HTTP fallback search failed:', keyword, httpFallbackErr.message || httpFallbackErr);
          rows = [];
        }
      }

      if (rows.length === 0) {
        try {
          rows = await extractFromBingRss(keyword);
        } catch (bingFallbackErr) {
          console.warn('Bing RSS fallback search failed:', keyword, bingFallbackErr.message || bingFallbackErr);
          rows = [];
        }
      }

      rows.forEach((row) => {
        const rawUrl = String(row.url || '').trim();
        const isStrongLinkedInOpportunityUrl = /linkedin\.com\/(posts\/|feed\/update|jobs\/view)/i.test(rawUrl);
        if (!isStrongLinkedInOpportunityUrl) return;

        const lowered = row.content.toLowerCase();
        const includeOk = includeWords.length === 0 || includeWords.some((w) => lowered.includes(String(w).toLowerCase()));
        const excludeHit = excludeWords.some((w) => lowered.includes(String(w).toLowerCase()));
        if (includeOk && !excludeHit) {
          allPosts.push({
            ...row,
            externalContact: extractContact(`${row.content}\n${row.url}`),
          });
        }
      });
    }

    return allPosts;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
      }
    }
  }
}

async function captureLinkedInPreview({ keyword = 'hiring', linkedInSessionCookie = '' } = {}) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-features=site-per-process,Translate,BackForwardCache',
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 900 });
    const linkedInCookies = extractLinkedInCookies(linkedInSessionCookie);
    if (linkedInCookies.length > 0) {
      // Establish domain context first, then inject cookie
      try {
        await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (_) {}
      await page.setCookie(...linkedInCookies);
      const cookieNames = linkedInCookies.map((cookie) => cookie.name).join(',');
      console.log('Preview: LinkedIn cookies injected:', cookieNames);
    }

    const targetUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&origin=GLOBAL_SEARCH_HEADER`;
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (navigationErr) {
      console.warn('Preview navigation fallback:', navigationErr.message || navigationErr);
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    await sleep(1500);

    const screenshot = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: false, encoding: 'base64' });
    return {
      imageDataUrl: `data:image/jpeg;base64,${screenshot}`,
      sourceUrl: targetUrl,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
      }
    }
  }
}

module.exports = {
  scrapeLinkedInPosts,
  captureLinkedInPreview,
};
