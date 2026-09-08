import type { Translations } from "@/src/i18n/en";

/**
 * Arabic dictionary. Type-checked against `Translations` so it can never drift
 * from the English key set. Arabic reads right-to-left; the constraints on it
 * are no different from English — placeholders must be preserved exactly.
 */
export const ar: Translations = {
  "nav.discover": "الاكتشاف",
  "nav.browse": "التصفّح",
  "nav.chat": "المحادثة",
  "nav.settings": "الإعدادات",
  "nav.shortlist": "القائمة المختصرة",

  "settings.title": "الإعدادات",
  "settings.modeSection": "الوضع",
  "settings.modeIntro":
    "لدى حسابك تنقّلان اثنان: وضع العضو ووضع الضامن. وضع الضامن يبدّل التطبيق كله — لا يمكنك فتح محادثة فردية أبدًا، بل قراءة المحادثة الثلاثية فقط.",
  "settings.mode.member": "عضو",
  "settings.mode.memberCaption": "تصفّح لنفسك وتحادث",
  "settings.mode.voucher": "ضامن",
  "settings.mode.voucherCaption": "تصفّح وتوثّق بالنيابة عن شخص ما",
  "settings.modeActive": "وضع الضامن",

  "settings.appearanceSection": "المظهر",
  "settings.theme": "الثيم",
  "settings.themeCaption": "فاتح، أو داكن، أو حسب جهازك",
  "settings.themeLight": "فاتح",
  "settings.themeDark": "داكن",
  "settings.themeSystem": "تلقائي",

  "settings.language": "اللغة",
  "settings.languageCaption":
    "اللغة الإنجليزية تتّجه من اليسار إلى اليمين؛ العربية تقلب التطبيق إلى اليمين إلى اليسار.",
  "settings.languageEn": "English",
  "settings.languageAr": "العربية",

  "settings.notifications": "الإشعارات",
  "settings.notificationsCaption":
    "تنبيهات عند تواصل العائلة أو وُجود ملاحظة توثيق. تُحفظ التفضيلات على هذا الجهاز حاليًا.",

  "settings.dataSection": "البيانات",
  "settings.wipe": "مسح البيانات المحلية",
  "settings.wipeCaption":
    "يمسح قائمة الانتظار والمرايا وقائمة الترشيح والمحادثات والتفضيلات. لا يمكن التراجع عن هذا.",
  "settings.wipeConfirmTitle": "مسح البيانات المحلية",
  "settings.wipeConfirmBody": "سيُمسح كل مرآة وكل تفضيل على هذا الجهاز. لا يمكن التراجع عن ذلك.",
  "settings.wipeCancel": "إلغاء",
  "settings.wipeConfirm": "مسح",
  "settings.dataWiped": "تم مسح البيانات المحلية",
  "settings.signOut": "تسجيل الخروج",

  "settings.themeUpdated": "تم تحديث الثيم",
  "settings.languageUpdated": "تم تحديث اللغة",
  "settings.notificationsUpdated": "تم تحديث الإشعارات",
  "settings.saved": "تم الحفظ",

  "browse.title": "التصفّح",
  "browse.offlinePill": "غير متصل — الإجراءات في الانتظار",
  "browse.filters": "التصفية",
  "browse.filtersDone": "تم",
  "browse.verifiedShort": "موثّق",
  "browse.emptyTitle": "لا توجد ملفات بعد",
  "browse.emptyCaption": "لا شيء في منطقتك يناسب هذه التصفية. خفّفها وتصفّح مجددًا.",
  "browse.resetFilters": "إعادة ضبط التصفية",
  "browse.loadFailed": "تعذّر تحميل الملفات",
  "browse.retry": "اضغط للمحاولة",
  "browse.retryMore": "تعذّر تحميل المزيد — اضغط للمحاولة",
  "browse.end": "وصلت إلى النهاية",
  "browse.shortlistHint": "احفظ المرشّحين الذين تريد التوثيق لهم.",
  "browse.shortlisted": "تم الترشيح",
  "browse.unshortlisted": "أُزيل من القائمة المختصرة",
  "browse.rowA11y": "{name}، {age}، {city}، يبعد {distance}كم",
  "browse.photoA11y": "صورة {name}",
  "browse.addShortlistA11y": "ترشيح {name}",
  "browse.removeShortlistA11y": "إزالة {name} من القائمة المختصرة",
  "browse.candidateForA11y": "تصفّح مرشّحين بالنيابة عن الشخص الذي تمثّله",

  "shortlist.title": "القائمة المختصرة",
  "shortlist.count": "{count} مرشّح",
  "shortlist.emptyTitle": "لا يوجد مرشّحون بعد",
  "shortlist.emptyCaption":
    "تصفّح واحفظ المرشّحين بالنيابة عن الشخص الذي تمثّله — ستظهر ملاحظات توثيقك هنا.",
  "shortlist.goBrowse": "تصفّح الملفات",
  "shortlist.noteLabel": "ملاحظة التوثيق",
  "shortlist.noteA11y": "ملاحظة التوثيق لـ {name}",
  "shortlist.notePlaceholder": "اكتب لماذا هذا المرشّح مناسب بقوة…",
  "shortlist.noteHint": "ملاحظة مدروسة تساعد العائلة على الوثوق بعمق توثيقك.",
  "shortlist.noteDepthReached": "بلغت عمق التوثيق المطلوب",
  "shortlist.charCount": "{count}/{max}",
  "shortlist.noteSaved": "حُفظت الملاحظة",
  "shortlist.remove": "إزالة من القائمة المختصرة",
  "shortlist.removeConfirmTitle": "إزالة {name}؟",
  "shortlist.removeConfirmBody": "سيُزال المرشّح وملاحظتك من القائمة المختصرة.",
  "shortlist.removeKeep": "إبقاء",
  "shortlist.removeConfirmAction": "إزالة",
  "shortlist.removed": "أُزيل من القائمة المختصرة",
  "shortlist.rowA11y": "{name}، مرشّح قصير",

  "candidate.title": "المرشّح",
  "candidate.add": "ترشيح {name}",
  "candidate.remove": "إزالة من القائمة المختصرة",
  "candidate.inShortlist": "في القائمة المختصرة — افتحها لكتابة ملاحظة التوثيق",
  "candidate.loadFailed": "تعذّر تحميل هذا المرشّح",
  "candidate.retry": "اضغط للمحاولة",

  "common.cancel": "إلغاء",
  "common.ok": "حسنًا",
};