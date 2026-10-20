import { useState } from "react";
import imagemLmt from "../../img/lmt.jpg";

export default function VerificarEmail({
  initialEmail = "",
  initialCode = "",
  onVerify,
  onResend,
  onBack,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [message, setMessage] = useState(
    initialCode ? "Código de desenvolvimento preenchido para uso local." : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleVerify(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await onVerify(email.trim(), code.trim());
    } catch (verificationError) {
      setError(verificationError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await onResend(email.trim());
      if (result.verificationCode) setCode(result.verificationCode);
      setMessage(
        result.verificationCode
          ? `Código de desenvolvimento: ${result.verificationCode}`
          : result.message,
      );
    } catch (resendError) {
      setError(resendError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-decoration">
        <img src={imagemLmt} alt="LMT - Empréstimo de Aparelhos" className="imagem-login" />
      </div>
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">+</div>
          <div><strong>Sesi</strong><span>Cerquilho</span></div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">ATIVAÇÃO DA CONTA</span>
          <h1>Confirmar e-mail<span>.</span></h1>
          <p>Digite o código enviado ao seu e-mail institucional. O código expira em 15 minutos.</p>
        </div>

        {message && <p className="form-success" role="status">✓ {message}</p>}
        {error && <p className="form-error" role="alert">⚠ {error}</p>}

        <form onSubmit={handleVerify}>
          <label>
            E-mail institucional
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@senaisp.edu.br"
              pattern="[^@\s]+@senaisp\.edu\.br"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Código de confirmação
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
          <button className="primary-button login-button" type="submit" disabled={busy}>
            {busy ? "Confirmando…" : "Confirmar e-mail"}
          </button>
        </form>

        <button className="create-account" type="button" onClick={handleResend} disabled={busy}>
          Reenviar código
        </button>
        <button className="create-account" type="button" onClick={onBack}>
          Voltar para o login
        </button>
      </section>
    </main>
  );
}
