# 🚀 Deploy em Produção - Guia Rápido

## O Que Foi Corrigido

✅ **Problema**: `vite: not found` durante o build  
✅ **Solução**: Removido `--production` do `npm install` para que devDependencies sejam instaladas  
✅ **Adicionado**: Script `init-admin.js` para criar usuário admin automaticamente  

---

## 📋 Passo-a-Passo no Debian

### 1. SSH no seu servidor
```bash
ssh root@seu-servidor-debian
```

### 2. Clonar o repositório
```bash
cd ~
git clone https://github.com/werdelesmarcio/interjato-dashboard.git
cd interjato-dashboard
```

### 3. Executar deploy (agora corrigido!)
```bash
chmod +x deploy.sh
./deploy.sh prod
```

### 4. Acompanhar o processo
O script vai:
- ✅ Backup do BD (se existir)
- ✅ Parar servidor (se rodando)
- ✅ Atualizar código via Git
- ✅ **Instalar TODAS as dependências** (incluindo vite)
- ✅ Gerar Prisma Client
- ✅ Aplicar migrações de banco
- ✅ **Compilar frontend com Vite** ← Agora funciona!
- ✅ **Criar usuário admin** (se não existir) ← Automático!
- ✅ Iniciar servidor com PM2
- ✅ Testar saúde

### 5. Pronto!
Quando terminar, você terá:
```
✅ Banco de dados criado e migrado
✅ Frontend compilado em dist/
✅ API rodando em http://localhost:3001
✅ Usuário admin criado (admin/admin123)
✅ Acessível em http://IP:3001
```

---

## 🔑 Credenciais Padrão Criadas

Após o deploy:

| Campo | Valor |
|-------|-------|
| Usuário | `admin` |
| Senha | `admin123` |
| Perfil | Administrador |

**⚠️ IMPORTANTE**: Altere a senha logo após o primeiro login!

---

## 🌐 Acessar a Aplicação

Da sua máquina:

```
http://IP-DO-DEBIAN:3001/
```

Exemplo (substitua pelo IP real do seu servidor):
```
http://192.168.1.100:3001/
```

---

## 📊 Se Algo Der Errado

### Ver logs
```bash
pm2 logs interjato-dashboard
```

### Parar servidor
```bash
pm2 stop interjato-dashboard
```

### Reiniciar
```bash
pm2 restart interjato-dashboard
```

### Executar deploy novamente
```bash
./deploy.sh prod
```

---

## ✨ Resumo das Mudanças

### Arquivo `deploy.sh`
- Removido `--production` → Instala vite e devDependencies
- Adicionado `node init-admin.js` → Cria admin automaticamente
- Renumeradas etapas (8→9→10→11)

### Arquivo `deploy.ps1`
- Mesmo tratamento para Windows users
- Suporte completo a PM2 no Windows

### Novo arquivo `init-admin.js`
- Verifica se admin existe
- Se não existir, cria com credenciais padrão
- Mensagem amigável ao usuário

---

## 🎯 Próximos Passos

1. Execute o deploy corrigido
2. Aguarde a compilação do Vite (pode levar alguns minutos)
3. Acesse via navegador
4. Faça login com `admin/admin123`
5. **ALTERE A SENHA** imediatamente
6. Aproveite a aplicação! 🎉

---

**Status**: ✅ Pronto para usar!
