import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';

const statusColors = {
  Aprovado: '#2FD9A8',
  Revisado: '#2FD9A8',
  'Pendente de revisão': '#FFC24D',
  'Pendente de aprovação': '#FFC24D',
  'Revisão registrada': '#8FA0B3',
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await fetch('/api/audit-log', {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        });
        if (!response.ok) throw new Error('Não foi possível carregar os logs.');
        setLogs(await response.json());
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (type !== 'Todos' && log.type !== type) return false;
      if (!normalizedQuery) return true;
      return [log.documentName, log.documentId, log.actor, log.status, log.details]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [logs, query, type]);

  if (isLoading) return <div style={{ color: '#8FA0B3', padding: '2rem 0' }}>Carregando logs...</div>;
  if (error) return <div style={{ color: '#FF5D5D', padding: '2rem 0' }}>{error}</div>;

  return (
    <div className="logs-page" style={{ padding: '0.25rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Logs de documentos</h2>
          <p style={{ color: '#8FA0B3', margin: '5px 0 0', fontSize: 13 }}>Histórico de alterações, revisões e aprovações.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} color="#56667A" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="logs-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documento, usuário ou status" />
        </div>
        <select className="logs-input logs-select" value={type} onChange={(event) => setType(event.target.value)}>
          <option>Todos</option>
          <option>Alteração</option>
          <option>Revisão</option>
          <option>Aprovação</option>
          <option>Desaprovação</option>
        </select>
      </div>

      <div className="logs-table-wrap">
        <table className="logs-table">
          <thead><tr><th>Data</th><th>Documento</th><th>Responsável</th><th>Evento</th><th>Status</th></tr></thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <tr key={`${log.key}-${index}`}>
                <td className="logs-date">{log.date}</td>
                <td><strong>{log.documentName}</strong><small>{log.documentId}</small></td>
                <td>{log.actor}</td>
                <td><span className="logs-type">{log.type}</span><small>{log.details}</small></td>
                <td><span className="logs-status" style={{ color: statusColors[log.status] || '#8FA0B3' }}>{log.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLogs.length === 0 && <div className="logs-empty">Nenhum log encontrado.</div>}
      </div>

      <style>{`
        .logs-input { width: 100%; box-sizing: border-box; padding: 10px 12px 10px 36px; background: #121821; border: 1px solid #1E2836; border-radius: 8px; color: #E7ECF2; font-size: 13px; outline: none; }
        .logs-select { width: 180px; padding-left: 12px; }
        .logs-table-wrap { overflow-x: auto; background: #121821; border: 1px solid #1E2836; border-radius: 10px; }
        .logs-table { width: 100%; min-width: 760px; border-collapse: collapse; text-align: left; }
        .logs-table th { padding: 12px 14px; color: #8FA0B3; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #1E2836; }
        .logs-table td { padding: 13px 14px; color: #C4CEDA; font-size: 13px; border-bottom: 1px solid #1E2836; vertical-align: top; }
        .logs-table tr:last-child td { border-bottom: 0; }
        .logs-table strong, .logs-table small { display: block; } .logs-table strong { color: #E7ECF2; font-weight: 600; } .logs-table small { color: #56667A; font-size: 11px; margin-top: 3px; }
        .logs-date { color: #8FA0B3 !important; white-space: nowrap; } .logs-type { color: #4FA3FF; } .logs-status { font-weight: 600; white-space: nowrap; } .logs-empty { padding: 2rem; color: #56667A; text-align: center; }
        @media (max-width: 640px) { .logs-select { width: 100%; } }
      `}</style>
    </div>
  );
}
