import { Crypto } from "@peculiar/webcrypto";

Object.defineProperty(globalThis, "crypto", {
  value: new Crypto(),
});
