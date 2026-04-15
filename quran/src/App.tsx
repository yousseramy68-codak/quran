import { motion } from "framer-motion";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import {
  type AdminQuestionSummary,
  type DistributionEntry,
  type QuizModel,
  type QuizPayload,
  type QuizQuestionType,
  type QuizResult,
  QUESTION_TYPE_OPTIONS,
  REMOTE_API_ENABLED,
  createAdminQuestion,
  deleteAdminQuestion,
  generateQuizSession,
  listAdminQuestions,
  recoverLocalQuizPayload,
  submitQuizAnswers,
} from "./lib/quizApi";

const TOTAL_JUZ = Array.from({ length: 30 }, (_, index) => index + 1);
const QUESTION_TYPE_LABELS = Object.fromEntries(QUESTION_TYPE_OPTIONS.map((item) => [item.value, item.label])) as Record<QuizQuestionType, string>;
const appShell =
  "min-h-screen bg-[radial-gradient(circle_at_top,_#fbfdfb,_#f3f7f4_45%,_#e4efe7_100%)] text-[#163324]";
const LAST_SETUP_KEY = "smawq.last-setup-config";

type SetupSnapshot = {
  distribution: DistributionEntry[];
  questionCount: number;
  durationMinutes: number;
  quizModel: QuizModel;
  questionTypes: QuizQuestionType[];
};

function useSessionState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (value === null) {
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function saveLastSetup(snapshot: SetupSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(LAST_SETUP_KEY, JSON.stringify(snapshot));
}

function readLastSetup(): SetupSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(LAST_SETUP_KEY);
    return raw ? (JSON.parse(raw) as SetupSnapshot) : null;
  } catch {
    return null;
  }
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) { 
  return <div className={`rounded-3xl border border-white/70 bg-white/85 shadow-[0_18px_70px_rgba(17,44,30,0.08)] backdrop-blur ${className}`}>{children}</div>;
}

function StatusBanner({ mode }: { mode: "remote" | "local" }) {
  if (mode === "remote") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        الخادم الخارجي متصل، ويتم تشغيل الاختبار عبر الـ API بنجاح.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
      تعمل المنصة افتراضيًا بالمحرّك المدمج داخل التطبيق، ويمكن ربط خادم خارجي لاحقًا فقط عند ضبط <span dir="ltr">VITE_API_BASE_URL</span>.
    </div>
  );
}

