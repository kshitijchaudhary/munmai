import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";

const uploadDir = await mkdtemp(path.join(tmpdir(), "munmai-income-proof-"));
process.env.UPLOAD_DIR = uploadDir;
process.env.JWT_SECRET = "income-proof-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: Income },
  { default: Expense },
  { default: Planning },
  { default: User },
  { deleteAccount, exportUserData },
  { default: incomeRoutes },
  { default: expenseRoutes },
  { errorHandler },
  { buildStoredUploadFileName },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("../models/Income.js"),
  import("../models/Expense.js"),
  import("../models/Planning.js"),
  import("../models/User.js"),
  import("../controllers/authController.js"),
  import("../routes/incomeRoutes.js"),
  import("../routes/expenseRoutes.js"),
  import("../middleware/errorMiddleware.js"),
  import("../middleware/uploadMiddleware.js"),
]);

const userId = "507f1f77bcf86cd799439011";
const incomeId = "507f1f77bcf86cd799439012";
const expenseId = "507f1f77bcf86cd799439013";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const app = express();
app.use(express.json());
app.use("/api/income", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const asQuery = (value) => ({
  lean: async () => value,
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ _id: userId, id: userId }),
  }));
};

const authenticatedHeaders = () => ({ Authorization: `Bearer ${token}` });

const createIncomePayload = () => ({
  amount: "2500",
  category: "Uncategorized",
  date: "2026-07-15",
  source: "Acme Payroll",
});

const createUploadForm = ({
  body = createIncomePayload(),
  bytes = "proof-content",
  fieldName = "proof",
  fileName = "proof.jpg",
  mimeType = "image/jpeg",
} = {}) => {
  const form = new FormData();

  Object.entries(body).forEach(([key, value]) => form.append(key, value));
  form.append(fieldName, new Blob([bytes], { type: mimeType }), fileName);
  return form;
};

const listStoredFiles = () => readdir(uploadDir);

const clearStoredFiles = async () => {
  const files = await listStoredFiles();
  await Promise.all(files.map((fileName) => rm(path.join(uploadDir, fileName))));
};

const createControllerResponse = () => ({
  body: undefined,
  headers: {},
  statusCode: 200,
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

beforeEach(clearStoredFiles);

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(uploadDir, { force: true, recursive: true });
});

test("shared upload filenames remain unique under concurrent generation", () => {
  const proofNames = new Set();
  const receiptNames = new Set();

  for (let index = 0; index < 2000; index += 1) {
    proofNames.add(
      buildStoredUploadFileName({ fieldname: "proof", originalname: "PROOF.JPG" }),
    );
    receiptNames.add(
      buildStoredUploadFileName({ fieldname: "receipt", originalname: "receipt.png" }),
    );
  }

  assert.equal(proofNames.size, 2000);
  assert.equal(receiptNames.size, 2000);
  assert.ok([...proofNames].every((name) => /^[0-9a-f-]+\.jpg$/.test(name)));
  assert.ok([...receiptNames].every((name) => /^[0-9a-f-]+\.png$/.test(name)));
});

test("income upload rejects missing and invalid authentication before storage", async () => {
  const missingResponse = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm(),
    method: "PUT",
  });
  const invalidResponse = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm(),
    headers: { Authorization: "Bearer invalid-token" },
    method: "PUT",
  });

  assert.equal(missingResponse.status, 401);
  assert.equal(invalidResponse.status, 401);
  assert.deepEqual(await listStoredFiles(), []);
});

test("malformed and wrong-owner income IDs return 404 without writing a file", async (t) => {
  allowAuthentication(t);
  t.mock.method(Income, "findOne", () => asQuery(null));

  const malformedResponse = await fetch(`${baseUrl}/api/income/not-an-id`, {
    body: createUploadForm(),
    headers: authenticatedHeaders(),
    method: "PUT",
  });
  const wrongOwnerResponse = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm(),
    headers: authenticatedHeaders(),
    method: "PUT",
  });

  assert.equal(malformedResponse.status, 404);
  assert.equal(wrongOwnerResponse.status, 404);
  assert.deepEqual(await listStoredFiles(), []);
});

test("wrong-owner proof reads and missing proof return non-enumerating 404 responses", async (t) => {
  allowAuthentication(t);
  let callCount = 0;
  t.mock.method(Income, "findOne", () =>
    asQuery(callCount++ === 0 ? null : { _id: incomeId, fileUrl: "", userId }),
  );

  const wrongOwnerResponse = await fetch(`${baseUrl}/api/income/${incomeId}/proof`, {
    headers: authenticatedHeaders(),
  });
  const missingProofResponse = await fetch(`${baseUrl}/api/income/${incomeId}/proof`, {
    headers: authenticatedHeaders(),
  });

  assert.equal(wrongOwnerResponse.status, 404);
  assert.deepEqual(await wrongOwnerResponse.json(), { message: "Income record not found" });
  assert.equal(missingProofResponse.status, 404);
  assert.deepEqual(await missingProofResponse.json(), {
    message: "Proof of income not found",
  });
});

