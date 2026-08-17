const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const normalizeIdempotencyKey = (value) => String(value || "").trim();

export const getSharedExpenseIdempotencyKey = (
  currentKey,
  generate = () => globalThis.crypto.randomUUID(),
) => {
  const existingKey = normalizeIdempotencyKey(currentKey);

  if (existingKey) {
    return existingKey;
  }

  const generatedKey = normalizeIdempotencyKey(generate());

  if (!IDEMPOTENCY_KEY_PATTERN.test(generatedKey)) {
    throw new Error("Unable to generate a valid shared-expense request ID.");
  }

  return generatedKey;
};

export const sendCreateSharedExpenseRequest = async (
  apiClient,
  payload,
  idempotencyKey,
) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);

  if (!IDEMPOTENCY_KEY_PATTERN.test(normalizedKey)) {
    throw new Error("A valid shared-expense idempotency key is required.");
  }

  const response = await apiClient.post("/shared-expenses", payload, {
    headers: { "Idempotency-Key": normalizedKey },
  });

  return response.data;
};

