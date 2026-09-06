import { z } from "zod";

export type FieldType = "text" | "phone" | "date" | "select" | "multiSelect" | "photos";

export type ConditionalRule = {
  /** The field whose value gates this field's visibility. */
  gatedBy: string;
  /** When the gating field equals this value, this field is visible. */
  showsWhen: string;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type FieldMessages = {
  /** Empty required field (also covers an empty required date). */
  empty?: string;
  /** Text shorter than `minLength`. */
  tooShort?: string;
  /** Text longer than `maxLength`. */
  tooLong?: string;
  /** multiSelect / photos below the minimum. */
  minItems?: string;
  /** photos above `maxPhotos`. */
  maxItems?: string;
  /** date not matching YYYY-MM-DD. */
  format?: string;
};

export type FieldDef = {
  key: string;
  step: number;
  type: FieldType;
  label: string;
  placeholder?: string;
  helperText?: string;
  options?: SelectOption[];
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  maxPhotos?: number;
  /** Overrides for the friendly validation copy; everything else is derived from `label`. */
  messages?: FieldMessages;
  /** Rules that hide this field unless the gating field matches. */
  conditional?: ConditionalRule;
};

/**
 * Schema-driven onboarding form. The screen renders strictly from this
 * config — adding or validating a field means editing here, never in JSX.
 * Steps: 1 basics, 2 photos, 3 preferences, 4 who can vouch for you.
 *
 * Step 4 demonstrates conditionals: `familyInvolved === "yes"` reveals
 * `waliContact` and `familyRelationship` (REQUIREMENTS.md §3.2).
 */
export const onboardingFieldDefs: FieldDef[] = [
  {
    key: "firstName",
    step: 1,
    type: "text",
    label: "First name",
    placeholder: "As your circle knows you",
    required: true,
    minLength: 2,
  },
  {
    key: "lastName",
    step: 1,
    type: "text",
    label: "Last name",
    placeholder: "Surname",
    required: true,
    minLength: 2,
  },
  {
    key: "dateOfBirth",
    step: 1,
    type: "date",
    label: "Date of birth",
    placeholder: "YYYY-MM-DD",
    helperText: "Used only to match age preferences.",
    required: true,
  },
  {
    key: "city",
    step: 1,
    type: "text",
    label: "City",
    placeholder: "Where you're based",
    required: true,
    minLength: 2,
  },
  {
    key: "bio",
    step: 1,
    type: "text",
    label: "Short bio",
    placeholder: "Optional — what should people know?",
    maxLength: 500,
  },

  { key: "photos", step: 2, type: "photos", label: "Photos", required: true, maxPhotos: 6, messages: { minItems: "Add at least one photo.", maxItems: "You can add up to 6 photos." } },

  {
    key: "lookingFor",
    step: 3,
    type: "select",
    label: "I'm on Vouch to find",
    required: true,
    messages: { empty: "Please choose what you're looking for." },
    options: [
      { label: "Professional connections", value: "professional-connections" },
      { label: "Mentorship", value: "mentorship" },
      { label: "Collaboration", value: "collaboration" },
      { label: "Community", value: "community" },
      { label: "Friendship", value: "friendship" },
    ],
  },
  {
    key: "interests",
    step: 3,
    type: "multiSelect",
    label: "My interests",
    helperText: "Pick at least one.",
    required: true,
    messages: { minItems: "Pick at least one interest." },
    options: [
      { label: "Entrepreneurship", value: "entrepreneurship" },
      { label: "Design", value: "design" },
      { label: "Engineering", value: "engineering" },
      { label: "Community building", value: "community-building" },
      { label: "Arts & culture", value: "arts-culture" },
      { label: "Wellness", value: "wellness" },
      { label: "Education", value: "education" },
      { label: "Finance", value: "finance" },
    ],
  },

  {
    key: "familyInvolved",
    step: 4,
    type: "select",
    label: "Should family be involved in your vouches?",
    required: true,
    messages: { empty: "Please choose an option." },
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    key: "waliContact",
    step: 4,
    type: "phone",
    label: "Wali contact",
    placeholder: "Phone number",
    required: true,
    messages: { empty: "Please enter your wali's contact number." },
    conditional: { gatedBy: "familyInvolved", showsWhen: "yes" },
  },
  {
    key: "familyRelationship",
    step: 4,
    type: "select",
    label: "Their relationship to you",
    required: true,
    messages: { empty: "Please choose their relationship to you." },
    options: [
      { label: "Father", value: "father" },
      { label: "Brother", value: "brother" },
      { label: "Uncle", value: "uncle" },
      { label: "Grandfather", value: "grandfather" },
      { label: "Other", value: "other" },
    ],
    conditional: { gatedBy: "familyInvolved", showsWhen: "yes" },
  },
];

export const ONBOARDING_STEP_COUNT = 4;

export const stepTitles: Record<number, string> = {
  1: "Basics",
  2: "Photos",
  3: "Preferences",
  4: "Who can vouch for you",
};

export const stepSubtitles: Record<number, string> = {
  1: "The essentials your circle needs to recognize you.",
  2: "A few current photos — no uploads, they stay on this device.",
  3: "What you're here to find.",
  4: "Who should back you up when someone asks about you.",
};

/** Form values are strings (text/date/phone/select) or string arrays (multiSelect/photos). */
export type OnboardingFormValues = Record<string, string | string[]>;

const DATE_BIRTH_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getFieldsForStep(step: number): FieldDef[] {
  return onboardingFieldDefs.filter((field) => field.step === step);
}

/**
 * Fields actually visible on a step, honoring conditional rules. Hidden
 * fields keep their form values but are excluded from validation.
 */
export function getVisibleFields(step: number, values: Record<string, unknown>): FieldDef[] {
  return getFieldsForStep(step).filter((field) => {
    if (!field.conditional) {
      return true;
    }
    return values[field.conditional.gatedBy] === field.conditional.showsWhen;
  });
}

export function fieldZodSchema(field: FieldDef): z.ZodType<string | string[] | undefined> {
  const messages = field.messages ?? {};

  let schema: ZodTypeUnion;

  switch (field.type) {
    case "multiSelect": {
      const array = z.array(z.string().trim());
      schema = field.required ? array.min(1, messages.minItems ?? "Pick at least one.") : array.optional();
      break;
    }
    case "photos": {
      const max = field.maxPhotos ?? 6;
      const array = z.array(z.string()).max(max, messages.maxItems ?? `You can add up to ${max} photos.`);
      schema = field.required ? array.min(1, messages.minItems ?? "Add at least one photo.") : array.optional();
      break;
    }
    case "date": {
      schema = field.required
        ? z
            .string()
            .trim()
            .min(1, messages.empty ?? "Please enter a date of birth.")
            .regex(DATE_BIRTH_REGEX, messages.format ?? "Use YYYY-MM-DD (e.g. 1995-06-12).")
        : z.string().trim().optional();
      break;
    }
    default: {
      const min = field.minLength ?? 1;
      const max = field.maxLength ?? 10_000;
      const empty = messages.empty ?? `${field.label} is required.`;
      const tooShort = messages.tooShort ?? `Please enter at least ${min} characters.`;
      const tooLong = messages.tooLong ?? `${field.label} can be at most ${max} characters.`;

      if (!field.required) {
        schema = z.string().trim().max(max, tooLong).min(0);
        break;
      }

      let requiredString = z.string().trim().max(max, tooLong);
      requiredString = requiredString.min(1, empty);
      if (min > 1) {
        requiredString = requiredString.min(min, tooShort);
      }
      schema = requiredString;
    }
  }

  return schema;
}

type ZodTypeUnion = z.ZodString | z.ZodOptional<z.ZodString> | z.ZodArray<z.ZodString> | z.ZodOptional<z.ZodArray<z.ZodString>>;

/**
 * Builds the zod schema that validates exactly the visible fields of a step,
 * keeping any values belonging to other (or hidden) fields via `.passthrough()`.
 */
export function buildStepZodSchema(
  step: number,
  values: Record<string, unknown>
): ReturnType<typeof z.object> {
  const fieldSchemas: Record<string, z.ZodType<string | string[] | undefined>> = {};
  for (const field of getVisibleFields(step, values)) {
    fieldSchemas[field.key] = fieldZodSchema(field);
  }
  return z.object(fieldSchemas).passthrough();
}