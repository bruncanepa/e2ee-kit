import {
  base64StringToUint8Array,
  uint8ArrayToBase64String,
  mergeUint8Arrays,
  stringToUint8Array,
  uint8ArrayToString,
} from "./encoding.utils";
import { tryCatch } from "./error";

const { crypto } = globalThis;

export class Crypto {
  private static aesIVLength = 12;
  private static aesKeyLength = 32;
  private static encryptionAlgorithm = "AES-GCM";

  private static importSymmetricKey = tryCatch(
    "crypto.importSymmetricKey",
    (key: string): Promise<CryptoKey> =>
      crypto.subtle.importKey(
        "raw",
        base64StringToUint8Array(key),
        this.encryptionAlgorithm,
        true,
        ["decrypt", "encrypt"]
      )
  );

  private static createRandomValue = (len: number): Uint8Array => {
    const buf = new Uint8Array(len);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      return crypto.getRandomValues(buf);
    } else {
      const nodeCrypto = require("crypto");
      if (nodeCrypto) {
        const bytes = nodeCrypto.randomBytes(buf.length);
        buf.set(bytes);
      } else {
        throw new Error("No secure random number generator available.");
      }
    }
    return buf;
  };

  static generateSymmetricKey = (): string =>
    uint8ArrayToBase64String(this.createRandomValue(this.aesKeyLength));

  static encrypt = tryCatch(
    "crypto.encrypt",
    async (key: string, data: string): Promise<string> => {
      const iv = this.createRandomValue(this.aesIVLength);
      const keyObj = await this.importSymmetricKey(key);
      const dataBuf = stringToUint8Array(data);
      const encryptedData = await crypto.subtle.encrypt(
        { name: this.encryptionAlgorithm, iv },
        keyObj,
        dataBuf
      );
      return uint8ArrayToBase64String(
        mergeUint8Arrays(iv, new Uint8Array(encryptedData))
      );
    }
  );

  static decrypt = tryCatch(
    "crypto.decrypt",
    async (key: string, encryptedData: string): Promise<string> => {
      const encryptedBuffer = base64StringToUint8Array(encryptedData);
      const iv = encryptedBuffer.slice(0, this.aesIVLength);
      const cipher = encryptedBuffer.slice(
        this.aesIVLength,
        encryptedBuffer.length
      );
      const keyObj = await this.importSymmetricKey(key);
      const decryptedData = await crypto.subtle.decrypt(
        { name: this.encryptionAlgorithm, iv },
        keyObj,
        cipher
      );
      return uint8ArrayToString(new Uint8Array(decryptedData));
    }
  );

  static digest = tryCatch("crypto.digest", async (message: string) => {
    if (!message) return "";
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return uint8ArrayToBase64String(new Uint8Array(hashBuffer));
  });
}
