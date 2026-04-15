const roundCurrency = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const formatTaxDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().split("T")[0];
};

const escapeCsvValue = (value) => {
  const normalized = String(value ?? "");

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

export const getTaxYearRange = (yearInput) => {
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(yearInput);
  const taxYear =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= currentYear + 1
      ? parsedYear
      : currentYear;

  return {
    taxYear,
    startDate: new Date(`${taxYear}-01-01T00:00:00.000Z`),
    endDate: new Date(`${taxYear + 1}-01-01T00:00:00.000Z`),
  };
};

export const toTaxPackRecord = (expense) => {
  const amount = roundCurrency(expense.amount);
  const deductiblePercent = expense.deductible
    ? roundCurrency(expense.deductiblePercent || 0)
    : 0;
  const deductibleAmount = expense.deductible
    ? roundCurrency((amount * deductiblePercent) / 100)
    : 0;

  return {
    id: expense._id?.toString?.() || "",
    date: formatTaxDate(expense.date),
    recipient: expense.recipient || "",
    category: expense.category || "Other",
    expenseType: expense.expenseType || "personal",
    taxCategory: expense.taxCategory || "",
    amount,
    deductible: Boolean(expense.deductible),
    deductiblePercent,
    deductibleAmount,
    hasReceipt: Boolean(expense.receiptUrl),
    receiptUrl: expense.receiptUrl || "",
    notes: expense.notes || "",
  };
};

export const buildTaxPack = ({ expenses, taxYear }) => {
  const records = expenses.map(toTaxPackRecord);
  const deductibleRecords = records.filter((record) => record.deductible);

  const trackedBusinessExpenseTotal = roundCurrency(
    records.reduce((sum, record) => sum + record.amount, 0)
  );

  const deductibleExpenseTotal = roundCurrency(
    deductibleRecords.reduce((sum, record) => sum + record.deductibleAmount, 0)
  );

  const missingReceiptCount = deductibleRecords.filter(
    (record) => !record.hasReceipt
  ).length;

  const needsReviewCount = records.filter((record) => {
    if (!record.taxCategory) {
      return true;
    }

    return record.deductible && !record.hasReceipt;
  }).length;

  const exportReadyCount = records.filter((record) => {
    if (!record.taxCategory) {
      return false;
    }

    if (record.deductible && !record.hasReceipt) {
      return false;
    }

    return true;
  }).length;

  const receiptCoveragePercent = deductibleRecords.length
    ? Math.round(
        ((deductibleRecords.length - missingReceiptCount) / deductibleRecords.length) * 100
      )
    : 100;

  const deductibleByCategory = Object.entries(
    deductibleRecords.reduce((accumulator, record) => {
      const key = record.taxCategory || "Unassigned";
      accumulator[key] = roundCurrency(
        (accumulator[key] || 0) + record.deductibleAmount
      );
      return accumulator;
    }, {})
  )
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((left, right) => right.amount - left.amount);

  return {
    taxYear,
    summary: {
      trackedExpenseCount: records.length,
      trackedBusinessExpenseTotal,
      deductibleTransactionCount: deductibleRecords.length,
      deductibleExpenseTotal,
      missingReceiptCount,
      needsReviewCount,
      exportReadyCount,
      receiptCoveragePercent,
      deductibleByCategory,
    },
    records,
  };
};

export const buildTaxPackCsv = ({ taxYear, records }) => {
  const header = [
    "Tax Year",
    "Date",
    "Vendor",
    "Category",
    "Expense Type",
    "Tax Category",
    "Amount",
    "Deductible",
    "Deductible Percent",
    "Deductible Amount",
    "Receipt Attached",
    "Receipt URL",
    "Notes",
  ];

  const rows = records.map((record) => [
    taxYear,
    record.date,
    record.recipient,
    record.category,
    record.expenseType,
    record.taxCategory,
    record.amount.toFixed(2),
    record.deductible ? "Yes" : "No",
    record.deductiblePercent.toFixed(2),
    record.deductibleAmount.toFixed(2),
    record.hasReceipt ? "Yes" : "No",
    record.receiptUrl,
    record.notes,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
};
