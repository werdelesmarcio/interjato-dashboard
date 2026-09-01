import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import chokidar from "chokidar";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { body, validationResult } from "express-validator";
import { importDocument } from "./importer.js";
import { login, logout, verifyToken, getUsers, getUserById, updateOwnProfile, addUser, updateUser, deleteUser, mfaSetup, mfaVerifyAndEnable, mfaDisable, ensureDefaultUsers } from "./auth.js";

const prisma = new PrismaClient();


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const documentsRoot = path.join(root, "documents");
const dataRoot = path.join(root, ".data");
const port = Number(globalThis.process?.env?.PORT || 3001);

function formatAuditDate(date = new Date()) {
  if (typeof date === "string") {
    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]} ${match[4] || "00"}:${match[5] || "00"}:${match[6] || "00"}`;
    }
  }
  const value = date instanceof Date ? date : new Date(date);
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

async function appendAuditLog({ key, type, documentId, documentName, actor, date, status, details }) {
  try {
    await prisma.auditLog.upsert({
      where: { key },
      update: {
        type,
        documentId: documentId || "",
        documentName: documentName || "",
        actor: actor || "",
        date: formatAuditDate(date),
        status: status || "",
        details: details || "",
      },
      create: {
        key,
        type,
        documentId: documentId || "",
        documentName: documentName || "",
        actor: actor || "",
        date: formatAuditDate(date),
        status: status || "",
        details: details || "",
        createdAt: new Date(),
      }
    });
  } catch (error) {
    console.error("Erro ao registrar log de auditoria no banco:", error.message);
  }
}

async function rebuildCatalog() {
  const previousDocuments = await prisma.document.findMany();
  const files = await collectFiles(documentsRoot);
  const activeIds = [];

  for (const filePath of files) {
    try {
      const document = await importDocument(filePath, documentsRoot);
      if (document) {
        activeIds.push(document.id);
        const previous = previousDocuments.find((item) => item.id === document.id);
        const changed = !previous || previous.sourceHash !== document.sourceHash;

        const dbDocData = {
          title: document.title,
          category: document.category,
          icon: document.icon,
          rev: previous && !changed ? previous.rev : document.rev,
          date: previous && !changed ? previous.date : document.date,
          approvedBy: previous && !changed ? previous.approvedBy : "Não identificado",
          approverRole: previous && !changed ? previous.approverRole : null,
          needsReview: previous && !changed ? previous.needsReview : true,
          contentHtml: document.contentHtml || "",
          sourceFile: document.sourceFile || "",
          sourceHash: document.sourceHash || "",
        };

        const upserted = await prisma.document.upsert({
          where: { id: document.id },
          update: dbDocData,
          create: {
            id: document.id,
            ...dbDocData,
          }
        });

        const actor = upserted.approvedBy !== "Não identificado" ? upserted.approvedBy : "Sistema";
        for (const revision of document.revisoes || []) {
          await appendAuditLog({
            key: `revision|${document.id}|${revision.rev}|${revision.data}|${revision.motivo}`,
            type: "Revisão",
            documentId: document.id,
            documentName: document.title,
            actor: revision.motivo.match(/Aprovado por (.+)$/i)?.[1] || actor,
            date: revision.data,
            status: revision.motivo.match(/Aprovado por/i) ? "Aprovado" : "Revisão registrada",
            details: revision.motivo,
          });
        }

        if (changed) {
          await appendAuditLog({
            key: `change|${document.id}|${document.sourceHash}`,
            type: "Alteração",
            documentId: document.id,
            documentName: document.title,
            actor: "Sistema",
            date: new Date(),
            status: "Pendente de revisão",
            details: previous ? "Arquivo substituído ou modificado" : "Arquivo inserido",
          });
        }
      }
    } catch (error) {
      console.error(`Falha ao importar ${filePath}:`, error.message);
    }
  }

  // Deletar documentos do banco de dados que foram fisicamente excluídos da pasta documents (ISO 27001 conformidade)
  const deletedDocs = previousDocuments.filter(p => !activeIds.includes(p.id));
  for (const doc of deletedDocs) {
    await prisma.document.delete({ where: { id: doc.id } });
    await appendAuditLog({
      key: `delete|${doc.id}|${new Date().getTime()}`,
      type: "Exclusão",
      documentId: doc.id,
      documentName: doc.title,
      actor: "Sistema",
      date: new Date(),
      status: "Excluído",
      details: "Arquivo removido do diretório físico de documentos",
    });
  }

  console.log(`Catálogo atualizado via SQLite: ${activeIds.length} documento(s) ativos.`);
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else if (/\.(pdf|docx)$/i.test(entry.name)) files.push(entryPath);
  }

  return files;
}

await fs.mkdir(documentsRoot, { recursive: true });
await ensureDefaultUsers();
await rebuildCatalog();

const app = express();

// Proteger cabeçalhos HTTP (MIME-sniffing, Clickjacking, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Necessário para iframes PDF locais funcionarem sem bloqueios de política estrita
}));

// Proteção contra ataques de negação de serviço (DoS) limitando tamanho do payload de entrada
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

// Middleware de proteção CSRF baseado na verificação do Origin
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const origin = req.get('Origin');
    const host = req.get('Host');
    
    // Em um ambiente de produção, substitua 'localhost' pela sua URL de produção
    const allowedOrigins = [
      `http://${host}`, 
      `http://localhost:${port}`,
      'http://localhost:5173' // Origem do Vite dev server
    ]; 

    if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return res.status(403).json({ message: 'Acesso negado: CSRF - Origem inválida.' });
    }
  }
  next();
});


