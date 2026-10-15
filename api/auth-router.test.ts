import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSendOtpEmail = vi.fn();
const mockGenerateOtp = vi.fn(() => "123456");
const mockHashOtp = vi.fn(() => Promise.resolve("hashed-otp"));
const mockVerifyOtp = vi.fn(() => Promise.resolve(true));
const mockHashPassword = vi.fn(() => Promise.resolve("newhash"));
const mockComparePassword = vi.fn(() => Promise.resolve(true));

const selectLimitMock = vi.fn();
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: selectLimitMock,
  })),
  insert: vi.fn(() => ({
    values: insertValuesMock,
  })),
  update: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    where: updateSetMock,
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
  })),
};

const mockFindUserByEmail = vi.fn();
const mockUpdatePassword = vi.fn();

vi.mock("./lib/email", () => ({ sendOtpEmail: mockSendOtpEmail }));
vi.mock("./lib/otp", () => ({
  generateOtp: mockGenerateOtp,
  hashOtp: mockHashOtp,
  verifyOtp: mockVerifyOtp,
}));
vi.mock("./lib/password", () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
}));
vi.mock("./queries/connection", () => ({ getDb: () => mockDb }));
vi.mock("./queries/users", () => ({
  findUserByEmail: mockFindUserByEmail,
  updatePassword: mockUpdatePassword,
}));

const mockResetRecord = {
  id: 1,
  email: "test@example.com",
  token: "$2b$12$alreadyusedhash",
  expiresAt: new Date(Date.now() + 600000),
  used: false,
  createdAt: new Date(),
};

const mockUser = {
  id: 42, email: "test@example.com", username: "testuser", provider: "local",
  passwordHash: "oldhash", role: "fan", unionId: "union-42", name: "Test User",
  avatar: null, bio: null, instagram: null, banned: false, providerId: "42",
  emailVerified: true, createdAt: new Date(), updatedAt: new Date(),
  lastSignInAt: new Date(), xp: 0, usernameLower: "testuser",
  featuredCardIds: null, hiddenCardIds: null,
};

async function getCaller() {
  const { appRouter } = await import("./router");
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/auth.verifyOtp"),
    resHeaders: new Headers(),
  }).auth;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUserByEmail.mockResolvedValue(mockUser);
  mockUpdatePassword.mockResolvedValue(undefined);
  mockSendOtpEmail.mockResolvedValue({ success: true, emailId: "msg-1", message: "sent" });
  mockVerifyOtp.mockResolvedValue(true);
  selectLimitMock.mockResolvedValue([mockResetRecord]);
  insertValuesMock.mockResolvedValue({ insertId: 1 });
  updateSetMock.mockResolvedValue({ affectedRows: 1 });
});

