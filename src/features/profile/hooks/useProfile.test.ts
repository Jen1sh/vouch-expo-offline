import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";

import {
  clearUserSwipes,
} from "@/src/features/browse/store/user-swipes";
import { useProfile } from "@/src/features/profile/hooks/useProfile";
import type { CatalogProfileDetail } from "@/src/db/queries/catalog.queries";

const fakeProfile: CatalogProfileDetail = {
  id: "p-1",
  firstName: "Amira",
  lastName: "Al-Farsi",
  age: 29,
  city: "Dubai",
  distanceKm: 5,
  verified: true,
  occupation: "Architect",
  bio: "test bio",
  photoUri: "https://img.example/p-1.jpg",
  interests: ["Travel", "Film"],
  photos: [
    "https://img.example/p-1.jpg",
    "https://img.example/p-1-b.jpg",
    "https://img.example/p-1-c.jpg",
  ],
};

jest.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => {
    // Simulate immediate focus
    cb();
  },
}));

const mockGetCatalogProfileDetail = jest.fn<
  (id: string) => Promise<CatalogProfileDetail | undefined>
>();
const mockSeedCatalogIfEmpty = jest.fn<() => Promise<void>>();

jest.mock("@/src/db/queries/catalog.queries", () => ({
  getCatalogProfileDetail: (id: string) => mockGetCatalogProfileDetail(id),
  seedCatalogIfEmpty: () => mockSeedCatalogIfEmpty(),
}));

const mockGetMatchByProfileId = jest.fn<
  (id: string) => Promise<{ id: string; profileId: string } | undefined>
>();

jest.mock("@/src/db/queries/matches.queries", () => ({
  getMatchByProfileId: (id: string) => mockGetMatchByProfileId(id),
}));

const mockListAllSwipes = jest.fn<() => Promise<unknown[]>>();

jest.mock("@/src/db/queries/swipes.queries", () => ({
  listAllSwipes: () => mockListAllSwipes(),
}));

jest.mock("@/src/db/migrate", () => ({
  ensureMigrated: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.mock("@/src/features/browse/store/user-swipes", () => {
  const actual = jest.requireActual<
    typeof import("@/src/features/browse/store/user-swipes")
  >("@/src/features/browse/store/user-swipes");
  return { ...actual };
});

beforeEach(() => {
  clearUserSwipes();
  mockGetCatalogProfileDetail.mockReset();
  mockSeedCatalogIfEmpty.mockReset();
  mockGetMatchByProfileId.mockReset();
  mockListAllSwipes.mockReset();
  mockGetCatalogProfileDetail.mockResolvedValue(fakeProfile);
  mockSeedCatalogIfEmpty.mockResolvedValue(undefined);
  mockGetMatchByProfileId.mockResolvedValue(undefined);
  mockListAllSwipes.mockResolvedValue([]);
});

describe("useProfile (REQUIREMENTS §3.5)", () => {
  it("starts in loading state and resolves to ready with the profile data", async () => {
    const { result } = renderHook(() => useProfile("p-1"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.profile?.firstName).toBe("Amira");
    expect(result.current.profile?.photos).toHaveLength(3);
  });

  it("sets matchedMatchId when the profile is an existing match", async () => {
    mockGetMatchByProfileId.mockResolvedValue({ id: "match-42", profileId: "p-1" });
    const { result } = renderHook(() => useProfile("p-1"));
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.matchedMatchId).toBe("match-42");
  });

  it("returns null matchedMatchId when no match exists", async () => {
    const { result } = renderHook(() => useProfile("p-1"));
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.matchedMatchId).toBeNull();
  });

  it("populates the decision mirror from hydrated swipes", async () => {
    // A persisted "like" in the swipes mirror should hydrate into the screen's
    // per-profile decision after the focus refresh.
    mockListAllSwipes.mockResolvedValue([
      { profileId: "p-1", direction: "like", outboxItemId: "o1", createdAt: 0, updatedAt: 0 },
    ]);
    const { result } = renderHook(() => useProfile("p-1"));
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.decision).toBe("like");
  });
});