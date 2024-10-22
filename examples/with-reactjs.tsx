"use client";
import React, { useState, useMemo, useEffect, ChangeEvent } from "react";
import { E2EEKit } from "../lib/e2ee-kit";

const userID = "2997e638-b01b-446f-be33-df9ec8b4f206";

export default function Examples() {
  const [page, setPage] = useState<"text" | "files">("text");
  return (
    <main style={{ width: "80%" }}>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-around",
          borderBottom: "1px solid",
        }}
      >
        <a onClick={() => setPage("text")}>Text</a>
      </nav>
      <br />
      <br />
      {page === "text" && <TextExample />}
    </main>
  );
}

function TextExample() {
  const [passphrase, setPassphrase] = useState("passphrase-long-super-long");
  const etoeeSvc = useMemo(
    () => new E2EEKit(userID, passphrase, ["share"]),
    []
  );

  const [data, setData] = useState("data super secret to encrypt");
  const [encrypted, setEncrypted] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    (async () => {
      await etoeeSvc.build();
      const { privateKey: pri, publicKey: pub } =
        await etoeeSvc.exportMasterKeys();
      setPrivateKey(pri || "");
      setPublicKey(pub || "");
    })();
  }, []);

  const onEncrypt = async () => {
    const item = await etoeeSvc.encrypt(data);
    setEncrypted(item.encryptedMessage);
  };

  const onDecrypt = async () => {
    const item = await etoeeSvc.decrypt(encrypted);
    setDecrypted(JSON.stringify(item));
  };

  const onLoadPGPPrivateKey = async () => {
    const svcLoaded = await new E2EEKit(userID, passphrase, ["share"]).load(
      privateKey,
      publicKey
    );
    const [item1, item2] = await Promise.all([
      etoeeSvc.decrypt(encrypted),
      svcLoaded.decrypt(encrypted),
    ]);
    alert(item1.data === item2.data ? "load successfull" : "load with errors");
  };

  const onShare = async () => {
    const receiverSvc = await new E2EEKit(userID + 1, passphrase + 1, [
      "share",
    ]).build();
    const { publicKey: receiverPublicKey } =
      await receiverSvc.exportMasterKeys();

    const share = async () => {
      const { senderPublicKey, receiverEncryptedMessage } =
        await etoeeSvc.share(receiverPublicKey, encrypted);

      const { data: receiverDecryptedData, shareKey: key } =
        await receiverSvc.receive(senderPublicKey, receiverEncryptedMessage);
      return receiverDecryptedData;
    };

    const shareNew = async () => {
      const { senderPublicKey, receiverEncryptedMessage } =
        await etoeeSvc.shareNew(receiverPublicKey, data);

      const { data: receiverDecryptedData } = await receiverSvc.receive(
        senderPublicKey,
        receiverEncryptedMessage
      );
      return receiverDecryptedData;
    };

    const values = await Promise.all([share(), shareNew()]);

    alert(
      "share done: " +
        `${values.every((v) => v === data) ? "valid" : "invalid"}`
    );
  };

  return (
    <main>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          wordWrap: "break-word",
        }}
      >
        <label>Passphrase</label>
        <input
          onChange={(e) => setPassphrase(e.target.value)}
          value={passphrase}
        ></input>
        <br />

        <label>Data to encrypt</label>
        <input onChange={(e) => setData(e.target.value)} value={data}></input>
        <br />

        <button onClick={onEncrypt}>Encrypt</button>

        <label>Encrypted data</label>
        <span>{encrypted}</span>
        <br />

        <button onClick={onDecrypt}>Decrypt</button>

        <label>Decrypted data</label>
        <span>{decrypted}</span>
        <br />

        <label>PGP private key</label>
        <span>{privateKey}</span>
        <br />

        <label>PGP public key</label>
        <span>{publicKey}</span>
        <br />

        <button onClick={onLoadPGPPrivateKey}>
          Load external PGP private key
        </button>
        <br />
        <br />

        <button onClick={onShare}>Share encrypted data</button>
        <br />
        <br />
      </div>
    </main>
  );
}
