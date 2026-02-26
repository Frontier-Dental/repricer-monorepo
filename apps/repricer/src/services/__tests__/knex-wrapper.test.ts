import { Knex, knex } from "knex";
import { getKnexInstance, destroyKnexInstance } from "../knex-wrapper";
import { applicationConfig } from "../../utility/config";
import Encrypto from "../../utility/encrypto";

jest.mock("knex");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    REPRICER_ENCRYPTION_KEY: "test-encryption-key",
    SQL_PASSWORD: "encrypted-password",
    SQL_HOSTNAME: "localhost",
    SQL_PORT: 3306,
    SQL_USERNAME: "testuser",
    SQL_DATABASE: "testdb",
  },
}));
jest.mock("../../utility/encrypto");

describe("Knex Wrapper Service", () => {
  let mockKnexInstance: jest.Mocked<Knex>;
  let mockEncrypto: jest.Mocked<Encrypto>;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    mockKnexInstance = {
      destroy: jest.fn().mockResolvedValue(undefined),
      raw: jest.fn(),
      select: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      schema: {} as any,
    } as any;

    (knex as unknown as jest.Mock).mockReturnValue(mockKnexInstance);

    mockEncrypto = {
      decrypt: jest.fn().mockReturnValue("decrypted-password"),
      encrypt: jest.fn(),
    } as any;

    (Encrypto as jest.MockedClass<typeof Encrypto>).mockImplementation(() => mockEncrypto);
  });

  afterEach(async () => {
    try {
      // Reset destroy mock so a test that made it hang/reject doesn't break cleanup
      mockKnexInstance.destroy.mockResolvedValue(undefined);
      await destroyKnexInstance();
    } catch {
      // Ignore destroy errors so one test's mock doesn't break others
    }
    consoleWarnSpy.mockRestore();
  });

  describe("getKnexInstance", () => {
    it("should create a new instance on first call", () => {
      const instance = getKnexInstance();

      expect(Encrypto).toHaveBeenCalledWith("test-encryption-key");
      expect(mockEncrypto.decrypt).toHaveBeenCalledWith("encrypted-password");
      expect(knex).toHaveBeenCalledWith({
        client: "mysql2",
        connection: {
          host: "localhost",
          port: 3306,
          user: "testuser",
          password: "decrypted-password",
          database: "testdb",
        },
        pool: { min: 0 },
        asyncStackTraces: true,
      });
      expect(instance).toBe(mockKnexInstance);
    });

    it("should return the same instance on subsequent calls", () => {
      const instance1 = getKnexInstance();
      const instance2 = getKnexInstance();
      const instance3 = getKnexInstance();

      expect(knex).toHaveBeenCalledTimes(1);
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });

    it("should use correct configuration values", () => {
      (applicationConfig as any).SQL_HOSTNAME = "db.example.com";
      (applicationConfig as any).SQL_PORT = 3307;
      (applicationConfig as any).SQL_USERNAME = "produser";
      (applicationConfig as any).SQL_DATABASE = "proddb";

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            host: "db.example.com",
            port: 3307,
            user: "produser",
            database: "proddb",
          }),
        })
      );
    });

    it("should handle decryption errors", () => {
      mockEncrypto.decrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      expect(() => getKnexInstance()).toThrow("Decryption failed");
    });

    it("should handle missing encryption key", () => {
      (applicationConfig as any).REPRICER_ENCRYPTION_KEY = undefined;

      getKnexInstance();

      expect(Encrypto).toHaveBeenCalledWith(undefined);
    });

    it("should handle empty password", () => {
      mockEncrypto.decrypt.mockReturnValue("");

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            password: "",
          }),
        })
      );
    });

    it("should handle special characters in password", () => {
      mockEncrypto.decrypt.mockReturnValue("p@$$w0rd!#$%^&*()");

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            password: "p@$$w0rd!#$%^&*()",
          }),
        })
      );
    });

    it("should handle null configuration values", () => {
      (applicationConfig as any).SQL_HOSTNAME = null;
      (applicationConfig as any).SQL_PORT = null;
      (applicationConfig as any).SQL_USERNAME = null;
      (applicationConfig as any).SQL_DATABASE = null;

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            host: null,
            port: null,
            user: null,
            database: null,
          }),
        })
      );
    });

    it("should set correct pool configuration", () => {
      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: { min: 0 },
        })
      );
    });

    it("should enable async stack traces", () => {
      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          asyncStackTraces: true,
        })
      );
    });
  });

  describe("destroyKnexInstance", () => {
    it("should destroy existing instance", async () => {
      getKnexInstance(); // Create instance
      await destroyKnexInstance();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Destroying Knex Instance");
      expect(mockKnexInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it("should set instance to null after destroy", async () => {
      const instance1 = getKnexInstance();
      await destroyKnexInstance();
      const instance2 = getKnexInstance(); // Should create new instance

      // After destroy, getKnexInstance() creates a new instance (knex called again)
      expect(knex).toHaveBeenCalledTimes(2);
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
    });

    it("should handle multiple destroy calls gracefully", async () => {
      await destroyKnexInstance();
      await destroyKnexInstance();
      await destroyKnexInstance();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(mockKnexInstance.destroy).not.toHaveBeenCalled();
    });

    it("should not warn when no instance exists", async () => {
      await destroyKnexInstance();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should handle destroy errors", async () => {
      mockKnexInstance.destroy.mockRejectedValue(new Error("Destroy failed"));

      getKnexInstance();

      await expect(destroyKnexInstance()).rejects.toThrow("Destroy failed");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Destroying Knex Instance");
    });

    it("should handle destroy timeout", async () => {
      mockKnexInstance.destroy.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));

      getKnexInstance();

      const destroyPromise = destroyKnexInstance();

      // Should be pending
      await expect(Promise.race([destroyPromise, new Promise((resolve) => setTimeout(() => resolve("timeout"), 100))])).resolves.toBe("timeout");
    });

    it("should create new instance after destroy", async () => {
      const instance1 = getKnexInstance();
      await destroyKnexInstance();
      const instance2 = getKnexInstance();

      expect(instance1).toBe(mockKnexInstance);
      expect(instance2).toBe(mockKnexInstance); // Same mock, but different calls
      expect(knex).toHaveBeenCalledTimes(2);
      expect(mockEncrypto.decrypt).toHaveBeenCalledTimes(2);
    });
  });

  describe("Singleton pattern", () => {
    it("should maintain singleton across multiple imports", () => {
      const instance1 = getKnexInstance();
      const instance2 = getKnexInstance();

      expect(instance1).toBe(instance2);
      expect(knex).toHaveBeenCalledTimes(1);
    });

    it("should handle concurrent calls", () => {
      const instances = Array(10)
        .fill(null)
        .map(() => getKnexInstance());

      instances.forEach((instance) => {
        expect(instance).toBe(mockKnexInstance);
      });
      expect(knex).toHaveBeenCalledTimes(1);
    });

    it("should handle race conditions on first call", () => {
      const promises = Array(10)
        .fill(null)
        .map(() => Promise.resolve(getKnexInstance()));

      return Promise.all(promises).then((instances) => {
        instances.forEach((instance) => {
          expect(instance).toBe(mockKnexInstance);
        });
        expect(knex).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Error scenarios", () => {
    it("should handle knex creation failure", () => {
      (knex as unknown as jest.Mock).mockImplementation(() => {
        throw new Error("Failed to create Knex instance");
      });

      expect(() => getKnexInstance()).toThrow("Failed to create Knex instance");
    });

    it("should handle invalid configuration", () => {
      (applicationConfig as any).SQL_PORT = "invalid-port";

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            port: "invalid-port",
          }),
        })
      );
    });

    it("should handle undefined knex return", () => {
      (knex as unknown as jest.Mock).mockReturnValue(undefined);

      const instance = getKnexInstance();

      expect(instance).toBeUndefined();
    });

    it("should handle null knex return", () => {
      (knex as unknown as jest.Mock).mockReturnValue(null);

      const instance = getKnexInstance();

      expect(instance).toBeNull();
    });
  });

  describe("Configuration edge cases", () => {
    it("should handle very long passwords", () => {
      const longPassword = "x".repeat(10000);
      mockEncrypto.decrypt.mockReturnValue(longPassword);

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            password: longPassword,
          }),
        })
      );
    });

    it("should handle non-standard ports", () => {
      (applicationConfig as any).SQL_PORT = 65535;

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            port: 65535,
          }),
        })
      );
    });

    it("should handle IPv6 addresses", () => {
      (applicationConfig as any).SQL_HOSTNAME = "::1";

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            host: "::1",
          }),
        })
      );
    });

    it("should handle special database names", () => {
      (applicationConfig as any).SQL_DATABASE = "test-db_123.special";

      getKnexInstance();

      expect(knex).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({
            database: "test-db_123.special",
          }),
        })
      );
    });
  });
});
