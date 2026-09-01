# 🌐 Guia de Acesso Remoto - Proxmox + Debian

## ✅ Resposta Curta
**SIM**, você conseguirá acessar o sistema de qualquer navegador na sua máquina local via rede, desde que configure a rede corretamente.

---

## 🔌 Pré-Requisitos de Rede

### 1. Verificar IP do Servidor Debian (no Proxmox)

**Dentro da VM Debian:**
```bash
# Verificar IP local
ip addr show

# Ou
hostname -I

# Esperado: 192.168.x.x ou 10.x.x.x
```

**Resultado esperado:**
```
eth0: 192.168.1.100  (exemplo)
```

### 2. Verificar Conectividade entre Máquinas

**Da sua máquina (Windows/Mac/Linux):**
```bash
# Testar ping
ping 192.168.1.100

# Esperado: Resposta do servidor
# PING 192.168.1.100 (192.168.1.100): 56 data bytes
# 64 bytes from 192.168.1.100: icmp_seq=0 ttl=64 time=1.234 ms
```

---

## 🔐 Configuração de Acesso Remoto

### Opção 1: Acesso Local (Mesma Rede - RECOMENDADO)

```
Sua Máquina (Windows/Mac/Linux)
            ↓ (Mesma rede WiFi/Ethernet)
         Router
            ↓
    Proxmox (Físico)
            ↓
     Debian VM
   (192.168.1.100)
```

**No seu navegador:**
```
http://192.168.1.100:5173   (Frontend React)
http://192.168.1.100:3001   (API Node.js)
```

### Opção 2: Acesso via Domínio (COM Nginx)

```
http://seu-dominio.com  →  Nginx  →  Node.js:3001
                                   ↓
                            React:5173 (estático)
```

---

## 📋 Guia Passo-a-Passo

### PASSO 1: Descobrir IP do Debian

```bash
# SSH no servidor Debian (pelo Proxmox ou console)
ssh root@seu-servidor-debian

# Verificar IP
ip addr show | grep "inet " | grep -v "127.0"

# Guardar esse IP (ex: 192.168.1.100)
```

### PASSO 2: Configurar Firewall Debian

```bash
# Instalar UFW (se não tiver)
sudo apt-get install ufw -y

# Abrir portas necessárias
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3001/tcp  # Node.js API
sudo ufw allow 5173/tcp  # Vite Frontend (DEV)
sudo ufw allow 80/tcp    # HTTP (se usar Nginx)
sudo ufw allow 443/tcp   # HTTPS (se usar Nginx)

# Ativar firewall
sudo ufw enable

# Ver status
sudo ufw status
```

### PASSO 3: Verificar Proxmox Networking

No **Proxmox Host**, garantir que a VM tem acesso à rede:

1. Ir em **Proxmox > VM > Hardware**
2. Verificar **Network Device** está habilitado
3. Deve estar conectado a um **bridge** (ex: `vmbr0`)
4. Se estiver em NAT, converter para bridge:
   ```
   vmbr0 (bridge - acesso completo à rede)
   ```

### PASSO 4: Deploy da Aplicação

```bash
# No servidor Debian
cd /opt/interjato-dashboard

# Executar deploy
./deploy.sh prod
```

### PASSO 5: Testar Acesso

**Na sua máquina local:**

```bash
# Substituir 192.168.1.100 pelo IP do seu servidor
curl http://192.168.1.100:3001/api/health

# Esperado: {"ok":true}
```

**No navegador:**
```
http://192.168.1.100:5173   (durante desenvolvimento com Vite)
http://192.168.1.100:3001   (a partir do arquivo compilado)
```

---

## 🌐 Três Formas de Acesso

### Forma 1: Frontend via Vite (Desenvolvimento)
```
http://192.168.1.100:5173/
```
- ✅ Hot reload habilitado
- ✅ Código-fonte acessível
- ❌ Não recomendado para produção
- ✅ Bom para testes

**Configuração:**
```bash
npm run dev
# O Vite rodará em 0.0.0.0:5173 (acessível remotamente)
```

### Forma 2: Frontend Compilado + Node.js (Produção)
```
http://192.168.1.100:3001/
```
- ✅ Arquivo estático compilado servido pelo Express
- ✅ Recomendado para produção
- ✅ Melhor performance
- ❌ Sem hot reload

**Configuração:**
```bash
npm run build
# Frontend vai em dist/
# Express serve como fallback
node server/index.js
```

### Forma 3: Nginx Reverse Proxy (Recomendado)
```
http://seu-dominio.com/
```
- ✅ Melhor segurança
- ✅ Suporte a HTTPS/SSL
- ✅ Load balancing
- ✅ Cache de static files
- ✅ Profissional

---

## 🔧 Configuração Nginx no Debian

### 1. Instalar Nginx
```bash
sudo apt-get install nginx -y
```

### 2. Criar configuração
```bash
sudo nano /etc/nginx/sites-available/interjato
```

