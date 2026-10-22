import { useState } from "react";
import imagemLmt from "../../img/lmt.jpg";

export default function Login({
  onLogin,
  onDeveloperLogin,
  developerAccess,
  onChangePassword,
  onCreateAccount,
  mensagem,
  erro,
}) {
  const [rm, setRm] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerRm, setDeveloperRm] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!rm.trim() || !password.trim()) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    // Envia os dados digitados para o App validar
    onLogin({ rm: rm.trim(), password });
  };

  const handleDeveloperSubmit = (event) => {
    event.preventDefault();
    onDeveloperLogin({ rm: developerRm.trim() });
  };

  return (
    <main className="login-page">
      <div className="login-decoration">
        <img 
          src={imagemLmt} 
          alt="LMT - Empréstimo de Aparelhos" 
          className="imagem-login" 
        />
      </div>
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">+</div>
          <div>
            <strong>Agenda</strong>
            <span>LMT</span>
          </div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">PORTAL DO FUNCIONÁRIO</span>
          <h1>
            Olá, funcionário<span>.</span>
          </h1>
          <p>Entre para gerenciar seus empréstimos de aparelhos.</p>
        </div>

        {/* Exibe mensagem de sucesso (ex: após se cadastrar) */}
        {mensagem && (
          <p className="form-success" role="status">
            ✓ {mensagem}
          </p>
        )}

        {/* Exibe mensagem de erro (ex: senha incorreta ou usuário não cadastrado) */}
        {erro && (
          <p className="form-error" role="alert" style={{ color: "#d32f2f", marginBottom: "1rem" }}>
            ⚠ {erro}
          </p>
        )}

        {developerMode ? (
          <form onSubmit={handleDeveloperSubmit}>
            <label>
              RM de desenvolvedor (4 dígitos)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                minLength="4"
                maxLength="4"
                value={developerRm}
                onChange={(event) => setDeveloperRm(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <button className="primary-button login-button" type="submit">
              Entrar como desenvolvedor <span>→</span>
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit}>
          <label>
            Registro de matrícula (RM)
            <input
              type="text"
              value={rm}
              onChange={(event) => setRm(event.target.value)}
              placeholder="Digite seu RM..."
              required
            />
          </label>

          <label>
            Senha
            <div className="password-input" style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha..."
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? "👁️" : "◉"}
              </button>
            </div>
          </label>

          <button className="primary-button login-button" type="submit">
            Entrar <span>→</span>
          </button>
        </form>
        )}

        {developerAccess && (
          <button
            className="create-account"
            type="button"
            onClick={() => setDeveloperMode((enabled) => !enabled)}
          >
            {developerMode ? "Voltar ao login normal" : "Acesso de desenvolvedor"}
          </button>
        )}

        <button className="create-account" type="button" onClick={onChangePassword}>
          Alterar senha
        </button>

        <button
          className="create-account"
          type="button"
          onClick={onCreateAccount}
        >
          Ainda não tem uma conta? <strong>Criar conta</strong>
        </button>

        <small className="login-footer">
          Acesso exclusivo para funcionários e colaboradores
        </small>
      </section>
    </main>
  );
}