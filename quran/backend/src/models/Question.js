import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
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
    answer: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { type: String, enum: ["admin", "system"], default: "admin" },
  },
  { timestamps: true }
);

export const Question = mongoose.model("Question", questionSchema);
