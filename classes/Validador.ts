export abstract class Validador {
  abstract validar(objeto: any): boolean;
  abstract obterMensagem(): string;
}
