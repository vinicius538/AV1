import * as fs from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PapelUsuario } from "../enums/PapelUsuario";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusRastreamento } from "../enums/StatusRastreamento";
import { TipoEquipamento } from "../enums/TipoEquipamento";
import { ServicoEquipamento } from "./ServicoEquipamento";
import { ServicoAutenticacao } from "./ServicoAutenticacao";
import { ServicoLote } from "./ServicoLote";
import { servicoOrganizacao } from "./servicoOrganizacao";
import { ServicoRelatorio } from "./ServicoRelatorio";
import { Sessao } from "./Sessao";
import { perguntarTerminal } from "./EntradaSegura";
import { ConfiguracaoMestre } from "./ConfiguracaoMestre";

type Perguntar = (texto: string) => Promise<string>;

export class CLIinterface {
  constructor(
    public autenticacao: ServicoAutenticacao,
    public organizacao: servicoOrganizacao,
    public lote: ServicoLote,
    public equipamento: ServicoEquipamento,
    public relatorio: ServicoRelatorio,
    public sessaoAtual: Sessao | null,
    public configuracao?: ConfiguracaoMestre,
  ) {}

  async iniciarLoop(): Promise<"logout" | "sair" | void> {
    const historyFile = path.join(process.cwd(), ".greencode_history");
    const novaInterface = () => {
      const interfaceReadline = createInterface({
        input: stdin,
        output: stdout,
        completer: (linha) => this.completar(linha),
      });
      const history = (interfaceReadline as typeof interfaceReadline & { history: string[] })
        .history;
      if (fs.existsSync(historyFile))
        history.push(
          ...fs.readFileSync(historyFile, "utf8").split(/\r?\n/).filter(Boolean).reverse(),
        );
      return interfaceReadline;
    };
    let rl = novaInterface();
    let resultado: "logout" | "sair" | void;
    try {
      while (true) {
        const entrada = await rl.question("greencode> ");
        fs.appendFileSync(historyFile, `${entrada}\n`, "utf8");
        try {
          const resposta = await this.processarComando(entrada, (texto) => rl.question(texto));
          if (resposta === "__SAIR__") {
            resultado = "sair";
            break;
          }
          if (resposta === "__LOGOUT__") {
            resultado = "logout";
            break;
          }
          if (resposta && typeof resposta === "object" && "acao" in resposta) {
            const comando = resposta as { acao: string; usuario?: string; papel?: PapelUsuario };
            rl.close();
            try {
              if (comando.acao === "criar-usuario") {
                const senha = await perguntarTerminal(
                  "Senha do novo usuário (mínimo 8 caracteres): ",
                  true,
                );
                this.autenticacao.adicionarUsuario(
                  comando.usuario!,
                  senha,
                  comando.papel!,
                  this.sessaoAtual?.usuario ?? "sistema",
                );
                stdout.write("Usuário criado.\n");
              } else if (comando.acao === "alterar-senha") {
                const atual = await perguntarTerminal("Senha atual: ", true);
                const nova = await perguntarTerminal("Nova senha (mínimo 8 caracteres): ", true);
                const confirmacao = await perguntarTerminal("Confirme a nova senha: ", true);
                if (nova !== confirmacao) throw new Error("As senhas não coincidem.");
                if (!this.autenticacao.alterarSenha(this.sessaoAtual?.usuario ?? "", atual, nova))
                  throw new Error("A senha atual está incorreta.");
                stdout.write("Senha atualizada; entre novamente com a nova senha.\n");
                this.autenticacao.logout(this.sessaoAtual!.token);
                resultado = "logout";
                break;
              }
            } catch (erro) {
              stdout.write(`[ERRO] ${erro instanceof Error ? erro.message : String(erro)}\n`);
            }
            rl = novaInterface();
            continue;
          }
          if (resposta !== undefined)
            stdout.write(
              `${typeof resposta === "string" ? resposta : JSON.stringify(resposta, null, 2)}\n`,
            );
        } catch (erro) {
          stdout.write(`[ERRO] ${erro instanceof Error ? erro.message : String(erro)}\n`);
        }
      }
    } finally {
      rl.close();
    }
    return resultado;
  }

