import { Crypto } from "../crypto";
import { uint8ArrayToBase64String } from "../encoding.utils";
import { kbToBytes, mbToBytes } from "../fileSizeUtils";

export const FOLDER_PAGE_SIZE = 150;
export const BATCH_REQUEST_SIZE = 50;
export const FILE_CHUNK_SIZE = mbToBytes(5); // kbToBytes(1); //;

type ReadAs = "buffer" | "text" | "data-url";

export class FileEncryption {
  private blob: Blob;
  private chunkSize: number;
  private offset = 0;

  constructor(file: Blob, chunkSize: number = FILE_CHUNK_SIZE) {
    this.blob = file;
    this.chunkSize = chunkSize;
  }

  private isEOF() {
    return this.offset >= this.blob.size;
  }

  private async next(readAs: ReadAs) {
    const fileReader = new FileReader();
    const blob = this.blob.slice(this.offset, this.offset + this.chunkSize);

    return new Promise<Uint8Array>((resolve, reject) => {
      fileReader.onload = async (e) => {
        if (!e.target || e.target?.error) {
          return reject(
            e.target?.error || new Error("Cannot open file for reading")
          );
        }
        const result = new Uint8Array(e.target.result as ArrayBuffer);
        this.offset += this.chunkSize;
        resolve(result);
      };

      fileReader.onprogress = (event) => {
        if (event.loaded && event.total) {
          const percent = (event.loaded / event.total) * 100;
          console.log(`Progress: ${Math.round(percent)}`);
        }
      };

      this.readAs(readAs, fileReader, blob);
    });
  }

  async readInChunks(readAs: ReadAs, fn: (chunk: Uint8Array) => any) {
    while (!this.isEOF()) {
      const chunk = await this.next(readAs);
      await fn(chunk);
    }
  }

  private buffer = "";

  async nextEncrypted(readAs: ReadAs, separator: string): Promise<string> {
    while (!this.buffer.includes(separator)) {
      let next = await this.next(readAs);
      // if (readAs === "data-url") {
      //   next = next.replace("data:application/octet-stream;base64,", "");
      // }
      // this.buffer += next.length ? atob(next) : next;
      this.buffer += uint8ArrayToBase64String(next);
      if (!next.length) {
        break;
      }
    }

    if (!this.buffer.includes(separator)) {
      return this.buffer;
    }

    const newchunkBeginPosition = this.buffer.indexOf(separator);
    const newchunkEndPosition = newchunkBeginPosition + separator.length;
    const line = this.buffer.substring(0, newchunkBeginPosition);
    this.buffer = this.buffer.substring(newchunkEndPosition);
    return line;
  }

  async readEncryptedInChunks(
    readAs: ReadAs,
    separator: string,
    fn: (encryptedChunk: string) => any
  ) {
    while (!this.isEOF()) {
      const chunk = await this.nextEncrypted(readAs, separator);
      await fn(chunk);
    }
  }

  saveChunkedFile = (name: string, blob: Blob, separator: string) => {
    const anchor = document.createElement("a");
    // anchor.href =
    //   "data:application/octet-stream;base64," +
    //   btoa(
    //     chunks
    //       .map((c) => c.replace("data:application/octet-stream;base64,", ""))
    //       .map((c) => atob(c))
    //       .join("")
    //   );
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();

    // const blob = new Blob(decryptedChunks, {
    //   type: "application/octet-stream",
    // });
    // const blobURL = URL.createObjectURL(blob);
    // const anchor = document.createElement("a");
    // anchor.download =
    //   "dec-chunk." + encryptedFile.name.replace("-chunk.enc", "");
    // anchor.href = blobURL;
    // anchor.click();
    // URL.revokeObjectURL(await blob.text());

    return {};
  };

  saveEncryptedChunkedFile = async (
    name: string,
    encryptedBlob: Blob,
    separator: string
  ) => {
    // const blob = await fetch(
    //   `data:plain/text;base64,${btoa(chunks.join(separator))}`
    // ).then((res) => res.blob());

    const anchor = document.createElement("a");
    anchor.download = name;
    anchor.target = "_blank";
    // anchor.href = "data:application/octet-stream," + encryptedBlob.join(separator);
    anchor.href = URL.createObjectURL(encryptedBlob);
    anchor.click();
    URL.revokeObjectURL(anchor.href);

    // // const blob = new Blob(encryptedChunks, {
    // //   type: "application/octet-stream",
    // // });
    // // const blobURL = URL.createObjectURL(blob);
    // const anchor = document.createElement("a");
    // anchor.download = file.name + ".enc";
    // anchor.href =
    //   "data:application/octet-stream," +
    //   btoa(
    //     encryptedChunks.join(
    //       this.encryptedChunkSeparator === pgpMessageEnd
    //         ? ""
    //         : this.encryptedChunkSeparator
    //     )
    //   );
    // // anchor.href = blobURL;
    // anchor.click();
    // // URL.revokeObjectURL(await blob.text());

    // FileSaver.saveAs(blob, name);
  };

  computeContentHash = async (contentChunks: string[]) => {
    const hashes = await Promise.all(
      contentChunks.map((content) => Crypto.digest(content))
    );
    return hashes.join("_");
  };

  private readAs(readAs: ReadAs, fileReader: FileReader, blob: Blob) {
    switch (readAs) {
      case "text":
        fileReader.readAsText(blob);
        break;
      case "data-url":
        fileReader.readAsDataURL(blob);
        break;
      default:
        fileReader.readAsArrayBuffer(blob);
    }
  }
}