for (const media of [
  { extension: ".jpg", mimeType: "image/jpeg" },
  { extension: ".jpeg", mimeType: "image/jpeg" },
  { extension: ".png", mimeType: "image/png" },
  { extension: ".pdf", mimeType: "application/pdf" },
]) {
  test(`income proof accepts valid ${media.mimeType} ${media.extension}`, async (t) => {
    allowAuthentication(t);
    const previousIncome = {
      _id: incomeId,
      amount: 1,
      category: "Uncategorized",
      date: new Date("2026-07-01T00:00:00.000Z"),
      fileUrl: "",
      notes: "",
      source: "Previous source",
      userId,
    };
    let storedFileUrl = "";
    let findCall = 0;

    t.mock.method(Income, "findOne", () =>
      asQuery(findCall++ === 0 ? previousIncome : { ...previousIncome, fileUrl: storedFileUrl }),
    );
    t.mock.method(Income, "findOneAndUpdate", async (filter, update) => {
      assert.deepEqual(filter, { _id: incomeId, userId });
      storedFileUrl = update.$set.fileUrl;
      return previousIncome;
    });

    const response = await fetch(`${baseUrl}/api/income/${incomeId}`, {
      body: createUploadForm({
        fileName: `proof${media.extension}`,
        mimeType: media.mimeType,
      }),
      headers: authenticatedHeaders(),
      method: "PUT",
    });

    assert.equal(response.status, 200);
    assert.match(storedFileUrl, new RegExp(`^/uploads/[0-9a-f-]+\\${media.extension}$`));
    assert.equal(existsSync(path.join(uploadDir, path.basename(storedFileUrl))), true);
  });
}

for (const invalidUpload of [
  { expectedStatus: 415, fileName: "proof.txt", mimeType: "text/plain" },
  { expectedStatus: 415, fileName: "proof.gif", mimeType: "image/jpeg" },
  { expectedStatus: 415, fileName: "proof.jpg", mimeType: "image/png" },
]) {
  test(`income proof rejects ${invalidUpload.mimeType} ${invalidUpload.fileName}`, async (t) => {
    allowAuthentication(t);
    t.mock.method(Income, "findOne", () =>
      asQuery({ _id: incomeId, date: new Date(), fileUrl: "", userId }),
    );

    const response = await fetch(`${baseUrl}/api/income/${incomeId}`, {
      body: createUploadForm(invalidUpload),
      headers: authenticatedHeaders(),
      method: "PUT",
    });

    assert.equal(response.status, invalidUpload.expectedStatus);
    assert.deepEqual(await listStoredFiles(), []);
    const body = await response.json();
    assert.equal("stack" in body, false);
  });
}

test("income proof rejects missing and oversized multipart uploads", async (t) => {
  allowAuthentication(t);
  t.mock.method(Income, "findOne", () =>
    asQuery({ _id: incomeId, date: new Date(), fileUrl: "", userId }),
  );

  const missingForm = new FormData();
  missingForm.append("amount", "2500");
  const missingResponse = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: missingForm,
    headers: authenticatedHeaders(),
    method: "PUT",
  });
  const oversizedResponse = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm({ bytes: new Uint8Array(5 * 1024 * 1024 + 1) }),
    headers: authenticatedHeaders(),
    method: "PUT",
  });

  assert.equal(missingResponse.status, 400);
  assert.equal(oversizedResponse.status, 413);
  assert.deepEqual(await listStoredFiles(), []);
});

test("replacement commits the new file before deleting the prior file", async (t) => {
  allowAuthentication(t);
  const oldFileName = "existing-proof.jpg";
  const oldFileUrl = `/uploads/${oldFileName}`;
  await writeFile(path.join(uploadDir, oldFileName), "old-proof");
  const previousIncome = {
    _id: incomeId,
    date: new Date("2026-07-01T00:00:00.000Z"),
    fileUrl: oldFileUrl,
    userId,
  };
  let storedFileUrl = "";
  let findCall = 0;

  t.mock.method(Income, "findOne", () =>
    asQuery(findCall++ === 0 ? previousIncome : { ...previousIncome, fileUrl: storedFileUrl }),
  );
  t.mock.method(Income, "findOneAndUpdate", async (filter, update) => {
    assert.equal(existsSync(path.join(uploadDir, oldFileName)), true);
    storedFileUrl = update.$set.fileUrl;
    return previousIncome;
  });

  const response = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm(),
    headers: authenticatedHeaders(),
    method: "PUT",
  });

  assert.equal(response.status, 200);
  assert.equal(existsSync(path.join(uploadDir, oldFileName)), false);
  assert.equal(existsSync(path.join(uploadDir, path.basename(storedFileUrl))), true);
});

