import { useState } from "react";
import imagemLmt from "../../img/lmt.jpg";

export default function AlterarSenha({ onSubmit, onBack, erro, initialRm = "" }) {
  const [rm, setRm] = useState(initialRm);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ rm: rm.trim(), currentPassword, newPassword });
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
          <div><strong>Sesi</strong><span>Cerquilho</span></div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">CONTA DO FUNCIONÁRIO</span>
          <h1>Alterar senha<span>.</span></h1>
          <p>Confirme seus dados e escolha uma nova senha.</p>
        </div>

        {(error || erro) && (
          <p className="form-error" role="alert">⚠ {error || erro}</p>
        )}

        <form onSubmit={handleSubmit}>
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
          <label>
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
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
            {saving ? "Alterando…" : "Alterar senha"}
          </button>
        </form>

        <button className="create-account" type="button" onClick={onBack}>
          Voltar para o login
        </button>
      </section>
    </main>
  );
}
