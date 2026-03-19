import { Request, Response, NextFunction } from "express";
import { authMiddleware } from "../auth-middleware";
import { applicationConfig } from "../../utility/config";

jest.mock("../../utility/config", () => ({
  applicationConfig: {
    DOWNTIME_ON: false,
    AUTHENTICATION_DISABLED: false,
  },
}));

describe("Authentication Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    mockReq = {
      session: {} as any,
      originalUrl: "/api/test/endpoint",
    };

    mockRes = {
      redirect: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Reset config to defaults
    (applicationConfig as any).DOWNTIME_ON = false;
    (applicationConfig as any).AUTHENTICATION_DISABLED = false;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("Normal authentication flow", () => {
    it("should allow authenticated users with valid session", () => {
      (mockReq as any).session.users_id = {
        id: "user-123",
        userName: "testuser",
        userRole: "admin",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("REQUEST URL : /api/test/endpoint || USER : testuser");
    });

    it("should redirect unauthenticated users to home", () => {
      (mockReq as any).session.users_id = undefined;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle null session", () => {
      (mockReq as any).session = null;

      expect(() => {
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it("should handle undefined session", () => {
      mockReq.session = undefined;

      expect(() => {
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it("should handle session with empty users_id object", () => {
      (mockReq as any).session.users_id = {};

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });

  describe("Downtime mode", () => {
    beforeEach(() => {
      (applicationConfig as any).DOWNTIME_ON = true;
    });

    it("should redirect all users when downtime is enabled", () => {
      (mockReq as any).session.users_id = {
        id: "admin-123",
        userName: "admin",
        userRole: "admin",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should redirect even with valid session during downtime", () => {
      (mockReq as any).session.users_id = {
        id: "user-456",
        userName: "validuser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should redirect unauthenticated users during downtime", () => {
      (mockReq as any).session.users_id = undefined;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Authentication disabled mode", () => {
    beforeEach(() => {
      (applicationConfig as any).AUTHENTICATION_DISABLED = true;
      (applicationConfig as any).DOWNTIME_ON = false;
    });

    it("should create dummy session when authentication is disabled", () => {
      (mockReq as any).session.users_id = undefined;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).session.users_id).toEqual({
        id: "dummySessionId",
        userName: "dummyUserName",
        userRole: "user",
      });
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it("should override existing session when authentication is disabled", () => {
      (mockReq as any).session.users_id = {
        id: "real-user",
        userName: "realuser",
        userRole: "admin",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).session.users_id).toEqual({
        id: "dummySessionId",
        userName: "dummyUserName",
        userRole: "user",
      });
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should still respect downtime even when auth is disabled", () => {
      (applicationConfig as any).DOWNTIME_ON = true;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
      expect((mockReq as any).session.users_id).toBeUndefined();
    });
  });

  describe("User roles and session data", () => {
    it("should handle admin role", () => {
      (mockReq as any).session.users_id = {
        id: "admin-001",
        userName: "adminUser",
        userRole: "admin",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("REQUEST URL : /api/test/endpoint || USER : adminUser");
    });

    it("should handle user role", () => {
      (mockReq as any).session.users_id = {
        id: "user-001",
        userName: "regularUser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("REQUEST URL : /api/test/endpoint || USER : regularUser");
    });

    it("should handle superadmin role", () => {
      (mockReq as any).session.users_id = {
        id: "super-001",
        userName: "superAdmin",
        userRole: "superadmin",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle missing userRole property", () => {
      (mockReq as any).session.users_id = {
        id: "user-no-role",
        userName: "userWithoutRole",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle special characters in username", () => {
      (mockReq as any).session.users_id = {
        id: "user-special",
        userName: "user'with\"special<>characters&",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("REQUEST URL : /api/test/endpoint || USER : user'with\"special<>characters&");
    });

    it("should handle very long usernames", () => {
      const longUsername = "u".repeat(1000);
      (mockReq as any).session.users_id = {
        id: "user-long",
        userName: longUsername,
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(`REQUEST URL : /api/test/endpoint || USER : ${longUsername}`);
    });
  });

  describe("URL logging", () => {
    it("should log different URL formats correctly", () => {
      const urls = ["/api/products", "/api/v2/algo/settings", "/admin/dashboard", "/", "/path/with/special?query=param&other=value", "/path#with-hash", ""];

      urls.forEach((url) => {
        mockReq.originalUrl = url;
        (mockReq as any).session.users_id = {
          id: "test-user",
          userName: "testUser",
          userRole: "user",
        };

        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(consoleLogSpy).toHaveBeenCalledWith(`REQUEST URL : ${url} || USER : testUser`);
      });
    });

    it("should handle undefined originalUrl", () => {
      mockReq.originalUrl = undefined;
      (mockReq as any).session.users_id = {
        id: "test-user",
        userName: "testUser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("REQUEST URL : undefined || USER : testUser");
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("should handle session with null users_id", () => {
      (mockReq as any).session.users_id = null;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle session with false users_id", () => {
      (mockReq as any).session.users_id = false;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle session with 0 as users_id", () => {
      (mockReq as any).session.users_id = 0;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle session with empty string users_id", () => {
      (mockReq as any).session.users_id = "";

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle throwing errors in redirect", () => {
      (mockReq as any).session.users_id = undefined;
      mockRes.redirect = jest.fn().mockImplementation(() => {
        throw new Error("Redirect failed");
      });

      expect(() => {
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow("Redirect failed");
    });

    it("should handle concurrent requests", () => {
      const requests = Array(10)
        .fill(null)
        .map((_, i) => ({
          session: {
            users_id: i % 2 === 0 ? { id: `user-${i}`, userName: `user${i}`, userRole: "user" } : undefined,
          },
          originalUrl: `/api/endpoint/${i}`,
        }));

      requests.forEach((req, i) => {
        authMiddleware(req as any, mockRes as Response, mockNext);

        if (i % 2 === 0) {
          expect(mockNext).toHaveBeenCalled();
        } else {
          expect(mockRes.redirect).toHaveBeenCalledWith("/");
        }

        jest.clearAllMocks();
      });
    });
  });

  describe("Config combinations", () => {
    it("should handle all config flags being true", () => {
      (applicationConfig as any).DOWNTIME_ON = true;
      (applicationConfig as any).AUTHENTICATION_DISABLED = true;

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Downtime takes precedence
      expect(mockRes.redirect).toHaveBeenCalledWith("/");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle all config flags being false", () => {
      (applicationConfig as any).DOWNTIME_ON = false;
      (applicationConfig as any).AUTHENTICATION_DISABLED = false;
      (mockReq as any).session.users_id = {
        id: "user-123",
        userName: "testuser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it("should handle undefined config values", () => {
      (applicationConfig as any).DOWNTIME_ON = undefined;
      (applicationConfig as any).AUTHENTICATION_DISABLED = undefined;
      (mockReq as any).session.users_id = {
        id: "user-123",
        userName: "testuser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it("should handle null config values", () => {
      (applicationConfig as any).DOWNTIME_ON = null;
      (applicationConfig as any).AUTHENTICATION_DISABLED = null;
      (mockReq as any).session.users_id = {
        id: "user-123",
        userName: "testuser",
        userRole: "user",
      };

      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });
});
