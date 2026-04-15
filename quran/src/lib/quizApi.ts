import { getAyahMeta } from "quran-meta/hafs";

export type DistributionEntry = {
  juz: number;
  percentage: number;
};

export type QuizModel = "A" | "B";

export type QuizQuestionType =
  | "multiple_choice"
  | "complete_ayah"
  | "identify_surah"
  | "order_verses"
  | "next_ayah"
  | "identify_ayah_number"
  | "reading_start"
  | "read_from_qawl";

export const QUESTION_TYPE_OPTIONS: Array<{ value: QuizQuestionType; label: string; description: string }> = [
  {
    value: "complete_ayah",
    label: "أكمل الآية",
    description: "يُعرض جزء من الآية وتختار تتمتها الصحيحة.",
  },
  {
    value: "order_verses",
    label: "رتّب الآيات",
    description: "ترتيب مجموعة آيات كما وردت في السورة.",
  },
  {
    value: "identify_surah",
    label: "اذكر اسم السورة",
    description: "تحديد السورة الصحيحة للآية المعروضة.",
  },
  {
    value: "reading_start",
    label: "بداية القراءة",
    description: "تحديد أول آية تبدأ بها التلاوة عند ذكر السورة أو رقم الآية.",
  },
  {
    value: "read_from_qawl",
    label: "اقرأ من قوله تعالى",
    description: "يُعرض مطلع آية، ويُطلب تحديد السورة التي يبدأ منها هذا الموضع القرآني.",
  },
  {
    value: "multiple_choice",
    label: "في أي جزء؟",
    description: "اختيار الجزء الذي تقع فيه الآية.",
  },
  {
    value: "next_ayah",
    label: "ما الآية التالية؟",
    description: "اختيار الآية التالية مباشرة من بين عدة خيارات.",
  },
  {
    value: "identify_ayah_number",
    label: "ما رقم الآية؟",
    description: "تحديد رقم الآية داخل السورة.",
  },
];

export type QuizQuestion = {
  questionId: string;
  type: QuizQuestionType;
  prompt: string;
  choices?: string[];
  orderingItems?: { id: string; text: string }[];
};

export type QuizPayload = {
  quizId: string;
  createdAt: string;
  durationMinutes: number;
  mode: "remote" | "local";
  questions: QuizQuestion[];
};

export type QuizResult = {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  byJuz: Array<{ juz: number; total: number; correct: number }>;
  mode?: "remote" | "local";
};

export type AdminQuestionSummary = {
  _id: string;
  type: QuizQuestionType;
  prompt: string;
};

export type AdminQuestionInput = {
  type: QuizQuestionType;
  prompt: string;
  choices: string[];
  answer: string | string[];
};

type RemoteQuizPayload = Omit<QuizPayload, "mode">;
type RemoteQuizResult = Omit<QuizResult, "mode">;

type LocalAyah = {
  id: string;
  absoluteNumber: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  transliteration: string;
  juz: number;
};

type LocalStoredQuestion = QuizQuestion & {
  correctAnswer: string | string[];
  juz: number;
};

type LocalStoredSession = {
  quizId: string;
  createdAt: string;
  durationMinutes: number;
  distribution: DistributionEntry[];
  questions: LocalStoredQuestion[];
  submitted?: boolean;
  score?: number;
  userAnswers?: Record<string, string | string[]>;
};

type QuranChapter = {
  id: number;
  name: string;
  transliteration: string;
  verses: Array<{
    id: number;
    text: string;
    transliteration: string;
  }>;
};

type LocalAdminQuestion = AdminQuestionSummary & {
  choices?: string[];
  answer?: string | string[];
};

class ApiRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ApiRequestError";
    this.retryable = retryable;
  }
}

const LOCAL_SESSIONS_KEY = "smawq.local.quiz.sessions.v1";
const LOCAL_ADMIN_KEY = "smawq.local.admin.questions.v1";
const QUESTION_TYPES: QuizQuestionType[] = QUESTION_TYPE_OPTIONS.map((item) => item.value);
const CONFIGURED_API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const REMOTE_API_ENABLED = Boolean(CONFIGURED_API_BASE);

