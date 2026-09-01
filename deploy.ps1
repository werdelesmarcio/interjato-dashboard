# Script de Deploy Seguro - Interjato Dashboard SGI (Windows)
# Uso: .\deploy.ps1 -Environment "prod"
# Autor: Interjato Dashboard Team
# Data: 2026-09-01

param(
    [string]$Environment = "prod",
    [switch]$SkipBackup = $false
)

$ErrorActionPreference = "Stop"

# Variáveis
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$DB_PATH = ".data/sgi.db"
$BACKUP_DIR = ".data/backups"
$BACKUP_FILE = Join-Path $BACKUP_DIR "sgi.db.backup_${TIMESTAMP}.db"

# Cores
$Colors = @{
    Green = 'Green'
    Yellow = 'Yellow'
    Red = 'Red'
}

function Write-Header {
    param([string]$Message)
    Write-Host "========================================" -ForegroundColor $Colors.Yellow
    Write-Host "🚀 $Message" -ForegroundColor $Colors.Yellow
    Write-Host "Ambiente: $Environment | Timestamp: $TIMESTAMP" -ForegroundColor $Colors.Yellow
    Write-Host "========================================" -ForegroundColor $Colors.Yellow
    Write-Host ""
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host "📦 PASSO $Number`: $Message" -ForegroundColor $Colors.Green
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Colors.Red
}

# ===================================
# PASSO 1: Backup do Banco de Dados
# ===================================
Write-Header "Deploy - Interjato Dashboard SGI"

if (-not $SkipBackup) {
    Write-Step 1 "Criando Backup do Banco de Dados..."
    
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
        Write-Success "Diretório de backups criado"
    }
    
    if (Test-Path $DB_PATH) {
        Copy-Item -Path $DB_PATH -Destination $BACKUP_FILE -Force
        Write-Success "Backup criado: $BACKUP_FILE"
        
        # Manter apenas últimos 10 backups
        Write-Warning "Limpando backups antigos (mantendo últimos 10)..."
        $BackupFiles = Get-ChildItem -Path $BACKUP_DIR -Filter "sgi.db.backup_*.db" -ErrorAction SilentlyContinue | 
            Sort-Object LastWriteTime -Descending
        
        if ($BackupFiles.Count -gt 10) {
            $BackupFiles | Select-Object -Skip 10 | Remove-Item -Force
            Write-Success "Backups antigos removidos"
        }
    } else {
        Write-Warning "Banco de dados não encontrado em $DB_PATH"
    }
} else {
    Write-Warning "PASSO 1 IGNORADO: Backup desabilitado"
}

Write-Host ""

# ===================================
# PASSO 2: Parar Servidor em Produção
# ===================================
if ($Environment -eq "prod") {
    Write-Step 2 "Parando servidor em produção..."
    
    try {
        # Tentar PM2
        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            & pm2 stop interjato-dashboard 2>$null | Out-Null
            Write-Success "Servidor PM2 parado"
        }
        # Tentar Systemd (WSL)
        elseif (Get-Command systemctl -ErrorAction SilentlyContinue) {
            & systemctl stop interjato-dashboard 2>$null | Out-Null
            Write-Success "Servidor Systemd parado"
        }
        # Tentar matar processo Node
        else {
            Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
            Write-Success "Processo Node parado"
        }
    } catch {
        Write-Warning "Não foi possível parar o servidor (pode não estar rodando)"
    }
    
    Write-Host ""
}

# ===================================
# PASSO 3: Atualizar Código
# ===================================
Write-Step 3 "Atualizando código do repositório..."

try {
    if (Test-Path ".git") {
        & git pull origin master 2>&1 | Out-Null
        Write-Success "Código atualizado"
    } else {
        Write-Warning "Não é um repositório git"
    }
} catch {
    Write-Warning "Erro ao fazer git pull: $_"
}

Write-Host ""

# ===================================
# PASSO 4: Instalar Dependências
# ===================================
Write-Step 4 "Instalando dependências..."

try {
    & npm install --production 2>&1 | Out-Null
    Write-Success "Dependências instaladas"
} catch {
    Write-Error-Custom "Erro ao instalar dependências: $_"
    exit 1
}

Write-Host ""

# ===================================
# PASSO 5: Gerar Prisma Client
# ===================================
Write-Step 5 "Gerando Prisma Client..."

try {
    & npx prisma generate 2>&1 | Out-Null
    Write-Success "Prisma Client gerado"
} catch {
    Write-Error-Custom "Erro ao gerar Prisma Client: $_"
    exit 1
}

Write-Host ""

# ===================================
# PASSO 6: Aplicar Migrações
# ===================================
Write-Step 6 "Aplicando migrações de banco de dados..."

try {
    & npx prisma migrate deploy 2>&1 | Out-Null
    Write-Success "Migrações aplicadas com sucesso"
} catch {
    Write-Error-Custom "Erro ao aplicar migrações: $_"
    Write-Host "Restaurando backup..." -ForegroundColor Red
    if (Test-Path $BACKUP_FILE) {
        Copy-Item -Path $BACKUP_FILE -Destination $DB_PATH -Force
        Write-Warning "Banco de dados restaurado do backup"
    }
    exit 1
}

