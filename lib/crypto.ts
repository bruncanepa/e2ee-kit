import {
  arrayToHexString,
  hexStringToArray,
  mergeUint8Arrays,
  stringToUint8Array,
  uint8ArrayToString,
} from "./encoding.utils";
import { tryCatch } from "./error";

const { crypto } = globalThis;

export class CryptoService {
  private aesIVLength = 12;
  private encryptionAlgorithm = "AES-GCM";

  private importSymmetricKey = tryCatch(
    "crypto.importSymmetricKey",
    (key: string): Promise<CryptoKey> =>
      crypto.subtle.importKey(
        "raw",
        hexStringToArray(key),
        this.encryptionAlgorithm,
        true,
        ["decrypt", "encrypt"]
      )
  );

  private createRandomValue = (len: number): Uint8Array =>
    crypto.getRandomValues(new Uint8Array(len));

  encrypt = tryCatch(
    "crypto.encrypt",
    async (key: string, data: string): Promise<string> => {
      const iv = this.createRandomValue(this.aesIVLength);
      const keyObj = await this.importSymmetricKey(key);
      const encryptedData = await crypto.subtle.encrypt(
        { name: this.encryptionAlgorithm, iv },
        keyObj,
        stringToUint8Array(data)
      );
      return arrayToHexString(
        mergeUint8Arrays(iv, new Uint8Array(encryptedData))
      );
    }
  );

  decrypt = tryCatch(
    "crypto.decrypt",
    async (key: string, encryptedData: string): Promise<string> => {
      const encryptedBuffer = hexStringToArray(encryptedData);
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
}
