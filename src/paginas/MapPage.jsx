import { useState } from "react";

export default function MapPage({ rooms = [] }) {
  const [selectedRoomId, setSelectedRoomId] = useState("lab-04");
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];
  const inventoryRooms = rooms.filter((room) => room.kind === "Acervo");
  const classroomsBlockA = rooms.filter(
    (room) => room.kind === "Sala de aula" && room.block === "A",
  );
  const classroomsBlockB = rooms.filter(
    (room) => room.kind === "Sala de aula" && room.block === "B",
  );

  if (!selectedRoom) {
    return <div className="page-content empty-state">Nenhum local cadastrado.</div>;
  }

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">VISÃO GERAL DO CAMPUS</span>
          <h2>Mapa da escola</h2>
          <p>Consulte os aparelhos guardados no LMT e Maker e veja o que está em uso nas salas de aula.</p>
        </div>
        <div className="map-legend">
          <span>
            <i className="legend-dot in-use" />
            Acervos LMT e Maker
          </span>
          <span>
            <i className="legend-dot free" />
            Salas de aula
          </span>
        </div>
      </div>
      <div className="map-layout">
        <section className="school-map">
          <RoomBlock
            className="block-a"
            label="ACERVOS LMT E MAKER"
            rooms={inventoryRooms}
            selectedRoom={selectedRoom}
            onSelect={(room) => setSelectedRoomId(room.id)}
          />
          <RoomBlock
            className="block-b"
            label="BLOCO A · SALAS DE AULA"
            rooms={classroomsBlockA}
            selectedRoom={selectedRoom}
            onSelect={(room) => setSelectedRoomId(room.id)}
          />
          <RoomBlock
            className="block-c"
            label="BLOCO B · SALAS DE AULA"
            rooms={classroomsBlockB}
            selectedRoom={selectedRoom}
            onSelect={(room) => setSelectedRoomId(room.id)}
          />
        </section>
        <aside className="room-detail">
          <span className="eyebrow">
            {selectedRoom.kind === "Sala de aula" ? `BLOCO ${selectedRoom.block || "A"} · SALA SELECIONADA` : "ACERVO SELECIONADO"}
          </span>
          <div className="room-detail-title">
            <div className="room-pin">⌆</div>
            <div>
              <h3>{selectedRoom.name}</h3>
              <p>{selectedRoom.kind}</p>
            </div>
          </div>
          <div className="detail-divider" />
          <span className="detail-label">
            {selectedRoom.kind === "Acervo" ? "DISPONIBILIDADE DO ACERVO" : "APARELHOS EM USO"}
          </span>
          {selectedRoom.kind === "Acervo" ? (
            selectedRoom.devices.map((device) => (
              <div className="used-device" key={device}>
                <span className="mini-device">{device === "Livre" ? "✓" : "▣"}</span>
                <strong>{device}</strong>
              </div>
            ))
          ) : selectedRoom.loans?.length ? (
            selectedRoom.loans.map((loan) => (
              <div className="used-device room-loan" key={loan.id}>
                <span className="mini-device">▣</span>
                <div>
                  <strong>{loan.qty} × {loan.device}</strong>
                  <small>Devolução prevista: {loan.returnTime}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="room-empty">Nenhum empréstimo ativo nesta sala.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function RoomBlock({
  className,
  label,
  rooms: blockRooms,
  selectedRoom,
  onSelect,
}) {
  return (
    <div className={`map-block ${className}`}>
      <span className="block-label">{label}</span>
      {blockRooms.map((room) => (
        <button
          type="button"
          key={room.id}
          aria-pressed={selectedRoom.id === room.id}
          className={`room ${selectedRoom.id === room.id ? "selected" : ""} ${room.kind !== "Acervo" && (room.devices.length === 0 || room.devices[0] === "Livre") ? "free-room" : ""}`}
          onClick={() => onSelect(room)}
        >
          <strong>{room.name}</strong>
          <small>
            {room.kind === "Acervo"
              ? room.kind
              : room.loans?.length
                ? `${room.loans.length} empréstimo${room.loans.length === 1 ? "" : "s"} ativo${room.loans.length === 1 ? "" : "s"}`
                : "Livre"}
          </small>
        </button>
      ))}
    </div>
  );
}
