interface SemaforoProps {
  situacao: "ok" | "alerta" | "critico";
  label?: boolean;
}

const CONFIG = {
  ok:      { color: "#22c55e", text: "OK" },
  alerta:  { color: "#eab308", text: "Alerta" },
  critico: { color: "#ef4444", text: "Crítico" },
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
