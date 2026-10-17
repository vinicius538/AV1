import { RepositorioArquivo } from "./RepositorioArquivo";
import { VallidadorCNPJ } from "./ValidadorCNPJ";
import { Organizacao } from "./Organizacao";
import { Contrato } from "./Contrato";

export class servicoOrganizacao {
  constructor(
    public repositorio: RepositorioArquivo,
    public validadorCNPJ: VallidadorCNPJ,
  ) {}

  cadastrarOrganizacao(dados: any, usuarioResponsavel = "sistema"): Organizacao {
    if (!this.validadorCNPJ.validar(String(dados.cnpj ?? ""))) throw new Error("CNPJ inválido.");
    const existentes = this.repositorio.listarEntidades("organizacoes");
    if (
      existentes.some(
        (item: any) =>
          String(item.cnpj).replace(/\D/g, "") === String(dados.cnpj).replace(/\D/g, ""),
      )
    )
      throw new Error("Já existe uma organização com esse CNPJ.");
    const id = dados.id ?? `ORG-${Date.now()}`;
    const dataCadastro = new Date(dados.dataCadastro ?? Date.now());
    const contrato =
      dados.contratoVigente instanceof Contrato
        ? dados.contratoVigente
        : new Contrato(
            dados.contratoVigente?.id ?? `CTR-${Date.now()}`,
            id,
            dataCadastro,
            dados.contratoVigente?.clausulas ?? [],
            dados.contratoVigente?.valorMensal ?? 0,
            dados.contratoVigente?.renovacaoAutomatica ?? false,
          );
    const organizacao = new Organizacao(
      id,
      dados.razaoSocial,
      String(dados.cnpj),
      dados.inscricaoEstadual ?? "",
      dados.enderecoCompleto,
      dados.telefone ?? "",
      dados.email,
      dataCadastro,
      dados.ativo ?? true,
      contrato,
    );
    this.repositorio.salvarEntidade("organizacoes", organizacao, usuarioResponsavel);
    return organizacao;
  }

  buscarOrganizacao(id: string): Organizacao | null {
    return this.repositorio.carregarEntidade("organizacoes", id);
  }

  listarOrganizacoesAtivas(): Organizacao[] {
    return this.repositorio
      .listarEntidades("organizacoes")
      .filter((item: Organizacao) => item.ativo);
  }

  renovarContrato(
    organizacaoid: string,
    novoVencimento: Date,
    usuarioResponsavel = "sistema",
  ): Contrato {
    const organizacao = this.buscarOrganizacao(organizacaoid);
    if (!organizacao) throw new Error("Organização não encontrada.");
    const registro = organizacao.contratoVigente as any;
    const contrato =
      registro instanceof Contrato
        ? registro
        : Object.assign(
            new Contrato(
              registro.id,
              organizacao.id,
              new Date(registro.dataAssinatura),
              registro.clausulas,
              registro.valorMensal,
              registro.renovacaoAutomatica,
            ),
            { dataVencimento: new Date(registro.dataVencimento) },
          );
    contrato.renovar(novoVencimento);
    organizacao.contratoVigente = contrato;
    this.repositorio.salvarEntidade("organizacoes", organizacao, usuarioResponsavel);
    return contrato;
  }
}

export { servicoOrganizacao as ServicoOrganizacao };
