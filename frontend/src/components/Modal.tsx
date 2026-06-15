interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1a1d27",
          border: "1px solid #2e3250",
          borderRadius: 12,
          padding: "1.75rem 1.5rem",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 700, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#94a3b8",
              cursor: "pointer", fontSize: "1.25rem", lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
