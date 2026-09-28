import { PapelUsuario } from "../enums/PapelUsuario";

export class Sessao {
  constructor(token: string, usuario: string, papel: PapelUsuario, criacao: Date, expiracao: Date) {
    this.token = token;
    this.usuario = usuario;
    this.papel = papel;
    this.criacao = criacao;
    this.expiracao = expiracao;
  }
  public token: string;
  public usuario: string;
  public papel: PapelUsuario;
  public criacao: Date;
  public expiracao: Date;
  isValida() {
    const agora = new Date();
    return agora >= this.criacao && agora < this.expiracao;
  }
  renovar() {
    if (!this.isValida()) throw new Error("A sessão expirou.");
    this.expiracao = new Date(Date.now() + 30 * 60 * 1000);
  }
}
