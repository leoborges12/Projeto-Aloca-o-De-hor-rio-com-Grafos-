import { useRef } from "react";
import { useWizard } from "../context/WizardContext";
import Botao from "../components/Botao";
import { api } from "../api/api";

function CardFormato({
  titulo,
  descricao,
  exemplo,
  nomeModelo,
  conteudoModelo,
  onImportar,
}) {
  const inputRef = useRef(null);

  function baixar(nome, conteudo) {
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 18,
        background: "#ffffff",
        width: 340,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{titulo}</h3>

      <p style={{ color: "#475569", fontSize: 14 }}>{descricao}</p>

      <pre
        style={{
          background: "#f1f5f9",
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
          overflowX: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {exemplo}
      </pre>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => onImportar?.(e.target.files?.[0])}
      />

      <div
        style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <Botao
          texto="Baixar modelo CSV"
          onClick={() => baixar(nomeModelo, conteudoModelo)}
          cor="#0f766e"
        />

        <Botao
          texto="Importar CSV"
          onClick={() => inputRef.current?.click()}
          cor="#2563eb"
        />
      </div>
    </div>
  );
}

export default function FormatosRestricoes() {
  const { restricoes, setRestricoes, setStep } = useWizard();

  async function importarCSV(file) {
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("files", file);

      const res = await api.post("/upload/restricoes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const novas = (res.data.restricoes || []).map((r) => ({
        ...r,
        origem: r.origem || file.name || "upload",
      }));

      const chave = (r) =>
        JSON.stringify({
          tipo: r.tipo || "",
          disciplina: r.disciplina || "",
          bloco: r.bloco ?? null,
          dia: r.dia || "",
          disciplina1: r.disciplina1 || "",
          disciplina2: r.disciplina2 || "",
          origem: r.origem || "",
        });

      const existentes = new Set((restricoes || []).map(chave));
      const mescladas = [...(restricoes || [])];

      for (const r of novas) {
        const k = chave(r);
        if (!existentes.has(k)) {
          mescladas.push(r);
          existentes.add(k);
        }
      }

      setRestricoes(mescladas);
    } catch (e) {
      alert(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao importar arquivo de restrições.",
      );
    }
  }

  const total = restricoes.length;

  return (
    <div style={{ padding: 20 }}>
      <h2>Formatos de Restrições</h2>

      <p style={{ color: "#64748b", marginBottom: 20 }}>
        Veja os formatos aceitos, baixe um modelo ou importe diretamente seus
        arquivos CSV. Tudo que for importado aqui aparecerá na próxima etapa
        para conferência e edição manual.
      </p>

      <div style={{ marginBottom: 16, color: "#334155" }}>
        <strong>Restrições já carregadas nesta sessão:</strong> {total}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <CardFormato
          titulo="Fixo (disciplina → bloco)"
          descricao="Define que uma disciplina deve ocorrer em um horario específico."
          exemplo={`disciplina,bloco
Algoritmos I,0
Cálculo I,3`}
          nomeModelo="fixos.csv"
          conteudoModelo={`disciplina,bloco
Algoritmos I,0
Cálculo I,3`}
          onImportar={importarCSV}
        />

        <CardFormato
          titulo="Dia fixo"
          descricao="Define que uma disciplina deve ocorrer em um dia específico."
          exemplo={`disciplina,dia
Algoritmos I,seg
Cálculo I,qua`}
          nomeModelo="dia_fixo.csv"
          conteudoModelo={`disciplina,dia
Algoritmos I,seg
Cálculo I,qua`}
          onImportar={importarCSV}
        />
        <CardFormato
          titulo="Mesmo horário"
          descricao="Duas disciplinas devem ocorrer no mesmo horário."
          exemplo={`disciplina1,disciplina2
Algoritmos I,Laboratório I`}
          nomeModelo="mesmo_horario.csv"
          conteudoModelo={`disciplina1,disciplina2
Algoritmos I,Laboratório I`}
          onImportar={importarCSV}
        />
      </div>

      <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
        <Botao texto="← Voltar" onClick={() => setStep(2)} cor="#64748b" />
        <Botao
          texto="Revisar e adicionar restrições →"
          onClick={() => setStep(4)}
          cor="#16a34a"
        />
      </div>
    </div>
  );
}
