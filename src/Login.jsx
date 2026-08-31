import { useState } from 'react';
import { Shield } from 'lucide-react';
import logoImg from './assets/logo.png';
import './App.css';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, code: isMfaRequired ? mfaCode : undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Falha na autenticação');
      }

      if (data.mfaRequired) {
        setIsMfaRequired(true);
        setError('');
        setIsLoading(false);
        return;
      }

      onLoginSuccess(data.user);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Erro de comunicação com o servidor. Verifique se a API está em execução.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-badge">
            <Shield size={14} /> Conformidade & Segurança
          </div>
          <div className="login-brand-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <img src={logoImg} alt="Interjato Logo" style={{ width: '380px', maxWidth: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
          </div>
          <div className="login-brand-subtitle">SGI · SISTEMA DE GESTÃO INTEGRADO</div>
          <p className="login-brand-description">
            Plataforma unificada para governança de ISO/IEC 27001 e ISO/IEC 20000-1, garantindo resiliência operacional, integridade documental e excelência em serviços.
          </p>
        </div>
        <footer className="app-footer" style={{ position: 'absolute', bottom: '2rem', left: '4rem', right: 'auto', textAlign: 'left' }}>
          <div>Desenvolvido pela Equipe de SOC Grupo Interjato · 2026</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Licenciado sob <a href="https://creativecommons.org/licenses/by/4.0/deed.pt_BR" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Creative Commons</a>.</span>
          </div>
        </footer>
      </div>
      
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-welcome">
            <h2>{isMfaRequired ? "Segundo Fator (MFA)" : "Bem-vindo de volta"}</h2>
            <p>{isMfaRequired ? "Abra seu aplicativo de autenticação e insira o código de 6 dígitos" : "Insira suas credenciais corporativas para acessar o painel"}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-modern-form">
            {!isMfaRequired ? (
              <>
                <div className="input-group">
                  <label htmlFor="username">Usuário</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: admin ou analista"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="password">Senha</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <div className="input-group">
                <label htmlFor="mfaCode">Código de Verificação MFA</label>
                <input
                  id="mfaCode"
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
            )}
            
            {error && <p className="login-error">{error}</p>}
            
            <div className="login-form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              {isMfaRequired && (
                <button 
                  type="button" 
                  onClick={() => { setIsMfaRequired(false); setMfaCode(''); setError(''); }} 
                  className="cancel-button" 
                  style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '15px' }}
                >
                  Voltar
                </button>
              )}
              <button type="submit" disabled={isLoading} className="login-submit-btn" style={{ flex: 2 }}>
                {isLoading ? 'Autenticando...' : isMfaRequired ? 'Confirmar Código' : 'Acessar Sistema'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