const chapterModules = import.meta.glob<{ default: QuranChapter }>("/node_modules/quran-json/dist/chapters/*.json", {
  eager: true,
});

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function getApiCandidates() {
  return REMOTE_API_ENABLED ? [CONFIGURED_API_BASE] : [];
}

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage<T>(key: string, fallback: T): T {
  if (!storageAvailable()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!storageAvailable()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function shuffle<T>(input: T[]) {
  const next = [...input];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function randomId() {
  return crypto.randomUUID();
}

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

async function parseJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const candidates = getApiCandidates();

  if (candidates.length === 0) {
    throw new ApiRequestError("لم يتم ضبط خادم خارجي، وسيتم استخدام المحرّك المدمج داخل التطبيق.", false);
  }

  let latestError: Error = new ApiRequestError("تعذر الوصول إلى الخدمة.", true);

  for (const base of candidates) {
    try {
      const response = await fetch(`${base.replace(/\/+$/, "")}${path}`, init);
      const payload = await parseJsonSafely(response);

      if (!response.ok) {
        const retryable = [404, 502, 503, 504].includes(response.status);
        throw new ApiRequestError(parseErrorMessage(payload, `HTTP ${response.status}`), retryable);
      }

      if (payload === null) {
        throw new ApiRequestError("استجابة الخادم غير صالحة، سيتم التحويل إلى الوضع المحلي.", true);
      }

      return payload as T;
    } catch (error) {
      latestError =
        error instanceof ApiRequestError
          ? error
          : new ApiRequestError("الخادم غير متاح حاليًا، سيتم استخدام الوضع المحلي إن أمكن.", true);

      if (error instanceof ApiRequestError && !error.retryable) {
        throw error;
      }
    }
  }

  throw latestError;
}

function validateDistribution(distribution: DistributionEntry[]) {
  if (!Array.isArray(distribution) || distribution.length === 0) {
    throw new Error("يجب اختيار جزء واحد على الأقل.");
  }

  const total = distribution.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
  if (total !== 100) {
    throw new Error("مجموع النسب يجب أن يساوي 100%.");
  }

  for (const item of distribution) {
    if (!Number.isFinite(item.juz) || item.juz < 1 || item.juz > 30) {
      throw new Error("رقم الجزء يجب أن يكون بين 1 و30.");
    }
    if (!Number.isFinite(item.percentage) || item.percentage <= 0) {
      throw new Error("كل نسبة يجب أن تكون أكبر من صفر.");
    }
  }
}

function sanitizeQuestionTypes(questionTypes?: QuizQuestionType[]) {
  const next = unique((questionTypes ?? []).filter((type): type is QuizQuestionType => QUESTION_TYPES.includes(type)));
  return next.length > 0 ? next : QUESTION_TYPES;
}

function calculateQuestionAllocation(distribution: DistributionEntry[], totalQuestions: number) {
  const raw = distribution.map((item) => ({
    ...item,
    exact: (item.percentage / 100) * totalQuestions,
  }));

  const base = raw.map((item) => ({
    ...item,
    count: Math.floor(item.exact),
    decimal: item.exact % 1,
  }));

  let remaining = totalQuestions - base.reduce((sum, item) => sum + item.count, 0);
  const ranked = [...base].sort((a, b) => b.decimal - a.decimal);
  let pointer = 0;

  while (remaining > 0 && ranked.length > 0) {
    ranked[pointer % ranked.length].count += 1;
    pointer += 1;
    remaining -= 1;
  }

  return ranked.map(({ decimal, exact, ...rest }) => rest);
}

const quranAyahs: LocalAyah[] = (() => {
  const numericChapters = Object.entries(chapterModules)
    .map(([path, module]) => {
      const match = path.match(/\/(\d+)\.json$/);
      if (!match) {
        return null;
      }

      return {
        surahNumber: Number(match[1]),
        chapter: module.default,
      };
    })
    .filter((item): item is { surahNumber: number; chapter: QuranChapter } => Boolean(item))
    .sort((first, second) => first.surahNumber - second.surahNumber);

  let absoluteNumber = 1;
  const result: LocalAyah[] = [];

  for (const entry of numericChapters) {
    for (const verse of entry.chapter.verses) {
      const meta = getAyahMeta(absoluteNumber);
      result.push({
        id: `ayah-${absoluteNumber}`,
        absoluteNumber,
        surahNumber: entry.surahNumber,
        surahName: entry.chapter.name,
        ayahNumber: verse.id,
        text: verse.text,
        transliteration: verse.transliteration,
        juz: meta.juz,
      });
      absoluteNumber += 1;
    }
  }

  return result;
})();

const ayahsByJuz = quranAyahs.reduce<Map<number, LocalAyah[]>>((map, ayah) => {
  const current = map.get(ayah.juz) ?? [];
  current.push(ayah);
  map.set(ayah.juz, current);
  return map;
}, new Map());

const ayahsBySurah = quranAyahs.reduce<Map<number, LocalAyah[]>>((map, ayah) => {
  const current = map.get(ayah.surahNumber) ?? [];
  current.push(ayah);
  map.set(ayah.surahNumber, current);
  return map;
}, new Map());

const surahNames = unique(quranAyahs.map((ayah) => ayah.surahName));

function randomFromPool<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function buildQuotedOpening(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    return text;
  }

  const openingLength = Math.min(words.length, Math.max(3, Math.min(6, Math.ceil(words.length / 3))));
  const opening = words.slice(0, openingLength).join(" ");
  return openingLength < words.length ? `${opening} ...` : opening;
}

function buildMultipleChoiceQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const distractors = unique([
    targetAyah.juz,
    ((targetAyah.juz + 2) % 30) + 1,
    ((targetAyah.juz + 9) % 30) + 1,
    ((targetAyah.juz + 16) % 30) + 1,
  ]).map((value) => `جزء ${value}`);

  return {
    questionId: randomId(),
    type: "multiple_choice",
    prompt: `في أي جزء تقع الآية الكريمة: "${targetAyah.text}"؟`,
    choices: shuffle(distractors).slice(0, 4),
    correctAnswer: `جزء ${targetAyah.juz}`,
    juz: targetAyah.juz,
  };
}

function generateIdentifySurahQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const distractors = randomFromPool(
    surahNames.filter((name) => name !== targetAyah.surahName),
    3
  );

  return {
    questionId: randomId(),
    type: "identify_surah",
    prompt: `قال الله تعالى: "${targetAyah.text}" — في أي سورة وردت هذه الآية؟`,
    choices: shuffle([targetAyah.surahName, ...distractors]),
    correctAnswer: targetAyah.surahName,
    juz: targetAyah.juz,
  };
}

function generateCompleteAyahQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const words = targetAyah.text.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const cutIndex = Math.max(2, Math.floor(words.length / 2));
  const promptPart = words.slice(0, cutIndex).join(" ");
  const correctPart = words.slice(cutIndex).join(" ");

  const distractors = quranAyahs
    .filter((ayah) => ayah.absoluteNumber !== targetAyah.absoluteNumber)
    .map((ayah) => ayah.text.split(/\s+/).filter(Boolean))
    .filter((ayahWords) => ayahWords.length >= 4)
    .map((ayahWords) => ayahWords.slice(Math.max(2, Math.floor(ayahWords.length / 2))).join(" "))
    .filter((segment) => segment && segment !== correctPart)
    .slice(0, 100);

  return {
    questionId: randomId(),
    type: "complete_ayah",
    prompt: `أكمل الآية الكريمة: "${promptPart} ..."`,
    choices: shuffle([correctPart, ...randomFromPool(distractors, 3)]),
    correctAnswer: correctPart,
    juz: targetAyah.juz,
  };
}

function generateOrderingQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const surahAyahs = ayahsBySurah.get(targetAyah.surahNumber) ?? [];
  if (surahAyahs.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const currentIndex = surahAyahs.findIndex((ayah) => ayah.absoluteNumber === targetAyah.absoluteNumber);
  const startIndex = Math.min(Math.max(currentIndex - 1, 0), surahAyahs.length - 3);
  const sequence = surahAyahs.slice(startIndex, startIndex + 3);

  return {
    questionId: randomId(),
    type: "order_verses",
    prompt: "رتّب الآيات التالية بالترتيب الصحيح كما وردت في السورة:",
    orderingItems: shuffle(
      sequence.map((ayah) => ({
        id: `s${ayah.surahNumber}-a${ayah.ayahNumber}`,
        text: ayah.text,
      }))
    ),
    correctAnswer: sequence.map((ayah) => `s${ayah.surahNumber}-a${ayah.ayahNumber}`),
    juz: targetAyah.juz,
  };
}

function generateNextAyahQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const surahAyahs = ayahsBySurah.get(targetAyah.surahNumber) ?? [];
  const currentIndex = surahAyahs.findIndex((ayah) => ayah.absoluteNumber === targetAyah.absoluteNumber);
  const nextAyah = currentIndex >= 0 ? surahAyahs[currentIndex + 1] : null;

  if (!nextAyah) {
    return generateCompleteAyahQuestion(targetAyah);
  }

  const distractors = randomFromPool(
    quranAyahs
      .filter((ayah) => ayah.absoluteNumber !== nextAyah.absoluteNumber)
      .map((ayah) => ayah.text)
      .filter((text) => text && text !== nextAyah.text),
    3
  );

  return {
    questionId: randomId(),
    type: "next_ayah",
    prompt: `ما الآية التالية مباشرة لقوله تعالى: "${targetAyah.text}"؟`,
    choices: shuffle([nextAyah.text, ...distractors]),
    correctAnswer: nextAyah.text,
    juz: targetAyah.juz,
  };
}

function generateAyahNumberQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const surahAyahs = ayahsBySurah.get(targetAyah.surahNumber) ?? [];
  if (surahAyahs.length < 4) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  const candidateNumbers = unique([
    targetAyah.ayahNumber,
    Math.max(1, targetAyah.ayahNumber - 1),
    Math.max(1, targetAyah.ayahNumber - 2),
    Math.min(surahAyahs.length, targetAyah.ayahNumber + 1),
    Math.min(surahAyahs.length, targetAyah.ayahNumber + 2),
  ]);

  let distractors = candidateNumbers.filter((value) => value !== targetAyah.ayahNumber).map((value) => `الآية ${value}`);
  if (distractors.length < 3) {
    const additional = randomFromPool(
      Array.from({ length: surahAyahs.length }, (_, index) => index + 1)
        .filter((value) => value !== targetAyah.ayahNumber && !candidateNumbers.includes(value))
        .map((value) => `الآية ${value}`),
      3 - distractors.length
    );
    distractors = [...distractors, ...additional];
  }

  return {
    questionId: randomId(),
    type: "identify_ayah_number",
    prompt: `ما رقم هذه الآية في سورة ${targetAyah.surahName}: "${targetAyah.text}"؟`,
    choices: shuffle([`الآية ${targetAyah.ayahNumber}`, ...distractors.slice(0, 3)]),
    correctAnswer: `الآية ${targetAyah.ayahNumber}`,
    juz: targetAyah.juz,
  };
}

function generateReadingStartQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const surahAyahs = ayahsBySurah.get(targetAyah.surahNumber) ?? [];
  const firstAyah = surahAyahs[0];

  if (!firstAyah) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  // هذا النوع يعطي سؤالًا احترافيًا بصيغتين: البدء من أول السورة أو من آية محددة داخلها.
  const useSurahOpeningPrompt = targetAyah.ayahNumber === 1 || Math.random() < 0.35;
  const answerAyah = useSurahOpeningPrompt ? firstAyah : targetAyah;
  const prompt = useSurahOpeningPrompt
    ? `إذا طُلِب منك أن تبدأ القراءة من أول سورة ${answerAyah.surahName}، فما الآية التي تبدأ بها؟`
    : `إذا قيل لك: ابدأ القراءة من سورة ${answerAyah.surahName} ابتداءً من الآية ${answerAyah.ayahNumber}، فما أول آية تقرؤها؟`;

  const nearbyDistractors = surahAyahs
    .filter((ayah) => ayah.absoluteNumber !== answerAyah.absoluteNumber)
    .sort(
      (first, second) =>
        Math.abs(first.ayahNumber - answerAyah.ayahNumber) - Math.abs(second.ayahNumber - answerAyah.ayahNumber)
    )
    .map((ayah) => ayah.text);

  const openingDistractors = quranAyahs
    .filter((ayah) => ayah.ayahNumber === 1 && ayah.absoluteNumber !== answerAyah.absoluteNumber)
    .map((ayah) => ayah.text);

  const distractors = randomFromPool(
    unique([...nearbyDistractors, ...openingDistractors]).filter((text) => text && text !== answerAyah.text),
    3
  );

  if (distractors.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  return {
    questionId: randomId(),
    type: "reading_start",
    prompt,
    choices: shuffle([answerAyah.text, ...distractors]),
    correctAnswer: answerAyah.text,
    juz: answerAyah.juz,
  };
}

