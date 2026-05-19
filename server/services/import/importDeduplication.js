import crypto from "crypto";

const normalizeText = (value) => String(value ?? "").trim();

export const normalizeDescriptionForHash = (value) =>
  normalizeText(value).toLowerCase().replace(/\s+/g, " ");

export const amountToCents = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return NaN;
  }

  return Math.round(amount * 100);
};

export const createUtcNoonDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

export const normalizeDateOnly = (value) => {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, "0"),
      String(value.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  const rawValue = normalizeText(value);
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    return [
      slashMatch[3],
      slashMatch[1].padStart(2, "0"),
      slashMatch[2].padStart(2, "0"),
    ].join("-");
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return [
    parsedDate.getUTCFullYear(),
    String(parsedDate.getUTCMonth() + 1).padStart(2, "0"),
    String(parsedDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

export const dateOnlyToUtcNoonDate = (value) => {
  const dateOnly = normalizeDateOnly(value);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return createUtcNoonDate(Number(match[1]), Number(match[2]), Number(match[3]));
};

export const createImportHash = ({ userId, date, type, amount, description }) => {
  const normalizedType = normalizeText(type).toLowerCase();
  const dateOnly = normalizeDateOnly(date);
  const amountCents = amountToCents(amount);
  const normalizedDescription = normalizeDescriptionForHash(description);

  if (
    !userId ||
    !dateOnly ||
    !["income", "expense"].includes(normalizedType) ||
    !Number.isFinite(amountCents) ||
    !normalizedDescription
  ) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(
      [
        String(userId),
        `date:${dateOnly}`,
        `type:${normalizedType}`,
        `amount:${amountCents}`,
        `description:${normalizedDescription}`,
      ].join("|")
    )
    .digest("hex");
};
