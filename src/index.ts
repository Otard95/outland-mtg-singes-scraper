import { createObjectCsvWriter } from 'csv-writer';
import { launch } from 'puppeteer';
import { StaticScraper } from 'scraperjs';
import asyncPool from 'tiny-async-pool';

import { cardScraperWorkerQueue } from './card-scraper';

const csvWriter = createObjectCsvWriter({
  path: './out.csv',
  header: [
    { id: 'name', title: 'Name' },
    { id: 'set', title: 'Set' },
    { id: 'surface', title: 'Surface' },
    { id: 'price', title: 'Price' },
    { id: 'stock', title: 'Stock' },
    { id: 'num', title: 'Card Number' },
    { id: 'link', title: 'Link' },
    { id: 'image', title: 'Image' },
  ],
});

function scrapeForProductUrls(url: string) {
  /* eslint-disable */
  return StaticScraper.create(url).scrape(function ($: any) {
    return $('.product-item-info')
      .map(function () {
        const pageMatch = url.match(/p=(\d+)/);
        const page = pageMatch ? pageMatch[1] : null;
        // @ts-ignore
        return [$(this).find('.product-item-name a').attr('href'), page];
      })
      .get();
  }) as Promise<[productUrl: string, page: string | null][]>;
  /* eslint-enable */
}

function loggingScrapeForProductUrls(url: string) {
  const pageMatch = url.match(/p=(\d+)/);
  const page = pageMatch ? pageMatch[1] : url;
  console.log(`Scraping products page '${page}'...`);
  return scrapeForProductUrls(url);
}

async function main() {
  // Setup puppeteer browser
  const browser = await launch({ headless: 'new' });

  // Create an array of all the page numbers
  const countPages = 185;
  const pages = Array.from(Array(countPages).keys()).map(
    (i) =>
      `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${
        i + 1
      }&product_list_limit=100`
  );
  // .map(i => `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${i + 1}&product_list_limit=40`)

  for await (const data of asyncPool(5, pages, loggingScrapeForProductUrls)) {
    data.forEach(([cardUrl, page]) => {
      cardScraperWorkerQueue.enqueue(browser, cardUrl, page);
    });
  }

  // cardScraperWorkerQueue.enqueue(
  //   browser,
  //   'https://www.outland.no/p-knight-of-the-ebon-legion-480000199636'
  // );

  await cardScraperWorkerQueue.finished();

  await browser.close();

  console.log('Finished scraping!');
  // console.log(cardScraperWorkerQueue.results.flat());
  console.log(
    `Writing ${cardScraperWorkerQueue.results.flat().length} cards to file...`
  );
  await csvWriter.writeRecords(cardScraperWorkerQueue.results);
  console.log('Done!');
}

main().then(() => {}, console.error);
