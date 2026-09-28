import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { Credencial } from "./Credencial";
import { PapelUsuario } from "../enums/PapelUsuario";
import { CriptografiaArquivo } from "./CriptografiaArquivo";

export type ParametrosGlobais = { aliquotaImposto: number; coeficienteDepreciacao: number };
export type DadosMestre = {
  chaveMestra: string;
  administradorInicial: Credencial;
  parametros: ParametrosGlobais;
};
type ArquivoMestre = {
  versao: 1;
  chaveMestra: string;
  administradorCifrado: string;
  parametros?: ParametrosGlobais;
};

export class ConfiguracaoMestre {
  private readonly arquivo: string;
  private readonly criptografia = new CriptografiaArquivo();

  constructor(private readonly diretorio: string) {
    fs.mkdirSync(diretorio, { recursive: true });
    this.arquivo = path.join(diretorio, "greencode.master.json");
  }

  existe(): boolean {
    return fs.existsSync(this.arquivo);
  }

  private salvar(conteudo: ArquivoMestre): void {
    const temporario = `${this.arquivo}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporario, JSON.stringify(conteudo, null, 2), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      fs.renameSync(temporario, this.arquivo);
    } catch (erro) {
      if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      throw erro;
    }
  }

  provisionar(usuario: string, senha: string): DadosMestre {
    if (this.existe()) throw new Error("A configuração mestre já foi criada.");
    if (!usuario.trim() || senha.length < 8)
      throw new Error("Informe usuário e senha com pelo menos 8 caracteres.");
    const chaveMestra = this.criptografia.gerarChave();
    const salt = randomBytes(16).toString("hex");
    const administradorInicial = new Credencial(
      usuario.trim(),
      Credencial.criarHash(senha, salt),
      salt,
      new Date(),
      PapelUsuario.ADMINISTRADOR,
    );
    const conteudo: ArquivoMestre = {
      versao: 1,
      chaveMestra,
      administradorCifrado: this.criptografia.cifrar(
        JSON.stringify(administradorInicial),
        chaveMestra,
      ),
      parametros: { aliquotaImposto: 0, coeficienteDepreciacao: 0.2 },
    };
    const temporario = `${this.arquivo}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporario, JSON.stringify(conteudo, null, 2), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      if (this.existe()) throw new Error("A configuração mestre já foi criada.");
      fs.renameSync(temporario, this.arquivo);
    } catch (erro) {
      if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      throw erro;
    }
    return { chaveMestra, administradorInicial, parametros: conteudo.parametros! };
  }

  carregar(): DadosMestre {
    if (!this.existe())
      throw new Error("Configuração mestre ausente; execute o provisionamento inicial.");
    let dados: ArquivoMestre;
    try {
      dados = JSON.parse(fs.readFileSync(this.arquivo, "utf8")) as ArquivoMestre;
    } catch {
      throw new Error("O arquivo mestre está inválido ou corrompido.");
    }
    if (
      dados.versao !== 1 ||
      typeof dados.chaveMestra !== "string" ||
      typeof dados.administradorCifrado !== "string"
    ) {
      throw new Error("O arquivo mestre não contém os campos esperados.");
    }
    try {
      const admin = JSON.parse(
        this.criptografia.decifrar(dados.administradorCifrado, dados.chaveMestra),
      );
      admin.ultimoAcesso = new Date(admin.ultimoAcesso);
      const parametros = dados.parametros ?? { aliquotaImposto: 0, coeficienteDepreciacao: 0.2 };
      if (
        !Number.isFinite(parametros.aliquotaImposto) ||
        parametros.aliquotaImposto < 0 ||
        parametros.aliquotaImposto > 1 ||
        !Number.isFinite(parametros.coeficienteDepreciacao) ||
        parametros.coeficienteDepreciacao < 0 ||
        parametros.coeficienteDepreciacao > 1
      ) {
        throw new Error("Parâmetros globais inválidos.");
      }
      return {
        chaveMestra: dados.chaveMestra,
        administradorInicial: new Credencial(
          admin.usuario,
          admin.hashsenha,
          admin.salt,
          admin.ultimoAcesso,
          admin.papel as PapelUsuario,
        ),
        parametros,
      };
    } catch {
      throw new Error(
        "Não foi possível abrir o administrador inicial; a chave ou o arquivo mestre foi alterado.",
      );
    }
  }

  atualizarParametros(atualizacao: Partial<ParametrosGlobais>): ParametrosGlobais {
    const dados = JSON.parse(fs.readFileSync(this.arquivo, "utf8")) as ArquivoMestre;
    const atuais = this.carregar().parametros;
    const novos = { ...atuais, ...atualizacao };
    if (
      !Number.isFinite(novos.aliquotaImposto) ||
      novos.aliquotaImposto < 0 ||
      novos.aliquotaImposto > 1 ||
      !Number.isFinite(novos.coeficienteDepreciacao) ||
      novos.coeficienteDepreciacao < 0 ||
      novos.coeficienteDepreciacao > 1
    ) {
      throw new Error("Alíquota e coeficiente devem estar entre 0 e 1.");
    }
    this.salvar({ ...dados, parametros: novos });
    return novos;
  }
}
