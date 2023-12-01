export const stringToUint8Array = (value: string): Uint8Array =>
  new TextEncoder().encode(value);

export const uint8ArrayToString = (value: Uint8Array): string =>
  new TextDecoder().decode(value);

export function mergeUint8Arrays(...arrays: Uint8Array[]) {
  const merged = new Uint8Array(
    arrays.reduce((sum, arr) => sum + arr.length, 0)
  );
  arrays.reduce((startIndex, arr) => {
    merged.set(arr, startIndex);
    return startIndex + arr.length;
  }, 0);
  return merged;
}

export const encodeUtf8 = (input: string) =>
  unescape(encodeURIComponent(input));
export const decodeUtf8 = (input: string) => decodeURIComponent(escape(input));
export const encodeBase64 = (input: string) => btoa(input).trim();
export const decodeBase64 = (input: string) => atob(input.trim());
export const encodeUtf8Base64 = (input: string) =>
  encodeBase64(encodeUtf8(input));
export const decodeUtf8Base64 = (input: string) =>
  decodeUtf8(decodeBase64(input));

export const uint8ArrayToBase64String = (arr: Uint8Array): string =>
  Buffer.from(arr).toString("base64");

export const base64StringToUint8Array = (str: string): Uint8Array =>
  new Uint8Array(Buffer.from(str, "base64"));

/**
 * Encode a binary string in the so-called base64 URL (https://tools.ietf.org/html/rfc4648#section-5)
 * @dev Each character in a binary string can only be one of the characters in a reduced 255 ASCII alphabet. I.e. morally each character is one byte
 * @dev This function will fail if the argument contains characters which are not in this alphabet
 * @dev This encoding works by converting groups of three "bytes" into groups of four base64 characters (2 ** 6 ** 4 is also three bytes)
 * @dev Therefore, if the argument string has a length not divisible by three, the returned string will be padded with one or two '=' characters
 */
export const encodeBase64URL = (str: string, removePadding = true) => {
  const base64String = encodeBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return removePadding ? base64String.replace(/=/g, "") : base64String;
};

/**
 * Convert a string encoded in base64 URL into a binary string
 * @param str
 */
export const decodeBase64URL = (str: string) => {
  return decodeBase64(
    (str + "===".slice((str.length + 3) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/")
  );
};

export const uint8ArrayToPaddedBase64URLString = (array: Uint8Array) =>
  encodeBase64URL(uint8ArrayToString(array), false);

export const validateBase64string = (
  str: string,
  useVariantAlphabet?: boolean
) => {
  const regex = useVariantAlphabet
    ? /^[-_A-Za-z0-9]*={0,3}$/
    : /^[+/A-Za-z0-9]*={0,3}$/;

  return regex.test(str);
};
