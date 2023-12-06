import {
  writeEncryptedItem,
  readEncryptedItem,
  ShareItemOut,
  ShareNewItemOut,
  ReceiveItemOut,
  DecryptItemOut,
  EncryptItemOut,
} from "./models";
import { PGPPrivateKey, PGPPublicKey, PGP } from "./pgp";

export class OpenE2EE {
  private passphrase: string;
  private privateKey: PGPPrivateKey;
  private privateKeyEncryptedText: string = "";
  private publicKey: PGPPublicKey;
  private publicKeyText: string = "";
  private userId: string;
  private features: Feature[];

  /**
   * @param userId user id in your platform
   * @param passphrase master password to encrypt PGP private key
   * @param features features that wants to be used:
   *  - share: to encrypt data prepared to be shared in the future with another user.
   *    Note that if this is not enabled from start, to share you will need to re-encrypt the data.
   *  - files: to encrypt/decrypt files.
   */
  constructor(userId: string, passphrase: string, features: Feature[] = []) {
    this.userId = userId;
    this.passphrase = passphrase;
    this.features = features;
  }

  /**
   * Loads data with a new PGP pair.
   * @example const e2eeSvc = await new E2EEService().build(passphrase);
   */
  build = async (): Promise<OpenE2EE> => {
    const { privateKey, publicKey } = await PGP.generateKeyPair(
      this.passphrase,
      this.userId
    );
    const keysObj = await Promise.all([
      PGP.decryptPrivateKey(privateKey, this.passphrase),
      PGP.readPublicKey(publicKey),
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
      PGP.decryptPrivateKey(encryptedPrivateKey, this.passphrase),
      PGP.readPublicKey(publicKey),
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
   * @returns encrypted message with key and data.
   */
  encrypt = async (
    data: string,
    sign: boolean = true
  ): Promise<EncryptItemOut> => {
    if (this.getFeature("share")) {
      const { shareKey, encryptedShareKey } = await PGP.generateShareKey(
        this.publicKey
      );
      const encryptedData = await PGP.encrypt(
        sign ? this.privateKey : undefined,
        shareKey,
        data
      );
      return {
        shareKey,
        encryptedMessage: writeEncryptedItem(encryptedShareKey, encryptedData),
      };
    }
    const encryptedMessage = await PGP.encryptAsymmetric(
      sign ? this.privateKey : undefined,
      [this.publicKey],
      data
    );
    return { encryptedMessage, shareKey: "" };
  };

  /**
   * Decrypts the key using PGP and the item with the decrypted key.
   * @param encryptedMessage  encrypted message that contains both key and data
   * @param externalEncryptionKeys external PGP public keys to decrypt (verify) the share key (for sharing)
   * @returns both key and data decrypted
   */
  decrypt = async (
    encryptedMessage: string,
    externalEncryptionKeys: string[] = []
  ): Promise<DecryptItemOut> => {
    const verificationKeys = [
      this.publicKey,
      ...(await Promise.all(
        externalEncryptionKeys.map((e) => PGP.readPublicKey(e))
      )),
    ];
    if (this.getFeature("share")) {
      const { encryptedShareKey, encryptedData } =
        readEncryptedItem(encryptedMessage);
      const shareKey = await PGP.decryptShareKey(
        this.privateKey,
        encryptedShareKey
      );
      const data = await PGP.decrypt(shareKey, encryptedData, verificationKeys);
      return { shareKey, data };
    }
    const data = await PGP.decryptAsymmetric(
      this.privateKey,
      verificationKeys,
      encryptedMessage
    );
    return { data, shareKey: "" };
  };

  /**
   * Share encrypted data with another user, encrypting messages with receiver PGP public key and signed with sender PGP private key
   * @param receiverPublicKey receiver PGP public key
   * @param data data to encrypt and share
   * @returns senderPublicKey your publicKey to verify signature
   * and receiverEncryptedMessage with encrypted message with their PGP public key and signed
   */
  share = async (
    receiverPublicKey: string,
    encryptedItem: string
  ): Promise<ShareItemOut> => {
    this.needsFeatures("share");

    const { encryptedShareKey, encryptedData } =
      readEncryptedItem(encryptedItem);
    const [receiverPublicKeyObj, shareKey] = await Promise.all([
      PGP.readPublicKey(receiverPublicKey),
      PGP.decryptShareKey(this.privateKey, encryptedShareKey),
    ]);
    const receiverEncryptedKey = await PGP.encryptAsymmetric(
      this.privateKey,
      [this.publicKey, receiverPublicKeyObj],
      shareKey
    );
    return {
      senderPublicKey: this.publicKeyText,
      receiverEncryptedMessage: writeEncryptedItem(
        receiverEncryptedKey,
        encryptedData
      ),
    };
  };

  /**
   * Share not encrypted data with another user, encrypting messages with receiver PGP public key and signed with sender PGP private key
   * @param receiverPublicKey receiver PGP public key
   * @param data data to encrypt and share
   * @returns same as 'share()', and senderEncryptedMessage with the message encrypted with your PGP public key
   */
  shareNew = async (
    receiverPublicKey: string,
    data: string
  ): Promise<ShareNewItemOut> => {
    this.needsFeatures("share");

    const [receiverPublicKeyObj, { shareKey, encryptedMessage }] =
      await Promise.all([
        PGP.readPublicKey(receiverPublicKey),
        this.encrypt(data),
      ]);
    const receiverEncryptedKey = await PGP.encryptAsymmetric(
      this.privateKey,
      [receiverPublicKeyObj],
      shareKey
    );
    return {
      senderPublicKey: this.publicKeyText,
      senderEncryptedMessage: encryptedMessage,
      receiverEncryptedMessage: writeEncryptedItem(
        receiverEncryptedKey,
        readEncryptedItem(encryptedMessage).encryptedData
      ),
    };
  };

  /**
   * Receive an encrypted message with my PGP public key and signed with sender PGP private key
   * @param senderPublicKey sender's PGP public key to validate signature
   * @param encryptedItem the shared item encrypted
   * @returns decrypted key and data
   */
  receive = async (
    senderPublicKey: string,
    encryptedItem: string
  ): Promise<ReceiveItemOut> => {
    this.needsFeatures("share");

    const { encryptedShareKey, encryptedData } =
      readEncryptedItem(encryptedItem);
    const senderPublicKeyObj = await PGP.readPublicKey(senderPublicKey);
    const shareKey = await PGP.decryptAsymmetric(
      this.privateKey,
      [this.publicKey, senderPublicKeyObj],
      encryptedShareKey
    );
    const data = await PGP.decrypt(shareKey, encryptedData, [
      senderPublicKeyObj,
    ]);
    return { shareKey, data };
  };

  private needsFeatures = (neededFeatures: Feature[] | Feature) => {
    if (typeof neededFeatures === "string") {
      neededFeatures = [neededFeatures];
    }
    const achieved = neededFeatures.every((feature) =>
      this.features.find((ft) => ft === feature)
    );
    if (!achieved) {
      throw Error(`${neededFeatures.join(",")} features need to be enabled`);
    }
  };
  private getFeature = (feature: Feature) => this.features.includes(feature);
}

export type Feature = "share" | "files";
