import puppeteer from "puppeteer";
import {
  getTextContentFromElemHandler,
  getHrefFromElemHandler,
  getSrcFromElemHandler,
  autoScroll,
  sleep,
  extractInfoFromDetailPage,
  createDistinguishedNameFromUrl,
  loadAndParseCsv,
  getCsvFileNameList,
} from "./util.js";
import { createObjectCsvWriter } from "csv-writer";
import _ from "lodash";
import fs from "fs";

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
page.setDefaultNavigationTimeout(60000);

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
await sleep(2000);

const extractInfoFromSinglePage = async (page, alreadyScrapedPageUrls) => {
  // 詳細ページへのURL一覧を取得
  const detailAnchorElems = await page.$$("#main .project-title a");
  const detailUrls = await Promise.all(
    detailAnchorElems.map((detailPageElem) =>
      getHrefFromElemHandler(detailPageElem)
    )
  );
  const detailUrlsNoQuery = detailUrls.map((url) => url.replace(/\?.*$/, ""));
  // スクレイピング済みのページURLを除外する
  const noScrapedPageUrl = detailUrlsNoQuery.filter(
    (url) => !alreadyScrapedPageUrls.includes(url)
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

      // 詳細ページURL
      const detailPageUrl = await getHrefFromElemHandler(titleElemHandler);

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
        url: detailPageUrl.replace(/\?.*$/, ""),
        // companyName,
        // detailUrl: detailUrls[i],
      };
    })
  );

  const jobDetails = [];
  for await (const detailUrl of noScrapedPageUrl) {
    const detailPageInfo = await extractInfoFromDetailPage(detailUrl, page);
    jobDetails.push(detailPageInfo);
    await sleep(1000);
  }

  // SummaryとDetailの合成
  const jobs = jobDetails.map((jobDetail, i) => {
    const foundJobSummary = jobSummaries.find(
      (jobSummary) => jobSummary.url === jobDetail.url
    );
    if (!foundJobSummary)
      throw Error("jobDetailのurlに一致するjobSummaryが見つからなかった");
    return {
      ...jobDetail,
      ...foundJobSummary,
    };
  });
  return [jobs, nextPageUrl];
};

const scraping = (page, alreadyScrapedPageUrls) => {
  return new Promise(async (resolve, reject) => {
    let pageNum = 1;
    while (true) {
      const notFoundElem = await page.$(".projects-not-found-wrapper");
      if (!!notFoundElem) {
        // 「検索結果が多すぎるようです」を検知
        break;
      }
      console.log(`${pageNum}ページ`);
      const [subRecords, nextPageUrl] = await extractInfoFromSinglePage(
        page,
        alreadyScrapedPageUrls
      );
      if (subRecords.length > 0) {
        await csvWriter.writeRecords(subRecords);
      }
      if (nextPageUrl) {
        await Promise.all([
          page.goto(nextPageUrl),
          page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
        ]);
        // ページ下までスクロール
        await autoScroll(page);
        await sleep(2000);
        pageNum += 1;
      } else break;
    }
    resolve();
  });
};

// スクレイピング済みのURL一覧を作る
const csvFilePaths = await getCsvFileNameList("./csv");
const listOfUrlListForEachCsv = await Promise.all(
  csvFilePaths.map(async (path) => {
    const jobsForLoadedCsv = await loadAndParseCsv(path);
    return jobsForLoadedCsv.map((job) => job.url);
  })
);
const alreadyScrapedPageUrlsWithDuplicates = listOfUrlListForEachCsv.reduce(
  (totalUrls, urls) => [...totalUrls, ...urls],
  []
);
const alreadyScrapedPageUrls = Array.from(
  new Set(alreadyScrapedPageUrlsWithDuplicates)
);

const csvFileName = `wantedly?${createDistinguishedNameFromUrl(startUrl)}`;
const filePath = `csv/${csvFileName}.csv`;
// CSV設定
const csvWriter = createObjectCsvWriter({
  path: filePath,
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
if (fs.existsSync(filePath)) { // csvの存在チェック
  const jobsFromCsv = await loadAndParseCsv(filePath); // 既存のcsvファイルを読み込む
  await csvWriter.writeRecords(jobsFromCsv); // スクレイピング前のCSVデータで書き込む
  await scraping(page, alreadyScrapedPageUrls);
} else {
  await scraping(page, alreadyScrapedPageUrls);
}

const endTime = performance.now(); // 終了時間
console.log((endTime - startTime) / 1000, " [s]"); // 何ミリ秒かかったかを表示する

await browser.close();
