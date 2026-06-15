export function LoadingSpinner({ text = "Carregando..." }: { text?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", padding: "2rem 0" }}>
      <span style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      {text}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
