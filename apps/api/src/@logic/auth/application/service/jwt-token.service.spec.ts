import { type JwtService } from "@nestjs/jwt";
import { JwtTokenService } from "./jwt-token.service";

describe("JwtTokenService", () => {
  let service: JwtTokenService;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as any;
    service = new JwtTokenService(jwtService);
  });

  describe("generateToken", () => {
    it("should call signAsync with correct payload", async () => {
      const expectedToken = "signed-jwt-token";
      (jwtService.signAsync as jest.Mock).mockResolvedValue(expectedToken);

      const result = await service.generateToken("user-123", "test@example.com");

      expect(result).toBe(expectedToken);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: "user-123",
        email: "test@example.com",
      });
    });

    it("should propagate errors from JwtService", async () => {
      (jwtService.signAsync as jest.Mock).mockRejectedValue(new Error("signing failed"));

      await expect(service.generateToken("user-123", "test@example.com")).rejects.toThrow("signing failed");
    });
  });

  describe("verifyToken", () => {
    it("should call verifyAsync with the token", async () => {
      const payload = { sub: "user-123", email: "test@example.com" };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const result = await service.verifyToken("some-token");

      expect(result).toEqual(payload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith("some-token");
    });

    it("should propagate errors for invalid tokens", async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("invalid token"));

      await expect(service.verifyToken("bad-token")).rejects.toThrow("invalid token");
    });
  });
});
