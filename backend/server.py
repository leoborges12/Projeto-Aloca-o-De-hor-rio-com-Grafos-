from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any
import re
from collections import defaultdict

from grafo import construir_grafo, colorir_grafo_balanceado  # :contentReference[oaicite:2]{index=2}
from main import montar_horarios, indice_blocos_por_dia      # :contentReference[oaicite:3]{index=3}
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime
import csv
import sys
import io
from contextlib import redirect_stdout, redirect_stderr




# --------------------------
# Helpers
# --------------------------

class _Tee(io.StringIO):
    """
    Captura prints (stdout/stderr) e ao mesmo tempo continua escrevendo no terminal.
    """
    def __init__(self, real_stream):
        super().__init__()
        self.real_stream = real_stream

    def write(self, s):
        try:
            self.real_stream.write(s)  # mantém no terminal
            self.real_stream.flush()
        except Exception:
            pass
        return super().write(s)

def _prof_display(prof_raw: str) -> str:
    toks = [t.strip() for t in re.split(r"[|,;/]+", str(prof_raw)) if t.strip()]
    # remove duplicatas mantendo ordem
    uniq = list(dict.fromkeys(toks))
    return ", ".join(uniq)

def _norm_dia(dia: str) -> str:
    # normaliza: seg/segunda, ter/terça/terca etc. => segunda/terca/...
    mapa = {
        'segunda':'segunda','seg':'segunda',
        'terca':'terca','terça':'terca','ter':'terca',
        'quarta':'quarta','qua':'quarta',
        'quinta':'quinta','qui':'quinta',
        'sexta':'sexta','sex':'sexta',
        'sabado':'sabado','sábado':'sabado','sab':'sabado',
        'domingo':'domingo','dom':'domingo'
    }
    d = (dia or "").strip().lower()
    return mapa.get(d, "")


# --------------------------
# Modelos da API
# --------------------------

class Config(BaseModel):
    dias_semana: int = 5
    blocos_por_dia: int = 4
    conflito_por_prof: bool = True
    conflito_por_semestre: bool = True

class Disciplina(BaseModel):
    nome: str
    prof: str = ""
    semestre: str = ""

class Restricao(BaseModel):
	tipo: Literal["fixo", "dia_fixo", "nao_coincidir", "mesmo_bloco", "mesmo_horario"] = "fixo"

	disciplina: Optional[str] = None
	bloco: Optional[int] = None

	dia: Optional[str] = None

	disciplina1: Optional[str] = None
	disciplina2: Optional[str] = None

class Entrada(BaseModel):
    config: Config
    disciplinas: List[Disciplina]
    restricoes: List[Restricao] = []


app = FastAPI()

# CORS para o React (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # depois trocamos pro domínio do Netlify
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

from pathlib import Path
import csv

BASE_DIR = Path(__file__).resolve().parent
DADOS_DIR = BASE_DIR / "dados"

def _listar_datasets():
    if not DADOS_DIR.exists():
        return []
    nomes = set()
    for p in DADOS_DIR.glob("*_disciplinas.csv"):
        nome = p.name.replace("_disciplinas.csv", "")
        nomes.add(nome)
    return sorted(nomes)


def _ler_csv(path: Path):
	itens = []
	with path.open("r", encoding="utf-8-sig", newline="") as f:
		amostra = f.read(2048)
		f.seek(0)

		# detecta delimitador ; ou ,
		try:
			dialeto = csv.Sniffer().sniff(amostra, delimiters=";,")
		except Exception:
			dialeto = csv.get_dialect("excel")  # fallback

		reader = csv.DictReader(f, dialect=dialeto)
		for row in reader:
			# limpa espaços + remove chaves None (quando dá leitura quebrada)
			limpo = {}
			for k, v in (row or {}).items():
				if k is None:
					continue
				kk = str(k).strip()
				vv = v.strip() if isinstance(v, str) else v
				limpo[kk] = vv
			itens.append(limpo)

	return itens

@app.get("/dados")
def listar_dados():
    """
    Lista datasets disponíveis em backend/dados/ no formato:
    <nome>_disciplinas.csv (obrigatório)
    <nome>_restricoes.csv (opcional)
    """
    return {"datasets": _listar_datasets()}