  private completar(linha: string): [string[], string] {
    const opcoes = [
      "ajuda",
      "logout",
      "sair",
      "usuario listar",
      "usuario criar",
      "usuario senha",
      "configuracao ver",
      "configuracao atualizar",
      "organizacao listar",
      "organizacao cadastrar",
      "lote listar",
      "lote criar",
      "lote triagem",
      "equipamento criar",
      "equipamento rastrear",
      "equipamento movimentar",
      "equipamento estado",
      "equipamento status",
      "equipamento depreciacao",
      "relatorio status",
      "relatorio financeiro",
    ];
    return [opcoes.filter((opcao) => opcao.startsWith(linha)), linha];
  }

  async processarComando(entrada: string, perguntar: Perguntar = async () => ""): Promise<unknown> {
    const [acao, ...args] =
      entrada
        .trim()
        .match(/"[^\"]*"|'[^']*'|\S+/g)
        ?.map((token) => token.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2")) ?? [];
    if (!acao) return;
    if (acao === "sair" || acao === "exit") return "__SAIR__";
    if (acao === "ajuda" || acao === "menu") {
      if (this.sessaoAtual)
        this.sessaoAtual = this.autenticacao.validarSessao(this.sessaoAtual.token);
      if (!this.sessaoAtual) throw new Error("Autentique-se antes de executar comandos.");
      this.exibirMenuPorPapel(this.sessaoAtual.papel);
      return;
    }
    if (acao === "logout") {
      if (this.sessaoAtual) this.autenticacao.logout(this.sessaoAtual.token);
      return "__LOGOUT__";
    }
    if (!this.sessaoAtual?.isValida()) throw new Error("Autentique-se antes de executar comandos.");
    const sessao = this.autenticacao.validarSessao(this.sessaoAtual.token);
    if (!sessao) {
      this.sessaoAtual = null;
      throw new Error("A sessão expirou; autentique-se novamente.");
    }
    this.sessaoAtual = sessao;
    const papel = sessao.papel;
    const usuario = sessao.usuario;

    if (acao === "usuario" && args[0] === "listar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR]);
      return this.autenticacao.credenciais.map(({ usuario: nome, papel: role, ultimoAcesso }) => ({
        usuario: nome,
        papel: role,
        ultimoAcesso,
      }));
    }
    if (acao === "usuario" && args[0] === "criar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["usuario", "Nome do novo usuário: "],
          ["papel", `Papel (${Object.values(PapelUsuario).join(", ")}): `],
        ],
        perguntar,
      );
      return {
        acao: "criar-usuario",
        usuario: this.obrigatorio(op.usuario, "nome de usuário"),
        papel: this.enumValor(PapelUsuario, op.papel, "papel"),
      };
    }
    if (acao === "usuario" && args[0] === "senha") return { acao: "alterar-senha" };

