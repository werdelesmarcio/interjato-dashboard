# ✅ Checklist Pré-Deploy em Produção

## 🔍 Verificações Pré-Deploy

Antes de fazer o deploy em produção, verifique todos os itens abaixo:

### 1. Ambiente de Desenvolvimento
- [ ] Todas as mudanças foram commitadas em git
- [ ] Não há arquivos não rastreados importantes (execute `git status`)
- [ ] Branch está atualizada (`git pull origin master`)
- [ ] Não há conflitos de merge pendentes

### 2. Testes Locais
- [ ] Aplicação roda sem erros em desenvolvimento (`npm run dev:all`)
- [ ] Frontend compila sem warnings (`npm run build`)
- [ ] Backend inicia sem erros (`npm run dev:api`)
- [ ] Todas as funcionalidades críticas foram testadas localmente

### 3. Banco de Dados
- [ ] Migrações foram criadas para novas mudanças (`prisma/migrations/` tem novos arquivos)
- [ ] Migrações funcionam localmente (`npx prisma migrate dev`)
- [ ] Schema está sincronizado com banco (`npx prisma db push`)
- [ ] Backup do banco de produção está seguro em local externo

### 4. Código
- [ ] Sem variáveis de ambiente hardcoded (use `.env`)
- [ ] Sem logs sensíveis com credenciais
- [ ] Sem comentários de debug deixados
- [ ] Código segue padrões de projeto

### 5. Dependências
- [ ] `package.json` está atualizado
- [ ] Não há vulnerabilidades críticas (`npm audit`)
- [ ] `node_modules` foi limpo (`rm -rf node_modules && npm install`)

### 6. Configuração de Servidor
- [ ] `.env` de produção está preparado com valores corretos
- [ ] `JWT_SECRET` é forte e seguro (gerado com `openssl rand -base64 32`)
- [ ] `DATABASE_URL` aponta para banco de produção
- [ ] `NODE_ENV=production` será usado

### 7. Segurança
- [ ] HTTPS/SSL está configurado
- [ ] Firewall permite apenas portas necessárias (22, 80, 443)
- [ ] Usuário Node.js tem permissões restritas
- [ ] Diretório `.data/` tem permissões corretas (755)

### 8. Monitoramento
- [ ] PM2 ou Systemd está configurado para auto-restart
- [ ] Logs estão configurados para rotação
- [ ] Sistema de alertas está pronto (Datadog, New Relic, etc.)
- [ ] Plano de rollback documentado e testado

### 9. Documentação
- [ ] `DEPLOYMENT_GUIDE.md` foi revisado
- [ ] Script de deploy (`deploy.sh` ou `deploy.ps1`) foi testado
- [ ] Senhas/tokens estão armazenados com segurança

### 10. Comunicação
- [ ] Time foi informado sobre o deploy
- [ ] Janela de manutenção foi agendada (se necessário)
- [ ] Plano de suporte está pronto
- [ ] Contatos de emergência estão disponíveis

---

## 🚀 Passo-a-Passo de Execução

### Se você está no Windows:

```powershell
# 1. Abrir PowerShell como Administrador
# 2. Navegar até pasta do projeto
cd C:\path\to\interjato-dashboard

# 3. Executar script de deploy (Produção)
.\deploy.ps1 -Environment "prod"

# 4. Ou em desenvolvimento
.\deploy.ps1 -Environment "dev"

# 5. Se quiser pular backup (NÃO RECOMENDADO)
.\deploy.ps1 -Environment "prod" -SkipBackup
```

### Se você está em Linux/Mac:

```bash
# 1. Navegue até pasta do projeto
cd /path/to/interjato-dashboard

# 2. Dar permissão de execução
chmod +x deploy.sh

# 3. Executar script de deploy (Produção)
./deploy.sh prod

# 4. Ou em desenvolvimento
./deploy.sh dev
```

---

## 📊 Matriz de Risco

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Perda de dados | Muito Baixo | Crítico | Backup antes de deploy |
| Servidor não inicia | Baixo | Alto | Testes locais extensivos |
| Migrações falham | Muito Baixo | Médio | Testar migrações localmente |
| Credenciais expostas | Baixo | Crítico | Usar `.env` e `.gitignore` |
| Performance degrada | Médio | Médio | Monitoramento em tempo real |
| Rollback necessário | Baixo | Médio | Backup e plano de reverter |

---

## 🆘 Plano de Contingência

### Cenário 1: Servidor não Inicia
```bash
# 1. Verificar logs
pm2 logs interjato-dashboard

# 2. Verificar porta 3001
lsof -i :3001

# 3. Parar processo se necessário
kill -9 $(lsof -t -i:3001)

# 4. Iniciar novamente
pm2 start server/index.js --name "interjato-dashboard"
```

### Cenário 2: Migrações Falharam
```bash
# 1. Restaurar backup
cp .data/sgi.db.backup_YYYYMMDD_HHMMSS.db .data/sgi.db

# 2. Reverter código
git revert HEAD

# 3. Reinstalar dependências
npm install
npx prisma generate

# 4. Iniciar servidor
pm2 start interjato-dashboard
```

### Cenário 3: Perda de Dados (Worst Case)
```bash
# 1. Parar servidor imediatamente
pm2 stop interjato-dashboard

# 2. Restaurar do backup externo
# Restaurar de /backups/ ou serviço cloud

# 3. Verificar integridade
sqlite3 .data/sgi.db ".tables"
sqlite3 .data/sgi.db "SELECT COUNT(*) FROM Document;"

# 4. Reiniciar servidor
pm2 start interjato-dashboard
```

---

## 📈 Pós-Deploy - Monitoramento (Primeiras 24h)

### Hora 0 (Imediato)
- [ ] Verificar se servidor está online
- [ ] Testar login de todos os perfis
- [ ] Verificar se documentos carregam
- [ ] Testar funcionalidades críticas

### Hora 1
- [ ] Monitorar CPU/Memória
- [ ] Revisar logs de erro
- [ ] Testar aprovação de documentos
- [ ] Testar registro de NCs

### Hora 2-4
- [ ] Verificar performance geral
- [ ] Testar fluxo completo de NC
- [ ] Confirmar backups estão funcionando
- [ ] Documentar qualquer problema

### Hora 4-24
- [ ] Monitoramento contínuo
- [ ] Responder a feedback de usuários
- [ ] Verificar crescimento de base de dados
- [ ] Confirmar estabilidade

---

## 📞 Contatos de Emergência

| Função | Nome | Telefone | Email |
|--------|------|----------|-------|
| Desenvolvedor | [Nome] | [Tel] | [Email] |
| DBA | [Nome] | [Tel] | [Email] |
| DevOps | [Nome] | [Tel] | [Email] |
| Gerente | [Nome] | [Tel] | [Email] |

---

## 📝 Notas de Deploy

**Data**: ___/___/_____
**Responsável**: ___________________________
**Ambiente**: □ Dev □ Staging □ Produção
**Versão**: ___________________________

### Mudanças Principais:
- [ ] Novos campos de banco de dados
- [ ] Novas APIs implementadas
- [ ] UI/UX alterada
- [ ] Segurança melhorada
- [ ] Performance otimizada

### Observações:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

### Assinatura:
_____________________________ Data: ___/___/_____

---

**Última Atualização**: 01 de Setembro de 2026
**Versão**: 1.0
**Status**: ✅ Pronto para Usar
