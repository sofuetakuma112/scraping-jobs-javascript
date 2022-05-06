import express from "express";
import cors from "cors";
import { filterJobs } from "./filter.js";
import { loadAllJobs } from "./util.js";
const app = express();
const port = 3001;

app.use(cors());

app.get("/", async (req, res) => {
  const jobs = await loadAllJobs();
  res.send(jobs.map((job) => [job]));
});

app.get("/filter", async (req, res) => {
  const andWord = req.query.andWord || "";
  const orWord = req.query.orWord || "";
  const sortCriteria = req.query.sortCriteria || "";
  const sortDirection = req.query.sortDirection || "";
  const shouldSummarizeByCompany =
    req.query.shouldSummarizeByCompany === "true" ? true : false;
  const searchCondition = {
    andWords: andWord.split(/\s+/),
    orWords: orWord.split(/\s+/),
    sortCriteria,
    sortDirection,
    shouldSummarizeByCompany,
  };
  const filteredJobs = await filterJobs(searchCondition);

  res.send(filteredJobs);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
