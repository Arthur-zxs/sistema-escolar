import { useState } from "react";
import imagemLmt from "../../img/lmt.jpg";

export default function AlterarSenha({
  onRequestCode,
  onSubmit,
  onBack,
  erro,
  initialRm = "",
}) {
  const [rm, setRm] = useState(initialRm);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleRequestCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const result = await onRequestCode(rm.trim());
      setCodeRequested(true);
      setCode(result.resetCode || "");
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ rm: rm.trim(), code: code.trim(), newPassword });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

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
          <div><strong>Agenda</strong><span>LMT</span></div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">RECUPERAÇÃO DA CONTA</span>
          <h1>Redefinir senha<span>.</span></h1>
          <p>
            {codeRequested
              ? "Informe o código enviado ao e-mail institucional e escolha uma nova senha."
              : "Informe seu RM para receber um código de recuperação no e-mail institucional cadastrado."}
          </p>
        </div>

        {(error || erro) && (
          <p className="form-error" role="alert">⚠ {error || erro}</p>
        )}
        {message && <p className="form-success" role="status">✓ {message}</p>}

        {!codeRequested ? (
          <form onSubmit={handleRequestCode}>
            <label>
              Registro de matrícula (RM)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{7}"
                minLength="7"
                maxLength="7"
                value={rm}
                onChange={(event) => setRm(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <button className="primary-button login-button" type="submit" disabled={saving}>
              {saving ? "Enviando…" : "Enviar código"}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <label>
                Registro de matrícula (RM)
                <input type="text" value={rm} readOnly />
              </label>
              <label>
                Código de recuperação
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength="6"
                  maxLength="6"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </label>
              <label>
                Nova senha (mínimo de 12 caracteres)
                <input
                  type="password"
                  minLength="12"
                  maxLength="72"
                  title="Use pelo menos 12 caracteres (máximo de 72 bytes)."
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirmar nova senha
                <input
                  type="password"
                  minLength="12"
                  maxLength="72"
                  title="Use pelo menos 12 caracteres (máximo de 72 bytes)."
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="primary-button login-button" type="submit" disabled={saving}>
                {saving ? "Redefinindo…" : "Redefinir senha"}
              </button>
            </form>
            <button
              className="create-account"
              type="button"
              onClick={handleRequestCode}
              disabled={saving}
            >
              Reenviar código
            </button>
          </>
        )}

        <button className="create-account" type="button" onClick={onBack}>
          Voltar para o login
        </button>
      </section>
    </main>
  );
}
