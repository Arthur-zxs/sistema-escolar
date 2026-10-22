import { useEffect, useMemo, useState } from "react";
import Badge from "../componentes/comuns/Badge";
import Icon from "../componentes/comuns/Icon";
import StatCard from "../componentes/comuns/StatCard";
import exportarEmprestimos from "../utilitarios/exportarEmprestimos";
import rotuloStatusEmprestimo from "../utilitarios/rotuloStatusEmprestimo";

const filtros = [
  { label: "Todos", value: "Todos" },
  { label: "Em uso", value: "Em uso" },
  { label: "Atrasado", value: "Atrasado" },
];

function statusEmprestimo(loan, agora) {
  if (["Pendente", "Atrasado", "Recusado"].includes(loan.status)) {
    return loan.status;
  }

  if (loan.dueAt) {
    return new Date(loan.dueAt) < agora ? "Atrasado" : loan.status;
  }

  const data = String(loan.date || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const horario = String(loan.returnTime || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!data || !horario) return loan.status;

  const vencimento = new Date(
    Number(data[3]),
    Number(data[2]) - 1,
    Number(data[1]),
    Number(horario[1]),
    Number(horario[2]),
  );

  return vencimento < agora ? "Atrasado" : loan.status;
}

export default function AdminPage({
  loans,
  devices,
  rooms,
  history,
  activities,
  users,
  funcionario,
  onReturn,
  onApproveLoan,
  onRejectLoan,
  onSaveDevice,
  onDeleteDevice,
  onCreateUser,
  onToggleUser,
  onReviewAdminRequest,
  onSaveRoom,
  onDeleteRoom,
}) {
  const [query, setQuery] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("Todos");
  const [abaGestao, setAbaGestao] = useState("acervo");
  const [aparelhoEmEdicao, setAparelhoEmEdicao] = useState(null);
  const [erroAparelho, setErroAparelho] = useState("");
  const [erroAdministracao, setErroAdministracao] = useState("");
  const [contaForm, setContaForm] = useState({
    nome: "",
    rm: "",
    email: "",
    funcao: "Secretaria",
    password: "",
  });
  const [salaForm, setSalaForm] = useState({
    name: "",
    kind: "Sala de aula",
    block: "A",
  });
  const [salaEmEdicao, setSalaEmEdicao] = useState("");
  const [agora, setAgora] = useState(() => new Date());
  const [formAparelho, setFormAparelho] = useState({
    name: "",
    brand: "",
    type: "Notebook",
    total: "1",
    location: "LMT",
  });

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const emprestimosFiltrados = useMemo(() => {
    const termo = query.trim().toLocaleLowerCase("pt-BR");

    return loans.filter((loan) => {
      const status = statusEmprestimo(loan, agora);
      const correspondeAoFiltro =
        filtroAtivo === "Todos" || status === filtroAtivo;
      const textoEmprestimo = [
        loan.device,
        loan.responsible,
        loan.room,
        loan.department,
        status,
        rotuloStatusEmprestimo(status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return correspondeAoFiltro && textoEmprestimo.includes(termo);
    });
  }, [agora, filtroAtivo, loans, query]);

  const unidadesEmprestadas = loans.reduce(
    (total, loan) =>
      total + (["Em uso", "Atrasado"].includes(loan.status) ? Number(loan.qty || 0) : 0),
    0,
  );
  const unidadesDisponiveis = devices.reduce(
    (total, device) => total + Number(device.available || 0),
    0,
  );
  const unidadesNoAcervo = devices.reduce(
    (total, device) => total + Number(device.total || 0),
    0,
  );
  const atrasados = loans.filter((loan) => statusEmprestimo(loan, agora) === "Atrasado").length;
  const agendados = loans.filter((loan) => loan.status === "Pendente").length;
  const emprestimosAtivos = loans.filter((loan) =>
    ["Em uso", "Atrasado"].includes(loan.status),
  ).length;

  function iniciarEdicao(aparelho) {
    setAparelhoEmEdicao(aparelho);
    setFormAparelho({
      name: aparelho.name,
      brand: aparelho.brand,
      type: aparelho.type,
      total: String(aparelho.total),
      location: aparelho.location,
    });
    setErroAparelho("");
  }

  function limparFormulario() {
    setAparelhoEmEdicao(null);
    setFormAparelho({
      name: "",
      brand: "",
      type: "Notebook",
      total: "1",
      location: "LMT",
    });
    setErroAparelho("");
  }

  async function salvarFormularioAparelho(event) {
    event.preventDefault();
    const total = Number(formAparelho.total);
    const unidadesEmprestadas = aparelhoEmEdicao
      ? aparelhoEmEdicao.total - aparelhoEmEdicao.available
      : 0;

    if (!Number.isInteger(total) || total < 1) {
      setErroAparelho("Informe uma quantidade total válida, maior que zero.");
      return;
    }
    if (total < unidadesEmprestadas) {
      setErroAparelho(
        `Há ${unidadesEmprestadas} unidade(s) emprestada(s). O total não pode ser menor que isso.`,
      );
      return;
    }

    try {
      await onSaveDevice({
        ...formAparelho,
        id: aparelhoEmEdicao?.id,
        tone: aparelhoEmEdicao?.tone || (formAparelho.type === "Notebook" ? "blue" : "green"),
        icon: formAparelho.type === "Notebook" ? "▣" : "▯",
      });
      limparFormulario();
    } catch (error) {
      setErroAparelho(error.message);
    }
  }

  async function executarAcao(acao) {
    setErroAdministracao("");
    try {
      await acao();
    } catch (error) {
      setErroAdministracao(error.message);
    }
  }

  async function criarConta(event) {
    event.preventDefault();
    await executarAcao(async () => {
      await onCreateUser(contaForm);
      setContaForm({
        nome: "",
        rm: "",
        email: "",
        funcao: "Secretaria",
        password: "",
      });
    });
  }

  async function cadastrarSala(event) {
    event.preventDefault();
    await executarAcao(async () => {
      await onSaveRoom({ ...salaForm, id: salaEmEdicao || undefined });
      setSalaForm({ name: "", kind: "Sala de aula", block: "A" });
      setSalaEmEdicao("");
    });
  }

  return (
    <div className="page-content admin-page">
      <section className="admin-welcome">
        <div>
          <span className="eyebrow">HOME DO GESTOR</span>
          <h2>Central de gestão</h2>
          <p>
            Acompanhe empréstimos, acervo, salas e contas em um único painel.
          </p>
        </div>
        <button
          className="outline-button admin-export"
          type="button"
          onClick={() => exportarEmprestimos(emprestimosFiltrados.map((loan) => ({
            ...loan,
            status: rotuloStatusEmprestimo(statusEmprestimo(loan, agora)),
          })))}
        >
          <Icon>⇩</Icon> Exportar empréstimos
        </button>
      </section>

      <section className="stats-grid admin-stats" aria-label="Indicadores do acervo">
        <StatCard
          label="Empréstimos ativos"
          value={emprestimosAtivos}
          detail={`${agendados} empréstimo(s) agendado(s)`}
          icon="↔"
          tone="blue"
        />
        <StatCard
          label="Unidades emprestadas"
          value={unidadesEmprestadas}
          detail="equipamentos em uso"
          icon="▣"
          tone="orange"
        />
        <StatCard
          label="Em atraso"
          value={atrasados}
          detail="precisam de acompanhamento"
          icon="!"
          tone="red"
        />
        <StatCard
          label="Disponíveis"
          value={unidadesDisponiveis}
          detail={`de ${unidadesNoAcervo} unidades no acervo`}
          icon="✓"
          tone="green"
        />
      </section>

      {(agendados > 0 || atrasados > 0) && (
        <section className="admin-alerts" aria-label="Ações que precisam de atenção">
          <div className="section-heading">
            <div>
              <h2>Precisa de atenção</h2>
              <p>Empréstimos agendados aguardando aprovação e devoluções em atraso.</p>
            </div>
          </div>
          <div className="admin-alert-list">
            {loans
              .filter((loan) => ["Pendente", "Atrasado"].includes(statusEmprestimo(loan, agora)))
              .map((loan) => (
                <article className="admin-alert-item" key={loan.id}>
                  <span className={`admin-alert-marker ${statusEmprestimo(loan, agora) === "Atrasado" ? "is-late" : ""}`}>
                    {statusEmprestimo(loan, agora) === "Atrasado" ? "!" : "…"}
                  </span>
                  <div className="admin-alert-copy">
                    <strong>{loan.device} · {loan.responsible || "Responsável não informado"}</strong>
                    <span>{statusEmprestimo(loan, agora) === "Pendente" ? "Agendado · aguardando aprovação" : "Devolução atrasada"} · {loan.room}</span>
                  </div>
                  {statusEmprestimo(loan, agora) === "Pendente" ? (
                    <div className="admin-alert-actions">
                      <button
                        className="return-button"
                        type="button"
                        onClick={() => executarAcao(() => onApproveLoan(loan.id))}
                      >
                        Aprovar
                      </button>
                      <button
                        className="return-button admin-delete-button"
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Recusar a solicitação de ${loan.device}?`)) {
                            executarAcao(() => onRejectLoan(loan.id));
                          }
                        }}
                      >
                        Recusar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="return-button"
                      type="button"
                      onClick={() => onReturn(loan)}
                    >
                      Registrar devolução
                    </button>
                  )}
                </article>
              ))}
          </div>
        </section>
      )}

      <section className="admin-loans">
        <div className="section-heading admin-section-heading">
          <div>
            <h2>Todos os empréstimos</h2>
            <p>
              {emprestimosFiltrados.length} de {loans.length} registros
            </p>
          </div>
          <label className="search admin-search">
            <Icon>⌕</Icon>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar aparelho, responsável..."
              aria-label="Buscar empréstimos"
            />
          </label>
        </div>

        <div className="filters admin-filters" aria-label="Filtrar por status">
          {filtros.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={filtroAtivo === value ? "selected" : ""}
              aria-pressed={filtroAtivo === value}
              onClick={() => setFiltroAtivo(value)}
            >
              {label}
              {value === "Atrasado" && atrasados > 0 && (
                <span className="admin-filter-count">{atrasados}</span>
              )}
            </button>
          ))}
        </div>

        <div className="table-wrap admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aparelho</th>
                <th>Responsável</th>
                <th>Qtd.</th>
                <th>Sala / setor</th>
                <th>Retirada</th>
                <th>Devolução prevista</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {emprestimosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    Nenhum empréstimo corresponde a essa busca.
                  </td>
                </tr>
              ) : (
                emprestimosFiltrados.map((loan) => (
                  <tr key={loan.id}>
                    <td>
                      <div className="device-cell">
                        <span className="mini-device">
                          {loan.device?.includes("Galaxy") ||
                          loan.device?.includes("Motorola")
                            ? "▯"
                            : "▣"}
                        </span>
                        <strong>{loan.device}</strong>
                      </div>
                    </td>
                    <td>{loan.responsible || "Não informado"}</td>
                    <td>{loan.qty}</td>
                    <td>
                      <strong className="admin-room">{loan.room}</strong>
                      <span className="admin-department">
                        {loan.department || "Função não informada"}
                      </span>
                    </td>
                    <td>{loan.date}</td>
                    <td>{loan.returnTime || "—"}</td>
                    <td>
                      <Badge tone={loan.statusTone || (
                        statusEmprestimo(loan, agora) === "Atrasado" ||
                        statusEmprestimo(loan, agora) === "Recusado"
                          ? "red"
                          : statusEmprestimo(loan, agora) === "Pendente"
                            ? "orange"
                            : "blue"
                      )}>
                        {rotuloStatusEmprestimo(statusEmprestimo(loan, agora))}
                      </Badge>
                    </td>
                    <td>
                      {statusEmprestimo(loan, agora) === "Pendente" ? (
                        <div className="admin-row-actions">
                          <button type="button" className="return-button" onClick={() => executarAcao(() => onApproveLoan(loan.id))}>Aprovar</button>
                          <button type="button" className="return-button admin-delete-button" onClick={() => {
                            if (window.confirm(`Recusar a solicitação de ${loan.device}?`)) {
                              executarAcao(() => onRejectLoan(loan.id));
                            }
                          }}>Recusar</button>
                        </div>
                      ) : ["Em uso", "Atrasado"].includes(statusEmprestimo(loan, agora)) ? (
                        <button
                          type="button"
                          className="return-button"
                          onClick={() => onReturn(loan)}
                          aria-label={`Registrar devolução de ${loan.device}`}
                        >
                          Devolução
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <nav className="filters admin-management-tabs" aria-label="Seções de gerenciamento">
        {[
          ["acervo", "Gerenciar acervo"],
          ["salas", "Gerenciar salas de aula"],
          ["contas", "Gerenciar contas"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={abaGestao === id ? "selected" : ""}
            aria-pressed={abaGestao === id}
            onClick={() => setAbaGestao(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {abaGestao === "acervo" && (
      <section className="admin-inventory">
        <div className="section-heading">
          <div>
            <h2>Gerenciar acervo</h2>
            <p>Cadastre e atualize os aparelhos e suas quantidades disponíveis.</p>
          </div>
        </div>
        <form className="admin-device-form" onSubmit={salvarFormularioAparelho}>
          <label className="admin-device-existing">
            Aparelho existente
            <select
              value={aparelhoEmEdicao?.id ?? ""}
              onChange={(event) => {
                const aparelho = devices.find(
                  (item) => String(item.id) === event.target.value,
                );
                if (aparelho) {
                  iniciarEdicao(aparelho);
                } else {
                  limparFormulario();
                }
              }}
            >
              <option value="">Cadastrar novo aparelho</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {device.available}/{device.total} disponíveis
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome do aparelho
            <input
              required
              value={formAparelho.name}
              onChange={(event) =>
                setFormAparelho({ ...formAparelho, name: event.target.value })
              }
              placeholder="Ex.: Dell Latitude 5420"
            />
          </label>
          <label>
            Marca
            <input
              required
              value={formAparelho.brand}
              onChange={(event) =>
                setFormAparelho({ ...formAparelho, brand: event.target.value })
              }
              placeholder="Ex.: Dell"
            />
          </label>
          <label>
            Tipo
            <select
              value={formAparelho.type}
              onChange={(event) =>
                setFormAparelho({ ...formAparelho, type: event.target.value })
              }
            >
              <option>Notebook</option>
              <option>Celular</option>
            </select>
          </label>
          <label>
            Quantidade total
            <input
              type="number"
              min="1"
              step="1"
              required
              value={formAparelho.total}
              onChange={(event) =>
                setFormAparelho({ ...formAparelho, total: event.target.value })
              }
            />
          </label>
          <label>
            Local do acervo
            <select
              required
              value={formAparelho.location}
              onChange={(event) =>
                setFormAparelho({ ...formAparelho, location: event.target.value })
              }
            >
              {aparelhoEmEdicao &&
                !["LMT", "Maker"].includes(aparelhoEmEdicao.location) && (
                  <option value={aparelhoEmEdicao.location}>
                    {aparelhoEmEdicao.location} · local legado não classificado
                  </option>
                )}
              <option value="LMT">LMT</option>
              <option value="Maker">Maker</option>
            </select>
          </label>
          <div className="admin-device-actions">
            <button className="primary-button" type="submit">
              {aparelhoEmEdicao ? "Salvar alterações" : "Cadastrar aparelho"}
            </button>
            {aparelhoEmEdicao && (
              <button
                className="outline-button"
                type="button"
                onClick={limparFormulario}
              >
                Cancelar edição
              </button>
            )}
          </div>
          {erroAparelho && (
            <p className="form-error admin-form-error" role="alert">
              {erroAparelho}
            </p>
          )}
        </form>
        <div className="table-wrap admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aparelho</th>
                <th>Tipo / marca</th>
                <th>Local</th>
                <th>Total</th>
                <th>Disponíveis</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td><strong>{device.name}</strong></td>
                  <td>{device.type} · {device.brand}</td>
                  <td>{device.location}</td>
                  <td>{device.total}</td>
                  <td>{device.available}</td>
                  <td className="admin-row-actions">
                    <button
                      className="return-button"
                      type="button"
                      onClick={() => iniciarEdicao(device)}
                    >
                      Editar
                    </button>
                    <button
                      className="return-button admin-delete-button"
                      type="button"
                      disabled={
                        device.total !== device.available ||
                        loans.some((loan) => loan.device === device.name)
                      }
                      title={
                        device.total !== device.available ||
                        loans.some((loan) => loan.device === device.name)
                          ? "Não é possível remover aparelhos associados a empréstimos ou solicitações."
                          : ""
                      }
                      onClick={() => executarAcao(async () => {
                        await onDeleteDevice(device);
                          if (aparelhoEmEdicao?.id === device.id) limparFormulario();
                          setErroAparelho("");
                      })}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {abaGestao === "salas" && (
      <section className="admin-inventory">
        <div className="section-heading">
          <div>
            <h2>Gerenciar salas de aula</h2>
            <p>Os blocos A e B comportam até 12 salas cada. Os acervos LMT e Maker são definidos nos aparelhos.</p>
          </div>
        </div>
        <form className="admin-device-form" onSubmit={cadastrarSala}>
          <label>
            Sala ou espaço existente
            <select
              value={salaEmEdicao}
              onChange={(event) => {
                const room = rooms.find(
                  (item) => item.kind === "Sala de aula" && item.id === event.target.value,
                );
                setSalaEmEdicao(room?.id || "");
                setSalaForm(
                  room
                    ? { name: room.name, kind: room.kind, block: room.block || "A" }
                    : { name: "", kind: "Sala de aula", block: "A" },
                );
              }}
            >
              <option value="">Cadastrar novo espaço</option>
              {rooms.filter((room) => room.kind === "Sala de aula").map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · Bloco {room.block || "A"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome
            <input
              required
              value={salaForm.name}
              onChange={(event) =>
                setSalaForm({ ...salaForm, name: event.target.value })
              }
              placeholder="Ex.: Sala 05"
            />
          </label>
          <label>
            Bloco
            <select
              value={salaForm.block}
              onChange={(event) =>
                setSalaForm({ ...salaForm, block: event.target.value })
              }
            >
              <option value="A">Bloco A ({rooms.filter((room) => room.kind === "Sala de aula" && room.block === "A" && room.id !== salaEmEdicao).length}/12)</option>
              <option value="B">Bloco B ({rooms.filter((room) => room.kind === "Sala de aula" && room.block === "B" && room.id !== salaEmEdicao).length}/12)</option>
            </select>
          </label>
          <label>
            Tipo
            <input value="Sala de aula" readOnly />
          </label>
          <div className="admin-device-actions">
            <button className="primary-button" type="submit">
              {salaEmEdicao ? "Salvar espaço" : "Cadastrar espaço"}
            </button>
            {salaEmEdicao && (
              <>
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => {
                    setSalaEmEdicao("");
                    setSalaForm({ name: "", kind: "Sala de aula", block: "A" });
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="return-button admin-delete-button"
                  type="button"
                  disabled={loans.some((loan) => loan.roomId === salaEmEdicao)}
                  onClick={() =>
                    executarAcao(async () => {
                      await onDeleteRoom({ id: salaEmEdicao });
                      setSalaEmEdicao("");
                      setSalaForm({ name: "", kind: "Sala de aula", block: "A" });
                    })
                  }
                >
                  Remover
                </button>
              </>
            )}
          </div>
        </form>
        <div className="table-wrap admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Sala de aula</th><th>Bloco</th><th>Aparelhos em uso</th></tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td><strong>{room.name}</strong></td>
                  <td>Bloco {room.block || "A"}</td>
                  <td>{room.devices.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {abaGestao === "contas" && (
      <section className="admin-inventory">
        <div className="section-heading">
          <div>
            <h2>Gerenciar contas</h2>
            <p>Crie contas, gerencie funções e revise solicitações de acesso administrativo.</p>
          </div>
        </div>
        <form className="admin-device-form" onSubmit={criarConta}>
          <label>
            Nome completo
            <input
              required
              value={contaForm.nome}
              onChange={(event) =>
                setContaForm({ ...contaForm, nome: event.target.value })
              }
            />
          </label>
          <label>
            RM
            <input
              required
              type="text"
              inputMode="numeric"
              pattern="[0-9]{7}"
              minLength="7"
              maxLength="7"
              title="O RM deve conter exatamente 7 dígitos."
              value={contaForm.rm}
              onChange={(event) =>
                setContaForm({ ...contaForm, rm: event.target.value })
              }
            />
          </label>
          <label>
            E-mail institucional
            <input
              required
              type="email"
              placeholder="nome@senaisp.edu.br"
              pattern="[^@\s]+@senaisp\.edu\.br"
              title="Use um e-mail institucional @senaisp.edu.br."
              value={contaForm.email}
              onChange={(event) =>
                setContaForm({ ...contaForm, email: event.target.value })
              }
            />
          </label>
          <label>
            Função
            <select
              value={contaForm.funcao}
              onChange={(event) =>
                setContaForm({ ...contaForm, funcao: event.target.value })
              }
            >
              <option>Diretoria</option>
              <option>Secretaria</option>
              <option>Orientador de Educação Digital</option>
              <option>Professor(a)</option>
              <option>Estagiário(a)</option>
              <option>Técnico(a) de laboratório</option>
              <option>Outro</option>
            </select>
          </label>
          <label>
            Senha inicial (mínimo de 12 caracteres)
            <input
              required
              type="password"
              minLength="12"
              maxLength="72"
              title="Use pelo menos 12 caracteres (máximo de 72 bytes)."
              autoComplete="new-password"
              value={contaForm.password}
              onChange={(event) =>
                setContaForm({ ...contaForm, password: event.target.value })
              }
            />
          </label>
          <div className="admin-device-actions">
            <button className="primary-button" type="submit">Criar conta</button>
          </div>
        </form>
        <div className="table-wrap admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Funcionário</th><th>RM</th><th>Função</th><th>Estado</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.nome}</td>
                  <td>{user.registro}</td>
                  <td>
                    {user.requestedRole
                      ? `${user.requestedRole} (solicitação pendente)`
                      : user.funcao}
                  </td>
                  <td>
                    {user.requestedRole
                      ? "Aguardando aprovação"
                      : user.active ? "Ativa" : "Desativada"}
                  </td>
                  <td>
                    {user.requestedRole ? (
                      <div className="admin-device-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            executarAcao(() => onReviewAdminRequest(user, true))
                          }
                        >
                          Aprovar acesso
                        </button>
                        <button
                          type="button"
                          className="return-button"
                          onClick={() =>
                            executarAcao(() => onReviewAdminRequest(user, false))
                          }
                        >
                          Recusar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="return-button"
                        disabled={user.id === funcionario.id}
                        onClick={() =>
                          executarAcao(() =>
                            onToggleUser(user, !user.active),
                          )
                        }
                      >
                        {user.active ? "Desativar" : "Ativar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      <section className="admin-history">
        <div className="section-heading">
          <div>
            <h2>Histórico de devoluções</h2>
            <p>{history.length} registro(s) concluído(s)</p>
          </div>
        </div>
        <div className="table-wrap admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aparelho</th>
                <th>Responsável</th>
                <th>Quantidade</th>
                <th>Local</th>
                <th>Retirada</th>
                <th>Devolução</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="7" className="empty-cell">Nenhuma devolução registrada.</td></tr>
              ) : history.map((item, index) => (
                <tr key={item.id || `${item.device}-${item.date}-${index}`}>
                  <td>{item.device}</td>
                  <td>{item.responsible || "Não informado"}</td>
                  <td>{item.qty}</td>
                  <td>{item.room}</td>
                  <td>{item.date}</td>
                  <td>{item.returned}</td>
                  <td><Badge tone="green">{item.status || "Devolvido"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-history">
        <div className="section-heading">
          <div>
            <h2>Atividades administrativas</h2>
            <p>Registro das ações realizadas nesta sessão.</p>
          </div>
        </div>
        {activities.length === 0 ? (
          <p className="admin-empty-activity">As próximas ações administrativas aparecerão aqui.</p>
        ) : (
          <ul className="admin-activity-list">
            {activities.map((activity) => (
              <li key={activity.id}>
                <div><strong>{activity.mensagem}</strong><span>{activity.responsavel}</span></div>
                <time>{activity.data}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {erroAdministracao && (
        <p className="form-error" role="alert">{erroAdministracao}</p>
      )}

      <p className="admin-data-note">
        Dados mantidos no banco SQLite do servidor. Notificações por e-mail/SMS
        ainda dependem da configuração de um provedor externo.
      </p>
    </div>
  );
}