function generateReadFromQawlQuestion(targetAyah: LocalAyah): LocalStoredQuestion {
  const quotedOpening = buildQuotedOpening(targetAyah.text);
  const distractors = randomFromPool(
    surahNames.filter((name) => name !== targetAyah.surahName),
    3
  );

  if (distractors.length < 3) {
    return generateIdentifySurahQuestion(targetAyah);
  }

  return {
    questionId: randomId(),
    type: "read_from_qawl",
    prompt: `اقرأ من قوله تعالى: "${quotedOpening}" — من أي سورة من القرآن تبدأ هذه القراءة؟`,
    choices: shuffle([targetAyah.surahName, ...distractors]),
    correctAnswer: targetAyah.surahName,
    juz: targetAyah.juz,
  };
}

function generateQuestionFromAyah(targetAyah: LocalAyah, type: QuizQuestionType) {
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

function saveLocalSession(session: LocalStoredSession) {
  const sessions = readStorage<Record<string, LocalStoredSession>>(LOCAL_SESSIONS_KEY, {});
  sessions[session.quizId] = session;
  writeStorage(LOCAL_SESSIONS_KEY, sessions);
}

function readLocalSession(quizId: string) {
  const sessions = readStorage<Record<string, LocalStoredSession>>(LOCAL_SESSIONS_KEY, {});
  return sessions[quizId] ?? null;
}

function compareAnswer(expected: string | string[], actual: string | string[] | undefined) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return false;
    }
    return expected.every((item, index) => item === actual[index]);
  }

  return expected === actual;
}

function generateLocalQuiz({
  distribution,
  questionCount,
  durationMinutes,
  questionTypes,
}: {
  distribution: DistributionEntry[];
  questionCount: number;
  durationMinutes: number;
  questionTypes?: QuizQuestionType[];
}): QuizPayload {
  validateDistribution(distribution);

  if (!Number.isFinite(questionCount) || questionCount < 5) {
    throw new Error("عدد الأسئلة يجب أن يكون 5 على الأقل.");
  }

  const selectedQuestionTypes = sanitizeQuestionTypes(questionTypes);
  const allocation = calculateQuestionAllocation(distribution, questionCount);
  const selectedAyahIds = new Set<number>();
  const generated: LocalStoredQuestion[] = [];

  for (const entry of allocation) {
    const pool = (ayahsByJuz.get(entry.juz) ?? []).filter((ayah) => !selectedAyahIds.has(ayah.absoluteNumber));
    if (pool.length < entry.count) {
      throw new Error(`لا يوجد عدد كافٍ من الآيات في الجزء ${entry.juz}.`);
    }

    const pickedAyahs = randomFromPool(pool, entry.count);
    for (const ayah of pickedAyahs) {
      selectedAyahIds.add(ayah.absoluteNumber);
      const type = selectedQuestionTypes[Math.floor(Math.random() * selectedQuestionTypes.length)];
      generated.push(generateQuestionFromAyah(ayah, type));
    }
  }

  const quizId = randomId();
  const createdAt = new Date().toISOString();
  const session: LocalStoredSession = {
    quizId,
    createdAt,
    durationMinutes,
    distribution,
    questions: shuffle(generated).slice(0, questionCount),
  };

  saveLocalSession(session);

  return {
    quizId,
    createdAt,
    durationMinutes,
    mode: "local",
    questions: session.questions.map(({ correctAnswer, juz, ...question }) => question),
  };
}

function submitLocalQuiz({ quizId, answers }: { quizId: string; answers: Record<string, string | string[]> }): QuizResult {
  const session = readLocalSession(quizId);
  if (!session) {
    throw new Error("تعذر العثور على جلسة الاختبار المحلية.");
  }

  let correctAnswers = 0;
  const byJuzMap = new Map<number, { juz: number; total: number; correct: number }>();

  for (const question of session.questions) {
    const actualAnswer = answers?.[question.questionId];
    const isCorrect = compareAnswer(question.correctAnswer, actualAnswer);
    if (isCorrect) {
      correctAnswers += 1;
    }

    const current = byJuzMap.get(question.juz) ?? { juz: question.juz, total: 0, correct: 0 };
    current.total += 1;
    if (isCorrect) {
      current.correct += 1;
    }
    byJuzMap.set(question.juz, current);
  }

  const totalQuestions = session.questions.length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  saveLocalSession({
    ...session,
    submitted: true,
    score,
    userAnswers: answers,
  });

  return {
    score,
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    byJuz: Array.from(byJuzMap.values()).sort((first, second) => first.juz - second.juz),
    mode: "local",
  };
}

