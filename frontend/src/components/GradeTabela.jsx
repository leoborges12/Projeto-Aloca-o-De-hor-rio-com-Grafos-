export default function GradeTabela({ config, resultado, disciplinas }) {
  if (!resultado) return null;

  const dias = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"].slice(
    0,
    config.dias_semana,
  );

  const blocosPorDia = Number(config.blocos_por_dia || 4);

  const horarios = resultado.horarios || {}; // {bloco: "Seg 08:00"}
  const alocacao = resultado.alocacao || {}; // {disc: bloco}
  const nomeExibicao = resultado.nome_exibicao || {}; // {disc: "Disc / Prof"}

  // ---- mapa: disciplina -> semestre (vem do cadastro)
  const semestrePorDisc = {};
  (disciplinas || []).forEach((d) => {
    semestrePorDisc[d.nome] = (d.semestre ?? "").toString().trim();
  });

  // ---- normaliza dia do backend ("Seg", "Ter"...) -> "seg"...
  const diaMap = {
    Seg: "seg",
    Ter: "ter",
    Qua: "qua",
    Qui: "qui",
    Sex: "sex",
    Sab: "sab",
    Dom: "dom",
  };

  // ---- define o "período" (12 ou 34) a partir do índice do bloco dentro do dia
  function periodoDoIndice(indiceNoDia) {
    // padrão esperado: 4 blocos por dia => 0,1 = "12" e 2,3 = "34"
    if (blocosPorDia === 4) return indiceNoDia < 2 ? "12" : "34";

    // fallback: se alguém mudar para outro número, vira "P1", "P2"...
    const meio = Math.ceil(blocosPorDia / 2);
    return indiceNoDia < meio ? "12" : "34";
  }

  // ---- estrutura: grade[semestre][periodo][dia] = [itens...]
  const grade = {};
  const semSemestre = {}; // semSemestre[periodo][dia] = [itens...]

  function pushCell(container, periodo, dia, texto) {
    if (!container[periodo]) container[periodo] = {};
    if (!container[periodo][dia]) container[periodo][dia] = [];
    container[periodo][dia].push(texto);
  }

  Object.entries(alocacao).forEach(([disc, blocoRaw]) => {
    const bloco = Number(blocoRaw);
    const label = horarios[bloco] || ""; // "Ter 10:00"
    const parts = String(label).split(" ");
    const diaTxt = parts[0]; // "Ter"
    const dia = diaMap[diaTxt];
    if (!dia) return;

    const indiceNoDia = bloco % blocosPorDia;
    const periodo = periodoDoIndice(indiceNoDia);

    const sem = (
      resultado.semestre_por_disc?.[disc] ??
      semestrePorDisc[disc] ??
      ""
    )
      .toString()
      .trim();

    const nome = nomeExibicao[disc] || disc;

    if (!sem) {
      pushCell(semSemestre, periodo, dia, nome);
      return;
    }

    if (!grade[sem]) grade[sem] = {};
    pushCell(grade[sem], periodo, dia, nome);
  });

  const semestresOrdenados = Object.keys(grade).sort((a, b) => {
    const na = Number(a),
      nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });

  const periodosOrdem = ["12", "34"];

  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>
        Oferta Regular — {new Date().getFullYear()}/
        {new Date().getMonth() < 6 ? "1" : "2"}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Semestre</th>
            <th style={thStyle}>Período</th>
            {dias.map((d) => (
              <th key={d} style={thStyle}>
                {d}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {semestresOrdenados.map((sem) => {
            return periodosOrdem.map((p, idx) => {
              return (
                <tr key={`${sem}-${p}`}>
                  {idx === 0 ? (
                    <td style={tdSemStyle} rowSpan={periodosOrdem.length}>
                      {sem}
                    </td>
                  ) : null}

                  <td style={tdPeriodoStyle}>{p}</td>

                  {dias.map((dia) => {
                    const lista = (grade[sem]?.[p]?.[dia] || []).slice();
                    return (
                      <td key={`${sem}-${p}-${dia}`} style={tdCellStyle}>
                        {lista.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {lista.map((item, i) => (
                              <div key={i} style={itemStyle}>
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      {/* Seção opcional: disciplinas sem semestre */}
      {Object.keys(semSemestre).length ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>
            Disciplinas sem semestre informado
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Período</th>
                {dias.map((d) => (
                  <th key={`ss-${d}`} style={thStyle}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {periodosOrdem.map((p) => (
                <tr key={`ss-${p}`}>
                  <td style={tdPeriodoStyle}>{p}</td>
                  {dias.map((dia) => {
                    const lista = (semSemestre?.[p]?.[dia] || []).slice();
                    return (
                      <td key={`ss-${p}-${dia}`} style={tdCellStyle}>
                        {lista.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {lista.map((item, i) => (
                              <div key={i} style={itemStyle}>
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const thStyle = {
  border: "1px solid #222",
  textAlign: "center",
  padding: "8px 6px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const tdSemStyle = {
  border: "1px solid #222",
  textAlign: "center",
  verticalAlign: "middle",
  padding: "8px 6px",
  fontWeight: "bold",
  width: 90,
};

const tdPeriodoStyle = {
  border: "1px solid #222",
  textAlign: "center",
  verticalAlign: "middle",
  padding: "8px 6px",
  width: 90,
};

const tdCellStyle = {
  border: "1px solid #222",
  verticalAlign: "top",
  padding: "6px 8px",
  minWidth: 170,
};

const itemStyle = {
  fontSize: 12, // diminui para caber tudo (como você pediu)
  lineHeight: "14px",
};
