import "./mocks";
import { describe, expect, test, beforeEach } from "@jest/globals";
import { OpenE2EE } from "../open-e2ee";
import { PGPService } from "../pgp";
import { isStringAHex } from "../encoding.utils";

const privateKeyBegin = "-----BEGIN PGP PRIVATE KEY BLOCK-----";
const privateKeyEnd = "-----END PGP PRIVATE KEY BLOCK-----";
const publicKeyBegin = "-----BEGIN PGP PUBLIC KEY BLOCK-----";
const publicKeyEnd = "-----END PGP PUBLIC KEY BLOCK-----";
const encryptedBegin = "-----BEGIN PGP MESSAGE-----";
const encryptedEnd = "-----END PGP MESSAGE-----";

describe("open-e2ee module", () => {
  const userID = "2997e638-b01b-446f-be33-df9ec8b4f206";
  const passphrase = "passphrase-long-super-long";
  const pgpService = new PGPService();
  let etoeeSvc = new OpenE2EE(userID, passphrase);
  beforeEach(async () => {
    etoeeSvc = await new OpenE2EE(userID, passphrase).build();
  });

  test("build()", async () => {
    const { privateKey, publicKey } = await etoeeSvc.exportMasterKeys();

    await pgpService.decryptPrivateKey(privateKey, passphrase);
    await pgpService.readPublicKey(publicKey);

    expect(privateKey).toContain(privateKeyBegin);
    expect(privateKey).toContain(privateKeyEnd);
    expect(publicKey).toContain(publicKeyBegin);
    expect(publicKey).toContain(publicKeyEnd);
  });

  test("load()", async () => {
    let { privateKey, publicKey } = await etoeeSvc.exportMasterKeys();

    const otherSvc = await new OpenE2EE(userID, passphrase).load(
      privateKey,
      publicKey
    );
    const { privateKey: otherPrivateKey, publicKey: otherPublicKey } =
      await otherSvc.exportMasterKeys();

    await pgpService.decryptPrivateKey(otherPrivateKey, passphrase);
    await pgpService.readPublicKey(otherPublicKey);

    expect(privateKey).toEqual(otherPrivateKey);
    expect(publicKey).toEqual(otherPublicKey);
  });

  test("load(): error invalid private key", async () => {
    let { publicKey } = await etoeeSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(
        privateKeyBegin + "\ninvalid private key\n" + privateKeyEnd,
        publicKey
      )
    ).rejects.toThrow("readPrivateKey");
  });

  test("load(): error invalid private key because encrypted with another passphrase", async () => {
    const otherSvc = await new OpenE2EE(userID, "other passphrase").build();
    let { publicKey } = await etoeeSvc.exportMasterKeys();
    let { privateKey: otherPrivateKey } = await otherSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(otherPrivateKey, publicKey)
    ).rejects.toThrow("decryptPrivateKey");
  });

  test("load(): error invalid public key", async () => {
    let { privateKey } = await etoeeSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(
        privateKey,
        publicKeyBegin + "\ninvalid private key\n" + publicKeyEnd
      )
    ).rejects.toThrow("readPublicKey");
  });

  test("encrypt()", async () => {
    const data = "data to encrypt";

    const { encryptedKey, encryptedValue } = await etoeeSvc.encrypt(data);

    expect(encryptedKey).toContain(encryptedBegin);
    expect(encryptedKey).toContain(encryptedEnd);
    expect(encryptedValue).toContain(encryptedBegin);
    expect(encryptedValue).toContain(encryptedEnd);
  });

  test("decrypt()", async () => {
    const data = "data to encrypt";

    const { encryptedKey, encryptedValue } = await etoeeSvc.encrypt(data);
    const { key, value } = await etoeeSvc.decrypt(encryptedKey, encryptedValue);

    expect(data).toEqual(value);
    expect(isStringAHex(key)).toBeTruthy();
  });

  test("decrypt(): error for not encrypted key", async () => {
    const data = "data to encrypt";

    const { encryptedValue } = await etoeeSvc.encrypt(data);

    await expect(
      etoeeSvc.decrypt("not encrypted key", encryptedValue)
    ).rejects.toThrow("decrypt");
  });

  test("decrypt(): error for not encrypted value", async () => {
    const data = "data to encrypt";

    const { encryptedKey } = await etoeeSvc.encrypt(data);

    await expect(
      etoeeSvc.decrypt(encryptedKey, "not encrypted value")
    ).rejects.toThrow("decrypt");
  });

  test("decrypt(): error for value encrypted with another key", async () => {
    const data = "data to encrypt";

    const { encryptedKey } = await etoeeSvc.encrypt(data);
    const { encryptedValue } = await etoeeSvc.encrypt(data);

    await expect(
      etoeeSvc.decrypt(encryptedKey, encryptedValue)
    ).rejects.toThrow("decrypt");
  });

  test("share()", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey } = await etoeeSvc.exportMasterKeys();
    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const {
      receiverEncryptedKey,
      senderEncryptedKey,
      encryptedValue,
      senderPublicKey,
    } = await etoeeSvc.share(receiverPublicKey, data);

    const { value } = await etoeeSvc.decrypt(
      senderEncryptedKey,
      encryptedValue
    );

    expect(receiverEncryptedKey).toContain(encryptedBegin);
    expect(receiverEncryptedKey).toContain(encryptedEnd);
    expect(senderEncryptedKey).toContain(encryptedBegin);
    expect(senderEncryptedKey).toContain(encryptedEnd);
    expect(encryptedValue).toContain(encryptedBegin);
    expect(encryptedValue).toContain(encryptedEnd);
    expect(publicKey).toEqual(senderPublicKey);
    expect(value).toEqual(data);
  });

  test("share(): error invalid receiver public key", async () => {
    const data = "data to encrypt";

    await expect(
      etoeeSvc.share(
        publicKeyBegin + "invalid receiver public key" + publicKeyEnd,
        data
      )
    ).rejects.toThrow("readPublicKey");
  });

  test("receive()", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { receiverEncryptedKey, encryptedValue, senderPublicKey } =
      await etoeeSvc.share(receiverPublicKey, data);

    const { key, value } = await receiverSvc.receive(
      senderPublicKey,
      receiverEncryptedKey,
      encryptedValue
    );

    expect(value).toEqual(data);
    expect(isStringAHex(key)).toBeTruthy();
  });

  test("receive(): error invalid sender public key", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { receiverEncryptedKey, encryptedValue, senderPublicKey } =
      await etoeeSvc.share(receiverPublicKey, data);

    await expect(
      receiverSvc.receive(
        "invalid sender public key",
        receiverEncryptedKey,
        encryptedValue
      )
    ).rejects.toThrow("readPublicKey");
  });

  test("receive(): error invalid receiver encrypted key", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { receiverEncryptedKey, encryptedValue, senderPublicKey } =
      await etoeeSvc.share(receiverPublicKey, data);

    await expect(
      receiverSvc.receive(
        senderPublicKey,
        "invalid receiver encrypted key",
        encryptedValue
      )
    ).rejects.toThrow("decryptAsymmetric");
  });
});
