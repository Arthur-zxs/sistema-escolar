import { useCallback, useEffect, useState } from "react";
import "./App.css";

import { api, ApiError } from "./api";
import Sidebar from "./componentes/estrutura/Sidebar";
import Header from "./componentes/estrutura/Header";
import Login from "./componentes/autenticacao/Login";
import Cadastro from "./componentes/autenticacao/Cadastro";
import AlterarSenha from "./componentes/autenticacao/AlterarSenha";
import VerificarEmail from "./componentes/autenticacao/VerificarEmail";
import LoanModal from "./componentes/emprestimos/LoanModal";
import ReturnModal from "./componentes/emprestimos/ReturnModal";

import DashboardPage from "./paginas/DashboardPage";
import DevicesPage from "./paginas/DevicesPage";
import LoansPage from "./paginas/LoansPage";
import MapPage from "./paginas/MapPage";
import HistoryPage from "./paginas/HistoryPage";
import ProfilePage from "./paginas/ProfilePage";
import AdminPage from "./paginas/AdminPage";

import { dadosPaginas, funcoesComAcessoAdmin } from "./dados/mockData";

const paginas = {
  home: DashboardPage,
  devices: DevicesPage,
  loans: LoansPage,
  map: MapPage,
  history: HistoryPage,
  profile: ProfilePage,
  admin: AdminPage,
};

const valoresIniciais = {
  devices: [],
  loans: [],
  history: [],
  rooms: [],
  activities: [],
  users: [],
};

