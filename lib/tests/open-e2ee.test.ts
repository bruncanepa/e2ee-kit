import "./mocks";
import { describe, expect, test, beforeEach } from "@jest/globals";
import { OpenE2EE, Feature } from "../open-e2ee";
import { PGP } from "../pgp";
import {
  isEncryptedItemFormat,
  privateKeyBegin,
  privateKeyEnd,
  publicKeyBegin,
  publicKeyEnd,
  readEncryptedItem,
  writeEncryptedItem,
} from "../models";
import { isBase64String } from "../encoding.utils";

const tests = (features: Feature[]) => {
  describe(`open-e2ee module: features ${features.join(",")}`, () => {
    const userID = "2997e638-b01b-446f-be33-df9ec8b4f206";
    const passphrase = "passphrase-long-super-long";
    let etoeeSvc = new OpenE2EE(userID, passphrase, features);
    beforeEach(async () => {
      etoeeSvc = await new OpenE2EE(userID, passphrase, features).build();
    });

    test("build()", async () => {
      const { privateKey, publicKey } = await etoeeSvc.exportMasterKeys();

      await PGP.decryptPrivateKey(privateKey, passphrase);
      await PGP.readPublicKey(publicKey);

      expect(privateKey).toContain(privateKeyBegin);
      expect(privateKey).toContain(privateKeyEnd);
      expect(publicKey).toContain(publicKeyBegin);
      expect(publicKey).toContain(publicKeyEnd);
    });

    test("load()", async () => {
      let { privateKey, publicKey } = await etoeeSvc.exportMasterKeys();

      const otherSvc = await new OpenE2EE(userID, passphrase, features).load(
        privateKey,
        publicKey
      );
      const { privateKey: otherPrivateKey, publicKey: otherPublicKey } =
        await otherSvc.exportMasterKeys();

      await PGP.decryptPrivateKey(otherPrivateKey, passphrase);
      await PGP.readPublicKey(otherPublicKey);

      expect(privateKey).toEqual(otherPrivateKey);
      expect(publicKey).toEqual(otherPublicKey);
    });

    test("load(): error invalid private key", async () => {
      let { publicKey } = await etoeeSvc.exportMasterKeys();

      await expect(
        new OpenE2EE(userID, passphrase, features).load(
          privateKeyBegin + "\ninvalid private key\n" + privateKeyEnd,
          publicKey
        )
      ).rejects.toThrow("pgp.readPrivateKey");
    });

    test("load(): error invalid private key because encrypted with another passphrase", async () => {
      const otherSvc = await new OpenE2EE(
        userID,
        "other passphrase",
        features
      ).build();
      let { publicKey } = await etoeeSvc.exportMasterKeys();
      let { privateKey: otherPrivateKey } = await otherSvc.exportMasterKeys();

      await expect(
        new OpenE2EE(userID, passphrase).load(otherPrivateKey, publicKey)
      ).rejects.toThrow("pgp.decryptPrivateKey");
    });

    test("load(): error invalid public key", async () => {
      let { privateKey } = await etoeeSvc.exportMasterKeys();

      await expect(
        new OpenE2EE(userID, passphrase, features).load(
          privateKey,
          publicKeyBegin + "\ninvalid private key\n" + publicKeyEnd
        )
      ).rejects.toThrow("pgp.readPublicKey");
    });

    test("encrypt()", async () => {
      const data = "data to encrypt";

      const { shareKey: key, encryptedMessage } = await etoeeSvc.encrypt(data);

      expect(encryptedMessage.includes(data)).toBeFalsy();
      if (features.includes("share")) {
        expect(encryptedMessage.includes(key)).toBeFalsy();
        expect(isEncryptedItemFormat(encryptedMessage)).toBeTruthy();
      }
    });

    test("decrypt()", async () => {
      const data = "data to encrypt";

      const { shareKey: key, encryptedMessage } = await etoeeSvc.encrypt(data);
      const { shareKey: decryptedKey, data: decryptedData } =
        await etoeeSvc.decrypt(encryptedMessage);

      expect(data).toEqual(decryptedData);
      expect(key).toEqual(decryptedKey);
    });

    test("decrypt(): error for encrypted message not signed", async () => {
      const data = "data to encrypt";

      const { encryptedMessage } = await etoeeSvc.encrypt(data, false);

      await expect(etoeeSvc.decrypt(encryptedMessage)).rejects.toThrow(
        "Message is not signed"
      );
    });

    test("decrypt(): error for encrypted message from another instance", async () => {
      const data = "data to encrypt";

      const { encryptedMessage } = await etoeeSvc.encrypt(data, false);
      const receiverSvc = await new OpenE2EE(
        userID + "other",
        passphrase + "other",
        features
      ).build();

      await expect(receiverSvc.decrypt(encryptedMessage)).rejects.toThrow(
        features.includes("share")
          ? "pgp.decryptShareKey"
          : "pgp.decryptAsymmetric"
      );
    });

    if (features.includes("share")) {
      test("decrypt(): error for not encrypted value", async () => {
        const data = "data to encrypt";

        const { encryptedMessage } = await etoeeSvc.encrypt(data);
        const { encryptedShareKey: encryptedKey } =
          readEncryptedItem(encryptedMessage);

        await expect(
          etoeeSvc.decrypt(writeEncryptedItem(encryptedKey, data))
        ).rejects.toThrow("pgp.decrypt");
      });

      test("decrypt(): error for not encrypted key", async () => {
        const data = "data to encrypt";

        const { shareKey: key, encryptedMessage } = await etoeeSvc.encrypt(
          data
        );

        await expect(
          etoeeSvc.decrypt(
            writeEncryptedItem(
              key,
              readEncryptedItem(encryptedMessage).encryptedData
            )
          )
        ).rejects.toThrow("pgp.decryptShareKey");
      });

      test("decrypt(): error for value encrypted with another key", async () => {
        const data = "data to encrypt";

        const { encryptedMessage } = await etoeeSvc.encrypt(data);
        const { encryptedMessage: encryptedMessageOther } =
          await etoeeSvc.encrypt(data);

        await expect(
          etoeeSvc.decrypt(
            writeEncryptedItem(
              readEncryptedItem(encryptedMessage).encryptedShareKey,
              readEncryptedItem(encryptedMessageOther).encryptedData
            )
          )
        ).rejects.toThrow("pgp.decrypt");
      });

      test("share()", async () => {
        const data = "data to encrypt";

        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();
        const { publicKey } = await etoeeSvc.exportMasterKeys();
        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();
        const { encryptedMessage } = await etoeeSvc.encrypt(data);

        const { senderPublicKey, receiverEncryptedMessage } =
          await etoeeSvc.share(receiverPublicKey, encryptedMessage);

        const { data: receiverDecryptedData } = await receiverSvc.receive(
          publicKey,
          receiverEncryptedMessage
        );

        expect(isEncryptedItemFormat(receiverEncryptedMessage)).toBeTruthy();
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
          passphrase + "other",
          features
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

        expect(isEncryptedItemFormat(receiverEncryptedMessage)).toBeTruthy();
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
          passphrase + "other",
          features
        ).build();

        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        const { senderPublicKey, receiverEncryptedMessage } =
          await etoeeSvc.shareNew(receiverPublicKey, data);

        const { shareKey: key, data: decryptedData } =
          await receiverSvc.receive(senderPublicKey, receiverEncryptedMessage);

        expect(data).toEqual(decryptedData);
        expect(isBase64String(key)).toBeTruthy();
      });

      test("receive(): error invalid sender public key", async () => {
        const data = "data to encrypt";

        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();

        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        const { receiverEncryptedMessage } = await etoeeSvc.shareNew(
          receiverPublicKey,
          data
        );

        await expect(
          receiverSvc.receive(
            "invalid sender public key",
            receiverEncryptedMessage
          )
        ).rejects.toThrow("pgp.readPublicKey");
      });

      test("receive(): error invalid receiver encrypted message", async () => {
        const data = "data to encrypt";

        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();

        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        const { senderPublicKey, receiverEncryptedMessage } =
          await etoeeSvc.shareNew(receiverPublicKey, data);

        await expect(
          receiverSvc.receive(
            senderPublicKey,
            "invalid" + receiverEncryptedMessage
          )
        ).rejects.toThrow("pgp.decryptAsymmetric");
      });
    } else {
      test("share(): error no feature share", async () => {
        const data = "data to encrypt";
        const { encryptedMessage } = await etoeeSvc.encrypt(data);
        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();
        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        await expect(
          etoeeSvc.share(receiverPublicKey, encryptedMessage)
        ).rejects.toThrow("share");
      });

      test("shareNew(): error no feature share", async () => {
        const data = "data to encrypt";
        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();
        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        await expect(
          etoeeSvc.shareNew(receiverPublicKey, data)
        ).rejects.toThrow("share");
      });

      test("receive(): error no feature share", async () => {
        const data = "data to encrypt";
        const receiverSvc = await new OpenE2EE(
          userID + "other",
          passphrase + "other",
          features
        ).build();
        const { publicKey: receiverPublicKey } =
          await receiverSvc.exportMasterKeys();

        await expect(etoeeSvc.receive(receiverPublicKey, data)).rejects.toThrow(
          "share"
        );
      });
    }
  });
};

tests(["share"]);
tests([]);
