import { useWizard } from "../context/WizardContext";
import { useState } from "react";
import Botao from "../components/Botao";
import { api } from "../api/api";

function baixarModeloDisciplinas() {
  const conteudo = `nome,prof,semestre,aulas_por_semana
Algoritmos I,Prof. João,1,2
Cálculo I,Prof. Maria,1,2
Física I,Prof. Carlos,1,1
IPCP_EPTURMA21,Sandra,,2
`;

  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_disciplinas.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function Disciplinas() {
  const { disciplinas, setDisciplinas, setStep } = useWizard();

  const [nome, setNome] = useState("");
  const [prof, setProf] = useState("");
  const [semestre, setSemestre] = useState("");
  const [aulasPorSemana, setAulasPorSemana] = useState(1);

  const [erroUpload, setErroUpload] = useState("");
  const [enviando, setEnviando] = useState(false);

  function adicionar() {
    if (!nome.trim()) return;

    setDisciplinas([
      ...disciplinas,
      {
        nome: nome.trim(),
        prof: prof.trim(),
        semestre: semestre.trim(),
        aulas_por_semana: Number(aulasPorSemana) || 1,
      },
    ]);

    setNome("");
    setProf("");
    setSemestre("");
    setAulasPorSemana(1);
  }

  function remover(index) {
    const copia = [...disciplinas];
    copia.splice(index, 1);
    setDisciplinas(copia);
  }

  async function uploadCSVDisciplinas(file) {
    if (!file) return;

    try {
      setErroUpload("");
      setEnviando(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/upload/disciplinas", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const disc = (res.data.disciplinas || []).map((d) => ({
        nome: d.nome || "",
        prof: d.prof || "",
        semestre: d.semestre || "",
        aulas_por_semana: Number(d.aulas_por_semana || 1),
      }));

      setDisciplinas(disc);
    } catch (e) {
      setErroUpload(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao enviar CSV de disciplinas.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Gerenciar Disciplinas</h2>

      {/* Upload do CSV */}
      <div
        style={{
          marginTop: 10,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#f8fafc",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Upload de disciplinas.csv</h3>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => uploadCSVDisciplinas(e.target.files?.[0])}
        />

        <p style={{ marginTop: 10, color: "#64748b" }}>
          O arquivo é enviado para o backend e usado apenas nesta sessão.
        </p>

        {enviando ? (
          <p style={{ color: "#0f172a" }}>Enviando arquivo...</p>
        ) : null}

        {erroUpload ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {erroUpload}
          </div>
        ) : null}
      </div>

      {/* Explicação do formato */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#ffffff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Formato esperado do arquivo</h3>

        <p style={{ marginBottom: 8 }}>Use um CSV com as colunas abaixo:</p>

        <pre
          style={{
            background: "#f6f7f9",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
            marginTop: 0,
          }}
        >
          {`nome,prof,semestre,aulas_por_semana
Algoritmos I,Prof. João,1,2
Cálculo I,Prof. Maria,1,2
Física I,Prof. Carlos,1,1
IPCP_EPTURMA21,Sandra,,2`}
        </pre>

        <div style={{ marginTop: 10, color: "#334155" }}>
          <div>
            <strong>nome</strong>: nome da disciplina
          </div>
          <div>
            <strong>prof</strong>: professor ou professores
          </div>
          <div>
            <strong>semestre</strong>: pode ficar vazio
          </div>
          <div>
            <strong>aulas_por_semana</strong>: se ficar vazio, o sistema assume
            1
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Botao
            texto="Baixar modelo de disciplinas.csv"
            onClick={baixarModeloDisciplinas}
            cor="#0f766e"
          />
        </div>
      </div>

      {/* Cadastro manual */}
      <div style={{ marginTop: 20 }}>
        <h3>Adicionar disciplina manualmente</h3>

        <div
          style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}
        >
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome (ex: Cálculo A)"
            style={{ flex: 2, minWidth: 220, padding: 8 }}
          />

          <input
            value={prof}
            onChange={(e) => setProf(e.target.value)}
            placeholder="Professores (ex: Silva|Santos)"
            style={{ flex: 2, minWidth: 220, padding: 8 }}
          />

          <input
            value={semestre}
            onChange={(e) => setSemestre(e.target.value)}
            placeholder="Semestre"
            style={{ flex: 1, minWidth: 140, padding: 8 }}
          />

          <input
            type="number"
            min="1"
            value={aulasPorSemana}
            onChange={(e) => setAulasPorSemana(e.target.value)}
            placeholder="Aulas/semana"
            style={{ width: 160, padding: 8 }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <Botao texto="+ Adicionar" onClick={adicionar} />
        </div>
      </div>

      {/* Lista */}
      <h3 style={{ marginTop: 20 }}>Disciplinas ({disciplinas.length})</h3>

      {disciplinas.length === 0 ? (
        <p style={{ color: "#64748b" }}>Nenhuma disciplina cadastrada.</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {disciplinas.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #eee",
                padding: "10px 0",
                gap: 12,
              }}
            >
              <div>
                <strong>{d.nome}</strong>
                {d.prof ? ` / ${d.prof}` : ""}
                {d.semestre ? ` / semestre ${d.semestre}` : " / sem semestre"}
                {` / ${Number(d.aulas_por_semana || 1)} aula(s)/semana`}
              </div>

              <button onClick={() => remover(i)} style={{ cursor: "pointer" }}>
                remover
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Botao texto="← Voltar" onClick={() => setStep(0)} cor="#64748b" />
        <Botao
          texto="Próximo: Definir Restrições →"
          onClick={() => setStep(2)}
          cor="#16a34a"
        />
      </div>
    </div>
  );
}
