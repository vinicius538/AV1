import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export class CriptografiaArquivo {
  cifrar(dados: string, chave: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.normalizarChave(chave), iv);
    const cifrado = Buffer.concat([cipher.update(dados, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString("base64");
  }
  decifrar(dadosCifrados: string, chave: string) {
    const pacote = Buffer.from(dadosCifrados, "base64");
    if (pacote.length < 28) throw new Error("Arquivo cifrado inválido.");
    const iv = pacote.subarray(0, 12);
    const tag = pacote.subarray(12, 28);
    const decipher = createDecipheriv("aes-256-gcm", this.normalizarChave(chave), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(pacote.subarray(28)), decipher.final()]).toString("utf8");
  }
  gerarChave() {
    return randomBytes(32).toString("hex");
  }

  private normalizarChave(chave: string): Buffer {
    const bytes = /^[0-9a-f]{64}$/i.test(chave)
      ? Buffer.from(chave, "hex")
      : Buffer.from(chave, "base64");
    if (bytes.length !== 32)
      throw new Error("A chave AES-256 deve conter exatamente 32 bytes (hex ou base64).");
    return bytes;
  }
}
