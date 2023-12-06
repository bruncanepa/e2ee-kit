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

export const uint8ArrayToBase64String = (arr: Uint8Array): string =>
  Buffer.from(arr).toString("base64");

export const base64StringToUint8Array = (str: string): Uint8Array =>
  new Uint8Array(Buffer.from(str, "base64"));

export const isBase64String = (str: string) =>
  /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/.test(str);
