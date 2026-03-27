import { useState } from "react";
import { useWizard } from "../context/WizardContext";
import { api } from "../api/api";
import Botao from "../components/Botao";
import GradeTabela from "../components/GradeTabela";

function baixarArquivo(nome, conteudo, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escCSV(v) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export default function Grade() {
  const { setStep, config, disciplinas, restricoes, resultado, setResultado } =
    useWizard();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const datasetNome = localStorage.getItem("dataset_nome") || "";

  const [nomeArquivo, setNomeArquivo] = useState(datasetNome || "grade");
  const [baixando, setBaixando] = useState(false);

  function formatarErroAPI(e) {
    const detail = e?.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((x) => `${(x.loc || []).join(".")}: ${x.msg}`)
        .join(" | ");
    }

    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") return JSON.stringify(detail);

    return e?.message || "Erro ao gerar grade (verifique backend).";
  }

  async function gerar() {
    setErro("");
    setLoading(true);

    try {
      const disciplinasNorm = (disciplinas || []).map((d) => ({
        nome: d.nome ?? d.Nome ?? d.disciplina ?? "",
        prof: d.prof ?? d.professores ?? d.professor ?? "",
        semestre: d.semestre ?? d.Semestre ?? "",
        aulas_por_semana: Number(d.aulas_por_semana ?? d.aulasPorSemana ?? 1),
      }));

      const restricoesNorm = (restricoes || []).map((r) => {
        const tipo =
          r.tipo ??
          r.kind ??
          r.categoria ??
          r.tipo_restricao ??
          r.restricao ??
          (typeof r === "string" ? r : null);

        return {
          tipo: tipo || "fixo",
          disciplina: r.disciplina ?? r.nome ?? r.disciplina_nome ?? null,
          bloco: r.bloco ?? r.slot ?? r.horario ?? null,
          ocorrencia:
            r.ocorrencia !== undefined &&
            r.ocorrencia !== null &&
            r.ocorrencia !== ""
              ? Number(r.ocorrencia)
              : null,
          dia: r.dia ?? null,
          disciplina1: r.disciplina1 ?? r.a ?? null,
          disciplina2: r.disciplina2 ?? r.b ?? null,
        };
      });

      const res = await api.post("/gerar-grade", {
        config,
        disciplinas: disciplinasNorm,
        restricoes: restricoesNorm,
      });

      setResultado(res.data);
    } catch (e) {
      setErro(formatarErroAPI(e));
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  async function exportarEbaixar(formato) {
    if (!resultado) return;

    setErro("");
    setBaixando(true);

    try {
      const prefixoFinal = (nomeArquivo || datasetNome || "grade").trim();

      const res = await api.post("/exportar-grade", {
        prefixo: prefixoFinal,
        alocacao: resultado.alocacao,
        horarios: resultado.horarios,
        nome_exibicao: resultado.nome_exibicao || {},
      });

      const baseURL = (api.defaults.baseURL || "").replace(/\/$/, "");
      const caminho = formato === "xlsx" ? res.data.xlsx : res.data.csv;

      if (!caminho) {
        throw new Error(
          formato === "xlsx"
            ? "Arquivo XLSX não foi gerado."
            : "Arquivo CSV não foi gerado.",
        );
      }

      const link = document.createElement("a");
      link.href = `${baseURL}${caminho}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.click();
    } catch (e) {
      const msg =
        e?.response?.data?.detail || e?.message || "Erro ao exportar arquivo.";
      setErro(msg);
    } finally {
      setBaixando(false);
    }
  }

  function baixarCSV_visual() {
    if (!resultado) return;

    const dias = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"].slice(
      0,
      config.dias_semana,
    );

    const blocosPorDia = Number(config.blocos_por_dia || 4);
    const horarios = resultado.horarios || {};
    const alocacao = resultado.alocacao || {};
    const nomeExibicao = resultado.nome_exibicao || {};

    const semestrePorDisc = {};
    (disciplinas || []).forEach((d) => {
      semestrePorDisc[d.nome] = (d.semestre ?? "").toString().trim();
    });

    const diaMap = {
      Seg: "seg",
      Ter: "ter",
      Qua: "qua",
      Qui: "qui",
      Sex: "sex",
      Sab: "sab",
      Dom: "dom",
    };

    function periodoDoIndice(indiceNoDia) {
      return String(indiceNoDia + 1);
    }

    const grade = {};
    const semSemestre = {};

    function pushCell(container, periodo, dia, texto) {
      if (!container[periodo]) container[periodo] = {};
      if (!container[periodo][dia]) container[periodo][dia] = [];
      container[periodo][dia].push(texto);
    }

    Object.entries(alocacao).forEach(([disc, blocoRaw]) => {
      const bloco = Number(blocoRaw);
      const label = horarios[bloco] || "";
      const parts = String(label).split(" ");
      const diaTxt = parts[0];
      const dia = diaMap[diaTxt];
      if (!dia) return;

      const indiceNoDia = bloco % blocosPorDia;
      const periodo = periodoDoIndice(indiceNoDia);

      const nomeBase = disc.replace(/\s*\[\d+\/\d+\]/, "");

      const sem = (
        (resultado.semestre_por_disc && resultado.semestre_por_disc[disc]) ||
        semestrePorDisc[nomeBase] ||
        ""
      )
        .toString()
        .trim();

      const nome = nomeExibicao[disc] || nomeBase;

      if (!sem) {
        pushCell(semSemestre, periodo, dia, nome);
        return;
      }

      if (!grade[sem]) grade[sem] = {};
      pushCell(grade[sem], periodo, dia, nome);
    });

    const semestresOrdenados = Object.keys(grade).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });

    const periodosOrdem = Array.from({ length: blocosPorDia }, (_, i) =>
      String(i + 1),
    );

    const linhas = [];
    linhas.push(["Semestre", "Período", ...dias].map(escCSV).join(","));

    semestresOrdenados.forEach((sem) => {
      periodosOrdem.forEach((p) => {
        const row = [sem, p];

        dias.forEach((dia) => {
          const lista =
            (grade[sem] && grade[sem][p] && grade[sem][p][dia]) || [];
          row.push(lista.join("\n"));
        });

        linhas.push(row.map(escCSV).join(","));
      });
    });

    if (Object.keys(semSemestre).length > 0) {
      linhas.push("");
      linhas.push(["Disciplinas sem semestre informado"].map(escCSV).join(","));
      linhas.push(["Período", ...dias].map(escCSV).join(","));

      periodosOrdem.forEach((p) => {
        const row = [p];

        dias.forEach((dia) => {
          const lista = (semSemestre[p] && semSemestre[p][dia]) || [];
          row.push(lista.join("\n"));
        });

        linhas.push(row.map(escCSV).join(","));
      });
    }

    baixarArquivo(
      `${(nomeArquivo || "grade").trim()}_visual.csv`,
      linhas.join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  const stats = resultado?.stats;
  const totalDisciplinas = stats?.total_disciplinas_base ?? disciplinas.length;
  const alocadas = stats?.disciplinas_base_alocadas ?? 0;

  return (
    <div style={{ padding: 20 }}>
      <h2>Grade de Horários Gerada</h2>

      <div
        style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}
      >
        <Botao texto="← Voltar" onClick={() => setStep(4)} cor="#64748b" />

        <Botao
          texto={loading ? "Gerando..." : "Gerar Grade"}
          onClick={gerar}
          cor="#16a34a"
        />

        <Botao
          texto="Baixar CSV (matriz)"
          onClick={baixarCSV_visual}
          cor="#2563eb"
        />

        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            background: "#f8fafc",
            borderRadius: 10,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <strong>Nome do arquivo</strong>
            <input
              value={nomeArquivo}
              onChange={(e) => setNomeArquivo(e.target.value)}
              placeholder={datasetNome ? datasetNome : "ex: minha_grade"}
              style={{
                width: 280,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />
            {datasetNome ? (
              <small style={{ color: "#64748b" }}>
                Importado: <strong>{datasetNome}</strong> (já deixei preenchido)
              </small>
            ) : (
              <small style={{ color: "#64748b" }}>
                Sem import: escolha o nome que quiser.
              </small>
            )}
          </div>

          <Botao
            texto={baixando ? "Preparando CSV..." : "Baixar CSV"}
            onClick={() => exportarEbaixar("csv")}
            cor="#0f766e"
          />

          <Botao
            texto={baixando ? "Preparando XLSX..." : "Baixar XLSX"}
            onClick={() => exportarEbaixar("xlsx")}
            cor="#0f766e"
          />
        </div>
      </div>

      {erro ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            borderRadius: 10,
            color: "#991b1b",
          }}
        >
          <strong>Erro:</strong>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{erro}</pre>
        </div>
      ) : null}

      {resultado ? (
        <>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
              gap: 10,
            }}
          >
            <div style={card}>
              <div style={cardTitle}>Disciplinas Alocadas</div>
              <div style={cardValue}>
                {alocadas} / {totalDisciplinas}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>Slots Utilizados</div>
              <div style={cardValue}>
                {stats?.blocos_usados ?? "-"} / {stats?.total_blocos ?? "-"}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>Desbalanceamento</div>
              <div style={cardValue}>{stats?.desbalanceamento ?? "-"}</div>
            </div>
          </div>

          <GradeTabela
            config={config}
            resultado={resultado}
            disciplinas={disciplinas}
          />
        </>
      ) : (
        <p style={{ marginTop: 12, color: "#64748b" }}>
          Nenhuma grade gerada ainda. Clique em <strong>Gerar Grade</strong>.
          <br />
          Obs: como o estado fica salvo no navegador, se você já gerou antes,
          ele deve reaparecer quando você abrir a página.
        </p>
      )}
    </div>
  );
}

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#f8fafc",
};

const cardTitle = { color: "#334155", fontSize: 14 };
const cardValue = { fontSize: 26, fontWeight: "bold", marginTop: 4 };
