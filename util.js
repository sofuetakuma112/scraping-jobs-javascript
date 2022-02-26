import fs from "fs";
import * as csv from "csv";
import _ from "lodash";

export const getTextContentFromElemHandler = async (elementHandle) => {
  const textContentProperty = await elementHandle.getProperty("textContent");
  return textContentProperty.jsonValue();
};

export const getHrefFromElemHandler = async (elementHandle) => {
  const hrefProperty = await elementHandle.getProperty("href");
  return hrefProperty.jsonValue();
};

export const getSrcFromElemHandler = async (elementHandle) => {
  const srcProperty = await elementHandle.getProperty("src");
  return srcProperty.jsonValue();
};

export const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 10);
    });
  });
};

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const range = (length) => Array.from({ length }, (v, i) => i);

export const formatDate = (
  date,
  regex = /[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])/
) => {
  const found = date.match(regex);
  if (found) {
    return found[0];
  } else return "1900/01/01";
};

export const formatText = (text) => {
  return text
    .split(/\n/)
    .filter((line) => line)
    .join("\n");
};

export const createDistinguishedNameFromUrl = (url) => {
  const params = new URLSearchParams(url.slice(url.indexOf("?"), url.length));
  let text = "";
  for (const [key, value] of params.entries()) {
    if (key !== "page") {
      text += `${key}=${value}&`;
    }
  }
  text = text.slice(0, text.length - 1);
  return text.replace(/\[\]/g, "");
};

export const extractInfoFromDetailPage = async (detailUrl, page) => {
  console.log(detailUrl);
  await Promise.all([
    page.goto(detailUrl),
    page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
  ]);
  const titleSuggestionsElem1 = await page.$(".project-title.new-style");
  const titleSuggestionsElem2 = await page.$(".project-info > .project-title");
  const titleElem = titleSuggestionsElem1 || titleSuggestionsElem2;

  const companySuggestionsElem1 = await page.$(".new-style.company-link");
  const companySuggestionsElem2 = await page.$(
    ".company-title-section > .company-name"
  );
  const companyElem = companySuggestionsElem1 || companySuggestionsElem2;

  let establishmentDateElem;
  try {
    establishmentDateElem = await page.$(
      ".company-icon.icon-flag ~ .company-description"
    );
  } catch {
    establishmentDateElem = null;
  }

  let memberElem;
  try {
    memberElem = await page.$(
      ".company-icon.icon-group ~ .company-description"
    );
  } catch {
    memberElem = null;
  }

  let locationElem;
  try {
    locationElem = await page.$(
      ".company-icon.wt-icon.wt-icon-location ~ .company-description"
    );
  } catch {
    locationElem = null;
  }

  const separatedElems = await page.$$(".header-tags-right .separated");
  const descriptionElem = await page.$(".js-descriptions ");

  const entryElem = await page.$(".entry-info");

  const title = (await getTextContentFromElemHandler(titleElem)).trim();
  const company = (await getTextContentFromElemHandler(companyElem)).trim();

  let establishmentDate;
  if (establishmentDateElem) {
    const establishmentDateText = (
      await getTextContentFromElemHandler(establishmentDateElem)
    ).trim();
    establishmentDate = formatDate(
      establishmentDateText,
      /[0-9]{4}\/(0[1-9]|1[0-2])/
    );
  }

  let countOfMember;
  if (memberElem) {
    const member = (await getTextContentFromElemHandler(memberElem)).trim();
    countOfMember = member.slice(0, member.indexOf("人"));
  }

  let location;
  if (locationElem) {
    location = (await getTextContentFromElemHandler(locationElem)).trim();
  }

  let publishDateText;
  try {
    publishDateText = (
      await getTextContentFromElemHandler(separatedElems[0])
    ).trim();
  } catch {
    publishDateText = "";
  }
  const publishDate = formatDate(publishDateText);

  let viewText
  try {
    viewText = (
      await getTextContentFromElemHandler(separatedElems[1])
    ).trim().replace(/,/g, "");
  } catch {
    viewText = null
  }
  const view = viewText && viewText.slice(0, viewText.indexOf("views")).trim();

  const description = (
    await getTextContentFromElemHandler(descriptionElem)
  ).trim();
  const formattedDesc = formatText(description);

  const entry = (await getTextContentFromElemHandler(entryElem)).trim().replace(/,/g, "");
  const countOfEntry = entry.slice(0, entry.indexOf("人"));

  console.log(title);

  return {
    title,
    company,
    establishmentDate,
    countOfMember,
    location,
    publishDate,
    view,
    countOfEntry,
    description: formattedDesc,
    url: detailUrl,
  };
};

export const loadAndParseCsv = (filePath) => {
  let rows = [];
  const parser = csv.parse({ columns: true }, function (err, data) {
    rows = [...rows, ...data];
  });
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath).pipe(parser);

    parser.on("end", function () {
      resolve(rows);
    });
  });
};

export const loadAllJobs = async () => {
  const csvFilePaths = await getCsvFileNameList("./csv");
  const listOfJobListForEachCsv = await Promise.all(
    csvFilePaths.map((path) => loadAndParseCsv(path))
  );
  return _.uniqBy(
    listOfJobListForEachCsv.reduce(
      (totalJobs, jobsForCsv) => [...totalJobs, ...jobsForCsv],
      []
    ),
    "url"
  );
};

export const getCsvFileNameList = (directoryPath) => {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, function (err, files) {
      if (err) reject(err);
      const fullPaths = files.map((file) => `${directoryPath}/${file}`);
      const fileList = fullPaths.filter(
        (file) => fs.statSync(file).isFile() && /.*\.csv$/.test(file)
      ); //絞り込み

      resolve(fileList);
    });
  });
};
