import * as openpgp from "openpgp";
import { tryCatch } from "./error";
import { uint8ArrayToBase64String } from "./encoding.utils";

openpgp.config.preferredSymmetricAlgorithm = openpgp.enums.symmetric.aes256; // set default to AES256

export type PGPPrivateKey = openpgp.PrivateKey | undefined;
export type PGPPublicKey = openpgp.PublicKey | undefined;

export class PGP {
  static generateKeyPair = tryCatch(
    "pgp.generateKeyPair",
    async (passphrase: string, userId: string) =>
      await openpgp.generateKey({
        type: "ecc", // Type of the key, defaults to ECC
        curve: "curve25519", // ECC curve name, defaults to curve25519
        userIDs: [{ name: userId }], // you can pass multiple user IDs
        passphrase, // protects the private key
        format: "armored", // output key format, defaults to 'armored' (other options: 'binary' or 'object')
      })
  );

  static generateShareKey = tryCatch(
    "pgp.generateShareKey",
    async (encryptionKeys: PGPPublicKey | PGPPublicKey[]) => {
      const shareKey = await openpgp.generateSessionKey({
        encryptionKeys: encryptionKeys as openpgp.PublicKey[],
      });
      const encryptedShareKey = await openpgp.encryptSessionKey({
        ...shareKey,
        encryptionKeys: encryptionKeys as openpgp.PublicKey[],
      });
      return {
        shareKey: uint8ArrayToBase64String(shareKey.data),
        encryptedShareKey,
      };
    }
  );

  static decryptShareKey = tryCatch(
    "pgp.decryptShareKey",
    async (
      decryptionKey: PGPPrivateKey,
      encryptedShareKey: string
    ): Promise<string> => {
      const [shareKey] = await openpgp.decryptSessionKeys({
        message: await openpgp.readMessage({
          armoredMessage: encryptedShareKey,
        }),
        decryptionKeys: decryptionKey,
      });
      return uint8ArrayToBase64String(shareKey.data);
    }
  );

  static readPublicKey = tryCatch(
    "pgp.readPublicKey",
    async (publicKeyArmored: string): Promise<PGPPublicKey> =>
      (await openpgp.readKey({ armoredKey: publicKeyArmored })) as PGPPublicKey
  );

  static readPrivateKey = tryCatch(
    "pgp.readPrivateKey",
    async (privateKeyArmored: string) =>
      (await openpgp.readPrivateKey({
        armoredKey: privateKeyArmored,
      })) as PGPPrivateKey
  );

  static decryptPrivateKey = tryCatch(
    "pgp.decryptPrivateKey",
    async (privateKeyArmored: string, passphrase: string) => {
      const privateKey = await this.readPrivateKey(privateKeyArmored);
      return (await openpgp.decryptKey({
        privateKey: privateKey as openpgp.PrivateKey,
        passphrase,
      })) as PGPPrivateKey;
    }
  );

  static encryptAsymmetric = tryCatch(
    "pgp.encryptAsymmetric",
    async (
      signingKey: PGPPrivateKey,
      encryptionKeys: PGPPublicKey[],
      data: string
    ): Promise<string> => {
      const message = await openpgp.createMessage({ text: data });
      const encrypted = await openpgp.encrypt({
        message,
        encryptionKeys: encryptionKeys as openpgp.PublicKey[],
        signingKeys: signingKey,
      });
      return encrypted as string;
    }
  );

  static decryptAsymmetric = tryCatch(
    "pgp.decryptAsymmetric",
    async (
      privateKey: PGPPrivateKey,
      verificationKeys: PGPPublicKey[],
      data: string
    ): Promise<string> => {
      const message = await openpgp.readMessage({ armoredMessage: data });
      const decrypted = await openpgp.decrypt({
        message,
        verificationKeys: verificationKeys as openpgp.PublicKey[],
        decryptionKeys: privateKey,
        expectSigned: true,
      });
      return decrypted.data as string;
    }
  );

  static encrypt = tryCatch(
    "pgp.encrypt",
    async (
      signingKey: PGPPrivateKey,
      key: string,
      data: string,
      config: EncryptConfig = { compression: false }
    ): Promise<string> => {
      const message = await openpgp.createMessage({ text: data });
      const encrypted = await openpgp.encrypt({
        message,
        passwords: key,
        signingKeys: signingKey,
        config: {
          preferredCompressionAlgorithm: config.compression
            ? openpgp.enums.compression.zlib
            : openpgp.enums.compression.uncompressed,
        },
      });
      return encrypted as string;
    }
  );

  static decrypt = tryCatch(
    "pgp.decrypt",
    async (
      key: string,
      data: string,
      verificationKeys?: PGPPublicKey[]
    ): Promise<string> => {
      const message = await openpgp.readMessage({ armoredMessage: data });
      const decrypted = await openpgp.decrypt({
        message,
        passwords: key,
        verificationKeys: verificationKeys as openpgp.PublicKey[],
        expectSigned: Boolean(verificationKeys?.length),
      });
      return decrypted.data as string;
    }
  );

  static encryptFile = (key: string, data: string) =>
    this.encrypt(undefined, key, data, { compression: true });

  static decryptFile = (key: string, data: string) => this.decrypt(key, data);
}

export interface EncryptConfig {
  compression: boolean;
}
