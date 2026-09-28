export class Movimentacao {
  constructor(
    public id: string,
    public equipamentoId: string,
    public dataHora: Date,
    public origem: string,
    public destino: string,
    public responsavel: string,
    public observacao: string,
  ) {
    this.id = id;
    this.equipamentoId = equipamentoId;
    this.dataHora = dataHora;
    this.origem = origem;
    this.destino = destino;
    this.responsavel = responsavel;
    this.observacao = observacao;
  }
}
