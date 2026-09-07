/**
 * A person the local member can swipe on in Discover (REQUIREMENTS §3.3,
 * §4.4 seed fields). Mirrors what the simulated backend would eventually
 * serve; today it is populated from the deterministic seed catalog in
 * `src/mocks/seed/profiles.ts`.
 */
export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  /** Rounded whole kilometres from the member's location. */
  distanceKm: number;
  verified: boolean;
  occupation: string;
  bio: string;
  interests: string[];
  /** ≥3 remote image URLs (the deck prefetches and never renders blank). */
  photos: string[];
};