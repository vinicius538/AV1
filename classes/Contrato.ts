export class Contrato {
  public dataVencimento: Date;
  constructor(
    public id: string,
    public organizacaoId: string,
    public dataAssinatura: Date,
    public clausulas: string[],
    public valorMensal: number,
    public renovacaoAutomatica: boolean,
  ) {
    this.dataVencimento = new Date(dataAssinatura);
    this.dataVencimento.setFullYear(this.dataVencimento.getFullYear() + 1);
  }
  estaVigente() {
    return this.dataAssinatura <= new Date() && this.dataVencimento >= new Date();
  }
  renovar(novoVencimento: Date) {
    if (Number.isNaN(novoVencimento.getTime()) || novoVencimento <= this.dataVencimento)
      throw new Error("O novo vencimento deve ser válido e posterior ao atual.");
    this.dataVencimento = new Date(novoVencimento);
  }
}
