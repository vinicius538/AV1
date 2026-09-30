import * as path from "node:path";
import { stdout } from "node:process";
import { PapelUsuario } from "./enums/PapelUsuario";
import { CLIinterface } from "./classes/CLIinterface";
import { ConfiguracaoMestre } from "./classes/ConfiguracaoMestre";
import { Credencial } from "./classes/Credencial";
import { RepositorioArquivo } from "./classes/RepositorioArquivo";
import { ServicoAutenticacao } from "./classes/ServicoAutenticacao";
import { ServicoEquipamento } from "./classes/ServicoEquipamento";
import { ServicoLote } from "./classes/ServicoLote";
import { servicoOrganizacao } from "./classes/servicoOrganizacao";
import { ServicoRelatorio } from "./classes/ServicoRelatorio";
import { Sessao } from "./classes/Sessao";
import { VallidadorCNPJ } from "./classes/ValidadorCNPJ";
import { perguntarTerminal } from "./classes/EntradaSegura";

export type AppContext = {
  configuracao: ConfiguracaoMestre;
  repositorio: RepositorioArquivo;
  autenticacao: ServicoAutenticacao;
  organizacao: servicoOrganizacao;
  lote: ServicoLote;
  equipamento: ServicoEquipamento;
  relatorio: ServicoRelatorio;
};
export type Prompt = (texto: string, oculto?: boolean) => Promise<string>;

export function createApplication(diretorioDados: string): AppContext {
  const configuracao = new ConfiguracaoMestre(diretorioDados);
  const mestre = configuracao.carregar();
  const repositorio = new RepositorioArquivo(diretorioDados, mestre.chaveMestra);
  const credenciais = repositorio
    .listarEntidades("credenciais")
    .map(
      (item: any) =>
        new Credencial(
          item.usuario,
          item.hashsenha,
          item.salt,
          new Date(item.ultimoAcesso),
          item.papel as PapelUsuario,
        ),
    );
  if (!credenciais.some((item) => item.usuario === mestre.administradorInicial.usuario)) {
    credenciais.push(mestre.administradorInicial);
    repositorio.salvarEntidade(
      "credenciais",
      mestre.administradorInicial,
      "provisionamento-inicial",
    );
  }
  const autenticacao = new ServicoAutenticacao(credenciais, [], repositorio);
  return {
    configuracao,
    repositorio,
    autenticacao,
    organizacao: new servicoOrganizacao(repositorio, new VallidadorCNPJ()),
    lote: new ServicoLote(repositorio),
    equipamento: new ServicoEquipamento(repositorio),
    relatorio: new ServicoRelatorio(repositorio),
  };
}

export async function iniciar(
  diretorioDados: string,
  perguntar: Prompt = perguntarTerminal,
): Promise<void> {
  const configuracao = new ConfiguracaoMestre(diretorioDados);
  if (!configuracao.existe()) {
    stdout.write("Provisionamento inicial do GreenCode\n");
    const usuario = (await perguntar("Usuário administrador: ")).trim();
    const senha = await perguntar("Senha (mínimo 8 caracteres): ", true);
    const confirmacao = await perguntar("Confirme a senha: ", true);
    if (senha !== confirmacao) throw new Error("As senhas não coincidem.");
    configuracao.provisionar(usuario, senha);
    stdout.write("Administrador inicial e chave mestra criados.\n");
  }

  const app = createApplication(diretorioDados);
  while (true) {
    let sessao: Sessao | undefined;
    while (!sessao) {
      const usuario = (await perguntar("Usuário: ")).trim();
      const senha = await perguntar("Senha: ", true);
      try {
        sessao = app.autenticacao.logar(usuario, senha);
      } catch (erro) {
        stdout.write(`[ERRO] ${erro instanceof Error ? erro.message : String(erro)}\n`);
      }
    }
    stdout.write(
      `Autenticado como ${sessao.usuario} (${sessao.papel}). Digite 'ajuda' para ver os comandos.\n`,
    );
    const cli = new CLIinterface(
      app.autenticacao,
      app.organizacao,
      app.lote,
      app.equipamento,
      app.relatorio,
      sessao,
      app.configuracao,
    );
    const acao = await cli.iniciarLoop();
    if (acao === "sair") return;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    stdout.write("Uso: npm start [-- --data-dir CAMINHO]\n");
    return;
  }
  const indice = args.indexOf("--data-dir");
  const diretorioDados = path.resolve(
    indice >= 0 ? args[indice + 1] : (process.env.GREENCODE_DATA_DIR ?? "data"),
  );
  await iniciar(diretorioDados);
}

if (require.main === module) {
  main().catch((erro: unknown) => {
    console.error(`[FATAL] ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}


/*
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠞⢳⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡔⠋⠀⢰⠎⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⢆⣤⡞⠃⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⢠⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣀⣾⢳⠀⠀⠀⠀⢸⢠⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣀⡤⠴⠊⠉⠀⠀⠈⠳⡀⠀⠀⠘⢎⠢⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀
⠳⣄⠀⠀⡠⡤⡀⠀⠘⣇⡀⠀⠀⠀⠉⠓⠒⠺⠭⢵⣦⡀⠀⠀⠀
⠀⢹⡆⠀⢷⡇⠁⠀⠀⣸⠇⠀⠀⠀⠀⠀⢠⢤⠀⠀⠘⢷⣆⡀⠀
⠀⠀⠘⠒⢤⡄⠖⢾⣭⣤⣄⠀⡔⢢⠀⡀⠎⣸⠀⠀⠀⠀⠹⣿⡀
⠀⠀⢀⡤⠜⠃⠀⠀⠘⠛⣿⢸⠀⡼⢠⠃⣤⡟⠀⠀⠀⠀⠀⣿⡇
⠀⠀⠸⠶⠖⢏⠀⠀⢀⡤⠤⠇⣴⠏⡾⢱⡏⠁⠀⠀⠀⠀⢠⣿⠃
⠀⠀⠀⠀⠀⠈⣇⡀⠿⠀⠀⠀⡽⣰⢶⡼⠇⠀⠀⠀⠀⣠⣿⠟⠀
⠀⠀⠀⠀⠀⠀⠈⠳⢤⣀⡶⠤⣷⣅⡀⠀⠀⠀⣀⡠⢔⠕⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠫⠿⠿⠿⠛⠋⠁⠀⠀⠀⠀

*/