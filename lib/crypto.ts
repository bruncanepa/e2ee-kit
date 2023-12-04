import { compress, decompress } from "./compression";
import {
  base64StringToUint8Array,
  uint8ArrayToBase64String,
  mergeUint8Arrays,
  stringToUint8Array,
  uint8ArrayToString,
} from "./encoding.utils";
import { tryCatch } from "./error";

const { crypto } = globalThis;

export class CryptoService {
  private aesIVLength = 12;
  private aesKeyLength = 32;
  private encryptionAlgorithm = "AES-GCM";

  private importSymmetricKey = tryCatch(
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

  /**
   * Retrieve secure random byte array of the specified length
   * @param {Integer} len length in bytes to generate
   * @returns {Uint8Array} random byte array.
   */
  private createRandomValue = (len: number): Uint8Array => {
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

  generateSymmetricKey = (): string =>
    uint8ArrayToBase64String(this.createRandomValue(this.aesKeyLength));

  encrypt = tryCatch(
    "crypto.encrypt",
    async (
      key: string,
      data: string,
      config: EncryptConfig = { compression: false }
    ): Promise<string> => {
      const iv = this.createRandomValue(this.aesIVLength);
      const keyObj = await this.importSymmetricKey(key);

      const dataBuf = config.compression
        ? compress(data)
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

  decrypt = tryCatch(
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

  encryptFile = (key: string, data: string) =>
    this.encrypt(key, data, { compression: true });

  decryptFile = (key: string, data: string) =>
    this.decrypt(key, data, { compression: true });

  /**
   * Hash with sha256 a message
   * @param message data to hash
   * @returns sha256 hash base64 encoded
   */
  sha256 = async (message: string) => {
    if (!message) {
      return "";
    }
    const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
    const hashBase64 = uint8ArrayToBase64String(new Uint8Array(hashBuffer)); // convert buffer to base64
    return hashBase64;
  };
}

interface EncryptConfig {
  compression: boolean;
}