// Rate Limiter para o endpoint de login (proteção contra força bruta em conformidade com a ISO 27001)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // máximo de 15 tentativas
  message: { message: "Muitas tentativas de login a partir deste IP. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const addUserValidationRules = [
  body('name').trim().notEmpty().withMessage('O nome é obrigatório.'),
  body('username').trim().isLength({ min: 3 }).withMessage('O nome de usuário deve ter no mínimo 3 caracteres.'),
  body('password').notEmpty().withMessage('A senha é obrigatória.'),
  body('role').isIn(['user', 'admin', 'auditor', 'operador']).withMessage('A função fornecida é inválida.'),
];

const updateUserValidationRules = [
  body('name').optional().trim().notEmpty().withMessage('O nome não pode ser vazio.'),
  body('username').optional().trim().isLength({ min: 3 }).withMessage('O nome de usuário deve ter no mínimo 3 caracteres.'),
  body('role').optional().isIn(['user', 'admin', 'auditor', 'operador']).withMessage('A função fornecida é inválida.'),
];

app.post("/api/login", loginLimiter, login);
app.post("/api/logout", logout);

app.get("/api/profile", verifyToken, async (req, res) => {
  const user = await getUserById(req.user.userId);
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  res.json(user);
});

app.patch("/api/profile", verifyToken, async (req, res) => {
  try {
    const result = await updateOwnProfile(req.user.userId, req.body);
    if (result.error) {
      // Log do erro real no servidor para depuração
      console.error(`Falha na atualização do perfil para userId ${req.user.userId}: ${result.error}`);
      // Envio de mensagem genérica para o cliente
      return res.status(result.status).json({ message: 'Não foi possível atualizar o perfil. Verifique os dados fornecidos.' });
    }
    res.json({ user: result.user, token: result.token });
  } catch (error) {
    console.error(`Erro interno na atualização do perfil para userId ${req.user.userId}:`, error);
    res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
  }
});

// Rotas para Gerenciamento de MFA
app.post("/api/profile/mfa/setup", verifyToken, async (req, res) => {
  try {
    const result = await mfaSetup(req.user.userId);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao iniciar configuração do MFA." });
  }
});

app.post("/api/profile/mfa/verify", verifyToken, async (req, res) => {
  try {
    const result = await mfaVerifyAndEnable(req.user.userId, req.body);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao verificar código MFA." });
  }
});

app.post("/api/profile/mfa/disable", verifyToken, async (req, res) => {
  try {
    const result = await mfaDisable(req.user.userId, req.body);
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao desativar MFA." });
  }
});