def _inferir_restricoes(rows: list[dict], filename: str) -> list[dict]:
    """
    Converte linhas de CSV em objetos compatíveis com o model Restricao do back/front:
    tipo: fixo | dia_fixo | nao_coincidir | mesmo_bloco | mesmo_horario

    Além disso, adiciona:
    origem: nome do arquivo (ex: "engcomp_2025_1_restricoes.csv", "fixos.csv", etc.)
    """
    fname = filename.lower()

    # tenta descobrir pelo nome do arquivo
    tipo_padrao = None
    if "fixo" in fname:
        tipo_padrao = "fixo"
    elif "dia" in fname and "fix" in fname:
        tipo_padrao = "dia_fixo"
    elif "nao" in fname or "não" in fname or "coincidir" in fname or "restricoes" in fname:
        tipo_padrao = "nao_coincidir"
    elif "mesmo_horario" in fname:
        tipo_padrao = "mesmo_horario"
    elif "mesmo_bloco" in fname:
        tipo_padrao = "mesmo_bloco"

    restricoes = []
    for r in rows:
        disciplina = r.get("disciplina") or r.get("nome") or ""
        bloco = r.get("bloco")
        dia = r.get("dia")

        d1 = r.get("disciplina1") or r.get("d1") or r.get("a") or ""
        d2 = r.get("disciplina2") or r.get("d2") or r.get("b") or ""

        tipo = (r.get("tipo") or tipo_padrao or "").strip()

        # fallback por colunas
        if not tipo:
            if disciplina and bloco is not None:
                tipo = "fixo"
            elif disciplina and dia:
                tipo = "dia_fixo"
            elif d1 and d2:
                tipo = "nao_coincidir"

        obj = {"tipo": tipo, "origem": filename}

        if tipo == "fixo":
            obj["disciplina"] = disciplina
            obj["bloco"] = int(bloco) if bloco is not None and str(bloco).strip() != "" else None

        elif tipo == "dia_fixo":
            obj["disciplina"] = disciplina
            obj["dia"] = dia

        elif tipo in ("nao_coincidir", "mesmo_bloco", "mesmo_horario"):
            obj["disciplina1"] = d1
            obj["disciplina2"] = d2

        if obj.get("tipo"):
            restricoes.append(obj)

    return restricoes

@app.get("/dados/{nome}")
def carregar_dados(nome: str):
    """
    Carrega um dataset e retorna {disciplinas: [...], restricoes: [...]}

    Agora ele carrega:
    - <nome>_disciplinas.csv (obrigatório)
    - todo <nome>_*.csv (exceto disciplinas) como restrições, inferindo o tipo
    """
    disc_path = DADOS_DIR / f"{nome}_disciplinas.csv"
    if not disc_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{nome}' não encontrado (faltando {disc_path.name})")

    disciplinas = _ler_csv(disc_path)

    restricoes: list[dict] = []

    # pega qualquer arquivo do prefixo, menos o de disciplinas
    for p in sorted(DADOS_DIR.glob(f"{nome}_*.csv")):
        if p.name.endswith("_disciplinas.csv"):
            continue

        rows = _ler_csv(p)
        restricoes.extend(_inferir_restricoes(rows, p.name))

    return {"nome": nome, "disciplinas": disciplinas, "restricoes": restricoes}

# --------------------------
# Importação manual de arquivos de restrições (selecionável no front)
# --------------------------

@app.get("/restricoes/arquivos")
def listar_arquivos_restricoes():
    """
    Lista TODOS os CSVs de restrições disponíveis em backend/dados.
    Ignora arquivos *_disciplinas.csv
    """
    if not DADOS_DIR.exists():
        return {"arquivos": []}

    arquivos = []
    for p in sorted(DADOS_DIR.glob("*.csv")):
        if p.name.endswith("_disciplinas.csv"):
            continue
        arquivos.append(p.name)

    return {"arquivos": arquivos}


class ImportarArquivosRestricoesEntrada(BaseModel):
    arquivos: List[str] = []


@app.post("/restricoes/importar")
def importar_arquivos_restricoes(payload: ImportarArquivosRestricoesEntrada):
    """
    Importa SOMENTE os arquivos selecionados e devolve uma lista única de restrições já normalizadas.
    """
    if not payload.arquivos:
        return {"restricoes": []}

    restricoes: list[dict] = []

    for nome_arquivo in payload.arquivos:
        # proteção básica contra path traversal
        path = (DADOS_DIR / nome_arquivo).resolve()
        if DADOS_DIR not in path.parents or not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {nome_arquivo}")

        rows = _ler_csv(path)
        restricoes.extend(_inferir_restricoes(rows, path.name))

    return {"restricoes": restricoes}

