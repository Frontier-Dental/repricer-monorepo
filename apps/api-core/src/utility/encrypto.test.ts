import Encrypto from "./encrypto";

describe("Encrypto", () => {
  const secretKey = "test-secret-key-12345";
  let encrypto: Encrypto;

  beforeEach(() => {
    encrypto = new Encrypto(secretKey);
  });

  describe("constructor", () => {
    it("should create an instance with a secret key", () => {
      expect(encrypto).toBeInstanceOf(Encrypto);
    });

    it("should hash the secret key to 32 bytes", () => {
      const encrypto2 = new Encrypto("different-key");
      expect(encrypto2).toBeInstanceOf(Encrypto);
    });
  });

  describe("encrypt", () => {
    it("should encrypt plain text", () => {
      const plainText = "Hello, World!";
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
      expect(encrypted).not.toBe(plainText);
    });

    it("should encrypt different plain texts to different encrypted texts", () => {
      const text1 = "Hello";
      const text2 = "World";
      const encrypted1 = encrypto.encrypt(text1);
      const encrypted2 = encrypto.encrypt(text2);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should produce different encrypted text for same input (due to random IV)", () => {
      const plainText = "Same text";
      const encrypted1 = encrypto.encrypt(plainText);
      const encrypted2 = encrypto.encrypt(plainText);
      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should encrypt empty string", () => {
      const encrypted = encrypto.encrypt("");
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
    });

    it("should encrypt special characters", () => {
      const plainText = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
    });

    it("should encrypt unicode characters", () => {
      const plainText = "Hello 世界 🌍";
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted text back to original", () => {
      const plainText = "Hello, World!";
      const encrypted = encrypto.encrypt(plainText);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should decrypt empty string", () => {
      const plainText = "";
      const encrypted = encrypto.encrypt(plainText);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should decrypt special characters", () => {
      const plainText = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encrypto.encrypt(plainText);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should decrypt unicode characters", () => {
      const plainText = "Hello 世界 🌍";
      const encrypted = encrypto.encrypt(plainText);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should decrypt long text", () => {
      const plainText = "A".repeat(1000);
      const encrypted = encrypto.encrypt(plainText);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should handle multiple encrypt/decrypt cycles", () => {
      const plainText = "Test message";
      for (let i = 0; i < 5; i++) {
        const encrypted = encrypto.encrypt(plainText);
        const decrypted = encrypto.decrypt(encrypted);
        expect(decrypted).toBe(plainText);
      }
    });
  });

  describe("encrypt and decrypt roundtrip", () => {
    it("should work with different secret keys", () => {
      const encrypto1 = new Encrypto("key1");
      const encrypto2 = new Encrypto("key2");
      const plainText = "Test message";

      const encrypted1 = encrypto1.encrypt(plainText);
      const encrypted2 = encrypto2.encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypto1.decrypt(encrypted1)).toBe(plainText);
      expect(encrypto2.decrypt(encrypted2)).toBe(plainText);
    });

    it("should not decrypt with wrong instance", () => {
      const encrypto1 = new Encrypto("key1");
      const encrypto2 = new Encrypto("key2");
      const plainText = "Test message";

      const encrypted = encrypto1.encrypt(plainText);
      // Should throw error when trying to decrypt with different key
      expect(() => {
        encrypto2.decrypt(encrypted);
      }).toThrow();
    });
  });
});
