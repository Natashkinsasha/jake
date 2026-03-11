import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as any;
    guard = new JwtAuthGuard(jwtService);
  });

  const mockContext = (authHeader?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader ? { authorization: authHeader } : {},
          user: null,
        }),
      }),
    }) as any;

  it("should allow valid token", async () => {
    const payload = { sub: "user-1", email: "test@test.com" };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    const result = await guard.canActivate(mockContext("Bearer valid-token"));
    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
  });

  it("should attach payload to request.user", async () => {
    const payload = { sub: "user-1", email: "test@test.com" };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    const request = { headers: { authorization: "Bearer valid-token" }, user: null };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    await guard.canActivate(context);
    expect(request.user).toEqual(payload);
  });

  it("should throw on missing auth header", async () => {
    await expect(guard.canActivate(mockContext())).rejects.toThrow(UnauthorizedException);
  });

  it("should throw on invalid token", async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("invalid"));
    await expect(guard.canActivate(mockContext("Bearer bad-token"))).rejects.toThrow(UnauthorizedException);
  });

  it("should throw on non-Bearer scheme", async () => {
    await expect(guard.canActivate(mockContext("Basic abc123"))).rejects.toThrow(UnauthorizedException);
  });

  it("should throw when authorization header is empty string", async () => {
    await expect(guard.canActivate(mockContext(""))).rejects.toThrow(UnauthorizedException);
  });
});
