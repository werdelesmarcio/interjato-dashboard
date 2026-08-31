import { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Save, X, Users as UsersIcon } from 'lucide-react';

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return "A senha deve ter no mínimo 8 caracteres.";
  }
  if (!/[A-Z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra maiúscula.";
  }
  if (!/[a-z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra minúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "A senha deve conter pelo menos um número.";
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) {
    return "A senha deve conter pelo menos um caractere especial (ex: !, @, #, etc.).";
  }
  return null;
}

function EditUserForm({ user, onSave, onCancel }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState(user.role);

  const handleSave = (e) => {
    e.preventDefault();
    onSave(user.id, { name, username, role });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: "#121821", border: "1px solid #1E2836", borderRadius: 10, padding: "20px", width: 'clamp(300px, 90%, 400px)'}}>
        <h3 style={{fontSize: 16, fontWeight: 600, margin: '0 0 1.5rem', color: '#E7ECF2'}}>Editar Usuário</h3>
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label>Nome Completo</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Usuário (login)</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Função</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="auditor">Auditor</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
            <button type="button" onClick={onCancel} className="cancel-button">
              <X size={16} />
              Cancelar
            </button>
            <button type="submit" className="add-user-button" style={{background: '#4FA3FF'}}>
              <Save size={16} />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Sua sessão expirou ou não tem permissão de administrador. Faça login novamente.');
          }
          throw new Error(`Falha ao carregar usuários (HTTP ${response.status}).`);
        }
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        setError(err instanceof TypeError
          ? 'Não foi possível conectar à API. Verifique se o servidor está em execução.'
          : err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    const passwordError = validatePasswordStrength(newUserPassword);
    if (passwordError) {
      alert(`Senha inválida: ${passwordError}`);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newUserName, username: newUserUsername, password: newUserPassword, role: newUserRole }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Falha ao adicionar usuário.');
      }
      setUsers([...users, data]);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('user');
      alert('Usuário adicionado com sucesso!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateUser = async (id, updatedData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) {
        throw new Error('Falha ao atualizar usuário.');
      }
      const updatedUser = await response.json();
      setUsers(users.map(u => (u.id === id ? updatedUser : u)));
      setEditingUser(null);
      alert('Usuário atualizado com sucesso!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${users.find(u=>u.id === id)?.name}?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Falha ao excluir usuário.');
      }
      setUsers(users.filter(u => u.id !== id));
      alert('Usuário excluído com sucesso!');
    } catch (err) {
      alert(err.message);
    }
  };

  if (isLoading) return <div style={{color: '#8FA0B3', textAlign: 'center', padding: '2rem'}}>Carregando usuários...</div>;
  if (error) return <div style={{color: '#FF5D5D', textAlign: 'center', padding: '2rem'}}>Erro: {error}</div>;

  return (
    <div style={{padding: '0.25rem 0'}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Gerenciamento de Usuários</h1>
      </div>
      {editingUser && <EditUserForm user={editingUser} onSave={handleUpdateUser} onCancel={() => setEditingUser(null)} />}

      <div className="users-form-panel" style={{ background: "#121821", border: "1px solid #1E2836", borderRadius: 10, padding: "20px", marginBottom: '2rem' }}>
        <h3 style={{fontSize: 16, fontWeight: 600, margin: '0 0 1.5rem', color: '#E7ECF2'}}>Adicionar Novo Usuário</h3>
        <form className="users-form" onSubmit={handleAddUser} style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem'}}>
          <div className="input-group">
            <label>Nome Completo</label>
            <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Usuário (login)</label>
            <input type="text" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Senha</label>
            <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Função</label>
            <select className="users-select" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="auditor">Auditor</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <button type="submit" className="add-user-button users-add-button">
            <UserPlus size={16} />
            Adicionar
          </button>
        </form>
      </div>

      <div className="users-table-panel" style={{ background: "#121821", border: "1px solid #1E2836", borderRadius: 10, overflow: 'hidden' }}>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th className='table-header'>ID</th>
              <th className='table-header'>Nome</th>
              <th className='table-header'>Usuário</th>
              <th className='table-header'>Função</th>
              <th className='table-header'>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td className='table-cell'>{user.id}</td>
                <td className='table-cell'>{user.name}</td>
                <td className='table-cell'>{user.username}</td>
                <td className='table-cell'>{user.role === 'admin' ? 'Administrador' : user.role === 'auditor' ? 'Auditor' : (user.role === 'operador' || user.role === 'operator') ? 'Operador' : 'Usuário'}</td>
                <td className='table-cell'>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button onClick={() => setEditingUser(user)} className="action-button edit-button"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteUser(user.id)} className="action-button delete-button"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .input-group label { display: block; font-size: 12px; color: #8FA0B3; margin-bottom: 6px; }
        .input-group input, .input-group select { width: 100%; background: #0A0E13; border: 1px solid #33445A; border-radius: 8px; padding: 10px 12px; color: #E7ECF2; font-size: 13.5px; outline: none; box-sizing: border-box; }
        .add-user-button { background: #2FD9A8; color: #1A2633; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; align-self: end; }
        .cancel-button { background: #33445A; color: #E7ECF2; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .table-header { padding: 12px 16px; text-align: left; font-size: 11px; color: #8FA0B3; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #1E2836; }
        .table-cell { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #1E2836; }
        tbody tr:last-child .table-cell { border-bottom: none; }
        .action-button { background: none; border: 1px solid #33445A; color: #8FA0B3; border-radius: 6px; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .edit-button:hover { background: #4FA3FF; color: white; border-color: #4FA3FF; }
        .delete-button:hover { background: #FF5D5D; color: white; border-color: #FF5D5D; }
      `}</style>
    </div>
  );
}
