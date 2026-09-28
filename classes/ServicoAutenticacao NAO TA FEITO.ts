import { randomBytes } from "node:crypto";
import { PapelUsuario } from "../enums/PapelUsuario";
import { Credencial } from "./Credencial";
import { Sessao } from "./Sessao";
import { Autenticavel } from "./Autenticavel";
import { RepositorioArquivo } from "./RepositorioArquivo";

export class ServicoAutenticacao implements Autenticavel {
  constructor(
    public credenciais: Credencial[],
    public sessoesAtivas: Sessao[] = [],
    private repositorio?: RepositorioArquivo,
  ) {}

  private persistirCredenciais(usuarioResponsavel: string): void {
    for (const credencial of this.credenciais)
      this.repositorio?.salvarEntidade("credenciais", credencial, usuarioResponsavel);
  }

  autenticar(usuario: string, senha: string): boolean {
    try {
      this.logar(usuario, senha);
      return true;
    } catch {
      return false;
    }
  }

  logar(usuario: string, senha: string): Sessao {
    const credencial = this.credenciais.find((item) => item.usuario === usuario);
    if (!credencial || !credencial.verificarSenha(senha))
      throw new Error("Usuário ou senha inválidos.");
    credencial.atualizarUltimoAcesso();
    this.persistirCredenciais(usuario);
    const sessao = new Sessao(
      randomBytes(32).toString("hex"),
      usuario,
      credencial.papel as PapelUsuario,
      new Date(),
      new Date(Date.now() + 30 * 60 * 1000),
    );
    this.sessoesAtivas = this.sessoesAtivas.filter((item) => item.isValida());
    this.sessoesAtivas.push(sessao);
    return sessao;
  }

  logout(token: string): void {
    this.encerrarSessao(token);
  }

  validarToken(token: string): boolean {
    return this.validarSessao(token) !== null;
  }

  alterarSenha(
    usuario: string,
    senhaAntiga: string,
    senhaNova: string,
    usuarioResponsavel = usuario,
  ): boolean {
    const credencial = this.credenciais.find((item) => item.usuario === usuario);
    if (!credencial || !credencial.verificarSenha(senhaAntiga)) return false;
    const novoSalt = randomBytes(16).toString("hex");
    const novaCredencial = new Credencial(
      usuario,
      Credencial.criarHash(senhaNova, novoSalt),
      novoSalt,
      new Date(),
      credencial.papel,
    );
    this.credenciais[this.credenciais.indexOf(credencial)] = novaCredencial;
    this.persistirCredenciais(usuarioResponsavel);
    return true;
  }

  adicionarUsuario(
    usuario: string,
    senha: string,
    papel: PapelUsuario,
    responsavel: string,
  ): Credencial {
    if (this.credenciais.some((item) => item.usuario === usuario))
      throw new Error("Esse usuário já existe.");
    if (!usuario.trim() || senha.length < 8)
      throw new Error("Informe usuário e senha com pelo menos 8 caracteres.");
    const salt = randomBytes(16).toString("hex");
    const credencial = new Credencial(
      usuario.trim(),
      Credencial.criarHash(senha, salt),
      salt,
      new Date(),
      papel,
    );
    this.credenciais.push(credencial);
    this.persistirCredenciais(responsavel);
    return credencial;
  }

  renovarToken(): string {
    const sessao = [...this.sessoesAtivas].reverse().find((item) => item.isValida());
    if (!sessao) throw new Error("Não há sessão ativa para renovar.");
    sessao.renovar();
    return sessao.token;
  }

  validarSessao(token: string): Sessao | null {
    const sessao = this.sessoesAtivas.find((item) => item.token === token && item.isValida());
    if (!sessao) {
      this.sessoesAtivas = this.sessoesAtivas.filter((item) => item.isValida());
      return null;
    }
    sessao.renovar();
    return sessao;
  }

  encerrarSessao(token: string): boolean {
    const quantidade = this.sessoesAtivas.length;
    this.sessoesAtivas = this.sessoesAtivas.filter((item) => item.token !== token);
    return quantidade !== this.sessoesAtivas.length;
  }

  provisionarAdministrador(usuario: string, senha: string): Credencial {
    if (!usuario.trim() || senha.length < 8)
      throw new Error("Informe usuário e senha de pelo menos 8 caracteres.");
    if (this.credenciais.length > 0)
      throw new Error("O administrador inicial já foi provisionado.");
    const salt = randomBytes(16).toString("hex");
    const credencial = new Credencial(
      usuario,
      Credencial.criarHash(senha, salt),
      salt,
      new Date(),
      PapelUsuario.ADMINISTRADOR,
    );
    this.credenciais.push(credencial);
    this.persistirCredenciais(usuario);
    return credencial;
  }
}
