# Medora — الداتابيز بتاعتك بعد التبسيط (V2)

> **الملف ده بيشرح الداتابيز الحقيقية اللي شغالة على جهازك دلوقتي.**
> مش تصميم على الورق. كل جدول مكتوب هنا موجود فعلاً في PostgreSQL، وكل قاعدة
> (constraint) أو trigger مكتوبة هنا متجربة وبتشتغل.
>
> - عدد الجداول: **42** = 39 بعد التبسيط + 3 جداول لـ Admin (اتضافوا من شغل التيم).
> - الميجريشنز: `001` لحد `013` — كلها متطبقة.
> - الداتابيز: `medora_v1` على `localhost:5432`.
> - الـ ERD الرسمي: [`medora.dbml`](./medora.dbml) — ومتطابق حرف بحرف مع الداتابيز.

---

## 1. الأول: إيه اللي حصل بالظبط؟

في التصميم القديم كان عندنا 45 جدول. ستة منهم كانوا زيادة، بمعنى إن
المعلومة اللي فيهم ممكن تعيش في جدول تاني موجود أصلاً من غير ما نخسر حاجة.
عشان كده عملنا 6 عمليات دمج (consolidation)، ونزلنا من 45 لـ 39.

وبعدها دمجنا شغل الـ Admin Backend بتاع التيم: ضفنا 3 جداول
(`departments`, `staff_profiles`, `user_invitations`)، فبقى الإجمالي **42**.

**مهم:** الست جداول دي **مكانت موجودة في الداتابيز أصلاً**. يعني إحنا مكانش
محتاجين نمسح جداول ولا ننقل داتا. عملنا الحاجة الصح من الأول: كتبنا الشكل
البسيط مباشرة في الميجريشنز. ده أحسن من إنك تعمل جدول بايظ وبعدين تمسحه.

### الست عمليات الدمج

| # | الجدول القديم | راح فين | بقى إيه |
|---|---|---|---|
| 1 | `appointment_status_history` | `audit_logs` | صف بـ `event_type = appointment.status_changed` |
| 2 | `transcript_approvals` | `transcript_versions` | أعمدة `review_decision` / `reviewed_by_user_id` / `reviewed_at` / `review_note` |
| 3 | `report_approvals` | `report_versions` | نفس الأعمدة الأربعة |
| 4 | `report_deliveries` | `medical_reports` | أعمدة `publication_state` / `published_version_id` / `published_at` / `published_by_user_id` |
| 5 | `document_extraction_jobs` | `agent_executions` | `agent_code = ocr_extraction` + أعمدة `reference_document_version_id` و `engine` |
| 6 | `security_events` | `audit_logs` | صف بـ `event_category = security` |

**ليه الدمج ده صح؟** لأن في كل حالة من الست، العلاقة بين الجدولين كانت
**واحد لواحد** (1:1). يعني كل صف في الجدول القديم كان ليه صف واحد بس في
الجدول الجديد. ولما تكون العلاقة 1:1، الجدولين بيبقوا جدول واحد بس مكسور
على اتنين — وده اللي بنسميه "جدول مش محتاجينه".

**أما الأماكن اللي العلاقة فيها واحد لكثير (1:N) — زي `report_versions`
نفسها، أو `test_results` — دي استحالة تندمج، وفضلت زي ما هي.**

---

## 2. الصورة الكبيرة: رحلة المريض من أول ما يسجل لحد التقرير

```
مريض يسجل  →  بروفايل  →  يحجز ميعاد  →  موظف الاستقبال يأكد
   ↓
الدكتور يعمل الاستشارة  →  موافقة على التسجيل  →  تسجيل الصوت
   ↓
تحويل الكلام لنص (draft)  →  الدكتور يراجع ويوافق
   ↓
Agent 1  →  3 تقارير  →  الدكتور يوافق
   ↓
Report 1 →  يتنشر في بوابة المريض
Report 2 →  Agent 2 يقترح تحديث السجل الطبي →  الدكتور يوافق →  يتكتب
Report 3 →  تقرير طبي داخلي (لسه مش محدد مصيره)
   ↓
Agent 3  →  يقترح مواعيد متابعة  →  موافقة  →  حجز حقيقي
```

