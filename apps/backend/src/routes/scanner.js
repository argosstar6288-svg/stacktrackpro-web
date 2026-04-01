import express from "express";
import { scanCard } from "../services/scannerService.js";

export const scannerRouter = express.Router();

scannerRouter.post("/scan", async (req, res) => {
  try {
    const { image, userId } = req.body || {};
    if (!image || !userId) {
      return res.status(400).json({ error: "image and userId are required" });
    }

    const result = await scanCard({ image, userId });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Scanner request failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
