import { useEffect, useState } from 'react';
import { KeyRound, Save, UserRound, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // MFA States
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [showMfaDisableInput, setShowMfaDisablePasswordInput] = useState(false);
  const [mfaActionMessage, setMfaActionMessage] = useState({ type: '', text: '' });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMfaLoading, setIsMfaLoading] = useState(false);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!response.ok) throw new Error('Não foi possível carregar seu perfil.');
      const data = await response.json();
      setProfile(data);
      setName(data.name);
      setUsername(data.username);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleMfaSetup = async () => {
    setIsMfaLoading(true);
    setMfaActionMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/profile/mfa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Resposta de rede inválida do servidor de API.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro ao iniciar MFA.');
      setMfaSetupData(data);
    } catch (error) {
      setMfaActionMessage({ type: 'error', text: error.message });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setIsMfaLoading(true);
    setMfaActionMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/profile/mfa/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secret: mfaSetupData.secret, code: mfaVerificationCode })
      });
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Resposta de rede inválida do servidor de API.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Código inválido.');
      setProfile(data.user);
      setMfaSetupData(null);
      setMfaVerificationCode('');
      setMfaActionMessage({ type: 'success', text: 'Autenticação Multifator (MFA) ativada com sucesso!' });
    } catch (error) {
      setMfaActionMessage({ type: 'error', text: error.message });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleMfaDisable = async (e) => {
    e.preventDefault();
    setIsMfaLoading(true);
    setMfaActionMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/profile/mfa/disable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: mfaDisablePassword })
      });
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Resposta de rede inválida do servidor de API.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Senha incorreta.');
      setProfile(data.user);
      setShowMfaDisablePasswordInput(false);
      setMfaDisablePassword('');
      setMfaActionMessage({ type: 'success', text: 'MFA desativado com sucesso.' });
    } catch (error) {
      setMfaActionMessage({ type: 'error', text: error.message });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });
    
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setMessage({ type: 'error', text: 'A confirmação da nova senha não confere.' });
        return;
      }
      
      // Validação de complexidade de senha no cliente
      const minLengthError = newPassword.length < 8;
      const upperCaseError = !/[A-Z]/.test(newPassword);
      const lowerCaseError = !/[a-z]/.test(newPassword);
      const numberError = !/[0-9]/.test(newPassword);
      const specialCharError = !/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(newPassword);

      if (minLengthError || upperCaseError || lowerCaseError || numberError || specialCharError) {
        let passwordFeedback = "A nova senha deve ter no mínimo 8 caracteres, incluindo pelo menos uma letra maiúscula, uma letra minúscula, um número e um caractere especial (ex: !, @, #, $, etc.).";
        setMessage({ type: 'error', text: passwordFeedback });
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, username, currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível atualizar o perfil.');
      localStorage.setItem('authToken', data.token);
      setProfile(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div style={{ color: '#8FA0B3', padding: '2rem 0' }}>Carregando perfil...</div>;
  if (!profile) return <div style={{ color: '#FF5D5D', padding: '2rem 0' }}>{message.text}</div>;

  return (
    <div className="profile-page" style={{ width: 'min(760px, 100%)', margin: '0 auto', padding: '2rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.75rem' }}>
        
        <div>
          <h2 style={{ fontSize: 24, margin: 0 }}>Meu perfil</h2>
          <p style={{ color: '#8FA0B3', margin: '5px 0 0', fontSize: 13 }}>Gerencie seus dados de acesso.</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <section className="profile-section">
          <h3>Dados da conta</h3>
          <label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Usuário de login<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <div className="profile-role">Função <strong>{profile.role === 'admin' ? 'Administrador' : profile.role === 'auditor' ? 'Auditor' : (profile.role === 'operador' || profile.role === 'operator') ? 'Operador' : 'Usuário'}</strong></div>
        </section>

        <section className="profile-section">
          <h3><KeyRound size={16} /> Alterar senha</h3>
          <label>Senha atual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required={Boolean(newPassword)} /></label>
          <label>Nova senha<input type="password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Deixe em branco para manter a atual" /></label>
          <label>Confirmar nova senha<input type="password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        </section>

        {message.text && <p className={`profile-message ${message.type}`}>{message.text}</p>}
        <button className="login-button profile-save-button" type="submit" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 20px', cursor: 'pointer', fontWeight: 600 }}><Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}</button>
      </form>

      {/* Autenticação Multifator (MFA) Section */}
      <section className="profile-section" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0, paddingBottom: '12px', borderBottom: '1px solid #1E2836' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#2FD9A8" />
            <span>Autenticação Multifator (MFA / TOTP)</span>
          </div>
          <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: profile.mfaEnabled ? 'rgba(47,217,168,0.12)' : 'rgba(255,194,77,0.12)', color: profile.mfaEnabled ? '#2FD9A8' : '#FFC24D', fontWeight: 600 }}>
            {profile.mfaEnabled ? 'MFA Ativo' : 'MFA Inativo'}
          </span>
        </h3>
        
        <p style={{ color: '#8FA0B3', fontSize: '13px', margin: '14px 0', lineHeight: 1.5 }}>
          Aumente a segurança da sua conta exigindo um código de verificação dinâmico de 6 dígitos gerado pelo seu smartphone (Google Authenticator, Microsoft Authenticator, Authy, etc.) a cada login.
        </p>

        {mfaActionMessage.text && (
          <p className={`profile-message ${mfaActionMessage.type}`} style={{ padding: '10px', borderRadius: '6px', background: mfaActionMessage.type === 'success' ? 'rgba(47,217,168,0.08)' : 'rgba(255,93,93,0.08)', marginBottom: '14px' }}>
            {mfaActionMessage.text}
          </p>
        )}

        {!profile.mfaEnabled ? (
          <>
            {!mfaSetupData ? (
              <button 
                type="button" 
                onClick={handleMfaSetup} 
                disabled={isMfaLoading}
                className="add-user-button"
                style={{ background: '#2FD9A8', color: '#1A2633', cursor: 'pointer', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isMfaLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                Ativar Autenticação Multifator
              </button>
            ) : (
              <div style={{ background: '#0A0E13', border: '1px solid #1E2836', borderRadius: '8px', padding: '20px', marginTop: '14px' }}>
                <h4 style={{ fontSize: '14px', margin: '0 0 10px 0', color: '#E7ECF2' }}>Configurar Autenticador</h4>
                <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0', fontSize: '13px', color: '#8FA0B3', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Escaneie o QR Code abaixo com seu aplicativo autenticador.</li>
                  <li>Se não puder escanear, digite a seguinte chave secreta manualmente no aplicativo: <code style={{ userSelect: 'all', background: '#121821', padding: '2px 6px', borderRadius: '4px', color: '#E7ECF2' }}>{mfaSetupData.secret}</code></li>
                  <li>Insira o código de 6 dígitos gerado pelo aplicativo no campo abaixo para confirmar.</li>
                </ol>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', background: '#fff', padding: '10px', borderRadius: '8px', width: 'fit-content', margin: '0 auto 20px auto' }}>
                  <img src={mfaSetupData.qrCodeDataUrl} alt="MFA QR Code" style={{ display: 'block', maxWidth: '200px', height: 'auto' }} />
                </div>

                <form onSubmit={handleMfaVerify} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', maxWidth: '320px', margin: '0 auto' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#8FA0B3' }}>Código de 6 dígitos</label>
                    <input 
                      type="text" 
                      maxLength={6} 
                      placeholder="000000"
                      value={mfaVerificationCode}
                      onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))}
                      style={{ padding: '10px', background: '#121821', border: '1px solid #33445A', borderRadius: '8px', color: '#fff', fontSize: '14px', textAlign: 'center', letterSpacing: '2px' }}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isMfaLoading}
                    style={{ background: '#2FD9A8', color: '#1A2633', border: 'none', borderRadius: '8px', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Confirmar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setMfaSetupData(null)}
                    style={{ background: '#33445A', color: '#E7ECF2', border: 'none', borderRadius: '8px', padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginTop: '14px' }}>
            {!showMfaDisableInput ? (
              <button 
                type="button" 
                onClick={() => setShowMfaDisablePasswordInput(true)}
                style={{ background: '#FF5D5D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ShieldAlert size={14} />
                Desativar MFA
              </button>
            ) : (
              <form onSubmit={handleMfaDisable} style={{ background: '#0A0E13', border: '1px solid #1E2836', borderRadius: '8px', padding: '16px', maxWidth: '420px' }}>
                <h4 style={{ fontSize: '13px', margin: '0 0 10px 0', color: '#FF5D5D' }}>Confirmar Desativação do MFA</h4>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label>Insira sua senha atual para confirmar</label>
                  <input 
                    type="password"
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                    style={{ padding: '10px', background: '#121821', border: '1px solid #33445A', borderRadius: '8px', color: '#fff' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="submit" 
                    disabled={isMfaLoading}
                    style={{ background: '#FF5D5D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Confirmar Desativação
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowMfaDisablePasswordInput(false); setMfaDisablePassword(''); }}
                    style={{ background: '#33445A', color: '#E7ECF2', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <style>{`
        .profile-section { background: #121821; border: 1px solid #1E2836; border-radius: 10px; padding: 20px; margin-bottom: 14px; }
        .profile-section h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 18px; font-size: 15px; color: #E7ECF2; }
        .profile-section label { display: block; color: #8FA0B3; font-size: 12px; margin-bottom: 14px; }
        .profile-section input { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 10px 12px; border: 1px solid #33445A; border-radius: 8px; background: #0A0E13; color: #E7ECF2; font-size: 13.5px; }
        .profile-role { color: #8FA0B3; font-size: 12px; } .profile-role strong { color: #E7ECF2; margin-left: 8px; }
        .profile-message { font-size: 13px; margin: 14px 0; } .profile-message.success { color: #2FD9A8; } .profile-message.error { color: #FF5D5D; }
      `}</style>
    </div>
  );
}
