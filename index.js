import puppeteer from "puppeteer";
import {
  getTextContentFromElemHandler,
  getHrefFromElemHandler,
  getSrcFromElemHandler,
  autoScroll,
  sleep,
  range,
  formatDate,
  formatText,
  extractInfoFromDetailPage,
} from "./util.js";
import { createObjectCsvWriter } from "csv-writer";
import _ from "lodash";

const startTime = performance.now(); // 開始時間

// スクレイピング設定
const options = {
  headless: true,
};
const browser = await puppeteer.launch(options);
const page = await browser.newPage();

const userAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36";
page.setUserAgent(userAgent);
// page.setDefaultNavigationTimeout(0);

const startUrl =
  "https://www.wantedly.com/projects?type=recent&page=1&occupation_types%5B%5D=jp__engineering&hiring_types%5B%5D=internship&hiring_types%5B%5D=part_time";
// 以下の処理順だと page.waitForNavigation() を実行する前に page.click() によるページ遷移が終わっていることがあり、
// その場合、page.waitForNavigation()はページ遷移を待ち続けてタイムアウトしてしまいます。
// page.click('a');
// await page.waitForNavigation();
await Promise.all([
  page.goto(startUrl),
  page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
]);
await sleep(500);

const extractInfoFromSinglePage = async (page) => {
  const detailAnchorElems = await page.$$("#main .project-title a");
  const detailUrls = await Promise.all(
    detailAnchorElems.map((detailPageElem) =>
      getHrefFromElemHandler(detailPageElem)
    )
  );
  const nextPageAnchorElem = await page.$(".next a");
  const nextPageUrl = await getHrefFromElemHandler(nextPageAnchorElem);

  const subRecords = [];

  for await (const detailUrl of detailUrls) {
    const detailPageInfo = await extractInfoFromDetailPage(detailUrl, page);
    subRecords.push(detailPageInfo);
    await sleep(1000);
  }

  return [subRecords, nextPageUrl];
};

// CSV設定
const csvWriter = createObjectCsvWriter({
  path: "csv/wantedly.csv",
  header: [
    { id: "title", title: "title" },
    { id: "company", title: "company" },
    { id: "date", title: "date" },
    { id: "description", title: "description" },
    { id: "url", title: "url" },
  ],
});
let records = [];
let pageNum = 1;
while (true) {
  const notFoundElem = await page.$(".projects-not-found-wrapper");
  if (!!notFoundElem) {
    // 「検索結果が多すぎるようです」を検知
    break;
  }
  console.log(`${pageNum}ページ`);
  const [subRecords, nextPageUrl] = await extractInfoFromSinglePage(page);
  // 書き込み
  // records = [...records, ...subRecords];
  await csvWriter.writeRecords(subRecords);
  if (nextPageUrl) {
    await Promise.all([
      page.goto(nextPageUrl),
      page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
    ]);
    await sleep(500);
    pageNum += 1;
  } else break;
}

const endTime = performance.now(); // 終了時間
console.log((endTime - startTime) / 1000, " [s]"); // 何ミリ秒かかったかを表示する

await browser.close();
