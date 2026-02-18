import { GetLoggedInUser, GetAuditInfo, GetAuditValue } from "../session-helper";

describe("session-helper", () => {
  describe("GetLoggedInUser", () => {
    it("should return session users_id from request", async () => {
      const req = { session: { users_id: { id: 1, name: "john" } } };
      const result = await GetLoggedInUser(req as any);
      expect(result).toEqual({ id: 1, name: "john" });
    });

    it("should return undefined when session has no users_id", async () => {
      const req = { session: {} };
      const result = await GetLoggedInUser(req as any);
      expect(result).toBeUndefined();
    });
  });

  describe("GetAuditInfo", () => {
    it("should return AuditInfo with userName when session has users_id", async () => {
      const req = { session: { users_id: { userName: "admin" } } };
      const result = await GetAuditInfo(req as any);
      expect(result).toBeDefined();
      expect(result.UpdatedBy).toBe("admin");
      expect(result.UpdatedOn).toBeInstanceOf(Date);
    });

    it("should return AuditInfo with ANONYMOUS when req is null", async () => {
      const result = await GetAuditInfo(null as any);
      expect(result).toBeDefined();
      expect(result.UpdatedBy).toBe("ANONYMOUS");
    });

    it("should return AuditInfo with ANONYMOUS when session is missing", async () => {
      const req = {};
      const result = await GetAuditInfo(req as any);
      expect(result).toBeDefined();
      expect(result.UpdatedBy).toBe("ANONYMOUS");
    });

    it("should return AuditInfo with ANONYMOUS when session has no users_id", async () => {
      const req = { session: {} };
      const result = await GetAuditInfo(req as any);
      expect(result).toBeDefined();
      expect(result.UpdatedBy).toBe("ANONYMOUS");
    });
  });

  describe("GetAuditValue", () => {
    it("should return UpdatedBy when key is U_NAME", async () => {
      const item = { AuditInfo: { UpdatedBy: "user1", UpdatedOn: new Date() } };
      const result = await GetAuditValue(item, "U_NAME");
      expect(result).toBe("user1");
    });

    it("should return formatted UpdatedOn when key is U_TIME", async () => {
      const date = new Date("2024-06-15T14:30:00.000Z");
      const item = { AuditInfo: { UpdatedBy: "u", UpdatedOn: date } };
      const result = await GetAuditValue(item, "U_TIME");
      expect(result).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
    });

    it("should return null for U_TIME when UpdatedOn is missing", async () => {
      const item = { AuditInfo: { UpdatedBy: "u" } };
      const result = await GetAuditValue(item, "U_TIME");
      expect(result).toBeNull();
    });

    it("should return null when item has no AuditInfo", async () => {
      const result = await GetAuditValue({}, "U_NAME");
      expect(result).toBeNull();
    });

    it("should return null for unknown key", async () => {
      const item = { AuditInfo: { UpdatedBy: "u", UpdatedOn: new Date() } };
      const result = await GetAuditValue(item, "UNKNOWN");
      expect(result).toBeNull();
    });
  });
});