Colar:
```nginx
upstream nodejs {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name 192.168.1.100;  # Ou seu domínio

    # Logs
    access_log /var/log/nginx/interjato-access.log;
    error_log /var/log/nginx/interjato-error.log;

    # Frontend estático
    location / {
        root /opt/interjato-dashboard/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API
    location /api/ {
        proxy_pass http://nodejs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Ativar
```bash
sudo ln -s /etc/nginx/sites-available/interjato /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Acessar
```
http://192.168.1.100/
# OU com domínio (depois de apontar DNS)
http://seu-dominio.com/
```

---

## 📊 Diagrama de Rede

```
┌─────────────────────────────────────────────────┐
│         SUA MÁQUINA (Windows/Mac/Linux)         │
│  Navegador: http://192.168.1.100 ou            │
│             http://seu-dominio.com             │
└──────────────────┬──────────────────────────────┘
                   │
                   │ WiFi/Ethernet
                   │
        ┌──────────┴────────────┐
        │   Router/Switch       │
        │   (192.168.1.1)       │
        └──────────┬────────────┘
                   │
        ┌──────────┴────────────────────┐
        │   Proxmox Host (Físico)       │
        │   (Sua máquina forte)         │
        │   Host: 192.168.1.50          │
        └──────────┬────────────────────┘
                   │ (vmbr0 bridge)
        ┌──────────┴────────────────────┐
        │   Debian VM (Proxmox)         │
        │   IP: 192.168.1.100           │
        │   ┌──────────────────────┐    │
        │   │ Nginx (port 80/443) │    │
        │   └──────────┬───────────┘    │
        │              │                │
        │   ┌──────────┴───────────┐    │
        │   │ Node.js (port 3001) │    │
        │   │ + React (dist/)     │    │
        │   └─────────────────────┘    │
        │   ┌──────────────────────┐    │
        │   │ SQLite (.data/db)   │    │
        │   └──────────────────────┘    │
        └───────────────────────────────┘
```

---

## 🚀 Teste Rápido de Conectividade

Execute no seu Debian:

```bash
# 1. Verificar IP
hostname -I

# 2. Verificar portas abertas
sudo ss -tlnp | grep -E ':(3001|5173|80|443)'

# 3. Testar internamente
curl http://localhost:3001/api/health

# 4. Testar de outro computador (substitua IP)
# Da sua máquina Windows/Mac:
# Windows:
# nslookup seu-debian-vm.local
# Mac/Linux:
# nslookup seu-debian-vm.local
```

---

## 🔒 Segurança - Dicas

### Em Desenvolvimento
```bash
# Aceitar conexões externas
VITE_HOST=0.0.0.0 npm run dev
```

### Em Produção
- ✅ Use Nginx como reverse proxy
- ✅ Feche porta 3001 do firewall (acesso apenas local)
- ✅ Use HTTPS/SSL com Let's Encrypt
- ✅ Autenticação JWT habilitada
- ✅ Rate limiting ativo

### Firewall Seguro
```bash
# Aceitar apenas SSH e HTTP/HTTPS
sudo ufw reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## ❓ Troubleshooting

### Problema: "Conexão recusada"
```bash
# Verificar se servidor está rodando
pm2 status

# Reiniciar
pm2 restart interjato-dashboard

# Verificar logs
pm2 logs interjato-dashboard
```

### Problema: "Host não alcançável"
```bash
# Verificar IP
ip addr show

# Testar firewall
sudo ufw status

# Permitir porta
sudo ufw allow 3001/tcp
sudo ufw allow 5173/tcp
```

### Problema: "Timeout"
```bash
# Verificar conectividade Proxmox → Debian
ping 192.168.1.100

# Verificar bridge no Proxmox
ip addr show vmbr0

# Se VM não tem IP, reconfigurá-la
sudo dhclient -v
```

---

## ✅ Checklist Final

- [ ] Debian VM rodando no Proxmox
- [ ] IP configurado (192.168.x.x)
- [ ] Firewall abre portas 3001/5173
- [ ] Conectividade testada (ping do host)
- [ ] Aplicação deployada (`./deploy.sh prod`)
- [ ] PM2 rodando (`pm2 status`)
- [ ] Health check OK (`curl http://IP:3001/api/health`)
- [ ] Nginx configurado (se produção)
- [ ] Navegador acessa `http://192.168.1.100`
- [ ] Login funciona
- [ ] Documentos carregam

---

## 🎯 Resumo Rápido

| O Quê | Onde Acessar |
|-------|--------------|
| **Desenvolvimento** | `http://192.168.1.100:5173` |
| **Produção (direto)** | `http://192.168.1.100:3001` |
| **Produção (Nginx)** | `http://192.168.1.100/` ou `http://seu-dominio.com` |
| **Console Debian** | SSH: `ssh root@192.168.1.100` |
| **Logs** | PM2: `pm2 logs interjato-dashboard` |

---

**Conclusão**: Sim, você conseguirá acessar facilmente! 🎉

A configuração mais simples e recomendada:
1. Deploy no Debian
2. Ativar Nginx
3. Acessar via `http://IP-do-debian`

Perguntas? Veja o arquivo DEPLOYMENT_GUIDE.md para mais detalhes!
