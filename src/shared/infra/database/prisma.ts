import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../../../config/env.ts";
import { PrismaClient } from "../../../generated/prisma/client.ts";
import { conexaoPostgres } from "./conexao.ts";

const adapter = new PrismaPg(conexaoPostgres(env.DATABASE_URL));

export const prisma = new PrismaClient({ adapter });
