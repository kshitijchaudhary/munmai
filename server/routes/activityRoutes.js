import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getActivityFeed } from "../controllers/activityController.js";

const router = express.Router();

router.use(protect);

router.get("/", async (req, res, next) => {
  try {
    const data = await getActivityFeed(req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
