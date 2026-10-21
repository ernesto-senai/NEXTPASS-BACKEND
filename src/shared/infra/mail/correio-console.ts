import type { Correio } from "../../domain/correio.ts";

// Enquanto o projeto não tem um serviço de e-mail (ex.: SMTP), o e-mail
// aparece no terminal da API: dá para copiar o link e abrir no app. Para
// enviar de verdade, troque por uma implementação da mesma interface.
export function criarCorreioConsole(): Correio {
  return {
    enviar: async ({ para, assunto, texto }) => {
      console.info(`\n✉️  E-mail para ${para}\nAssunto: ${assunto}\n\n${texto}\n`);
    },
  };
}
