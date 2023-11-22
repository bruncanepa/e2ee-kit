import { PGPPrivateKey, PGPPublicKey, PGPService } from "./pgp";

export interface E2EEItemEncrypted {
  encryptedKey: string;
  encryptedValue: string;
  key: string;
}

export interface E2EEItem {
  key: string;
  value: string;
}

export class OpenE2EE {
  private pgpService: PGPService;

  private passphrase: string;
  private privateKey?: PGPPrivateKey;
  private privateKeyEncryptedText: string = "";
  private publicKeyText: string = "";
  private publicKey?: PGPPublicKey;
  private userId: string;

  /**
   * @param userId user id in your platform
   * @param passphrase master password to encrypt PGP private key
   */
  constructor(userId: string, passphrase: string) {
    this.pgpService = new PGPService();
    this.userId = userId;
    this.passphrase = passphrase;
  }

  /**
   * Loads data with a new PGP pair.
   * @example const e2eeSvc = await new E2EEService().build(passphrase);
   */
  build = async (): Promise<OpenE2EE> => {
    const { privateKey, publicKey } = await this.pgpService.generateKeyPair(
      this.passphrase,
      this.userId
    );
    const keysObj = await Promise.all([
      this.pgpService.decryptPrivateKey(privateKey, this.passphrase),
      this.pgpService.readPublicKey(publicKey),
    ]);
    this.privateKey = keysObj[0];
    this.publicKey = keysObj[1];
    this.privateKeyEncryptedText = privateKey;
    this.publicKeyText = publicKey;
    return this;
  };

  /**
   * Loads data with an existant PGP key pair.
   * @example const e2eeSvc = await new E2EEService().load(passphrase, privateKey, publicKey);
   * @param encryptedPrivateKey encrypted PGP private key
   * @param publicKey PGP public key
   * */
  load = async (
    encryptedPrivateKey: string,
    publicKey: string
  ): Promise<OpenE2EE> => {
    const [privateKeyObj, publicKeyObj] = await Promise.all([
      this.pgpService.decryptPrivateKey(encryptedPrivateKey, this.passphrase),
      this.pgpService.readPublicKey(publicKey),
    ]);
    this.privateKey = privateKeyObj;
    this.publicKey = publicKeyObj;
    this.privateKeyEncryptedText = encryptedPrivateKey;
    this.publicKeyText = publicKey;
    return this;
  };

  /**
   * Exports master key encrypted with a derived key from passphrase to save it in database.
   * @returns privateKey: encrypted PGP private key, publicKey: PGP public key
   */
  exportMasterKeys = async () => {
    return {
      privateKey: this.privateKeyEncryptedText,
      publicKey: this.publicKeyText,
    };
  };

  /**
   * Encrypts an item with a new key, and encrypts it with PGP.
   * @param data value to encrypt
   * @returns encrypted item with its encrypted key (as value and CryptoKey).
   */
  encrypt = async (data: string): Promise<E2EEItemEncrypted> => {
    const key = await this.pgpService.generateEncryptionKey(
      this.publicKey as PGPPublicKey
    );
    const [encryptedKey, encryptedValue] = await Promise.all([
      this.pgpService.encryptAsymmetric(
        this.privateKey as PGPPrivateKey,
        this.publicKey as PGPPublicKey,
        key
      ),
      this.pgpService.encrypt(key, data),
    ]);
    return { encryptedKey, encryptedValue, key };
  };

  /**
   * Decrypts the key using PGP and the item with the decrypted key.
   * @param encryptedKey  encrypted key
   * @param encryptedData encrypted value
   * @returns both values and key decrypted
   */
  decrypt = async (
    encryptedKey: string,
    encryptedData: string
  ): Promise<E2EEItem> => {
    const key = await this.pgpService.decryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      this.publicKey as PGPPublicKey,
      encryptedKey
    );
    const value = await this.pgpService.decrypt(key, encryptedData);
    return { key, value };
  };

  share = async (receiverPublicKey: string, data: string) => {
    const [{ encryptedKey, key, encryptedValue }, receiverPublicKeyObj] =
      await Promise.all([
        this.encrypt(data),
        this.pgpService.readPublicKey(receiverPublicKey),
      ]);
    const receiverEncryptedKey = await this.pgpService.encryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      receiverPublicKeyObj,
      key
    );
    return {
      senderPublicKey: this.publicKeyText,
      senderEncryptedKey: encryptedKey,
      encryptedValue,
      receiverEncryptedKey,
    };
  };

  receive = async (
    senderPublicKey: string,
    receiverEncryptedKey: string,
    encryptedValue: string
  ) => {
    const senderPublicKeyObj = await this.pgpService.readPublicKey(
      senderPublicKey
    );
    const key = await this.pgpService.decryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      senderPublicKeyObj,
      receiverEncryptedKey
    );
    const value = await this.pgpService.decrypt(key, encryptedValue);
    return { key, value };
  };
}
