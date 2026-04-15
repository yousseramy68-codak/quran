import mongoose from "mongoose";

const ayahSchema = new mongoose.Schema(
  {
    surahNumber: { type: Number, required: true, index: true },
    surahName: { type: String, required: true, index: true },
    ayahNumber: { type: Number, required: true },
    text: { type: String, required: true },
    transliteration: { type: String, default: "" },
    juz: { type: Number, required: true, index: true },
    absoluteNumber: { type: Number, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

ayahSchema.index({ surahNumber: 1, ayahNumber: 1 }, { unique: true });

export const Ayah = mongoose.model("Ayah", ayahSchema);
