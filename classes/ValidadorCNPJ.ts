import { Validador } from "./Validador";

export class ValidadorCNPJ extends Validador {
  validar(cnpj: string): boolean {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14 || /^([0-9])\1{13}$/.test(digits)) return false;
    const check = (base: string, weights: number[]): number => {
      const remainder =
        base.split("").reduce((sum, digit, i) => sum + Number(digit) * weights[i], 0) % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = check(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = check(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits.endsWith(`${first}${second}`);
  }
  obterMensagem(): string {
    return "CNPJ inválido.";
  }
}

/** Alias mantido para não quebrar o import que já existe no projeto. */
export { ValidadorCNPJ as VallidadorCNPJ };
