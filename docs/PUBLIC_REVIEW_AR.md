# مراجعة وتطوير Prolific_Automatic_Studies

التاريخ: 2026-10-02. [المستودع العام](https://github.com/aymank2020/Prolific_Automatic_Studies).
المصدر الذي بدأت منه المراجعة: `3b57b5355ef00c3ed0201ec6c0fb2090a4a8f5a3`. فرع التطوير: `codex/review-develop-2026-10-02`.

## وظيفة المشروع ونطاق المراجعة

امتداد Chrome Manifest V3 لمراقبة الدراسات والإشعارات والسجل. هذه الخطة تركز على موثوقية السجل واستمرار التوقف عند rate limit؛ لم تنفذ حجزًا أو إجابة أو إرسالًا لدراسة، ولم تضف وسائل تجاوز قيود المنصة.

راجعت بنية الملفات بصورة متكررة، وتعليمات AGENTS المتاحة، وملفات التشغيل والتبعيات والاختبارات والمستهلكين المرتبطين بالتغييرات. جرى العمل في نسخة معزولة؛ لم تتصل هذه المراجعة بخادم إنتاج أو قاعدة بيانات مستخدم أو جلسة دراسة حقيقية. هذه نتائج تنفيذ محلي محدد، وليست ادعاء مراجعة كل سطر أو جاهزية إنتاج شاملة.

## نتائج موثقة

- P1: السجل كان يقرأ sync ويكتب local، بينما popup يقرأ local؛ تضيع السجلات السابقة. القراءة والكتابة أصبحتا local مع طابور لعمليات الكتابة: [src/background.ts:281](../src/background.ts#L281).
- P2: رسالة study-reserved سجلت مرتين؛ أزيل الاستدعاء المكرر.
- P1: setTimeout لمدة30 دقيقة لا يصمد أمام تعليق service worker؛ التوقف أصبح تاريخًا محفوظًا وChrome alarm: [src/background.ts:253](../src/background.ts#L253).
- P2: مسار الصوت الموجود يستخدم offscreen دون صلاحية؛ أضيفت صلاحية manifest اللازمة.

## خطة التغيير المنفذة

1. P1 — توحيد تخزين السجل وتسلسل كتاباته ومنع التكرار: منفذ.
2. P1 — حفظ cooldown وإعادة جدولته عند الاستيقاظ؛ التحفيز اليدوي والسريع يحترمان التوقف، ولا يعيدان تفعيل الحجز: منفذ.
3. P2 — بناء dist الذي يحمّله manifest، وإضافة6 اختبارات runtime محلية وتوثيق حدود التحقق: منفذ.

## التحقق الفعلي

`npm ci --ignore-scripts --no-audit --no-fund` و`npx tsc --noEmit`: نجحا. `npm test` يبني TypeScript ثم يشغّل **6/6** اختبارات Node على `dist/background.js` داخل VM مع Chrome API fixture. رسالتا الحجز وrate-limit تدخلان عبر listener المسجل فعلًا. تمت إعادة إنشاء worker فوق نفس storage وإطلاق alarm انتهاء التوقف. لا اتصال بحساب أو API خارجي أثناء الاختبار.

## فحص التكامل والأثر

طُبقت مهارة Integration & Impact Review بعد مراجعة المصدر والاختبارات والفروق النهائية.

manifest.service_worker → dist/background.js → chrome.runtime.onMessage → history local الذي يستهلكه popup؛ تثبت الاختبارات بقاء القديم والجديد وعدم فقدان كتابتين متزامنتين. alarm → setupAlarms → تخزين cooldown → توقف polling ثم استئنافه بعد المدة، وautoReserveEnabled يبقى false. المرجع: [tests/background.test.cjs:63](../tests/background.test.cjs#L63). تعديل src وحده غير كاف، لذلك تضمّن التغيير dist المبني. المسارات الموجودة للذكاء الاصطناعي والحجز لم تُختبر أو تُطور.

## أولويات المتابعة والفجوات غير المنفذة

1. P1 — تحقق يدوي في ملف Chrome جديد من ظهور الإشعار والصوت واستمرار التوقف بعد تعليق worker؛ غير منفذ.
2. P1 — مراجعة سلوك الأتمتة السابق مقابل قواعد المنصة؛ العبارات التسويقية عن منع الحظر غير مثبتة.
3. P2 — ربط completion code بمعرف الدراسة بدل أحدث سجل فقط، وتوثيق التعامل مع أخطاء storage. لا دليل سلامة حساب أو قبول منصة.

## البحث المستخدم لاتخاذ القرار

- [Chrome MV3 service workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers?hl=en): العامل مؤقت ولا يعتمد على timer طويل أو globals لحفظ الحالة.
- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): الجدولة وإعادة إنشاء alarm بعد التشغيل.
- [Chrome offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen): الصلاحية مطلوبة للمستند المخفي المستخدم للصوت.

تستند نتائج الأعطال والإصلاح إلى ملفات هذا المستودع والاختبارات المحلية؛ توثيق المورد يشرح سبب اختيار التصميم ولا يثبت نجاح النشر.
