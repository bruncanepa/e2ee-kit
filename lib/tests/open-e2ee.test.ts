import "./mocks";
import { describe, expect, test, beforeEach } from "@jest/globals";
import { OpenE2EE } from "../open-e2ee";
import { PGPService } from "../pgp";

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
    ).rejects.toThrow();
  });

  test("load(): error invalid public key", async () => {
    let { privateKey } = await etoeeSvc.exportMasterKeys();

    await expect(
      new OpenE2EE(userID, passphrase).load(
        privateKey,
        publicKeyBegin + "\ninvalid private key\n" + publicKeyEnd
      )
    ).rejects.toThrow();
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
    expect(/[0-9A-Fa-f]{6}/g.test(key)).toBeTruthy();
  });

  test("decrypt(): error for not encrypted key", async () => {
    const data = "data to encrypt";

    const { encryptedKey, encryptedValue } = await etoeeSvc.encrypt(data);
    await expect(
      etoeeSvc.decrypt("not encrypted key", encryptedValue)
    ).rejects.toThrow("Misformed armored text");
  });

  test("decrypt(): error for not encrypted value", async () => {
    const data = "data to encrypt";

    const { encryptedKey, encryptedValue } = await etoeeSvc.encrypt(data);
    await expect(
      etoeeSvc.decrypt(encryptedKey, "not encrypted value")
    ).rejects.toThrow("Misformed armored text");
  });

  test("decrypt(): error for value encrypted with another key", async () => {
    const data = "data to encrypt";

    const { encryptedKey } = await etoeeSvc.encrypt(data);
    const { encryptedValue } = await etoeeSvc.encrypt(data);

    await expect(
      etoeeSvc.decrypt(encryptedKey, encryptedValue)
    ).rejects.toThrow(
      "Error decrypting message: Session key decryption failed."
    );
  });
});
