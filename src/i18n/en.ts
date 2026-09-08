/**
 * English dictionary. This file is the source of truth for the translation
 * keys: `TranslationKey` is derived from it, and `ar.ts` is type-checked
 * against the same shape, so a key added in English must exist in Arabic or
 * typecheck fails. Interpolations use `{name}` placeholders filled by `t`.
 */
export const en = {
  "nav.discover": "Discover",
  "nav.browse": "Browse",
  "nav.chat": "Chat",
  "nav.settings": "Settings",
  "nav.shortlist": "Shortlist",

  "settings.title": "Settings",
  "settings.modeSection": "Mode",
  "settings.modeIntro":
    "Your account has two navigation trees. Voucher mode swaps the whole app — you can never open a 1:1 chat, only read the three-way thread.",
  "settings.mode.member": "Member",
  "settings.mode.memberCaption": "Browse for yourself and chat",
  "settings.mode.voucher": "Voucher",
  "settings.mode.voucherCaption": "Browse and vouch on someone's behalf",
  "settings.modeActive": "Voucher mode",

  "settings.appearanceSection": "Appearance",
  "settings.theme": "Theme",
  "settings.themeCaption": "Light, dark, or follow your system",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.themeSystem": "System",

  "settings.language": "Language",
  "settings.languageCaption":
    "English lays out left to right; العربية flips the app to right-to-left.",
  "settings.languageEn": "English",
  "settings.languageAr": "العربية",

  "settings.notifications": "Notifications",
  "settings.notificationsCaption":
    "Alerts when the family reaches out or a vouch note is in. Preferences are stored on this device for now.",

  "settings.dataSection": "Data",
  "settings.wipe": "Wipe local data",
  "settings.wipeCaption":
    "Clears the durable outbox, the swipe and shortlist mirrors, chat, and preferences. This cannot be undone.",
  "settings.wipeConfirmTitle": "Wipe local data",
  "settings.wipeConfirmBody":
    "This clears every mirror and preference on this device. It cannot be undone.",
  "settings.wipeCancel": "Cancel",
  "settings.wipeConfirm": "Wipe",
  "settings.dataWiped": "Local data wiped",
  "settings.signOut": "Sign out",

  "settings.themeUpdated": "Theme updated",
  "settings.languageUpdated": "Language updated",
  "settings.notificationsUpdated": "Notifications updated",
  "settings.saved": "Saved",

  "browse.title": "Browse",
  "browse.offlinePill": "Offline — actions queued",
  "browse.filters": "Filters",
  "browse.filtersDone": "Done",
  "browse.verifiedShort": "Verif.",
  "browse.emptyTitle": "No profiles yet",
  "browse.emptyCaption":
    "Nothing in your area fits these filters. Loosen them and browse again.",
  "browse.resetFilters": "Reset all filters",
  "browse.loadFailed": "Couldn't load profiles",
  "browse.retry": "Tap to retry",
  "browse.retryMore": "Couldn't load more — tap to retry",
  "browse.end": "You've reached the end",
  "browse.shortlistHint": "Bookmark candidates you want to vouch for.",
  "browse.shortlisted": "Shortlisted",
  "browse.unshortlisted": "Removed from shortlist",
  "browse.rowA11y": "{name}, {age}, {city}, {distance}km away",
  "browse.photoA11y": "Photo of {name}",
  "browse.addShortlistA11y": "Shortlist {name}",
  "browse.removeShortlistA11y": "Remove {name} from shortlist",
  "browse.candidateForA11y": "Browse candidates on behalf of the person you represent",

  "shortlist.title": "Shortlist",
  "shortlist.count": "{count} candidates",
  "shortlist.emptyTitle": "No shortlisted candidates yet",
  "shortlist.emptyCaption":
    "Browse and bookmark candidates on behalf of the person you represent — your vouch notes appear here.",
  "shortlist.goBrowse": "Browse profiles",
  "shortlist.noteLabel": "Vouch note",
  "shortlist.noteA11y": "Vouch note for {name}",
  "shortlist.notePlaceholder": "Write why this candidate is a strong match…",
  "shortlist.noteHint":
    "A thoughtful note helps the family trust your vouching depth.",
  "shortlist.noteDepthReached": "Thoughtful voucher depth reached",
  "shortlist.charCount": "{count}/{max}",
  "shortlist.noteSaved": "Note saved",
  "shortlist.remove": "Remove from shortlist",
  "shortlist.removeConfirmTitle": "Remove {name}?",
  "shortlist.removeConfirmBody":
    "The candidate and your note are removed from the shortlist.",
  "shortlist.removeKeep": "Keep",
  "shortlist.removeConfirmAction": "Remove",
  "shortlist.removed": "Removed from shortlist",
  "shortlist.rowA11y": "{name}, shortlisted candidate",

  "candidate.title": "Candidate",
  "candidate.add": "Shortlist {name}",
  "candidate.remove": "Remove from shortlist",
  "candidate.inShortlist": "In shortlist — open Shortlist to write your vouch note",
  "candidate.loadFailed": "Couldn't load this candidate",
  "candidate.retry": "Tap to retry",

  "common.cancel": "Cancel",
  "common.ok": "OK",
} as const;

export type Translations = Record<TranslationKey, string>;
export type TranslationKey = keyof typeof en;