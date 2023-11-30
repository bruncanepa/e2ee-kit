export const privateKeyBegin = "-----BEGIN PGP PRIVATE KEY BLOCK-----\n";
export const privateKeyEnd = "-----END PGP PRIVATE KEY BLOCK-----\n";
export const publicKeyBegin = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n";
export const publicKeyEnd = "-----END PGP PUBLIC KEY BLOCK-----\n";
export const pgpMessageBegin = "-----BEGIN PGP MESSAGE-----\n";
export const pgpMessageEnd = "-----END PGP MESSAGE-----\n";

export interface EncryptItemOut {
  shareKey: string;
  encryptedMessage: string;
}

export interface DecryptItemOut {
  shareKey: string;
  data: string;
}

export interface ShareItemOut {
  senderPublicKey: string;
  receiverEncryptedMessage: string;
}

export interface ShareNewItemOut extends ShareItemOut {
  senderEncryptedMessage: string;
}

export interface ReceiveItemOut extends DecryptItemOut {}

const exportPGPMessage = (pgpMessage: string) => pgpMessage;
// pgpMessage
//   .replace(new RegExp(`${pgpMessageBegin}`), "")
//   .replace(new RegExp(`${pgpMessageEnd}`), "");

const importEncryptedValue = (encryptedValue: string) => encryptedValue;
// `${pgpMessageBegin}${encryptedValue}${pgpMessageEnd}`;

const encryptedMessageSeparator = "";
export const writeEncryptedItem = (
  encryptedShareKey: string,
  encryptedData: string
) =>
  `${exportPGPMessage(
    encryptedShareKey
  )}${encryptedMessageSeparator}${exportPGPMessage(encryptedData)}`;

export const readEncryptedItem = (encryptedMessage: string) => {
  const positionToSplit =
    encryptedMessage.indexOf(pgpMessageEnd) + pgpMessageEnd.length;
  const encryptedKey = encryptedMessage.substring(0, positionToSplit);
  const encryptedData = encryptedMessage.substring(
    positionToSplit + encryptedMessageSeparator.length
  );
  return {
    encryptedShareKey: importEncryptedValue(encryptedKey),
    encryptedData: importEncryptedValue(encryptedData),
  };
};

export const isEncryptedItemFormat = (encryptedMessage: string): boolean => {
  const beginIndex = encryptedMessage.indexOf(pgpMessageBegin);
  const endIndex = encryptedMessage.indexOf(pgpMessageEnd);

  return (
    beginIndex >= 0 &&
    beginIndex < endIndex &&
    endIndex + 1 + pgpMessageEnd.length < encryptedMessage.length
  );
};
