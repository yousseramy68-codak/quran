import { randomUUID } from "node:crypto";

import { Ayah } from "../models/Ayah.js";
import { Question } from "../models/Question.js";

const QUESTION_TYPES = [
  "multiple_choice",
  "complete_ayah",
  "identify_surah",
  "order_verses",
  "next_ayah",
  "identify_ayah_number",
  "reading_start",
  "read_from_qawl",
];

function shuffle(array) {
  const next = [...array];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const j = Math.floor(Math.random() * (index + 1));
    [next[index], next[j]] = [next[j], next[index]];
  }
  return next;
}

function calculateQuestionAllocation(distribution, totalQuestions) {
  const raw = distribution.map((item) => ({
    ...item,
    exact: (item.percentage / 100) * totalQuestions,
  }));

  const base = raw.map((item) => ({ ...item, count: Math.floor(item.exact), decimal: item.exact % 1 }));
  let remaining = totalQuestions - base.reduce((sum, item) => sum + item.count, 0);

  const ranked = [...base].sort((a, b) => b.decimal - a.decimal);
  let pointer = 0;
  while (remaining > 0) {
    ranked[pointer % ranked.length].count += 1;
    pointer += 1;
    remaining -= 1;
  }

  return ranked.map(({ decimal, exact, ...rest }) => rest);
}

function buildQuotedOpening(text) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 3) {
    return String(text || "");
  }

  const openingLength = Math.min(words.length, Math.max(3, Math.min(6, Math.ceil(words.length / 3))));
  const opening = words.slice(0, openingLength).join(" ");
  return openingLength < words.length ? `${opening} ...` : opening;
}

function sanitizeQuestionTypes(questionTypes) {
  const list = Array.isArray(questionTypes) ? questionTypes.filter((type) => QUESTION_TYPES.includes(type)) : [];
  return list.length > 0 ? Array.from(new Set(list)) : QUESTION_TYPES;
}

async function generateIdentifySurahQuestion(targetAyah) {
  const randomAyahs = await Ayah.aggregate([{ $sample: { size: 10 } }, { $project: { surahName: 1 } }]);
  const distractors = Array.from(new Set(randomAyahs.map((item) => item.surahName))).filter(
    (name) => name !== targetAyah.surahName
  );

  const choices = shuffle([targetAyah.surahName, ...distractors.slice(0, 3)]);
  return {
    questionId: randomUUID(),
    type: "identify_surah",
    prompt: `قال الله تعالى: "${targetAyah.text}" - في أي سورة وردت هذه الآية؟`,
    choices,
    correctAnswer: targetAyah.surahName,
    juz: targetAyah.juz,
  };
}

async function generateCompleteAyahQuestion(targetAyah) {
  const words = targetAyah.text.split(" ");
  if (words.length < 4) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const cutIndex = Math.max(2, Math.floor(words.length / 2));
  const firstHalf = words.slice(0, cutIndex).join(" ");
  const secondHalf = words.slice(cutIndex).join(" ");

  const randomAyahs = await Ayah.aggregate([{ $sample: { size: 20 } }, { $project: { text: 1 } }]);
  const distractors = randomAyahs
    .map((item) => item.text.split(" ").slice(Math.floor(item.text.split(" ").length / 2)).join(" "))
    .filter((text) => text && text !== secondHalf)
    .slice(0, 3);

  return {
    questionId: randomUUID(),
    type: "complete_ayah",
    prompt: `أكمل الآية الكريمة: "${firstHalf} ..."`,
    choices: shuffle([secondHalf, ...distractors]),
    correctAnswer: secondHalf,
    juz: targetAyah.juz,
  };
}

function buildMultipleChoiceQuestion(targetAyah) {
  const options = shuffle([
    targetAyah.juz,
    ((targetAyah.juz + 2) % 30) + 1,
    ((targetAyah.juz + 9) % 30) + 1,
    ((targetAyah.juz + 16) % 30) + 1,
  ]).map((value) => `جزء ${value}`);

  return {
    questionId: randomUUID(),
    type: "multiple_choice",
    prompt: `هذه الآية "${targetAyah.text}" تقع في أي جزء؟`,
    choices: options,
    correctAnswer: `جزء ${targetAyah.juz}`,
    juz: targetAyah.juz,
  };
}

