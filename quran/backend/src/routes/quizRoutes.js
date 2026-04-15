import { Router } from "express";

import { generateQuiz, submitQuiz } from "../controllers/quizController.js";

const quizRouter = Router();

quizRouter.post("/generate", generateQuiz);
quizRouter.post("/submit", submitQuiz);

export default quizRouter;
