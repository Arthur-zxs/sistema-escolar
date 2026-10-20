import React from 'react';
import Badge from "../comuns/Badge";

export default function LoanTable({ rows, compact = false, onReturn, canReturn }) {
  return (
    <div className={`table-wrap ${compact ? "compact-table" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Aparelho</th>
            <th>Responsável</th>
            <th>Qtd.</th>
            <th>Sala de aula</th>
            <th>Função</th>
            <th>Data</th>
            <th>Devolução prevista</th>
            <th>Status</th>
            {onReturn && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={onReturn ? 9 : 8} className="empty-cell">
                Nenhum empréstimo registrado.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id || row.device}>
                <td>
                  <div className="device-cell">
                    <span className="mini-device">
                      {row.device.includes("Galaxy") ||
                      row.device.includes("Motorola")
                        ? "▯"
                        : "▣"}
                    </span>
                    <strong>{row.device}</strong>
                  </div>
                </td>
                <td>{row.responsible || "—"}</td>
                <td>{row.qty}</td>
                <td>{row.room}</td>
                <td>{row.department || "—"}</td>
                <td>{row.date}</td>
                <td>{row.returnTime || '—'}</td>
                <td>
                  <Badge tone={row.statusTone || "green"}>{row.status}</Badge>
                </td>
                {onReturn && (
                  <td>
                    {(!canReturn || canReturn(row)) && (
                      <button
                        className="return-button"
                        onClick={() => onReturn(row)}
                      >
                        Devolver
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
