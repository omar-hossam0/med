# لماذا ظهر اسم AlaaEldeen0110 على الـ commit؟

## الخلاصة السريعة

ظهور اسم `AlaaEldeen0110` لا يعني أن هناك مستخدمًا ثانيًا لديه صلاحية على مستودع GitHub، ولا يعني أن حساب عمر تم اختراقه بالضرورة.

المشكلة أن Git ينشئ الـ commit محليًا باستخدام الاسم والبريد الموجودين في إعدادات Git الخاصة بهذا المستودع. إعداد هذا المستودع مضبوط حاليًا على:

```text
user.name  = AlaaEldeen0110
user.email = allaa.712rashid@gmail.com
```

لذلك تم تسجيل الـ commit باسم علاء قبل أن يصل إلى GitHub. أما عملية الرفع نفسها فتمت من جلسة GitHub المصادق عليها بحساب:

```text
omar-hossam0
```

بمعنى آخر:

| الشيء | القيمة الحالية |
|---|---|
| حساب GitHub الذي يرفع إلى الريبو | `omar-hossam0` |
| مستودع الرفع | `omar-hossam0/medora_v1` |
| اسم مؤلف آخر commit | `AlaaEldeen0110` |
| البريد المسجل داخل آخر commit | `allaa.712rashid@gmail.com` |
| مصدر اسم المؤلف | إعداد Git المحلي داخل `.git/config` |

## الدليل من commit الاختبار

الـ commit الذي أنشأه الاختبار هو:

```text
7a7dcde3d14f37daf5ef64a81f9149410d11070a
feat: add initial test file
```

بياناته الداخلية كانت:

```text
Author:     AlaaEldeen0110 <allaa.712rashid@gmail.com>
Commit:     AlaaEldeen0110 <allaa.712rashid@gmail.com>
```

ويمكن التحقق من ذلك بالأمر:

```powershell
git show --format=fuller --no-patch 7a7dcde
```

هذا يثبت أن الاسم تم وضعه داخل كائن Git نفسه عند تنفيذ `git commit`. GitHub لم يخترع الاسم أثناء العرض؛ هو يعرض بيانات الـ commit التي استلمها.

## الفرق بين Author وCommitter وPusher

هناك ثلاث هويات يمكن الخلط بينها:

### 1. Author — مؤلف التغييرات

هو الاسم الموجود في حقل `Author` داخل الـ commit. عادةً يكون الشخص الذي كتب التغييرات.

في حالة الاختبار:

```text
Author: AlaaEldeen0110 <allaa.712rashid@gmail.com>
```

### 2. Committer — الشخص أو البيئة التي أنشأت كائن الـ commit

هو الاسم الموجود في حقل `Commit`. في أغلب عمليات العمل العادية يكون مساويًا للـ Author، وهذا ما حدث هنا:

```text
Commit: AlaaEldeen0110 <allaa.712rashid@gmail.com>
```

تتم قراءة هذه القيمة من إعداد Git المحلي عند تنفيذ `git commit`، وليس من قائمة مستخدمي GitHub.

### 3. Pusher — حساب GitHub الذي نفذ الرفع

هو حساب GitHub المستخدم للمصادقة عند تنفيذ `git push`. هذا الحساب لا يغير تلقائيًا حقلي `Author` و`Committer` الموجودين مسبقًا داخل commit.

في هذه البيئة تم التحقق من أن جلسة GitHub CLI النشطة هي:

```text
omar-hossam0
```

والـ remote يشير إلى:

```text
https://github.com/omar-hossam0/medora_v1.git
```

إذًا السيناريو الذي حدث هو:

```text
Git commit محليًا باسم علاء
        ↓
Git push باستخدام حساب عمر
        ↓
GitHub يعرض commit باسم علاء لأن هذه بياناته الداخلية
```

## لماذا إعداد عمر العام لم يعمل؟

يوجد إعداد عام للمستخدم عمر في الملف:

```text
C:\Users\Omar\.gitconfig
```

وقيمته:

```text
user.name  = omar hossam
user.email = amorhossam2005@gmail.com
```

لكن يوجد إعداد خاص بهذا المستودع داخل:

```text
D:\Medora_v1\Medora\.git\config
```

وقيمته:

```text
user.name  = AlaaEldeen0110
user.email = allaa.712rashid@gmail.com
```

Git يطبق إعدادات المستودع المحلي قبل الإعداد العام. لذلك إعداد `.git/config` يغلب إعداد `C:\Users\Omar\.gitconfig`.

