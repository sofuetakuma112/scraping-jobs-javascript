import fs from "fs";
import * as csv from "csv";
import _ from "lodash";

// TODO: 大文字小文字に対応
const hasContainWord = (word, description) => {
  const regexp = new RegExp(word, "i");
  return regexp.test(description);
};
// カリー化
// クロージャを利用している
const assignDescription = (description) => (word) =>
  hasContainWord(word, description);

fs.createReadStream("./csv/wantedly.csv").pipe(
  csv.parse({ columns: true }, function (err, data) {
    const andWords = ["React", "フロントエンド"];
    const orWords = ["リモート", "テレワーク", "在宅", "東京"];
    const filteredJobInfos = data.filter(
      ({ title, company, date, description, url }) => {
        const hasContainWordDesc = assignDescription(description);
        return (
          (andWords.length === 0 ? true : andWords.every(hasContainWordDesc)) &&
          (orWords.length === 0 ? true : orWords.some(hasContainWordDesc))
        );
      }
    );
    let jobs = new Map();
    filteredJobInfos.forEach((jobInfo) => {
      const company = jobInfo.company;
      if (jobs.has(company)) {
        // 既存のobjectに追加
        const companyJobList = jobs.get(company);
        jobs.set(company, [...companyJobList, jobInfo]);
      } else jobs.set(company, [jobInfo]);
    });
    // const duplicateDeletion = _.uniqBy(filtered, "company");
    // console.log(
    //   duplicateDeletion.map(
    //     ({ title, company, date, url }) =>
    //       `(${date})[${company}]${title}: ${url}`
    //   )
    // );
    // console.log(`hit: ${duplicateDeletion.length}`);
    const jobsSplitByCompany = [];
    for (let [key, companyJobs] of jobs.entries()) {
      jobsSplitByCompany.push(companyJobs);
    }
    console.log(
      jobsSplitByCompany.map((companyJobs) =>
        companyJobs.map(
          ({ title, company, date, url }) =>
            `(${date})[${company}]${title}: ${url}`
        )
      ).map(companyJobs => companyJobs[0])
    );
  })
);
