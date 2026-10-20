import { useState } from "react";
import imagemLmt from "../../img/lmt.jpg";

export default function Cadastro({ onCadastrar, onVoltarLogin, onVerificarEmail }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [funcao, setFuncao] = useState("");
  const [rm, setRm] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!nome.trim() || !email.trim() || !funcao || !rm.trim() || !password.trim()) {
      setErro("Por favor, preencha todos os campos.");
      return;
    }

    // Tenta efetuar o cadastro
    try {
      await onCadastrar({
        nome: nome.trim(),
        email: email.trim(),
        funcao,
        rm: rm.trim(),
        password,
      });
    } catch (error) {
      setErro(error.message);
    }

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
            <strong>Sesi</strong>
            <span>Cerquilho</span>
          </div>
        </div>

        <div className="login-copy">
          <span className="eyebrow">NOVO CADASTRO</span>
          <h1>
            Criar conta<span>.</span>
          </h1>
          <p>Confirme seu e-mail institucional para ativar a conta. Funções administrativas exigem aprovação.</p>
        </div>

        {erro && (
          <p className="form-error" role="alert" style={{ color: "#d32f2f", marginBottom: "1rem" }}>
            ⚠ {erro}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            Nome Completo
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome completo..."
              required
            />
          </label>

          <label>
            Registro de matrícula (RM)
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{7}"
              minLength="7"
              maxLength="7"
              value={rm}
              onChange={(e) => setRm(e.target.value)}
              placeholder="7 dígitos"
              title="O RM deve conter exatamente 7 dígitos."
              required
            />
          </label>

          <label>
            E-mail institucional
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@senaisp.edu.br"
              pattern="[^@\s]+@senaisp\.edu\.br"
              title="Use seu e-mail institucional @senaisp.edu.br."
              autoComplete="email"
              required
            />
          </label>

          <label>
            Função
            <select
              value={funcao}
              onChange={(event) => setFuncao(event.target.value)}
              required
            >
              <option value="">Selecione sua função</option>
              <option value="Professor(a)">Professor(a)</option>
              <option value="Estagiário(a)">Estagiário(a)</option>
              <option value="Técnico(a) de laboratório">Técnico(a) de laboratório</option>
              <option value="Outro">Outro</option>
              <option value="Diretoria">Diretoria — acesso administrativo sujeito à aprovação</option>
              <option value="Secretaria">Secretaria — acesso administrativo sujeito à aprovação</option>
              <option value="Orientador de Educação Digital">Orientador de Educação Digital — acesso administrativo sujeito à aprovação</option>
            </select>
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Pelo menos 12 caracteres"
              minLength="12"
              maxLength="72"
              title="Use pelo menos 12 caracteres (máximo de 72 bytes)."
              autoComplete="new-password"
              required
            />
          </label>

          <button className="primary-button login-button" type="submit">
            Cadastrar <span>→</span>
          </button>
        </form>

        <button className="create-account" type="button" onClick={onVerificarEmail}>
          Já se cadastrou? <strong>Confirmar e-mail</strong>
        </button>

        <button
          className="create-account"
          type="button"
          onClick={onVoltarLogin}
        >
          Já tem uma conta? <strong>Fazer login</strong>
        </button>

        <small className="login-footer">
          Acesso exclusivo para funcionários e colaboradores
        </small>
      </section>
    </main>
  );
}
