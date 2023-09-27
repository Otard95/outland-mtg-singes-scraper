const scraper = require('scraperjs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const asyncPool = require('tiny-async-pool')
const puppeteer = require('puppeteer')

let browser;

const WorkerQueue = require('./worker-queue')

const csvWriter = createCsvWriter({
  path: './out.csv',
  header: [
    { id: 'name', title: 'Name' },
    { id: 'price', title: 'Price' },
    { id: 'link', title: 'Link' },
    { id: 'image', title: 'Image' },
  ]
})

function scrapeForProductUrls(url) {
  return scraper.StaticScraper.create(url)
    .scrape(function ($) {
      return $('.product-item-info').map(function () {
        return $(this).find('.product-item-name a').attr('href')
      }).get()
    })
}

function loggingScrapeForProductUrls(url) {
  const page = url.match(/p=(\d+)/)[1]
  console.log(`Scraping products page '${page}'...`)
  return scrapeForProductUrls(url)
}

const cardScraperWorkerQueue = new WorkerQueue(async (productUrl) => {
  const product = new URL(productUrl).pathname.match(/p-(.+)-\d+/)[1]
  console.log(`Scraping product '${product}'...`)
  
  const page = await browser.newPage()
  await page.goto(productUrl)
  
  const titleEl = await page.waitForSelector('h1.page-title span')
  const title = await titleEl.evaluate(el => el.textContent)

  await page.close()

  return title
})

async function main() {
  // Setup puppeteer browser
  browser = await puppeteer.launch()

  // Create an array of all the page numbers
  const countPages = 1 // 185
  const pages = Array.from(Array(countPages).keys())
    // .map(i => `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${i + 1}&product_list_limit=100`)
    .map(i => `https://www.outland.no/samlekort-og-kortspill/magic-the-gathering/singles?available=1&p=${i + 1}&product_list_limit=40`)

  for await (const data of asyncPool(5, pages, loggingScrapeForProductUrls)) {
    data.forEach(cardUrl => {
      cardScraperWorkerQueue.enqueue(cardUrl)
    });
  }

  await cardScraperWorkerQueue.finished()

  console.log(cardScraperWorkerQueue.jobs)

  console.log('Done!')
  console.log(cardScraperWorkerQueue.results)
  // await csvWriter.writeRecords(cardScraperWorkerQueue.results)

  await browser.close()
}

main()
  .then(console.log, console.error)