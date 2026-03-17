import { useMemo, useState } from "react";
import { useWizard } from "../context/WizardContext";
import Botao from "../components/Botao";

export default function Restricoes() {
  const { disciplinas, restricoes, setRestricoes, setStep } = useWizard();

  const [tipoManual, setTipoManual] = useState("fixo");
  const [disciplina, setDisciplina] = useState("");
  const [disciplina2, setDisciplina2] = useState("");
  const [bloco, setBloco] = useState(0);
  const [dia, setDia] = useState("");

  const resumo = useMemo(() => {
    const cont = {
      fixo: 0,
      dia_fixo: 0,
      nao_coincidir: 0,
      mesmo_bloco: 0,
      mesmo_horario: 0,
    };

    for (const r of restricoes) {
      if (cont[r.tipo] !== undefined) cont[r.tipo]++;
    }

    return cont;
  }, [restricoes]);

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

  function removerRestricao(index) {
    const copia = [...restricoes];
    copia.splice(index, 1);
    setRestricoes(copia);
  }

  function descricaoRestricao(r) {
    if (r.tipo === "fixo") return `${r.disciplina} → bloco ${r.bloco}`;
    if (r.tipo === "dia_fixo") return `${r.disciplina} → dia ${r.dia}`;
    if (r.tipo === "nao_coincidir")
      return `${r.disciplina1} não coincide com ${r.disciplina2}`;
    if (r.tipo === "mesmo_bloco")
      return `${r.disciplina1} no mesmo bloco que ${r.disciplina2}`;
    if (r.tipo === "mesmo_horario")
      return `${r.disciplina1} no mesmo horário que ${r.disciplina2}`;
    return JSON.stringify(r);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Revisar e Adicionar Restrições</h2>

      <p style={{ color: "#64748b", marginBottom: 20 }}>
        Aqui você confere o que já foi importado, pode remover restrições
        incorretas e adicionar novas manualmente antes de gerar a grade.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <ResumoCard titulo="Fixo" valor={resumo.fixo} />
        <ResumoCard titulo="Dia fixo" valor={resumo.dia_fixo} />
        <ResumoCard titulo="Não coincidir" valor={resumo.nao_coincidir} />
        <ResumoCard titulo="Mesmo bloco" valor={resumo.mesmo_bloco} />
        <ResumoCard titulo="Mesmo horário" valor={resumo.mesmo_horario} />
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Adicionar manualmente</h3>

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
              <option value="">Selecione uma disciplina...</option>
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

        <div style={{ marginTop: 12 }}>
          <Botao
            texto="+ Adicionar restrição"
            onClick={adicionarRestricaoManual}
            cor="#2563eb"
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Restrições adicionadas ({restricoes.length})
        </h3>

        {restricoes.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            Nenhuma restrição adicionada ainda.
          </p>
        ) : (
          <div>
            {restricoes.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <strong>{r.tipo}</strong> — {descricaoRestricao(r)}
                  {r.origem ? ` / origem: ${r.origem}` : ""}
                </div>

                <button onClick={() => removerRestricao(i)}>remover</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
        <Botao text="← Voltar" onClick={() => setStep(3)} cor="#64748b" />
        <Botao
          texto="Gerar Grade de Horários →"
          onClick={() => setStep(5)}
          cor="#16a34a"
        />
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#f8fafc",
      }}
    >
      <div style={{ color: "#475569", fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 4 }}>
        {valor}
      </div>
    </div>
  );
}
