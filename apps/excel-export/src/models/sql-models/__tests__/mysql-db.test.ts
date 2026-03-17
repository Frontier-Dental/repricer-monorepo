/**
 * Tests mysql-db module: tryDecrypt at load time and pool creation.
 * Config and Encrypto are mocked; mysql2 createPool is mocked.
 */

const mockCreatePool = jest.fn();
mockCreatePool.mockReturnValue({
  promise: jest.fn().mockReturnValue({
    getConnection: jest.fn(),
    query: jest.fn(),
    execute: jest.fn(),
  }),
});

jest.mock("../../../utility/config", () => ({
  applicationConfig: {
    SQL_HOSTNAME: "localhost",
    SQL_PORT: 3306,
    SQL_USERNAME: "user",
    SQL_PASSWORD: "plainPassword",
    SQL_DATABASE: "testdb",
    REPRICER_ENCRYPTION_KEY: "key-32-bytes-long!!!!!!!!!!!!!!",
  },
}));

const mockDecrypt = jest.fn();
jest.mock("../../../utility/encrypto", () => ({
  __esModule: true,
  default: class MockEncrypto {
    decrypt(v: string) {
      return mockDecrypt(v);
    }
  },
}));

jest.mock("mysql2", () => ({
  __esModule: true,
  default: {
    createPool: (opts: unknown) => mockCreatePool(opts),
  },
}));

describe("mysql-db", () => {
  beforeEach(() => {
    mockDecrypt.mockImplementation((v: string) => v);
  });

  it("should create pool with correct configuration and password from tryDecrypt", async () => {
    await import("../mysql-db");
    expect(mockCreatePool).toHaveBeenCalled();
    const call = mockCreatePool.mock.calls[0][0];
    expect(call.host).toBe("localhost");
    expect(call.port).toBe(3306);
    expect(call.user).toBe("user");
    expect(call.database).toBe("testdb");
    expect(call.password).toBe("plainPassword");
    expect(call.waitForConnections).toBe(true);
    expect(call.connectionLimit).toBe(100);
    expect(call.password).toBe("plainPassword");
  });
});
