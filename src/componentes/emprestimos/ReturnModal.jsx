import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export default function ReturnModal({ loan, onClose, onConfirm }) {
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClose = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setSucesso(false);
    setErro('');
    setSalvando(false);
    onClose();
  };

  if (!loan) return null;

  const handleConfirmarDevolucao = async () => {
    if (sucesso || salvando) return;

    setSalvando(true);
    setErro('');
    try {
      if (onConfirm) await onConfirm(loan);
    } catch (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setSucesso(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setSucesso(false);
      onClose();
    }, 1500);
  };

  // Estilos inline forçados para garantir centralização absoluta na tela
  const backdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  };

  const modalStyle = {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
    boxSizing: 'border-box',
    position: 'relative',
  };

  return ReactDOM.createPortal(
    <div style={backdropStyle} onMouseDown={handleClose}>
      <div style={modalStyle} onMouseDown={(event) => event.stopPropagation()}>
        <button 
          onClick={handleClose} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          ×
        </button>

        {sucesso ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <h2 style={{ color: 'green' }}>✓ Devolução Registrada!</h2>
            <p>Aparelho: <strong>{loan.device}</strong></p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>Registrado como devolvido com sucesso.</p>
          </div>
        ) : (
          <>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', letterSpacing: '1px' }}>REGISTRAR DEVOLUÇÃO</span>
            <h2 style={{ margin: '10px 0 5px 0' }}>Confirmar devolução</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>
              Confirme os dados do item que está retornando ao acervo.
            </p>

            <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              <strong>{loan.device}</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                Responsável: {loan.responsible} · Qtd: {loan.qty}
              </p>
            </div>

            <div style={{ marginBottom: '20px', fontSize: '0.95rem', color: '#444', background: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
              <p style={{ margin: '4px 0' }}><strong>Sala de aula:</strong> {loan.room}</p>
              <p style={{ margin: '4px 0' }}><strong>Função:</strong> {loan.department}</p>
              <p style={{ margin: '4px 0' }}><strong>Data do Empréstimo:</strong> {loan.date}</p>
              <p style={{ margin: '4px 0' }}><strong>Devolução prevista:</strong> {loan.returnTime || 'Não informada'}</p>
            </div>

            <button 
              onClick={handleConfirmarDevolucao}
              disabled={salvando}
              style={{ width: '100%', padding: '12px', backgroundColor: '#e53935', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {salvando ? "Registrando…" : "Confirmar devolução →"}
            </button>
            {erro && <p role="alert" style={{ color: '#c62828', marginTop: 10 }}>{erro}</p>}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
