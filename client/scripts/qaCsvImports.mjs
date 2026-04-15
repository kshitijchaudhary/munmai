import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCsvText } from "../src/utils/parseCsv.js";
import { buildReviewRows, guessMappings } from "../src/utils/importReview.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtures = [
  {
    name: "checking-sign-amount",
    file: "../fixtures/csv/checking-sign-amount.csv",
    importMode: "infer_sign",
    expectedReadyRows: 3,
    expectedExpenseRows: 2,
    expectedIncomeRows: 1,
  },
  {
    name: "credit-card-type-column",
    file: "../fixtures/csv/credit-card-type-column.csv",
    importMode: "type_column",
    expectedReadyRows: 3,
    expectedExpenseRows: 2,
    expectedIncomeRows: 1,
  },
  {
    name: "freelance-income",
    file: "../fixtures/csv/freelance-income.csv",
    importMode: "income_only",
    expectedReadyRows: 2,
    expectedExpenseRows: 0,
    expectedIncomeRows: 2,
  },
];

const runFixture = (fixture) => {
  const filePath = path.resolve(__dirname, fixture.file);
  const csvText = fs.readFileSync(filePath, "utf8");
  const parsed = parseCsvText(csvText);
  const reviewRows = buildReviewRows({
    rows: parsed.rows,
    mappings: guessMappings(parsed.headers),
    importMode: fixture.importMode,
  });

  const readyRows = reviewRows.filter((row) => row.issues.length === 0);
  const expenseRows = readyRows.filter((row) => row.type === "expense");
  const incomeRows = readyRows.filter((row) => row.type === "income");

  if (readyRows.length !== fixture.expectedReadyRows) {
    throw new Error(
      `${fixture.name}: expected ${fixture.expectedReadyRows} ready rows, got ${readyRows.length}`
    );
  }

  if (expenseRows.length !== fixture.expectedExpenseRows) {
    throw new Error(
      `${fixture.name}: expected ${fixture.expectedExpenseRows} expense rows, got ${expenseRows.length}`
    );
  }

  if (incomeRows.length !== fixture.expectedIncomeRows) {
    throw new Error(
      `${fixture.name}: expected ${fixture.expectedIncomeRows} income rows, got ${incomeRows.length}`
    );
  }

  console.log(
    `[csv:qa] ${fixture.name}: ok (${readyRows.length} ready, ${expenseRows.length} expense, ${incomeRows.length} income)`
  );
};

fixtures.forEach(runFixture);
