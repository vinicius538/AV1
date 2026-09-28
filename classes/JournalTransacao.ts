import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { CriptografiaArquivo } from "./CriptografiaArquivo";

export class JournalTransacao {
  public id: string;
  public timestamp: Date;
  public operacao: string;
  public entidade: string;
  public dadosAntes: any;
  public dadosDepois: any;
  public usuarioResponsavel: string;
  constructor(
    id: string,
    timestamp: Date,
    operacao: string,
    entidade: string,
    dadosAntes: any,
    dadosDepois: any,
    usuarioResponsavel: string,
  ) {
    this.id = id;
    this.timestamp = timestamp;
    this.operacao = operacao;
    this.entidade = entidade;
    this.dadosAntes = dadosAntes;
    this.dadosDepois = dadosDepois;
    this.usuarioResponsavel = usuarioResponsavel;
  }
  registrar(caminho?: string, chave?: string, criptografia = new CriptografiaArquivo()): void {
    const registro = JSON.stringify({ ...this, timestamp: this.timestamp.toISOString() });
    if (!caminho) return;
    if (!chave) throw new Error("É necessária a chave mestra para gravar o journal cifrado.");
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    const linha = `${criptografia.cifrar(registro, chave)}\n`;
    const limiteBytes = 10 * 1024 * 1024;
    if (
      fs.existsSync(caminho) &&
      fs.statSync(caminho).size + Buffer.byteLength(linha) > limiteBytes
    ) {
      fs.renameSync(
        caminho,
        `${caminho}.${this.timestamp.toISOString().replace(/[:.]/g, "-")}.${randomUUID()}`,
      );
    }
    fs.appendFileSync(caminho, linha, { encoding: "utf8", flag: "a" });
    if (fs.statSync(caminho).size > limiteBytes) {
      fs.renameSync(
        caminho,
        `${caminho}.${this.timestamp.toISOString().replace(/[:.]/g, "-")}.${randomUUID()}`,
      );
    }
    const pasta = path.dirname(caminho);
    const prefixo = `${path.basename(caminho)}.`;
    const corte = Date.now() - 180 * 24 * 60 * 60 * 1000;
    for (const nome of fs.readdirSync(pasta)) {
      if (!nome.startsWith(prefixo)) continue;
      const rotacionado = path.join(pasta, nome);
      if (fs.statSync(rotacionado).mtimeMs < corte) fs.unlinkSync(rotacionado);
    }
  }
  reverter(): boolean {
    return this.dadosAntes !== undefined && this.dadosAntes !== null;
  }
}
