import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import path from 'path'; 
import { fileURLToPath } from 'url'; 

import authRoutes from "./routes/authRoutes.js";
import protect from "./middleware/authMiddleware.js";
import incomeRoutes from './routes/incomeRoutes.js'; 
import expenseRoutes from './routes/expenseRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// NEW: Serve the uploads folder statically
// This allows you to visit http://localhost:5000/uploads/receipt-123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// using middlewares to protect the routes
app.use("/api/auth", authRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);

app.use(errorHandler);

// app.get("/", (req, res) => {
//   res.send("FinTrack API Running...");
// });

app.get("/api/test/protected", protect, (req, res) => {
  res.json({
    message: "Access granted",
    user: req.user
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB Connection Error:", err);
  });