وكل خطوة في الرحلة دي ببتسجل في `audit_logs`. عشان كده `audit_logs` هي
الجدول اللي هتشوفه كتير.

---

## 3. الموديول الأول: Auth (تسجيل الدخول والصلاحيات)

### بيعمل إيه؟
ده اللي بيجاوب على سؤال: **مين أنت، وإيه المسموح لك؟**
المريض بيسجل بنفسه. الدكتور والموظف **مش** بيسجلوا بنفسهم — الأدمن هو اللي
بيعملهم الحساب.

### الجداول (6)

| الجدول | ليه موجود؟ |
|---|---|
| `users` | كل البشر في النظام: مريض، دكتور، موظف، أدمن. جدول واحد للكل. |
| `roles` | أنواع الحسابات: `patient`, `doctor`, `receptionist`, `admin`. |
| `user_roles` | مين عنده إيه. علاقة many-to-many. |
| `permissions` | الصلاحيات الدقيقة: `reports.approve`, `appointments.manage` ... |
| `role_permissions` | كل رول عنده إيه صلاحية. |
| `sessions` | الجلسات المفتوحة (token hash، مش الـ token نفسه). |

### العلاقات
- `user_roles.user_id → users.id`
- `user_roles.role_id → roles.id`
- `sessions.user_id → users.id`
- `users.created_by → users.id` (الأدمن اللي عمل الحساب)

### لوحة التحكم
كل اللوحات بتستخدمه. مفيش حاجة بتشتغل من غيره.

### الباك إند بيعمل إيه؟
`Backend/services/authService.js` بيشفر الباسورد بـ argon2، بيعمل session،
وبيحط الـ token في cookie. `middleware/auth.js` بيقرأ الـ cookie ويتأكد إن
الجلسة مش منتهية ومش ملغية.

### مثال عملي (قراءة)
```sql
SELECT u.email, r.name AS role
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r       ON r.id = ur.role_id
WHERE u.id = $1;
```

### قاعدة مهمة
في trigger اسمه `trg_enforce_single_admin` بيمنع إن يكون فيه أكتر من أدمن
واحد في الداتابيز كلها. جرّب تعمل أدمن تاني وهيرفض.

---

## 4. الموديول التاني: Profiles (البروفايلات)

### بيعمل إيه؟
`users` فيه الاسم والإيميل والباسورد بس. البيانات الشخصية والمهنية ليها
جداول لوحدها، لأن المريض بيكملها بعد ما يسجل، والدكتور بياناته مختلفة تماماً.

### الجداول (3)

| الجدول | ليه موجود؟ |
|---|---|
| `patient_profiles` | تاريخ الميلاد، التليفون، النوع. عمود `profile_completed_at` بيقول البروفايل كامل ولا لأ. |
| `specialties` | التخصصات (قلب، جلدية...). جدول مرجعي عشان الفلترة تشتغل صح. |
| `doctor_profiles` | رقم الترخيص، التخصص، نبذة. `license_verified_at` معناها الأدمن راجع الترخيص. |

### العلاقات
- `patient_profiles.user_id → users.id` (واحد لواحد، والـ PK هو نفس الـ user_id)
- `doctor_profiles.user_id → users.id`
- `doctor_profiles.specialty_id → specialties.id`

### ليه `user_id` هو الـ Primary Key؟
عشان يمنع إن يكون لمريض أكتر من بروفايل. لو حطيت `id` مستقل، ممكن بالغلط
تعمل صفين لنفس اليوزر.

### مثال عملي (كتابة)
```sql
INSERT INTO patient_profiles (user_id, date_of_birth, phone, gender)
VALUES ($1, '1998-04-12', '+201012345678', 'male')
ON CONFLICT (user_id) DO UPDATE
  SET date_of_birth = EXCLUDED.date_of_birth,
      phone = EXCLUDED.phone,
      gender = EXCLUDED.gender;
```

### الخطوة اللي بعدها
المريض بيكمل بروفايله عشان يقدر يحجز.

---

## 5. الموديول التالت: Scheduling (المواعيد)

### بيعمل إيه؟
ده قلب العمل اليومي. المريض بيطلب ميعاد، موظف الاستقبال بيأكده أو يعيد
جدولته أو يلغيه، والدكتور بيشوف جدوله بس.

### الجداول (7)

