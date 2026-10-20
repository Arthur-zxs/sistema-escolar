
import React, { useEffect, useRef, useState } from 'react';

export default function LoanModal({ device, rooms = [], onClose, onConfirm }) {
  const [responsavel, setResponsavel] = useState('');
  const [erroResponsavel, setErroResponsavel] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [erroQuantidade, setErroQuantidade] = useState('');
  const [salaId, setSalaId] = useState('lab-04');
  const [horaDevolucao, setHoraDevolucao] = useState('');
  const [erroHorario, setErroHorario] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [erroSolicitacao, setErroSolicitacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef(null);
  const salasDeAula = rooms.filter((room) => room.kind === 'Sala de aula');
  const salaSelecionadaId = salasDeAula.some((room) => room.id === salaId)
    ? salaId
    : salasDeAula[0]?.id || '';

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!device) return null;

  const handleConfirmar = async () => {
    if (salvando) return;
    if (!responsavel.trim()) {
      setErroResponsavel('Por favor, digite o nome do responsável.');
      return;
    }
    setErroResponsavel('');

    if (!/^\d{2}:\d{2}$/.test(horaDevolucao)) {
      setErroHorario('Informe o horário previsto para a devolução.');
      return;
    }
    const [hora, minuto] = horaDevolucao.split(':').map(Number);
    const dataDevolucao = new Date();
    dataDevolucao.setHours(hora, minuto, 0, 0);
    if (dataDevolucao <= new Date()) dataDevolucao.setDate(dataDevolucao.getDate() + 1);
    setErroHorario('');

    const quantidadeSolicitada = Number(quantidade);
    if (
      !Number.isInteger(quantidadeSolicitada) ||
      quantidadeSolicitada < 1 ||
      quantidadeSolicitada > device.available
    ) {
      setErroQuantidade(`Informe uma quantidade entre 1 e ${device.available}.`);
      return;
    }
    setErroQuantidade('');
    if (!salaSelecionadaId) {
      setErroSolicitacao('Cadastre uma sala antes de solicitar um aparelho.');
      return;
    }

    // A API registra a data e a hora no momento em que recebe a solicitação.
    const dadosEmprestimo = {
      deviceId: device.id,
      responsible: responsavel.toUpperCase(),
      qty: quantidade,
      roomId: salaSelecionadaId,
      returnAt: dataDevolucao.toISOString(),
    };

    setSalvando(true);
    try {
      const result = onConfirm ? await onConfirm(dadosEmprestimo) : null;
      setMensagemSucesso(result?.message || 'Empréstimo registrado com sucesso.');
    } catch (error) {
      setErroSolicitacao(error.message);
      setSalvando(false);
      return;
    }

    // Mostra feedback visual de sucesso informando o nome e o horário do empréstimo
    setSucesso(true);
    timerRef.current = setTimeout(() => {
      setSucesso(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        {sucesso ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <h2 style={{ color: 'green' }}>✓ Empréstimo registrado!</h2>
            <p>Responsável: <strong>{responsavel.toUpperCase()}</strong></p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>{mensagemSucesso}</p>
          </div>
        ) : (
          <>
            <span className="eyebrow">NOVO EMPRÉSTIMO</span>
            <h2>Registrar empréstimo</h2>
            <p className="modal-subtitle">
              Informe quem utilizará o aparelho, a sala de aula e o horário de devolução.
            </p>
            <div className="modal-device">
              <div className={`device-visual visual-${device.tone}`}>
                <span>{device.icon}</span>
              </div>
              <div>
                <strong>{device.name}</strong>
                <small>{device.brand} · {device.available} disponíveis</small>
              </div>
            </div>

            <label>
              Nome do Responsável
              <input
                type="text"
                value={responsavel}
                aria-invalid={Boolean(erroResponsavel)}
                onChange={(e) => {
                  setResponsavel(e.target.value);
                  if (e.target.value.trim()) setErroResponsavel('');
                }}
                placeholder="Digite seu nome..."
                required
              />
              {erroResponsavel && (
                <small role="alert" style={{ color: '#c62828' }}>
                  {erroResponsavel}
                </small>
              )}
            </label>

            <label>
              Quantidade
              <input
                type="number"
                value={quantidade}
                aria-invalid={Boolean(erroQuantidade)}
                onChange={(e) => {
                  setQuantidade(e.target.value);
                  setErroQuantidade('');
                }}
                min="1"
                max={device.available}
              />
              {erroQuantidade && (
                <small role="alert" style={{ color: '#c62828' }}>
                  {erroQuantidade}
                </small>
              )}
            </label>

            <label>
              Sala de aula de utilização
              <select
                value={salaSelecionadaId}
                onChange={(event) => setSalaId(event.target.value)}
                required
                disabled={salasDeAula.length === 0}
              >
                {salasDeAula.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
              {salasDeAula.length === 0 && (
                <small role="alert" style={{ color: '#c62828' }}>
                  Não há salas de aula cadastradas para registrar o local de uso.
                </small>
              )}
            </label>

            <label>
              Horário previsto de devolução
              <input
                type="time"
                value={horaDevolucao}
                aria-invalid={Boolean(erroHorario)}
                onChange={(e) => {
                  const horario = e.target.value;
                  setHoraDevolucao(horario);
                  setErroHorario('');
                }}
                required
              />
              <small>Se o horário já tiver passado hoje, a devolução será prevista para amanhã.</small>
              {erroHorario && (
                <small role="alert" style={{ color: '#c62828' }}>
                  {erroHorario}
                </small>
              )}
            </label>

            {erroSolicitacao && (
              <p className="form-error" role="alert">{erroSolicitacao}</p>
            )}
            <button className="primary-button full-button" onClick={handleConfirmar} disabled={salvando}>
              {salvando ? "Registrando…" : "Registrar empréstimo"} <span>→</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
