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
  const [links, setLinks] = useState({ csv: null, xlsx: null });
  const datasetNome = localStorage.getItem("dataset_nome") || "";

  const [nomeArquivo, setNomeArquivo] = useState(datasetNome || "grade");
  const [salvando, setSalvando] = useState(false);

  function formatarErroAPI(e) {
    const detail = e?.response?.data?.detail;

    // FastAPI 422 costuma vir como array de objetos {loc, msg, type}
    if (Array.isArray(detail)) {
      return detail
        .map((x) => `${(x.loc || []).join(".")}: ${x.msg}`)
        .join(" | ");
    }

    // às vezes vem string
    if (typeof detail === "string") return detail;

    // às vezes vem objeto
    if (detail && typeof detail === "object") return JSON.stringify(detail);

    return e?.message || "Erro ao gerar grade (verifique backend).";
  }

  async function gerar() {
    setErro("");
    setLinks({ csv: null, xlsx: null });
    setLoading(true);

    try {
      // Normaliza disciplinas para o formato do backend: { nome, prof, semestre }
      const disciplinasNorm = (disciplinas || []).map((d) => ({
        nome: d.nome ?? d.Nome ?? d.disciplina ?? "",
        prof: d.prof ?? d.professores ?? d.professor ?? "",
        semestre: d.semestre ?? d.Semestre ?? "",
      }));

      // Normaliza restrições (mantém os campos usados no backend)
      const restricoesNorm = (restricoes || []).map((r) => {
        // tenta achar o "tipo" em vários nomes possíveis
        const tipo =
          r.tipo ??
          r.kind ??
          r.categoria ??
          r.tipo_restricao ??
          r.restricao ??
          (typeof r === "string" ? r : null);

        return {
          tipo: tipo || "fixo", // fallback (se não achar, manda "fixo")
          disciplina: r.disciplina ?? r.nome ?? r.disciplina_nome ?? null,
          bloco: r.bloco ?? r.slot ?? r.horario ?? null,
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
      setErro(formatarErroAPI(e)); // <- sempre string (não quebra o React)
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  async function salvarNoBackend() {
    if (!resultado) return;

    setErro("");
    setLinks({ csv: null, xlsx: null });
    setSalvando(true);

    try {
      const prefixoFinal = (nomeArquivo || datasetNome || "grade").trim();

      const res = await api.post("/exportar-grade", {
        prefixo: prefixoFinal,
        alocacao: resultado.alocacao,
        horarios: resultado.horarios,
        nome_exibicao: resultado.nome_exibicao || {},
      });

      setLinks({ csv: res.data.csv, xlsx: res.data.xlsx });
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Erro ao exportar (verifique backend).";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  function baixarCSV_matriz() {
    if (!resultado) return;

    const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].slice(
      0,
      config.dias_semana,
    );
    const blocosPorDia = config.blocos_por_dia;

    const horarios = resultado.horarios || {};
    const alocacao = resultado.alocacao || {};
    const nomeExibicao = resultado.nome_exibicao || {};

    const blocoParaDisc = {};
    Object.entries(alocacao).forEach(([disc, bloco]) => {
      blocoParaDisc[Number(bloco)] = nomeExibicao[disc] || disc;
    });

    // horas (linhas)
    const horas = [];
    for (let i = 0; i < blocosPorDia; i++) {
      const label = horarios[i] || "";
      const parts = String(label).split(" ");
      horas.push(parts[1] || `Bloco ${i}`);
    }

    const linhas = [];
    linhas.push(["Horario", ...dias].map(escCSV).join(","));

    for (let linha = 0; linha < blocosPorDia; linha++) {
      const row = [horas[linha]];
      for (let diaIndex = 0; diaIndex < dias.length; diaIndex++) {
        const blocoGlobal = diaIndex * blocosPorDia + linha;
        row.push(blocoParaDisc[blocoGlobal] || "");
      }
      linhas.push(row.map(escCSV).join(","));
    }

    baixarArquivo(
      "grade_matriz.csv",
      linhas.join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  function baixarCSV_lista() {
    if (!resultado) return;

    const horarios = resultado.horarios || {};
    const alocacao = resultado.alocacao || {};
    const nomeExibicao = resultado.nome_exibicao || {};

    const linhas = [];
    linhas.push(["Disciplina", "Bloco", "Dia", "Hora"].map(escCSV).join(","));

    Object.entries(alocacao).forEach(([disc, bloco]) => {
      const label = horarios[bloco] || "";
      const parts = String(label).split(" ");
      const dia = parts[0] || "";
      const hora = parts[1] || "";

      linhas.push(
        [nomeExibicao[disc] || disc, bloco, dia, hora].map(escCSV).join(","),
      );
    });

    baixarArquivo(
      "grade_lista.csv",
      linhas.join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  const stats = resultado?.stats;
  const totalDisciplinas = disciplinas.length;
  const alocadas = resultado?.alocacao
    ? Object.keys(resultado.alocacao).length
    : 0;

  return (
    <div style={{ padding: 20 }}>
      <h2>Grade de Horários Gerada</h2>

      <div
        style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}
      >
        <Botao texto="← Voltar" onClick={() => setStep(2)} cor="#64748b" />

        <Botao
          texto={loading ? "Gerando..." : "Gerar Grade"}
          onClick={gerar}
          cor="#16a34a"
        />

        <Botao
          texto="Salvar em backend/out"
          onClick={salvarNoBackend}
          cor="#0ea5e9"
        />

        <Botao
          texto="Baixar CSV (matriz)"
          onClick={baixarCSV_matriz}
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
            <strong>Nome do arquivo (prefixo)</strong>
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
            texto={salvando ? "Salvando..." : "Salvar no backend/out"}
            onClick={salvarNoBackend}
            cor="#0f766e"
          />

          {links?.csv || links?.xlsx ? (
            <div style={{ marginLeft: 10 }}>
              <div>
                <strong>Arquivos salvos em backend/out</strong>
              </div>

              {links.csv ? (
                <div>
                  CSV:{" "}
                  <a
                    href={`http://127.0.0.1:8000${links.csv}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    baixar
                  </a>
                </div>
              ) : null}

              {links.xlsx ? (
                <div>
                  XLSX:{" "}
                  <a
                    href={`http://127.0.0.1:8000${links.xlsx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    baixar
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
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

      {links.csv || links.xlsx ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #c7d2fe",
            background: "#eef2ff",
            borderRadius: 10,
          }}
        >
          <div>
            <strong>Arquivos salvos em backend/out</strong>
          </div>

          {links.csv ? (
            <div>
              CSV:{" "}
              <a
                href={`http://127.0.0.1:8000${links.csv}`}
                target="_blank"
                rel="noreferrer"
              >
                baixar
              </a>
            </div>
          ) : null}

          {links.xlsx ? (
            <div>
              XLSX:{" "}
              <a
                href={`http://127.0.0.1:8000${links.xlsx}`}
                target="_blank"
                rel="noreferrer"
              >
                baixar
              </a>
            </div>
          ) : null}
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
              <div style={cardTitle}>Blocos Utilizados</div>
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
