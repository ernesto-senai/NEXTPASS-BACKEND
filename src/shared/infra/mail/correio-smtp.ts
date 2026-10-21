import nodemailer from "nodemailer";
import type { Correio } from "../../domain/correio.ts";

export interface ConfigSmtp {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  // Ex.: "NextPass <nextpassofc@gmail.com>". Sem ele, usa o próprio usuário.
  remetente?: string | undefined;
}

// Envio de verdade por SMTP (ex.: Gmail com senha de app). A porta 465 usa
// conexão segura direta; as outras (587) sobem para TLS depois de conectar.
export function criarCorreioSmtp({ host, porta, usuario, senha, remetente }: ConfigSmtp): Correio {
  const transporte = nodemailer.createTransport({
    host,
    port: porta,
    secure: porta === 465,
    auth: { user: usuario, pass: senha },
  });

  return {
    enviar: async ({ para, assunto, texto }) => {
      await transporte.sendMail({
        from: remetente ?? usuario,
        to: para,
        subject: assunto,
        text: texto,
      });
    },
  };
}
