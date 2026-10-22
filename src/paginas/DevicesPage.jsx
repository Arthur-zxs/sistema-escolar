import { useState } from "react";
import Icon from "../componentes/comuns/Icon";
import DeviceCard from "../componentes/aparelhos/DeviceCard";

export default function DevicesPage({ devices, onRequest }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Disponíveis");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredDevices = devices.filter(
    (device) =>
      ["LMT", "Maker"].includes(device.location) &&
      device.available > 0 &&
      (filter === "Disponíveis" ||
        device.type === (filter === "Notebooks" ? "Notebook" : "Celular")) &&
      `${device.name} ${device.brand} ${device.type} ${device.location}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
  );
  const hasActiveFilters = Boolean(normalizedQuery) || filter !== "Disponíveis";

  function limparFiltros() {
    setQuery("");
    setFilter("Disponíveis");
  }

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">PASSO 1 · ESCOLHA SEU APARELHO</span>
          <h2>Catálogo de aparelhos</h2>
          <p>
            Busque por modelo, marca, tipo ou acervo. Aparelhos disponíveis podem ser registrados sem aprovação.
          </p>
        </div>
        <div className="catalog-count" aria-live="polite">
          <strong>{filteredDevices.length}</strong>
          <span>{filteredDevices.length === 1 ? "modelo encontrado" : "modelos encontrados"}</span>
        </div>
      </div>
      <div className="catalog-toolbar">
        <label className="search">
          <Icon>⌕</Icon>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar aparelhos por nome, marca, tipo ou acervo"
            placeholder="Buscar por aparelho, marca ou acervo"
          />
        </label>
        <div className="filters">
          {["Disponíveis", "Notebooks", "Celulares"].map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "selected" : ""}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="catalog-tip">
        <span className="catalog-tip-icon" aria-hidden="true">i</span>
        <p><strong>Como registrar:</strong> escolha um aparelho disponível e informe quem vai usar, a sala e o horário de devolução.</p>
      </div>
      <div className="devices-grid">
        {filteredDevices.map((device) => (
          <DeviceCard key={device.id} device={device} onRequest={onRequest} />
        ))}
      </div>
      {filteredDevices.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">⌕</span>
          <strong>Nenhum aparelho encontrado</strong>
          <p>
            {normalizedQuery
              ? "Tente outro termo ou limpe a busca para ver os aparelhos disponíveis."
              : filter !== "Disponíveis"
                ? `Não há ${filter.toLocaleLowerCase("pt-BR")} disponíveis no momento.`
                : "Não há aparelhos disponíveis para empréstimo no momento."}
          </p>
          {hasActiveFilters && (
            <button className="outline-button" type="button" onClick={limparFiltros}>
              Ver todos os disponíveis
            </button>
          )}
        </div>
      )}
    </div>
  );
}
