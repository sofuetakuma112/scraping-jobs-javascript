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

// スクレイピング設定
const options = {
  headless: false,
};
const browser = await puppeteer.launch(options);
const page = await browser.newPage();

const userAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36";
page.setUserAgent(userAgent);

const info = await extractInfoFromDetailPage(
  "https://www.wantedly.com/projects/190011",
  page
);

console.log(info);

await browser.close();
