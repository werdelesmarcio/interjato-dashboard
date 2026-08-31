import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

const CODE_PATTERN = /\b((?:POL|PL|PG|IT|REG)[-\s]?\d{2,})\b/i;

function categoryFor(code) {
  const upper = (code || "").toUpperCase().replace(/\s+/g, "-");
  if (upper.startsWith("POL-")) return "Política";
  if (upper.startsWith("IT-")) return "Instrução de Trabalho";
  if (upper.startsWith("PG-")) return "Procedimento";
  if (upper === "SOA") return "Declaração de Aplicabilidade";
  if (upper.startsWith("PL-")) return "Continuidade";
  if (upper.startsWith("REG-")) return "Registros";
  return "Manual";
}

function cleanCasing(str) {
  if (!str) return "";
  const cleanStr = str.replace(/\s+/g, " ").trim();
  const prepositions = ["de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "o", "a", "os", "as", "um", "uma"];
  
  return cleanStr
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && prepositions.includes(word)) return word;
      // Preservar siglas conhecidas em maiúsculo
      const cleanWord = word.replace(/[^a-z0-9]/gi, "");
      if (["soc", "sgi", "iso", "iec", "okr", "ripd", "zabbix", "ddos"].includes(cleanWord)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function extractTitle(html, text, filePath, code) {
    const cleanCode = (code || "").toUpperCase().replace(/\s+/g, "");
    
    // Mapeamento de Overrides para casos excepcionais de formatação complexa ou arquivos externos
    const overrides = {
      "IT 09": "Elaboração de Relatos de Serviços",
      "IT_09": "Elaboração de Relatos de Serviços",
      "PG-19": "Proteção de Dados Pessoais",
      "REG-16": "Levantamento de Requisitos Legais Aplicáveis",
      "REG-17": "Plano de Ação para Controle de Riscos",
      "SoA": "Declaração de Aplicabilidade (SoA)",
      "SOA": "Declaração de Aplicabilidade (SoA)",
      "POL-02": "Controle de Segurança Física",
    };

    if (overrides[code]) return overrides[code];
    if (overrides[cleanCode]) return overrides[cleanCode];

    let title = "";

    // Tratamento especial para Planos de Continuidade (PL) extraírem o título correto que vem depois de "PLANO DE CONTINUIDADE"
    if (code && code.toUpperCase().startsWith("PL")) {
        const cleanText = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
        const match = cleanText.match(/PLANO DE CONTINUIDADE\s+([^0-9]+?)\s+PL\s*-\s*\d+/i);
        if (match && match[1]) {
            return `Plano de Continuidade - ${cleanCasing(match[1].trim())}`;
        }
    }

    // Heurística de multi-linhas para PDFs corporativos (IT-03, MSGSI, PG-06)
    if (code) {
        // Encontrar o código do documento no texto, aceitando espaços opcionais ao redor do hífen
        const codeRegex = new RegExp(code.replace(/[-\s_]/g, "\\s*[-\\s_]?\\s*"), "i");
        const codeIndex = text.search(codeRegex);
        if (codeIndex > 0 && codeIndex < 1000) {
            const preCodeText = text.substring(0, codeIndex);
            const lines = preCodeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const cleanLines = lines.filter(l => {
                if (/^\d+$/.test(l)) return false; // Excluir número de página isolado "1"
                if (/^(REV|DATA|APROVADO|REVISÃO|CÓDIGO|ELABORAÇÃO)/i.test(l)) return false;
                return true;
            });
            // Pegar as últimas duas linhas se a penúltima linha terminar com conjunção/preposição ou hífen
            if (cleanLines.length >= 2) {
                const penult = cleanLines[cleanLines.length - 2];
                const last = cleanLines[cleanLines.length - 1];
                if (penult.endsWith("-") || /\b(?:de|da|do|das|dos|e|em|para|por|com|o|a|os|as)$/i.test(penult)) {
                    const joined = penult.endsWith("-") ? `${penult}${last}` : `${penult} ${last}`;
                    title = joined;
                } else {
                    title = last;
                }
            } else if (cleanLines.length === 1) {
                title = cleanLines[0];
            }
        }
    }

    if (!title && html) {
        const $ = cheerio.load(html);
        const firstTable = $("table").first();
        if (firstTable.length) {
            const firstRow = firstTable.find("tr").first();
            title = firstRow.find("td, th").first().text().replace(/\s+/g, " ").trim();
            if (!title || /\b(?:POL|PL|PG|IT|REG)[-_]\d{2,}\b/i.test(title)) {
                title = firstTable.find("td, th").toArray()
                    .map((cell) => $(cell).text().replace(/\s+/g, " ").trim())
                    .find((cell) => cell.length > 5 && !/\b(?:POL|PL|PG|IT|REG)[-_]\d{2,}\b/i.test(cell)) || "";
            }
        }
    }
    
    if (title && title.length > 5) {
        title = title.replace(CODE_PATTERN, "").replace(/\s+/g, " ").trim();
    }

    if (!title) {
        if (code === "SOA") return "Declaração de aplicabilidade (SoA)";

        const headerText = text.substring(0, 1500);
        const headerLines = headerText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const titleLine = headerLines.find(line =>
            line.length > 5 && line.length < 120 &&
            !/^(REV|DATA|APROVADO|REVISÃO|CÓDIGO|ELABORAÇÃO)/i.test(line) &&
            !/^\d{2}\/\d{2}\/\d{4}$/.test(line) && !/^\d+$/.test(line) &&
            !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)
        );
        title = (titleLine || '').trim() || path.basename(filePath, path.extname(filePath));
    }

    // Limpeza final de códigos redundantes, hifens e revisões ao final do título
    title = title
      .replace(/^[\s\-]*--\s*\d+\s+of\s+\d+\s*--\s*/i, "") // Remove cabeçalhos redundantes de paginação
      .replace(/\s+(?:POL|PL|PG|IT|REG|R)[-_\s]?\d{2,}.*$/i, "") // Remove sufixos como "IT-04", "PG-01", etc.
      .replace(/\s+REV\s+\d+.*$/i, "") // Remove "REV 0", "REV 6"
      .replace(/\s+R\s*\d+\s*$/i, "") // Remove "R_20" residual
      .trim();

    return cleanCasing(title);
}

function extractRevisionData(text) {
    const headerEndMarker = "OBJETIVO";
    const headerText = text.substring(0, text.toUpperCase().indexOf(headerEndMarker) > -1 ? text.toUpperCase().indexOf(headerEndMarker) : 1500);
    const revisions = [];
    
    // Normalizar quebras de linha e espaços para capturar revisões de forma robusta
    const lines = headerText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let parsingRevs = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^REV\s+DATA\s+MOTIVO/i.test(line)) {
            parsingRevs = true;
            continue;
        }
        if (/^REV\s+DATA\s+APROVAÇÃO/i.test(line) || /^SUMÁRIO/i.test(line) || /^1\.\s+RESUMO/i.test(line)) {
            parsingRevs = false;
        }

        if (parsingRevs) {
            // Tenta casar padrão de linha de revisão: Número da Rev (0-9) + Data (DD/MM/AAAA) + Motivo/Detalhes
            const match = line.match(/^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
            if (match) {
                let revNum = match[1];
                let dateStr = match[2];
                let motivoStr = match[3];

                // Verificar se a próxima linha complementa o motivo (ex: quebras de linha em "Reaprovação do / documento")
                if (i + 1 < lines.length && !/^\d+\s+\d{2}\/\d{2}\/\d{4}/.test(lines[i + 1]) && !/^REV\s+DATA/i.test(lines[i + 1])) {
                    const nextLine = lines[i + 1];
                    if (!/^(Gerente|Diretor|CEO|Nenhum|Inserido|Atualizados)/i.test(nextLine) && nextLine.length < 30) {
                        motivoStr += " " + nextLine;
                        i++;
                    }
                }

                if (motivoStr && !/^(Gerente|Diretor|CEO)/i.test(motivoStr)) {
                    revisions.push({ rev: revNum, data: dateStr, motivo: motivoStr.trim(), itens: "" });
                }
            }
        }
    }

    return { revisions };
}

