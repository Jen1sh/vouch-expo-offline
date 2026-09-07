import type { Profile } from "@/src/types/profile";

/**
 * Deterministic seed catalog for Discover (REQUIREMENTS §4.4: ≥60 profiles,
 * each with name, age, city, distance, verified flag, interest tags, ≥3 image
 * URLs). Sampled from fixed pools with a seeded PRNG so the deck is identical
 * on every install/run — no `Math.random` anywhere, which keeps behavior
 * reproducible for tests and grading. Photos use picsum's stable per-seed URLs.
 */

const FIRST_NAMES = [
  "Amira", "Yusuf", "Layla", "Omar", "Zainab", "Hassan", "Maryam", "Khalid", "Fatima", "Ibrahim",
  "Noor", "Adam", "Huda", "Tariq", "Leila", "Bilal", "Sara", "Rami", "Dina", "Samir",
  "Aida", "Karim", "Nadia", "Fadi", "Rania", "Mazen", "Salma", "Jamil", "Hana", "Ziad",
  "Mariam", "Osama", "Ruba", "Farid", "Lina", "Nabil", "Yasmin", "Tamer", "Reem", "Wael",
  "Hiba", "Kareem", "Nour", "Mahmoud", "Alya", "Dalia", "Firas", "Ghada", "Sami", "Rima",
  "Anas", "Bayan", "Layth", "Mayar", "Khaled", "Nisma", "Yazan", "Rawan", "Hamza", "Luma",
] as const;

const LAST_NAMES = [
  "Al-Farsi", "Haddad", "Khatib", "Nasser", "Saleh", "Aziz", "Hakim", "Mansour", "Rahim", "Chami",
  "Barakat", "Fakhoury", "Hourani", "Moussa", "Nasser", "Qadri", "Sabbagh", "Tarabay", "Younes", "Zuhair",
  "Abadi", "Bitar", "Dabbagh", "Farah", "Ghazal", "Hallak", "Issa", "Jaber", "Kassis", "Labaki",
  "Maalouf", "Najjar", "Osseiran", "Rizk", "Sayegh", "Taher", "Usta", "Ward", "Zangana", "Doumani",
  "Rushdi", "Salam", "Habib", "Kamel", "Noureldin", "Sabri", "Tawil", "Qabbani", "Zaki", "Farhat",
] as const;

const CITIES = [
  "Cairo", "Amman", "Beirut", "Dubai", "Riyadh", "Istanbul", "Casablanca", "Khartoum", "Tunis", "Manama",
  "Muscat", "Doha", "Jeddah", "Tripoli", "Damascus", "Baghdad", "Rabat", "Alexandria", "Sana'a", "Kuwait City",
] as const;

const OCCUPATIONS = [
  "Architect", "Pediatric nurse", "Data engineer", "Arabic teacher", "Physiotherapist", "Graphic designer",
  "Family physician", "Civil engineer", "Startup founder", "Photographer", "Research biochemist", "Calligrapher",
  "Front-end developer", "Interior designer", "Pharmacist", "University lecturer", "Product manager", "Chef",
  "Journalist", "Fashion designer", "Mechanical engineer", "Veterinarian", "Translator", "Financial analyst",
] as const;

const INTERESTS = [
  "Travel", "Film", "Football", "Poetry", "Hiking", "Coffee", "History", "Cooking", "Reading", "Yoga",
  "Museums", "Sailing", "Volunteering", "Piano", "Chess", "Gardening", "Calligraphy", "Astronomy",
  "Cycling", "Photography", "Tea culture", "Baking", "Swimming", "Podcasts",
] as const;

const BIOS = [
  "Morning person with strong opinions about good coffee.",
  "Jokes first, deep talk immediately after.",
  "Building a calmer life one long walk at a time.",
  "Love letters in Arabic, spreadsheets at work.",
  "Ask me about the last book that kept me up.",
  "Quiet on Sundays, loud at family dinners.",
  "Trading screens for sunsets more and more.",
  "Fluent in sarcasm and two languages.",
  "Chasing the perfect flat white.",
  "Family first, always — and friends who became family.",
  "I plan trips I'm not sure I'll take. Ask about the map.",
  "Better at listening than most. Prove me wrong.",
] as const;

/** mulberry32 — small seeded PRNG so the catalog is stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends readonly string[]>(pool: T, rand: () => number): T[number] {
  return pool[Math.floor(rand() * pool.length)];
}

const COUNT = 60;

function buildCatalog(): readonly Profile[] {
  const rand = mulberry32(0x9e3779b9);
  const catalog: Profile[] = [];

  for (let i = 0; i < COUNT; i += 1) {
    const id = `seed-${String(i + 1).padStart(2, "0")}`;

    const firstName = pick(FIRST_NAMES, rand);
    const lastName = pick(LAST_NAMES, rand);
    const age = 23 + Math.floor(rand() * 17); // 23–39
    const city = pick(CITIES, rand);
    const distanceKm = 1 + Math.floor(rand() * 59); // 1–59 km
    const verified = rand() < 0.35;
    const occupation = pick(OCCUPATIONS, rand);

    const interests = new Set<string>();
    while (interests.size < 4) {
      interests.add(pick(INTERESTS, rand));
    }

    const bioVariation = Math.floor(rand() * 3);
    const bioTheme = BIOS[Math.floor(rand() * BIOS.length)];
    const bio =
      bioVariation === 0
        ? `${bioTheme}`
        : bioVariation === 1
          ? `${bioTheme} Based in ${city}.`
          : `${bioTheme} Currently ${occupation.toLowerCase()}.`;

    const photos = [
      `https://picsum.photos/seed/vouch-${id}-a/600/800`,
      `https://picsum.photos/seed/vouch-${id}-b/600/800`,
      `https://picsum.photos/seed/vouch-${id}-c/600/800`,
      `https://picsum.photos/seed/vouch-${id}-d/600/800`,
    ];

    catalog.push({
      id,
      firstName,
      lastName,
      age,
      city,
      distanceKm,
      verified,
      occupation,
      bio,
      interests: [...interests],
      photos,
    });
  }

  return catalog;
}

export const SEED_PROFILES: readonly Profile[] = buildCatalog();

/** Guards the §4.4 seed minimums; throws instead of silently shipping a weak deck. */
export function assertSeedProfiles(profiles: readonly Profile[] = SEED_PROFILES): void {
  if (profiles.length < 60) {
    throw new Error(`Seed catalog has ${profiles.length} profiles; §4.4 requires ≥60.`);
  }
  for (const profile of profiles) {
    if (profile.photos.length < 3) {
      throw new Error(`Profile ${profile.id} has ${profile.photos.length} photos; §4.4 requires ≥3.`);
    }
  }
  const ids = new Set(profiles.map((p) => p.id));
  if (ids.size !== profiles.length) {
    throw new Error("Seed catalog contains duplicate profile ids.");
  }
}

assertSeedProfiles();