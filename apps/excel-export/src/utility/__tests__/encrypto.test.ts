import Encrypto from "../encrypto";

const KEY = "test-secret-key-32-bytes-long!!!!!!!!";

describe("Encrypto", () => {
  let encrypto: Encrypto;

  beforeEach(() => {
    encrypto = new Encrypto(KEY);
  });

  describe("encrypt and decrypt", () => {
    it("should encrypt and decrypt text correctly", () => {
      const plainText = "hello world";
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).toContain(":");
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should generate different IVs for same plaintext", () => {
      const plainText = "same text";
      const enc1 = encrypto.encrypt(plainText);
      const enc2 = encrypto.encrypt(plainText);
      expect(enc1).not.toBe(enc2);
      expect(encrypto.decrypt(enc1)).toBe(plainText);
      expect(encrypto.decrypt(enc2)).toBe(plainText);
    });

    it("should handle empty strings", () => {
      const encrypted = encrypto.encrypt("");
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle special characters in plaintext", () => {
      const plainText = "!@#$%^&*() 中文 ñ ü";
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it("should handle long plaintext", () => {
      const plainText = "a".repeat(10000);
      const encrypted = encrypto.encrypt(plainText);
      expect(encrypted).toBeDefined();
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });
  });

  describe("decrypt errors", () => {
    it("should throw error for invalid encrypted format (no colon)", () => {
      expect(() => encrypto.decrypt("notvalidbase64")).toThrow();
    });

    it("should throw error for malformed IV (invalid base64)", () => {
      expect(() => encrypto.decrypt("!!!:cipher")).toThrow();
    });

    it("should throw error for malformed cipher part", () => {
      const validIv = Buffer.alloc(16).fill(0).toString("base64");
      expect(() => encrypto.decrypt(`${validIv}:!!!`)).toThrow();
    });

    it("should fail decryption with wrong key", () => {
      const plainText = "secret";
      const encrypted = encrypto.encrypt(plainText);
      const otherEncrypto = new Encrypto("different-key-32-bytes-long!!!!!!!");
      expect(() => otherEncrypto.decrypt(encrypted)).toThrow();
    });

    it("should throw when encryptedText has only one segment (no colon)", () => {
      expect(() => encrypto.decrypt("singleSegment")).toThrow();
    });
  });
});
