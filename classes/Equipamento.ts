import { randomUUID } from "node:crypto";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusRastreamento } from "../enums/StatusRastreamento";
import { TipoEquipamento } from "../enums/TipoEquipamento";
import { Movimentacao } from "./Movimentacao";

const estados = Object.values(EstadoFisico);

export class Equipamento {
  public triagemCompleta = false;
  constructor(
    public id: string,
    public codigoBarrasInterno: string,
    public tipo: TipoEquipamento,
    public marca: string,
    public modelo: string,
    public anoFabricacao: number,
    public estadoFisico: EstadoFisico,
    public pesoQuilogramas: number,
    public loteId: string,
    public precoMercado: number,
    public statusRastreamento: StatusRastreamento,
    public historicoMovimentacao: Movimentacao[] = [],
    public etiqueta = "",
  ) {
    if (!id.trim() || !codigoBarrasInterno.trim())
      throw new Error("ID e código de barras são obrigatórios.");
    if (!Number.isFinite(pesoQuilogramas) || pesoQuilogramas < 0) throw new Error("Peso inválido.");
    if (!Number.isFinite(precoMercado) || precoMercado < 0)
      throw new Error("Preço de mercado inválido.");
  }

  concluirTriagem(): void {
    this.triagemCompleta = true;
  }

  atualizarStatus(
    novoStatus: StatusRastreamento,
    justificativa = "",
    responsavel = "sistema",
  ): void {
    if (novoStatus === StatusRastreamento.EM_DESMONTE && !this.triagemCompleta)
      throw new Error("O equipamento precisa concluir a triagem antes do desmonte.");
    this.statusRastreamento = novoStatus;
    this.registrarMovimentacao(novoStatus, responsavel, justificativa);
  }

  atualizarEstadoFisico(novoEstado: EstadoFisico, justificativa = ""): void {
    const anterior = estados.indexOf(this.estadoFisico);
    const novo = estados.indexOf(novoEstado);
    if (anterior < 0 || novo < 0) throw new Error("Estado físico inválido.");
    if (novo - anterior >= 2 && !justificativa.trim())
      throw new Error(
        "Informe uma justificativa para a queda de duas ou mais categorias no estado físico.",
      );
    this.estadoFisico = novoEstado;
  }

  registrarMovimentacao(destino: string, responsavel: string, observacao = ""): Movimentacao {
    if (!destino.trim() || !responsavel.trim())
      throw new Error("Destino e responsável são obrigatórios.");
    const anterior =
      this.historicoMovimentacao[this.historicoMovimentacao.length - 1]?.destino ?? "ORIGEM";
    const movimentacao = new Movimentacao(
      randomUUID(),
      this.id,
      new Date(),
      anterior,
      destino,
      responsavel,
      observacao,
    );
    this.historicoMovimentacao.push(movimentacao);
    return movimentacao;
  }

  calcularDepreciacao(taxaAnual = 0.2, valorInicial?: number): number {
    if (
      !Number.isFinite(taxaAnual) ||
      taxaAnual < 0 ||
      taxaAnual > 1 ||
      (valorInicial !== undefined && (!Number.isFinite(valorInicial) || valorInicial < 0))
    )
      throw new Error("Parâmetros de depreciação inválidos.");
    const idade = Number.isFinite(this.anoFabricacao)
      ? Math.max(0, new Date().getFullYear() - this.anoFabricacao)
      : 0;
    return Math.max(0, (valorInicial ?? this.precoMercado) * (1 - taxaAnual) ** idade);
  }
}