app.get("/api/documents", async (_request, response) => {
  try {
    const docs = await prisma.document.findMany();
    // Formatar para manter compatibilidade com o front (adicionando revisões do log)
    const formattedDocs = await Promise.all(docs.map(async (doc) => {
      const revs = await prisma.auditLog.findMany({
        where: { documentId: doc.id, type: "Revisão" },
        orderBy: { createdAt: 'asc' },
      });
      return {
        ...doc,
        revisoes: revs.map(r => ({
          rev: r.key.split('|')[2] || "1",
          data: r.date.split(' ')[0],
          motivo: r.details,
          itens: "",
        })),
      };
    }));
    response.json(formattedDocs.sort((a, b) => a.id.localeCompare(b.id)));
  } catch (error) {
    response.status(500).json({ message: "Erro ao carregar catálogo documental." });
  }
});

app.get("/api/audit-log", verifyToken, async (_request, response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }
    });
    response.json(logs);
  } catch (error) {
    response.status(500).json({ message: "Erro ao carregar logs de auditoria." });
  }
});

app.get("/api/documents/:id/file", async (request, response) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: request.params.id } });
    if (!document?.sourceFile) return response.status(404).json({ message: "Arquivo não encontrado." });

    const filePath = path.resolve(documentsRoot, document.sourceFile);
    if (!filePath.startsWith(`${documentsRoot}${path.sep}`)) {
      return response.status(400).json({ message: "Caminho de arquivo inválido." });
    }

    return response.sendFile(filePath);
  } catch (error) {
    response.status(500).json({ message: "Erro ao carregar arquivo." });
  }
});