test("failed database replacement removes the new file and preserves the old file", async (t) => {
  allowAuthentication(t);
  const oldFileName = "existing-proof.jpg";
  await writeFile(path.join(uploadDir, oldFileName), "old-proof");

  t.mock.method(Income, "findOne", () =>
    asQuery({
      _id: incomeId,
      date: new Date("2026-07-01T00:00:00.000Z"),
      fileUrl: `/uploads/${oldFileName}`,
      userId,
    }),
  );
  t.mock.method(Income, "findOneAndUpdate", async () => {
    throw new Error(`database failed at ${uploadDir}`);
  });

  const response = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    body: createUploadForm(),
    headers: authenticatedHeaders(),
    method: "PUT",
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { message: "Server Error" });
  assert.deepEqual(await listStoredFiles(), [oldFileName]);
});

test("income deletion atomically removes the owner record before its file", async (t) => {
  allowAuthentication(t);
  const fileName = "income-to-delete.png";
  await writeFile(path.join(uploadDir, fileName), "proof");

  t.mock.method(Income, "findOneAndDelete", async (filter) => {
    assert.deepEqual(filter, { _id: incomeId, userId });
    assert.equal(existsSync(path.join(uploadDir, fileName)), true);
    return { _id: incomeId, fileUrl: `/uploads/${fileName}`, userId };
  });

  const response = await fetch(`${baseUrl}/api/income/${incomeId}`, {
    headers: authenticatedHeaders(),
    method: "DELETE",
  });

  assert.equal(response.status, 200);
  assert.equal(existsSync(path.join(uploadDir, fileName)), false);
});

test("account deletion cleans canonical files only after database deletion succeeds", async (t) => {
  const fileName = "account-income-proof.pdf";
  await writeFile(path.join(uploadDir, fileName), "proof");
  let incomeDeleted = false;

  t.mock.method(Income, "find", () => ({
    lean: async () => [{ _id: incomeId, fileUrl: `/uploads/${fileName}`, userId }],
  }));
  t.mock.method(Expense, "find", () => ({ lean: async () => [] }));
  t.mock.method(Income, "deleteMany", async () => {
    assert.equal(existsSync(path.join(uploadDir, fileName)), true);
    incomeDeleted = true;
  });
  t.mock.method(Expense, "deleteMany", async () => undefined);
  t.mock.method(Planning, "deleteMany", async (filter) => {
    assert.deepEqual(filter, { user: userId });
  });
  t.mock.method(User, "findByIdAndDelete", async () => undefined);

  const res = createControllerResponse();
  await deleteAccount({ user: { id: userId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(incomeDeleted, true);
  assert.equal(existsSync(path.join(uploadDir, fileName)), false);
});

test("account export includes only the authenticated user's Planning data", async (t) => {
  const planning = {
    currentCash: 500,
    currency: "CAD",
    essentialBuffer: 100,
    nextPayday: "2099-12-31",
    obligations: [],
    user: userId,
  };
  const emptySortedQuery = () => ({
    sort() {
      return this;
    },
    lean: async () => [],
  });

  t.mock.method(Income, "find", emptySortedQuery);
  t.mock.method(Expense, "find", emptySortedQuery);
  t.mock.method(Planning, "findOne", (filter) => {
    assert.deepEqual(filter, { user: userId });
    return { lean: async () => planning };
  });

  const res = createControllerResponse();
  await exportUserData(
    {
      user: {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        email: "owner@example.com",
        id: userId,
        name: "Owner",
        username: "owner",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).planning, planning);
});

test("proof retrieval uses canonical fileUrl and safe private download headers", async (t) => {
  allowAuthentication(t);
  const fileName = "stored-proof.png";
  await writeFile(path.join(uploadDir, fileName), "png-content");

  t.mock.method(Income, "findOne", () =>
    asQuery({ _id: incomeId, fileUrl: `/uploads/${fileName}`, userId }),
  );

  const response = await fetch(`${baseUrl}/api/income/${incomeId}/proof`, {
    headers: authenticatedHeaders(),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="income-proof.png"',
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(await response.text(), "png-content");
  assert.ok(Income.schema.path("fileUrl"));
  assert.equal(Income.schema.path("proofUrl"), undefined);
});

test("expense receipt upload still uses protected unique shared storage", async (t) => {
  allowAuthentication(t);
  let receiptUrl = "";

  t.mock.method(Expense, "create", async (payload) => {
    receiptUrl = payload.receiptUrl;
    return { _id: expenseId, ...payload };
  });

  const form = new FormData();
  form.append("amount", "42.50");
  form.append("recipient", "Corner Market");
  form.append("category", "Other");
  form.append("expenseType", "personal");
  form.append("deductible", "false");
  form.append("date", "2026-07-15");
  form.append("receipt", new Blob(["receipt"], { type: "image/jpeg" }), "receipt.jpg");

  const response = await fetch(`${baseUrl}/api/expenses`, {
    body: form,
    headers: authenticatedHeaders(),
    method: "POST",
  });

  assert.equal(response.status, 201);
  assert.match(receiptUrl, /^\/uploads\/[0-9a-f-]+\.jpg$/);
  assert.equal(existsSync(path.join(uploadDir, path.basename(receiptUrl))), true);
});