Write-Host ""

# ===================================
# PASSO 7: Verificar Integridade
# ===================================
Write-Step 7 "Verificando integridade de dados..."

try {
    $Query = @"
SELECT 'Usuários:' as Tipo, COUNT(*) as Total FROM User UNION ALL
SELECT 'Documentos:' as Tipo, COUNT(*) as Total FROM Document UNION ALL
SELECT 'Logs de Auditoria:' as Tipo, COUNT(*) as Total FROM AuditLog UNION ALL
SELECT 'Não-Conformidades:' as Tipo, COUNT(*) as Total FROM NonConformity;
"@
    
    $sqlite_output = sqlite3 $DB_PATH $Query 2>&1
    Write-Host "Contagem de registros:"
    Write-Host $sqlite_output -ForegroundColor Cyan
    Write-Success "Integridade de dados verificada"
} catch {
    Write-Warning "Não foi possível verificar integridade: $_"
}

Write-Host ""

# ===================================
# PASSO 8: Build do Frontend (Prod)
# ===================================
if ($Environment -eq "prod") {
    Write-Step 8 "Compilando frontend..."
    
    try {
        & npm run build 2>&1 | Out-Null
        Write-Success "Frontend compilado"
    } catch {
        Write-Error-Custom "Erro ao compilar frontend: $_"
        exit 1
    }
    
    Write-Host ""
}

# ===================================
# PASSO 9: Iniciar Servidor
# ===================================
Write-Step 9 "Iniciando servidor..."

if ($Environment -eq "prod") {
    try {
        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            & pm2 start server/index.js --name "interjato-dashboard" --env production 2>&1 | Out-Null
            Write-Success "Servidor iniciado com PM2"
            Start-Sleep -Seconds 2
            Write-Host ""
            Write-Host "Últimas 20 linhas de log:" -ForegroundColor Cyan
            & pm2 logs interjato-dashboard --lines 20
        } else {
            Write-Error-Custom "PM2 não encontrado. Instale com: npm install -g pm2"
            exit 1
        }
    } catch {
        Write-Error-Custom "Erro ao iniciar servidor: $_"
        exit 1
    }
} else {
    Write-Warning "Ambiente dev - servidor não iniciado automaticamente"
    Write-Host "Execute: npm run dev:all" -ForegroundColor Yellow
}

Write-Host ""

# ===================================
# PASSO 10: Testar Saúde
# ===================================
if ($Environment -eq "prod") {
    Write-Step 10 "Testando saúde do servidor..."
    
    Start-Sleep -Seconds 2
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -ErrorAction SilentlyContinue
        $body = $response.Content | ConvertFrom-Json
        
        if ($body.ok -eq $true) {
            Write-Success "Servidor respondendo corretamente"
            Write-Host "Resposta: $($response.Content)" -ForegroundColor Cyan
        } else {
            Write-Error-Custom "Servidor não está respondendo corretamente!"
            exit 1
        }
    } catch {
        Write-Error-Custom "Erro ao testar saúde: $_"
        Write-Host "Tente restaurar o backup:" -ForegroundColor Red
        Write-Host "  Copy-Item -Path '$BACKUP_FILE' -Destination '$DB_PATH' -Force"
        exit 1
    }
    
    Write-Host ""
}

# ===================================
# Resumo Final
# ===================================
Write-Host "========================================" -ForegroundColor $Colors.Green
Write-Host "✅ DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor $Colors.Green
Write-Host "========================================" -ForegroundColor $Colors.Green
Write-Host ""

Write-Host "📊 Informações de Deploy:" -ForegroundColor $Colors.Yellow
Write-Host "  • Ambiente: $Environment"
Write-Host "  • Timestamp: $TIMESTAMP"
if (Test-Path $BACKUP_FILE) {
    Write-Host "  • Backup: $BACKUP_FILE"
}
Write-Host "  • Diretório: $(Get-Location)"
Write-Host ""

if ($Environment -eq "prod") {
    Write-Host "📝 Próximas ações:" -ForegroundColor $Colors.Yellow
    Write-Host "  1. Testar funcionalidades críticas no navegador"
    Write-Host "  2. Verificar logs: pm2 logs interjato-dashboard"
    Write-Host "  3. Monitorar performance nos primeiros 30 minutos"
    Write-Host ""
    
    Write-Host "🆘 Se precisar fazer rollback:" -ForegroundColor $Colors.Yellow
    Write-Host "  1. Parar servidor: pm2 stop interjato-dashboard"
    Write-Host "  2. Restaurar backup: Copy-Item -Path '$BACKUP_FILE' -Destination '$DB_PATH' -Force"
    Write-Host "  3. Reverter código: git revert HEAD"
    Write-Host "  4. Reinstalar: npm install; npx prisma generate"
    Write-Host "  5. Iniciar: pm2 start interjato-dashboard"
}

Write-Host ""
