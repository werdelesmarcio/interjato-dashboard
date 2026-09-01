import { useState, useMemo, useContext } from "react";
import { Search, CheckCircle2, FileText, Flame, Zap, HeartPulse, WifiOff, Activity, Radar, Gauge } from "lucide-react";
import { DashboardContext } from './Dashboard';

// Ícones e funções utilitárias necessárias para este componente
const ICONS = { Flame, Zap, HeartPulse, WifiOff, Activity, Radar, Gauge, FileText };

const CATEGORY_ACCENT = {
  "Continuidade": "#FF8F3D", "Capacidade": "#4FA3FF", "Instrução de Trabalho": "#B892FF",
  "Política": "#FF5D5D", "Procedimento": "#cb1414", "Declaração de Aplicabilidade": "#2FD9A8",
  "Registros": "#F472B6",
};

const getAccent = (category) => CATEGORY_ACCENT[category] || "#8FA0B3";
const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [day, month, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
};
const monthsSince = (dateStr) => {
    const then = parseDate(dateStr);
    const now = new Date();
    return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
};
const reviewStatus = (dateStr) => {
    const m = monthsSince(dateStr);
    if (m < 8) return { label: "Em dia", color: "#2FD9A8" };
    if (m < 12) return { label: "Revisão próxima", color: "#FFC24D" };
    return { label: "Revisão atrasada", color: "#FF5D5D" };
};

const getDocumentStatus = (doc) => {
  // Se tem não-conformidade aguardando ajustes
  if (doc.hasNonConformity && !doc.nonConformityResolvedAt) {
    return {
      label: "Aguardando ajustes de Não-Conformidade",
      color: "#FFC24D",
      borderColor: "#FFC24D"
    };
  }

  // Se foi resolvida a NC ou auditor viu e aprovou
  if (doc.auditorViewedAt) {
    return {
      label: "Aprovado para a ISO",
      color: "#2FD9A8",
      borderColor: "#2FD9A8"
    };
  }

  // Se está aguardando vistas do auditor
  if (doc.approvedBy !== "Não identificado" && !doc.auditorViewedAt) {
    return {
      label: "Aguardando Vistas do Auditor",
      color: "#4FA3FF",
      borderColor: "#4FA3FF"
    };
  }

  // Se está aguardando aprovação do usuário
  if (doc.needsReview === false && doc.approvedBy === "Não identificado") {
    return {
      label: "Aguardando Aprovação",
      color: "#FFC24D",
      borderColor: "#FFC24D"
    };
  }

  // Se está aguardando revisão do operador
  return {
    label: "Aguardando revisão",
    color: "#FF8F3D",
    borderColor: "#1E2836"
  };
};

