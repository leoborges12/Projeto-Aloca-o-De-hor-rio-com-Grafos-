import { useWizard } from "../context/WizardContext";
import Botao from "../components/Botao";

export default function Configuracao() {
  const { config, setConfig, setStep } = useWizard();

  const total_blocos = config.dias_semana * config.blocos_por_dia;

  return (
    <div style={{ padding: 20 }}>
      <h2>Configuração da Grade</h2>

      <div style={{ marginTop: 10 }}>
        <label>Dias da Semana</label>
        <input
          type="number"
          min="1"
          max="7"
          value={config.dias_semana}
          onChange={(e) => setConfig({ ...config, dias_semana: Number(e.target.value) })}
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Blocos por Dia</label>
        <input
          type="number"
          min="1"
          value={config.blocos_por_dia}
          onChange={(e) => setConfig({ ...config, blocos_por_dia: Number(e.target.value) })}
          style={{ width: "100%", padding: 8, marginTop: 5 }}
        />
      </div>

      <div style={{
        marginTop: 15,
        padding: 12,
        border: "1px solid #c7d2fe",
        borderRadius: 10,
        background: "#eef3ff"
      }}>
        <h3>Resumo</h3>
        <p>Total de blocos disponíveis: <strong>{total_blocos}</strong></p>
        <p>Grade de {config.dias_semana} dias × {config.blocos_por_dia} horários</p>
      </div>

      <div style={{ marginTop: 15 }}>
        <Botao texto="Próximo: Adicionar Disciplinas →" onClick={() => setStep(1)} />
      </div>
    </div>
  );
}
