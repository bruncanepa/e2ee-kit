const { crypto } = globalThis;

export class EncryptionService {
  private aesKeyLengthInBytes = 32;
  private saltLength = 16;
  private encryptionAlgorithm = "AES-GCM";

  private createRandomValue = (len: number): Uint8Array =>
    crypto.getRandomValues(new Uint8Array(len));

  private createSymmetricKeyBytes = (): Uint8Array =>
    this.createRandomValue(this.aesKeyLengthInBytes);

  createRandomSalt = () => this.createRandomValue(this.saltLength);

  importSymmetricKey = (key: Uint8Array): Promise<CryptoKey> =>
    crypto.subtle.importKey("raw", key, this.encryptionAlgorithm, true, [
      "decrypt",
      "encrypt",
    ]);

  createEncryptionKey = async () => {
    const keyObj = await this.importSymmetricKey(
      this.createSymmetricKeyBytes()
    );
    const keyExported = await crypto.subtle.exportKey("raw", keyObj);
    return { keyObj, key: new Uint8Array(keyExported) };
  };
}
