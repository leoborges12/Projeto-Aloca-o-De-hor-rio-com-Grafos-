import { WizardProvider, useWizard } from "./context/WizardContext";
import Configuracao from "./pages/Configuracao";
import Disciplinas from "./pages/Disciplinas";
import Restricoes from "./pages/Restricoes";
import Grade from "./pages/Grade";

function Conteudo() {
  const { step } = useWizard();

  if (step === 0) return <Configuracao />;
  if (step === 1) return <Disciplinas />;
  if (step === 2) return <Restricoes />;
  return <Grade />;
}

export default function App() {
  return (
    <WizardProvider>
      <Conteudo />
    </WizardProvider>
  );
}
