import { Router } from "express";

import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
} from "../controllers/adminController.js";

const adminRouter = Router();

adminRouter.get("/questions", listQuestions);
adminRouter.post("/questions", createQuestion);
adminRouter.put("/questions/:id", updateQuestion);
adminRouter.delete("/questions/:id", deleteQuestion);

export default adminRouter;