app.post("/api/documents/:id/review", verifyToken, async (req, res) => {
  // Apenas operadores e admins podem marcar como revisado (o checkbox)
  if (req.user.role !== 'operador' && req.user.role !== 'admin' && req.user.role !== 'auditor') {
    return res.status(403).json({ message: 'Acesso negado. Apenas operadores, administradores e auditores podem marcar/desmarcar revisão.' });
  }
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) return res.status(404).json({ message: "Documento não encontrado." });

    const nextNeedsReview = !document.needsReview;
    const actionAt = new Date();
    
    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        needsReview: nextNeedsReview,
      }
    });

    const lastRevisions = await prisma.auditLog.findMany({
      where: { documentId: document.id, type: "Revisão" },
      orderBy: { createdAt: 'desc' }
    });

    const numericRevs = lastRevisions.map(r => {
      const parts = r.key.split('|');
      const revCandidate = parts.length > 2 ? Number(parts[2]) : NaN;
      return !isNaN(revCandidate) ? revCandidate : 0;
    });
    const lastRevNum = numericRevs.length > 0 ? Math.max(...numericRevs) : 0;
    const currentRevNum = document.rev && !isNaN(Number(document.rev)) ? Number(document.rev) : lastRevNum;
    const assignedRev = nextNeedsReview ? currentRevNum : currentRevNum;

    await appendAuditLog({
      key: `review|${document.id}|${assignedRev}|${actionAt.getTime()}`,
      type: "Revisão",
      documentId: document.id,
      documentName: document.title,
      actor: req.user.name,
      date: actionAt,
      status: nextNeedsReview ? "Pendente de revisão" : "Revisado",
      details: nextNeedsReview ? "Revisão desmarcada pelo usuário" : "Revisão confirmada pelo usuário",
    });
    
    // Adicionar revisões para o retorno
    const revs = await prisma.auditLog.findMany({
      where: { documentId: document.id, type: "Revisão" },
      orderBy: { createdAt: 'asc' },
    });
    
    res.json({
      ...updated,
      revisoes: revs.map(r => {
        const parts = r.key.split('|');
        let revVal = parts.length > 2 ? parts[2] : "0";
        if (revVal.length > 4) revVal = document.rev || "0";
        return {
          rev: revVal,
          data: r.date.split(' ')[0],
          motivo: r.details,
          itens: "",
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar revisão." });
  }
});

app.post("/api/documents/:id/approve", verifyToken, async (req, res) => {
  // Usuário (role === 'user') e Admin (role === 'admin') podem aprovar/desaprovar revisões
  if (req.user.role !== 'admin' && req.user.role !== 'user') {
    return res.status(403).json({ message: 'Acesso negado. Apenas usuários e administradores podem aprovar revisões de documentos.' });
  }
  try {
    const { id } = req.params;
    const { user } = req;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return res.status(404).json({ message: 'Documento não encontrado.' });
    }

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const lastRevisions = await prisma.auditLog.findMany({
      where: { documentId: id, type: "Revisão" },
      orderBy: { createdAt: 'desc' }
    });

    const lastRevNum = lastRevisions.length > 0 ? Number(lastRevisions[0].key.split('|')[2]) : 0;
    const newRevisionNumber = String(lastRevNum + 1);

    // Ajuste da regra de negócio:
    // Salvar o aprovadorRole como nulo ou vazio para forçar a exibição do "Nome do Usuário logado" e não a sua função
    const updated = await prisma.document.update({
      where: { id },
      data: {
        approvedBy: user.name,
        approverRole: null, // Definindo como null para que o front use approvedBy (Nome do Usuário)
        date: formattedDate,
        rev: newRevisionNumber,
        needsReview: false,
      }
    });

    await appendAuditLog({
      key: `approval|${id}|${newRevisionNumber}|${formattedDate}|${user.name}`,
      type: "Revisão", // Registrado como revisão para manter histórico unificado
      documentId: id,
      documentName: document.title,
      actor: user.name,
      date: today,
      status: "Aprovado",
      details: `Aprovado por ${user.name} via sistema`,
    });

    const revs = await prisma.auditLog.findMany({
      where: { documentId: id, type: "Revisão" },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      ...updated,
      revisoes: revs.map(r => ({
        rev: r.key.split('|')[2] || "1",
        data: r.date.split(' ')[0],
        motivo: r.details,
        itens: "",
      })),
    });

  } catch (error) {
    console.error("Falha ao aprovar o documento:", error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

app.post("/api/documents/:id/disapprove", verifyToken, async (req, res) => {
  // Usuário (role === 'user') e Admin (role === 'admin') podem desaprovar revisões
  if (req.user.role !== 'admin' && req.user.role !== 'user') {
    return res.status(403).json({ message: 'Acesso negado. Apenas usuários e administradores podem desaprovar revisões de documentos.' });
  }
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return res.status(404).json({ message: 'Documento não encontrado.' });
    }

    if (document.approvedBy === "Não identificado") {
      return res.status(400).json({ message: 'Este documento já está pendente de aprovação.' });
    }
    
    const updated = await prisma.document.update({
      where: { id },
      data: {
        approvedBy: "Não identificado",
        approverRole: null,
        needsReview: true,
      }
    });

    await appendAuditLog({
      key: `disapproval|${id}|${document.rev}|${new Date().getTime()}`,
      type: "Desaprovação",
      documentId: id,
      documentName: document.title,
      actor: req.user.name,
      date: new Date(),
      status: "Pendente de aprovação",
      details: `Revisão ${document.rev} desaprovada`,
    });

    const revs = await prisma.auditLog.findMany({
      where: { documentId: id, type: "Revisão" },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      ...updated,
      revisoes: revs.map(r => ({
        rev: r.key.split('|')[2] || "1",
        data: r.date.split(' ')[0],
        motivo: r.details,
        itens: "",
      })),
    });

  } catch (error) {
    console.error("Falha ao desaprovar o documento:", error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// Rotas de Usuários
app.get('/api/users', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    res.json(await getUsers());
});

app.post('/api/users', verifyToken, addUserValidationRules, validateRequest, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    try {
        const newUser = await addUser(req.body);
        res.status(201).json(newUser);
    } catch (_error) {
        res.status(400).json({ message: _error.message || 'Erro ao criar usuário.' });
    }
});

app.put('/api/users/:id', verifyToken, updateUserValidationRules, validateRequest, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const updatedUser = await updateUser(Number(req.params.id), req.body);
    if (updatedUser) {
        res.json(updatedUser);
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
});

app.delete('/api/users/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const success = await deleteUser(Number(req.params.id));
    if (success) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
});

app.post("/api/reimport", verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem forçar reimportação.' });
  }
  await rebuildCatalog();
  const docs = await prisma.document.findMany();
  const formattedDocs = await Promise.all(docs.map(async (doc) => {
    const revs = await prisma.auditLog.findMany({
      where: { documentId: doc.id, type: "Revisão" },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...doc,
      revisoes: revs.map(r => ({
        rev: r.key.split('|')[2] || "1",
        data: r.date.split(' ')[0],
        motivo: r.details,
        itens: "",
      })),
    };
  }));
  res.json({ ok: true, documents: formattedDocs.sort((a, b) => a.id.localeCompare(b.id)) });
});

// Rotas de Não-Conformidade (NonConformity)
app.get("/api/non-conformities", verifyToken, async (req, res) => {
  try {
    const list = await prisma.nonConformity.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar não-conformidades." });
  }
});

app.post("/api/non-conformities", verifyToken, async (req, res) => {
  if (req.user.role !== 'auditor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas auditores e administradores podem registrar não-conformidades." });
  }
  try {
    const { documentId, documentName, description } = req.body;
    if (!documentId || !documentName || !description) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }
    if (description.length > 5000) {
      return res.status(400).json({ message: "A descrição não pode exceder 5000 caracteres." });
    }

    const today = new Date();
    const formattedDate = formatAuditDate(today);

    const nc = await prisma.nonConformity.create({
      data: {
        documentId,
        documentName,
        auditorName: req.user.name,
        description,
        date: formattedDate,
        status: "Pendente",
      }
    });

    // Registrar no AuditLog também para rastreabilidade ISO 27001
    await appendAuditLog({
      key: `nc|${nc.id}|${today.getTime()}`,
      type: "Não-Conformidade",
      documentId,
      documentName,
      actor: req.user.name,
      date: today,
      status: "Registrada",
      details: `Não-conformidade registrada pelo auditor: ${description.slice(0, 100)}...`,
    });

    res.status(201).json(nc);
  } catch (error) {
    res.status(500).json({ message: "Erro ao salvar não-conformidade." });
  }
});

// Tratar Não-Conformidade (Executada pelo perfil Operador)
app.post("/api/non-conformities/:id/treat", verifyToken, async (req, res) => {
  if (req.user.role !== 'operador' && req.user.role !== 'operator' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas operadores e administradores podem tratar não-conformidades." });
  }
  try {
    const { id } = req.params;
    const { treatmentDesc } = req.body;
    if (!treatmentDesc || !treatmentDesc.trim()) {
      return res.status(400).json({ message: "A descrição do tratamento é obrigatória." });
    }

    const nc = await prisma.nonConformity.findUnique({ where: { id: Number(id) } });
    if (!nc) return res.status(404).json({ message: "Não-conformidade não encontrada." });

    const today = new Date();
    const formattedDate = formatAuditDate(today);

    const updatedNc = await prisma.nonConformity.update({
      where: { id: Number(id) },
      data: {
        status: "Tratada",
        treatmentDesc,
        treatmentDate: formattedDate,
        operatorName: req.user.name,
      }
    });

    await appendAuditLog({
      key: `nc-treat|${id}|${today.getTime()}`,
      type: "Não-Conformidade",
      documentId: nc.documentId,
      documentName: nc.documentName,
      actor: req.user.name,
      date: today,
      status: "Tratada",
      details: `Tratamento aplicado pelo operador: ${treatmentDesc.slice(0, 100)}...`,
    });

    res.json(updatedNc);
  } catch (error) {
    res.status(500).json({ message: "Erro ao registrar tratamento da não-conformidade." });
  }
});

// Aprovar Tratamento da Não-Conformidade (Executada pelo perfil Usuário)
app.post("/api/non-conformities/:id/approve", verifyToken, async (req, res) => {
  if (req.user.role !== 'user' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas usuários e administradores podem aprovar o tratamento de não-conformidades." });
  }
  try {
    const { id } = req.params;

    const nc = await prisma.nonConformity.findUnique({ where: { id: Number(id) } });
    if (!nc) return res.status(404).json({ message: "Não-conformidade não encontrada." });
    if (nc.status !== 'Tratada') {
      return res.status(400).json({ message: "Esta não-conformidade ainda não foi tratada pelo operador." });
    }

    const today = new Date();
    const formattedDate = formatAuditDate(today);

    const updatedNc = await prisma.nonConformity.update({
      where: { id: Number(id) },
      data: {
        status: "Aprovada",
        approvalDate: formattedDate,
        approverName: req.user.name,
      }
    });

    await appendAuditLog({
      key: `nc-approve|${id}|${today.getTime()}`,
      type: "Não-Conformidade",
      documentId: nc.documentId,
      documentName: nc.documentName,
      actor: req.user.name,
      date: today,
      status: "Aprovada",
      details: `Tratamento da não-conformidade aprovado por usuário`,
    });

    res.json(updatedNc);
  } catch (error) {
    res.status(500).json({ message: "Erro ao aprovar tratamento da não-conformidade." });
  }
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

const watcher = chokidar.watch(documentsRoot, { ignoreInitial: true });
watcher.on("add", rebuildCatalog).on("change", rebuildCatalog).on("unlink", rebuildCatalog);

// Servir arquivos estáticos do frontend em produção
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.resolve(root, 'dist');
  app.use(express.static(buildPath));

  // Rota catch-all para servir o index.html para o roteamento do React
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(buildPath, 'index.html'));
  });
}