# =========================
# IMPORTAR RESTRIÇÕES POR ARQUIVOS (SEM PREFIXO)
# =========================

def _listar_arquivos_restricoes_soltas():
    """
    Lista CSVs em backend/dados que NÃO são datasets do tipo *_disciplinas.csv
    (ex.: fixos.csv, dia_fixo.csv, mesmo_bloco.csv, nao_coincidir.csv)
    """
    if not DADOS_DIR.exists():
        return []

    arquivos = []
    for p in sorted(DADOS_DIR.glob("*.csv")):
        # ignora arquivos de disciplinas de dataset
        if p.name.endswith("_disciplinas.csv"):
            continue
        arquivos.append(p.name)
    return arquivos


class ImportarArquivosEntrada(BaseModel):
    arquivos: List[str]


@app.get("/restricoes/arquivos")
def listar_arquivos_restricoes():
    return {"arquivos": _listar_arquivos_restricoes_soltas()}


@app.post("/restricoes/importar")
def importar_restricoes_por_arquivos(payload: ImportarArquivosEntrada):
    """
    Recebe uma lista de nomes de arquivos (ex.: ["fixos.csv","dia_fixo.csv"])
    e devolve as restrições já no formato do front, com campo "origem"=nome do arquivo.
    """
    if not payload.arquivos:
        return {"restricoes": []}

    restricoes_total: list[dict] = []

    for nome_arq in payload.arquivos:
        # proteção contra path traversal
        p = (DADOS_DIR / nome_arq).resolve()
        if DADOS_DIR not in p.parents or not p.exists() or not p.is_file():
            raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {nome_arq}")

        rows = _ler_csv(p)
        restrs = _inferir_restricoes(rows, p.name)

        # marca origem do arquivo
        for r in restrs:
            r["origem"] = p.name

        restricoes_total.extend(restrs)

    return {"restricoes": restricoes_total}


@app.post("/gerar-grade")
def gerar_grade(dados: Entrada) -> Dict[str, Any]:
    tee_out = _Tee(sys.stdout)
    tee_err = _Tee(sys.stderr)

    try:
        with redirect_stdout(tee_out), redirect_stderr(tee_err):

            dias_semana = dados.config.dias_semana
            blocos_por_dia = dados.config.blocos_por_dia

            horarios = montar_horarios(dias_semana, blocos_por_dia)
            num_blocos = len(horarios)

            disciplinas_list = [d.model_dump() for d in dados.disciplinas]

            # 1) Monta grafo base (conflito por prof/semestre)
            G = construir_grafo(
                disciplinas_list,
                conflito_por_prof=dados.config.conflito_por_prof,
                conflito_por_semestre=dados.config.conflito_por_semestre
            )

            # 2) Processa restrições vindas do front
            fixos: Dict[str, int] = {}
            pares_mesmo: List[tuple] = []
            pares_nao: List[tuple] = []
            dia_por_disc: Dict[str, str] = {}

            for r in dados.restricoes:
                if r.tipo == "fixo":
                    if r.disciplina and r.bloco is not None:
                        fixos[r.disciplina] = int(r.bloco)

                elif r.tipo == "dia_fixo":
                    if r.disciplina and r.dia:
                        dn = _norm_dia(r.dia)
                        if dn:
                            dia_por_disc[r.disciplina] = dn

                elif r.tipo == "nao_coincidir":
                    if r.disciplina1 and r.disciplina2:
                        pares_nao.append((r.disciplina1, r.disciplina2))

                elif r.tipo in ("mesmo_bloco", "mesmo_horario"):
                    if r.disciplina1 and r.disciplina2:
                        pares_mesmo.append((r.disciplina1, r.disciplina2))

            # 2.1) aplica “não pode coincidir” como aresta
            for a, b in pares_nao:
                if a in G and b in G:
                    G.add_edge(a, b)

            # 2.2) valida fixos no range
            fixos = {d: b for d, b in fixos.items() if d in G}
            fixos = {d: b for d, b in fixos.items() if 0 <= b < num_blocos}

            # 2.3) dia_fixo -> domínios por nó (blocos permitidos)
            dominios: Dict[str, set] = {}
            idx_dia = indice_blocos_por_dia(horarios)

            for disc, dia_norm in dia_por_disc.items():
                if disc in G and dia_norm in idx_dia:
                    dominios[disc] = set(idx_dia[dia_norm])

            # 3) roda o algoritmo pesado
            cores = colorir_grafo_balanceado(
                G,
                num_blocos=num_blocos,
                fixos=fixos,
                pares_mesmo_horario=pares_mesmo,
                pares_mesmo_bloco=pares_mesmo,
                dominios_por_no=dominios,
                allow_extra_blocks=False,
                hard_fail=True
            )

            # 4) estatísticas
            dist = defaultdict(int)
            for _, b in cores.items():
                dist[b] += 1

            usados = sorted(dist.keys())
            desbalanceamento = 0
            if usados:
                desbalanceamento = max(dist[b] for b in usados) - min(dist[b] for b in usados)

            # 5) nome exibicao (disciplina / prof(s))
            prof_display = {}
            for d in disciplinas_list:
                prof_display[d["nome"]] = _prof_display(d.get("prof", ""))

            nome_exibicao = {
                disc: (f"{disc} / {prof_display[disc]}" if prof_display.get(disc) else disc)
                for disc in G.nodes()
            }

            logs = (tee_out.getvalue() + "\n" + tee_err.getvalue()).strip()

            return {
                "alocacao": cores,
                "horarios": horarios,
                "stats": {
                    "total_blocos": num_blocos,
                    "blocos_usados": len(usados),
                    "desbalanceamento": desbalanceamento,
                    "dist_por_bloco": {str(k): int(v) for k, v in dist.items()},
                },
                "nome_exibicao": nome_exibicao,
                "logs": logs,  # <- NOVO: volta pro front também
            }

    except Exception as e:
        logs = (tee_out.getvalue() + "\n" + tee_err.getvalue()).strip()
        msg = str(e)

        # devolve pro front O MESMO que você via no terminal + o erro final
        detail = ""
        if logs:
            detail += logs + "\n"
        detail += f"\nERRO: {msg}"

        raise HTTPException(status_code=400, detail=detail)

