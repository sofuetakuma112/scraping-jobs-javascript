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
// ページ下までスクロール
await autoScroll(page);
await sleep(1000);

const extractInfoFromSinglePage = async (page) => {
  // 詳細ページへのURL一覧を取得
  const detailAnchorElems = await page.$$("#main .project-title a");
  const detailUrls = await Promise.all(
    detailAnchorElems.map((detailPageElem) =>
      getHrefFromElemHandler(detailPageElem)
    )
  );
  // 次ページのURLを取得
  const nextPageAnchorElem = await page.$(".next a");
  const nextPageUrl = await getHrefFromElemHandler(nextPageAnchorElem);

  // 案件一覧からSummaryデータを抽出
  const articleElems = await page.$$("article.projects-index-single");
  const jobSummaries = await Promise.all(
    articleElems.map(async (elem, i) => {
      // アイキャッチ画像URL
      let eyecatchImgSrc = "";
      try {
        const imgElemHandler = await elem.$(".cover-image > img");
        eyecatchImgSrc = await getSrcFromElemHandler(imgElemHandler);
      } catch (error) {
        eyecatchImgSrc = "";
      }

      // タグ
      const tagElemHandlers = await elem.$$(".project-tag");
      const tags = (
        await Promise.all(
          tagElemHandlers.map((elem) => getTextContentFromElemHandler(elem))
        )
      ).map((tag) => tag.trim());

      // 案件名
      const titleElemHandler = await elem.$(".project-title > a");
      const title = (
        await getTextContentFromElemHandler(titleElemHandler)
      ).trim();

      // 要約分
      const summaryElemHandler = await elem.$(".project-excerpt");
      const summary = (
        await getTextContentFromElemHandler(summaryElemHandler)
      ).trim();

      // アイキャッチ画像URL
      let companyThumbnailImgSrc = "";
      try {
        const imgElemHandler = await elem.$(".company-thumbnail > a > img");
        companyThumbnailImgSrc = await getSrcFromElemHandler(imgElemHandler);
      } catch (error) {
        companyThumbnailImgSrc = "";
      }

      // 会社名
      const companyNameElemHandler = await elem.$(".company-name > h3 > a");
      const companyName = (
        await getTextContentFromElemHandler(companyNameElemHandler)
      ).trim();

      return {
        eyecatchImgSrc,
        // jobTitle,
        summary,
        companyThumbnailImgSrc,
        tags: tags.join(", "),
        // companyName,
        // detailUrl: detailUrls[i],
      };
    })
  );

  const jobDetails = [];
  for await (const detailUrl of detailUrls) {
    const detailPageInfo = await extractInfoFromDetailPage(detailUrl, page);
    jobDetails.push(detailPageInfo);
    await sleep(1000);
  }

  // SummaryとDetailの合成
  const jobs = jobDetails.map((_, i) => ({
    ...jobSummaries[i],
    ...jobDetails[i],
  }));
  return [jobs, nextPageUrl];
};

// CSV設定
const csvWriter = createObjectCsvWriter({
  path: "csv/wantedly.csv",
  header: [
    { id: "title", title: "title" },
    { id: "company", title: "company" },
    { id: "establishmentDate", title: "establishmentDate" },
    { id: "countOfMember", title: "countOfMember" },
    { id: "location", title: "location" },
    { id: "publishDate", title: "publishDate" },
    { id: "view", title: "view" },
    { id: "countOfEntry", title: "countOfEntry" },
    { id: "description", title: "description" },
    { id: "summary", title: "summary" },
    { id: "tags", title: "tags" },
    { id: "url", title: "url" },
    { id: "eyecatchImgSrc", title: "eyecatchImgSrc" },
    { id: "companyThumbnailImgSrc", title: "companyThumbnailImgSrc" },
  ],
});
let pageNum = 1;
while (true) {
  const notFoundElem = await page.$(".projects-not-found-wrapper");
  if (!!notFoundElem) {
    // 「検索結果が多すぎるようです」を検知
    break;
  }
  console.log(`${pageNum}ページ`);
  const [subRecords, nextPageUrl] = await extractInfoFromSinglePage(page);
  await csvWriter.writeRecords(subRecords);
  if (nextPageUrl) {
    await Promise.all([
      page.goto(nextPageUrl),
      page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
    ]);
    // ページ下までスクロール
    await autoScroll(page);
    await sleep(1000);
    pageNum += 1;
  } else break;
}

const endTime = performance.now(); // 終了時間
console.log((endTime - startTime) / 1000, " [s]"); // 何ミリ秒かかったかを表示する

await browser.close();
