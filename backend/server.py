from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any
from pathlib import Path
from datetime import datetime
from contextlib import redirect_stdout, redirect_stderr
from collections import defaultdict
import re
import csv
import sys
import io

from grafo import construir_grafo, colorir_grafo_balanceado
from main import montar_horarios, indice_blocos_por_dia

from supabase_client import supabase

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
            self.real_stream.write(s)
            self.real_stream.flush()
        except Exception:
            pass
        return super().write(s)


def _prof_display(prof_raw: str) -> str:
    toks = [t.strip() for t in re.split(r"[|,;/]+", str(prof_raw)) if t.strip()]
    uniq = list(dict.fromkeys(toks))
    return ", ".join(uniq)


def _norm_dia(dia: str) -> str:
    mapa = {
        "segunda": "segunda", "seg": "segunda",
        "terca": "terca", "terça": "terca", "ter": "terca",
        "quarta": "quarta", "qua": "quarta",
        "quinta": "quinta", "qui": "quinta",
        "sexta": "sexta", "sex": "sexta",
        "sabado": "sabado", "sábado": "sabado", "sab": "sabado",
        "domingo": "domingo", "dom": "domingo",
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
    aulas_por_semana: int = 1


class Restricao(BaseModel):
    tipo: Literal["fixo", "dia_fixo", "nao_coincidir", "mesmo_bloco", "mesmo_horario"] = "fixo"
    disciplina: Optional[str] = None
    bloco: Optional[int] = None
    ocorrencia: Optional[int] = None
    dia: Optional[str] = None
    disciplina1: Optional[str] = None
    disciplina2: Optional[str] = None

class Entrada(BaseModel):
    config: Config
    disciplinas: List[Disciplina]
    restricoes: List[Restricao] = []


class ImportarArquivosEntrada(BaseModel):
    arquivos: List[str]


class ExportarGradeEntrada(BaseModel):
    alocacao: Dict[str, int]
    horarios: Dict[str, str]
    nome_exibicao: Dict[str, str] = {}
    prefixo: str = "grade"


# --------------------------
# App / diretórios
# --------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # depois você troca pelo domínio do Netlify
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DADOS_DIR = BASE_DIR / "dados"
OUT_DIR = BASE_DIR / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------
# Health / root
# --------------------------

@app.get("/")
def root():
    return {"ok": True, "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"ok": True}


# --------------------------
# CSV / datasets
# --------------------------

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

        try:
            dialeto = csv.Sniffer().sniff(amostra, delimiters=";,")
        except Exception:
            dialeto = csv.get_dialect("excel")

        reader = csv.DictReader(f, dialect=dialeto)
        for row in reader:
            limpo = {}
            for k, v in (row or {}).items():
                if k is None:
                    continue
                kk = str(k).strip()
                vv = v.strip() if isinstance(v, str) else v
                limpo[kk] = vv
            itens.append(limpo)

    return itens


def _ler_csv_texto(conteudo: str) -> list[dict]:
    itens = []
    f = io.StringIO(conteudo)

    amostra = conteudo[:2048]
    try:
        dialeto = csv.Sniffer().sniff(amostra, delimiters=";,")
    except Exception:
        dialeto = csv.get_dialect("excel")

    reader = csv.DictReader(f, dialect=dialeto)

    for row in reader:
        limpo = {}
        for k, v in (row or {}).items():
            if k is None:
                continue
            kk = str(k).strip()
            vv = v.strip() if isinstance(v, str) else v
            limpo[kk] = vv
        itens.append(limpo)

    return itens


def _inferir_restricoes(rows: list[dict], filename: str) -> list[dict]:
    """
    Converte linhas de CSV em objetos compatíveis com o model Restricao do back/front:
    tipo: fixo | dia_fixo | nao_coincidir | mesmo_bloco | mesmo_horario

    Além disso, adiciona:
    origem: nome do arquivo
    """
    fname = filename.lower()

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
        ocorrencia = r.get("ocorrencia")
        dia = r.get("dia")

        d1 = r.get("disciplina1") or r.get("d1") or r.get("a") or ""
        d2 = r.get("disciplina2") or r.get("d2") or r.get("b") or ""

        tipo = (r.get("tipo") or tipo_padrao or "").strip()

        if not tipo:
            if disciplina and bloco is not None and str(bloco).strip() != "":
                tipo = "fixo"
            elif disciplina and dia:
                tipo = "dia_fixo"
            elif d1 and d2:
                tipo = "nao_coincidir"

        obj = {"tipo": tipo, "origem": filename}

        if tipo == "fixo":
            obj["disciplina"] = disciplina
            obj["bloco"] = int(bloco) if bloco is not None and str(bloco).strip() != "" else None

            if ocorrencia is not None and str(ocorrencia).strip() != "":
                try:
                    obj["ocorrencia"] = int(ocorrencia)
                except Exception:
                    obj["ocorrencia"] = None

        elif tipo == "dia_fixo":
            obj["disciplina"] = disciplina
            obj["dia"] = dia

        elif tipo in ("nao_coincidir", "mesmo_bloco", "mesmo_horario"):
            obj["disciplina1"] = d1
            obj["disciplina2"] = d2

        if obj.get("tipo"):
            restricoes.append(obj)

    return restricoes

def _normalizar_disciplina_row(r: dict) -> dict:
    nome_disc = (
        r.get("nome")
        or r.get("disciplina")
        or r.get("Nome")
        or r.get("Disciplina")
        or ""
    ).strip()

    prof = (
        r.get("prof")
        or r.get("professor")
        or r.get("Prof")
        or r.get("Professor")
        or ""
    ).strip()

    semestre = (
        r.get("semestre")
        or r.get("Semestre")
        or ""
    ).strip()

    aps = (
        r.get("aulas_por_semana")
        or r.get("aulasPorSemana")
        or r.get("ocorrencias_semanais")
        or r.get("quantidade_aulas")
        or 1
    )

    try:
        aps = max(1, int(aps))
    except Exception:
        aps = 1

    return {
        "nome": nome_disc,
        "prof": _prof_display(prof),
        "semestre": semestre,
        "aulas_por_semana": aps,
    }


# --------------------------
# Endpoints de datasets
# --------------------------

@app.get("/dados")
def listar_dados():
    return {"datasets": _listar_datasets()}


@app.get("/dados/{nome}")
def carregar_dados(nome: str):
    disc_path = DADOS_DIR / f"{nome}_disciplinas.csv"
    if not disc_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{nome}' não encontrado (faltando {disc_path.name})"
        )

    disciplinas_raw = _ler_csv(disc_path)
    disciplinas = [_normalizar_disciplina_row(r) for r in disciplinas_raw]

    restricoes: list[dict] = []

    for p in sorted(DADOS_DIR.glob(f"{nome}_*.csv")):
        if p.name.endswith("_disciplinas.csv"):
            continue

        rows = _ler_csv(p)
        restricoes.extend(_inferir_restricoes(rows, p.name))

    return {"nome": nome, "disciplinas": disciplinas, "restricoes": restricoes}


# --------------------------
# Endpoints de restrições por arquivos
# --------------------------

def _listar_arquivos_restricoes_soltas():
    if not DADOS_DIR.exists():
        return []

    arquivos = []
    for p in sorted(DADOS_DIR.glob("*.csv")):
        if p.name.endswith("_disciplinas.csv"):
            continue
        arquivos.append(p.name)
    return arquivos


@app.get("/restricoes/arquivos")
def listar_arquivos_restricoes():
    return {"arquivos": _listar_arquivos_restricoes_soltas()}


@app.post("/restricoes/importar")
def importar_restricoes_por_arquivos(payload: ImportarArquivosEntrada):
    if not payload.arquivos:
        return {"restricoes": []}

    restricoes_total: list[dict] = []

    for nome_arq in payload.arquivos:
        p = (DADOS_DIR / nome_arq).resolve()
        if DADOS_DIR not in p.parents or not p.exists() or not p.is_file():
            raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {nome_arq}")

        rows = _ler_csv(p)
        restrs = _inferir_restricoes(rows, p.name)

        for r in restrs:
            r["origem"] = p.name

        restricoes_total.extend(restrs)

    return {"restricoes": restricoes_total}


# --------------------------
# Upload de CSVs do computador
# --------------------------

@app.post("/upload/disciplinas")
async def upload_disciplinas(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    raw = await file.read()
    texto = raw.decode("utf-8-sig", errors="replace")

    rows = _ler_csv_texto(texto)
    disciplinas = []

    for r in rows:
        d = _normalizar_disciplina_row(r)
        if d["nome"]:
            disciplinas.append(d)

    return {"disciplinas": disciplinas}


@app.post("/upload/restricoes")
async def upload_restricoes(files: List[UploadFile] = File(...)):
    if not files:
        return {"restricoes": []}

    restricoes: list[dict] = []

    for f in files:
        if not (f.filename or "").lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail=f"Arquivo inválido (não é .csv): {f.filename}"
            )

        raw = await f.read()
        texto = raw.decode("utf-8-sig", errors="replace")
        rows = _ler_csv_texto(texto)

        restricoes.extend(_inferir_restricoes(rows, f.filename or "upload.csv"))

    return {"restricoes": restricoes}


# --------------------------
# Geração da grade
# --------------------------

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

            # expande disciplinas conforme aulas_por_semana
            disciplinas_orig = [d.model_dump() for d in dados.disciplinas]

            disciplinas_list = []
            nome_base_por_expandida: Dict[str, str] = {}

            for d in disciplinas_orig:
                nome_base = d["nome"]
                prof = d.get("prof", "")
                semestre = d.get("semestre", "")
                aps = max(1, int(d.get("aulas_por_semana", 1) or 1))

                for i in range(aps):
                    nome_expandido = f"{nome_base} [{i+1}/{aps}]" if aps > 1 else nome_base

                    disciplinas_list.append({
                        "nome": nome_expandido,
                        "prof": prof,
                        "semestre": semestre,
                        "aulas_por_semana": 1,
                    })

                    nome_base_por_expandida[nome_expandido] = nome_base

            def expandir_nome_disciplina(nome: str) -> List[str]:
                if not nome:
                    return []
                encontrados = [n for n, base in nome_base_por_expandida.items() if base == nome]
                return encontrados if encontrados else [nome]

            def expandir_nome_disciplina_por_ocorrencia(nome: str, ocorrencia: Optional[int]) -> List[str]:
                encontrados = expandir_nome_disciplina(nome)
                if not encontrados:
                    return []

                if ocorrencia is None:
                    return encontrados

                idx = int(ocorrencia) - 1
                if 0 <= idx < len(encontrados):
                    return [encontrados[idx]]

                return []

            # monta grafo base
            G = construir_grafo(
                disciplinas_list,
                conflito_por_prof=dados.config.conflito_por_prof,
                conflito_por_semestre=dados.config.conflito_por_semestre
            )

            # processa restrições
            fixos: Dict[str, int] = {}
            pares_mesmo: List[tuple] = []
            pares_nao: List[tuple] = []
            dia_por_disc: Dict[str, str] = {}

            for r in dados.restricoes:
                if r.tipo == "fixo":
                    if r.disciplina and r.bloco is not None:
                        expandidas = expandir_nome_disciplina_por_ocorrencia(
                            r.disciplina,
                            r.ocorrencia
                        )
                        if expandidas:
                            fixos[expandidas[0]] = int(r.bloco)

                elif r.tipo == "dia_fixo":
                    if r.disciplina and r.dia:
                        dn = _norm_dia(r.dia)
                        if dn:
                            for nome_exp in expandir_nome_disciplina(r.disciplina):
                                dia_por_disc[nome_exp] = dn

                elif r.tipo == "nao_coincidir":
                    if r.disciplina1 and r.disciplina2:
                        a_list = expandir_nome_disciplina(r.disciplina1)
                        b_list = expandir_nome_disciplina(r.disciplina2)
                        for a in a_list:
                            for b in b_list:
                                if a != b:
                                    pares_nao.append((a, b))

                elif r.tipo in ("mesmo_bloco", "mesmo_horario"):
                    if r.disciplina1 and r.disciplina2:
                        a_list = expandir_nome_disciplina(r.disciplina1)
                        b_list = expandir_nome_disciplina(r.disciplina2)
                        for a in a_list:
                            for b in b_list:
                                if a != b:
                                    pares_mesmo.append((a, b))

            # aplica "não pode coincidir" como aresta
            for a, b in pares_nao:
                if a in G and b in G:
                    G.add_edge(a, b)

            # valida fixos
            fixos = {d: b for d, b in fixos.items() if d in G}
            fixos = {d: b for d, b in fixos.items() if 0 <= b < num_blocos}

            # dia_fixo -> domínios
            dominios: Dict[str, set] = {}
            idx_dia = indice_blocos_por_dia(horarios)

            for disc, dia_norm in dia_por_disc.items():
                if disc in G and dia_norm in idx_dia:
                    dominios[disc] = set(idx_dia[dia_norm])

            # roda o algoritmo
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

            # estatísticas
            dist = defaultdict(int)
            for _, b in cores.items():
                dist[b] += 1

            usados = sorted(dist.keys())
            desbalanceamento = 0
            if usados:
                desbalanceamento = max(dist[b] for b in usados) - min(dist[b] for b in usados)

            total_disciplinas_base = len(disciplinas_orig)

            total_ocorrencias = sum(
                max(1, int(d.get("aulas_por_semana", 1) or 1))
                for d in disciplinas_orig
            )

            ocorrencias_alocadas = len([
                k for k in cores.keys()
                if k in nome_base_por_expandida
            ])

            disciplinas_base_alocadas = len(set(
                nome_base_por_expandida.get(k, k)
                for k in cores.keys()
                if k in nome_base_por_expandida
            ))

            # nome exibicao
            prof_display = {}
            for d in disciplinas_list:
                prof_display[d["nome"]] = _prof_display(d.get("prof", ""))

            nome_exibicao = {}
            for disc in G.nodes():
                nome_base = nome_base_por_expandida.get(disc, disc)
                prof_txt = prof_display.get(disc, "")
                nome_exibicao[disc] = f"{nome_base} / {prof_txt}" if prof_txt else nome_base

            logs = (tee_out.getvalue() + "\n" + tee_err.getvalue()).strip()

            return {
                "alocacao": cores,
                "horarios": horarios,
                "stats": {
                    "total_blocos": num_blocos,
                    "blocos_usados": len(usados),
                    "desbalanceamento": desbalanceamento,
                    "dist_por_bloco": {str(k): int(v) for k, v in dist.items()},
                    "total_disciplinas_base": total_disciplinas_base,
                    "disciplinas_base_alocadas": disciplinas_base_alocadas,
                    "total_ocorrencias": total_ocorrencias,
                    "ocorrencias_alocadas": ocorrencias_alocadas,
                },
                "nome_exibicao": nome_exibicao,
                "logs": logs,
            }

    except Exception as e:
        logs = (tee_out.getvalue() + "\n" + tee_err.getvalue()).strip()
        msg = str(e)

        detail = ""
        if logs:
            detail += logs + "\n"
        detail += f"\nERRO: {msg}"

        raise HTTPException(status_code=400, detail=detail)

# --------------------------
# Exportação
# --------------------------

@app.post("/exportar-grade")
def exportar_grade(payload: ExportarGradeEntrada) -> Dict[str, Any]:
    try:
        cores = {str(k): int(v) for k, v in payload.alocacao.items()}
        horarios = {int(k): str(v) for k, v in payload.horarios.items()}
        nome_exib = payload.nome_exibicao or {k: k for k in cores.keys()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payload inválido: {e}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = OUT_DIR / f"{payload.prefixo}_{ts}"

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
    path = (OUT_DIR / arquivo).resolve()
    if OUT_DIR not in path.parents or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(path, filename=path.name)

@app.get("/supabase-test")
def supabase_test():
    try:
        res = supabase.table("cursos").select("*").limit(5).execute()
        return {"ok": True, "dados": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))