// Aprovar Revisão (Perfil Usuário)
app.post("/api/documents/:id/user-approve", verifyToken, async (req, res) => {
  if (req.user.role !== 'user' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas usuários e administradores podem aprovar revisões." });
  }
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) return res.status(404).json({ message: "Documento não encontrado." });
    if (document.needsReview) {
      return res.status(400).json({ message: "Aguarde até que o operador conclua a revisão." });
    }

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        approvedBy: req.user.name,
        userApprovalStatus: "Aprovado"
      }
    });

    const today = new Date();
    await appendAuditLog({
      key: `doc-approve|${document.id}|${today.getTime()}`,
      type: "Aprovação",
      documentId: document.id,
      documentName: document.title,
      actor: req.user.name,
      date: today,
      status: "Aprovado",
      details: `Revisão aprovada pelo usuário: ${req.user.name}`
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Erro ao aprovar revisão." });
  }
});

// Desaprovar Revisão (Perfil Usuário)
app.post("/api/documents/:id/user-disapprove", verifyToken, async (req, res) => {
  if (req.user.role !== 'user' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas usuários e administradores podem desaprovar revisões." });
  }
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) return res.status(404).json({ message: "Documento não encontrado." });

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        needsReview: true,
        userApprovalStatus: "Desaprovado",
        approvedBy: "Não identificado"
      }
    });

    const today = new Date();
    await appendAuditLog({
      key: `doc-disapprove|${document.id}|${today.getTime()}`,
      type: "Desaprovação",
      documentId: document.id,
      documentName: document.title,
      actor: req.user.name,
      date: today,
      status: "Desaprovado",
      details: `Revisão desaprovada pelo usuário: ${req.user.name}. Documento retornou para revisão operacional.`
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Erro ao desaprovar revisão." });
  }
});

