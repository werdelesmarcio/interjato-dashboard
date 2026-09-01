import { useState, useEffect, createContext } from "react";
import { Link, Outlet, useLocation } from 'react-router-dom';
import DocumentViewer from './DocumentViewer';
import {
  LogOut, Sun, Moon, AlertTriangle, FileText, User, Users, Shield,
  LayoutDashboard, BookOpen, GanttChartSquare
} from "lucide-react";

export const DashboardContext = createContext(null);

const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
};
const reviewStatus = (dateStr) => {
  const then = parseDate(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (months < 8) return { label: "Em dia" };
  if (months < 12) return { label: "Revisão próxima" };
  return { label: "Revisão atrasada" };
};

const roleLabels = {
  admin: "Administrador",
  auditor: "Auditor",
  operador: "Operador",
  operator: "Operador",
  user: "Usuário",
};

const NavLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        color: isActive ? '#E7ECF2' : '#8FA0B3',
        background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        transition: 'background 0.2s, color 0.2s'
      }}
    >
      <Icon size={18} color="#FF8F3D" />
      <span>{children}</span>
    </Link>
  );
};

export default function Dashboard({ user, onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [nonConformities, setNonConformities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ncDocument, setNcDocument] = useState(null);
  const [ncDescription, setNcDescription] = useState("");
  const [ncIsSubmitting, setNcIsSubmitting] = useState(false);
  const [showDelayedAlert, setShowDelayedAlert] = useState(false);
  const [isApprovingDoc, setIsApprovingDoc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [docsRes, logsRes, ncRes] = await Promise.all([
          fetch("/api/documents", { headers }),
          fetch("/api/audit-log", { headers }),
          fetch("/api/non-conformities", { headers })
        ]);

        if (!cancelled) {
          if (docsRes.ok) {
            const importedDocuments = await docsRes.json();
            setDocuments(importedDocuments);
            const delayedDocs = importedDocuments.filter(p => reviewStatus(p.date).label === "Revisão atrasada");
            if (delayedDocs.length > 0 && !sessionStorage.getItem('delayedAlertShown')) {
              setShowDelayedAlert(true);
            }
          }
          if (logsRes.ok) setAuditLogs(await logsRes.json());
          if (ncRes.ok) setNonConformities(await ncRes.json());
        }
      } catch (error) {
        console.warn("Erro ao carregar dados da API.", error);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleApprove = async (docId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${docId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Erro ao aprovar documento');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao aprovar documento: ' + error.message);
    }
  };

  const handleDisapprove = async (docId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${docId}/disapprove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Erro ao desaprovar documento');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao desaprovar documento: ' + error.message);
    }
  };

  const toggleRead = async (id, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${id}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Erro ao marcar revisão');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao marcar revisão: ' + error.message);
    }
  };

  const handleAuditorView = async (id, title, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${id}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Erro ao marcar documento como visualizado');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
      
      alert('✓ Documento marcado como visualizado pelo auditor');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro: ' + error.message);
    }
  };

  const handleSaveNonConformity = async (e) => {
    e.preventDefault();
    if (!ncDescription.trim()) {
      alert('Descrição obrigatória');
      return;
    }
    
    setNcIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/non-conformities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: ncDocument.id,
          documentName: ncDocument.title,
          description: ncDescription
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao registrar não-conformidade');
      }
      
      alert('✓ Não-conformidade registrada com sucesso');
      setNcDocument(null);
      setNcDescription('');
      
      // Recarregar não-conformidades
      const token2 = localStorage.getItem('authToken');
      const ncRes = await fetch('/api/non-conformities', { headers: { 'Authorization': `Bearer ${token2}` } });
      if (ncRes.ok) setNonConformities(await ncRes.json());
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro: ' + error.message);
    } finally {
      setNcIsSubmitting(false);
    }
  };

  const approveDocumentByUser = async (docId) => {
    setIsApprovingDoc(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${docId}/user-approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Erro ao aprovar revisão');
      
      alert('✓ Revisão aprovada com sucesso');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
      setSelected(null);
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsApprovingDoc(false);
    }
  };

  const disapproveDocumentByUser = async (docId) => {
    setIsApprovingDoc(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${docId}/user-disapprove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Erro ao desaprovar revisão');
      
      alert('✓ Revisão desaprovada');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
      setSelected(null);
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro: ' + error.message);
    } finally {
      setIsApprovingDoc(false);
    }
  };

  const markDocumentViewedByAuditor = async (docId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${docId}/auditor-viewed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Erro ao marcar documento como visto');
      
      // Recarregar documentos
      const docsRes = await fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (docsRes.ok) setDocuments(await docsRes.json());
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro: ' + error.message);
    }
  };

  const contextValue = {
    documents, auditLogs, nonConformities, user,
    selected, setSelected, ncDocument, setNcDocument,
    ncDescription, setNcDescription, ncIsSubmitting,
    handleApprove, handleDisapprove, toggleRead,
    handleAuditorView, handleSaveNonConformity,
    approveDocumentByUser, disapproveDocumentByUser, markDocumentViewedByAuditor
  };

  return (
<DashboardContext.Provider value={contextValue}>
  <div style={{
    display: 'flex',
   // flexDirection: 'row',
    height: '100dvh',
    width: '100%',
    overflow: 'hidden',
    background: '#0A0E13', // Cor 'canvas'
    color: '#E7ECF2',
    fontFamily: "'Oxanium', sans-serif"
  }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@300;400;500;600;700;800&display=swap');
      * { box-sizing: border-box; }
    `}</style>
    
    {/* COLUNA ESQUERDA: Sidebar */}
    <aside style={{
      width: '258px',
      background: '#121821', // Cor 'surface'
      borderRight: '1px solid #1E2836',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      overflowY: 'auto'
    }}>
      
      <div style={{ paddingBottom: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #1E2836' }}>
         <div className="mono" style={{ fontSize: 14, letterSpacing: "0.1em", color: "#FF8F3D", fontWeight: 700 }}>SGI · INTERJATO</div>
         <div className="mono" style={{ fontSize: 10, color: "#56667A" }}>ISO/IEC 27001 · 20000-1</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <NavLink to="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
        <NavLink to="/documents" icon={BookOpen}>Documentos</NavLink>
        <NavLink to="/non-conformities" icon={AlertTriangle}>Não-Conformidades</NavLink>
        <NavLink to="/logs" icon={GanttChartSquare}>Logs</NavLink>
        {user.role === 'admin' && <NavLink to="/users" icon={Users}>Usuários</NavLink>}
      </nav>

      <div style={{ borderTop: '1px solid #1E2836', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <User size={20} color="#FF8F3D"/>
          <div>
            <div style={{ fontSize: 14,fontWeight: 500, color: '#E7ECF2' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#8FA0B3' }}>{roleLabels[user.role] || "Usuário"}</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/profile" style={{ flex: 1, textAlign: 'center', background: '#1B2530', border: '1px solid #33445A', color: '#8FA0B3', borderRadius: 8, padding: '8px', textDecoration: 'none', fontSize: 10 }}>
            Meu Perfil
          </Link>
          <button onClick={onLogout} title="Sair" style={{ background: '#1B2530', border: '1px solid #33445A', color: '#8FA0B3', borderRadius: 8, padding: '8px', cursor: 'pointer' }}>
            <LogOut size={15} color="#FF8F3D" />
          </button>
        </div>
      </div>
    </aside>

    {/* COLUNA CENTRAL: Conteúdo Principal */}
    <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0E13' // Cor de fundo do canvas para a área de conteúdo
    }}>
        <header style={{
            height: '70px',
            borderBottom: '1px solid #1E2836',
            flexShrink: 0,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            background: '#121821' // Cor 'surface' para o header
        }}>
            {/* O conteúdo do Header pode ser dinâmico no futuro */}
            <h2 style={{margin: 0, fontSize: 18, fontWeight: 600}}>Visão Geral</h2>
        </header>
        <main style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px'
        }}>
            <Outlet />
        </main>
    </div>

    {/* Visualizador do documento selecionado */}
    <DocumentViewer key={selected?.id} document={selected} onClose={() => setSelected(null)} />

    {/* Modal de Não-Conformidade */}
    {ncDocument && (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: '#121821',
          border: '1px solid #1E2836',
          borderRadius: 12,
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#E7ECF2' }}>Registrar Não-Conformidade</h2>
            <button
              onClick={() => setNcDocument(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8FA0B3',
                cursor: 'pointer',
                fontSize: 24
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSaveNonConformity}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#8FA0B3', marginBottom: '6px', fontWeight: 500 }}>
                Documento Afetado
              </label>
              <input
                type="text"
                value={ncDocument?.title || ''}
                disabled
                style={{
                  width: '100%',
                  background: '#1B2530',
                  border: '1px solid #1E2836',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#8FA0B3',
                  fontSize: 12
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#8FA0B3', marginBottom: '6px', fontWeight: 500 }}>
                ID do Documento
              </label>
              <input
                type="text"
                value={ncDocument?.id || ''}
                disabled
                style={{
                  width: '100%',
                  background: '#1B2530',
                  border: '1px solid #1E2836',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#8FA0B3',
                  fontSize: 12
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#8FA0B3', marginBottom: '6px', fontWeight: 500 }}>
                Descrição da Não-Conformidade (máx. 5000 caracteres)
              </label>
              <textarea
                value={ncDescription}
                onChange={(e) => setNcDescription(e.target.value)}
                placeholder="Descreva detalhadamente o desvio ou não-conformidade encontrada..."
                maxLength={5000}
                rows={6}
                style={{
                  width: '100%',
                  background: '#1B2530',
                  border: '1px solid #1E2836',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#E7ECF2',
                  fontSize: 12,
                  fontFamily: "'Oxanium', sans-serif",
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
              <div style={{ fontSize: 10, color: '#56667A', marginTop: '4px', textAlign: 'right' }}>
                {ncDescription.length} / 5000
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={ncIsSubmitting}
                style={{
                  flex: 1,
                  background: '#FF5D5D',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px',
                  color: '#0A0E13',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: ncIsSubmitting ? 'not-allowed' : 'pointer',
                  opacity: ncIsSubmitting ? 0.5 : 1
                }}
              >
                {ncIsSubmitting ? 'Salvando...' : 'Registrar Não-Conformidade'}
              </button>
              <button
                type="button"
                onClick={() => setNcDocument(null)}
                style={{
                  flex: 1,
                  background: '#1B2530',
                  border: '1px solid #33445A',
                  borderRadius: 6,
                  padding: '10px',
                  color: '#8FA0B3',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
</DashboardContext.Provider>
  );
}