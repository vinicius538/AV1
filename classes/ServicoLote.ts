import { Equipamento } from "./Equipamento";
import { RepositorioArquivo } from "./RepositorioArquivo";
import { Lote } from "./Lote NAO TA FEITO";
import { ValidadorDataEntrada } from "./ValidadorDataEntrada";
import { StatusLote } from "../enums/StatusLote";
import { randomUUID } from "node:crypto";
import { StatusRastreamento } from "../enums/StatusRastreamento";
import { Movimentacao } from "./Movimentacao";

export class ServicoLote {
  constructor(public repositorio: RepositorioArquivo) {}
  criarLote(dados: any, usuarioResponsavel = "sistema") {
    const dataEntrada = new Date(dados.dataEntrada ?? Date.now());
    if (!new ValidadorDataEntrada(dataEntrada).validar())
      throw new Error("A data de entrada deve estar entre hoje e os últimos 90 dias.");
    const organizacaoId = dados.organizacaoId ?? dados.organizacaoid;
    if (!organizacaoId || !this.repositorio.carregarEntidade("organizacoes", organizacaoId))
      throw new Error("A organização informada não existe.");
    const lote = new Lote(
      dados.id ?? `LOT-${Date.now()}`,
      dataEntrada,
      organizacaoId,
      dados.notaFiscal ?? "",
      dados.transportadora ?? "",
      [],
      dados.statusProcessamento,
      dados.observacoes ?? "",
    );
    this.repositorio.salvarEntidade("lotes", lote, usuarioResponsavel);
    return lote;
  }
  adicionarEquipamento(loteId: string, equipamento: Equipamento, usuarioResponsavel = "sistema") {
    const lote = this.repositorio.carregarEntidade("lotes", loteId);
    if (!lote) throw new Error("Lote não encontrado.");
    const equipamentos: Equipamento[] = lote.equipamentos ?? [];
    if (equipamentos.some((item) => item.id === equipamento.id))
      throw new Error("Equipamento já está no lote.");
    equipamentos.push(equipamento);
    equipamento.loteId = lote.id;
    lote.equipamentos = equipamentos;
    if (lote.statusProcessamento === StatusLote.RECEBIDO)
      lote.statusProcessamento = StatusLote.EM_TRIAGEM;
    this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
    this.repositorio.salvarEntidade("lotes", lote, usuarioResponsavel);
    return lote;
  }
  processarTriagem(loteId: string, usuarioResponsavel = "sistema") {
    const lote = this.repositorio.carregarEntidade("lotes", loteId);
    if (!lote) throw new Error("Lote não encontrado.");
    if (!lote.equipamentos?.length)
      throw new Error("Não é possível concluir a triagem de um lote vazio.");
    lote.equipamentos.forEach((equipamento: Equipamento) => {
      equipamento.triagemCompleta = true;
      equipamento.statusRastreamento = StatusRastreamento.AGUARDANDO_DESMONTE;
      const anterior =
        equipamento.historicoMovimentacao[equipamento.historicoMovimentacao.length - 1]?.destino ??
        "EM_TRIAGEM";
      const movimentacao = new Movimentacao(
        randomUUID(),
        equipamento.id,
        new Date(),
        anterior,
        StatusRastreamento.AGUARDANDO_DESMONTE,
        usuarioResponsavel,
        "Triagem concluída",
      );
      equipamento.historicoMovimentacao.push(movimentacao);
      this.repositorio.salvarEntidade("equipamentos", equipamento, usuarioResponsavel);
      this.repositorio.salvarEntidade("movimentacoes", movimentacao, usuarioResponsavel);
    });
    lote.statusProcessamento = StatusLote.TRIAGEM_CONCLUIDA;
    this.repositorio.salvarEntidade("lotes", lote, usuarioResponsavel);
    return lote;
  }
  consultarLotePorPeriodo(dataInicio: Date, dataFim: Date) {
    if (dataFim < dataInicio) throw new Error("O fim do período deve ser posterior ao início.");
    return this.repositorio.listarEntidades("lotes").filter((lote: Lote) => {
      const data = new Date(lote.dataEntrada);
      return data >= dataInicio && data <= dataFim;
    });
  }
}