function HomePage() {
  return (
    <main className={`${appShell} flex items-center`} dir="rtl">
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-24">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="space-y-7">
          <div className="inline-flex rounded-full border border-[#1f7a4c]/20 bg-white/80 px-4 py-2 text-sm font-bold text-[#1f7a4c]">
            منصة تعليمية عربية لاختبارات القرآن الكريم
          </div>
          <h1 className="text-4xl font-black leading-tight text-[#10291d] md:text-6xl">
            منصة الشيخ محمد الوكيل لاختبارات القرآن الكريم
          </h1>
          <p className="max-w-2xl text-lg leading-9 text-[#355744]">
            أنشئ اختبارًا مخصصًا من جميع أجزاء القرآن الكريم، وحدد نسبة الأسئلة لكل جزء، ثم احصل على نتيجة دقيقة وتحليل أداء
            واضح حسب الأجزاء.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/setup" className="rounded-2xl bg-[#1f7a4c] px-7 py-3 text-base font-extrabold text-white transition hover:bg-[#19653f]">
              ابدأ الاختبار الآن
            </Link>
            <Link to="/admin" className="rounded-2xl border border-[#204a36]/20 bg-white/70 px-7 py-3 font-bold text-[#214836] transition hover:bg-white">
              لوحة الإدارة
            </Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <Surface className="p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["30", "جزءًا متاحًا"],
                [String(QUESTION_TYPE_OPTIONS.length), "أنواع أسئلة متنوعة"],
                ["100%", "توزيع مرن حسب اختيارك"],
                ["RTL", "واجهة عربية كاملة"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-[#f5faf7] p-5 text-center">
                  <p className="text-3xl font-black text-[#175236]">{value}</p>
                  <p className="mt-2 text-sm font-semibold text-[#4d6e5d]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-gradient-to-l from-[#1f7a4c] to-[#2d9460] p-5 text-white">
              <p className="text-lg font-extrabold">اختبارات ذكية وتلقائية</p>
              <p className="mt-2 text-sm leading-7 text-white/90">
                اختر الأجزاء، اضبط النسب، وحدد عدد الأسئلة والمدة، ثم ابدأ مباشرة دون إعدادات معقدة.
              </p>
            </div>
          </Surface>
        </motion.div>
      </section>
    </main>
  );
}

function AdminPage() {
  const [items, setItems] = useState<AdminQuestionSummary[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<QuizQuestionType>("identify_surah");
  const [choices, setChoices] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAdminQuestions());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل أسئلة الإدارة.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {
      setMessage("تعذر تحميل أسئلة الإدارة.");
      setLoading(false);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!prompt.trim()) {
      setMessage("يرجى إدخال نص السؤال.");
      return;
    }

    const normalizedChoices = choices
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    const answerValue = type === "order_verses" ? answer.split("|").map((item) => item.trim()).filter(Boolean) : answer.trim();

    try {
      await createAdminQuestion({
        type,
        prompt: prompt.trim(),
        choices: normalizedChoices,
        answer: answerValue,
      });
      setPrompt("");
      setChoices("");
      setAnswer("");
      setMessage("تم حفظ السؤال بنجاح.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل حفظ السؤال.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteAdminQuestion(id);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حذف السؤال.");
    }
  };

  return (
    <main className={`${appShell} py-10`} dir="rtl">
      <section className="mx-auto w-full max-w-5xl px-6">
        <Surface className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-[#10291d]">لوحة إدارة الأسئلة</h2>
              <p className="mt-2 text-[#365745]">يمكنك إدارة الأسئلة يدويًا، وتعمل اللوحة أيضًا محليًا عند غياب الخادم.</p>
            </div>
            <Link to="/" className="rounded-2xl border border-[#204a36]/20 px-5 py-3 font-bold text-[#214836]">
              العودة للرئيسية
            </Link>
          </div>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="نص السؤال" className="rounded-2xl border border-[#cad9d0] bg-white px-4 py-3" />
            <select value={type} onChange={(event) => setType(event.target.value as QuizQuestionType)} className="rounded-2xl border border-[#cad9d0] bg-white px-4 py-3">
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input value={choices} onChange={(event) => setChoices(event.target.value)} placeholder="الخيارات مفصولة بعلامة |" className="rounded-2xl border border-[#cad9d0] bg-white px-4 py-3" />
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="الإجابة الصحيحة - وللترتيب استخدم |" className="rounded-2xl border border-[#cad9d0] bg-white px-4 py-3" />
            <button type="submit" className="w-fit rounded-2xl bg-[#1f7a4c] px-6 py-3 font-extrabold text-white">
              حفظ السؤال
            </button>
            {message && <p className="font-bold text-[#335744]">{message}</p>}
          </form>

          <div className="mt-10 space-y-3">
            {loading ? (
              <p className="font-semibold text-[#426555]">جاري التحميل...</p>
            ) : items.length === 0 ? (
              <p className="font-semibold text-[#426555]">لا توجد أسئلة محفوظة حاليًا.</p>
            ) : (
              items.map((item) => (
                <div key={item._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2ece5] bg-[#fbfdfb] p-4">
                  <div>
                    <p className="font-extrabold text-[#143223]">{item.prompt}</p>
                    <p className="mt-1 text-sm font-semibold text-[#547362]">{QUESTION_TYPE_LABELS[item.type]}</p>
                  </div>
                  <button onClick={() => remove(item._id)} className="rounded-xl bg-[#fff1f2] px-4 py-2 text-sm font-extrabold text-[#b42318]">
                    حذف
                  </button>
                </div>
              ))
            )}
          </div>
        </Surface>
      </section>
    </main>
  );
}

function SetupPage({ setQuiz, setResult }: { setQuiz: (value: QuizPayload | null) => void; setResult: (value: QuizResult | null) => void }) {
  const navigate = useNavigate();
  const [selectedJuz, setSelectedJuz] = useState<number[]>([30]);
  const [percentages, setPercentages] = useState<Record<number, number>>({ 30: 100 });
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [quizModel, setQuizModel] = useState<QuizModel>("B");
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuizQuestionType[]>([
    "complete_ayah",
    "order_verses",
    "identify_surah",
    "reading_start",
    "read_from_qawl",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalPercentage = useMemo(() => selectedJuz.reduce((sum, juz) => sum + (percentages[juz] ?? 0), 0), [selectedJuz, percentages]);
  const allQuestionTypes = useMemo(() => QUESTION_TYPE_OPTIONS.map((item) => item.value), []);

  const toggleJuz = (juz: number) => {
    setError("");
    setSelectedJuz((previous) => {
      if (previous.includes(juz)) {
        const next = previous.filter((item) => item !== juz);
        setPercentages((current) => {
          const updated = { ...current };
          delete updated[juz];
          return updated;
        });
        return next;
      }

      setPercentages((current) => ({ ...current, [juz]: 0 }));
      return [...previous, juz].sort((first, second) => first - second);
    });
  };

  const toggleQuestionType = (type: QuizQuestionType) => {
    setError("");
    setSelectedQuestionTypes((previous) =>
      previous.includes(type) ? previous.filter((item) => item !== type) : [...previous, type]
    );
  };

  const submitSetup = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (selectedJuz.length === 0) {
      setError("اختر جزءًا واحدًا على الأقل.");
      return;
    }

    if (totalPercentage !== 100) {
      setError("يجب أن يكون مجموع النسب 100% بالضبط.");
      return;
    }

    if (quizModel === "B" && selectedQuestionTypes.length === 0) {
      setError("في النموذج B يجب اختيار نوع سؤال واحد على الأقل.");
      return;
    }

    const distribution: DistributionEntry[] = selectedJuz.map((juz) => ({ juz, percentage: percentages[juz] ?? 0 }));
    const activeQuestionTypes = quizModel === "B" ? selectedQuestionTypes : allQuestionTypes;
    const setupSnapshot: SetupSnapshot = {
      distribution,
      questionCount,
      durationMinutes,
      quizModel,
      questionTypes: activeQuestionTypes,
    };

    try {
      setLoading(true);
      saveLastSetup(setupSnapshot);
      const payload = await generateQuizSession(setupSnapshot);
      setQuiz(payload);
      navigate("/quiz");
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر إنشاء الاختبار.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`${appShell} py-10`} dir="rtl">
      <section className="mx-auto w-full max-w-6xl px-6">
        <Surface className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-[#10291d]">إعداد الاختبار</h2>
              <p className="mt-2 text-[#345644]">اختر الأجزاء، واضبط النسب، ثم حدّد نموذج التوليد وأنواع الأسئلة.</p>
            </div>
            <Link to="/" className="rounded-2xl border border-[#204a36]/20 px-5 py-3 font-bold text-[#214836]">
              العودة للرئيسية
            </Link>
          </div>

          <form className="mt-8 space-y-8" onSubmit={submitSetup}>
            <div>
              <p className="mb-4 text-lg font-extrabold">نموذج الاختبار</p>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setQuizModel("A")}
                  className={`rounded-3xl border p-5 text-right transition ${
                    quizModel === "A" ? "border-[#1f7a4c] bg-[#edf8f1]" : "border-[#d8e5de] bg-white hover:bg-[#fbfdfb]"
                  }`}
                >
                  <p className="text-lg font-black text-[#10291d]">النموذج A</p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-[#4a6b5a]">
                    توزيع تلقائي على جميع أنواع الأسئلة المتاحة، مناسب للامتحان المتنوع السريع.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setQuizModel("B")}
                  className={`rounded-3xl border p-5 text-right transition ${
                    quizModel === "B" ? "border-[#1f7a4c] bg-[#edf8f1]" : "border-[#d8e5de] bg-white hover:bg-[#fbfdfb]"
                  }`}
                >
                  <p className="text-lg font-black text-[#10291d]">النموذج B</p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-[#4a6b5a]">
                    اختيار مخصص لأنواع الأسئلة مثل: أكمل، رتّب، اذكر اسم السورة، بداية القراءة، واقرأ من قوله تعالى، مع إمكانية تفعيل أنواع إضافية.
                  </p>
                </button>
              </div>
            </div>

            <div>
              <p className="mb-4 text-lg font-extrabold">الأجزاء المتاحة</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {TOTAL_JUZ.map((juz) => {
                  const active = selectedJuz.includes(juz);
                  return (
                    <button
                      type="button"
                      key={juz}
                      onClick={() => toggleJuz(juz)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-extrabold transition ${
                        active ? "border-[#1f7a4c] bg-[#1f7a4c] text-white" : "border-[#c9d8d0] bg-white text-[#204935] hover:bg-[#f5faf7]"
                      }`}
                    >
                      جزء {juz}
                    </button>
                  );
                })}
              </div>
            </div>

            {quizModel === "B" && (
              <Surface className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold">أنواع الأسئلة في النموذج B</p>
                    <p className="mt-1 text-sm font-semibold text-[#4a6b5a]">اختر نوعًا واحدًا أو أكثر، وسيتم توليد الاختبار من هذه الأنواع فقط.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionTypes(allQuestionTypes)}
                    className="rounded-2xl border border-[#d1ddd5] px-4 py-2 text-sm font-extrabold text-[#214836]"
                  >
                    تحديد الكل
                  </button>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {QUESTION_TYPE_OPTIONS.map((option) => {
                    const active = selectedQuestionTypes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleQuestionType(option.value)}
                        className={`rounded-3xl border p-4 text-right transition ${
                          active ? "border-[#1f7a4c] bg-[#edf8f1]" : "border-[#d8e5de] bg-white hover:bg-[#fbfdfb]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-base font-black text-[#10291d]">{option.label}</span>
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${active ? "bg-[#1f7a4c] text-white" : "bg-[#eef4f0] text-[#5b7a6a]"}`}>
                            {active ? "✓" : "+"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-7 text-[#4a6b5a]">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </Surface>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Surface className="p-5">
                <p className="text-lg font-extrabold">التوزيع النسبي</p>
                <div className="mt-4 space-y-3">
                  {selectedJuz.map((juz) => (
                    <label key={juz} className="flex items-center gap-3 rounded-2xl bg-[#f7fbf8] px-4 py-3">
                      <span className="w-24 font-extrabold text-[#173625]">جزء {juz}</span>
                      <input
                        min={0}
                        max={100}
                        type="number"
                        value={percentages[juz] ?? 0}
                        onChange={(event) => setPercentages((current) => ({ ...current, [juz]: Number(event.target.value) }))}
                        className="w-28 rounded-xl border border-[#cad9d0] bg-white px-3 py-2"
                      />
                      <span className="font-bold">%</span>
                    </label>
                  ))}
                </div>
                <p className={`mt-4 font-extrabold ${totalPercentage === 100 ? "text-[#1b6d43]" : "text-[#b42318]"}`}>
                  المجموع الحالي: {totalPercentage}%
                </p>
              </Surface>

              <Surface className="p-5">
                <p className="text-lg font-extrabold">خيارات الاختبار</p>
                <div className="mt-4 grid gap-4">
                  <label className="space-y-2">
                    <span className="block font-bold">عدد الأسئلة</span>
                    <input min={5} max={100} type="number" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="w-full rounded-2xl border border-[#cad9d0] bg-white px-4 py-3" />
                  </label>
                  <label className="space-y-2">
                    <span className="block font-bold">مدة الاختبار بالدقائق</span>
                    <input min={5} max={120} type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="w-full rounded-2xl border border-[#cad9d0] bg-white px-4 py-3" />
                  </label>
                  <div className="rounded-2xl bg-[#f5faf7] p-4 text-sm font-semibold leading-7 text-[#3c5d4c]">
                    {quizModel === "B"
                      ? `الأنواع المختارة حاليًا: ${selectedQuestionTypes.length} من ${QUESTION_TYPE_OPTIONS.length}.`
                      : "في النموذج A سيتم استخدام جميع أنواع الأسئلة تلقائيًا."}
                  </div>
                  <div className="rounded-2xl bg-[#f5faf7] p-4 text-sm font-semibold leading-7 text-[#3c5d4c]">
                    {REMOTE_API_ENABLED
                      ? "تم ضبط خادم خارجي لهذا المشروع، وسيتم استخدامه عند إنشاء الاختبار مع بقاء المحرّك المدمج كخيار احتياطي."
                      : "هذا الإصدار يعمل افتراضيًا بالمحرّك المدمج داخل التطبيق، لذلك لن تتم أي محاولة اتصال بخادم خارجي ما لم يتم ضبط VITE_API_BASE_URL."}
                  </div>
                </div>
              </Surface>
            </div>

            {error && <p className="font-extrabold text-[#b42318]">{error}</p>}

            <button type="submit" disabled={loading} className="rounded-2xl bg-[#1f7a4c] px-8 py-4 font-extrabold text-white transition hover:bg-[#19653f] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "جاري إنشاء الاختبار..." : "بدء الاختبار"}
            </button>
          </form>
        </Surface>
      </section>
    </main>
  );
}

function QuizPage({ quiz, setQuiz, setResult }: { quiz: QuizPayload | null; setQuiz: (value: QuizPayload | null) => void; setResult: (value: QuizResult | null) => void }) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerFinished, setTimerFinished] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryAttemptedFor, setRecoveryAttemptedFor] = useState<string | null>(null);

  const hasRenderableQuestions = Boolean(
    quiz &&
      Array.isArray(quiz.questions) &&
      quiz.questions.length > 0 &&
      quiz.questions.every((question) => question && typeof question.questionId === "string" && typeof question.prompt === "string" && typeof question.type === "string")
  );

  useEffect(() => {
    if (!quiz) {
      setRemainingSeconds(null);
      return;
    }

    setCurrentIndex(0);
    setAnswers({});
    setSubmitting(false);
    setError("");
    setTimerFinished(false);
    setRemainingSeconds(hasRenderableQuestions ? Math.max(quiz.durationMinutes, 1) * 60 : null);
  }, [quiz?.quizId, quiz?.questions.length, hasRenderableQuestions]);

  useEffect(() => {
    if (!quiz || hasRenderableQuestions || recovering || recoveryAttemptedFor === quiz.quizId) {
      return;
    }

    let active = true;

    const recoverQuiz = async () => {
      setRecovering(true);
      setError("");
      setRecoveryAttemptedFor(quiz.quizId);

      try {
        const localRecovered = recoverLocalQuizPayload(quiz.quizId);
        if (localRecovered?.questions.length) {
          if (active) {
            setQuiz(localRecovered);
          }
          return;
        }

        const lastSetup = readLastSetup();
        if (lastSetup) {
          const regeneratedQuiz = await generateQuizSession(lastSetup);
          if (active) {
            setQuiz(regeneratedQuiz);
          }
          return;
        }

        if (active) {
          setError("تعذر استرجاع أسئلة الاختبار الحالي. أعد إنشاء الاختبار من صفحة الإعدادات.");
        }
      } catch (recoveryError) {
        if (active) {
          setError(recoveryError instanceof Error ? recoveryError.message : "تعذر استرجاع الأسئلة الحالية.");
        }
      } finally {
        if (active) {
          setRecovering(false);
        }
      }
    };

    recoverQuiz().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [quiz, hasRenderableQuestions, recovering, recoveryAttemptedFor, setQuiz]);

  const submit = useCallback(async () => {
    if (!quiz || !hasRenderableQuestions) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const resultPayload = await submitQuizAnswers({ quizId: quiz.quizId, answers });
      setResult(resultPayload);
      navigate("/results");
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر إرسال الإجابات.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, navigate, quiz, setResult]);

  useEffect(() => {
    if (!quiz || !hasRenderableQuestions || remainingSeconds === null || remainingSeconds <= 0 || timerFinished || recovering) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => {
        if (value === null || value <= 1) {
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [quiz, hasRenderableQuestions, remainingSeconds, timerFinished, recovering]);

  useEffect(() => {
    if (!quiz || !hasRenderableQuestions || remainingSeconds === null || remainingSeconds > 0 || timerFinished || submitting || recovering) {
      return;
    }

    setTimerFinished(true);
    submit().catch(() => undefined);
  }, [quiz, hasRenderableQuestions, remainingSeconds, timerFinished, submitting, recovering, submit]);

  if (!quiz) {
    return <Navigate to="/setup" replace />;
  }

  const currentQuestion = hasRenderableQuestions ? quiz.questions[currentIndex] ?? null : null;
  const progress = quiz.questions.length > 0 ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0;
  const displaySeconds = remainingSeconds ?? 0;
  const minutes = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
  const seconds = String(displaySeconds % 60).padStart(2, "0");
  const orderingAnswer = currentQuestion && Array.isArray(answers[currentQuestion.questionId]) ? (answers[currentQuestion.questionId] as string[]) : [];

  const selectOrderingItem = (itemId: string) => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => {
      const previous = Array.isArray(current[currentQuestion.questionId]) ? (current[currentQuestion.questionId] as string[]) : [];
      if (previous.includes(itemId)) {
        return current;
      }
      return { ...current, [currentQuestion.questionId]: [...previous, itemId] };
    });
  };

  const resetOrdering = () => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => ({ ...current, [currentQuestion.questionId]: [] }));
  };

  return (
    <main className={`${appShell} py-10`} dir="rtl">
      <section className="mx-auto w-full max-w-5xl px-6">
        <Surface className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-[#1f7a4c]">سؤال {quiz.questions.length > 0 ? currentIndex + 1 : 0} من {quiz.questions.length}</p>
              <h2 className="mt-1 text-2xl font-black text-[#10291d]">الاختبار الجاري</h2>
            </div>
            <div className="rounded-2xl bg-[#f5faf7] px-4 py-3 text-left">
              <p className="text-sm font-bold text-[#557364]">الوقت المتبقي</p>
              <p className="text-xl font-black text-[#18442e]">{minutes}:{seconds}</p>
            </div>
          </div>

          <div className="mt-5">
            <StatusBanner mode={quiz.mode} />
          </div>

          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-[#dce8e0]">
            <motion.div className="h-full bg-[#1f7a4c]" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
          </div>

            {recovering ? (
              <div className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-6 text-center text-sky-900">
                <p className="text-xl font-black">جارِ استرجاع أسئلة الاختبار...</p>
                <p className="mt-2 font-semibold">نقوم الآن بإعادة تحميل الجلسة المحلية أو توليد نسخة جديدة من نفس الإعدادات.</p>
              </div>
            ) : !currentQuestion ? (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-[#7a4b14]">
                <p className="text-xl font-black">تعذر عرض أسئلة هذا الاختبار.</p>
                <p className="mt-2 font-semibold">أعد إنشاء الاختبار من صفحة الإعدادات، وسيتم توليد مجموعة جديدة من الأسئلة.</p>
                <div className="mt-5 flex justify-center">
                  <Link to="/setup" className="rounded-2xl bg-[#1f7a4c] px-6 py-3 font-extrabold text-white">
                    العودة إلى الإعدادات
                  </Link>
                </div>
              </div>
            ) : (
              <motion.article key={currentQuestion.questionId} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
                <div className="inline-flex rounded-full bg-[#edf8f1] px-4 py-2 text-sm font-extrabold text-[#1f7a4c]">
                  {QUESTION_TYPE_LABELS[currentQuestion.type]}
                </div>
                <p className="text-2xl leading-[2.2] text-[#10291d]">{currentQuestion.prompt}</p>

                {currentQuestion.type !== "order_verses" &&
                  currentQuestion.choices?.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.questionId]: choice }))}
                      className={`block w-full rounded-2xl border px-4 py-4 text-right font-semibold transition ${
                        answers[currentQuestion.questionId] === choice ? "border-[#1f7a4c] bg-[#ecf7f0] text-[#163324]" : "border-[#c8d7cf] bg-white hover:bg-[#f8fbf9]"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}

                {currentQuestion.type === "order_verses" && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-[#446555]">اضغط على الآيات بالترتيب الصحيح. لن تُضاف الآية نفسها مرتين.</p>
                    <div className="grid gap-3">
                      {currentQuestion.orderingItems?.map((item, index) => {
                        const selectedIndex = orderingAnswer.indexOf(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectOrderingItem(item.id)}
                            className={`block w-full rounded-2xl border px-4 py-4 text-right transition ${
                              selectedIndex >= 0 ? "border-[#1f7a4c] bg-[#ecf7f0]" : "border-[#c8d7cf] bg-white hover:bg-[#f8fbf9]"
                            }`}
                          >
                            <span className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef6f1] text-sm font-black text-[#1f7a4c]">
                              {selectedIndex >= 0 ? selectedIndex + 1 : index + 1}
                            </span>
                            {item.text}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={resetOrdering} className="rounded-xl border border-[#d3ddd7] px-4 py-2 font-bold text-[#214836]">
                        إعادة ترتيب الإجابة
                      </button>
                      <p className="text-sm font-bold text-[#1f7a4c]">
                        عدد العناصر المختارة: {orderingAnswer.length} / {currentQuestion.orderingItems?.length ?? 0}
                      </p>
                    </div>
                  </div>
                )}
              </motion.article>
            )}

          {error && <p className="mt-5 font-extrabold text-[#b42318]">{error}</p>}

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <button type="button" disabled={currentIndex === 0 || !currentQuestion} onClick={() => setCurrentIndex((value) => value - 1)} className="rounded-2xl border border-[#c8d7cf] px-5 py-3 font-extrabold text-[#214836] disabled:opacity-50">
              السؤال السابق
            </button>

            {currentQuestion && currentIndex < quiz.questions.length - 1 ? (
              <button type="button" onClick={() => setCurrentIndex((value) => value + 1)} className="rounded-2xl bg-[#1f7a4c] px-6 py-3 font-extrabold text-white">
                السؤال التالي
              </button>
            ) : (
              <button type="button" disabled={submitting || !currentQuestion} onClick={submit} className="rounded-2xl bg-[#1f7a4c] px-6 py-3 font-extrabold text-white disabled:opacity-60">
                {submitting ? "جاري التصحيح..." : "إنهاء الاختبار"}
              </button>
            )}
          </div>
        </Surface>
      </section>
    </main>
  );
}

function ResultsPage({ result }: { result: QuizResult | null }) {
  if (!result) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <main className={`${appShell} py-10`} dir="rtl">
      <section className="mx-auto w-full max-w-4xl px-6">
        <Surface className="p-6 md:p-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-4xl font-black text-[#10291d]">النتيجة النهائية</h2>
            <StatusBanner mode={result.mode ?? "remote"} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f5faf7] p-5 text-center">
                <p className="text-sm font-bold text-[#557364]">الدرجة</p>
                <p className="mt-2 text-3xl font-black text-[#18442e]">{result.score}%</p>
              </div>
              <div className="rounded-2xl bg-[#f5faf7] p-5 text-center">
                <p className="text-sm font-bold text-[#557364]">إجابات صحيحة</p>
                <p className="mt-2 text-3xl font-black text-[#18442e]">{result.correctAnswers}</p>
              </div>
              <div className="rounded-2xl bg-[#f5faf7] p-5 text-center">
                <p className="text-sm font-bold text-[#557364]">إجابات خاطئة</p>
                <p className="mt-2 text-3xl font-black text-[#18442e]">{result.wrongAnswers}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-lg font-extrabold">تفصيل الأداء حسب الأجزاء</p>
              {result.byJuz.map((item) => (
                <div key={item.juz} className="flex items-center justify-between rounded-2xl bg-[#fbfdfb] px-4 py-4">
                  <span className="font-extrabold text-[#173625]">جزء {item.juz}</span>
                  <span className="font-bold text-[#446555]">{item.correct} / {item.total}</span>
                </div>
              ))}
            </div>

            <Link to="/setup" className="inline-flex rounded-2xl bg-[#1f7a4c] px-7 py-3 font-extrabold text-white">
              إنشاء اختبار جديد
            </Link>
          </motion.div>
        </Surface>
      </section>
    </main>
  );
}

export default function App() {
  const [quiz, setQuiz] = useSessionState<QuizPayload | null>("smawq.current-quiz", null);
  const [result, setResult] = useSessionState<QuizResult | null>("smawq.current-result", null);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/setup" element={<SetupPage setQuiz={setQuiz} setResult={setResult} />} />
      <Route path="/quiz" element={<QuizPage quiz={quiz} setQuiz={setQuiz} setResult={setResult} />} />
      <Route path="/results" element={<ResultsPage result={result} />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