async function generateOrderingQuestion(targetAyah) {
  const surahAyahs = await Ayah.find({ surahNumber: targetAyah.surahNumber })
    .sort({ ayahNumber: 1 })
    .select("ayahNumber text")
    .lean();

  if (surahAyahs.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const currentIndex = surahAyahs.findIndex((item) => item.ayahNumber === targetAyah.ayahNumber);
  const startIndex = Math.min(Math.max(currentIndex - 1, 0), surahAyahs.length - 3);
  const sequence = surahAyahs.slice(startIndex, startIndex + 3);

  return {
    questionId: randomUUID(),
    type: "order_verses",
    prompt: "رتب الآيات التالية ترتيبًا صحيحًا كما وردت في السورة:",
    orderingItems: shuffle(
      sequence.map((ayah) => ({
        id: `s${targetAyah.surahNumber}-a${ayah.ayahNumber}`,
        text: ayah.text,
      }))
    ),
    correctAnswer: sequence.map((ayah) => `s${targetAyah.surahNumber}-a${ayah.ayahNumber}`),
    juz: targetAyah.juz,
  };
}

async function generateNextAyahQuestion(targetAyah) {
  const nextAyah = await Ayah.findOne({
    surahNumber: targetAyah.surahNumber,
    ayahNumber: targetAyah.ayahNumber + 1,
  })
    .select("text")
    .lean();

  if (!nextAyah) {
    return generateCompleteAyahQuestion(targetAyah);
  }

  const randomAyahs = await Ayah.aggregate([{ $sample: { size: 20 } }, { $project: { text: 1 } }]);
  const distractors = Array.from(new Set(randomAyahs.map((item) => item.text)))
    .filter((text) => text && text !== nextAyah.text)
    .slice(0, 3);

  return {
    questionId: randomUUID(),
    type: "next_ayah",
    prompt: `ما الآية التالية مباشرة لقوله تعالى: "${targetAyah.text}"؟`,
    choices: shuffle([nextAyah.text, ...distractors]),
    correctAnswer: nextAyah.text,
    juz: targetAyah.juz,
  };
}

async function generateAyahNumberQuestion(targetAyah) {
  const totalAyahsInSurah = await Ayah.countDocuments({ surahNumber: targetAyah.surahNumber });
  if (totalAyahsInSurah < 4) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const candidates = Array.from(
    new Set([
      targetAyah.ayahNumber,
      Math.max(1, targetAyah.ayahNumber - 1),
      Math.max(1, targetAyah.ayahNumber - 2),
      Math.min(totalAyahsInSurah, targetAyah.ayahNumber + 1),
      Math.min(totalAyahsInSurah, targetAyah.ayahNumber + 2),
    ])
  );

  let distractors = candidates.filter((value) => value !== targetAyah.ayahNumber).map((value) => `الآية ${value}`);
  if (distractors.length < 3) {
    const otherValues = shuffle(
      Array.from({ length: totalAyahsInSurah }, (_, index) => index + 1).filter(
        (value) => value !== targetAyah.ayahNumber && !candidates.includes(value)
      )
    )
      .slice(0, 3 - distractors.length)
      .map((value) => `الآية ${value}`);
    distractors = [...distractors, ...otherValues];
  }

  return {
    questionId: randomUUID(),
    type: "identify_ayah_number",
    prompt: `ما رقم هذه الآية في سورة ${targetAyah.surahName}: "${targetAyah.text}"؟`,
    choices: shuffle([`الآية ${targetAyah.ayahNumber}`, ...distractors.slice(0, 3)]),
    correctAnswer: `الآية ${targetAyah.ayahNumber}`,
    juz: targetAyah.juz,
  };
}

async function generateReadingStartQuestion(targetAyah) {
  const surahAyahs = await Ayah.find({ surahNumber: targetAyah.surahNumber })
    .sort({ ayahNumber: 1 })
    .select("surahName surahNumber ayahNumber text juz")
    .lean();

  const firstAyah = surahAyahs[0];
  if (!firstAyah) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  // يدعم السؤال حالتي: البدء من أول السورة، أو البدء من آية محددة داخل السورة.
  const useSurahOpeningPrompt = targetAyah.ayahNumber === 1 || Math.random() < 0.35;
  const answerAyah = useSurahOpeningPrompt ? firstAyah : targetAyah;
  const prompt = useSurahOpeningPrompt
    ? `إذا طُلِب منك أن تبدأ القراءة من أول سورة ${answerAyah.surahName}، فما الآية التي تبدأ بها؟`
    : `إذا قيل لك: ابدأ القراءة من سورة ${answerAyah.surahName} ابتداءً من الآية ${answerAyah.ayahNumber}، فما أول آية تقرؤها؟`;

  const nearbyTexts = surahAyahs
    .filter((ayah) => ayah.ayahNumber !== answerAyah.ayahNumber)
    .sort(
      (first, second) => Math.abs(first.ayahNumber - answerAyah.ayahNumber) - Math.abs(second.ayahNumber - answerAyah.ayahNumber)
    )
    .map((ayah) => ayah.text);

  const openingAyahs = await Ayah.aggregate([
    { $match: { ayahNumber: 1, surahNumber: { $ne: answerAyah.surahNumber } } },
    { $sample: { size: 12 } },
    { $project: { text: 1 } },
  ]);

  const distractors = shuffle(
    Array.from(new Set([...nearbyTexts, ...openingAyahs.map((item) => item.text)])).filter(
      (text) => text && text !== answerAyah.text
    )
  ).slice(0, 3);

  if (distractors.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  return {
    questionId: randomUUID(),
    type: "reading_start",
    prompt,
    choices: shuffle([answerAyah.text, ...distractors]),
    correctAnswer: answerAyah.text,
    juz: answerAyah.juz,
  };
}

async function generateReadFromQawlQuestion(targetAyah) {
  const quotedOpening = buildQuotedOpening(targetAyah.text);
  const randomAyahs = await Ayah.aggregate([{ $sample: { size: 16 } }, { $project: { surahName: 1 } }]);
  const distractors = Array.from(new Set(randomAyahs.map((item) => item.surahName))).filter(
    (name) => name && name !== targetAyah.surahName
  );

  if (distractors.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  return {
    questionId: randomUUID(),
    type: "read_from_qawl",
    prompt: `اقرأ من قوله تعالى: "${quotedOpening}" - من أي سورة من القرآن تبدأ هذه القراءة؟`,
    choices: shuffle([targetAyah.surahName, ...distractors.slice(0, 3)]),
    correctAnswer: targetAyah.surahName,
    juz: targetAyah.juz,
  };
}

async function generateQuestionFromAyah(targetAyah, type) {
  if (type === "identify_surah") {
    return generateIdentifySurahQuestion(targetAyah);
  }
  if (type === "complete_ayah") {
    return generateCompleteAyahQuestion(targetAyah);
  }
  if (type === "order_verses") {
    return generateOrderingQuestion(targetAyah);
  }
  if (type === "next_ayah") {
    return generateNextAyahQuestion(targetAyah);
  }
  if (type === "identify_ayah_number") {
    return generateAyahNumberQuestion(targetAyah);
  }
  if (type === "reading_start") {
    return generateReadingStartQuestion(targetAyah);
  }
  if (type === "read_from_qawl") {
    return generateReadFromQawlQuestion(targetAyah);
  }
  return buildMultipleChoiceQuestion(targetAyah);
}

export async function generateQuizQuestions({ distribution, questionCount, questionTypes }) {
  const allowedQuestionTypes = sanitizeQuestionTypes(questionTypes);
  const allocation = calculateQuestionAllocation(distribution, questionCount);
  const selectedAyahIds = new Set();
  const generated = [];

  for (const entry of allocation) {
    const pool = await Ayah.find({ juz: entry.juz }).select("_id").lean();
    if (pool.length < entry.count) {
      throw new Error(`لا يوجد عدد كافٍ من الآيات في الجزء ${entry.juz} لإنشاء الاختبار المطلوب.`);
    }

    const poolIds = shuffle(pool.map((item) => String(item._id)));
    const chosen = poolIds.filter((id) => !selectedAyahIds.has(id)).slice(0, entry.count);
    chosen.forEach((id) => selectedAyahIds.add(id));

    const ayahs = await Ayah.find({ _id: { $in: chosen } }).lean();
    for (const ayah of ayahs) {
      const type = allowedQuestionTypes[Math.floor(Math.random() * allowedQuestionTypes.length)];
      generated.push(await generateQuestionFromAyah(ayah, type));
    }
  }

  const adminQuestions = await Question.find({ source: "admin" }).lean();
  if (adminQuestions.length > 0) {
    const injectCount = Math.min(3, Math.floor(questionCount / 5), adminQuestions.length);
    for (const adminQuestion of shuffle(adminQuestions).slice(0, injectCount)) {
      generated.push({
        questionId: randomUUID(),
        type: adminQuestion.type,
        prompt: adminQuestion.prompt,
        choices: adminQuestion.choices,
        orderingItems:
          adminQuestion.type === "order_verses"
            ? (adminQuestion.choices || []).map((choice) => ({ id: randomUUID(), text: choice }))
            : undefined,
        correctAnswer: adminQuestion.answer,
        juz: 0,
      });
    }
  }

  return shuffle(generated).slice(0, questionCount);
}
