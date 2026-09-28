import { RepositorioArquivo } from "./RepositorioArquivo";

export type PeriodoRelatorio = { inicio: Date; fim: Date };

export class ServicoRelatorio {
  constructor(private repositorio: RepositorioArquivo) {}

  gerarRelatorioPorOrganizacao(organizacaoId: string, periodo?: PeriodoRelatorio): string {
    const lotes = this.repositorio.listarEntidades("lotes").filter((lote: any) => {
      if (lote.organizacaoId !== organizacaoId && lote.organizacaoid !== organizacaoId)
        return false;
      if (!periodo) return true;
      const data = new Date(lote.dataEntrada);
      return data >= periodo.inicio && data <= periodo.fim;
    });
    return [
      `Relatório da organização ${organizacaoId}`,
      `Lotes encontrados: ${lotes.length}`,
      ...lotes.map(
        (lote: any) =>
          `- ${lote.id}: ${lote.statusProcessamento} (${(lote.equipamentos ?? []).length} equipamentos)`,
      ),
    ].join("\n");
  }

  gerarRelatorioPorStatus(): string {
    const equipamentos = this.repositorio.listarEntidades("equipamentos");
    const resumo = equipamentos.reduce((acc: Record<string, number>, item: any) => {
      acc[item.statusRastreamento] = (acc[item.statusRastreamento] ?? 0) + 1;
      return acc;
    }, {});
    return (
      Object.entries(resumo)
        .map(([status, quantidade]) => `${status}: ${quantidade}`)
        .join("\n") || "Nenhum equipamento cadastrado."
    );
  }

  gerarRelatorioFinanceiro(periodo?: PeriodoRelatorio, aliquotaImposto = 0): string {
    const organizacoes = this.repositorio.listarEntidades("organizacoes");
    const lotes = this.repositorio.listarEntidades("lotes").filter((lote: any) => {
      if (!periodo) return true;
      const data = new Date(lote.dataEntrada);
      return data >= periodo.inicio && data <= periodo.fim;
    });
    const receitaMensal = organizacoes.reduce(
      (total: number, org: any) => total + Number(org.contratoVigente?.valorMensal ?? 0),
      0,
    );
    if (!Number.isFinite(aliquotaImposto) || aliquotaImposto < 0 || aliquotaImposto > 1)
      throw new Error("Alíquota de imposto inválida.");
    const impostoEstimado = receitaMensal * aliquotaImposto;
    const pesoKg = lotes.reduce(
      (total: number, lote: any) =>
        total +
        (lote.equipamentos ?? []).reduce(
          (soma: number, equipamento: any) => soma + Number(equipamento.pesoQuilogramas ?? 0),
          0,
        ),
      0,
    );
    return [
      `Receita mensal contratual: R$ ${receitaMensal.toFixed(2)}`,
      `Imposto estimado: R$ ${impostoEstimado.toFixed(2)}`,
      `Peso recebido no período: ${pesoKg.toFixed(2)} kg`,
    ].join("\n");
  }
}
