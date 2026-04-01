import axios from "axios";
import { env } from "../config/env.js";

export async function matchCard({ text, gameType = "pokemon", yoloDetections = [] }) {
  const response = await axios.post(
    `${env.matcherApiUrl}/identify-multi-signal`,
    {
      text,
      gameType,
      yoloDetections,
    },
    { timeout: 3000 }
  );

  return response.data;
}
