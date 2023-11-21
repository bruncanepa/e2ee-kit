/**
 * Convert a hex string to an array of 8-bit integers
 * @param hex  A hex string to convert
 * @returns An array of 8-bit integers
 */
export const hexStringToArray = (hex: string) => {
  const result = new Uint8Array(hex.length >> 1);
  for (let k = 0; k < result.length; k++) {
    const i = k << 1;
    result[k] = parseInt(hex.substring(i, i + 2), 16);
  }
  return result;
};

const hexAlphabet = "0123456789abcdef";
/**
 * Convert an array of 8-bit integers to a hex string
 * @param bytes Array of 8-bit integers to convert
 * @returns Hexadecimal representation of the array
 */
export const arrayToHexString = (bytes: Uint8Array) =>
  bytes.reduce(
    (str, byte) => (str += hexAlphabet[byte >> 4] + hexAlphabet[byte & 15]),
    ""
  );

export const isStringAHex = (val: string) => /[0-9A-Fa-f]{6}/g.test(val);
