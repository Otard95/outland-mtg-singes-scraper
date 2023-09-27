import fetch from 'node-fetch';
import { Browser, Page } from 'puppeteer';

import { required } from './required';
import { WorkerQueue } from './worker-queue';

interface Card {
  name: string;
  link: string;
  set: string;
  num: string;
  surface: string;
  price: string;
  image: string;
  stock: string;
}
interface StoreStock {
  name: string;
  qty: number;
}
type StoreStockResponse = StoreStock[];

const selectors = {
  title: 'h1.page-title span',
  price: 'span.price',
  image: 'img.no-sirv-lazy-load',
  setSelect: 'select#attribute471',
  cardSelect: 'select#attribute479',
  surfaceSelect: 'select#attribute473',
};

async function scrapeCard(
  browser: Browser,
  productUrl: string,
  fromPage: string | null
) {
  const productNameMatch = new URL(productUrl).pathname.match(/p-(.+)-\d+/);
  const product = productNameMatch ? productNameMatch[1] : productUrl;
  console.log(
    `Scraping product '${product}${
      fromPage ? ` from page ${fromPage}` : ''
    }'...`
  );

  // Open a new page and navigate to the product
  const page = await browser.newPage();
  await page.goto(productUrl);

  const name = await scrapeProductName(page);

  const cards = await scrapeCardSets(name, productUrl, page);

  await page.close();

  return cards;
}

async function scrapeCardSets(
  name: string,
  productUrl: string,
  page: Page
): Promise<Card[]> {
  // Create a buffer for the cards
  const cardBuffer: Card[] = [];

  // Wait for the set select to be populated
  try {
    await page.waitForSelector(`${selectors.setSelect} option:not([value=""])`);
  } catch (error) {
    console.log(`No sets found for product '${name}'`);
    return cardBuffer;
  }

  const setSelect = await getSetSelector(page);

  // Get all options with non-empty value and that are not disabled
  const setOptions = (await page.evaluate((el) => {
    return Array.from(
      el.querySelectorAll('option:not([value=""]):not([disabled])')
    );
  }, setSelect)) as (Element & { config: { id: string; label: string } })[];

  // Loop through all the set options
  for (const setOption of setOptions) {
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

    const cards = await scrapeCardVariants(name, productUrl, setName, page);
    cardBuffer.push(...cards);
  }

  cardBuffer.push({
    name,
    link: productUrl,
    set: 'N/A',
    num: 'N/A',
    surface: 'N/A',
    price: 'N/A',
    image: 'N/A',
    stock: 'N/A',
  });

  return cardBuffer;
}

async function scrapeCardVariants(
  name: string,
  productUrl: string,
  setName: string,
  page: Page
): Promise<Card[]> {
  const cardBuffer: Card[] = [];

  // Wait for the card select to be populated
  await page.waitForSelector(`${selectors.cardSelect} option:not([value=""])`);

  const cardSelect = await getCardSelector(page);

  // Get all options with non-empty value and that are not disabled
  const cardOptions = (await page.evaluate((el) => {
    return Array.from(
      el.querySelectorAll('option:not([value=""]):not([disabled])')
    );
  }, cardSelect)) as (Element & { config: { id: string; label: string } })[];

  // Loop through all the card options
  for (const cardOption of cardOptions) {
    const cardId = cardOption.config.id;
    const cardNumber = cardOption.config.label
      .replace(/\s+\+kr\s+\d+,\d+/, '')
      .trim();

    // Unselect the card to clear the surface select
    await cardSelect.select('');
    // Select the card
    await cardSelect.select(cardId);

    const cards = await scrapeCardSurfaces(
      name,
      productUrl,
      setName,
      cardNumber,
      page
    );
    cardBuffer.push(...cards);
  }

  return cardBuffer;
}

async function scrapeCardSurfaces(
  name: string,
  productUrl: string,
  setName: string,
  cardNumber: string,
  page: Page
): Promise<Card[]> {
  const cardBuffer: Card[] = [];

  // Wait for the surface select to be populated
  await page.waitForSelector(
    `${selectors.surfaceSelect} option:not([value=""])`
  );

  const surfaceSelect = await getCardSurfaceSelector(page);

  // Get all options with non-empty value and that are not disabled
  const surfaceOptions = (await page.evaluate((el) => {
    return Array.from(
      el.querySelectorAll('option:not([value=""]):not([disabled])')
    );
  }, surfaceSelect)) as (Element & { config: { id: string; label: string } })[];

  // Loop through all the surface options
  for (const surfaceOption of surfaceOptions) {
    const surfaceId = surfaceOption.config.id;
    const surfaceName = surfaceOption.config.label
      .replace(/\s+\+kr\s+\d+,\d+/, '')
      .trim();

    // Select the surface
    await surfaceSelect.select(surfaceId);

    const [priceEl, imageEl] = await Promise.all([
      page.$(selectors.price),
      page.$(selectors.image),
    ]);
    const [price, image] = await Promise.all([
      priceEl?.evaluate((el) => el.textContent),
      imageEl?.evaluate((el) => el.getAttribute('src')),
    ]);

    const idEl = await page.$('input[name="selected_configurable_option"]');
    const id = await idEl?.evaluate((el) => el.getAttribute('value'));

    const stockResponse = await fetch(
      `https://www.outland.no/rest/V1/clickandcollect/storesInfo?productId=${id}`,
      { timeout: 10000 }
    );
    const stock = (await stockResponse.json()) as StoreStockResponse;
    const quantity = stock.find((s) => s.name === 'Oslo')?.qty;

    cardBuffer.push({
      name,
      link: productUrl,
      set: setName,
      num: cardNumber,
      surface: surfaceName,
      price: required(price).replace(/kr\s+/, '').trim(),
      image: required(image),
      stock: required(quantity).toString(),
    });
  }

  return cardBuffer;
}

async function getSetSelector(page: Page) {
  return required(await page.waitForSelector(selectors.setSelect));
}
async function getCardSelector(page: Page) {
  return required(await page.waitForSelector(selectors.cardSelect));
}
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

export const cardScraperWorkerQueue = new WorkerQueue(scrapeCard, 15);
