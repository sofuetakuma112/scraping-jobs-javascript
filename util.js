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

export const formatDate = (date) => {
  const regex = /[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])/;
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
  const titleSuggestions1 = await page.$(".project-title.new-style");
  const titleSuggestions2 = await page.$(".project-title");
  const title = titleSuggestions1 || titleSuggestions2;

  const companySuggestions1 = await page.$(".new-style.company-link");
  const companySuggestions2 = await page.$(".company-name");
  const company = companySuggestions1 || companySuggestions2;

  const date = await page.$(".header-tags-right .separated");
  const description = await page.$(".js-descriptions ");

  const titleText = (await getTextContentFromElemHandler(title)).trim();
  const companyText = (await getTextContentFromElemHandler(company)).trim();
  const dateText = (await getTextContentFromElemHandler(date)).trim();
  const formattedDate = formatDate(dateText);
  const descriptionText = (
    await getTextContentFromElemHandler(description)
  ).trim();
  const formattedDescText = formatText(descriptionText);

  console.log(titleText);

  return {
    title: titleText,
    company: companyText,
    date: formattedDate,
    description: formattedDescText,
    url: urlNoQuery,
  };
};
