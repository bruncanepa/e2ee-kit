import pako from "pako";

export const compress = (data: string): Uint8Array => pako.deflate(data);

export const decompress = (compressesData: Uint8Array): Uint8Array =>
  pako.inflate(compressesData);
