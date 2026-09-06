import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { profiles, profilePhotos, profilePreferences } from "@/src/db/schema/profiles";

/**
 * Single local account. There is no backend user id yet, so the user's profile
 * row (and all onboarding persistence) is keyed by this constant.
 */
export const MY_PROFILE_ID = "me";

/** The resumable onboarding draft mapped onto the profiles row + related tables. */
export type OnboardingDraftData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  bio: string;
  lookingFor: string;
  familyInvolved: string;
  waliContact: string;
  familyRelationship: string;
  photos: string[];
  preferences: string[];
};

export type MyProfile = OnboardingDraftData & {
  id: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, MY_PROFILE_ID))
    .limit(1);
  if (!profile) {
    return null;
  }

  const [photos, preferences] = await Promise.all([
    db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.profileId, MY_PROFILE_ID))
      .orderBy(profilePhotos.position),
    db
      .select()
      .from(profilePreferences)
      .where(eq(profilePreferences.profileId, MY_PROFILE_ID))
      .orderBy(profilePreferences.position),
  ]);

  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    city: profile.city,
    bio: profile.bio,
    lookingFor: profile.lookingFor,
    familyInvolved: profile.familyInvolved,
    waliContact: profile.waliContact,
    familyRelationship: profile.familyRelationship,
    onboardingStep: profile.onboardingStep,
    onboardingCompleted: profile.onboardingCompleted,
    photos: photos.map((photo) => photo.uri),
    preferences: preferences.map((preference) => preference.preference),
  };
}

/**
 * Writes the onboarding step + all entered values in a single transaction
 * (profile upsert + full photo/preference replacement). Any crash between the
 * steps cannot leave the draft half-persisted.
 */
export async function saveOnboardingDraft(
  step: number,
  draft: OnboardingDraftData
): Promise<void> {
  await db.transaction(async (tx) => {
    const flattened = {
      firstName: draft.firstName,
      lastName: draft.lastName,
      dateOfBirth: draft.dateOfBirth,
      city: draft.city,
      bio: draft.bio,
      lookingFor: draft.lookingFor,
      familyInvolved: draft.familyInvolved,
      waliContact: draft.waliContact,
      familyRelationship: draft.familyRelationship,
      onboardingStep: step,
      updatedAt: new Date(),
    };

    await tx
      .insert(profiles)
      .values({ id: MY_PROFILE_ID, ...flattened, onboardingCompleted: false })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { ...flattened, onboardingCompleted: false },
      });

    await tx.delete(profilePhotos).where(eq(profilePhotos.profileId, MY_PROFILE_ID));
    if (draft.photos.length > 0) {
      await tx.insert(profilePhotos).values(
        draft.photos.map((uri, position) => ({
          id: Crypto.randomUUID(),
          profileId: MY_PROFILE_ID,
          uri,
          position,
        }))
      );
    }

    await tx
      .delete(profilePreferences)
      .where(eq(profilePreferences.profileId, MY_PROFILE_ID));
    if (draft.preferences.length > 0) {
      await tx.insert(profilePreferences).values(
        draft.preferences.map((preference, position) => ({
          profileId: MY_PROFILE_ID,
          preference,
          position,
        }))
      );
    }
  });
}

export async function setOnboardingStep(step: number): Promise<void> {
  await db
    .update(profiles)
    .set({ onboardingStep: step, updatedAt: new Date() })
    .where(eq(profiles.id, MY_PROFILE_ID));
}

export async function markOnboardingComplete(): Promise<void> {
  await db
    .update(profiles)
    .set({ onboardingStep: 4, onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(profiles.id, MY_PROFILE_ID));
}