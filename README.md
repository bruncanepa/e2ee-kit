# Open E2EE
## Open tools to make E2EE easier for any app

**These tools are being made in a private repository until v1 is ready.**

Visit [this](https://github.com/users/brunanger/projects/2/views/1) GitHub project to stay informed about the current status of its features.



### Features included in v1
- Create [PGP](https://en.wikipedia.org/wiki/Pretty_Good_Privacy) key pair.
- Encrypt PGP private key, with a key derived from your passphrase with [PBKDF2](https://en.wikipedia.org/wiki/PBKDF2) algorithm.
- Encrypt and decrypt any string using [AES-GCM](https://en.wikipedia.org/wiki/AES-GCM-SIV).
- Encrypt AES-GCM keys with your PGP private key.

### Libraries and Browser's APIs used
- [OpenPGP](https://github.com/ProtonMail/openpgpjs)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)