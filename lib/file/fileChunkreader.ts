import { CryptoService } from "../crypto";
import { mbToBytes } from "../fileSizeUtils";

export const FOLDER_PAGE_SIZE = 150;
export const BATCH_REQUEST_SIZE = 50;
export const FILE_CHUNK_SIZE = mbToBytes(5);

type ReadAs = "binary" | "text" | "data-url";

// export const MEMORY_DOWNLOAD_LIMIT = (isMobile() ? 100 : 500) * MB;
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

    return new Promise<string>((resolve, reject) => {
      fileReader.onload = async (e) => {
        if (!e.target || e.target?.error) {
          return reject(
            e.target?.error || new Error("Cannot open file for reading")
          );
        }

        const result = e.target.result as string;
        this.offset += this.chunkSize;
        resolve(result);
      };

      this.readAs(readAs, fileReader, blob);
    });
  }

  async readInChunks(readAs: ReadAs, fn: (chunk: string) => any) {
    while (!this.isEOF()) {
      const chunk = await this.next(readAs);
      await fn(chunk);
    }
  }

  private buffer = "";

  async nextEncrypted(readAs: ReadAs, separator: string): Promise<string> {
    while (!this.buffer.includes(separator)) {
      const next = await this.next(readAs);
      this.buffer += atob(next);
      if (!next) {
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

  saveChunkedFile = (name: string, chunks: string[], separator: string) => {
    const anchor = document.createElement("a");
    anchor.href = chunks.join(separator);
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
    chunks: string[],
    separator: string
  ) => {
    // const blob = await fetch(
    //   `data:plain/text;base64,${btoa(chunks.join(separator))}`
    // ).then((res) => res.blob());

    const anchor = document.createElement("a");
    anchor.download = name;
    anchor.target = "_blank";
    anchor.href =
      "data:application/octet-stream," + btoa(chunks.join(separator));
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
    const cryptoSvc = new CryptoService();
    const hashes = await Promise.all(
      contentChunks.map((content) => cryptoSvc.sha256(content))
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
        fileReader.readAsBinaryString(blob);
    }
  }
}
