import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/api";

const WizardContext = createContext(null);

const STORAGE_KEY = "alocacao_wizard_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function WizardProvider({ children }) {
  const [step, setStep] = useState(0);

  const [config, setConfig] = useState({
    dias_semana: 5,
    blocos_por_dia: 4,
    conflito_por_prof: true,
    conflito_por_semestre: true,
  });

  const [disciplinas, setDisciplinas] = useState([]);
  const [restricoes, setRestricoes] = useState([]);
  const [resultado, setResultado] = useState(null);

  // datasets do backend (importar prontos)
  const [datasets, setDatasets] = useState([]);
  const [datasetAtual, setDatasetAtual] = useState("");

  // ---- carregar do localStorage quando abrir o app ----
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = safeParse(raw);
    if (!data) return;

    if (data.config) setConfig(data.config);
    if (Array.isArray(data.disciplinas)) setDisciplinas(data.disciplinas);
    if (Array.isArray(data.restricoes)) setRestricoes(data.restricoes);
    if (data.resultado) setResultado(data.resultado);
    if (typeof data.step === "number") setStep(data.step);
    if (typeof data.datasetAtual === "string")
      setDatasetAtual(data.datasetAtual);
  }, []);

  // ---- salvar sempre que algo importante mudar ----
  useEffect(() => {
    const payload = {
      step,
      config,
      disciplinas,
      restricoes,
      resultado,
      datasetAtual,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [step, config, disciplinas, restricoes, resultado, datasetAtual]);

  async function carregarDatasets() {
    const res = await api.get("/dados");
    setDatasets(res.data.datasets || []);
    return res.data.datasets || [];
  }

  async function importarDataset(nome) {
    if (!nome) return;
    const res = await api.get(`/dados/${nome}`);

    const disc = (res.data.disciplinas || []).map((d) => ({
      nome: d.nome || "",
      prof: d.prof || "",
      semestre: d.semestre || "",
    }));

    setDisciplinas(disc);
    setRestricoes(res.data.restricoes || []);
    setDatasetAtual(nome);
    setResultado(null);
  }

  async function listarArquivosRestricoes() {
    const res = await api.get("/restricoes/arquivos");
    return res.data.arquivos || [];
  }

  async function importarArquivosRestricoes(arquivos, modo = "substituir") {
    // modo: "substituir" ou "mesclar"
    const res = await api.post("/restricoes/importar", { arquivos });

    const novas = res.data.restricoes || [];

    if (modo === "mesclar") {
      // mescla sem duplicar (chave baseada nos campos principais)
      const key = (r) =>
        `${r.tipo}|${r.disciplina || ""}|${r.bloco ?? ""}|${r.dia || ""}|${r.disciplina1 || ""}|${r.disciplina2 || ""}`;

      const mapa = new Map((restricoes || []).map((r) => [key(r), r]));
      for (const r of novas) mapa.set(key(r), r);

      setRestricoes(Array.from(mapa.values()));
    } else {
      setRestricoes(novas);
    }
  }

  function limparTudo() {
    localStorage.removeItem(STORAGE_KEY);
    setStep(0);
    setConfig({
      dias_semana: 5,
      blocos_por_dia: 4,
      conflito_por_prof: true,
      conflito_por_semestre: true,
    });
    setDisciplinas([]);
    setRestricoes([]);
    setResultado(null);
    setDatasetAtual("");
  }

  return (
    <WizardContext.Provider
      value={{
        step,
        setStep,
        config,
        setConfig,
        disciplinas,
        setDisciplinas,
        restricoes,
        setRestricoes,
        resultado,
        setResultado,

        datasets,
        datasetAtual,
        carregarDatasets,
        importarDataset,

        limparTudo,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard precisa estar dentro de WizardProvider");
  return ctx;
}
