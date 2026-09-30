import { Contrato } from "./Contrato";

export class Organizacao {
  constructor(
    public id: string,
    public razaoSocial: string,
    public cnpj: string,
    public inscricaoEstadual: string,
    public enderecoCompleto: string,
    public telefone: string,
    public email: string,
    public dataCadastro: Date,
    public ativo: boolean,
    public contratoVigente: Contrato,
  ) {
    if (!id.trim() || !razaoSocial.trim()) throw new Error("ID e razão social são obrigatórios.");
    if (!(dataCadastro instanceof Date) || Number.isNaN(dataCadastro.getTime()))
      throw new Error("Data de cadastro inválida.");
  }

  alterarEndereco(novoEndereco: string): void {
    if (!novoEndereco.trim()) throw new Error("O endereço não pode ficar vazio.");
    this.enderecoCompleto = novoEndereco.trim();
  }

  desativar(): void {
    this.ativo = false;
  }
}