// Marcar Documento como Visualizado pelo Auditor
app.post("/api/documents/:id/auditor-viewed", verifyToken, async (req, res) => {
  if (req.user.role !== 'auditor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: "Apenas auditores e administradores podem marcar como visualizado." });
  }
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) return res.status(404).json({ message: "Documento não encontrado." });

    const today = new Date();
    const formattedDate = formatAuditDate(today);

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        auditorViewedAt: formattedDate,
        auditViewedBy: req.user.name
      }
    });

    await appendAuditLog({
      key: `audit-view|${document.id}|${today.getTime()}`,
      type: "Auditoria",
      documentId: document.id,
      documentName: document.title,
      actor: req.user.name,
      date: today,
      status: "Visualizado",
      details: `Documento visualizado e aprovado pelo auditor: ${req.user.name}`
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Erro ao marcar como visualizado." });
  }
});

// ==========================================
// Servir Frontend Compilado (React)
// ==========================================

// Servir arquivos estáticos do frontend compilado
app.use(express.static(path.join(root, "dist")));

// SPA Fallback: Middleware para servir index.html em rotas não encontradas
app.use((req, res) => {
  // Se não for requisição para /api/, servir index.html
  if (!req.path.startsWith("/api/")) {
    res.sendFile(path.join(root, "dist", "index.html"));
  } else {
    res.status(404).json({ message: "Endpoint não encontrado" });
  }
});

app.listen(port, () => {
  console.log(`API SGI documental disponível em http://localhost:${port}`);
});
