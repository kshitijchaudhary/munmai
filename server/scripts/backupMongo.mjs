import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Income from "../models/Income.js";
import Expense from "../models/Expense.js";
import TelemetryEvent from "../models/TelemetryEvent.js";

dotenv.config();

if (!process.env.MONGO_URI) {
  console.error("Missing MONGO_URI. Cannot run backup.");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const [users, incomes, expenses, telemetryEvents] = await Promise.all([
    User.find({}).lean(),
    Income.find({}).lean(),
    Expense.find({}).lean(),
    TelemetryEvent.find({}).lean(),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  const filePath = path.join(backupDir, `munmai-backup-${timestamp}.json`);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        users,
        incomes,
        expenses,
        telemetryEvents,
      },
      null,
      2
    )
  );

  console.log(`Backup written to ${filePath}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Backup failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
