import { z } from "zod";

export const emailSchema = z
  .string("Informe o e-mail.")
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido."));

// RNF-06: no mínimo 8 caracteres. O bcrypt só considera os primeiros 72 bytes.
export const senhaSchema = z
  .string("Informe a senha.")
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .refine((senha) => Buffer.byteLength(senha) <= 72, "A senha está longa demais.");

// RNF-15: aceita "+55 (11) 91234-5678" ou só os dígitos e guarda como +5511912345678.
export const telefoneSchema = z
  .string("Informe o telefone.")
  .transform((valor) => valor.replace(/\D/g, ""))
  .transform((digitos) => (digitos.length <= 11 ? `55${digitos}` : digitos))
  .pipe(z.string().regex(/^55\d{10,11}$/, "Informe um telefone válido com DDD."))
  .transform((digitos) => `+${digitos}`);