ترتيب الأولوية المبسط هو:

```text
إعدادات commit التي يمررها الأمر مباشرة
    ثم إعدادات المستودع المحلي .git/config
    ثم إعدادات المستخدم العامة ~/.gitconfig
    ثم إعدادات النظام
```

ولهذا، حتى مع أن جهاز Windows وحساب GitHub يعودان إلى عمر، ظل Git ينشئ commits باسم علاء.

## هل هذا يعني أن علاء مستخدم في الريبو؟

ليس بالضرورة، بل الأدلة الحالية تقول العكس:

1. الـ remote هو `omar-hossam0/medora_v1`.
2. جلسة GitHub CLI النشطة هي `omar-hossam0`.
3. اسم علاء موجود داخل بيانات commit، وليس دليلًا مستقلًا على صلاحية وصول.
4. Git يسمح لأي شخص بكتابة أي `user.name` و`user.email` في إعداداته المحلية؛ هذه الحقول ليست إثبات هوية موثوقًا وحدها.

قد يظهر حساب GitHub مرتبط بالـ commit إذا كان البريد الموجود داخله مرتبطًا بذلك الحساب. لذلك استخدام بريد علاء جعل GitHub يعرض اسم علاء، حتى لو كان الرفع الفعلي من حساب عمر.

## الإصلاح الصحيح للـ commits الجديدة

من داخل جذر المستودع نفّذ:

```powershell
git config --local user.name "omar hossam"
git config --local user.email "amorhossam2005@gmail.com"
```

ثم تحقق من الهوية الفعلية التي سيستخدمها Git:

```powershell
git config --show-origin --get-regexp "^user\."
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

يجب أن تكون النتيجة الجديدة شبيهة بـ:

```text
omar hossam <amorhossam2005@gmail.com>
```

بعدها أنشئ commit جديدًا وتحقق منه قبل الرفع:

```powershell
git add .
git commit -m "test: verify commit identity"
git show --format=fuller --no-patch HEAD
```

لا تنفذ `git push` إلا بعد التأكد أن `Author` و`Commit` يظهران باسم عمر.

## فحص حساب GitHub الذي سيقوم بالرفع

للتأكد من حساب GitHub المصادق عليه:

```powershell
gh auth status
```

ولتأكيد الريموت:

```powershell
git remote -v
```

يجب أن يظهر حساب `omar-hossam0` والريبو `omar-hossam0/medora_v1`.

## ماذا عن commit الاختبار الحالي؟

في وقت كتابة هذا التوثيق، commit الاختبار:

```text
7a7dcde feat: add initial test file
```

تم إنشاؤه باسم علاء، وهو موجود محليًا كـ commit غير مرفوع بعد، لأن حالة الفرع كانت:

```text
main...origin/main [ahead 1]
```

إذا كان الهدف عدم رفعه بهذا الاسم، فلا ترفعه قبل تصحيح الهوية. يمكن إعادة إنشاء آخر commit بعد ضبط إعدادات Git باستخدام:

```powershell
git config --local user.name "omar hossam"
git config --local user.email "amorhossam2005@gmail.com"
git commit --amend --reset-author --no-edit
git show --format=fuller --no-patch HEAD
```

إذا أظهر الفحص الاسم والبريد الصحيحين، يمكن رفعه بشكل طبيعي:

```powershell
git push origin main
```

الخيار `--reset-author` مهم هنا لأنه يعيد ضبط Author أيضًا، وليس Committer فقط.

## ماذا عن commits القديمة؟

تصحيح إعداد Git لن يغير commits قديمة؛ سيؤثر فقط على commits التي ستنشأ بعد التصحيح. تغيير commits مرفوعة بالفعل يتطلب إعادة كتابة التاريخ ثم `push --force-with-lease`، وهو إجراء لا يُستخدم إلا عند الحاجة وبعد التأكد من عدم وجود أشخاص آخرين يعملون على الفرع.

## النتيجة النهائية

المشكلة ليست تعدد مستخدمي الريبو. المشكلة ناتجة عن خلط هويتين مستقلتين:

```text
هوية Git داخل commit = علاء
هوية GitHub التي رفعت commit = عمر
```

إصلاح `user.name` و`user.email` داخل إعدادات هذا المستودع سيجعل الـ commits القادمة تظهر باسم عمر، بينما سيظل حساب `omar-hossam0` هو المسؤول عن عملية الرفع إلى GitHub.
