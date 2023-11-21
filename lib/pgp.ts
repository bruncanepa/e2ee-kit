import * as openpgp from "openpgp";
import { tryCatch } from "./error";

openpgp.config.preferredSymmetricAlgorithm = 9; // set default to aes256

export class PGPPrivateKey extends openpgp.PrivateKey {}
export class PGPPublicKey extends openpgp.PublicKey {}

export class PGPService {
  generateKeyPair = tryCatch(
    "generateKeyPair",
    async (passphrase: string, userId: string) =>
      await openpgp.generateKey({
        type: "ecc", // Type of the key, defaults to ECC
        curve: "curve25519", // ECC curve name, defaults to curve25519
        userIDs: [{ name: userId }], // you can pass multiple user IDs
        passphrase, // protects the private key
        format: "armored", // output key format, defaults to 'armored' (other options: 'binary' or 'object')
      })
  );

  readPublicKey = tryCatch(
    "readPublicKey",
    async (publicKeyArmored: string) =>
      (await openpgp.readKey({ armoredKey: publicKeyArmored })) as PGPPublicKey
  );

  readPrivateKey = tryCatch(
    "readPrivateKey",
    async (privateKeyArmored: string) =>
      (await openpgp.readPrivateKey({
        armoredKey: privateKeyArmored,
      })) as PGPPrivateKey
  );

  decryptPrivateKey = tryCatch(
    "decryptPrivateKey",
    async (privateKeyArmored: string, passphrase: string) => {
      const privateKey = await this.readPrivateKey(privateKeyArmored);
      return (await openpgp.decryptKey({
        privateKey,
        passphrase,
      })) as PGPPrivateKey;
    }
  );

  encryptAsymmetric = tryCatch(
    "encryptAsymmetric",
    async (
      privateKey: openpgp.PrivateKey,
      publicKey: openpgp.PublicKey,
      data: string
    ): Promise<string> => {
      const message = await openpgp.createMessage({ text: data });
      return (await openpgp.encrypt({
        message,
        encryptionKeys: publicKey,
        signingKeys: privateKey,
      })) as Promise<string>;
    }
  );

  decryptAsymmetric = tryCatch(
    "decryptAsymmetric",
    async (
      privateKey: PGPPrivateKey,
      publicKey: PGPPublicKey,
      data: string
    ): Promise<string> => {
      const message = await openpgp.readMessage({ armoredMessage: data });
      return (
        await openpgp.decrypt({
          message,
          verificationKeys: publicKey,
          decryptionKeys: privateKey,
          expectSigned: true,
        })
      ).data as string;
    }
  );

  encrypt = tryCatch(
    "encrypt",
    async (key: string, data: string): Promise<string> => {
      const message = await openpgp.createMessage({ text: data });
      return (await openpgp.encrypt({
        message,
        passwords: key,
      })) as Promise<string>;
    }
  );

  decrypt = tryCatch(
    "decrypt",
    async (key: string, data: string): Promise<string> => {
      const message = await openpgp.readMessage({ armoredMessage: data });
      return (await openpgp.decrypt({ message, passwords: key }))
        .data as Promise<string>;
    }
  );
}
