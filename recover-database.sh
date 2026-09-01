#!/bin/bash
# Script para Recuperar Banco de Dados Corrompido
# Uso: ./recover-database.sh

set -e

echo "🔧 Iniciando Recuperação do Banco de Dados..."
echo ""

# 1. Parar servidor
echo "⏹️  Parando servidor..."
pm2 stop interjato-dashboard 2>/dev/null || true
sleep 2

# 2. Fazer backup
echo "📦 Fazendo backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE=".data/sgi.db.backup_corrupted_${TIMESTAMP}.db"
if [ -f ".data/sgi.db" ]; then
    cp .data/sgi.db "$BACKUP_FILE"
    echo "✅ Backup salvo: $BACKUP_FILE"
fi

# 3. Deletar banco corrompido
echo "🗑️  Removendo banco corrompido..."
rm -f .data/sgi.db .data/sgi.db-shm .data/sgi.db-wal
echo "✅ Banco removido"

# 4. Limpar prisma
echo "🧹 Limpando geração Prisma..."
rm -rf node_modules/.prisma
echo "✅ Cache Prisma limpo"

# 5. Regenerar Prisma Client
echo "🔧 Gerando Prisma Client..."
npx prisma generate
echo "✅ Prisma Client gerado"

# 6. Aplicar migrações (vai criar novo banco)
echo "🗄️  Aplicando migrações..."
npx prisma migrate deploy
echo "✅ Migrações aplicadas"

# 7. Inicializar admin
echo "👤 Criando usuário administrador..."
node init-admin.js
echo "✅ Admin criado"

# 8. Verificar integridade
echo "✔️  Verificando integridade..."
sqlite3 .data/sgi.db << EOF
SELECT 'Usuários:' as Tipo, COUNT(*) as Total FROM User UNION ALL
SELECT 'Documentos:' as Tipo, COUNT(*) as Total FROM Document UNION ALL
SELECT 'Logs de Auditoria:' as Tipo, COUNT(*) as Total FROM AuditLog UNION ALL
SELECT 'Não-Conformidades:' as Tipo, COUNT(*) as Total FROM NonConformity;
EOF
echo "✅ Integridade verificada"

# 9. Reiniciar servidor
echo ""
echo "🚀 Reiniciando servidor..."
pm2 restart interjato-dashboard
sleep 3

# 10. Testar saúde
echo "🏥 Testando saúde..."
if curl -s http://localhost:3001/api/health | grep -q '"ok":true'; then
    echo "✅ Servidor respondendo corretamente!"
else
    echo "⚠️  Servidor ainda pode estar inicializando, aguarde..."
fi

echo ""
echo "========================================="
echo "✅ RECUPERAÇÃO CONCLUÍDA!"
echo "========================================="
echo ""
echo "📝 Credenciais Padrão:"
echo "   Usuário: admin"
echo "   Senha: admin123"
echo ""
echo "🔗 Acessar em: http://seu-ip:3001/"
echo ""
echo "Backup da base corrompida em: $BACKUP_FILE"
echo ""
