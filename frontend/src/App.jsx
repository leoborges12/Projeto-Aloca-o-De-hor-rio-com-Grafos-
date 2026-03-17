import { WizardProvider, useWizard } from "./context/WizardContext";

import Home from "./pages/Home";
import Configuracao from "./pages/Configuracao";
import Disciplinas from "./pages/Disciplinas";
import Restricoes from "./pages/Restricoes";
import Grade from "./pages/Grade";
import FormatosRestricoes from "./pages/FormatosRestricoes";

function Conteudo() {
  const { step, setStep } = useWizard();

  if (step === 0) return <Home setStep={setStep} />;
  if (step === 1) return <Configuracao />;
  if (step === 2) return <Disciplinas />;
  if (step === 3) return <FormatosRestricoes />;
  if (step === 4) return <Restricoes />;
  if (step === 5) return <Grade />;
  return <Home setStep={setStep} />;
}

export default function App() {
  return (
    <WizardProvider>
      <Conteudo />
    </WizardProvider>
  );
}