| الجدول | ليه موجود؟ |
|---|---|
| `clinic_locations` | العيادات. `timezone` مهم عشان نحسب المواعيد صح. |
| `care_relationships` | **الجدول الأهم في الأمان**: بيقول أنهي دكتور مسموح له يقرأ ملف أنهي مريض. |
| `doctor_availability` | جدول الدكتور الأسبوعي (الأحد 9-5 مثلاً). |
| `doctor_time_off` | الإجازات. بيتخصم من الـ availability. |
| `appointments` | الطلب والحجز في جدول واحد، بيفرق بينهم الـ `status`. |
| `follow_ups` | توصية بمتابعة. **مش** ميعاد. |
| `appointment_proposals` | Agent 3 (أو الموظف) بيقترح وقت. **مش** حجز. |

### الفرق بين التلاتة الأخيرة — ده سؤال بيتسأل كتير

```
follow_ups          = "المريض محتاج ييجي تاني بعد أسبوعين"   (توصية)
appointment_proposals = "عندي فاضي يوم 15 الساعة 10"          (اقتراح)
appointments        = "محجوز فعلاً يوم 15 الساعة 10"          (حجز)
```

الداتابيز نفسها بتمنع الخلط: `appointment_proposals` فيها CHECK بيقول إن
الحالة `booked` مستحيل تكون موجودة من غير `booked_appointment_id`. يعني
مستحيل اقتراح يقول "أنا حجز" وهو مش مربوط بحجز حقيقي.

### العلاقات المهمة
- `appointments.patient_user_id → users.id`
- `appointments.doctor_user_id → users.id`
- `appointments.specialty_id → specialties.id` (snapshot وقت الحجز)
- `care_relationships.patient_user_id / doctor_user_id → users.id`
- `follow_ups.source_report_version_id → report_versions.id`
- `appointment_proposals.booked_appointment_id → appointments.id`

### تاريخ تغييرات الحالة — أهم نقطة في الدمج الأول
مفيش جدول اسمه `appointment_status_history` خلاص. كل تغيير حالة بيتكتب في
`audit_logs` كده:

```sql
INSERT INTO audit_logs
  (event_type, event_category, entity_type, entity_id, patient_user_id,
   actor_user_id, change_source, from_status, to_status, change_reason)
VALUES
  ('appointment.status_changed', 'appointment', 'appointment', $1, $2,
   $3, 'staff', 'requested', 'confirmed', 'Slot confirmed at the front desk');
```

وعشان تقرأ التايم لاين، فيه View جاهز اسمه `v_appointment_status_timeline`:

```sql
SELECT * FROM v_appointment_status_timeline
WHERE appointment_id = $1
ORDER BY changed_at;
```

**الـ View ده شكله بالظبط زي الجدول القديم.** عشان كده أي كود كان متوقع
الجدول القديم، هيشتغل من غير تغيير.

### الباك إند بيعمل إيه؟
- المريض: `POST /api/appointments` → بيعمل صف بـ `status='requested'`.
- الموظف: `PATCH /api/appointments/:id/confirm` → بيحدّث الحالة **وبيكتب
  صف audit في نفس الـ transaction**. لو واحد منهم فشل، الاتنين بيرجعوا.
- الدكتور: قراءة بس، ومش بيدير الحجوزات.

### الخطوة اللي بعدها
لما الميعاد يبقى `confirmed` و`checked_in`، الدكتور يبدأ الاستشارة.

---

## 6. الموديول الرابع: Consultations (الاستشارة والتسجيل)

### بيعمل إيه؟
بيغطي اللحظة اللي الدكتور بيقابل فيها المريض: الموافقة على التسجيل، تسجيل
الصوت، وتحويله لنص.

### الجداول (5)

| الجدول | ليه موجود؟ |
|---|---|
| `consultations` | الاستشارة نفسها. `appointment_id` unique — استشارة واحدة لكل ميعاد. |
| `consultation_consents` | موافقة المريض على التسجيل. **مفيش تسجيل من غير موافقة.** |
| `consultation_recordings` | مكان الملف الصوتي (مش الصوت نفسه — bucket + key). |
| `transcripts` | مستند النص. `status` بتاعه summary بس. |
| `transcript_versions` | النص نفسه، بنسخ، وكل نسخة ليها قرار الدكتور. |

