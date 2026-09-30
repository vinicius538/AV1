import { randomUUID } from "node:crypto";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusRastreamento } from "../enums/StatusRastreamento";
import { TipoEquipamento } from "../enums/TipoEquipamento";
import { Equipamento } from "./Equipamento";
import { Movimentacao } from "./Movimentacao";
import { RepositorioArquivo } from "./RepositorioArquivo";

export interface HistoricoCompleto {
  equipamento: Equipamento;
  movimentacoes: Movimentacao[];
}

export type DadosEquipamento = {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
  loteId: string;
  precoMercado: number;
};

export class ServicoEquipamento {
  constructor(public repositorio: RepositorioArquivo) {}

  private buscar(id: string): Equipamento {
    const dados = this.repositorio.carregarEntidade("equipamentos", id);
    if (!dados) throw new Error("Equipamento não encontrado.");
    const historico = (dados.historicoMovimentacao ?? []).map(
      (m: any) =>
        new Movimentacao(
          m.id,
          m.equipamentoId,
          new Date(m.dataHora),
          m.origem,
          m.destino,
          m.responsavel,
          m.observacao,
        ),
    );
    return Object.assign(Object.create(Equipamento.prototype) as Equipamento, dados, {
      historicoMovimentacao: historico,
    });
  }

  criarEquipamento(dados: DadosEquipamento, usuarioResponsavel: string): Equipamento {
    const lote = this.repositorio.carregarEntidade("lotes", dados.loteId);
    if (!lote) throw new Error("O lote informado não existe.");
    if (!Object.values(TipoEquipamento).includes(dados.tipo))
      throw new Error("Tipo de equipamento inválido.");
    if (!Object.values(EstadoFisico).includes(dados.estadoFisico))
      throw new Error("Estado físico inválido.");
    if (!dados.marca?.trim() || !dados.modelo?.trim())
      throw new Error("Marca e modelo são obrigatórios.");
    if (
      !Number.isInteger(dados.anoFabricacao) ||
      dados.anoFabricacao < 1970 ||
      dados.anoFabricacao > new Date().getFullYear()
    )
      throw new Error("Ano de fabricação inválido.");
    if (
      !Number.isFinite(dados.pesoQuilogramas) ||
      dados.pesoQuilogramas < 0 ||
      !Number.isFinite(dados.precoMercado) ||
      dados.precoMercado < 0
    )
      throw new Error("Peso ou preço inválido.");
    const sequencia = this.repositorio.listarEntidades("equipamentos").length + 1;
    const codigoBarrasInterno = this.gerarCodigoBarras(dados.tipo, sequencia);
    if (
      this.repositorio
        .listarEntidades("equipamentos")
        .some((item: any) => item.codigoBarrasInterno === codigoBarrasInterno)
    ) {
      throw new Error("O código de barras gerado já está em uso.");
    }
    const equipamento = new Equipamento(
      randomUUID(),
      codigoBarrasInterno,
      dados.tipo,
      dados.marca.trim(),
      dados.modelo.trim(),
      dados.anoFabricacao,
      dados.estadoFisico,
      dados.pesoQuilogramas,
      dados.loteId,
      dados.precoMercado,
      StatusRastreamento.AGUARDANDO_TRIAGEM,
      [],
      codigoBarrasInterno,
    );
    const movimentacao = equipamento.registrarMovimentacao(
      "RECEBIDO",
      usuarioResponsavel,
      "Equipamento cadastrado no lote.",
    );
    lote.equipamentos = [...(lote.equipamentos ?? []), equipamento];
    this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
    this.repositorio.salvarEntidade("lotes", lote, usuarioResponsavel);
    this.repositorio.salvarEntidade("movimentacoes", movimentacao, usuarioResponsavel);
    return equipamento;
  }

  rastrearEquipamento(id: string): HistoricoCompleto {
    const equipamento = this.buscar(id);
    const movimentacoes = this.repositorio
      .listarEntidades("movimentacoes")
      .filter((item: any) => item.equipamentoId === id)
      .map(
        (m: any) =>
          new Movimentacao(
            m.id,
            m.equipamentoId,
            new Date(m.dataHora),
            m.origem,
            m.destino,
            m.responsavel,
            m.observacao,
          ),
      );
    const vistas = new Set(movimentacoes.map((item) => item.id));
    for (const item of equipamento.historicoMovimentacao)
      if (!vistas.has(item.id)) movimentacoes.push(item);
    movimentacoes.sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());
    return { equipamento, movimentacoes };
  }

  atualizarEstadoFisico(
    id: string,
    novoEstado: EstadoFisico,
    justificativa = "",
    usuarioResponsavel = "sistema",
  ): void {
    const equipamento = this.buscar(id);
    equipamento.atualizarEstadoFisico(novoEstado, justificativa);
    this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
  }

  atualizarStatus(
    id: string,
    novoStatus: StatusRastreamento,
    justificativa: string,
    usuarioResponsavel: string,
  ): Equipamento {
    const equipamento = this.buscar(id);
    equipamento.atualizarStatus(novoStatus, justificativa, usuarioResponsavel);
    const movimentacao =
      equipamento.historicoMovimentacao[equipamento.historicoMovimentacao.length - 1];
    this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
    this.repositorio.salvarEntidade("movimentacoes", movimentacao, usuarioResponsavel);
    return equipamento;
  }

  calcularDepreciacao(id: string, coeficienteAnual = 0.2): number {
    return this.buscar(id).calcularDepreciacao(coeficienteAnual);
  }

  registrarMovimentacao(
    id: string,
    destino: string,
    usuarioResponsavel: string,
    observacao = "",
  ): Movimentacao {
    const equipamento = this.buscar(id);
    const movimentacao = equipamento.registrarMovimentacao(destino, usuarioResponsavel, observacao);
    this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
    this.repositorio.salvarEntidade("movimentacoes", movimentacao, usuarioResponsavel);
    return movimentacao;
  }

  gerarCodigoBarras(tipo: TipoEquipamento, sequencia: number): string {
    if (!Number.isInteger(sequencia) || sequencia < 1)
      throw new Error("A sequência do código de barras deve ser um inteiro positivo.");
    return `GC-${tipo}-${String(sequencia).padStart(8, "0")}`;
  }
}
