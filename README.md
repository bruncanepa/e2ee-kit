# Open E2EE

## Open tools to make E2EE easier for any Web app

Inspired by [ProtonMail](https://proton.me/mail) privacy and security practices.

Visit [this](https://github.com/users/bruncanepa/projects/2/views/1) GitHub project to stay informed about the current status of its features.

### Libraries and Web Browser's APIs used

- [OpenPGP](https://github.com/ProtonMail/openpgpjs)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Main flows

#### Encryption

1. Create (or load) a PGP key pair (private key encrypted, public key) associated with your passphrase.
2. Encrypt any data:
   1. Creates AES-256 key.
   2. Encrypt data with the key from step 2.1.
   3. Encrypt key from step 2.1, with your PGP private key.
3. Save both encrypted data and encrypted key.

<img src="https://github.com/bruncanepa/open-e2ee/assets/8711973/96a6996a-dd03-47bd-a431-8b9e8e655df1" alt="drawing" width="800"/>

#### Decryption

1. Load a PGP key pair (private key encrypted, public key).
2. Decrypt PGP private key with your passphrase.
3. Decrypt encrypted data:
   1. Decrypt AES-256 encrypted key with your PGP private key.
   2. Decrypt encrypted data with key from 3.1.
4. Do something with the decrypted data.

<img src="https://github.com/bruncanepa/open-e2ee/assets/8711973/643915f8-db0d-4196-a285-1c93752333fd" alt="drawing" width="800"/>

Images credit: [ProtonMail](https://proton.me/blog/what-is-pgp-encryption).
   
### Features included in v1 (current version)

- Create PGP key pair.
- Export PGP key pair (private key encrypted).
- Create AES-256 keys and encrypt them with your PGP private key.
- Encrypt and decrypt any string using AES-256.

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

  // 3. Encrypt an item. Save both encryptedKey and encryptedValue in your database.
  const { encryptedKey, encryptedValue } = await etoeeSvc.encrypt(data);
  console.log({ encryptedKey, encryptedValue });

  // 4. Decrypt an item
  const { key, value } = await etoeeSvc.decrypt(encryptedKey, encryptedValue);
  console.log({ key, value });
})();
```
