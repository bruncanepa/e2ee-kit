import { compress, compressString, decompress } from "./compression";
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
    async (
      key: string,
      data: string,
      config: EncryptConfig = { compression: false }
    ): Promise<string> => {
      const iv = this.createRandomValue(this.aesIVLength);
      const keyObj = await this.importSymmetricKey(key);

      const dataBuf = config.compression
        ? compressString(data)
        : stringToUint8Array(data);

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
    async (
      key: string,
      encryptedData: string,
      config: EncryptConfig = { compression: false }
    ): Promise<string> => {
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
      let decryptedBuffer = new Uint8Array(decryptedData);
      if (config.compression) decryptedBuffer = decompress(decryptedBuffer);
      return uint8ArrayToString(decryptedBuffer);
    }
  );

  static encryptFile = tryCatch(
    "crypto.encryptFile",
    async (key: string, data: Uint8Array): Promise<Uint8Array> => {
      const iv = this.createRandomValue(this.aesIVLength);
      const keyObj = await this.importSymmetricKey(key);

      const dataBuf = compress(data);

      const encryptedData = await crypto.subtle.encrypt(
        { name: this.encryptionAlgorithm, iv },
        keyObj,
        dataBuf
      );
      return mergeUint8Arrays(iv, new Uint8Array(encryptedData));
    }
  );

  static decryptFile = tryCatch(
    "crypto.decryptFile",
    async (key: string, encryptedData: string): Promise<Uint8Array> => {
      const encryptedBuffer = stringToUint8Array(encryptedData);
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
      return decompress(new Uint8Array(decryptedData));
    }
  );

  static digest = tryCatch("crypto.digest", async (message: string) => {
    if (!message) {
      return "";
    }
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    return uint8ArrayToBase64String(new Uint8Array(hashBuffer));
  });
}

interface EncryptConfig {
  compression: boolean;
}
