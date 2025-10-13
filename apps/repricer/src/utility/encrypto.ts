import crypto from "crypto";

class Encrypto {
  private readonly algorithm: string;
  private readonly key: Buffer;
  constructor(secretKey: string) {
    // Ensure the key is 32 bytes for AES-256
    this.key = crypto.createHash("sha256").update(secretKey).digest();
    this.algorithm = "aes-256-cbc";
  }

  encrypt(plainText: string) {
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plainText, "utf8", "base64");
    encrypted += cipher.final("base64");
    return iv.toString("base64") + ":" + encrypted;
  }

  decrypt(encryptedText: any) {
    const [ivBase64, encryptedData] = encryptedText.split(":");
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

export default Encrypto;
