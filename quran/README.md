# Sheikh Mohamed Al-Wakeel Quran Quiz Platform

منصة عربية احترافية لاختبارات القرآن الكريم باسم:

**منصة الشيخ محمد الوكيل لاختبارات القرآن الكريم**

تتيح المنصة إنشاء اختبارات مخصصة من جميع أجزاء القرآن الكريم مع توزيع نسبي للأسئلة حسب الأجزاء، ودعم أنواع متعددة من الأسئلة، مع واجهة عربية كاملة واتجاه RTL.

---

## المزايا الرئيسية

- دعم جميع **30 جزءًا** من القرآن الكريم
- إنشاء اختبار ديناميكي حسب **نسب الأجزاء المختارة**
- التحقق من أن **مجموع النسب = 100%**
- منع التكرار في اختيار الآيات داخل الاختبار
- دعم **النموذج A** و **النموذج B**
- دعم أنواع أسئلة متعددة، منها:
  - أكمل الآية
  - رتّب الآيات
  - اذكر اسم السورة
  - في أي جزء؟
  - ما الآية التالية؟
  - ما رقم الآية؟
  - بداية القراءة
- واجهة عربية كاملة مع **RTL**
- تصميم متجاوب للهواتف وأجهزة الكمبيوتر
- وضع محلي احتياطي عند تعذر الوصول إلى الخادم لتفادي مشكلة `failed to fetch`
- لوحة إدارة أساسية لإضافة/عرض/حذف الأسئلة

---

## هيكل المشروع

```text
.
├── src/                      # واجهة React + Vite
├── backend/                  # خادم Express + MongoDB
│   └── src/
├── index.html
├── package.json             # حزم الواجهة
├── README.md
└── .gitignore
```

---

## المتطلبات

- Node.js 18+ أو أحدث
- npm 9+ أو أحدث
- MongoDB محليًا أو MongoDB Atlas

---

## إعداد وتشغيل الواجهة الأمامية Frontend

من جذر المشروع:

```bash
npm install
npm run dev
```

سيعمل التطبيق غالبًا على:

```text
http://localhost:5173
```

### بناء نسخة الإنتاج

```bash
npm run build
```

---

## إعداد وتشغيل الخادم Backend

انتقل إلى مجلد الخادم:

```bash
cd backend
npm install
```

أنشئ ملف `.env` داخل `backend/` اعتمادًا على الملف `.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/quran_quiz_platform
```

ثم شغّل الخادم:

```bash
npm run dev
```

أو للإنتاج:

```bash
npm start
```

سيعمل الخادم على:

```text
http://localhost:5000
```

---

## Seed لبيانات القرآن

بعد تشغيل MongoDB وضبط ملف البيئة:

```bash
cd backend
npm run seed
```

يقوم هذا الأمر بإدخال بيانات الآيات إلى قاعدة البيانات مع ربط:

- رقم السورة
- اسم السورة
- رقم الآية
- نص الآية
- الجزء
- الرقم التسلسلي العام للآية

> ملاحظة: الواجهة تحتوي أيضًا على وضع محلي يعتمد على بيانات قرآن مضمّنة داخل المشروع، لذلك يمكن تشغيل الاختبار حتى إذا لم يكن الخادم متاحًا.

---

## النموذج A و النموذج B

### النموذج A
توزيع تلقائي على جميع أنواع الأسئلة المتاحة.

### النموذج B
اختيار يدوي لأنواع الأسئلة المطلوبة داخل الاختبار.

الأنواع المدعومة حاليًا داخل النموذج B:

- أكمل الآية
- رتّب الآيات
- اذكر اسم السورة
- بداية القراءة
- في أي جزء؟
- ما الآية التالية؟
- ما رقم الآية؟

---

## API Documentation

### 1) فحص صحة الخادم

**GET** `/api/health`

#### Response

```json
{
  "status": "ok",
  "service": "quran-quiz-api"
}
```

---

### 2) إنشاء اختبار

**POST** `/api/quiz/generate`

#### Request Body

```json
{
  "distribution": [
    { "juz": 29, "percentage": 70 },
    { "juz": 30, "percentage": 30 }
  ],
  "questionCount": 20,
  "durationMinutes": 20,
  "questionTypes": [
    "complete_ayah",
    "identify_surah",
    "order_verses",
    "reading_start"
  ]
}
```

#### Example Response

```json
{
  "quizId": "f3c6c0c8-4e34-4d5e-8c52-123456789abc",
  "createdAt": "2026-04-15T12:00:00.000Z",
  "durationMinutes": 20,
  "questions": [
    {
      "questionId": "q1",
      "type": "identify_surah",
      "prompt": "قال الله تعالى: \"...\" - في أي سورة وردت هذه الآية؟",
      "choices": ["الملك", "النبأ", "المرسلات", "الإنسان"]
    }
  ]
}
```

---

### 3) إرسال الإجابات

**POST** `/api/quiz/submit`

#### Request Body

```json
{
  "quizId": "f3c6c0c8-4e34-4d5e-8c52-123456789abc",
  "answers": {
    "q1": "الملك",
    "q2": "الآية 5"
  }
}
```

#### Example Response

```json
{
  "score": 85,
  "totalQuestions": 20,
  "correctAnswers": 17,
  "wrongAnswers": 3,
  "byJuz": [
    { "juz": 29, "total": 14, "correct": 12 },
    { "juz": 30, "total": 6, "correct": 5 }
  ]
}
```

---

### 4) جلب أسماء الأجزاء

**GET** `/api/meta/juz`

#### Example Response

```json
[
  { "id": 1, "name": "الجزء الأول" },
  { "id": 2, "name": "الجزء الثاني" }
]
```

---

### 5) إدارة الأسئلة

#### جلب الأسئلة
**GET** `/api/admin/questions`

#### إضافة سؤال
**POST** `/api/admin/questions`

#### تحديث سؤال
**PUT** `/api/admin/questions/:id`

#### حذف سؤال
**DELETE** `/api/admin/questions/:id`

---

## طريقة النشر Deployment

### Frontend
يمكن نشر الواجهة على:
- Vercel
- Netlify
- Render Static Site

### Backend
يمكن نشر الخادم على:
- Render
- Railway
- VPS
- DigitalOcean

### MongoDB
يمكن استخدام:
- MongoDB Atlas

### متغيرات البيئة للواجهة
إذا أردت ربط الواجهة بخادم منشور خارجي، أضف متغير البيئة التالي:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

---

## طريقة رفع المشروع إلى GitHub

من جذر المشروع:

```bash
git init
git add .
git commit -m "Initial commit - Sheikh Mohamed Al-Wakeel Quran Quiz Platform"
```

ثم أنشئ مستودعًا جديدًا على GitHub، وبعدها:

```bash
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

---

## ملاحظات مهمة

- إذا كان الخادم أو قاعدة البيانات غير متاحين، ستعمل المنصة تلقائيًا في **الوضع المحلي** بدل إظهار خطأ `failed to fetch`.
- يوصى بتشغيل `npm run seed` داخل `backend` قبل استخدام وضع الخادم الكامل.
- يوصى بإضافة صور أو هوية بصرية لاحقًا إذا رغبت في تخصيص الهوية الإسلامية للمشروع بشكل أوسع.

---

## ترخيص الاستخدام

هذا المشروع جاهز للتطوير والتخصيص والرفع على GitHub.
