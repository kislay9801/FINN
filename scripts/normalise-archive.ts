import { readFile, writeFile } from "node:fs/promises";
import { parseArchive } from "../src/server/providers/announcements";
import { portfolio, candidates } from "../src/data/companies";
const records = JSON.parse(
  await readFile("src/data/nse-announcements.json", "utf8"),
);
const signals = parseArchive(
  records,
  [...portfolio, ...candidates],
  new Date().toISOString(),
);
await writeFile("src/data/archive-signals.json", JSON.stringify(signals));
console.log("Captured portfolio/ad-hoc archive:", signals.length, "signals");
