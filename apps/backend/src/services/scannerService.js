import axios from "axios";
import { env } from "../config/env.js";

export async function scanCard({ image, userId }) {
  const response = await axios.post(
    env.scanApiUrl,
    {
      image,
      userId,
      scanMode: "instant",
      useFastPath: true,
      aiVisionOnly: false,
    },
    { timeout: 7000 }
  );

  return response.data;
}
