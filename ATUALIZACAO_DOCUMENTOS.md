# Atualização de Documentos

Os documentos aceitos pelo sistema são PDFs e DOCX de até 20 MB. Para adicionar ou substituir um arquivo, mantenha-o na pasta correspondente dentro de `documents/`.

O servidor detecta alterações automaticamente e reimporta o catálogo. Não é necessário alterar código, executar migrações ou rodar o `deploy.sh`.

## Atualização por SFTP

No Windows, abra o PowerShell e conecte-se ao servidor:

```powershell
sftp root@10.10.70.111
```

No terminal SFTP, navegue até a categoria do documento e envie o arquivo:

```sftp
cd /root/interjato-dashboard/documents/PGs
put "C:\caminho\para\PG-20.pdf"
exit
```

Para substituir um documento, envie-o com exatamente o mesmo nome do arquivo existente:

```sftp
cd /root/interjato-dashboard/documents/PGs
put "C:\caminho\para\PG-01.pdf" PG-01.pdf
exit
```

## Atualização pelo WinSCP

Crie uma sessão com estes dados:

- Protocolo: `SFTP`
- Host: `10.10.70.111`
- Porta: `22`
- Usuário: `root`

No painel remoto, abra `/root/interjato-dashboard/documents/`, entre na pasta da categoria e arraste o arquivo. Ao substituir um documento, confirme a substituição e preserve o mesmo nome.

## Atualização pelo GitHub

Para documentos versionados no repositório, envie a alteração pelo computador local:

```powershell
git add "documents/PGs/PG-20.pdf"
git commit -m "docs: atualiza PG-20"
git push origin master
```

No servidor Debian, atualize somente os arquivos:

```bash
cd /root/interjato-dashboard
git pull origin master
```

Se o Git informar que `dist/` impede o pull, descarte somente os arquivos compilados e tente novamente:

```bash
git restore dist
git pull origin master
```

## Verificação

Após o envio, acompanhe a reimportação:

```bash
pm2 logs interjato-dashboard --lines 20
```

O log deve registrar `Catálogo atualizado via SQLite`. Um arquivo alterado é marcado para revisão no sistema; um arquivo removido também é removido do catálogo.

## Pastas de Categorias

- `documents/ITs/`: instruções de trabalho
- `documents/PGs/`: procedimentos
- `documents/PLs/`: planos
- `documents/POLs/`: políticas
- `documents/REGs/`: registros
- `documents/MSGSI, SoA/`: MSGSI e declaração de aplicabilidade