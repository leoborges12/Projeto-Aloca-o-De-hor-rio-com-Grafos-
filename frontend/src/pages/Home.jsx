import Botao from "../components/Botao";

export default function Home({ setStep }) {
  return (
    <div
      style={{
        padding: 40,
        maxWidth: 900,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <img
        src="/logoUnipampa.png"
        alt="Julio é monstro"
        style={{
          width: 140,
          marginBottom: 20,
        }}
      />

      <h1 style={{ fontSize: 40 }}>
        Sistema de Alocação de Horários Acadêmicos
      </h1>

      <p
        style={{
          fontSize: 25,
          color: "#555",
          marginTop: 10,
          marginBottom: 30,
        }}
      >
        Ferramenta para geração automática de grades de horários, considerando
        disciplinas, professores e restrições acadêmicas.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          marginBottom: 40,
        }}
      >
        <div style={card}>
          <h3>1️⃣ Configurar Grade</h3>
          <p>
            Defina número de dias da semana, blocos de horário e parâmetros da
            grade.
          </p>
        </div>

        <div style={card}>
          <h3>2️⃣ Importar Dados</h3>
          <p>
            Carregue disciplinas e restrições através de arquivos CSV ou
            adicione manualmente.
          </p>
        </div>

        <div style={card}>
          <h3>3️⃣ Gerar Horários</h3>
          <p>
            O sistema calcula automaticamente a melhor distribuição possível de
            aulas.
          </p>
        </div>
      </div>

      <Botao
        texto="Iniciar Configuração →"
        onClick={() => setStep(1)}
        cor="#16a34a"
      />
    </div>
  );
}

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  background: "#f8fafc",
};