### الدمج التاني: الموافقة بقت على النسخة نفسها
قبل: جدول `transcript_approvals` منفصل.
بعد: أربع أعمدة جوه `transcript_versions`.

```sql
-- الدكتور بيوافق
UPDATE transcript_versions
   SET review_decision = 'approved',
       reviewed_by_user_id = $1,
       review_note = 'Accurate, no corrections.'
 WHERE id = $2;
```

`reviewed_at` بيتحط أوتوماتيك بالـ trigger، فمستحيل تسجل قرار من غير وقت.

### القواعد اللي الداتابيز بتفرضها بنفسها

1. **الدكتور بس اللي يوافق.** الـ trigger `enforce_transcript_reviewer`
   بيتأكد إن اليوزر عنده رول `doctor`، وإنه يا إما دكتور الاستشارة يا إما
   عنده `care_relationship` شغالة مع المريض. لو موظف استقبال حاول → خطأ
   `insufficient_privilege`.
2. **النسخة المعتمدة مستحيل تتعدل.** `trg_transcript_versions_immutable`
   بيرفض أي UPDATE على نسخة معتمدة، ويرفض الـ DELETE خالص.
3. **التصحيح = نسخة جديدة، مش تعديل.** الدكتور بيضيف version 2، والنسخة 1
   القديمة تفضل موجودة للأرشيف.
4. **Agent 1 مش هيقدر يقرأ نسخة غير معتمدة.** الـ trigger على
   `agent_executions` بيرفض.

### مثال عملي
```sql
-- نسخة جديدة مصححة
INSERT INTO transcript_versions
  (transcript_id, version_number, content, content_hash,
   is_doctor_edited, edited_by_user_id)
VALUES ($1, 2, 'Corrected transcript.',
        encode(sha256('Corrected transcript.'::bytea), 'hex'), TRUE, $2);
```

لاحظ `content_hash`: ده SHA-256 للنص. لو حد غيّر النص في الداتابيز يدوياً،
الهاش مش هيتطابق، فتعرف إن فيه عبث.

### الخطوة اللي بعدها
النسخة المعتمدة بس هي اللي بتدخل Agent 1.

---

## 7. الموديول الخامس: AI Agents & Reports

### بيعمل إيه؟
كل الذكاء الاصطناعي في النظام بيشتغل من هنا. وفيه قاعدة ذهبية:
**الـ AI بيقترح، الدكتور بيوافق. الـ AI عمره ما بيوافق.**

### الجداول (4)

| الجدول | ليه موجود؟ |
|---|---|
| `agent_executions` | سجل كل تشغيلة AI أو OCR. مين شغلها، امتى، بنجح ولا فشل، وليه. |
| `medical_reports` | مستند التقرير. 3 أنواع لكل استشارة. |
| `report_versions` | محتوى التقرير بنسخه + قرار الدكتور. |
| `record_update_proposals` | Agent 2 بيقترح تعديل على السجل الطبي. |

### أنواع التقارير التلاتة
| النوع | لمين؟ |
|---|---|
| `report_1_patient_summary` | المريض. ده الوحيد اللي ممكن يتنشر. |
| `report_2_structured_profile` | Agent 2 (مش للمريض). |
| `report_3_medical_report` | تقرير طبي داخلي. مصيره لسه **مش محدد**. |

الداتابيز بتمنع إن Report 2 أو 3 يتنشروا للمريض — CHECK صريح على ده.

### الدمج التالت: موافقة التقرير جوه النسخة
زي Transcript بالظبط: `review_decision`, `reviewed_by_user_id`,
`reviewed_at`, `review_note` جوه `report_versions`.

### الدمج الرابع: التسليم بقى نشر
قبل: جدول `report_deliveries` فيه `channel` (portal/email) و`status` و
`viewed_at` و`revoked_at`.
بعد: أربع أعمدة في `medical_reports`:

| العمود | معناه |
|---|---|
| `publication_state` | `unpublished` / `published` / `withdrawn` |
| `published_version_id` | أنهي نسخة بالظبط المريض بيقرأها |
| `published_at` | امتى |
| `published_by_user_id` | مين نشر |

