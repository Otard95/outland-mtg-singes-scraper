/* eslint-disable @typescript-eslint/no-unused-vars */
import { createObjectCsvWriter } from 'csv-writer';
import { launch } from 'puppeteer';
import { StaticScraper } from 'scraperjs';
import asyncPool from 'tiny-async-pool';

import { cardScraperWorkerQueue } from './card-scraper';

const csvWriter = createObjectCsvWriter({
  path: './out.csv',
  header: [
    { id: 'name', title: 'Name' },
    { id: 'link', title: 'Link' },
    { id: 'set', title: 'Set' },
    { id: 'num', title: 'Card Number' },
    { id: 'surface', title: 'Surface' },
    { id: 'price', title: 'Price' },
    { id: 'image', title: 'Image' },
  ],
});

function scrapeForProductUrls(url: string) {
  /* eslint-disable */
  return StaticScraper.create(url).scrape(function ($: any) {
    return $('.product-item-info')
      .map(function () {
        // @ts-ignore
        return $(this).find('.product-item-name a').attr('href');
      })
      .get();
  }) as Promise<string[]>;
  /* eslint-enable */
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    data.forEach((cardUrl) => {
      cardScraperWorkerQueue.enqueue(browser, cardUrl);
    });
  }

  // cardScraperWorkerQueue.enqueue(
  //   browser,
  //   'https://www.outland.no/p-island-480000002875'
  // );

  await cardScraperWorkerQueue.finished();

  console.log('Done!');
  console.log(cardScraperWorkerQueue.results.flat());
  // await csvWriter.writeRecords(cardScraperWorkerQueue.results)

  await browser.close();
}

main().then(() => {}, console.error);
