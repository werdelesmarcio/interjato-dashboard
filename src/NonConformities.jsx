import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Search, CheckCircle2, ClipboardCheck, X } from 'lucide-react';

function getUserFromToken() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error("Falha ao decodificar o token:", error);
    return null;
  }
}

export default function NonConformities({ user: propUser }) {
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const user = useMemo(() => propUser || getUserFromToken(), [propUser]);

  // Modais de tratamento e aprovação
  const [treatingNc, setTreatingNc] = useState(null);
  const [treatmentDesc, setTreatmentDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNonConformities = async () => {
    try {
      const response = await fetch('/api/non-conformities', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!response.ok) throw new Error('Não foi possível carregar as não-conformidades.');
      setList(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNonConformities();
  }, []);

  const handleTreatSubmit = async (e) => {
    e.preventDefault();
    if (!treatmentDesc.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/non-conformities/${treatingNc.id}/treat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ treatmentDesc })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao registrar tratamento.');
      }
      alert('Tratamento registrado com sucesso!');
      setTreatingNc(null);
      setTreatmentDesc('');
      loadNonConformities();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTreatment = async (ncId) => {
    if (!confirm('Tem certeza de que deseja aprovar o tratamento dessa não-conformidade?')) return;
    try {
      const response = await fetch(`/api/non-conformities/${ncId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao aprovar tratamento.');
      }
      alert('Tratamento aprovado com sucesso! A não-conformidade foi solucionada.');
      loadNonConformities();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return list.filter((nc) => {
      if (!normalizedQuery) return true;
      return [nc.documentName, nc.documentId, nc.auditorName, nc.description, nc.status, nc.operatorName, nc.approverName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [list, query]);

  if (isLoading) return <div style={{ color: '#8FA0B3', padding: '2rem 0' }}>Carregando não-conformidades...</div>;
  if (error) return <div style={{ color: '#FF5D5D', padding: '2rem 0' }}>{error}</div>;

  return (
    <div className="logs-page" style={{ padding: '0.25rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        
        <div>
          <h2 style={{ fontSize: 20,fontWeight: 600, margin: 0 }}>Não-Conformidades Registradas</h2>
          <p style={{ color: '#8FA0B3', margin: '5px 0 0', fontSize: 12 }}>Apontamentos, ações de tratamentos e auditorias realizadas no SGI.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} color="#56667A" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="logs-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por documento, auditor, operador ou descrição" />
        </div>
      </div>

      <div className="logs-table-wrap">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Data Abertura</th>
              <th>Documento</th>
              <th>Auditor</th>
              <th>Descrição do Desvio</th>
              <th>Status</th>
              <th>Tratamento (Ação Operacional)</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((nc) => (
              <tr key={nc.id}>
                <td className="logs-date">{nc.date}</td>
                <td>
                  <strong>{nc.documentName}</strong>
                  <small>{nc.documentId}</small>
                </td>
                <td>{nc.auditorName}</td>
                <td style={{ whiteSpace: 'pre-wrap', maxWidth: '300px', lineHeight: '1.4' }}>{nc.description}</td>
                <td>
                  <span 
                    className="logs-status" 
                    style={{ 
                      color: nc.status === 'Aprovada' ? '#2FD9A8' : nc.status === 'Tratada' ? '#FFC24D' : '#FF5D5D',
                      fontWeight: 600,
                      background: nc.status === 'Aprovada' ? 'rgba(47,217,168,0.08)' : nc.status === 'Tratada' ? 'rgba(255,194,77,0.08)' : 'rgba(255,93,93,0.08)',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      border: `1px solid ${nc.status === 'Aprovada' ? 'rgba(47,217,168,0.2)' : nc.status === 'Tratada' ? 'rgba(255,194,77,0.2)' : 'rgba(255,93,93,0.2)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {nc.status === 'Aprovada' ? '🟢' : nc.status === 'Tratada' ? '🟡' : '🔴'}
                    </span>
                    <span>{nc.status}</span>
                  </span>
                </td>
                <td style={{ maxWidth: '320px', fontSize: '12.5px', color: '#cbd5e1' }}>
                  {nc.treatmentDesc ? (
                    <div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.35', marginBottom: '4px' }}>{nc.treatmentDesc}</div>
                      <small style={{ color: '#8FA0B3', fontSize: '10.5px' }}>
                        Tratado por: <strong>{nc.operatorName}</strong> em {nc.treatmentDate}
                      </small>
                      {nc.status === 'Aprovada' && (
                        <div style={{ marginTop: '4px', color: '#2FD9A8', fontSize: '10.5px' }}>
                          ✓ Aprovado por <strong>{nc.approverName}</strong> em {nc.approvalDate}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#56667A', fontStyle: 'italic' }}>Aguardando ação corretiva</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {nc.status === 'Pendente' && (user?.role === 'operador' || user?.role === 'operator' || user?.role === 'admin') && (
                      <button 
                        onClick={() => setTreatingNc(nc)}
                        className="add-user-button"
                        style={{ padding: '6px 12px', fontSize: '11px', background: '#FF8F3D', border: 'none', borderRadius: '6px', color: '#1A1006', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle2 size={13} />
                        Ajustar NC
                      </button>
                    )}
                    {nc.status === 'Tratada' && (user?.role === 'user' || user?.role === 'admin') && (
                      <button 
                        onClick={() => handleApproveTreatment(nc.id)}
                        className="add-user-button"
                        style={{ padding: '6px 12px', fontSize: '11px', background: '#2FD9A8', border: 'none', borderRadius: '6px', color: '#1A2633', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ClipboardCheck size={13} />
                        Aprovar alterações nas não-conformidades
                      </button>
                    )}
                    {nc.status === 'Pendente' && (user?.role === 'user' || user?.role === 'auditor') && (
                      <span style={{ color: '#56667A', fontSize: '11.5px' }}>Sob análise do Operador</span>
                    )}
                    {nc.status === 'Tratada' && (user?.role === 'operador' || user?.role === 'operator') && (
                      <span style={{ color: '#8FA0B3', fontSize: '11.5px' }}>Aguardando aprovação de Usuário</span>
                    )}
                    {nc.status === 'Aprovada' && (
                      <span style={{ color: '#2FD9A8', fontSize: '11.5px', fontWeight: 600 }}>✓ Solucionada</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredList.length === 0 && <div className="logs-empty">Nenhuma não-conformidade registrada.</div>}
      </div>

      {/* Modal para Tratar Não-Conformidade (Operador) */}
      {treatingNc && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,9,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem' }}
          onClick={() => setTreatingNc(null)}
        >
          <div 
            style={{ width: 'min(640px, 100%)', background: '#111827', border: '1px solid #33445A', borderRadius: '12px', padding: '2rem', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Ajuste de Não-Conformidade</h3>
              <button onClick={() => setTreatingNc(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8FA0B3", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTreatSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8FA0B3', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Oxanium', monospace" }}>Documento Afetado</label>
                  <input 
                    type="text" 
                    value={`${treatingNc.documentId} - ${treatingNc.documentName}`} 
                    disabled 
                    style={{ width: '100%', background: '#0b0f17', border: '1px solid #1f2937', borderRadius: '8px', padding: '10px 12px', color: '#94a3b8', fontSize: '13.5px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8FA0B3', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Oxanium', monospace" }}>Apontamento do Auditor</label>
                  <div style={{ background: 'rgba(255,93,93,0.06)', border: '1px solid rgba(255,93,93,0.2)', borderRadius: '8px', padding: '12px', fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.4', fontStyle: 'italic' }}>
                    "{treatingNc.description}"
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8FA0B3', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Oxanium', monospace" }}>Ação Corretiva Realizada (Explicação do Ajuste)</label>
                  <textarea 
                    value={treatmentDesc} 
                    onChange={(e) => setTreatmentDesc(e.target.value)} 
                    required 
                    placeholder="Descreva as ações realizadas para ajustar esta não-conformidade..."
                    style={{ width: '100%', height: '140px', background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '12px', color: '#f8fafc', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: "'Oxanium', sans-serif" }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setTreatingNc(null)}
                  style={{ background: '#1F2937', color: '#E7ECF2', border: '1px solid #374151', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !treatmentDesc.trim()}
                  style={{ background: '#FF8F3D', color: '#1A1006', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: (isSubmitting || !treatmentDesc.trim()) ? 0.5 : 1 }}
                >
                  {isSubmitting ? 'Salvando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .logs-input { width: 100%; box-sizing: border-box; padding: 10px 12px 10px 36px; background: #121821; border: 1px solid #1E2836; border-radius: 8px; color: #E7ECF2; font-size: 13px; outline: none; }
        .logs-table-wrap { overflow-x: auto; background: #121821; border: 1px solid #1E2836; border-radius: 10px; }
        .logs-table { width: 100%; min-width: 960px; border-collapse: collapse; text-align: left; }
        .logs-table th { padding: 12px 14px; color: #8FA0B3; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #1E2836; }
        .logs-table td { padding: 13px 14px; color: #C4CEDA; font-size: 13px; border-bottom: 1px solid #1E2836; vertical-align: top; }
        .logs-table tr:last-child td { border-bottom: 0; }
        .logs-table strong, .logs-table small { display: block; } .logs-table strong { color: #E7ECF2; font-weight: 600; } .logs-table small { color: #56667A; font-size: 11px; margin-top: 3px; }
        .logs-date { color: #8FA0B3 !important; white-space: nowrap; } .logs-empty { padding: 2rem; color: #56667A; text-align: center; }
      `}</style>
    </div>
  );
}