**ليه الدمج ده آمن؟** لأن الـ MVP بينشر Report 1 في بوابة المريض بس — قناة
واحدة، مرة واحدة. مفيش إيميل ولا واتساب ولا محاولات متكررة ولا إيصالات
منفصلة. لو يوم من الأيام قررتوا تعملوا إيميل، ساعتها تحتاج جدول جديد
(`report_deliveries` بشكل مختلف)، ومش هتحتاج ترجع القديم.

### الـ trigger اللي بيحرس النشر
`trg_medical_reports_publication` بيرفض:
- نشر تقرير مش Report 1،
- نشر نسخة مش معتمدة من الدكتور،
- نشر نسخة بتاعة تقرير تاني،
- الرجوع من `published` لـ `unpublished` (لازم `withdrawn`).

### Agent 2: مش بيكتب في السجل الطبي لوحده
```sql
-- 1) Agent 2 بيقترح
INSERT INTO record_update_proposals
  (patient_user_id, agent_execution_id, source_report_version_id,
   target_entity_type, proposal_type, proposed_changes, status)
VALUES ($1, $2, $3, 'medical_condition', 'create', '{"condition_name":"..."}', 'proposed');

-- 2) الدكتور بيوافق
UPDATE record_update_proposals
   SET status='approved', reviewed_by_user_id=$1, reviewed_at=now()
 WHERE id=$2;

-- 3) ساعتها بس الخدمة تكتب الفاكت
INSERT INTO medical_conditions
  (patient_user_id, condition_name, source_type,
   source_report_version_id, source_proposal_id)
VALUES ($1, '...', 'agent_2_derived', $2, $3);
```

ولو حاولت تكتب الفاكت من غير موافقة، الـ trigger
`enforce_medical_record_provenance` هيرفض.

### الخطوة اللي بعدها
Report 1 المعتمد → بوابة المريض. Report 2 المعتمد → Agent 2.
Report 3 → لسه قرار مفتوح.

---

## 8. الموديول السادس: Medical Records (السجل الطبي)

### بيعمل إيه؟
ده الملف الطبي الحقيقي للمريض على المدى الطويل. **مش** `patient_profiles`
— ده بيانات شخصية بس (اسم، تاريخ ميلاد). الأمراض والأدوية والحساسية هنا.

### الجداول (6)

| الجدول | ليه منفصل؟ |
|---|---|
| `medical_conditions` | الأمراض. ليها `onset_date` و`resolved_date`. |
| `patient_medications` | الأدوية. ليها جرعة وتكرار وتاريخ بداية ونهاية. |
| `patient_allergies` | الحساسية. **مهمة جداً طبياً** ومينفعش تتمسح. |
| `medical_history_entries` | عمليات، حجز مستشفى، تاريخ عائلي. |
| `test_orders` | تحليل مطلوب. ده **طلب** مش نتيجة. |
| `test_results` | النتيجة نفسها، analyte واحد في كل صف. |

### ليه مش جدول واحد كبير؟
لأن كل نوع ليه أعمدة مختلفة تماماً. لو دمجتهم هتحتاج 30 عمود معظمهم NULL،
وده أسوأ تصميم ممكن. (ونفس السبب اللي خلانا **نعمل** الدمج الستة في
المكان التاني: هناك الأعمدة كانت واحدة فعلاً.)

### الأعمدة اللي بتتكرر في كل جدول (Provenance)
| العمود | معناه |
|---|---|
| `source_type` | مين كتب المعلومة: `patient_reported` / `doctor_entered` / `agent_2_derived` / `imported` |
| `source_report_version_id` | أنهي تقرير معتمد جاب المعلومة |
| `source_proposal_id` | أنهي اقتراح Agent 2 معتمد |
| `superseded_by_id` | لو اتصححت، بيشاور على الصف الجديد |

### قاعدة التصحيح
مفيش UPDATE على الفاكت الطبي القديم. لو الدوا اتوقف:
1. الصف القديم يتعلم عليه `superseded_by_id` بيشاور على الجديد.
2. صف جديد فيه الحالة الجديدة.

كده التاريخ الطبي كامل، ومفيش "معلومة ضاعت".

### مثال عملي (قراءة)
```sql
SELECT condition_name, clinical_status, onset_date
FROM medical_conditions
WHERE patient_user_id = $1
  AND clinical_status = 'active'
  AND superseded_by_id IS NULL
ORDER BY onset_date DESC;
```

