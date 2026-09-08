import { describe, expect, it } from "@jest/globals";
import {
  onboardingFieldDefs,
  getFieldsForStep,
  getVisibleFields,
  fieldZodSchema,
  buildStepZodSchema,
  ONBOARDING_STEP_COUNT,
  stepTitles,
  stepSubtitles,
  type FieldDef,
  type OnboardingFormValues,
} from "@/src/features/onboarding/schema";

const SAMPLE_VALUES: OnboardingFormValues = {
  firstName: "Amina",
  lastName: "Hassan",
  dateOfBirth: "1995-06-12",
  city: "London",
  bio: "Hello",
  photos: ["file:///a.jpg", "file:///b.jpg", "file:///c.jpg"],
  lookingFor: "mentorship",
  interests: ["design", "engineering"],
  familyInvolved: "yes",
  waliContact: "+441234567890",
  familyRelationship: "father",
};

describe("onboarding schema (REQUIREMENTS §3.2)", () => {
  it("defines exactly 4 steps", () => {
    const steps = new Set(onboardingFieldDefs.map((f) => f.step));
    expect(steps.size).toBe(ONBOARDING_STEP_COUNT);
  });

  it("has a title and subtitle for every step", () => {
    for (let i = 1; i <= ONBOARDING_STEP_COUNT; i++) {
      expect(stepTitles[i]).toBeTruthy();
      expect(stepSubtitles[i]).toBeTruthy();
    }
  });

  it("has a 'photos' field on step 2", () => {
    const step2 = getFieldsForStep(2);
    expect(step2.some((f) => f.key === "photos")).toBe(true);
  });

  it("filters step fields by getFieldsForStep", () => {
    const step1 = getFieldsForStep(1);
    expect(step1.length).toBeGreaterThan(0);
    expect(step1.every((f) => f.step === 1)).toBe(true);
  });

  it("shows conditional fields only when gating value matches", () => {
    const step4WithFamily = getVisibleFields(4, { familyInvolved: "yes" });
    expect(step4WithFamily.some((f) => f.key === "waliContact")).toBe(true);
    expect(step4WithFamily.some((f) => f.key === "familyRelationship")).toBe(true);

    const step4WithoutFamily = getVisibleFields(4, { familyInvolved: "no" });
    expect(step4WithoutFamily.some((f) => f.key === "waliContact")).toBe(false);
    expect(step4WithoutFamily.some((f) => f.key === "familyRelationship")).toBe(false);
    expect(step4WithoutFamily.some((f) => f.key === "familyInvolved")).toBe(true);
  });

  it("has at least 2 conditional fields", () => {
    const conditional = onboardingFieldDefs.filter((f) => f.conditional);
    expect(conditional.length).toBeGreaterThanOrEqual(2);
  });

  describe("fieldZodSchema", () => {
    const textField: FieldDef = {
      key: "name",
      step: 1,
      type: "text",
      label: "Name",
      required: true,
      minLength: 2,
      maxLength: 50,
    };

    it("requires non-empty text", () => {
      const schema = fieldZodSchema(textField);
      expect(schema.safeParse("").success).toBe(false);
      expect(schema.safeParse("A").success).toBe(false);
      expect(schema.safeParse("Ab").success).toBe(true);
    });

    it("allows empty optional text", () => {
      const schema = fieldZodSchema({ ...textField, required: false });
      expect(schema.safeParse("").success).toBe(true);
    });

    it("requires YYYY-MM-DD for date fields", () => {
      const dateField: FieldDef = { key: "dob", step: 1, type: "date", label: "DOB", required: true };
      const schema = fieldZodSchema(dateField);
      expect(schema.safeParse("1995-06-12").success).toBe(true);
      expect(schema.safeParse("06/12/1995").success).toBe(false);
      expect(schema.safeParse("abc").success).toBe(false);
    });

    it("requires at least 1 item in multiSelect", () => {
      const multiField: FieldDef = { key: "tags", step: 3, type: "multiSelect", label: "Tags", required: true };
      const schema = fieldZodSchema(multiField);
      expect(schema.safeParse([]).success).toBe(false);
      expect(schema.safeParse(["a"]).success).toBe(true);
    });

    it("enforces maxPhotos limit", () => {
      const photoField: FieldDef = { key: "photos", step: 2, type: "photos", label: "Photos", required: true, maxPhotos: 3 };
      const schema = fieldZodSchema(photoField);
      expect(schema.safeParse(["a", "b", "c"]).success).toBe(true);
      expect(schema.safeParse(["a", "b", "c", "d"]).success).toBe(false);
    });
  });

  describe("buildStepZodSchema", () => {
    it("validates all visible required fields on step 1", () => {
      const schema = buildStepZodSchema(1, SAMPLE_VALUES);
      expect(schema.safeParse(SAMPLE_VALUES).success).toBe(true);
    });

    it("rejects when a required field is missing", () => {
      const incomplete = { ...SAMPLE_VALUES, firstName: "" };
      const schema = buildStepZodSchema(1, incomplete);
      expect(schema.safeParse(incomplete).success).toBe(false);
    });

    it("passes through values from other steps", () => {
      const schema = buildStepZodSchema(1, SAMPLE_VALUES);
      const result = schema.safeParse(SAMPLE_VALUES);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lookingFor).toBe("mentorship");
      }
    });
  });
});
