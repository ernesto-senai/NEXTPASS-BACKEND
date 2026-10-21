// Cria a conta de administrador: ADMIN não se cadastra pelo app (Quadro 2).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Defina DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD no .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

try {
  // Rodar de novo atualiza a senha para a do .env.
  const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: { senhaHash },
    create: {
      nome: "Administrador NextPass",
      email: ADMIN_EMAIL,
      senhaHash,
      tipo: "ADMIN",
      termosAceitosEm: new Date(),
    },
  });
  console.log(`Administrador pronto: ${ADMIN_EMAIL}`);
} finally {
  await prisma.$disconnect();
}