---

## 9. الموديول السابع: OCR & RAG (المعرفة الطبية المرجعية)

### بيعمل إيه؟
الدكتور بيسأل سؤال، والنظام بيجاوب من **مراجع طبية** (guidelines، أبحاث)
مع ذكر المصدر. ده **مش** تشخيص تلقائي.

### قاعدة أساسية
**الموديول ده منفصل تماماً عن بيانات المرضى.** مفيش فيه أي `patient_user_id`.
والداتابيز نفسها بتفرض ده: `agent_executions` فيها CHECK بيمنع إن تشغيلة
`ocr_extraction` يكون معاها `patient_user_id`.

### الجداول (5)

| الجدول | ليه موجود؟ |
|---|---|
| `reference_documents` | المرجع نفسه (العنوان، المؤلف، السنة). |
| `reference_document_versions` | الملف بنسخه + حالة الاستخراج والجودة. **ده بوابة الجودة.** |
| `reference_chunks` | المرجع مقسم لأجزاء صغيرة عشان البحث. |
| `rag_queries` | سؤال الدكتور والإجابة. |
| `rag_citations` | الدليل: أنهي chunk اتستخدم في أنهي ترتيب. |

### الدمج الخامس: استخراج النصوص بقى في `agent_executions`
قبل: جدول `document_extraction_jobs` منفصل.
بعد: نفس الجدول اللي بيتابع الـ AI، بـ `agent_code` مختلف:

```
speech_to_text | agent_1_report_generation | agent_2_profile_organization
agent_3_follow_up_scheduling | ocr_extraction | digital_text_extraction
```

الأعمدة اللي اتضافت (قليلة عن قصد):
- `reference_document_version_id` — أنهي نسخة بنستخرج منها
- `engine` / `engine_version` — tesseract مثلاً
- `output_character_count` — طول النص المستخرج

واللي **مكانش محتاج** عمود جديد:
- retry → `attempt_number` + `retry_of_execution_id` (كانوا موجودين)
- checksum → `output_hash` (كان موجود)
- الأخطاء → `error_code` / `error_message` (كانوا موجودين)
- الجودة والمراجع → على `reference_document_versions` نفسها

والربط بقى في الاتجاهين:
```
agent_executions.reference_document_version_id  →  إيه اللي بيتقرأ
reference_document_versions.extraction_execution_id  →  مين اللي استخرجه
```

### بوابة الجودة
```sql
UPDATE reference_document_versions
   SET extraction_execution_id = $1,
       normalized_text = '...',
       quality_reviewed_by_user_id = $2, quality_reviewed_at = now(),
       approved_by_user_id = $2, approved_at = now(),
       status = 'indexed'
 WHERE id = $3;
```
لو حاولت تعمل `status='indexed'` قبل الموافقة → CHECK هيرفض.

### مثال RAG
```sql
SELECT rc.content, ci.rank, ci.relevance_score
FROM rag_citations ci
JOIN reference_chunks rc ON rc.id = ci.chunk_id
WHERE ci.rag_query_id = $1
ORDER BY ci.rank;
```

---

## 10. الموديول التامن: Operations (التنبيهات والسجل)

### الجداول (2)

| الجدول | بيعمل إيه |
|---|---|
| `notifications` | الرسائل للمستخدم (في التطبيق/إيميل/SMS). مش سجل طبي. |
| `audit_logs` | كل حاجة حصلت في النظام. |

### الدمج السادس: الأحداث الأمنية بقت في نفس السجل
قبل: `security_events` منفصل.
بعد: صفوف في `audit_logs` بـ `event_category = 'security'`، ومعاها `severity`
و`session_id` و`resolved_*`.

```sql
INSERT INTO audit_logs
  (event_type, event_category, severity, actor_user_id, entity_type,
   entity_id, outcome, ip_address, metadata)
VALUES
  ('security.login_failed', 'security', 'warning', $1, 'user', $1,
   'failure', '203.0.113.10', '{"reason":"bad_password"}');
```

وعلشان تقرأ، فيه View اسمه `v_security_events` بشكل الجدول القديم.

