import { useWizard } from "../context/WizardContext";
import { useEffect, useState } from "react";
import Botao from "../components/Botao";

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

  useEffect(() => {
    // carrega automaticamente a lista de datasets quando entra na tela
    carregarDatasets().catch(() => {});
  }, []);

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

  return (
    <div style={{ padding: 20 }}>
      <h2>Gerenciar Disciplinas</h2>

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
