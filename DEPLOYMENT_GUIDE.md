# Guia de Deploy em Produção - Interjato Dashboard SGI

## 📋 Pré-Requisitos
- Node.js 18+ instalado no servidor de produção
- npm ou yarn
- Acesso ao servidor via SSH/RDP
- Backup estratégico do banco de dados SQLite

---

## ✅ PASSO 1: Preparação - Backup Seguro (CRUCIAL)

### 1.1 Fazer Backup Completo do Banco de Dados Atual

```bash
# No servidor de produção, faça backup do banco atual
cp .data/sgi.db .data/sgi.db.backup_$(date +%Y%m%d_%H%M%S).db
```

### 1.2 Armazenar Backup em Local Seguro
```bash
# Opção 1: Armazenar em pasta de backups
mkdir -p /backups/interjato-dashboard
cp .data/sgi.db /backups/interjato-dashboard/sgi.db.backup_$(date +%Y%m%d_%H%M%S).db

# Opção 2: Fazer upload para serviço de armazenamento
# gsutil cp .data/sgi.db gs://seu-bucket/backups/sgi.db.backup_$(date +%Y%m%d_%H%M%S).db
# aws s3 cp .data/sgi.db s3://seu-bucket/backups/sgi.db.backup_$(date +%Y%m%d_%H%M%S).db
```

---

## 🚀 PASSO 2: Deploy do Código

### 2.1 Clone ou Atualize o Código do Repositório

```bash
# Se é primeira vez
git clone https://github.com/werdelesmarcio/interjato-dashboard.git
cd interjato-dashboard

# Se já existe repositório, fazer pull
cd /path/to/interjato-dashboard
git pull origin master
```

### 2.2 Instalar Dependências

```bash
npm install --production
# OU com yarn
yarn install --production
```

---

## 🔄 PASSO 3: Migrações de Banco de Dados (Sem Perda de Dados)

### 3.1 Gerar Prisma Client com Nova Migração

```bash
npx prisma generate
```

### 3.2 Aplicar Migrações (SEGURO)

```bash
# Isto APLICA as migrações sem deletar dados existentes
npx prisma migrate deploy
```

**⚠️ IMPORTANTE:** Este comando:
- ✅ Adiciona novos campos (`userApprovalStatus`, `auditorViewedAt`, `auditViewedBy`, `hasNonConformity`, `nonConformityResolvedAt`)
- ✅ Mantém TODOS os usuários existentes
- ✅ Mantém TODOS os documentos existentes
- ✅ Mantém TODOS os logs de auditoria
- ✅ Mantém TODAS as não-conformidades
- ❌ NÃO deleta nada

### 3.3 Verificar Banco de Dados (Opcional)

```bash
# Para inspecionar o banco de dados
npx prisma studio

# Ou verificar via SQLite CLI
sqlite3 .data/sgi.db ".tables"
sqlite3 .data/sgi.db "SELECT COUNT(*) FROM User;"
sqlite3 .data/sgi.db "SELECT COUNT(*) FROM Document;"
sqlite3 .data/sgi.db "SELECT COUNT(*) FROM AuditLog;"
sqlite3 .data/sgi.db "SELECT COUNT(*) FROM NonConformity;"
```

---

## 🏗️ PASSO 4: Build do Frontend

```bash
npm run build
```

Isto criará a pasta `dist/` com o frontend compilado.

---

## 🔌 PASSO 5: Configuração do Servidor de Produção

### 5.1 Variáveis de Ambiente

Criar arquivo `.env` em produção:

```env
# .env (em produção)
NODE_ENV=production
PORT=3001
JWT_SECRET=seu_secret_seguro_muito_longo_aqui
SESSION_EXPIRY=3600000
INACTIVITY_TIMEOUT=7200000
DATABASE_URL=file:../.data/sgi.db
```

**⚠️ IMPORTANTE:** Usar `JWT_SECRET` forte em produção!

```bash
# Gerar um secret seguro
openssl rand -base64 32
```

### 5.2 Permissões de Arquivo

```bash
# Garantir que o diretório de dados é acessível
chmod 755 .data
chmod 644 .data/sgi.db
chown -R node:node .data  # Se usando usuário 'node'
```

---

## 🎯 PASSO 6: Iniciar Servidor em Produção

### 6.1 Opção 1: Node Direto (Simples)

```bash
NODE_ENV=production node server/index.js
```

### 6.2 Opção 2: PM2 (Recomendado para Produção)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação com PM2
pm2 start server/index.js --name "interjato-dashboard" --env production

# Configurar para reiniciar automaticamente
pm2 startup
pm2 save

