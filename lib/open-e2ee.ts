import { CryptoService } from "./crypto";
import {
  writeEncryptedItem,
  readEncryptedItem,
  ShareItemOut,
  ShareNewItemOut,
  ReceiveItemOut,
  DecryptItemOut,
  EncryptItemOut,
  pgpMessageEnd,
} from "./models";
import { PGPPrivateKey, PGPPublicKey, PGPService } from "./pgp";
import { FileEncryption } from "./file/fileChunkreader";

export class OpenE2EE {
  private pgpService: PGPService;
  private cryptoService: CryptoService;

  private passphrase: string;
  private privateKey?: PGPPrivateKey;
  private privateKeyEncryptedText: string = "";
  private publicKey?: PGPPublicKey;
  private publicKeyText: string = "";
  private userId: string;

  /**
   * @param userId user id in your platform
   * @param passphrase master password to encrypt PGP private key
   */
  constructor(userId: string, passphrase: string) {
    this.pgpService = new PGPService();
    this.cryptoService = new CryptoService();
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
   * @returns encrypted message with key and data.
   */
  encrypt = async (
    data: string,
    sign: boolean = true
  ): Promise<EncryptItemOut> => {
    const shareKey = await this.pgpService.generateShareKey(
      this.publicKey as PGPPublicKey
    );
    const [encryptedShareKey, encryptedData] = await Promise.all([
      this.pgpService.encryptAsymmetric(
        sign ? this.privateKey : undefined,
        [this.publicKey as PGPPublicKey],
        shareKey
      ),
      this.cryptoService.encrypt(shareKey, data),
    ]);
    return {
      shareKey,
      encryptedMessage: writeEncryptedItem(encryptedShareKey, encryptedData),
    };
  };

  /**
   * Decrypts the key using PGP and the item with the decrypted key.
   * @param encryptedMessage  encrypted message that contains both key and data
   * @returns both key and data decrypted
   */
  decrypt = async (
    encryptedMessage: string,
    externalEncryptionKeys: string[] = []
  ): Promise<DecryptItemOut> => {
    const { encryptedShareKey, encryptedData } =
      readEncryptedItem(encryptedMessage);
    const externalEncryptionKeysObj = await Promise.all(
      externalEncryptionKeys.map((e) => this.pgpService.readPublicKey(e))
    );
    const shareKey = await this.pgpService.decryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      [this.publicKey as PGPPublicKey, ...externalEncryptionKeysObj],
      encryptedShareKey
    );
    const data = await this.cryptoService.decrypt(shareKey, encryptedData);
    return { shareKey, data };
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
    const { encryptedShareKey, encryptedData } =
      readEncryptedItem(encryptedItem);

    const [receiverPublicKeyObj, shareKey] = await Promise.all([
      this.pgpService.readPublicKey(receiverPublicKey),
      this.pgpService.decryptAsymmetric(
        this.privateKey as PGPPrivateKey,
        [this.publicKey as PGPPublicKey],
        encryptedShareKey
      ),
    ]);

    const receiverEncryptedKey = await this.pgpService.encryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      [this.publicKey as PGPPublicKey, receiverPublicKeyObj],
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
    const receiverPublicKeyObj = await this.pgpService.readPublicKey(
      receiverPublicKey
    );
    const { shareKey, encryptedMessage } = await this.encrypt(data);
    const receiverEncryptedKey = await this.pgpService.encryptAsymmetric(
      this.privateKey as PGPPrivateKey,
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
   * @param encryptedMessage
   * @returns decrypted key and data
   */
  receive = async (
    senderPublicKey: string,
    encryptedMessage: string
  ): Promise<ReceiveItemOut> =>
    await this.decrypt(encryptedMessage, [senderPublicKey]);

  encryptFileOnOneGo = async (file: File) => {
    const key = await this.pgpService.generateShareKey(
      this.publicKey as PGPPublicKey
    );

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result as string;
      const encrypted = await this.cryptoService.encryptFile(key, data);
      const anchor = document.createElement("a");
      anchor.href = "data:application/octet-stream," + btoa(encrypted);
      anchor.download = file.name + ".enc";
      anchor.click();
    };
    reader.readAsDataURL(file);

    const encryptedKey = await this.pgpService.encryptAsymmetric(
      this.privateKey,
      [this.publicKey as PGPPublicKey],
      key
    );

    return { encryptedKey };
  };

  decryptFileOnOneGo = async (encryptedKey: string, encryptedFile: File) => {
    const key = await this.pgpService.decryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      [this.publicKey as PGPPublicKey],
      encryptedKey
    );

    const reader = new FileReader();

    reader.onload = async (e) => {
      const file = e.target?.result as string;
      const decoded = atob(file);
      const decrypted = await this.cryptoService.decryptFile(key, decoded);
      const anchor = document.createElement("a");
      anchor.href = decrypted;
      anchor.download = "dec." + encryptedFile.name.replace(".enc", "");
      anchor.click();
    };

    reader.readAsText(encryptedFile);

    return {};
  };

  private encryptedChunkSeparator = "CHUNK_END";
  encryptFile = async (file: File) => {
    const key = await this.pgpService.generateShareKey(
      this.publicKey as PGPPublicKey
    );
    const encryptedKey = await this.pgpService.encryptAsymmetric(
      this.privateKey,
      [this.publicKey as PGPPublicKey],
      key
    );

    const encryptedChunks: string[] = [];

    const fileEncryptor = new FileEncryption(file);
    await fileEncryptor.readInChunks("data-url", async (chunk: string) => {
      const encChunk = await this.cryptoService.encryptFile(key, chunk);
      encryptedChunks.push(encChunk);
    });
    await fileEncryptor.saveEncryptedChunkedFile(
      file.name + ".enc",
      encryptedChunks,
      this.encryptedChunkSeparator
    );

    return { encryptedKey };
  };

  decryptFile = async (encryptedKey: string, encryptedFile: File) => {
    const key = await this.pgpService.decryptAsymmetric(
      this.privateKey as PGPPrivateKey,
      [this.publicKey as PGPPublicKey],
      encryptedKey
    );

    const decryptedChunks: string[] = [];

    const fileEncryptor = new FileEncryption(encryptedFile);
    await fileEncryptor.readEncryptedInChunks(
      "text",
      this.encryptedChunkSeparator,
      async (encChunk: string) => {
        const chunk = await this.cryptoService.decryptFile(key, encChunk);
        decryptedChunks.push(chunk);
      }
    );
    await fileEncryptor.saveChunkedFile(
      "dec." + encryptedFile.name.replace(".enc", ""),
      decryptedChunks,
      ""
    );
  };
}
