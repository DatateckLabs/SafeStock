interface SemaforoProps {
  situacao: "ok" | "alerta" | "critico";
  label?: boolean;
}

const CONFIG = {
  ok:      { color: "var(--success)", text: "OK" },
  alerta:  { color: "var(--warning)", text: "Alerta" },
  critico: { color: "var(--danger)",  text: "Crítico" },
};

export function Semaforo({ situacao, label = false }: SemaforoProps) {
  const { color, text } = CONFIG[situacao];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {label && <span style={{ color, fontSize: "0.82rem", fontWeight: 600 }}>{text}</span>}
    </span>
  );
}
