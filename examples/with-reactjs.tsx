"use client";
import React, { useState, useMemo, useEffect } from "react";
import { OpenE2EE } from "../lib/open-e2ee";

const userID = "2997e638-b01b-446f-be33-df9ec8b4f206";
export default function Home() {
  const [passphrase, setPassphrase] = useState("passphrase-long-super-long");
  const etoeeSvc = useMemo(() => new OpenE2EE(userID, passphrase), []);

  const [data, setData] = useState("data super secret to encrypt");
  const [encrypted, setEncrypted] = useState<string>("");
  const [decrypted, setDecrypted] = useState<string>("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [encryptedItemKey, setEncryptedItemKey] = useState("");
  const [itemKey, setItemKey] = useState("");

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
    console.log("start to encrypt");
    const item = await etoeeSvc.encrypt(data);
    console.log("end to encrypt");
    setEncryptedItemKey(item.encryptedKey);
    setEncrypted(item.encryptedValue);
  };

  const onDecrypt = async () => {
    console.log("start to decrypt");
    const item = await etoeeSvc.decrypt(encryptedItemKey, encrypted);
    console.log("end to decrypt");
    setDecrypted(item.value);
    setItemKey(item.key);
  };

  const onLoadPGPPrivateKey = async () => {
    const svcLoaded = await new OpenE2EE(userID, passphrase).load(
      privateKey,
      publicKey
    );
    const [item1, item2] = await Promise.all([
      etoeeSvc.decrypt(encryptedItemKey, encrypted),
      svcLoaded.decrypt(encryptedItemKey, encrypted),
    ]);
    alert(
      item1.value === item2.value ? "load successfull" : "load with errors"
    );
  };

  return (
    <main>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "60%",
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

        <label>AES item key</label>
        <span>{itemKey}</span>
        <br />

        <label>AES encrypted item key</label>
        <span>{encryptedItemKey}</span>
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
      </div>
    </main>
  );
}
