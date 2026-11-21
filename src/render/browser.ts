import { chromium, type Browser } from 'playwright';

let sharedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export interface RenderResult {
  renderedHtml: string;
  error?: string;
}

/**
 * Renders a web page inside a headless Chromium browser instance,
 * evaluating client-side JavaScript to retrieve the rendered DOM.
 */
export async function renderPage(url: string, timeoutMs: number = 15000): Promise<RenderResult> {
  let browser: Browser | null = null;
  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'seo-gate/0.1.0 (+https://github.com/majhiiii/seo-gate) Headless-Renderer',
    });
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Short stabilization pause to allow microtask UI updates (e.g. React / LWC hydration)
    await page.waitForTimeout(200);

    const renderedHtml = await page.content();
    await context.close();

    return { renderedHtml };
  } catch (err) {
    return {
      renderedHtml: '',
      error: `Failed to render JavaScript DOM for ${url}: ${(err as Error).message}`,
    };
  }
}
