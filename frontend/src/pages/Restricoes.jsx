import { useWizard } from "../context/WizardContext";
import { useEffect, useMemo, useState } from "react";
import Botao from "../components/Botao";
import { api } from "../api/api";

export default function Restricoes() {
  const { disciplinas, restricoes, setRestricoes, setStep } = useWizard();

  const [disciplina, setDisciplina] = useState("");
  const [bloco, setBloco] = useState(0);

  // NOVO: painel/visualização
  const [mostrarPainel, setMostrarPainel] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");

  // =========================
  // IMPORTAR RESTRIÇÕES (ARQUIVOS ESCOLHIDOS)
  // =========================
  const [mostrarImport, setMostrarImport] = useState(false);
  const [arquivosDisp, setArquivosDisp] = useState([]);
  const [selecionados, setSelecionados] = useState({}); // { "fixos.csv": true, ... }
  const [importando, setImportando] = useState(false);
  const [erroImport, setErroImport] = useState("");

  async function carregarArquivosRestricoes() {
    setErroImport("");
    try {
      const res = await api.get("/restricoes/arquivos");
      setArquivosDisp(res.data.arquivos || []);
    } catch (e) {
      setErroImport(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao listar arquivos de restrições.",
      );
    }
  }

  function toggleArquivo(nome) {
    setSelecionados((prev) => ({ ...prev, [nome]: !prev[nome] }));
  }

  async function importarArquivosSelecionados() {
    const lista = arquivosDisp.filter((a) => selecionados[a]);
    if (lista.length === 0) return;

    setErroImport("");
    setImportando(true);

    try {
      const res = await api.post("/restricoes/importar", { arquivos: lista });
      const novas = res.data.restricoes || [];

      // marca origem (nome do arquivo) se o backend não mandou
      // (se backend já manda origem, isso não atrapalha)
      const novasComOrigem = novas.map((r) => ({
        ...r,
        origem: r.origem || "importado",
      }));

      // evita duplicar iguais
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

      const setExist = new Set((restricoes || []).map(chave));
      const mescladas = [...(restricoes || [])];

      for (const r of novasComOrigem) {
        const k = chave(r);
        if (!setExist.has(k)) {
          mescladas.push(r);
          setExist.add(k);
        }
      }

      setRestricoes(mescladas);

      // opcional: já abre o painel de detalhes pra ver o que importou
      // setMostrarPainel(true);

      // fecha o import depois
      setMostrarImport(false);
    } catch (e) {
      setErroImport(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao importar restrições.",
      );
    } finally {
      setImportando(false);
    }
  }

  // carrega lista ao entrar na página (uma vez)
  useEffect(() => {
    carregarArquivosRestricoes();
  }, []);

  function adicionarFixo() {
    if (!disciplina) return;
    setRestricoes([
      ...restricoes,
      { tipo: "fixo", disciplina, bloco: Number(bloco) },
    ]);
  }

  // --- listas auxiliares para filtros ---
  const tiposDisponiveis = useMemo(() => {
    const set = new Set(restricoes.map((r) => r.tipo).filter(Boolean));
    return ["todos", ...Array.from(set)];
  }, [restricoes]);

  const origensDisponiveis = useMemo(() => {
    const set = new Set(restricoes.map((r) => r.origem).filter(Boolean));
    return ["todas", ...Array.from(set)];
  }, [restricoes]);

  const restricoesFiltradas = useMemo(() => {
    return restricoes.filter((r) => {
      const okTipo = filtroTipo === "todos" ? true : r.tipo === filtroTipo;
      const okOrigem =
        filtroOrigem === "todas" ? true : r.origem === filtroOrigem;
      return okTipo && okOrigem;
    });
  }, [restricoes, filtroTipo, filtroOrigem]);

  // --- agrupamento por tipo (pra mostrar separado bonito) ---
  const gruposPorTipo = useMemo(() => {
    const g = {};
    for (const r of restricoesFiltradas) {
      const t = r.tipo || "sem_tipo";
      if (!g[t]) g[t] = [];
      g[t].push(r);
    }
    return g;
  }, [restricoesFiltradas]);

  // --- renderização por tipo ---
  function renderGrupo(tipo, lista) {
    const titulo =
      {
        fixo: "Fixo (disciplina → bloco)",
        dia_fixo: "Dia fixo (disciplina → dia)",
        nao_coincidir: "Não coincidir (disciplina1, disciplina2)",
        mesmo_bloco: "Mesmo bloco (disciplina1, disciplina2)",
        mesmo_horario: "Mesmo horário (disciplina1, disciplina2)",
      }[tipo] || tipo;

    // formato “CSV-like” (bem parecido com o que tu mostrou)
    if (
      tipo === "nao_coincidir" ||
      tipo === "mesmo_bloco" ||
      tipo === "mesmo_horario"
    ) {
      return (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginBottom: 6 }}>
            {titulo} — ({lista.length})
          </h4>
          <pre
            style={{
              background: "#f6f7f9",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {`disciplina1,disciplina2
${lista.map((r) => `${r.disciplina1 || ""},${r.disciplina2 || ""}`).join("\n")}`}
          </pre>
        </div>
      );
    }

    if (tipo === "dia_fixo") {
      return (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginBottom: 6 }}>
            {titulo} — ({lista.length})
          </h4>
          <pre
            style={{
              background: "#f6f7f9",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {`disciplina,dia
${lista.map((r) => `${r.disciplina || ""},${r.dia || ""}`).join("\n")}`}
          </pre>
        </div>
      );
    }

    // default: fixo
    return (
      <div style={{ marginTop: 14 }}>
        <h4 style={{ marginBottom: 6 }}>
          {titulo} — ({lista.length})
        </h4>
        <pre
          style={{
            background: "#f6f7f9",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {`disciplina,bloco
${lista.map((r) => `${r.disciplina || ""},${r.bloco ?? ""}`).join("\n")}`}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Restrições e Preferências</h2>
      {/* =========================
          IMPORTAR RESTRIÇÕES (ESCOLHER ARQUIVOS)
         ========================= */}
      <div style={{ marginTop: 10 }}>
        <Botao
          texto={
            mostrarImport
              ? "Ocultar importação"
              : "Importar restrições (escolher arquivos)"
          }
          onClick={() => setMostrarImport((v) => !v)}
          cor="#334155"
        />
      </div>

      {mostrarImport && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Botao
              texto="Recarregar lista"
              onClick={carregarArquivosRestricoes}
              cor="#64748b"
            />
            <Botao
              texto={importando ? "Importando..." : "Importar selecionados"}
              onClick={importarArquivosSelecionados}
              cor="#0ea5e9"
            />
          </div>

          {erroImport ? (
            <div style={{ marginTop: 10, color: "#991b1b" }}>{erroImport}</div>
          ) : null}

          {arquivosDisp.length === 0 ? (
            <div style={{ marginTop: 10, color: "#64748b" }}>
              Nenhum arquivo CSV encontrado em <strong>backend/dados</strong>.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {arquivosDisp.map((a) => (
                <label
                  key={a}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={!!selecionados[a]}
                    onChange={() => toggleArquivo(a)}
                  />
                  <span>{a}</span>
                </label>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, color: "#64748b" }}>
            Você escolhe quais CSVs importar. Isso não remove as restrições
            manuais.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <select
          value={disciplina}
          onChange={(e) => setDisciplina(e.target.value)}
          style={{ flex: 2, padding: 8 }}
        >
          <option value="">Selecione a disciplina...</option>
          {disciplinas.map((d, i) => (
            <option key={i} value={d.nome}>
              {d.nome}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={bloco}
          onChange={(e) => setBloco(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="Bloco"
        />
      </div>

      <div
        style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <Botao texto="+ Adicionar Restrição (Fixo)" onClick={adicionarFixo} />
        <Botao
          texto={mostrarPainel ? "Ocultar detalhes" : "Ver todas as restrições"}
          onClick={() => setMostrarPainel((v) => !v)}
          cor="#0ea5e9"
        />
        <Botao
          texto="Gerar Grade de Horários →"
          onClick={() => setStep(3)}
          cor="#16a34a"
        />
      </div>

      <h3 style={{ marginTop: 15 }}>
        Restrições Definidas ({restricoes.length})
      </h3>

      {/* Visual “limpo”: em vez de listar tudo e poluir, só mostra um resumo curto */}
      <div style={{ color: "#444", marginTop: 6 }}>
        {(() => {
          const cont = {};
          for (const r of restricoes) cont[r.tipo] = (cont[r.tipo] || 0) + 1;
          return Object.entries(cont)
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => `${t}: ${n}`)
            .join(" | ");
        })()}
      </div>

      {mostrarPainel && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Filtrar por tipo
              </div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ padding: 8, minWidth: 220 }}
              >
                {tiposDisponiveis.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Filtrar por arquivo (origem)
              </div>
              <select
                value={filtroOrigem}
                onChange={(e) => setFiltroOrigem(e.target.value)}
                style={{ padding: 8, minWidth: 260 }}
              >
                {origensDisponiveis.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Renderiza por tipo */}
          {Object.keys(gruposPorTipo).length === 0 ? (
            <p style={{ color: "#666", marginTop: 12 }}>
              Nenhuma restrição nesse filtro.
            </p>
          ) : (
            Object.entries(gruposPorTipo)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([tipo, lista]) => (
                <div key={tipo}>{renderGrupo(tipo, lista)}</div>
              ))
          )}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Botao texto="← Voltar" onClick={() => setStep(1)} cor="#64748b" />
      </div>
    </div>
  );
}
