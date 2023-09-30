import { ValidationError, arrayOf, int, object, string } from 'checkeasy';
import { load } from 'cheerio';

import { magentoInitJSONSchema, magentoSpConfigSchema } from './magento-schema';
import { createFileLogger } from './utils/fileLogger';
import { matchesSchema } from './utils/matchesSchema';
import { createFetch } from './utils/retryFetch';
import { ValidatorOf } from './utils/validatorOf';
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
interface Meta {
  fromPage: string | null;
  fromPageText: string;
  product: string;
}

const logError = createFileLogger('error.log', { linePrefix: '[CardScraper]' });
const fetch = createFetch();

export const cardScraperWorkerQueue = new WorkerQueue(scrapeCard, 10);

const storeStockResponseSchema = arrayOf(
  object(
    {
      name: string(),
      qty: int(),
    },
    { ignoreUnknown: true }
  )
);

const setAttributeId = '471';
const cardNumberAttributeId = '479';
const surfaceAttributeId = '473';

async function scrapeCard(productUrl: string, fromPage: string | null) {
  const productNameMatch = productUrl.match(/p-(.+)-\d+/);
  const product = productNameMatch ? productNameMatch[1] : productUrl;
  const fromPageText = fromPage ? ` from page ${fromPage}` : '';
  console.log(`Scraping product '${product}'${fromPageText}...`);

  // Fetch the product page
  let html: string;
  try {
    const res = await fetch(productUrl, { timeout: 10000 });
    html = await res.text();
  } catch (error) {
    logError(
      `Failed to fetch product '${product}' (${productUrl})${fromPageText}`
    );
    return [];
  }

  // Load the product page into cheerio
  const $ = load(html);

  // Now find all `<script type="text/x-magento-init">` elements
  const magentoInitScripts = $('script[type="text/x-magento-init"]');

  // Find the script that contains the product data (JSON)
  const productDataScript = magentoInitScripts
    .map((_i, el) => tryParseElementContentAsJSON($, el))
    .get()
    .find((script): script is ValidatorOf<typeof magentoInitJSONSchema> => {
      return matchesSchema(script, magentoInitJSONSchema);
    });

  // If no product data script was found, return an empty array
  if (!productDataScript) {
    logError(
      `No product data script found for product '${product}' (${productUrl})${fromPageText}`
    );
    return [];
  }
  const { spConfig } =
    productDataScript['#product_addtocart_form'].configurable;

  // Get the salable product ids
  const salableProductIds = Object.values(spConfig.salable)
    .map((obj) => Object.values(obj).flat())
    .flat()
    .filter((id, i, arr) => arr.indexOf(id) === i);

  // We get the card name here as its more easily accessible from the root of
  // the product page
  const cardName = $('h1.page-title span.base')
    .text()
    .replace('(Enkeltkort)', '')
    .trim();

  // Validate that we have the card name
  if (!cardName) {
    logError(
      `No card name found for product '${product}' (${productUrl})${fromPageText}`
    );
    return [];
  }

  // Convert the salable product ids to cards
  const cards = await convertProductIdsToCards(
    cardName,
    productUrl,
    spConfig,
    salableProductIds,
    { fromPage, fromPageText, product }
  );

  return cards;
}

async function convertProductIdsToCards(
  cardName: string,
  productUrl: string,
  spConfig: ValidatorOf<typeof magentoSpConfigSchema>,
  salableProductIds: string[],
  meta: Meta
): Promise<Card[]> {
  const convertProductIdToCardWorkerQueue = new WorkerQueue(
    convertProductIdToCard
  );

  salableProductIds.forEach((id) =>
    convertProductIdToCardWorkerQueue.enqueue(
      cardName,
      productUrl,
      spConfig,
      id,
      meta
    )
  );

  await convertProductIdToCardWorkerQueue.finished();

  return convertProductIdToCardWorkerQueue.results.filter(
    (card): card is Card => card !== null
  );
}

async function convertProductIdToCard(
  cardName: string,
  productUrl: string,
  spConfig: ValidatorOf<typeof magentoSpConfigSchema>,
  salableProductId: string,
  { fromPageText, product }: Meta
): Promise<Card | null> {
  const { attributes, index, optionPrices, magictoolbox } = spConfig;

  // Find the attributes that the product is sorted under
  const indexEntry = index[salableProductId];

  // Find the attribute options ids that the product is categorized under
  const setOptionId = indexEntry[setAttributeId];
  const cardNumberOptionId = indexEntry[cardNumberAttributeId];
  const surfaceOptionId = indexEntry[surfaceAttributeId];

  // Get the attribute option names from the attribute option ids
  const setOptionName = attributes[setAttributeId].options.find(
    (set) => set.id === setOptionId
  )?.label;
  const cardNumberOptionName = attributes[cardNumberAttributeId].options.find(
    (num) => num.id === cardNumberOptionId
  )?.label;
  const surfaceOptionName = attributes[surfaceAttributeId].options.find(
    (surface) => surface.id === surfaceOptionId
  )?.label;

  // Validate that we have all the required data
  if (!setOptionName || !cardNumberOptionName || !surfaceOptionName) {
    logError(
      `Missing set, card number or surface for product id '${salableProductId}' for product '${product}' (${productUrl})${fromPageText}`,
      JSON.stringify(
        {
          salableProductId,
          setOptionId,
          cardNumberOptionId,
          surfaceOptionId,
        },
        null,
        2
      )
    );
    return null;
  }

  // Get the price of the product
  const price = optionPrices[salableProductId].finalPrice.amount;

  // Get the image of the product
  const imageHtml = magictoolbox.galleryData[salableProductId];
  const $ = load(imageHtml);
  const image = $('a.mt-thumb-switcher img').attr('src') || '';

  // Get the stock of the product
  try {
    const res = await fetch(
      `https://www.outland.no/rest/V1/clickandcollect/storesInfo?productId=${salableProductId}`,
      { timeout: 10000 }
    );
    const storeStockPayload = (await res.json()) as unknown;
    const storeStock = storeStockResponseSchema(
      storeStockPayload,
      'storeStock'
    );

    // Get the stock for 'Oslo'
    const osloStock = storeStock.find((store) => store.name === 'Oslo');

    // Validate that we have the stock
    if (!osloStock) {
      logError(
        `Missing stock for product id ${salableProductId} - '${product}' (${productUrl})${fromPageText}`,
        JSON.stringify(
          {
            salableProductId,
            setOptionId,
            cardNumberOptionId,
            surfaceOptionId,
          },
          null,
          2
        )
      );
      return null;
    }

    return {
      name: cardName,
      link: productUrl,
      set: setOptionName,
      num: cardNumberOptionName,
      surface: surfaceOptionName,
      price: price.toString(),
      image,
      stock: osloStock.qty.toString(),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      logError(
        `Stock response was invalid for product id ${salableProductId} - '${product}' (${productUrl})${fromPageText} | error:`,
        error.message,
        '  |  ',
        JSON.stringify(
          {
            salableProductId,
            setOptionId,
            cardNumberOptionId,
            surfaceOptionId,
          },
          null,
          2
        )
      );
    } else {
      logError(
        `Failed to fetch stock for product id ${salableProductId} - '${product}' (${productUrl})${fromPageText}`
      );
    }
    return null;
  }
}

function tryParseElementContentAsJSON(
  $: cheerio.Root,
  element: cheerio.Element
) {
  const script = $(element).html();
  if (!script) return null;
  try {
    const json = JSON.parse(script) as unknown;
    return json;
  } catch (error) {
    return null;
  }
}
