import { StatusLote } from "../enums/StatusLote";
import { Equipamento } from "./Equipamento";

export class Lote {
  constructor(
    public id: string,
    public dataEntrada: Date,
    public organizacaoId: string,
    public notaFiscal: string,
    public transportadora: string,
    public equipamentos: Equipamento[],
    public statusProcessamento: StatusLote = StatusLote.RECEBIDO,
    public observacoes = "",
  ) {
    if (!id.trim() || !organizacaoId.trim()) throw new Error("ID e organização são obrigatórios.");
    if (!(dataEntrada instanceof Date) || Number.isNaN(dataEntrada.getTime()))
      throw new Error("Data de entrada inválida.");
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    limite.setHours(0, 0, 0, 0);
    if (dataEntrada > hoje || dataEntrada < limite)
      throw new Error("A data do lote deve estar entre hoje e os últimos 90 dias.");
  }

  adicionarEquipamento(equipamento: Equipamento): void {
    if (this.equipamentos.some((item) => item.id === equipamento.id))
      throw new Error("Equipamento já pertence ao lote.");
    this.equipamentos.push(equipamento);
    if (this.statusProcessamento === StatusLote.RECEBIDO)
      this.statusProcessamento = StatusLote.EM_TRIAGEM;
  }

  removerEquipamento(equipid: string): boolean {
    const index = this.equipamentos.findIndex((item) => item.id === equipid);
    if (index < 0) return false;
    this.equipamentos.splice(index, 1);
    return true;
  }

  calcularPesoTotal(): number {
    return this.equipamentos.reduce((total, item) => total + item.pesoQuilogramas, 0);
  }

  concluirTriagem(): void {
    if (this.equipamentos.length === 0)
      throw new Error("Não é possível concluir a triagem de um lote vazio.");
    this.equipamentos.forEach((item) => item.concluirTriagem());
    this.statusProcessamento = StatusLote.TRIAGEM_CONCLUIDA;
  }

  gerarRelatorioTriagem(): string {
    const data = new Date(this.dataEntrada);
    return [
      `Lote: ${this.id}`,
      `Organização: ${this.organizacaoId}`,
      `Entrada: ${data.toISOString()}`,
      `Status: ${this.statusProcessamento}`,
      `Equipamentos: ${this.equipamentos.length}`,
      `Peso total: ${this.calcularPesoTotal()} kg`,
    ].join("\n");
  }
}
