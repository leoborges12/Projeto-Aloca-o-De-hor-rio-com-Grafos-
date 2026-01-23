export default function Botao({ texto, onClick, cor = "#2563eb" }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        background: cor,
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "16px"
      }}
    >
      {texto}
    </button>
  );
}
