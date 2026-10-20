const icones = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  devices: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M2 21h20M8 17l-1 4m9-4 1 4" /></>,
  loans: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3.5h6M9 10h6m-6 4h6m-6 4h3" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" /><path d="M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 4v2" /></>,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  admin: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5m-5 3h8" /></>,
  logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
};

export default function Icon({ children, name }) {
  return (
    <span className={`icon ${name ? 'icon-svg' : ''}`} aria-hidden="true">
      {name ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icones[name]}
        </svg>
      ) : children}
    </span>
  );
}