### السجل ده append-only — يعني مينفعش يتعدل
`trg_audit_logs_append_only` بيرفض:
- أي `DELETE` (مستحيل),
- أي `UPDATE` يغيّر أي عمود،
- **ما عدا** مرة واحدة: إنك تسجل نتيجة تحقيق أمني
  (`resolved_at` + `resolved_by_user_id` + `resolution_notes`).

يعني لو حد عبث بقاعدة بيانات، الأثر بيفضل موجود.

### مثال: "مين قرأ ملف المريض ده؟"
```sql
SELECT occurred_at, actor_user_id, event_type, outcome
FROM audit_logs
WHERE patient_user_id = $1
ORDER BY occurred_at DESC;
```

---

## 11. الموديول التاسع: Infrastructure

| الجدول | بيعمل إيه |
|---|---|
| `schema_migrations` | سجل الميجريشنز: رقمها، اسمها، checksum، وامتى اتطبقت. |

الجدول ده بيديره `Backend/scripts/migrate.js`. **متعملش فيه حاجة يدوي.**

الـ checksum مهم: لو حد عدّل ملف ميجريشن بعد ما اتطبق، الـ runner بيرفض
يكمل. ده بيحمي إن كل الأجهزة يكون عندها نفس الشكل.

---

## 12. إيه اللي اتغير بالظبط من 45 لـ 39 (وبعدين لـ 42)؟

### الجداول الستة اللي اختفت
```
appointment_status_history
transcript_approvals
report_approvals
report_deliveries
document_extraction_jobs
security_events
```

### الأعمدة الجديدة اللي اتضافت
| الجدول | الأعمدة |
|---|---|
| `audit_logs` | `event_type`, `event_category`, `severity`, `from_status`, `to_status`, `change_source`, `change_reason`, `session_id`, `resolved_at`, `resolved_by_user_id`, `resolution_notes` |
| `transcript_versions` | `review_decision`, `reviewed_by_user_id`, `reviewed_at`, `review_note` |
| `report_versions` | نفس الأربعة |
| `medical_reports` | `publication_state`, `published_version_id`, `published_at`, `published_by_user_id` |
| `agent_executions` | `reference_document_version_id`, `engine`, `engine_version`, `output_character_count` |
| `reference_document_versions` | `extraction_execution_id` |

### حاجات اتشالت من `audit_logs`
عمود `action` القديم اتشال، واتبدل بـ `event_type`. السبب: اسم واحد أوضح
من اتنين بيعملوا نفس الحاجة، و`event_type` هو الاسم المعتاد في أنظمة الـ
audit.

### Views جديدة (مش جداول — مش بتتحسب في العدد)
| View | بديل إيه |
|---|---|
| `v_appointment_status_timeline` | `appointment_status_history` |
| `v_security_events` | `security_events` |

---

## 13. إزاي تشغل وتتأكد بنفسك

```bash
cd Backend

# طبّق أي ميجريشن لسه ما اتطبقش
npm run db:migrate

# تأكد إن الـ ERD مطابق للداتابيز (748 فحص)
npm run db:validate

# شغّل اختبارات الداتابيز (98 اختبار — كلهم داخل transaction وبيترجعوا)
npm run test:schema

# اختبارات التسجيل القديمة
npm test
```

`test:schema` بيعمل كل السيناريوهات: مريض، أدمن، استقبال، دكتور،
Agent 1/2/3، OCR/RAG، وأمان. وكل الـ INSERTs بترجع (rollback) في الآخر،
فالداتابيز بتفضل نضيفة.

---

## 14. حاجات لسه مفتوحة (قرارات محتاجة تتاخد)

| الموضوع | الحالة |
|---|---|
| `medora_db` ولا `medora_v1`؟ | الداتابيز الحقيقية اسمها `medora_v1`. التوثيق القديم بيقول `medora_db`. محتاج قرار تسمية. |
| Report 3 | الغرض والمستلم والتخزين **لسه مش محددين**. عشان كده مفيش له مسار نشر. |
| تخزين الملفات (صوت/PDF) | الداتابيز بتخزن provider + key + checksum بس. مفيش قرار على الـ provider. |
| vector store | مفيش `pgvector`. `embedding_ref` مجرد pointer. |
| قنوات التسليم (إيميل/واتساب) | مش موجودة. لو اتقررت، تحتاج جدول جديد. |
| منع تعارض المواعيد | `btree_gist` exclusion constraint — لسه مقترح. |
| تقسيم `audit_logs` | partitioning شهري — لسه مقترح. |
| صلاحيات الـ DB role للتطبيق | المفروض `audit_logs` يبقى INSERT/SELECT بس للتطبيق. حالياً التطبيق داخل بـ `postgres`. |