describe("auth.verifyOtp — rate limiting", () => {
  it("returns BAD_REQUEST for first 3 failed attempts", async () => {
    mockVerifyOtp.mockResolvedValue(false);
    const caller = await getCaller();

    await expect(caller.verifyOtp({ email: "a@example.com", otp: "000000" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.verifyOtp({ email: "a@example.com", otp: "000000" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.verifyOtp({ email: "a@example.com", otp: "000000" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("returns TOO_MANY_REQUESTS after 3 failed attempts with same email", async () => {
    mockVerifyOtp.mockResolvedValue(false);
    const caller = await getCaller();

    for (let i = 0; i < 3; i++) {
      await expect(caller.verifyOtp({ email: "c@example.com", otp: "000000" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    await expect(caller.verifyOtp({ email: "c@example.com", otp: "000000" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("rate limit is scoped per-email", async () => {
    mockVerifyOtp.mockResolvedValue(false);
    const caller = await getCaller();

    for (let i = 0; i < 3; i++) {
      await caller.verifyOtp({ email: "d@example.com", otp: "000000" }).catch(() => {});
    }
    await expect(caller.verifyOtp({ email: "d@example.com", otp: "000000" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    // Different email should not be rate limited
    mockVerifyOtp.mockResolvedValueOnce(true);
    await expect(caller.verifyOtp({ email: "e@example.com", otp: "123456" })).resolves.toEqual({ success: true });
  });

  it("rejects invalid OTP (wrong code)", async () => {
    mockVerifyOtp.mockResolvedValue(false);
    const caller = await getCaller();

    await expect(caller.verifyOtp({ email: "invalid@example.com", otp: "999999" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid OTP",
    });
  });

  it("rejects expired OTP (no unexpired unused record found)", async () => {
    selectLimitMock.mockResolvedValueOnce([]);
    const caller = await getCaller();

    await expect(caller.verifyOtp({ email: "expired@example.com", otp: "123456" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid or expired OTP",
    });
  });

  it("accepts valid unused OTP", async () => {
    selectLimitMock.mockResolvedValueOnce([mockResetRecord]);
    mockVerifyOtp.mockResolvedValueOnce(true);
    const caller = await getCaller();

    await expect(caller.verifyOtp({ email: "valid@example.com", otp: "123456" })).resolves.toEqual({ success: true });
  });
});

describe("auth.resetPassword — OTP one-time-use enforcement", () => {
  it("rejects a used OTP (already consumed — filtered out by used=false)", async () => {
    // When the only reset record has used=true, the query with
    // eq(passwordResets.used, false) returns no records.
    selectLimitMock.mockResolvedValueOnce([]);

    const caller = await getCaller();

    await expect(
      caller.resetPassword({
        email: "used@example.com",
        otp: "123456",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Invalid or expired OTP" });
  });

  it("rejects a reused OTP after first successful reset", async () => {
    selectLimitMock.mockResolvedValueOnce([mockResetRecord]);
    mockVerifyOtp.mockResolvedValue(true);

    const caller = await getCaller();

    // First use succeeds
    await expect(
      caller.resetPassword({
        email: "reuse@example.com",
        otp: "123456",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    ).resolves.toEqual({ success: true });

    // Second use should fail because used=true now filters it out
    selectLimitMock.mockResolvedValueOnce([]);

    await expect(
      caller.resetPassword({
        email: "reuse@example.com",
        otp: "123456",
        newPassword: "another123",
        confirmPassword: "another123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Invalid or expired OTP" });
  });

  it("rejects when passwords do not match", async () => {
    const caller = await getCaller();

    await expect(
      caller.resetPassword({
        email: "mismatch@example.com",
        otp: "123456",
        newPassword: "newpassword123",
        confirmPassword: "different123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when no reset record exists", async () => {
    selectLimitMock.mockResolvedValueOnce([]);
    const caller = await getCaller();

    await expect(
      caller.resetPassword({
        email: "nobody@example.com",
        otp: "123456",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when OTP does not match", async () => {
    mockVerifyOtp.mockResolvedValueOnce(false);
    const caller = await getCaller();

    await expect(
      caller.resetPassword({
        email: "wrongotp@example.com",
        otp: "999999",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Invalid OTP" });
  });

  it("accepts valid unused OTP and resets password", async () => {
    const caller = await getCaller();

    await expect(
      caller.resetPassword({
        email: "validreset@example.com",
        otp: "123456",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      }),
    ).resolves.toEqual({ success: true });

    expect(mockUpdatePassword).toHaveBeenCalledWith(42, "newhash");
    expect(updateSetMock).toHaveBeenCalled();
  });
});

describe("auth.forgotPassword — email failure handling", () => {
  it("returns INTERNAL_SERVER_ERROR when sendOtpEmail throws", async () => {
    mockSendOtpEmail.mockRejectedValueOnce(new Error("Resend API error"));
    const caller = await getCaller();

    await expect(
      caller.forgotPassword({ email: "test@example.com" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("returns success without revealing user existence when user not found", async () => {
    mockFindUserByEmail.mockResolvedValueOnce(null);
    const caller = await getCaller();

    await expect(
      caller.forgotPassword({ email: "nobody@example.com" }),
    ).resolves.toMatchObject({ success: true });
  });
});
