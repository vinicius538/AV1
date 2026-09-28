import { Validador } from "./Validador";

export class ValidadorDataEntrada extends Validador {
  constructor(public data: Date) {
    super();
  }

  validar(valor: Date = this.data): boolean {
    if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    limite.setHours(0, 0, 0, 0);
    return valor <= hoje && valor >= limite;
  }

  obterMensagem(): string {
    return "A data deve estar entre hoje e os últimos 90 dias.";
  }
}