---

## 15. نصايح للمبتدئ

1. **الـ 1:1 هو عدوك.** لو جدولين بينهم واحد لواحد، اسأل نفسك: ليه مش جدول
   واحد؟ ده أصل الست دمجات.
2. **الـ 1:N صاحبك.** `report_versions` مش هتندمج مع `medical_reports` أبداً،
   لأن التقرير الواحد ليه نسخ كتير.
3. **الـ constraint أحسن من الكود.** كل قاعدة كتبتها في الداتابيز (زي "مفيش
   نشر لتقرير مش معتمد") بتشتغل مهما كان الكود اللي بيكتب. حتى لو حد دخل
   بـ psql.
4. **الـ trigger مش سحر — اقرأه.** لو trigger رفض حاجة ومش فاهم ليه، اقرأ
   رسالة الخطأ. كتبت الرسائل بالعربي الفصيح تقريباً عشان تفهم السبب.
5. **متعملش UPDATE على audit.** السجل ده تاريخ. التاريخ مبيتغيرش.
6. **اختبر بـ transaction.** زي ما `test:schema` بيعمل: `BEGIN` … `ROLLBACK`.
   كده تقدر تجرب على داتابيز حقيقية من غير ما تسيب زبالة.

---

## 16. الجداول التلاتة اللي جت من شغل الـ Admin Backend

التبسيط (V2) وصّلنا لـ 39 جدول. لكن التيم كان باني لوحة الأدمن على 3 جداول
مش موجودة في الـ 39، ودي مش تكرار ولا زيادة — دي بيانات ملهاش مكان تاني:

| الجدول | بيعمل إيه | ليه مش موجود في V2 |
|---|---|---|
| `departments` | الوحدات التنظيمية: أقسام طبية (قلب، جلدية) + وحدات مساندة (تمريض، معمل، إدارة) | V2 كان عنده `specialties` بس، ودي التخصصات الطبية فقط. "التمريض" مش تخصص طبي، فمينفعش يتحط فيها. |
| `staff_profiles` | بيانات التوظيف لموظف الاستقبال: القسم، المسمى الوظيفي، رقم الموظف، الوردية | `doctor_profiles` للدكاترة. الموظف بياناته مختلفة تماماً. |
| `user_invitations` | توكنات الدعوة وإعادة تعيين الباسورد (hash بس، صالحة مرة واحدة) | مفيش مكان تاني آمن لتوكن مؤقت. مش `sessions` (الجلسة حاجة والتوكن حاجة). |

**العلاقة بين `departments` و `specialties`:**
قسم طبي واحد لكل تخصص، والقسم هو اللي بيشيل `specialty_id` (UNIQUE). الأقسام
المساندة ملهاش `specialty_id` خالص، وفيه CHECK بيمنع إن القسم يكون نص طبي
ونص مساند.

**الجداول دي متلمستش في V2:** الست دمجات كلها حصلت في جداول المنصة الطبية.
الـ 3 جداول دي اتضافت من ميجريشنز `004` و `005` بتاعة التيم، و V2 استخدمهم
زي ما هما بدل ما يعمل نسخة تانية منهم.

### يعني الإجمالي النهائي
```
39  جدول المنصة الطبية بعد التبسيط
+3  جداول الـ Admin
= 42 جدول
```

### ملاحظة على الترقيم
ميجريشنز `004` و `005` بتاعة التيم فضلت زي ما هي بالظبط (نفس المحتوى، نفس
الـ checksum)، عشان أي داتابيز عندها الميجريشنز دي متطبقة تفضل شغالة.
ميجريشنز V2 اللي مكانت متدفوعة اترقمت من جديد لـ `006` لحد `012`، وضفنا
`013` لإصلاح مشكلة الـ append-only مع حذف الحسابات.

**درس مهم:** لو ميجريشن متطبق على داتابيز حد تاني، عمرك ما تعدّله ولا تغيّر
رقمه. اللي بيتغيّر هو اللي لسه متدفعش.