export default function Documents() {
  const { documents, user, setSelected, handleAuditorView, toggleRead, setNcDocument } = useContext(DashboardContext);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");

  const filtered = useMemo(() => {
    // Adiciona uma verificação para garantir que documents não seja nulo ou indefinido
    if (!documents) return [];
    
    const q = query.trim().toLowerCase();
    return documents.filter((p) => {
      if (categoryFilter !== "Todos" && p.category !== categoryFilter) return false;
      if (!q) return true;
      const searchableText = `${p.id} ${p.title}`.toLowerCase();
      return searchableText.includes(q);
    });
  }, [documents, query, categoryFilter]);

  const groupedDocuments = useMemo(() => {
    const groups = filtered.reduce((acc, doc) => {
      const category = doc.category || 'Outros';
      if (!acc[category]) acc[category] = [];
      acc[category].push(doc);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Adiciona um estado de carregamento ou mensagem de "nenhum documento"
  if (!documents) {
    return <div>Carregando documentos...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Documentos do SGI</h1>
      <p style={{ color: "#8FA0B3", fontSize: 12, margin: "0 0 0.75rem" }}>
        Navegue e gerencie os documentos e processos do Sistema de Gestão Integrado.
      </p>
      
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", width: "160px", maxWidth: "100%" }}>
          <Search size={15} color="#56667A" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            className="dashboard-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            style={{
              width: "100%", background: "#121821", border: "1px solid #1E2836", borderRadius: 8,
              padding: "10px 12px 10px 36px", color: "#E7ECF2", fontSize: 12, outline: "none",
            }}
          />
        </div>
        {["Todos", "Continuidade", "Instrução de Trabalho", "Política", "Procedimento", "Declaração de Aplicabilidade", "Registros", "Manual"].map((c) => (
          <button
            key={c}
            className="filter-chip light-theme-control"
            onClick={() => setCategoryFilter(categoryFilter === c ? "Todos" : c)}
            style={{
              background: categoryFilter === c ? "#1B2530" : "transparent",
              border: `1px solid ${categoryFilter === c ? "#33445A" : "#1E2836"}`,
              color: categoryFilter === c ? "#E7ECF2" : "#8FA0B3",
              borderRadius: 20, padding: "8px 16px", fontSize: 11, cursor: "pointer", fontWeight: 500,
            }}
          >
            {c}
          </button>
        ))}
        <span className="mono" style={{ fontSize: 12, color: "#56667A", marginLeft: "auto" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div>
        {groupedDocuments.map(([category, plans]) => (
          <section key={category} style={{ marginBottom: '2.5rem' }}>
            <h3 className="mono" style={{ fontSize: 13, color: '#8FA0B3', letterSpacing: '0.08em', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1E2836' }}>
              {category}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {plans.map((plan) => {
                const Icon = ICONS[plan.icon] || FileText;
                const status = reviewStatus(plan.date);
                const accent = getAccent(plan.category);
                return (
                  <div
                    key={plan.id}
                    className="plan-card"
                    onClick={() => setSelected(plan)}
                    style={{
                      background: "#121821", 
                      border: `2px solid ${getDocumentStatus(plan).borderColor}`, 
                      borderRadius: 10,
                      padding: "16px", cursor: "pointer", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accent}1F`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={17} color={accent} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: status.color }} />
                        <span className="mono" style={{ fontSize: 10.5, color: status.color }}>{status.label}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: 11, color: accent, marginBottom: 4, fontWeight: 600 }}>{plan.id} · REV {plan.rev}</div>
                      <div className="plan-title" style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: "#E7ECF2" }}>{plan.title}</div>
                      {plan.auditorViewedAt ? (
                        <div className="plan-needs-review" style={{ marginTop: 8, color: "#2FD9A8", fontSize: 11.5, lineHeight: 1.35 }}>
                          Este documento foi aprovado pelo Auditor
                        </div>
                      ) : plan.needsReview ? (
                        <div className="plan-needs-review" style={{ marginTop: 8, color: "#FFC24D", fontSize: 11.5, lineHeight: 1.35 }}>
                          Documento alterado. Este arquivo precisa ser revisado.
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      <span className="plan-category" style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 8, background: `${accent}1F`, color: accent }}>
                        {plan.category}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid #1E2836" }}>
                      <div>
                        <div className="plan-approved-by" style={{ fontSize: 11.5, color: getDocumentStatus(plan).color, fontWeight: 600 }}>
                          {getDocumentStatus(plan).label}
                        </div>
                        <div className="mono" style={{ fontSize: 10.5, color: "#56667A" }}>{plan.date}</div>
                      </div>
                      {(user.role === 'operador' || user.role === 'operator' || user.role === 'admin') && (
                        <button
                          onClick={(e) => toggleRead(plan.id, e)}
                          title={plan.needsReview ? "Marcar como revisado" : "Desmarcar revisão"}
                          className="plan-toggle-read"
                          style={{
                            display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer",
                            color: plan.needsReview ? "#56667A" : "#2FD9A8", fontSize: 11, padding: 4,
                          }}
                        >
                          <CheckCircle2 size={15} fill={plan.needsReview ? "none" : "#2FD9A8"} color={plan.needsReview ? "#56667A" : "#0A0E13"} strokeWidth={plan.needsReview ? 1.6 : 0} />
                          <span>Revisado</span>
                        </button>
                      )}
                    </div>
                    {user.role === 'auditor' && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #1E2836" }}>
                        <button
                          onClick={(e) => handleAuditorView(plan.id, plan.title, e)}
                          className="filter-chip light-theme-control"
                          style={{
                            flex: 1, background: "#1B2530", border: "1px solid #33445A", color: "#2FD9A8",
                            borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                          }}
                        >
                          Visualizado pelo Auditor
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setNcDocument(plan); }}
                          className="filter-chip light-theme-control"
                          style={{
                            flex: 1, background: "rgba(255,93,93,0.1)", border: "1px solid rgba(255,93,93,0.3)", color: "#FF5D5D",
                            borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                          }}
                        >
                          Registrar Não-Conformidade
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem 0", color: "#56667A" }}>
            Nenhum documento encontrado para essa busca.
          </div>
        )}
      </div>
    </div>
  );
}
