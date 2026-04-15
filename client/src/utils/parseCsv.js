const ensureUniqueHeaders = (headers) => {
  const counts = new Map();

  return headers.map((header, index) => {
    const baseHeader = String(header || "").trim() || `Column ${index + 1}`;
    const seenCount = counts.get(baseHeader) || 0;

    counts.set(baseHeader, seenCount + 1);

    if (seenCount === 0) {
      return baseHeader;
    }

    return `${baseHeader} (${seenCount + 1})`;
  });
};

export const parseCsvText = (input) => {
  const text = String(input || "").replace(/^\uFEFF/, "");
  const parsedRows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      parsedRows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    parsedRows.push(currentRow);
  }

  const nonEmptyRows = parsedRows.filter((row) =>
    row.some((cell) => String(cell || "").trim() !== "")
  );

  if (!nonEmptyRows.length) {
    return { headers: [], rows: [] };
  }

  const headers = ensureUniqueHeaders(nonEmptyRows[0]);
  const rows = nonEmptyRows.slice(1).map((cells) =>
    headers.reduce((record, header, index) => {
      record[header] = String(cells[index] ?? "").trim();
      return record;
    }, {})
  );

  return { headers, rows };
};
