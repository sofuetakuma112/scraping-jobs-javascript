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

export const extractInfoFromDetailPage = async (detailUrl, page) => {
  const urlNoQuery = detailUrl.replace(/\?.*$/, "");
  console.log(urlNoQuery);
  await Promise.all([
    page.goto(urlNoQuery),
    page.waitForNavigation({ waitUntil: ["load", "networkidle2"] }),
  ]);
  const titleSuggestionsElem1 = await page.$(".project-title.new-style");
  const titleSuggestionsElem2 = await page.$(".project-title");
  const titleElem = titleSuggestionsElem1 || titleSuggestionsElem2;

  const companySuggestionsElem1 = await page.$(".new-style.company-link");
  const companySuggestionsElem2 = await page.$(".company-name");
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

  const publishDateText = (await getTextContentFromElemHandler(separatedElems[0])).trim();
  const publishDate = formatDate(publishDateText);

  const viewText = (
    await getTextContentFromElemHandler(separatedElems[1])
  ).trim();
  const view = viewText.slice(0, viewText.indexOf("views")).trim();

  const description = (
    await getTextContentFromElemHandler(descriptionElem)
  ).trim();
  const formattedDesc = formatText(description);

  const entry = (await getTextContentFromElemHandler(entryElem)).trim();
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
    url: urlNoQuery,
  };
};
