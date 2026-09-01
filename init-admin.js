#!/usr/bin/env node
/**
 * Script de Inicialização - Criar Admin se não existir
 * Uso: node init-admin.js
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verificando banco de dados...");

  // Verificar se já existe usuário admin
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existingAdmin) {
    console.log("✅ Usuário admin já existe no banco de dados");
    console.log(`   Nome: ${existingAdmin.name}`);
    console.log(`   Role: ${existingAdmin.role}`);
    return;
  }

  console.log("📝 Criando usuário admin padrão...");

  // Criar hash da senha
  const passwordHash = await bcrypt.hash("admin123", 10);

  // Criar usuário admin
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: passwordHash,
      name: "Administrador",
      role: "admin",
    },
  });

  console.log("✅ Usuário admin criado com sucesso!");
  console.log("");
  console.log("📋 Credenciais de Acesso:");
  console.log("   Usuário: admin");
  console.log("   Senha: admin123");
  console.log("");
  console.log("⚠️  IMPORTANTE:");
  console.log(
    "   1. Altere a senha logo após o primeiro login"
  );
  console.log(
    "   2. Crie outras contas de usuário conforme necessário"
  );
  console.log(
    "   3. Consulte REGRAS_DE_NEGOCIO.md para detalhes de perfis"
  );
}

main()
  .catch((error) => {
    console.error("❌ Erro ao inicializar admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
