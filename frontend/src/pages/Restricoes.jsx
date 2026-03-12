import { useWizard } from "../context/WizardContext";
import { useMemo, useState } from "react";
import Botao from "../components/Botao";
import { api } from "../api/api";

function baixarModelo(nome, conteudo) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function Restricoes() {
  const { disciplinas, restricoes, setRestricoes, setStep } = useWizard();

  const [tipoManual, setTipoManual] = useState("fixo");
  const [disciplina, setDisciplina] = useState("");
  const [disciplina2, setDisciplina2] = useState("");
  const [bloco, setBloco] = useState(0);
  const [dia, setDia] = useState("");

  const [mostrarPainel, setMostrarPainel] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");

  const [importando, setImportando] = useState(false);
  const [erroImport, setErroImport] = useState("");

  async function uploadCSVRestricoes(files) {
    if (!files || files.length === 0) return;

    setErroImport("");
    setImportando(true);

    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const res = await api.post("/upload/restricoes", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const novas = (res.data.restricoes || []).map((r) => ({
        ...r,
        origem: r.origem || "upload",
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

      const setExist = new Set((restricoes || []).map(chave));
      const mescladas = [...(restricoes || [])];

      for (const r of novas) {
        const k = chave(r);
        if (!setExist.has(k)) {
          mescladas.push(r);
          setExist.add(k);
        }
      }

      setRestricoes(mescladas);
      setMostrarPainel(true);
    } catch (e) {
      setErroImport(
        e?.response?.data?.detail ||
          e?.message ||
          "Erro ao enviar CSV de restrições.",
      );
    } finally {
      setImportando(false);
    }
  }

  function adicionarRestricaoManual() {
    if (tipoManual === "fixo") {
      if (!disciplina) return;
      setRestricoes([
        ...restricoes,
        { tipo: "fixo", disciplina, bloco: Number(bloco), origem: "manual" },
      ]);
    }

    if (tipoManual === "dia_fixo") {
      if (!disciplina || !dia.trim()) return;
      setRestricoes([
        ...restricoes,
        {
          tipo: "dia_fixo",
          disciplina,
          dia: dia.trim(),
          origem: "manual",
        },
      ]);
    }

    if (
      tipoManual === "nao_coincidir" ||
      tipoManual === "mesmo_bloco" ||
      tipoManual === "mesmo_horario"
    ) {
      if (!disciplina || !disciplina2 || disciplina === disciplina2) return;
      setRestricoes([
        ...restricoes,
        {
          tipo: tipoManual,
          disciplina1: disciplina,
          disciplina2,
          origem: "manual",
        },
      ]);
    }

    setDisciplina("");
    setDisciplina2("");
    setBloco(0);
    setDia("");
  }

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

  const gruposPorTipo = useMemo(() => {
    const g = {};
    for (const r of restricoesFiltradas) {
      const t = r.tipo || "sem_tipo";
      if (!g[t]) g[t] = [];
      g[t].push(r);
    }
    return g;
  }, [restricoesFiltradas]);

  function renderGrupo(tipo, lista) {
    const titulo =
      {
        fixo: "Fixo (disciplina → bloco)",
        dia_fixo: "Dia fixo (disciplina → dia)",
        nao_coincidir: "Não coincidir (disciplina1, disciplina2)",
        mesmo_bloco: "Mesmo bloco (disciplina1, disciplina2)",
        mesmo_horario: "Mesmo horário (disciplina1, disciplina2)",
      }[tipo] || tipo;

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

      {/* Upload */}
      <div
        style={{
          marginTop: 10,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#f8fafc",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Upload de arquivos de restrições</h3>

        <input
          type="file"
          accept=".csv"
          multiple
          disabled={importando}
          onChange={(e) =>
            uploadCSVRestricoes(Array.from(e.target.files || []))
          }
        />

        <p style={{ marginTop: 10, color: "#64748b" }}>
          Você pode enviar 1 ou vários CSVs. O backend identifica o tipo de
          restrição e adiciona na sessão atual.
        </p>

        {importando ? (
          <p style={{ color: "#0f172a" }}>Processando arquivos...</p>
        ) : null}

        {erroImport ? (
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
            {erroImport}
          </div>
        ) : null}
      </div>

      {/* Formatos e modelos */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#ffffff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Formatos aceitos</h3>

        <div style={{ color: "#334155", lineHeight: 1.6 }}>
          <div>
            <strong>fixos.csv</strong> → disciplina,bloco
          </div>
          <div>
            <strong>dia_fixo.csv</strong> → disciplina,dia
          </div>
          <div>
            <strong>nao_coincidir.csv</strong> → disciplina1,disciplina2
          </div>
          <div>
            <strong>mesmo_bloco.csv</strong> → disciplina1,disciplina2
          </div>
          <div>
            <strong>mesmo_horario.csv</strong> → disciplina1,disciplina2
          </div>
        </div>

        <div
          style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <Botao
            texto="Baixar modelo fixos.csv"
            onClick={() =>
              baixarModelo(
                "fixos.csv",
                `disciplina,bloco
Algoritmos I,0
Cálculo I,3
`,
              )
            }
            cor="#0f766e"
          />

          <Botao
            texto="Baixar modelo dia_fixo.csv"
            onClick={() =>
              baixarModelo(
                "dia_fixo.csv",
                `disciplina,dia
Algoritmos I,seg
Cálculo I,qua
`,
              )
            }
            cor="#0f766e"
          />

          <Botao
            texto="Baixar modelo nao_coincidir.csv"
            onClick={() =>
              baixarModelo(
                "nao_coincidir.csv",
                `disciplina1,disciplina2
Algoritmos I,Cálculo I
`,
              )
            }
            cor="#0f766e"
          />

          <Botao
            texto="Baixar modelo mesmo_bloco.csv"
            onClick={() =>
              baixarModelo(
                "mesmo_bloco.csv",
                `disciplina1,disciplina2
Algoritmos I,Laboratório I
`,
              )
            }
            cor="#0f766e"
          />

          <Botao
            texto="Baixar modelo mesmo_horario.csv"
            onClick={() =>
              baixarModelo(
                "mesmo_horario.csv",
                `disciplina1,disciplina2
Algoritmos I,Laboratório I
`,
              )
            }
            cor="#0f766e"
          />
        </div>
      </div>

      {/* Cadastro manual */}
      <div style={{ marginTop: 20 }}>
        <h3>Adicionar restrição manualmente</h3>

        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}
        >
          <select
            value={tipoManual}
            onChange={(e) => setTipoManual(e.target.value)}
            style={{ minWidth: 220, padding: 8 }}
          >
            <option value="fixo">Fixo (disciplina → bloco)</option>
            <option value="dia_fixo">Dia fixo (disciplina → dia)</option>
            <option value="nao_coincidir">Não coincidir</option>
            <option value="mesmo_bloco">Mesmo bloco</option>
            <option value="mesmo_horario">Mesmo horário</option>
          </select>

          {(tipoManual === "fixo" || tipoManual === "dia_fixo") && (
            <select
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              style={{ flex: 1, minWidth: 260, padding: 8 }}
            >
              <option value="">Selecione a disciplina...</option>
              {disciplinas.map((d, i) => (
                <option key={i} value={d.nome}>
                  {d.nome}
                </option>
              ))}
            </select>
          )}

          {(tipoManual === "nao_coincidir" ||
            tipoManual === "mesmo_bloco" ||
            tipoManual === "mesmo_horario") && (
            <>
              <select
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                style={{ flex: 1, minWidth: 240, padding: 8 }}
              >
                <option value="">Disciplina 1...</option>
                {disciplinas.map((d, i) => (
                  <option key={i} value={d.nome}>
                    {d.nome}
                  </option>
                ))}
              </select>

              <select
                value={disciplina2}
                onChange={(e) => setDisciplina2(e.target.value)}
                style={{ flex: 1, minWidth: 240, padding: 8 }}
              >
                <option value="">Disciplina 2...</option>
                {disciplinas.map((d, i) => (
                  <option key={i} value={d.nome}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </>
          )}

          {tipoManual === "fixo" && (
            <input
              type="number"
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              placeholder="Bloco"
              style={{ width: 180, padding: 8 }}
            />
          )}

          {tipoManual === "dia_fixo" && (
            <input
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              placeholder="Dia (seg, ter, qua...)"
              style={{ width: 220, padding: 8 }}
            />
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <Botao
            texto="+ Adicionar Restrição"
            onClick={adicionarRestricaoManual}
            cor="#2563eb"
          />
        </div>
      </div>

      {/* Resumo e ações */}
      <h3 style={{ marginTop: 20 }}>
        Restrições Definidas ({restricoes.length})
      </h3>

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

      <div
        style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
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
                Filtrar por origem
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

      <div style={{ marginTop: 16 }}>
        <Botao texto="← Voltar" onClick={() => setStep(1)} cor="#64748b" />
      </div>
    </div>
  );
}
