import mongoose from "mongoose";

const generatedQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "multiple_choice",
        "complete_ayah",
        "identify_surah",
        "order_verses",
        "next_ayah",
        "identify_ayah_number",
        "reading_start",
        "read_from_qawl",
      ],
      required: true,
    },
    prompt: { type: String, required: true },
    choices: [{ type: String }],
    orderingItems: [
      {
        id: String,
        text: String,
      },
    ],
    correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
    juz: { type: Number, required: true },
  },
  { _id: false }
);

const quizSessionSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true, unique: true, index: true },
    distribution: [
      {
        juz: Number,
        percentage: Number,
      },
    ],
    durationMinutes: { type: Number, default: 20 },
    questions: [generatedQuestionSchema],
    submitted: { type: Boolean, default: false },
    score: Number,
    userAnswers: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const QuizSession = mongoose.model("QuizSession", quizSessionSchema);