    if (acao === "configuracao" && args[0] === "ver") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR]);
      return this.configuracao?.carregar().parametros ?? {};
    }
    if (acao === "configuracao" && args[0] === "atualizar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR]);
      if (!this.configuracao) throw new Error("Configuração mestre indisponível.");
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["aliquota", "Nova alíquota (deixe vazio para manter): ", false],
          ["depreciacao", "Novo coeficiente de depreciação (deixe vazio para manter): ", false],
        ],
        perguntar,
      );
      if (op.aliquota === undefined && op.depreciacao === undefined)
        throw new Error("Informe pelo menos um parâmetro para atualizar.");
      const alteracao: { aliquotaImposto?: number; coeficienteDepreciacao?: number } = {};
      if (op.aliquota !== undefined) alteracao.aliquotaImposto = Number(op.aliquota);
      if (op.depreciacao !== undefined) alteracao.coeficienteDepreciacao = Number(op.depreciacao);
      return this.configuracao.atualizarParametros(alteracao);
    }

    if (acao === "organizacao" && args[0] === "listar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]);
      return this.organizacao.listarOrganizacoesAtivas();
    }
    if (acao === "organizacao" && args[0] === "cadastrar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["razao", "Razão social: "],
          ["cnpj", "CNPJ: "],
          ["endereco", "Endereço completo: "],
          ["telefone", "Telefone (opcional): ", false],
          ["email", "E-mail: "],
          ["ie", "Inscrição estadual (opcional): ", false],
        ],
        perguntar,
      );
      return this.organizacao.cadastrarOrganizacao(
        {
          razaoSocial: op.razao,
          cnpj: op.cnpj,
          enderecoCompleto: op.endereco,
          telefone: op.telefone,
          email: op.email,
          inscricaoEstadual: op.ie,
        },
        usuario,
      );
    }
    if (acao === "lote" && args[0] === "listar") {
      this.exigirPapel(papel, [
        PapelUsuario.ADMINISTRADOR,
        PapelUsuario.GESTOR_ALMOXARIFADO,
        PapelUsuario.AUDITOR,
      ]);
      return this.lote.consultarLotePorPeriodo(new Date(0), new Date());
    }
    if (acao === "lote" && args[0] === "criar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["org", "ID da organização: "],
          ["nf", "Número da nota fiscal: "],
          ["transp", "Transportadora: "],
        ],
        perguntar,
      );
      return this.lote.criarLote(
        { organizacaoId: op.org, notaFiscal: op.nf, transportadora: op.transp },
        usuario,
      );
    }
    if (acao === "lote" && args[0] === "triagem") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const id = args[1] ?? (await perguntar("ID do lote para triagem: ")).trim();
      if (!id) throw new Error("Informe o identificador do lote.");
      return this.lote.processarTriagem(id, usuario);
    }
    if (acao === "equipamento" && args[0] === "criar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["tipo", `Tipo (${Object.values(TipoEquipamento).join(", ")}): `],
          ["marca", "Marca: "],
          ["modelo", "Modelo: "],
          ["ano", "Ano de fabricação: "],
          ["estado", `Estado físico (${Object.values(EstadoFisico).join(", ")}): `],
          ["peso", "Peso em quilogramas: "],
          ["lote", "ID do lote: "],
          ["preco", "Preço de mercado: "],
        ],
        perguntar,
      );
      return this.equipamento.criarEquipamento(
        {
          tipo: this.enumValor(TipoEquipamento, op.tipo, "tipo"),
          marca: this.obrigatorio(op.marca, "marca"),
          modelo: this.obrigatorio(op.modelo, "modelo"),
          anoFabricacao: Number(op.ano),
          estadoFisico: this.enumValor(EstadoFisico, op.estado, "estado"),
          pesoQuilogramas: Number(op.peso),
          loteId: this.obrigatorio(op.lote, "lote"),
          precoMercado: Number(op.preco),
        },
        usuario,
      );
    }
    if (acao === "equipamento" && args[0] === "rastrear") {
      this.exigirPapel(papel, [
        PapelUsuario.ADMINISTRADOR,
        PapelUsuario.GESTOR_ALMOXARIFADO,
        PapelUsuario.AUDITOR,
      ]);
      const id =
        args[1] ??
        this.lerOpcoes(args.slice(1)).id ??
        (await perguntar("ID do equipamento: ")).trim();
      return this.equipamento.rastrearEquipamento(this.obrigatorio(id, "ID do equipamento"));
    }
    if (acao === "equipamento" && args[0] === "movimentar") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["id", "ID do equipamento: "],
          ["destino", "Destino da movimentação: "],
          ["obs", "Observação (opcional): ", false],
        ],
        perguntar,
      );
      return this.equipamento.registrarMovimentacao(
        this.obrigatorio(op.id, "ID do equipamento"),
        this.obrigatorio(op.destino, "destino"),
        usuario,
        op.obs ?? "",
      );
    }
    if (acao === "equipamento" && args[0] === "estado") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["id", "ID do equipamento: "],
          ["estado", `Novo estado físico (${Object.values(EstadoFisico).join(", ")}): `],
          ["justificativa", "Justificativa (se necessária): ", false],
        ],
        perguntar,
      );
      this.equipamento.atualizarEstadoFisico(
        this.obrigatorio(op.id, "ID do equipamento"),
        this.enumValor(EstadoFisico, op.estado, "estado"),
        op.justificativa ?? "",
        usuario,
      );
      return "Estado físico atualizado.";
    }
    if (acao === "equipamento" && args[0] === "status") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [
          ["id", "ID do equipamento: "],
          ["status", `Novo status (${Object.values(StatusRastreamento).join(", ")}): `],
          ["justificativa", "Justificativa (opcional): ", false],
        ],
        perguntar,
      );
      return this.equipamento.atualizarStatus(
        this.obrigatorio(op.id, "ID do equipamento"),
        this.enumValor(StatusRastreamento, op.status, "status"),
        op.justificativa ?? "",
        usuario,
      );
    }
    if (acao === "equipamento" && args[0] === "depreciacao") {
      this.exigirPapel(papel, [
        PapelUsuario.ADMINISTRADOR,
        PapelUsuario.GESTOR_ALMOXARIFADO,
        PapelUsuario.AUDITOR,
      ]);
      const op = await this.completarOpcoes(
        this.lerOpcoes(args.slice(1)),
        [["id", "ID do equipamento: "]],
        perguntar,
      );
      const coeficiente = this.configuracao?.carregar().parametros.coeficienteDepreciacao ?? 0.2;
      return this.equipamento.calcularDepreciacao(
        this.obrigatorio(op.id, "ID do equipamento"),
        coeficiente,
      );
    }
    if (acao === "relatorio" && args[0] === "status") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR]);
      return this.relatorio.gerarRelatorioPorStatus();
    }
    if (acao === "relatorio" && args[0] === "financeiro") {
      this.exigirPapel(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR]);
      return this.relatorio.gerarRelatorioFinanceiro(
        undefined,
        this.configuracao?.carregar().parametros.aliquotaImposto ?? 0,
      );
    }
    throw new Error("Comando desconhecido ou indisponível para seu papel. Digite 'ajuda'.");
  }

  private obrigatorio(valor: string | undefined, nome: string): string {
    if (!valor?.trim()) throw new Error(`Informe ${nome}.`);
    return valor.trim();
  }

  private async completarOpcoes(
    opcoes: Record<string, string>,
    campos: Array<[string, string, boolean?]>,
    perguntar: Perguntar,
  ): Promise<Record<string, string>> {
    for (const [nome, pergunta, obrigatorio = true] of campos) {
      if (opcoes[nome] !== undefined) continue;

      const resposta = (await perguntar(pergunta)).trim();
      if (resposta) {
        opcoes[nome] = resposta;
      } else if (obrigatorio) {
        throw new Error(`O campo "${nome}" é obrigatório.`);
      }
    }

    return opcoes;
  }

  private exigirPapel(atual: PapelUsuario, permitidos: PapelUsuario[]): void {
    if (!permitidos.includes(atual))
      throw new Error("Seu papel não tem permissão para esse comando.");
  }

  private lerOpcoes(argumentos: string[]): Record<string, string> {
    const opcoes: Record<string, string> = {};
    for (let i = 0; i < argumentos.length; i++) {
      if (!argumentos[i].startsWith("--") || i + 1 >= argumentos.length)
        throw new Error(`Opção inválida: ${argumentos[i]}`);
      opcoes[argumentos[i].slice(2)] = argumentos[++i];
    }
    return opcoes;
  }

  private enumValor<T extends Record<string, string>>(
    valores: T,
    entrada: string,
    nome: string,
  ): T[keyof T] {
    if (!entrada || !Object.values(valores).includes(entrada))
      throw new Error(`Informe um ${nome} válido. Valores: ${Object.values(valores).join(", ")}`);
    return entrada as T[keyof T];
  }

  exibirMenuPorPapel(papel: PapelUsuario | undefined): void {
    const comum = ["ajuda", "logout", "sair"];
    const equipamento =
      "equipamento criar --tipo --marca --modelo --ano --estado --peso --lote --preco; equipamento movimentar --id --destino; equipamento rastrear <id>";
    const menus: Record<PapelUsuario, string[]> = {
      [PapelUsuario.ADMINISTRADOR]: [
        ...comum,
        "usuario listar/criar --usuario --papel; usuario senha",
        "configuracao ver/atualizar --aliquota --depreciacao",
        "organizacao listar/cadastrar",
        "lote listar/criar/triagem",
        equipamento,
        "equipamento estado/status/depreciacao",
        "relatorio status/financeiro",
      ],
      [PapelUsuario.OPERADOR_CADASTRO]: [...comum, "organizacao listar/cadastrar"],
      [PapelUsuario.GESTOR_ALMOXARIFADO]: [
        ...comum,
        "lote listar/criar/triagem",
        equipamento,
        "equipamento estado/status/depreciacao",
      ],
      [PapelUsuario.AUDITOR]: [
        ...comum,
        "lote listar",
        "equipamento rastrear <id>/depreciacao",
        "relatorio status/financeiro",
      ],
    };
    stdout.write(`${(papel ? menus[papel] : comum).join("\n")}\n`);
  }
}
