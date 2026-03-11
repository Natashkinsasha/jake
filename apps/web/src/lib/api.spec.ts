import { api } from "./api";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  });
  // Mock localStorage
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn().mockReturnValue("test-token"),
      setItem: jest.fn(),
    },
    writable: true,
  });
});

describe("api", () => {
  describe("auth.google", () => {
    it("posts to /auth/google", async () => {
      const data = { googleId: "g1", email: "test@test.com", name: "Test", avatarUrl: null };
      await api.auth.google(data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/google"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("tutor.profiles", () => {
    it("fetches /tutor/profiles", async () => {
      await api.tutor.profiles();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/tutor/profiles"), expect.any(Object));
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    await expect(api.tutor.profiles()).rejects.toThrow("API Error 401 /tutor/profiles: Unauthorized");
  });

  it("includes authorization header", async () => {
    await api.tutor.profiles();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });
});