function readLocalAdminQuestions() {
  return readStorage<LocalAdminQuestion[]>(LOCAL_ADMIN_KEY, []);
}

function writeLocalAdminQuestions(items: LocalAdminQuestion[]) {
  writeStorage(LOCAL_ADMIN_KEY, items);
}

export async function generateQuizSession(input: {
  distribution: DistributionEntry[];
  questionCount: number;
  durationMinutes: number;
  questionTypes?: QuizQuestionType[];
  quizModel?: QuizModel;
}): Promise<QuizPayload> {
  const normalizedInput = {
    ...input,
    questionTypes: sanitizeQuestionTypes(input.questionTypes),
  };

  if (!REMOTE_API_ENABLED) {
    return generateLocalQuiz(normalizedInput);
  }

  try {
    const payload = await requestJson<RemoteQuizPayload>("/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedInput),
    });

    return { ...payload, mode: "remote" };
  } catch (error) {
    if (error instanceof ApiRequestError && !error.retryable) {
      throw error;
    }

    return generateLocalQuiz(normalizedInput);
  }
}

export async function submitQuizAnswers(input: {
  quizId: string;
  answers: Record<string, string | string[]>;
}): Promise<QuizResult> {
  if (!REMOTE_API_ENABLED) {
    return submitLocalQuiz(input);
  }

  try {
    const payload = await requestJson<RemoteQuizResult>("/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return { ...payload, mode: "remote" };
  } catch (error) {
    if (error instanceof ApiRequestError && !error.retryable) {
      throw error;
    }

    return submitLocalQuiz(input);
  }
}

export function recoverLocalQuizPayload(quizId: string): QuizPayload | null {
  const session = readLocalSession(quizId);
  if (!session || !Array.isArray(session.questions) || session.questions.length === 0) {
    return null;
  }

  const questions = session.questions
    .map(({ correctAnswer, juz, ...question }) => question)
    .filter(
      (question): question is QuizQuestion =>
        Boolean(question) &&
        typeof question.questionId === "string" &&
        typeof question.prompt === "string" &&
        typeof question.type === "string"
    );

  if (questions.length === 0) {
    return null;
  }

  return {
    quizId: session.quizId,
    createdAt: session.createdAt,
    durationMinutes: session.durationMinutes,
    mode: "local",
    questions,
  };
}

export async function listAdminQuestions(): Promise<AdminQuestionSummary[]> {
  if (!REMOTE_API_ENABLED) {
    return readLocalAdminQuestions().map(({ _id, type, prompt }) => ({ _id, type, prompt }));
  }

  try {
    return await requestJson<AdminQuestionSummary[]>("/admin/questions", { method: "GET" });
  } catch (error) {
    if (error instanceof ApiRequestError && !error.retryable) {
      throw error;
    }

    return readLocalAdminQuestions().map(({ _id, type, prompt }) => ({ _id, type, prompt }));
  }
}

export async function createAdminQuestion(input: AdminQuestionInput): Promise<AdminQuestionSummary> {
  if (!REMOTE_API_ENABLED) {
    const items = readLocalAdminQuestions();
    const nextItem: LocalAdminQuestion = {
      _id: randomId(),
      type: input.type,
      prompt: input.prompt,
      choices: input.choices,
      answer: input.answer,
    };
    writeLocalAdminQuestions([nextItem, ...items]);
    return { _id: nextItem._id, type: nextItem.type, prompt: nextItem.prompt };
  }

  try {
    return await requestJson<AdminQuestionSummary>("/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && !error.retryable) {
      throw error;
    }

    const items = readLocalAdminQuestions();
    const nextItem: LocalAdminQuestion = {
      _id: randomId(),
      type: input.type,
      prompt: input.prompt,
      choices: input.choices,
      answer: input.answer,
    };
    writeLocalAdminQuestions([nextItem, ...items]);
    return { _id: nextItem._id, type: nextItem.type, prompt: nextItem.prompt };
  }
}

export async function deleteAdminQuestion(id: string): Promise<void> {
  if (!REMOTE_API_ENABLED) {
    const items = readLocalAdminQuestions().filter((item) => item._id !== id);
    writeLocalAdminQuestions(items);
    return;
  }

  try {
    await requestJson<{ success: boolean }>(`/admin/questions/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiRequestError && !error.retryable) {
      throw error;
    }

    const items = readLocalAdminQuestions().filter((item) => item._id !== id);
    writeLocalAdminQuestions(items);
  }
}
