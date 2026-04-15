import { Question } from "../models/Question.js";

export async function listQuestions(_req, res) {
  const questions = await Question.find({ source: "admin" }).sort({ createdAt: -1 });
  res.json(questions);
}

export async function createQuestion(req, res) {
  try {
    const question = await Question.create({ ...req.body, source: "admin" });
    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ message: error.message || "تعذر إنشاء السؤال." });
  }
}

export async function updateQuestion(req, res) {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!question) {
      return res.status(404).json({ message: "السؤال غير موجود." });
    }
    return res.json(question);
  } catch (error) {
    return res.status(400).json({ message: error.message || "تعذر تعديل السؤال." });
  }
}

export async function deleteQuestion(req, res) {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) {
    return res.status(404).json({ message: "السؤال غير موجود." });
  }
  return res.status(204).send();
}
