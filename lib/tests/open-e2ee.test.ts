import "./mocks";
import { describe, expect, test, beforeEach } from "@jest/globals";
import { OpenE2EE } from "../open-e2ee";
import { PGPService } from "../pgp";
import { isStringHex } from "../encoding.utils";
import {
  isEncryptedMessageFormat,
  privateKeyBegin,
  privateKeyEnd,
  publicKeyBegin,
  publicKeyEnd,
  readEncryptedMessage,
  writeEncryptedMessage,
} from "../models";

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
    ).rejects.toThrow("pgp.readPrivateKey");
  });

  test("load(): error invalid private key because encrypted with another passphrase", async () => {
    const otherSvc = await new OpenE2EE(userID, "other passphrase").build();
    let { publicKey } = await etoeeSvc.exportMasterKeys();
    let { privateKey: otherPrivateKey } = await otherSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(otherPrivateKey, publicKey)
    ).rejects.toThrow("pgp.decryptPrivateKey");
  });

  test("load(): error invalid public key", async () => {
    let { privateKey } = await etoeeSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(
        privateKey,
        publicKeyBegin + "\ninvalid private key\n" + publicKeyEnd
      )
    ).rejects.toThrow("pgp.readPublicKey");
  });

  test("encrypt()", async () => {
    const data = "data to encrypt";

    const { key, encryptedMessage } = await etoeeSvc.encrypt(data);

    expect(encryptedMessage.includes(key)).toBeFalsy();
    expect(encryptedMessage.includes(data)).toBeFalsy();
    expect(isEncryptedMessageFormat(encryptedMessage)).toBeTruthy();
  });

  test("decrypt()", async () => {
    const data = "data to encrypt";

    const { key, encryptedMessage } = await etoeeSvc.encrypt(data);
    const { key: decryptedKey, data: decryptedData } = await etoeeSvc.decrypt(
      encryptedMessage
    );

    expect(data).toEqual(decryptedData);
    expect(key).toEqual(decryptedKey);
  });

  test("decrypt(): error for not encrypted key", async () => {
    const data = "data to encrypt";

    const { key, encryptedMessage } = await etoeeSvc.encrypt(data);

    await expect(
      etoeeSvc.decrypt(
        writeEncryptedMessage(
          key,
          readEncryptedMessage(encryptedMessage).encryptedData
        )
      )
    ).rejects.toThrow("pgp.decrypt");
  });

  test("decrypt(): error for not encrypted value", async () => {
    const data = "data to encrypt";

    const { encryptedMessage } = await etoeeSvc.encrypt(data);
    const { encryptedKey } = readEncryptedMessage(encryptedMessage);

    await expect(
      etoeeSvc.decrypt(writeEncryptedMessage(encryptedKey, data))
    ).rejects.toThrow("pgp.decrypt");
  });

  test("decrypt(): error for value encrypted with another key", async () => {
    const data = "data to encrypt";

    const { encryptedMessage } = await etoeeSvc.encrypt(data);
    const { encryptedMessage: encryptedMessageOther } = await etoeeSvc.encrypt(
      data
    );

    await expect(
      etoeeSvc.decrypt(
        writeEncryptedMessage(
          readEncryptedMessage(encryptedMessage).encryptedKey,
          readEncryptedMessage(encryptedMessageOther).encryptedData
        )
      )
    ).rejects.toThrow("pgp.decrypt");
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
    const { encryptedMessage } = await etoeeSvc.encrypt(data);

    const { senderPublicKey, receiverEncryptedMessage } = await etoeeSvc.share(
      receiverPublicKey,
      encryptedMessage
    );

    const { data: receiverDecryptedData } = await receiverSvc.receive(
      publicKey,
      receiverEncryptedMessage
    );

    expect(isEncryptedMessageFormat(receiverEncryptedMessage)).toBeTruthy();
    expect(publicKey).toEqual(senderPublicKey);
    expect(receiverDecryptedData).toEqual(data);
  });

  test("share(): error invalid receiver public key", async () => {
    const data = "data to encrypt";

    await expect(
      etoeeSvc.share(
        publicKeyBegin + "invalid receiver public key" + publicKeyEnd,
        data
      )
    ).rejects.toThrow("pgp.readPublicKey");
  });

  test("shareNew()", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey } = await etoeeSvc.exportMasterKeys();
    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { senderPublicKey, receiverEncryptedMessage } =
      await etoeeSvc.shareNew(receiverPublicKey, data);

    const { data: receiverDecryptedData } = await receiverSvc.receive(
      publicKey,
      receiverEncryptedMessage
    );

    expect(isEncryptedMessageFormat(receiverEncryptedMessage)).toBeTruthy();
    expect(publicKey).toEqual(senderPublicKey);
    expect(receiverDecryptedData).toEqual(data);
  });

  test("shareNew(): error invalid receiver public key", async () => {
    const data = "data to encrypt";

    await expect(
      etoeeSvc.shareNew(
        publicKeyBegin + "invalid receiver public key" + publicKeyEnd,
        data
      )
    ).rejects.toThrow("pgp.readPublicKey");
  });

  test("receive()", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { senderPublicKey, receiverEncryptedMessage } =
      await etoeeSvc.shareNew(receiverPublicKey, data);

    const { key, data: decryptedData } = await receiverSvc.receive(
      senderPublicKey,
      receiverEncryptedMessage
    );

    expect(data).toEqual(decryptedData);
    expect(isStringHex(key)).toBeTruthy();
  });

  test("receive(): error invalid sender public key", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { receiverEncryptedMessage } = await etoeeSvc.shareNew(
      receiverPublicKey,
      data
    );

    await expect(
      receiverSvc.receive("invalid sender public key", receiverEncryptedMessage)
    ).rejects.toThrow("pgp.readPublicKey");
  });

  test("receive(): error invalid receiver encrypted message", async () => {
    const data = "data to encrypt";

    const receiverSvc = await new OpenE2EE(
      userID + "other",
      passphrase + "other"
    ).build();

    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const { senderPublicKey, receiverEncryptedMessage } =
      await etoeeSvc.shareNew(receiverPublicKey, data);

    await expect(
      receiverSvc.receive(senderPublicKey, "invalid" + receiverEncryptedMessage)
    ).rejects.toThrow("pgp.decryptAsymmetric");
  });
});
