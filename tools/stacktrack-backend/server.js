require("dotenv").config();

const express = require("express");
const cors = require("cors");
const valuationRoute = require("./routes/valuation");
const valueRoute = require("./routes/value");
const scanRoute = require("./routes/scan");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/valuation", valuationRoute);
app.use("/api/value", valueRoute);
app.use("/api/scan", scanRoute);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 StackTrack API running on port ${PORT}`);
});
