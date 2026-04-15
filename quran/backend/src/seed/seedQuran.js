import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAyahMeta } from "quran-meta/hafs";

import { connectDatabase } from "../config/db.js";
import { Ayah } from "../models/Ayah.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSurah(surahNumber) {
  const chapterPath = path.resolve(__dirname, "../../node_modules/quran-json/dist/chapters", `${surahNumber}.json`);
  const chapterContent = await readFile(chapterPath, "utf8");
  return JSON.parse(chapterContent);
}

async function seed() {
  await connectDatabase();
  await Ayah.deleteMany({});

  let absoluteNumber = 1;
  const docs = [];

  for (let surahNumber = 1; surahNumber <= 114; surahNumber += 1) {
    const surah = await loadSurah(surahNumber);
    for (const verse of surah.verses) {
      const meta = getAyahMeta(absoluteNumber);
      docs.push({
        surahNumber,
        surahName: surah.name,
        ayahNumber: verse.id,
        text: verse.text,
        transliteration: verse.transliteration,
        juz: meta.juz,
        absoluteNumber,
      });
      absoluteNumber += 1;
    }
  }

  await Ayah.insertMany(docs, { ordered: false });
  console.log(`Seed completed successfully. Inserted ${docs.length} ayahs.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
