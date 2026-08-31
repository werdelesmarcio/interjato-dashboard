import { useEffect, useState } from "react";
import { X, ExternalLink, FileText, AlignLeft } from "lucide-react";

// Utilitários mantidos locais para o componente ficar autônomo, como nos demais.
const CATEGORY_ACCENT = {
  "Continuidade": "#FF8F3D", "Capacidade": "#4FA3FF", "Instrução de Trabalho": "#B892FF",
  "Política": "#FF5D5D", "Procedimento": "#FFC24D", "Declaração de Aplicabilidade": "#2FD9A8",
  "Registros": "#F472B6",
};

const getAccent = (category) => CATEGORY_ACCENT[category] || "#8FA0B3";

const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
};

const reviewStatus = (dateStr) => {
  const then = parseDate(dateStr);
  const now = new Date();
  const m = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (m < 8) return { label: "Em dia", color: "#2FD9A8" };
  if (m < 12) return { label: "Revisão próxima", color: "#FFC24D" };
  return { label: "Revisão atrasada", color: "#FF5D5D" };
};

// O contentHtml vem do texto bruto do PDF sem escape (server/importer.js), logo
// nao pode ir para dangerouslySetInnerHTML. Vai num iframe sandbox="" (sem
// scripts e sem acesso a origem), com o estilo injetado junto.
const buildPreviewDoc = (contentHtml) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 20px; background: #101720; color: #C4CEDA;
         font: 13.5px/1.7 'Oxanium', system-ui, sans-serif; overflow-wrap: anywhere; }
  h1, h2, h3, h4, h5, h6, strong, b { color: #E7ECF2; line-height: 1.35; }
  h1 { font-size: 1.35rem; } h2 { font-size: 1.2rem; }
  h3, h4, h5, h6 { font-size: 1rem; }
  p { margin: 0 0 1rem; white-space: pre-wrap; }
  a { color: #4FA3FF; }
  table { width: 100%; margin: 1.25rem 0; border-collapse: collapse; font-size: 12.5px; }
  th, td { padding: 10px 12px; border: 1px solid #2A3747; text-align: left; vertical-align: top; }
  th { background: #1A2633; color: #E7ECF2; font-size: 11px; text-transform: uppercase; }
  img { max-width: 100%; height: auto; }
</style></head><body>${contentHtml || "<p>Sem texto extraído para este documento.</p>"}</body></html>`;

const TabButton = ({ active, icon: Icon, children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
      background: active ? "#1B2530" : "transparent",
      border: `1px solid ${active ? "#33445A" : "#1E2836"}`,
      color: active ? "#E7ECF2" : "#8FA0B3",
      borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600,
    }}
  >
    <Icon size={14} />
    <span>{children}</span>
  </button>
);

export default function DocumentViewer({ document: doc, onClose }) {
  const [tab, setTab] = useState("pdf");

  useEffect(() => {
    if (!doc) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doc, onClose]);

  if (!doc) return null;

  const accent = getAccent(doc.category);
  const status = reviewStatus(doc.date);
  const fileUrl = `/api/documents/${encodeURIComponent(doc.id)}/file`;
  const revisions = [...(doc.revisoes || [])].reverse();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(4,6,9,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "3vh 3vw",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        style={{
          background: "#0D1218", border: "1px solid #1E2836", borderRadius: 12,
          width: "100%", maxWidth: 1180, maxHeight: "94vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <header style={{
          display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 20px",
          borderBottom: "1px solid #1E2836", background: "#121821", flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mono" style={{ fontSize: 11, color: accent, fontWeight: 600, marginBottom: 4 }}>
              {doc.id} · REV {doc.rev}
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#E7ECF2", lineHeight: 1.3 }}>
              {doc.title}
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 8, background: `${accent}1F`, color: accent }}>
                {doc.category}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: status.color }} />
                <span className="mono" style={{ fontSize: 10.5, color: status.color }}>{status.label}</span>
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "#56667A" }}>{doc.date}</span>
              <span style={{ fontSize: 11.5, color: doc.approvedBy === "Não identificado" ? "#FFC24D" : "#8FA0B3" }}>
                {doc.approvedBy === "Não identificado" ? "Pendente para aprovação" : `Aprovado por: ${doc.approvedBy}`}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              title="Abrir em nova aba"
              style={{
                display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
                background: "#1B2530", border: "1px solid #33445A", color: "#8FA0B3",
                borderRadius: 8, padding: "8px 12px", fontSize: 12,
              }}
            >
              <ExternalLink size={14} />
              <span>Nova aba</span>
            </a>
            <button
              onClick={onClose}
              title="Fechar (Esc)"
              style={{
                background: "#1B2530", border: "1px solid #33445A", color: "#8FA0B3",
                borderRadius: 8, padding: 8, cursor: "pointer", display: "flex",
              }}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div style={{ display: "flex", gap: 8, padding: "12px 20px 0", flexShrink: 0 }}>
          <TabButton active={tab === "pdf"} icon={FileText} onClick={() => setTab("pdf")}>Documento</TabButton>
          <TabButton active={tab === "text"} icon={AlignLeft} onClick={() => setTab("text")}>Texto extraído</TabButton>
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: "12px 20px 20px", overflowY: "auto" }}>
          {tab === "pdf" ? (
            <iframe
              key={doc.id}
              className="document-viewer"
              src={fileUrl}
              title={`Documento ${doc.id}`}
            />
          ) : (
            <iframe
              key={`${doc.id}-text`}
              className="document-viewer"
              sandbox=""
              srcDoc={buildPreviewDoc(doc.contentHtml)}
              title={`Texto extraído de ${doc.id}`}
              style={{ background: "#101720" }}
            />
          )}

          {revisions.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="mono" style={{ fontSize: 10, color: "#56667A", letterSpacing: "0.08em", marginBottom: 8 }}>
                HISTÓRICO DE REVISÕES · {revisions.length}
              </div>
              <div style={{ border: "1px solid #1E2836", borderRadius: 8, overflow: "hidden" }}>
                {revisions.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 12, padding: "8px 12px", fontSize: 12,
                      borderTop: i === 0 ? "none" : "1px solid #1E2836",
                      background: i % 2 ? "rgba(26,38,51,0.42)" : "transparent",
                    }}
                  >
                    <span className="mono" style={{ color: "#56667A", flexShrink: 0, width: 80 }}>{r.data}</span>
                    <span className="mono" style={{ color: "#4FA3FF", flexShrink: 0, width: 52 }}>REV {r.rev}</span>
                    <span style={{ color: "#C4CEDA", minWidth: 0 }}>{r.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
