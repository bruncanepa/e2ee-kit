# Open E2EE

## Open tools to make E2EE easier for any Web app

Inspired by [ProtonMail](https://proton.me/blog/encrypted-email) and [ProtonCalendar](https://proton.me/blog/protoncalendar-security-model) privacy and security practices.

Visit [this](https://github.com/users/bruncanepa/projects/2/views/1) GitHub project to stay informed about the current status of its features.

### Libraries used

- [OpenPGP](https://github.com/ProtonMail/openpgpjs)

### Features included in current version v1.1

- Create PGP key pair.
- Export PGP key pair (private key encrypted).
- Create AES-256 keys and encrypt them with your PGP private key.
- Encrypt and decrypt any string using AES-256.
- Share and receive data encrypted with other's PGP public key and signed with your PGP private key.

### Main flows

#### Encryption flow

1. Create (or load) a PGP key pair (`privateKey` encrypted, `publicKey`) associated with your `passphrase`.
2. Creates 32-bytes `key`.
3. Encrypt with AES-256 the `data` with the `key`. Returns `encryptedData`.
4. Encrypt `key`, with your PGP `privateKey`. Returns `encryptedKey`.
5. Returns `encryptedMessage` as `${encryptedData}.${encryptedKey}`.

<img src="https://github.com/bruncanepa/open-e2ee/assets/8711973/96a6996a-dd03-47bd-a431-8b9e8e655df1" alt="drawing" width="800"/>

#### Decryption flow

0. Read the [Encryption flow](#encryption-flow) first.
1. Load a PGP key pair (`privateKey` encrypted, `publicKey`).
2. Decrypt PGP `privateKey` with your `passphrase`.`
3. Decrypt AES-256 `encryptedKey` with your PGP `privateKey`. Returns `key` decrypted.
4. Decrypt `encryptedData` with `key`. Returns `data`.
5. Do something with the `data` decrypted.

<img src="https://github.com/bruncanepa/open-e2ee/assets/8711973/643915f8-db0d-4196-a285-1c93752333fd" alt="drawing" width="800"/>

#### Share flow

1. Load receiver PGP public key.
2. Encrypt the data to share with the [Encryption flow](#encryption-flow). This returns the `encryptedData`, the `key` used to encrypt the data, and `senderEncryptedKey` that is the encrypted `key` with the sender's PGP `privateKey`.
3. Encrypt the `key` with `receiverPublicKey`. This returns the `receiverEncryptedKey`. This can only be decrypted with `receiverPrivateKey`.
4. Save into the sender user `senderEncryptedKey` and `encryptedData`.
5. Share `senderPublicKey` and `senderEncryptedMessage` with the receiver user.

#### Receive flow

0. Read the [Share flow](#share-flow) first.
1. Load `senderPublicKey` PGP public key.
2. Decrypt the `receiverEncryptedKey` with the receiver PGP `privateKey`. Returns the decrypted `key`.
3. Check message is signed by sender with the `senderPublicKey`.
4. Decrypt `encryptedData` with `key`. This returns the decrypted `data`.
5. Do something with `data`.

Images credit: [ProtonMail](https://proton.me/blog/what-is-pgp-encryption).

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
  const {
    senderEncryptedKey, // don't share this data
    senderPublicKey, // share to receiver
    receiverEncryptedKey, // share to receiver
    encryptedData, // share to receiver
  } = await etoeeSvc.share(receiverPublicKey, data);

  // 6. Receive a E2EE and signed item from another user (sender)
  const { key, data } = await receiverSvc.receive(
    senderPublicKey,
    receiverEncryptedKey,
    encryptedData
  );
  console.log({ key, data, flowRunOk: data === data });
})();
```
