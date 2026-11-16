// Envio de e-mails da API (código de nova senha e link para o responsável).
export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

export interface Correio {
  enviar(email: Email): Promise<void>;
}
