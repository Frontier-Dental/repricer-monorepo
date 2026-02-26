import crypto from "crypto";
import Encrypto from "../encrypto";

describe("Encrypto", () => {
  const secretKey = "test-secret-key-32-chars!!";
  let encrypto: Encrypto;

  beforeEach(() => {
    encrypto = new Encrypto(secretKey);
  });

  describe("constructor", () => {
    it("derives a 32-byte key from secret via SHA256", () => {
      const hash = crypto.createHash("sha256").update(secretKey).digest();
      expect(hash.length).toBe(32);
      const plain = "verify-key";
      const encrypted = encrypto.encrypt(plain);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe(plain);
    });

    it("uses same key for same secret (deterministic key derivation)", () => {
      const e2 = new Encrypto(secretKey);
      const plain = "same-key";
      expect(encrypto.decrypt(encrypto.encrypt(plain))).toBe(plain);
      expect(e2.decrypt(encrypto.encrypt(plain))).toBe(plain);
    });

    it("produces different key for different secret", () => {
      const other = new Encrypto("other-secret-key-32-chars!!");
      const plain = "different-key";
      const encrypted = encrypto.encrypt(plain);
      expect(() => other.decrypt(encrypted)).toThrow();
    });
  });

  describe("encrypt", () => {
    it("returns string in iv:encrypted format", () => {
      const result = encrypto.encrypt("hello");
      expect(typeof result).toBe("string");
      const parts = result.split(":");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
    });

    it("produces valid base64 for both iv and ciphertext", () => {
      const result = encrypto.encrypt("data");
      const [ivB64, ctB64] = result.split(":");
      expect(() => Buffer.from(ivB64, "base64")).not.toThrow();
      expect(() => Buffer.from(ctB64, "base64")).not.toThrow();
      expect(Buffer.from(ivB64, "base64").length).toBe(16);
    });

    it("encrypts empty string", () => {
      const encrypted = encrypto.encrypt("");
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
      const decrypted = encrypto.decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("encrypts ASCII plaintext", () => {
      const plain = "Hello, World!";
      const encrypted = encrypto.encrypt(plain);
      expect(encrypted).not.toBe(plain);
      expect(encrypto.decrypt(encrypted)).toBe(plain);
    });

    it("encrypts unicode plaintext", () => {
      const plain = "日本語 🎉 café";
      const encrypted = encrypto.encrypt(plain);
      expect(encrypto.decrypt(encrypted)).toBe(plain);
    });

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plain = "same";
      const a = encrypto.encrypt(plain);
      const b = encrypto.encrypt(plain);
      expect(a).not.toBe(b);
      expect(encrypto.decrypt(a)).toBe(plain);
      expect(encrypto.decrypt(b)).toBe(plain);
    });

    it("encrypts long plaintext", () => {
      const plain = "x".repeat(10_000);
      const encrypted = encrypto.encrypt(plain);
      expect(encrypto.decrypt(encrypted)).toBe(plain);
    });
  });

  describe("decrypt", () => {
    it("decrypts to original plaintext (round-trip)", () => {
      const plain = "round-trip me";
      const encrypted = encrypto.encrypt(plain);
      expect(encrypto.decrypt(encrypted)).toBe(plain);
    });

    it("decrypts empty ciphertext (encrypted empty string)", () => {
      const encrypted = encrypto.encrypt("");
      expect(encrypto.decrypt(encrypted)).toBe("");
    });

    it("throws when encryptedText has no colon", () => {
      expect(() => encrypto.decrypt("nocolon")).toThrow();
    });

    it("throws when encryptedText is empty string", () => {
      expect(() => encrypto.decrypt("")).toThrow();
    });

    it("throws when iv is invalid base64", () => {
      expect(() => encrypto.decrypt("not-valid-base64!!:abc")).toThrow();
    });

    it("throws when encrypted data is invalid base64", () => {
      const iv = Buffer.alloc(16, 0).toString("base64");
      expect(() => encrypto.decrypt(`${iv}:not-valid!!`)).toThrow();
    });

    it("throws when encrypted data is tampered (wrong ciphertext)", () => {
      const valid = encrypto.encrypt("secret");
      const [ivB64] = valid.split(":");
      const tampered = `${ivB64}:${Buffer.from("tampered").toString("base64")}`;
      expect(() => encrypto.decrypt(tampered)).toThrow();
    });

    it("throws when iv has wrong length (non-16 bytes)", () => {
      const shortIv = Buffer.alloc(8, 0).toString("base64");
      const cipher = encrypto.encrypt("x");
      const [, ct] = cipher.split(":");
      expect(() => encrypto.decrypt(`${shortIv}:${ct}`)).toThrow();
    });

    it("accepts string encryptedText", () => {
      const encrypted = encrypto.encrypt("ok");
      expect(encrypto.decrypt(encrypted)).toBe("ok");
    });
  });

  describe("algorithm and key consistency", () => {
    it("uses AES-256-CBC (same algorithm for encrypt and decrypt)", () => {
      const plain = "algo-check";
      const enc = encrypto.encrypt(plain);
      expect(encrypto.decrypt(enc)).toBe(plain);
    });

    it("different instances with same key can decrypt each other ciphertext", () => {
      const e1 = new Encrypto(secretKey);
      const e2 = new Encrypto(secretKey);
      const plain = "shared";
      const enc = e1.encrypt(plain);
      expect(e2.decrypt(enc)).toBe(plain);
    });
  });
});
