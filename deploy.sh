#!/bin/bash
# Script de Deploy Seguro - Interjato Dashboard SGI
# Uso: ./deploy.sh [ambiente: dev|prod]

set -e  # Parar se houver erro

ENVIRONMENT=${1:-prod}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH=".data/sgi.db"
BACKUP_DIR=".data/backups"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}🚀 Deploy - Interjato Dashboard SGI${NC}"
echo -e "${YELLOW}Ambiente: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Timestamp: ${TIMESTAMP}${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# PASSO 1: Backup do Banco de Dados
echo -e "${GREEN}📦 PASSO 1: Criando Backup do Banco de Dados...${NC}"
mkdir -p "${BACKUP_DIR}"

if [ -f "${DB_PATH}" ]; then
    BACKUP_FILE="${BACKUP_DIR}/sgi.db.backup_${TIMESTAMP}.db"
    cp "${DB_PATH}" "${BACKUP_FILE}"
    echo -e "${GREEN}✅ Backup criado: ${BACKUP_FILE}${NC}"
    
    # Manter apenas os últimos 10 backups
    echo -e "${YELLOW}🧹 Limpando backups antigos (mantendo últimos 10)...${NC}"
    ls -t "${BACKUP_DIR}"/sgi.db.backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm
    echo -e "${GREEN}✅ Backups antigos removidos${NC}"
else
    echo -e "${YELLOW}⚠️  Banco de dados não encontrado em ${DB_PATH}${NC}"
fi

echo ""

# PASSO 2: Parar servidor em produção
if [ "${ENVIRONMENT}" = "prod" ]; then
    echo -e "${GREEN}⏹️  PASSO 2: Parando servidor em produção...${NC}"
    
    if command -v pm2 &> /dev/null; then
        pm2 stop interjato-dashboard 2>/dev/null || true
        echo -e "${GREEN}✅ Servidor PM2 parado${NC}"
    elif command -v systemctl &> /dev/null; then
        sudo systemctl stop interjato-dashboard 2>/dev/null || true
        echo -e "${GREEN}✅ Servidor Systemd parado${NC}"
    fi
    echo ""
fi

# PASSO 3: Atualizar código
echo -e "${GREEN}📥 PASSO 3: Atualizando código do repositório...${NC}"
if git rev-parse --git-dir > /dev/null 2>&1; then
    git pull origin master || true
    echo -e "${GREEN}✅ Código atualizado${NC}"
else
    echo -e "${YELLOW}⚠️  Não é um repositório git${NC}"
fi

echo ""

# PASSO 4: Instalar dependências
echo -e "${GREEN}📚 PASSO 4: Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"

echo ""

# PASSO 5: Gerar Prisma Client
echo -e "${GREEN}🔧 PASSO 5: Gerando Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client gerado${NC}"

echo ""

# PASSO 6: Aplicar migrações de banco de dados
echo -e "${GREEN}🗄️  PASSO 6: Aplicando migrações de banco de dados...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✅ Migrações aplicadas${NC}"

echo ""

# PASSO 7: Verificar integridade de dados
echo -e "${GREEN}✔️  PASSO 7: Verificando integridade de dados...${NC}"
echo "Contagem de registros:"
sqlite3 "${DB_PATH}" << EOF
.mode column
SELECT 'Usuários:' as Tipo, COUNT(*) as Total FROM User UNION ALL
SELECT 'Documentos:' as Tipo, COUNT(*) as Total FROM Document UNION ALL
SELECT 'Logs de Auditoria:' as Tipo, COUNT(*) as Total FROM AuditLog UNION ALL
SELECT 'Não-Conformidades:' as Tipo, COUNT(*) as Total FROM NonConformity;
EOF
echo -e "${GREEN}✅ Integridade de dados verificada${NC}"

echo ""

# PASSO 8: Build do frontend
if [ "${ENVIRONMENT}" = "prod" ]; then
    echo -e "${GREEN}🏗️  PASSO 8: Compilando frontend...${NC}"
    npm run build
    echo -e "${GREEN}✅ Frontend compilado${NC}"
    echo ""
fi

# PASSO 9: Iniciar servidor
echo -e "${GREEN}🚀 PASSO 9: Iniciando servidor...${NC}"

if [ "${ENVIRONMENT}" = "prod" ]; then
    if command -v pm2 &> /dev/null; then
        pm2 start server/index.js --name "interjato-dashboard" --env production 2>/dev/null || \
        pm2 restart interjato-dashboard
        echo -e "${GREEN}✅ Servidor iniciado com PM2${NC}"
        sleep 2
        pm2 logs interjato-dashboard --lines 20
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start interjato-dashboard
        echo -e "${GREEN}✅ Servidor iniciado com Systemd${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Ambiente dev - servidor não iniciado automaticamente${NC}"
    echo -e "${YELLOW}Execute: npm run dev:all${NC}"
fi

echo ""

# PASSO 10: Testar saúde do servidor
if [ "${ENVIRONMENT}" = "prod" ]; then
    echo -e "${GREEN}🏥 PASSO 10: Testando saúde do servidor...${NC}"
    sleep 2
    
    HEALTH_CHECK=$(curl -s http://localhost:3001/api/health || echo '{"ok":false}')
    
    if echo "${HEALTH_CHECK}" | grep -q '"ok":true'; then
        echo -e "${GREEN}✅ Servidor respondendo corretamente${NC}"
        echo "Resposta: ${HEALTH_CHECK}"
    else
        echo -e "${RED}❌ Servidor não está respondendo!${NC}"
        echo "Reverta o backup:"
        echo "  cp ${BACKUP_FILE} ${DB_PATH}"
        exit 1
    fi
    echo ""
fi

# Resumo final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📊 Informações de Deploy:${NC}"
echo "  • Ambiente: ${ENVIRONMENT}"
echo "  • Timestamp: ${TIMESTAMP}"
echo "  • Backup: ${BACKUP_FILE:-Não aplicável}"
echo "  • Diretório: $(pwd)"
echo ""

if [ "${ENVIRONMENT}" = "prod" ]; then
    echo -e "${YELLOW}📝 Próximas ações:${NC}"
    echo "  1. Testar funcionalidades críticas no navegador"
    echo "  2. Verificar logs: pm2 logs interjato-dashboard"
    echo "  3. Monitorar performance nos primeiros 30 minutos"
    echo ""
    echo -e "${YELLOW}🆘 Se precisar fazer rollback:${NC}"
    echo "  1. Parar servidor: pm2 stop interjato-dashboard"
    echo "  2. Restaurar backup: cp ${BACKUP_FILE} ${DB_PATH}"
    echo "  3. Reverter código: git revert HEAD"
    echo "  4. Reinstalar: npm install && npx prisma generate"
    echo "  5. Iniciar: pm2 start interjato-dashboard"
fi

echo ""