# --- ADICIONE PERTO DA CRIAÇÃO DO app = FastAPI() ---
OUT_DIR = Path(__file__).resolve().parent / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/")
def root():
    return {"ok": True, "docs": "/docs", "health": "/health"}


# --- MODELO PARA EXPORTAR ---
class ExportarGradeEntrada(BaseModel):
    alocacao: Dict[str, int]           # {disciplina: bloco}
    horarios: Dict[str, str]           # {bloco: "Seg 08:00"}  (no JSON vem como string)
    nome_exibicao: Dict[str, str] = {} # {disciplina: "Disc / Prof"}
    prefixo: str = "grade"


@app.post("/exportar-grade")
def exportar_grade(payload: ExportarGradeEntrada) -> Dict[str, Any]:
    # normaliza chaves/valores
    try:
        cores = {str(k): int(v) for k, v in payload.alocacao.items()}
        horarios = {int(k): str(v) for k, v in payload.horarios.items()}
        nome_exib = payload.nome_exibicao or {k: k for k in cores.keys()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payload inválido: {e}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = OUT_DIR / f"{payload.prefixo}_{ts}"

    # tenta salvar igual o main.py
    try:
        from main import salvar_grade_excel_csv
        salvar_grade_excel_csv(cores, horarios, nome_exib, caminho_base=str(base))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao salvar grade: {e}")

    csv_path = Path(f"{base}.csv")
    xlsx_path = Path(f"{base}.xlsx")

    resp = {
        "base": base.name,
        "salvo_em": str(OUT_DIR),
        "csv": f"/out/{csv_path.name}" if csv_path.exists() else None,
        "xlsx": f"/out/{xlsx_path.name}" if xlsx_path.exists() else None,
    }

    # se não gerou nada, geralmente é dependência faltando (pandas/openpyxl) ou permissão
    if not resp["csv"] and not resp["xlsx"]:
        raise HTTPException(
            status_code=500,
            detail="Nenhum arquivo foi gerado. Instale pandas/openpyxl (para xlsx) e verifique permissões."
        )

    return resp


@app.get("/out")
def listar_out():
    arquivos = sorted([p.name for p in OUT_DIR.glob("*") if p.is_file()])
    return {"arquivos": arquivos}


@app.get("/out/{arquivo}")
def baixar_out(arquivo: str):
    # proteção básica contra path traversal
    path = (OUT_DIR / arquivo).resolve()
    if OUT_DIR not in path.parents or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(path, filename=path.name)