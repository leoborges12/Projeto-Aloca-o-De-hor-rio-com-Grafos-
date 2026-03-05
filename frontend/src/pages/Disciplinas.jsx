import { useWizard } from "../context/WizardContext";
import { useEffect, useState } from "react";
import Botao from "../components/Botao";
import { api } from "../api/api";

export default function Disciplinas() {
  const {
    disciplinas,
    setDisciplinas,
    setStep,
    datasets,
    datasetAtual,
    carregarDatasets,
    importarDataset,
  } = useWizard();

  const [nome, setNome] = useState("");
  const [prof, setProf] = useState("");
  const [semestre, setSemestre] = useState("");

  const [datasetSel, setDatasetSel] = useState("");

  const [erroUpload, setErroUpload] = useState("");
  const [uploadando, setUploadando] = useState(false);

  useEffect(() => {
    // carrega automaticamente a lista de datasets quando entra na tela
    carregarDatasets().catch(() => {});
  }, [carregarDatasets]);

  function adicionar() {
    if (!nome.trim()) return;
    setDisciplinas([
      ...disciplinas,
      { nome: nome.trim(), prof: prof.trim(), semestre: semestre.trim() },
    ]);
    setNome("");
    setProf("");
    setSemestre("");
  }

  function remover(index) {
    const copia = [...disciplinas];
    copia.splice(index, 1);
    setDisciplinas(copia);
  }

  async function importar() {
    if (!datasetSel) return;
    await importarDataset(datasetSel);
  }

  async function uploadCSVDisciplinas(file) {
    if (!file) return;

    setErroUpload("");
    setUploadando(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/upload/disciplinas", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const disc = (res.data.disciplinas || []).map((d) => ({
        nome: d.nome || "",
        prof: d.prof || "",
        semestre: d.semestre || "",
      }));

      setDisciplinas(disc);

      // opcional (recomendado): limpa o select do dataset pronto
      setDatasetSel("");
    } catch (e) {
      setErroUpload(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao enviar CSV de disciplinas.",
      );
    } finally {
      setUploadando(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Gerenciar Disciplinas</h2>

      {/* IMPORTAR DO PC (UPLOAD) */}
      <div
        style={{
          marginTop: 10,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#ffffff",
        }}
      >
        <h3 style={{ margin: 0 }}>Importar do seu computador (CSV)</h3>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <input
            type="file"
            accept=".csv"
            disabled={uploadando}
            onChange={(e) => uploadCSVDisciplinas(e.target.files?.[0])}
          />

          {uploadando ? (
            <span style={{ color: "#64748b" }}>Enviando...</span>
          ) : null}
        </div>

        <p style={{ marginTop: 8, color: "#64748b" }}>
          O CSV é lido no backend e usado apenas nesta sessão (não salva no
          servidor).
        </p>

        {erroUpload ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
            }}
          >
            <strong>Erro no upload:</strong> {erroUpload}
          </div>
        ) : null}
      </div>

      {/* IMPORTAR DADOS PRONTOS */}
      <div
        style={{
          marginTop: 10,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#f8fafc",
        }}
      >
        <h3 style={{ margin: 0 }}>Importar dados prontos (backend/dados)</h3>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <select
            value={datasetSel}
            onChange={(e) => setDatasetSel(e.target.value)}
            style={{ flex: 2, padding: 8 }}
          >
            <option value="">Selecione...</option>
            {datasets.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <Botao texto="Importar" onClick={importar} cor="#2563eb" />
          <Botao
            texto="Recarregar lista"
            onClick={() => carregarDatasets()}
            cor="#64748b"
          />
        </div>

        {datasetAtual ? (
          <p style={{ marginTop: 8, color: "#0f172a" }}>
            Dataset atual: <strong>{datasetAtual}</strong>
          </p>
        ) : (
          <p style={{ marginTop: 8, color: "#64748b" }}>
            Nenhum dataset importado ainda.
          </p>
        )}
      </div>

      {/* CADASTRO MANUAL */}
      <div style={{ marginTop: 20 }}>
        <h3>Adicionar disciplina manualmente</h3>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome (ex: Cálculo I)"
            style={{ flex: 2, padding: 8 }}
          />
          <input
            value={prof}
            onChange={(e) => setProf(e.target.value)}
            placeholder="Professores (ex: Silva|Santos)"
            style={{ flex: 2, padding: 8 }}
          />
          <input
            value={semestre}
            onChange={(e) => setSemestre(e.target.value)}
            placeholder="Semestre (opcional)"
            style={{ flex: 1, padding: 8 }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <Botao texto="+ Adicionar" onClick={adicionar} />
        </div>
      </div>

      {/* LISTA */}
      <h3 style={{ marginTop: 15 }}>Disciplinas ({disciplinas.length})</h3>

      {disciplinas.length === 0 ? (
        <p style={{ color: "#666" }}>Nenhuma disciplina cadastrada</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {disciplinas.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid #eee",
                padding: "8px 0",
              }}
            >
              <div>
                <strong>{d.nome}</strong>
                {d.prof ? ` / ${d.prof}` : ""}
                {d.semestre ? ` / ${d.semestre}` : ""}
              </div>
              <button onClick={() => remover(i)} style={{ cursor: "pointer" }}>
                remover
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
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
