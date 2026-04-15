import { randomUUID } from "node:crypto";

import { QuizSession } from "../models/QuizSession.js";
import { generateQuizQuestions } from "../utils/quizGenerator.js";

function validateDistribution(distribution) {
  if (!Array.isArray(distribution) || distribution.length === 0) {
    throw new Error("يجب إرسال توزيع صحيح للأجزاء.");
  }

  const total = distribution.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
  if (total !== 100) {
    throw new Error("مجموع النسب يجب أن يساوي 100%.");
  }

  for (const item of distribution) {
    if (item.juz < 1 || item.juz > 30) {
      throw new Error("رقم الجزء يجب أن يكون بين 1 و 30.");
    }
    if (item.percentage <= 0) {
      throw new Error("النسب يجب أن تكون أكبر من صفر.");
    }
  }
}

export async function generateQuiz(req, res) {
  try {
    const { distribution, questionCount = 20, durationMinutes = 20, questionTypes = [] } = req.body;
    validateDistribution(distribution);

    const questions = await generateQuizQuestions({
      distribution,
      questionCount: Number(questionCount),
      questionTypes,
    });
    const quizId = randomUUID();

    await QuizSession.create({
      quizId,
      distribution,
      durationMinutes,
      questions,
    });

    res.status(201).json({
      quizId,
      createdAt: new Date().toISOString(),
      durationMinutes,
      questions: questions.map((question) => ({
        questionId: question.questionId,
        type: question.type,
        prompt: question.prompt,
        choices: question.choices,
        orderingItems: question.orderingItems,
      })),
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "تعذر إنشاء الاختبار." });
  }
}

function compareAnswer(expected, actual) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) {
      return false;
    }
    return expected.every((item, index) => item === actual[index]);
  }
  return expected === actual;
}

export async function submitQuiz(req, res) {
  try {
    const { quizId, answers } = req.body;
    const session = await QuizSession.findOne({ quizId });
    if (!session) {
      return res.status(404).json({ message: "الاختبار غير موجود." });
    }

    let correctAnswers = 0;
    const byJuzMap = new Map();

    for (const question of session.questions) {
      const answer = answers?.[question.questionId];
      const isCorrect = compareAnswer(question.correctAnswer, answer);
      if (isCorrect) {
        correctAnswers += 1;
      }

      const key = question.juz;
      const current = byJuzMap.get(key) || { juz: key, total: 0, correct: 0 };
      current.total += 1;
      if (isCorrect) {
        current.correct += 1;
      }
      byJuzMap.set(key, current);
    }

    const totalQuestions = session.questions.length;
    const wrongAnswers = totalQuestions - correctAnswers;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const byJuz = Array.from(byJuzMap.values()).sort((a, b) => a.juz - b.juz);

    session.submitted = true;
    session.score = score;
    session.userAnswers = answers;
    await session.save();

    return res.json({
      score,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      byJuz,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "تعذر إرسال الحل." });
  }
}
