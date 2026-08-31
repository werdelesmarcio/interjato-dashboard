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

  const handleApprove = async (docId) => { /* ... */ };
  const handleDisapprove = async (docId) => { /* ... */ };
  const toggleRead = async (id, e) => { /* ... */ };
  const handleAuditorView = async (id, title, e) => { /* ... */ };
  const handleSaveNonConformity = async (e) => { /* ... */ };

  const contextValue = {
    documents, auditLogs, nonConformities, user,
    selected, setSelected, ncDocument, setNcDocument,
    ncDescription, setNcDescription, ncIsSubmitting,
    handleApprove, handleDisapprove, toggleRead,
    handleAuditorView, handleSaveNonConformity
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
            <div style={{ fontSize: 12, color: '#8FA0B3' }}>{user.role}</div>
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
  </div>
</DashboardContext.Provider>
  );
}