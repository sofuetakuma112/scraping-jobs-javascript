import { loadAllJobs } from "./util.js";

const hasContainWord = (word, description) => {
  const regexp = new RegExp(word, "i");
  return regexp.test(description);
};
const assignDescription = (description) => (word) =>
  hasContainWord(word, description);

export const filterJobs = async ({
  andWords,
  orWords,
  sortCriteria,
  sortDirection,
}) => {
  const jobs = await loadAllJobs();

  return jobs
    .filter(({ description, publishDate, establishmentDate }) => {
      const hasContainWordInDesc = assignDescription(description);
      if (sortCriteria === "publishDate" && !publishDate) return false;
      if (sortCriteria === "establishmentDate" && !establishmentDate)
        return false;
      const hasMatchedByWords =
        (andWords.length === 0 ? true : andWords.every(hasContainWordInDesc)) &&
        (orWords.length === 0 ? true : orWords.some(hasContainWordInDesc));
      return hasMatchedByWords;
    })
    .sort((a, b) => {
      const ASCENDING = "ascending";
      // const DESCENDING = "descending";
      const stringToDateTime = (date) => {
        if (date) return new Date(date).getTime();
        else return new Date("1900/01/01").getTime();
      };
      switch (sortCriteria) {
        case "entry":
          // 0 未満の場合、a を b より小さいインデックスにソート
          return sortDirection === ASCENDING
            ? Number(String(a.countOfEntry).replace(/,/g, "")) -
                Number(String(b.countOfEntry).replace(/,/g, ""))
            : Number(String(b.countOfEntry).replace(/,/g, "")) -
                Number(String(a.countOfEntry).replace(/,/g, ""));
        case "countOfView":
          return sortDirection === ASCENDING
            ? Number(String(a.view).replace(/,/g, "")) -
                Number(String(b.view).replace(/,/g, ""))
            : Number(String(b.view).replace(/,/g, "")) -
                Number(String(a.view).replace(/,/g, ""));
        case "publishDate":
          return sortDirection === ASCENDING
            ? stringToDateTime(a.publishDate) - stringToDateTime(b.publishDate)
            : stringToDateTime(b.publishDate) - stringToDateTime(a.publishDate);
        case "establishmentDate":
          return sortDirection === ASCENDING
            ? stringToDateTime(a.establishmentDate) -
                stringToDateTime(b.establishmentDate)
            : stringToDateTime(b.establishmentDate) -
                stringToDateTime(a.establishmentDate);
        case "countOfMember":
          const aCountOfMember = Number(a.countOfMember || 0);
          const bCountOfMember = Number(b.countOfMember || 0);
          if (sortDirection === ASCENDING) {
            return aCountOfMember - bCountOfMember;
          } else return bCountOfMember - aCountOfMember;
        default:
          return true;
      }
    });
};

const execFilterFunc = async () => {
  const filteredJobs = await filterJobs({
    andWords: ["react"],
    orWords: [],
  });
  return;

  let jobs = new Map();
  filteredJobs.forEach((jobInfo) => {
    const company = jobInfo.company;
    if (jobs.has(company)) {
      // 既存のobjectに追加
      const companyJobList = jobs.get(company);
      jobs.set(company, [...companyJobList, jobInfo]);
    } else jobs.set(company, [jobInfo]);
  });
  const jobsSplitByCompany = [];
  for (let [key, companyJobs] of jobs.entries()) {
    jobsSplitByCompany.push(companyJobs);
  }
  console.log(
    jobsSplitByCompany
      .map((companyJobs) =>
        companyJobs.map(
          ({ title, company, publishDate, url }) =>
            `(${publishDate})[${company}]${title}: ${url}`
        )
      )
      .map((companyJobs) => companyJobs[0])
  );
  console.log(jobsSplitByCompany.length);
};

// execFilterFunc();
