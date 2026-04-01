import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env, validateEnv } from "./config/env.js";
import { authRequired } from "./middleware/auth.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { pricingRouter } from "./routes/pricing.js";
import { scannerRouter } from "./routes/scanner.js";
import { matcherRouter } from "./routes/matcher.js";

validateEnv();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "stacktrack-backend" });
});

app.use("/api", apiRateLimit, authRequired);
app.use("/api/pricing", pricingRouter);
app.use("/api/scanner", scannerRouter);
app.use("/api/matcher", matcherRouter);

app.listen(env.port, () => {
  console.log(`[backend] listening on :${env.port}`);
});
