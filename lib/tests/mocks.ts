import { Crypto } from "@peculiar/webcrypto";

Object.defineProperty(globalThis, "crypto", {
  value: new Crypto(),
});

// const { crypto } = globalThis;

// if (!crypto) {
//   const cryptoNodeJS = require("crypto");
//   Object.defineProperty(globalThis, "crypto", {
//     value: {
//       getRandomValues: (arr: Uint8Array) =>
//         cryptoNodeJS.randomBytes(arr.length),
//       subtle: {
//         importKey: async (key: string): Promise<string> => key,
//         encrypt: (_: any, key: string, data: string): string => {
//           const cipher = cryptoNodeJS.createCipher("aes-256-gcm", key);
//           let crypted = cipher.update(data, "utf8", "hex");
//           crypted += cipher.final("hex");
//           return crypted;
//         },
//         decrypt: (_: any, key: string, encryptedData: string): string => {
//           const decipher = cryptoNodeJS.createDecipher("aes-256-gcm", key);
//           let dec = decipher.update(encryptedData, "hex", "utf8");
//           dec += decipher.final("utf8");
//           return dec;
//         },
//       },
//     },
//   });
// }
