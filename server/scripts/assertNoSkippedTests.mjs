import { readFile } from "node:fs/promises";

const reportPath = process.argv[2];

if (!reportPath) {
  throw new Error("A Node TAP report path is required.");
}

const report = await readFile(reportPath, "utf8");

if (!report.trim()) {
  throw new Error("The Node TAP report is empty.");
}

const skippedSummaries = [
  ...report.matchAll(/^# skipped ([0-9]+)\s*$/gm),
];

if (skippedSummaries.length !== 1) {
  throw new Error(
    `Expected one Node TAP skipped summary, found ${skippedSummaries.length}.`,
  );
}

const skippedCount = Number(skippedSummaries[0][1]);

if (skippedCount !== 0) {
  throw new Error(`Backend CI detected ${skippedCount} skipped test(s).`);
}

console.log("Backend TAP report confirms zero skipped tests.");
