import { Browser, Page } from 'puppeteer';

import { required } from './required';
import { WorkerQueue } from './worker-queue';

const selectors = {
  title: 'h1.page-title span',
  setSelect: 'select#attribute471',
  cardSelect: 'select#attribute479',
  surfaceSelect: 'select#attribute473',
};

async function scrapeCard(browser: Browser, productUrl: string) {
  const productNameMatch = new URL(productUrl).pathname.match(/p-(.+)-\d+/);
  const product = productNameMatch ? productNameMatch[1] : productUrl;
  console.log(`Scraping product '${product}'...`);

  // Open a new page and navigate to the product
  const page = await browser.newPage();
  await page.goto(productUrl);

  const name = await scrapeProductName(page);

  const cards = await scrapeCardVariants(name, productUrl, page);

  await page.close();

  return cards;
}

async function scrapeCardVariants(
  name: string,
  productUrl: string,
  page: Page
) {
  // Create a buffer for the cards
  const cards = [];

  // Wait for the set select to be populated
  await page.waitForSelector(`${selectors.setSelect} option:not([value=""])`);

  const setSelect = await getCardSetSelector(page);

  // Get all options with non-empty value and that are not disabled
  const setOptions = (await page.evaluate((el) => {
    return Array.from(
      el.querySelectorAll('option:not([value=""]):not([disabled])')
    );
  }, setSelect)) as (Element & { config: { id: string; label: string } })[];

  // Loop through all the set options
  const scrapeSets = setOptions.map(async (setOption) => {
    const setId = setOption.config.id;
    /* eslint-disable */
    const setName = setOption.config.label
      .replace(/\s+\+kr\s+\d+,\d+/, '')
      .trim();
    /* eslint-enable */

    // Unselect the set to clear the card select
    await setSelect.select('');
    // Select the set
    await setSelect.select(setId);

    // Wait for the card select to be populated
    await page.waitForSelector(
      `${selectors.cardSelect} option:not([value=""])`
    );

    const cardSelect = await getCardSelector(page);

    // Get all options with non-empty value and that are not disabled
    const cardOptions = await page.evaluate((el) => {
      return Array.from(
        el.querySelectorAll('option:not([value=""]):not([disabled])')
      );
    }, cardSelect);

    // Loop through all the card options
    // eslint-disable-next-line @typescript-eslint/require-await
    const scrapeCards = cardOptions.map(async (cardOption) => {
      console.log(`Scraping card`, cardOption);
    });

    await Promise.all(scrapeCards);
  });

  await Promise.all(scrapeSets);

  cards.push({
    name,
    link: productUrl,
  });

  return cards;
}

async function getCardSetSelector(page: Page) {
  return required(await page.waitForSelector(selectors.setSelect));
}
async function getCardSelector(page: Page) {
  return required(await page.waitForSelector(selectors.cardSelect));
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getCardSurfaceSelector(page: Page) {
  return required(await page.waitForSelector(selectors.surfaceSelect));
}

async function scrapeProductName(page: Page) {
  const titleEl = required(await page.waitForSelector(selectors.title));
  const titleText = required(await titleEl.evaluate((el) => el.textContent));
  const title = titleText.replace('(Enkeltkort)', '').trim();
  await titleEl.dispose();
  return title;
}

export const cardScraperWorkerQueue = new WorkerQueue(scrapeCard);