export default function App() {
  const [funcionario, setFuncionario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [developerAccess, setDeveloperAccess] = useState(false);
  const [telaDeAcesso, setTelaDeAcesso] = useState("login");
  const [mensagemLogin, setMensagemLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [emailPendente, setEmailPendente] = useState("");
  const [codigoDevPendente, setCodigoDevPendente] = useState("");
  const [rmParaAtualizarSenha, setRmParaAtualizarSenha] = useState("");
  const [avisoAcesso, setAvisoAcesso] = useState("");
  const [erroOperacao, setErroOperacao] = useState("");
  const [paginaAtiva, setPaginaAtiva] = useState("home");
  const [aparelhoSelecionado, setAparelhoSelecionado] = useState(null);
  const [emprestimoParaDevolver, setEmprestimoParaDevolver] = useState(null);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [dados, setDados] = useState(valoresIniciais);

  const podeAcessarAdmin =
    !funcionario?.adminApprovalPending &&
    funcoesComAcessoAdmin.includes(funcionario?.funcao);

  const carregarDados = useCallback(async (usuario) => {
    const [devicesResponse, loansResponse, historyResponse, roomsResponse] =
      await Promise.all([
        api("/devices"),
        api("/loans"),
        api("/history"),
        api("/rooms"),
      ]);

    const extras =
      !usuario.adminApprovalPending && funcoesComAcessoAdmin.includes(usuario.funcao)
      ? await Promise.all([api("/admin/activities"), api("/admin/users")])
      : [{ activities: [] }, { users: [] }];

    setDados({
      devices: devicesResponse.devices,
      loans: loansResponse.loans,
      history: historyResponse.history,
      rooms: roomsResponse.rooms,
      activities: extras[0].activities,
      users: extras[1].users,
    });
  }, []);

  useEffect(() => {
    let ativo = true;
    api("/setup/status")
      .then(({ developerAccess: enabled }) => {
        if (ativo) setDeveloperAccess(enabled);
      })
      .catch((error) => {
        if (ativo) setErroOperacao(error.message);
      });
    api("/auth/me")
      .then(async ({ user }) => {
        if (!ativo) return;
        setFuncionario(user);
        await carregarDados(user);
      })
      .catch((error) => {
        if (!ativo) return;
        if (!(error instanceof ApiError) || error.status !== 401) {
          setErroOperacao(error.message);
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregarDados]);

  async function recarregar() {
    if (funcionario) await carregarDados(funcionario);
  }

  function navegar(pagina) {
    if (pagina === "admin" && !podeAcessarAdmin) {
      setPaginaAtiva("home");
      setAvisoAcesso(
        "Acesso restrito à Diretoria, Secretaria e Orientação de Educação Digital.",
      );
      setMenuMobileAberto(false);
      return;
    }
    setAvisoAcesso("");
    setErroOperacao("");
    setPaginaAtiva(pagina);
    setMenuMobileAberto(false);
  }

  async function cadastrarFuncionario(dadosCadastro) {
    const result = await api("/auth/register", {
      method: "POST",
      body: dadosCadastro,
    });
    setErroLogin("");
    setEmailPendente(result.email);
    setCodigoDevPendente(result.verificationCode || "");
    setTelaDeAcesso("verificar-email");
    return result;
  }

  async function verificarEmail(email, code) {
    const result = await api("/auth/verify-email", {
      method: "POST",
      body: { email, code },
    });
    setMensagemLogin(result.message);
    setErroLogin("");
    setTelaDeAcesso("login");
  }

  async function reenviarCodigo(email) {
    return api("/auth/resend-verification", {
      method: "POST",
      body: { email },
    });
  }

  async function alterarSenhaAntesDoLogin(senhas) {
    await api("/auth/change-password", {
      method: "POST",
      body: senhas,
    });
    setMensagemLogin("Senha alterada. Entre com sua nova senha.");
    setErroLogin("");
    setTelaDeAcesso("login");
  }

  async function fazerLogin(credenciais) {
    try {
      const { user } = await api("/auth/login", {
        method: "POST",
        body: credenciais,
      });
      await carregarDados(user);
      setFuncionario(user);
      setErroLogin("");
      setMensagemLogin("");
      setErroOperacao("");
      setPaginaAtiva("home");
    } catch (error) {
      setMensagemLogin("");
      if (error instanceof ApiError && error.status === 428) {
        setRmParaAtualizarSenha(credenciais.rm);
        setErroLogin("");
        setTelaDeAcesso("alterar-senha");
      } else {
        setErroLogin(error.message);
      }
    }
  }

  async function fazerLoginDev(credenciais) {
    try {
      const { user } = await api("/dev/auth/login", {
        method: "POST",
        body: credenciais,
      });
      await carregarDados(user);
      setFuncionario(user);
      setErroLogin("");
      setErroOperacao("");
      setPaginaAtiva("home");
    } catch (error) {
      setErroLogin(error.message);
    }
  }

  async function registrarEmprestimo(novoEmprestimo) {
    const result = await api("/loans", {
      method: "POST",
      body: {
        deviceId: novoEmprestimo.deviceId,
        responsible: novoEmprestimo.responsible,
        qty: Number(novoEmprestimo.qty),
        roomId: novoEmprestimo.roomId,
        returnAt: novoEmprestimo.returnAt,
      },
    });
    await recarregar();
    return result;
  }

  async function registrarDevolucao(solicitacao) {
    await api(`/loans/${solicitacao.id}/return`, { method: "POST" });
    await recarregar();
  }

  async function apagarHistorico() {
    setErroOperacao("");
    try {
      await api("/admin/history", { method: "DELETE" });
      await recarregar();
    } catch (error) {
      setErroOperacao(error.message);
    }
  }

  async function aprovarEmprestimo(id) {
    await api(`/loans/${id}/approve`, { method: "POST" });
    await recarregar();
    return true;
  }

  async function recusarEmprestimo(id) {
    await api(`/loans/${id}/reject`, { method: "POST" });
    await recarregar();
    return true;
  }

  async function salvarAparelho(aparelhoAtualizado) {
    const { id, ...body } = aparelhoAtualizado;
    if (id) {
      await api(`/admin/devices/${id}`, { method: "PUT", body });
    } else {
      await api("/admin/devices", { method: "POST", body });
    }
    await recarregar();
    return true;
  }

  async function excluirAparelho(aparelho) {
    await api(`/admin/devices/${aparelho.id}`, { method: "DELETE" });
    await recarregar();
    return true;
  }

  async function criarContaAdministrativa(conta) {
    await api("/admin/users", { method: "POST", body: conta });
    await recarregar();
  }

  async function alterarEstadoConta(user, active) {
    await api(`/admin/users/${user.id}/active`, {
      method: "PUT",
      body: { active },
    });
    await recarregar();
  }

  async function revisarSolicitacaoAdmin(user, approve) {
    await api(`/admin/users/${user.id}/admin-role`, {
      method: "PUT",
      body: { approve },
    });
    await recarregar();
  }

  async function salvarSala(sala) {
    const { id, ...body } = sala;
    if (id) {
      await api(`/admin/rooms/${id}`, { method: "PUT", body });
    } else {
      await api("/admin/rooms", { method: "POST", body });
    }
    await recarregar();
  }

  async function excluirSala(sala) {
    await api(`/admin/rooms/${sala.id}`, { method: "DELETE" });
    await recarregar();
  }

  async function atualizarPerfil(perfil) {
    const { user } = await api("/auth/profile", {
      method: "PUT",
      body: perfil,
    });
    setFuncionario(user);
  }

  async function sair() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      setErroOperacao(error.message);
    } finally {
      setFuncionario(null);
      setDados(valoresIniciais);
      setEmprestimoParaDevolver(null);
      setAparelhoSelecionado(null);
      setErroOperacao("");
      setAvisoAcesso("");
      setErroLogin("");
      setMensagemLogin("");
      setTelaDeAcesso("login");
      setPaginaAtiva("home");
    }
  }

  if (carregando) {
    return <main className="app-loading" role="status">Carregando o portal…</main>;
  }

  if (!funcionario) {
    if (telaDeAcesso === "alterar-senha") {
      return (
        <AlterarSenha
          initialRm={rmParaAtualizarSenha}
          onSubmit={alterarSenhaAntesDoLogin}
          onBack={() => {
            setErroLogin("");
            setTelaDeAcesso("login");
          }}
          erro={erroLogin}
        />
      );
    }

    if (telaDeAcesso === "verificar-email") {
      return (
        <VerificarEmail
          initialEmail={emailPendente}
          initialCode={codigoDevPendente}
          onVerify={verificarEmail}
          onResend={reenviarCodigo}
          onBack={() => {
            setErroLogin("");
            setTelaDeAcesso("login");
          }}
        />
      );
    }

    if (telaDeAcesso === "cadastro") {
      return (
        <Cadastro
          onVoltarLogin={() => {
            setErroLogin("");
            setTelaDeAcesso("login");
          }}
          onCadastrar={cadastrarFuncionario}
          onVerificarEmail={() => setTelaDeAcesso("verificar-email")}
        />
      );
    }

    return (
      <Login
        onLogin={fazerLogin}
        onDeveloperLogin={fazerLoginDev}
        developerAccess={developerAccess}
        onChangePassword={() => {
          setMensagemLogin("");
          setErroLogin("");
          setTelaDeAcesso("alterar-senha");
        }}
        onCreateAccount={() => {
          setMensagemLogin("");
          setErroLogin("");
          setTelaDeAcesso("cadastro");
        }}
        onVerifyEmail={() => {
          setMensagemLogin("");
          setErroLogin("");
          setTelaDeAcesso("verificar-email");
        }}
        mensagem={mensagemLogin}
        erro={erroLogin || erroOperacao}
      />
    );
  }

  const PaginaAtual = paginas[paginaAtiva];
  const [titulo, subtitulo] = dadosPaginas[paginaAtiva];
  const meusEmprestimos = dados.loans.filter(
    (loan) => loan.ownerRm === funcionario.registro,
  );
  const meuHistorico = dados.history.filter(
    (loan) => loan.ownerRm === funcionario.registro,
  );
  const propriedadesDaPagina = {
    home: {
      onNavigate: navegar,
      loans: dados.loans,
      devices: dados.devices,
      onReturn: setEmprestimoParaDevolver,
      canReturn: (loan) =>
        loan.ownerRm === funcionario.registro &&
        ["Em uso", "Atrasado"].includes(loan.status),
      funcionario,
    },
    devices: {
      devices: dados.devices,
      onRequest: setAparelhoSelecionado,
    },
    map: {
      rooms: dados.rooms,
    },
    loans: {
      loans: meusEmprestimos,
      onReturn: setEmprestimoParaDevolver,
      canReturn: (loan) => ["Em uso", "Atrasado"].includes(loan.status),
    },
    history: {
      history: podeAcessarAdmin ? dados.history : meuHistorico,
      canClearHistory: podeAcessarAdmin,
      onClearHistory: apagarHistorico,
    },
    profile: {
      loans: meusEmprestimos,
      funcionario,
      onSave: atualizarPerfil,
    },
    admin: {
      funcionario,
      loans: dados.loans,
      devices: dados.devices,
      rooms: dados.rooms,
      history: dados.history,
      activities: dados.activities,
      users: dados.users,
      onReturn: setEmprestimoParaDevolver,
      onApproveLoan: aprovarEmprestimo,
      onRejectLoan: recusarEmprestimo,
      onSaveDevice: salvarAparelho,
      onDeleteDevice: excluirAparelho,
      onCreateUser: criarContaAdministrativa,
      onToggleUser: alterarEstadoConta,
      onReviewAdminRequest: revisarSolicitacaoAdmin,
      onSaveRoom: salvarSala,
      onDeleteRoom: excluirSala,
    },
  }[paginaAtiva] || {};

  return (
    <div className={`app-shell ${menuMobileAberto ? "nav-open" : ""}`}>
      <Sidebar
        active={paginaAtiva}
        onNavigate={navegar}
        canAccessAdmin={podeAcessarAdmin}
        onLogout={sair}
      />
      {menuMobileAberto && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuMobileAberto(false)}
        />
      )}
      <div className="main-area">
        <Header
          title={titulo}
          subtitle={subtitulo}
          funcionario={funcionario}
          menuOpen={menuMobileAberto}
          onMenu={() => setMenuMobileAberto((aberto) => !aberto)}
          onProfile={() => navegar("profile")}
        />
        <main>
          {(avisoAcesso || erroOperacao) && (
            <div className="permission-toast" role="alert">
              <span>{erroOperacao || avisoAcesso}</span>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => {
                  setAvisoAcesso("");
                  setErroOperacao("");
                }}
              >
                ×
              </button>
            </div>
          )}
          <PaginaAtual {...propriedadesDaPagina} />
        </main>
        <footer className="footer">
          © 2024 Sesi Cerquilho - Equipe laboratorio 428
          <span> · </span>
          Ambiente acadêmico
        </footer>
      </div>
      {aparelhoSelecionado && (
        <LoanModal
          device={aparelhoSelecionado}
          rooms={dados.rooms}
          onClose={() => setAparelhoSelecionado(null)}
          onConfirm={registrarEmprestimo}
        />
      )}
      <ReturnModal
        loan={emprestimoParaDevolver}
        onClose={() => setEmprestimoParaDevolver(null)}
        onConfirm={registrarDevolucao}
      />
    </div>
  );
}
