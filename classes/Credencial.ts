import { createHash, timingSafeEqual } from "node:crypto";
import { PapelUsuario } from "../enums/PapelUsuario";
export class Credencial {
  constructor(
    public usuario: string,
    private hashsenha: string,
    public salt: string,
    public ultimoAcesso: Date,
    public papel: PapelUsuario,
  ) {
    this.usuario = usuario;
    this.hashsenha = hashsenha;
    this.salt = salt;
    this.ultimoAcesso = ultimoAcesso;
    this.papel = papel;
  }

  verificarSenha(senhaPlana: string) {
    const candidato = createHash("sha256")
      .update(this.salt + senhaPlana, "utf8")
      .digest();
    let armazenado: Buffer;
    try {
      armazenado = Buffer.from(this.hashsenha, "hex");
    } catch {
      return false;
    }
    return armazenado.length === candidato.length && timingSafeEqual(armazenado, candidato);
  }
  atualizarUltimoAcesso() {
    this.ultimoAcesso = new Date();
  }

  static criarHash(senhaPlana: string, salt: string): string {
    if (senhaPlana.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
    return createHash("sha256")
      .update(salt + senhaPlana, "utf8")
      .digest("hex");
  }
}
