import crypto from "crypto";

class Encrypto {
  private readonly algorithm: string;
  private readonly key: Buffer;
  constructor(secretKey: string) {
    this.key = crypto.createHash("sha256").update(secretKey).digest();
    this.algorithm = "aes-256-cbc";
  }

  decrypt(encryptedText: string) {
    const [ivBase64, encryptedData] = encryptedText.split(":");
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

export default Encrypto;
