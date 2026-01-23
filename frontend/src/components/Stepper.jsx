import { useWizard } from "../context/WizardContext";

const steps = [
  "Configuração",
  "Disciplinas",
  "Restrições",
  "Grade"
];

export default function Stepper() {
  const { step } = useWizard();

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-around",
      padding: "10px",
      background: "#eef3ff"
    }}>
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            background: i === step ? "#2563eb" : "#c7d2fe",
            color: i === step ? "#fff" : "#000",
            fontWeight: "bold"
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}
