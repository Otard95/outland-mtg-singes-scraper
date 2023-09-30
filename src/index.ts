import { load } from 'cheerio';
import { createObjectCsvWriter } from 'csv-writer';
import fetch from 'node-fetch';
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

type Product = { cardUrl: string | undefined; page: string | null };
async function scrapeForProductUrls(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  return $('.product-item-info')
    .map((_i, el) => {
      const pageMatch = url.match(/p=(\d+)/);
      const page = pageMatch ? pageMatch[1] : null;
      const cardUrl = $(el).find('.product-item-name a').attr('href');
      return { cardUrl, page };
    })
    .get() as Product[];
}

function loggingScrapeForProductUrls(url: string) {
  const pageMatch = url.match(/p=(\d+)/);
  const page = pageMatch ? pageMatch[1] : url;
  console.log(`Scraping products page '${page}'...`);
  return scrapeForProductUrls(url);
}

async function main() {
  // Create an array of all the page numbers
  const countPages = 185;
  const pages = Array.from(Array(countPages).keys()).map(
    (i) =>
      `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${
        i + 1
      }&product_list_limit=100`
  );
  // .map(
  //   (i) =>
  //     `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${
  //       i + 1
  //     }&product_list_limit=40`
  // );

  // Log progress every 5 seconds
  const interval = setInterval(() => {
    console.log(`[PROGRESS] ${cardScraperWorkerQueue.Queued} cards queued`);
  }, 5000);

  for await (const data of asyncPool(5, pages, loggingScrapeForProductUrls)) {
    data.forEach(({ cardUrl, page }) => {
      if (!cardUrl) return;
      cardScraperWorkerQueue.enqueue(cardUrl, page);
    });
  }

  // cardScraperWorkerQueue.enqueue(
  //   'https://www.outland.no/p-riverglide-pathway-480000219631',
  //   '1'
  // );
  // cardScraperWorkerQueue.enqueue(
  //   'https://www.outland.no/p-titanoth-rex-480000209960',
  //   '2'
  // );
  // cardScraperWorkerQueue.enqueue(
  //   'https://www.outland.no/p-fracturing-gust-480000105712',
  //   '2'
  // );

  // Wait for all cards to be scraped
  await cardScraperWorkerQueue.finished();

  // Stop logging progress
  clearInterval(interval);

  console.log('\nFinished scraping!');
  // console.log(cardScraperWorkerQueue.results.flat());
  console.log(
    `Writing ${cardScraperWorkerQueue.results.flat().length} cards to file...`
  );
  await csvWriter.writeRecords(cardScraperWorkerQueue.results.flat());
  console.log('Done!');
}

main().then(() => {}, console.error);
