import * as openpgp from "openpgp";

openpgp.config.preferredSymmetricAlgorithm = 9; // set default to aes256 

export class PGPPrivateKey extends openpgp.PrivateKey {}
export class PGPPublicKey extends openpgp.PublicKey {}

export class PGPService {
  generateKeyPair = async (passphrase: string, userId: string) =>
    await openpgp.generateKey({
      type: "ecc", // Type of the key, defaults to ECC
      curve: "curve25519", // ECC curve name, defaults to curve25519
      userIDs: [{ name: userId }], // you can pass multiple user IDs
      passphrase, // protects the private key
      format: "armored", // output key format, defaults to 'armored' (other options: 'binary' or 'object')
    });

  readPublicKey = async (publicKeyArmored: string) =>
    await openpgp.readKey({ armoredKey: publicKeyArmored });

  readPrivateKey = async (privateKeyArmored: string) =>
    (await openpgp.readPrivateKey({
      armoredKey: privateKeyArmored,
    })) as PGPPrivateKey;

  decryptPrivateKey = async (privateKeyArmored: string, passphrase: string) => {
    const privateKey = await this.readPrivateKey(privateKeyArmored);
    return (await openpgp.decryptKey({
      privateKey,
      passphrase,
    })) as PGPPrivateKey;
  };

  encryptAsymmetric = async (
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
  };

  decryptAsymmetric = async (
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
  };

  encrypt = async (key: string, data: string): Promise<string> => {
    const message = await openpgp.createMessage({ text: data });
    return (await openpgp.encrypt({
      message,
      passwords: key,
    })) as Promise<string>;
  };

  decrypt = async (key: string, data: string): Promise<string> => {
    const message = await openpgp.readMessage({ armoredMessage: data });
    return (await openpgp.decrypt({ message, passwords: key }))
      .data as Promise<string>;
  };
}