async function extractAndProcessContent(filePath) {
    const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

    const stats = await fs.stat(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Arquivo excede o limite de tamanho de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
    }

    const buffer = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    let rawText, rawHtml;

    if (extension === ".pdf") {
        const data = await new PDFParse({ data: buffer }).getText();
        rawText = data.text;
        rawHtml = rawText.split(/\n\s*\n/).map(p => `<p>${p.replace(/\r?\n/g, ' ').trim()}</p>`).join('');
    } else if (extension === ".docx") {
        const [textResult, htmlResult] = await Promise.all([
            mammoth.extractRawText({ buffer }),
            mammoth.convertToHtml({ buffer,
                styleMap: [
                    "p[style-name^='Header'] => !", 
                    "p[style-name^='Footer'] => !",
                ],
                ignoreEmptyParagraphs: false,
            }),
        ]);
        rawText = textResult.value;
        rawHtml = htmlResult.value;
    } else {
        throw new Error('Unsupported file type');
    }

    const $ = cheerio.load(rawHtml);
    const titleHtml = $.html();

    return { buffer, text: rawText, titleHtml, html: $.html() };
}

export async function importDocument(filePath, documentsRoot) {
    const { buffer, text, titleHtml, html: rawHtml } = await extractAndProcessContent(filePath);

    // Sanitize HTML content to prevent XSS
    const window = new JSDOM('').window;
    const purify = DOMPurify(window);
    const html = purify.sanitize(rawHtml);
  
    const id = path.basename(filePath).match(CODE_PATTERN)?.[1]?.toUpperCase() || path.basename(filePath, path.extname(filePath));
    const category = categoryFor(id);
    const title = extractTitle(titleHtml, text, filePath, id);
  const { revisions } = extractRevisionData(text);
  const date = revisions.at(-1)?.data || text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1] || new Date().toLocaleDateString('pt-BR');
  const revision = revisions.at(-1)?.rev || "0";

  return {
    id,
    title,
    category,
    icon: category === "Política" ? "ListChecks" : category === "Capacidade" ? "Gauge" : category === "Instrução de Trabalho" ? "Database" : category === "Registros" ? "ScrollText" : "FileText",
    rev: revision,
    date,
    approvedBy: "Não identificado",
    revisoes: revisions.length ? revisions : [{ rev: revision, data: date, motivo: "Importado do documento", itens: "" }],
    contentHtml: html,
    sourceFile: path.relative(documentsRoot, filePath),
    sourceHash: crypto.createHash("sha256").update(buffer).digest("hex"),
    updatedAt: new Date().toISOString(),
  };
}
