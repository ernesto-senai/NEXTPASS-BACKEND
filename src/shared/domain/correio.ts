// Envio de e-mails da API (link de nova senha, convite ao responsável).
export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

export interface Correio {
  enviar(email: Email): Promise<void>;
}
