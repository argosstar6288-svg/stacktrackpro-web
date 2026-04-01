import express from "express";
import { matchCard } from "../services/matcherService.js";

export const matcherRouter = express.Router();

matcherRouter.post("/match", async (req, res) => {
  try {
    const { text, gameType, yoloDetections } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const result = await matchCard({ text, gameType, yoloDetections });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Matcher request failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