# Ver logs
pm2 logs interjato-dashboard

# Ver status
pm2 status
```

### 6.3 Opção 3: Systemd Service (Linux)

```bash
# Criar arquivo de serviço
sudo nano /etc/systemd/system/interjato-dashboard.service
```

Conteúdo do arquivo:

```ini
[Unit]
Description=Interjato Dashboard SGI
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/interjato-dashboard
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/interjato-dashboard/app.log
StandardError=append:/var/log/interjato-dashboard/error.log
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="JWT_SECRET=seu_secret_aqui"

[Install]
WantedBy=multi-user.target
```

Depois:

```bash
sudo systemctl daemon-reload
sudo systemctl enable interjato-dashboard
sudo systemctl start interjato-dashboard
sudo systemctl status interjato-dashboard
```

---

## 🌐 PASSO 7: Configuração de Servidor Web (Nginx/Apache)

### 7.1 Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/interjato-dashboard
upstream interjato {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Logs
    access_log /var/log/nginx/interjato-access.log;
    error_log /var/log/nginx/interjato-error.log;

    # Frontend
    location / {
        root /opt/interjato-dashboard/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API Proxy
    location /api/ {
        proxy_pass http://interjato;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/interjato-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 PASSO 8: Segurança em Produção

### 8.1 HTTPS/SSL
```bash
# Usar Let's Encrypt com Certbot
sudo certbot certonly --standalone -d seu-dominio.com
```

### 8.2 Firewall
```bash
# Abrir apenas portas necessárias
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 8.3 Monitoramento
```bash
# Instalar ferramentas de monitoramento
npm install -g pm2-plus
pm2 plus

# Ou usar New Relic, Datadog, etc.
```

---

## ✔️ PASSO 9: Verificação Pós-Deploy

### 9.1 Testar Saúde do Servidor

```bash
# Verificar se servidor está respondendo
curl http://localhost:3001/api/health

# Resposta esperada: {"ok":true}
```

### 9.2 Verificar Integridade de Dados

```bash
# Conectar ao SQLite e verificar contagens
sqlite3 .data/sgi.db << EOF
SELECT 'Usuários:' as tipo, COUNT(*) as total FROM User;
SELECT 'Documentos:' as tipo, COUNT(*) as total FROM Document;
SELECT 'Logs de Auditoria:' as tipo, COUNT(*) as total FROM AuditLog;
SELECT 'Não-Conformidades:' as tipo, COUNT(*) as total FROM NonConformity;
EOF
```

### 9.3 Testar Funcionalidades Críticas

- [ ] Login com usuário admin
- [ ] Visualizar documentos
- [ ] Registrar não-conformidade
- [ ] Aprovar documento
- [ ] Visualizar logs de auditoria

---

## 🆘 PLANO DE ROLLBACK (Caso Algo Dê Errado)

### Passo 1: Parar o Servidor

```bash
pm2 stop interjato-dashboard
# OU
systemctl stop interjato-dashboard
```

### Passo 2: Restaurar Banco de Dados do Backup

```bash
# Restaurar do backup
cp .data/sgi.db.backup_TIMESTAMP.db .data/sgi.db
```

### Passo 3: Reverter Código (Se Necessário)

```bash
git revert HEAD
# OU
git checkout <commit-anterior>
```

### Passo 4: Reinstalar Dependências

```bash
npm install
npx prisma generate
```

### Passo 5: Reiniciar Servidor

```bash
pm2 start interjato-dashboard
# OU
systemctl start interjato-dashboard
```

---

## 📊 Resumo do Deploy Seguro

| Etapa | Ação | Risco de Perda de Dados |
|-------|------|------------------------|
| 1. Backup | Cópia completa do BD | ✅ NENHUM |
| 2. Deploy | Git pull + npm install | ✅ NENHUM |
| 3. Migrações | `prisma migrate deploy` | ✅ NENHUM (apenas ADD) |
| 4. Build | `npm run build` | ✅ NENHUM |
| 5. Iniciar | PM2/Systemd | ✅ NENHUM |

**Conclusão:** Todas as etapas são **seguras**. Seus dados existentes permanecerão intactos.

---

## 📞 Suporte

Se algo der errado durante o deploy:

1. Verifique os logs: `pm2 logs interjato-dashboard`
2. Verifique a integridade do BD: `sqlite3 .data/sgi.db ".schema"`
3. Restaure do backup: `cp .data/sgi.db.backup_*.db .data/sgi.db`
4. Entre em contato com o desenvolvedor

---

**Última Atualização:** 01 de Setembro de 2026
**Versão:** 1.0
**Status:** Pronto para Deploy em Produção ✅
