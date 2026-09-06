import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldError, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";

import {
  buildStepZodSchema,
  ONBOARDING_STEP_COUNT,
  onboardingFieldDefs,
  type OnboardingFormValues,
} from "./schema";

import { ensureMigrated } from "@/src/db/migrate";
import {
  getMyProfile,
  saveOnboardingDraft,
  setOnboardingStep,
  type OnboardingDraftData,
} from "@/src/db/queries/profiles.queries";
import { useAuth } from "@/src/features/auth/context/use-auth";

const AUTOSAVE_DEBOUNCE_MS = 800;

function emptyDefaults(): OnboardingFormValues {
  const defaults: OnboardingFormValues = {};
  for (const field of onboardingFieldDefs) {
    defaults[field.key] = field.type === "multiSelect" || field.type === "photos" ? [] : "";
  }
  return defaults;
}

function toDraft(values: OnboardingFormValues): OnboardingDraftData {
  const asString = (key: string): string => {
    const value = values[key];
    return typeof value === "string" ? value : "";
  };
  const asStringArray = (key: string): string[] => {
    const value = values[key];
    return Array.isArray(value) ? value.map(String) : [];
  };
  return {
    firstName: asString("firstName"),
    lastName: asString("lastName"),
    dateOfBirth: asString("dateOfBirth"),
    city: asString("city"),
    bio: asString("bio"),
    lookingFor: asString("lookingFor"),
    familyInvolved: asString("familyInvolved"),
    waliContact: asString("waliContact"),
    familyRelationship: asString("familyRelationship"),
    photos: asStringArray("photos"),
    preferences: asStringArray("interests"),
  };
}

function zodErrorsToFieldErrors(error: z.ZodError): FieldErrors<OnboardingFormValues> {
  const errors: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path.length === 0 || path in errors) {
      continue;
    }
    errors[path] = { type: "validation", message: issue.message };
  }
  return errors as FieldErrors<OnboardingFormValues>;
}

export function useOnboardingForm() {
  const { onboardingStep, setOnboardingStep: setAuthStep, markOnboardingComplete: completeOnboarding } = useAuth();
  const [loadedProfileStep, setLoadedProfileStep] = useState<number | null>(null);

  const [step, setStep] = useState<number>(Math.max(1, onboardingStep));
  const stepRef = useRef(step);
  const valuesRef = useRef<OnboardingFormValues>({});

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const resolver = useMemo<Resolver<OnboardingFormValues>>(
    () => async (values) => {
      const schema = buildStepZodSchema(stepRef.current, values as Record<string, unknown>);
      const parsed = schema.safeParse(values);
      if (parsed.success) {
        return { values: parsed.data as OnboardingFormValues, errors: {} };
      }
      return { values: {}, errors: zodErrorsToFieldErrors(parsed.error) };
    },
    []
  );

  const form = useForm<OnboardingFormValues>({
    defaultValues: emptyDefaults(),
    resolver,
    mode: "onTouched",
  });

  // Hydrate from the durable draft on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureMigrated();
      const profile = await getMyProfile();
      if (cancelled) {
        return;
      }
      const defaults = emptyDefaults();
      if (profile && profile.onboardingStep > 0) {
        defaults.firstName = profile.firstName;
        defaults.lastName = profile.lastName;
        defaults.dateOfBirth = profile.dateOfBirth;
        defaults.city = profile.city;
        defaults.bio = profile.bio;
        defaults.lookingFor = profile.lookingFor;
        defaults.familyInvolved = profile.familyInvolved;
        defaults.waliContact = profile.waliContact;
        defaults.familyRelationship = profile.familyRelationship;
        defaults.photos = profile.photos;
        defaults.interests = profile.preferences;
        setLoadedProfileStep(Math.min(Math.max(1, profile.onboardingStep), ONBOARDING_STEP_COUNT));
      } else {
        setLoadedProfileStep(1);
      }
      form.reset(defaults);
      valuesRef.current = defaults;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adopt the persisted step once the profile is loaded.
  useEffect(() => {
    if (loadedProfileStep !== null && loadedProfileStep > 0) {
      setStep(loadedProfileStep);
    }
  }, [loadedProfileStep]);

  // Debounced autosave of the whole draft (values + current step). A kill at
  // any point resumes on the last persisted step with all values intact.
  useEffect(() => {
    if (loadedProfileStep === null) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.watch((values) => {
      const current = values as OnboardingFormValues;
      valuesRef.current = current;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void persistDraft(stepRef.current, valuesRef.current);
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [form, loadedProfileStep]);

  // Persist the step number as soon as it changes (no debounce).
  useEffect(() => {
    if (loadedProfileStep === null) {
      return;
    }
    setAuthStep(step);
    void setOnboardingStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loadedProfileStep]);

  const goBack = (): void => {
    if (step <= 1) {
      return;
    }
    void persistDraft(step, form.getValues());
    setStep(step - 1);
  };

  const goNext = async (): Promise<boolean> => {
    const valid = await form.trigger();
    if (!valid) {
      return false;
    }
    const currentStep = step;
    if (currentStep < ONBOARDING_STEP_COUNT) {
      await persistDraft(currentStep, form.getValues());
      setStep(currentStep + 1);
      return true;
    }
    await persistDraft(currentStep, form.getValues());
    await completeOnboarding();
    return true;
  };

  const persistDraftAsync = useCallback(
    (): Promise<void> => persistDraft(stepRef.current, valuesRef.current),
    []
  );

  return {
    form,
    step,
    loadedProfileStep,
    goBack,
    goNext,
    canGoBack: step > 1,
    isLastStep: step === ONBOARDING_STEP_COUNT,
    persistDraft: persistDraftAsync,
  };
}

async function persistDraft(step: number, values: OnboardingFormValues): Promise<void> {
  if (step < 1) {
    return;
  }
  await ensureMigrated();
  await saveOnboardingDraft(step, toDraft(values));
}