import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetAdminPassword() {
    try {
        const newPassword = 'admin123';
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Verifica se o usuário admin existe
        let admin = await prisma.user.findUnique({ where: { username: 'admin' } });

        if (!admin) {
            // Se não existir, cria o usuário admin
            admin = await prisma.user.create({
                data: {
                    username: 'admin',
                    passwordHash,
                    name: 'Administrador',
                    role: 'admin',
                }
            });
            console.log('✓ Usuário admin criado com sucesso!');
        } else {
            // Se existir, atualiza a senha
            await prisma.user.update({
                where: { username: 'admin' },
                data: { passwordHash }
            });
            console.log('✓ Senha do usuário admin resetada com sucesso!');
        }

        console.log(`\nCredenciais de acesso:\nUsername: admin\nPassword: admin123`);
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao resetar senha:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminPassword();
