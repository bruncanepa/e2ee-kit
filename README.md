# Open E2EE

## Open tools to make E2EE easier for any Web app

Inspired by [ProtonMail](https://proton.me/blog/encrypted-email) and [ProtonCalendar](https://proton.me/blog/protoncalendar-security-model) privacy and security practices.

Visit [this](https://github.com/users/bruncanepa/projects/2/views/1) GitHub project to stay informed about the current status of its features.

### Libraries used

- [OpenPGP](https://github.com/ProtonMail/openpgpjs)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Features included in current version v1.1

- Create PGP key pair.
- Export PGP key pair (private key encrypted).
- Create AES-256 keys and encrypt them with your PGP private key.
- Encrypt and decrypt any string using AES-256.
- Share and receive data encrypted with other's PGP public key and signed with your PGP private key.

### Main flows

#### Encryption flow

<img src="docs/encrypt-flow.png" alt="drawing" width="600"/>

#### Decryption flow

<img src="docs/decrypt-flow.png" alt="drawing" width="800"/>

#### Share flow

<img src="docs/share-flow.png" alt="drawing" width="800"/>

#### Receive flow

<img src="docs/receive-flow.png" alt="drawing" width="500"/>

## Example

```ts
(async () => {
  const userID = "2997e638-b01b-446f-be33-df9ec8b4f206";
  const passphrase = "passphrase-long-super-long";
  const data = "super secret to encrypt";

  // 1. Create instance of service (2 options)
  // A) Create a new PGP pair. Use only once for each user (e.g: on sign up)
  const etoeeSvc = await new OpenE2EE(userID, passphrase).build();
  // B) Loads an existing PGP pair. Use when user already has a PGP key pair (e.g: on sign in)
  const etoeeSvc = await new OpenE2EE(userID, passphrase).load(
    privateKey,
    publicKey
  );

  // 2. Export PGP keys to save in your database, private key is encrypted by PGP. (e.g: on sign up)
  const { privateKey, publicKey } = await etoeeSvc.exportMasterKeys();

  // 3. Encrypt an item. Save both encryptedKey and encryptedData in your database.
  const { encryptedKey, encryptedData } = await etoeeSvc.encrypt(data);
  console.log({ encryptedKey, encryptedData });

  // 4. Decrypt an item
  const { key, data } = await etoeeSvc.decrypt(encryptedKey, encryptedData);
  console.log({ key, data });

  // 5. Share an E2EE and signed item with another user (receiver)
  const receiverSvc = await new OpenE2EE(
    userID + "other",
    passphrase + "other"
  ).build();
  const { publicKey: receiverPublicKey } = await receiverSvc.exportMasterKeys();
  const { senderPublicKey, receiverEncryptedMessage } = await etoeeSvc.share(
    receiverPublicKey,
    encrypted
  );

  // 6. Receive a E2EE and signed item from another user (sender)
  const { shareKey, data } = await receiverSvc.receive(
    senderPublicKey,
    receiverEncryptedKey,
    encryptedData
  );
  console.log({ shareKey, data, flowRunOk: data === data });
})();
```
