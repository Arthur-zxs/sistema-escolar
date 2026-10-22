import Badge from "../comuns/Badge";

export default function DeviceCard({ device, onRequest }) {
  const needsLocation = !["LMT", "Maker"].includes(device.location);
  const unavailable = device.available === 0 || needsLocation;
  const statusTone = unavailable
    ? needsLocation ? "orange" : "red"
    : device.available < 4
      ? "orange"
      : "green";

  return (
    <article className="device-card">
      <div className={`device-visual visual-${device.tone}`}>
        <span>{device.icon}</span>
        <em>{device.type}</em>
      </div>
      <div className="device-card-body">
        <div className="device-title">
          <div>
            <h3>{device.name}</h3>
            <p>{device.brand} · Local: <strong>{device.location}</strong></p>
          </div>
          <Badge tone={statusTone}>
            {needsLocation ? "Local não classificado" : unavailable ? "Indisponível" : "Disponível"}
          </Badge>
        </div>
        <div className="device-metrics">
          <div>
            <span>Total</span>
            <strong>{device.total}</strong>
          </div>
          <div>
            <span>Disponíveis</span>
            <strong className="available-number">{device.available}</strong>
          </div>
          <div>
            <span>Emprestados</span>
            <strong>{device.total - device.available}</strong>
          </div>
        </div>
        <button
          className="device-action"
          disabled={unavailable}
          onClick={() => onRequest(device)}
        >
          {needsLocation
            ? "Aguardando classificação do acervo"
            : unavailable
              ? "Sem disponibilidade"
              : "Registrar empréstimo"}
          <span>→</span>
        </button>
      </div>
    </article>
  );
}