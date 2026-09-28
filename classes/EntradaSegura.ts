import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function perguntarTerminal(texto: string, oculto = false): Promise<string> {
  if (oculto && stdin.isTTY && typeof stdin.setRawMode === "function") {
    stdout.write(texto);
    return new Promise<string>((resolve, reject) => {
      const entrada = stdin as NodeJS.ReadStream & { setRawMode(mode: boolean): void };
      const rawAnterior = entrada.isRaw ?? false;
      let valor = "";
      const finalizar = (erro?: Error) => {
        entrada.off("data", receber);
        entrada.setRawMode(rawAnterior);
        entrada.pause();
        stdout.write("\n");
        if (erro) reject(erro);
        else resolve(valor);
      };
      const receber = (dados: Buffer | string) => {
        for (const caractere of String(dados)) {
          if (caractere === "\u0003") {
            finalizar(new Error("Entrada cancelada."));
            return;
          }
          if (caractere === "\r" || caractere === "\n") {
            finalizar();
            return;
          }
          if (caractere === "\u007f" || caractere === "\b") valor = valor.slice(0, -1);
          else if (caractere >= " ") valor += caractere;
        }
      };
      entrada.setRawMode(true);
      entrada.resume();
      entrada.on("data", receber);
    });
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(texto);
  } finally {
    rl.close();
  }
}
