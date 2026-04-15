import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDatabase } from "./config/db.js";
import adminRouter from "./routes/adminRoutes.js";
import metaRouter from "./routes/metaRoutes.js";
import quizRouter from "./routes/quizRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "quran-quiz-api" });
});

app.use("/api/quiz", quizRouter);
app.use("/api/admin", adminRouter);
app.use("/api/meta", metaRouter);

const port = Number(process.env.PORT || 5000);

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect database.", error);
    process.exit(1);
  });
