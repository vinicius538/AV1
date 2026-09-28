import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { CriptografiaArquivo } from "./CriptografiaArquivo";
import { JournalTransacao } from "./JournalTransacao";
export class RepositorioArquivo {
  constructor(
    diretorioBase: string,
    private chave: string,
    private criptografia = new CriptografiaArquivo(),
  ) {
    fs.mkdirSync(diretorioBase, { recursive: true });
    this.diretorioBase = diretorioBase;
  }
  private diretorioBase: string;
  private caminho(nomeArquivo: string): string {
    if (path.basename(nomeArquivo) !== nomeArquivo || !nomeArquivo.trim())
      throw new Error("Nome de arquivo inválido.");
    return path.join(
      this.diretorioBase,
      nomeArquivo.endsWith(".enc") ? nomeArquivo : `${nomeArquivo}.enc`,
    );
  }
  private ler(nomeArquivo: string): any[] {
    const arquivo = this.caminho(nomeArquivo);
    if (!fs.existsSync(arquivo)) return [];
    const conteudo = fs.readFileSync(arquivo, "utf8");
    const texto = this.criptografia.decifrar(conteudo, this.chave);
    const dados = JSON.parse(texto);
    if (!Array.isArray(dados)) throw new Error(`O conteúdo de ${nomeArquivo} não é uma lista.`);
    return dados;
  }
  private gravar(nomeArquivo: string, dados: any[]): void {
    const destino = this.caminho(nomeArquivo);
    const temporario = `${destino}.${randomUUID()}.tmp`;
    const texto = JSON.stringify(dados, null, 2);
    const saida = this.criptografia.cifrar(texto, this.chave);
    try {
      fs.writeFileSync(temporario, saida, { encoding: "utf8", flag: "wx" });
      fs.renameSync(temporario, destino);
    } catch (erro) {
      if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      throw erro;
    }
  }
  salvarEntidade(nomeArquivo: string, entidade: any, usuarioResponsavel = "sistema") {
    const itens = this.ler(nomeArquivo);
    const indice = itens.findIndex((item) => item.id === entidade.id);
    const antes = indice < 0 ? null : itens[indice];
    if (indice < 0) itens.push(entidade);
    else itens[indice] = entidade;
    new JournalTransacao(
      randomUUID(),
      new Date(),
      indice < 0 ? "CRIAR" : "ATUALIZAR",
      nomeArquivo,
      antes,
      entidade,
      usuarioResponsavel,
    ).registrar(path.join(this.diretorioBase, "journal.enc"), this.chave, this.criptografia);
    this.gravar(nomeArquivo, itens);
    return entidade;
  }
  carregarEntidade(nomeArquivo: string, id: string) {
    return this.ler(nomeArquivo).find((item) => item.id === id) ?? null;
  }
  listarEntidades(nomeArquivo: string) {
    return this.ler(nomeArquivo);
  }
  excluirEntidade(nomeArquivo: string, id: string, usuarioResponsavel = "sistema") {
    const itens = this.ler(nomeArquivo);
    const restantes = itens.filter((item) => item.id !== id);
    if (restantes.length === itens.length) return false;
    new JournalTransacao(
      randomUUID(),
      new Date(),
      "EXCLUIR",
      nomeArquivo,
      itens.find((item) => item.id === id),
      null,
      usuarioResponsavel,
    ).registrar(path.join(this.diretorioBase, "journal.enc"), this.chave, this.criptografia);
    this.gravar(nomeArquivo, restantes);
    return true;
  }
}
