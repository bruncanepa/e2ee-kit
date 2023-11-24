export const privateKeyBegin = "-----BEGIN PGP PRIVATE KEY BLOCK-----\n";
export const privateKeyEnd = "-----END PGP PRIVATE KEY BLOCK-----\n";
export const publicKeyBegin = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n";
export const publicKeyEnd = "-----END PGP PUBLIC KEY BLOCK-----\n";
export const pgpMessageBegin = "-----BEGIN PGP MESSAGE-----\n";
export const pgpMessageEnd = "-----END PGP MESSAGE-----\n";

export interface MessageItemEncrypted {
  key: string;
  encryptedMessage: string;
}

export interface MessageItem {
  key: string;
  data: string;
}

export interface ShareItemOut {
  senderPublicKey: string;
  receiverEncryptedMessage: string;
}

export interface ShareNewItemOut extends ShareItemOut {
  senderEncryptedMessage: string;
}

export interface ReceiveItemOut extends MessageItem {}

const exportPGPMessage = (pgpMessage: string) => pgpMessage;
// pgpMessage
//   .replace(new RegExp(`${pgpMessageBegin}`), "")
//   .replace(new RegExp(`${pgpMessageEnd}`), "");

const importEncryptedValue = (encryptedValue: string) => encryptedValue;
// `${pgpMessageBegin}${encryptedValue}${pgpMessageEnd}`;

const encryptedMessageSeparator = "";
export const writeEncryptedMessage = (
  encryptedKey: string,
  encryptedData: string
) =>
  `${exportPGPMessage(
    encryptedKey
  )}${encryptedMessageSeparator}${exportPGPMessage(encryptedData)}`;

export const readEncryptedMessage = (encryptedMessage: string) => {
  const positionToSplit =
    encryptedMessage.indexOf(pgpMessageEnd) + pgpMessageEnd.length;
  const encryptedKey = encryptedMessage.substring(0, positionToSplit);
  const encryptedData = encryptedMessage.substring(
    positionToSplit + encryptedMessageSeparator.length
  );
  return {
    encryptedKey: importEncryptedValue(encryptedKey),
    encryptedData: importEncryptedValue(encryptedData),
  };
};

export const isEncryptedMessageFormat = (encryptedMessage: string): boolean => {
  const firstBeginIndex = encryptedMessage.indexOf(pgpMessageBegin);
  const lastBeginIndex = encryptedMessage.lastIndexOf(pgpMessageBegin);

  const firstEndIndex = encryptedMessage.indexOf(pgpMessageEnd);
  const lastEndIndex = encryptedMessage.lastIndexOf(pgpMessageEnd);

  return (
    firstBeginIndex >= 0 &&
    firstBeginIndex !== lastBeginIndex &&
    firstEndIndex >= 0 &&
    firstEndIndex !== lastEndIndex
  );
};
