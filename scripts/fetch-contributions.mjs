// Writes site/data.json: { start, counts[], levels[], total, updated }
// Uses the GitHub GraphQL API (CONTRIB_TOKEN or GITHUB_TOKEN), falling back to a public mirror.
import { writeFileSync } from "node:fs";

const user = process.env.GH_USER || "Tobbs2005";
const token = process.env.GH_TOKEN;
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fromGraphQL() {
  if (!token) throw new Error("no token");
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "contribution-valley" },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || r.status));
  return j.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 }));
}

async function fromMirror() {
  const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`);
  if (!r.ok) throw new Error("mirror " + r.status);
  return (await r.json()).contributions;
}

let days;
try { days = await fromGraphQL(); console.log("source: graphql"); }
catch (e) { console.warn("graphql failed:", e.message); days = await fromMirror(); console.log("source: mirror"); }

const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.TZ_NAME || "America/New_York" });
days = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
const out = {
  start: days[0].date,
  counts: days.map((d) => d.count),
  levels: days.map((d) => d.level),
  total: days.reduce((a, d) => a + d.count, 0),
  updated: new Date().toISOString(),
};
writeFileSync(new URL("../site/data.json", import.meta.url), JSON.stringify(out));
console.log(`wrote ${days.length} days from ${out.start}, total ${out.total}`);
