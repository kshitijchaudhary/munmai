import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import crypto from "node:crypto";

const baseUri = process.env.MONGO_TRANSACTION_TEST_URI;
const databaseUri = baseUri
  ? (() => {
      const url = new URL(baseUri);
      url.pathname = "/munmai-test-password-reset";
      return url.toString();
    })()
  : null;
const databaseTest = (name, callback) =>
  test(
    name,
    {
      skip: databaseUri ? false : "MONGO_TRANSACTION_TEST_URI is not set",
    },
    callback
  );

const [
  { default: bcrypt },
  { default: express },
  { default: mongoose },
  { default: User },
  { default: authRoutes },
] = await Promise.all([
  import("bcrypt"),
  import("express"),
  import("mongoose"),
  import("../models/User.js"),
  import("../routes/authRoutes.js"),
]);

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/api/auth", authRoutes);

let server;
let baseUrl;

before(async () => {
  if (!databaseUri) {
    return;
  }

  process.env.JWT_SECRET = "password-reset-integration-secret";
  await mongoose.connect(databaseUri);
  await mongoose.connection.db.dropDatabase();
  await User.syncIndexes();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }

  if (databaseUri) {
    await mongoose.disconnect();
  }
});

databaseTest(
  "concurrent reset requests persist one bcrypt hash and consume the token once",
  async () => {
    const oldPassword = "old-password";
    const newPassword = "new-password";
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const oldPasswordHash = await bcrypt.hash(oldPassword, 10);
    const user = await User.create({
      name: "Reset User",
      email: "reset-user@example.com",
      username: "reset_user",
      password: oldPasswordHash,
      isVerified: true,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000),
    });
    const request = () =>
      fetch(`${baseUrl}/api/auth/reset-password/${rawToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: newPassword,
          confirmPassword: newPassword,
        }),
      });

    const responses = await Promise.all([request(), request()]);
    const responseBodies = await Promise.all(
      responses.map((response) => response.json())
    );
    const storedUser = await User.findById(user._id).lean();

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 400]
    );
    assert.deepEqual(
      responseBodies.find((_body, index) => responses[index].status === 400),
      { message: "Password reset link is invalid or expired" }
    );
    assert.notEqual(storedUser.password, newPassword);
    assert.match(storedUser.password, /^\$2[aby]\$10\$/);
    assert.equal(await bcrypt.compare(newPassword, storedUser.password), true);
    assert.equal(await bcrypt.compare(oldPassword, storedUser.password), false);
    assert.equal(storedUser.resetPasswordToken, "");
    assert.equal(storedUser.resetPasswordExpires, null);
    assert.equal(
      responseBodies.some((body) =>
        JSON.stringify(body).includes(newPassword)
      ),
      false
    );
  }
);
