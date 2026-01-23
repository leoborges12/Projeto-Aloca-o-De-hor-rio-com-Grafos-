# grafo.py
import re
import math
import networkx as nx
from collections import defaultdict

# ========= Helpers de grupos (Union-Find / DSU) =========

class DSU:
    def __init__(self):
        self.pai = {}

    def find(self, x):
        self.pai.setdefault(x, x)
        if self.pai[x] != x:
            self.pai[x] = self.find(self.pai[x])
        return self.pai[x]

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.pai[rb] = ra


def construir_grupos(nos, pares):
    """
    Constrói grupos (componentes) de nós a partir de pares.
    pares: lista de tuplas (a,b) que DEVEM compartilhar o mesmo bloco.
    Retorna:
      - grupos: dict líder -> set(membros)
      - grupo_por_no: dict no -> líder
    """
    dsu = DSU()
    for n in nos:
        dsu.find(n)  # registra todos
    for a, b in pares:
        if a in dsu.pai and b in dsu.pai:
            dsu.union(a, b)
        else:
            print(f"[AVISO] Par ignorado (nó não existe no grafo): ({a}, {b})")

    tmp = defaultdict(set)
    for n in nos:
        tmp[dsu.find(n)].add(n)

    grupos = {lid: set(mems) for lid, mems in tmp.items()}
    grupo_por_no = {}
    for lid, mems in grupos.items():
        for m in mems:
            grupo_por_no[m] = lid
    return grupos, grupo_por_no


# ========= Construção do grafo =========

def _tokens_prof(s):
    """Quebra professores por | , ; / e normaliza (lower/strip)."""
    return {p.strip().lower() for p in re.split(r"[|,;/]+", str(s)) if p.strip()}

def _norm_semestre(s):
    """Normaliza semestre para comparação (ex.: '1', '2025/1', '2025-2')."""
    return str(s).strip().lower()

def construir_grafo(disciplinas, conflito_por_prof=True, conflito_por_semestre=True):
    """
    Cria o grafo: 1 nó por disciplina.
    Aresta se: (professor em comum) OU (mesmo semestre), conforme flags.
    """
    G = nx.Graph()
    nomes = [d["nome"] for d in disciplinas]
    G.add_nodes_from(nomes)

    for i in range(len(disciplinas)):
        for j in range(i + 1, len(disciplinas)):
            d1, d2 = disciplinas[i], disciplinas[j]
            add_edge = False

            # Conflito por professor
            if conflito_por_prof:
                profs1 = _tokens_prof(d1.get("prof", ""))
                profs2 = _tokens_prof(d2.get("prof", ""))
                if profs1 and profs2 and (profs1 & profs2):
                    add_edge = True

            # Conflito por semestre
            if not add_edge and conflito_por_semestre:
                s1 = _norm_semestre(d1.get("semestre", ""))
                s2 = _norm_semestre(d2.get("semestre", ""))
                if s1 and s2 and s1 == s2:
                    add_edge = True

            if add_edge:
                G.add_edge(d1["nome"], d2["nome"])

    return G


# ========= Coloração balanceada com grupos, fixos e domínios =========

def colorir_grafo_balanceado(
    grafo,
    num_blocos=10,
    fixos=None,
    pares_mesmo_horario=None,
    pares_mesmo_bloco=None,
    dominios_por_no=None,      # dict no -> set(blocos permitidos)
    allow_extra_blocks=False,
    hard_fail=True
):
    if fixos is None:
        fixos = {}
    if pares_mesmo_horario is None:
        pares_mesmo_horario = []
    if pares_mesmo_bloco is None:
        pares_mesmo_bloco = []
    if dominios_por_no is None:
        dominios_por_no = {}

    # --- Valida nós dos fixos ---
    for no in list(fixos.keys()):
        if no not in grafo:
            msg = f"Nó fixo '{no}' não existe no grafo."
            if hard_fail:
                raise ValueError(msg)
            else:
                print("[AVISO]", msg)
                fixos.pop(no, None)

    # --- Grupos "mesmo bloco" ---
    nos = list(grafo.nodes())
    # OBS: pares_mesmo_horario e pares_mesmo_bloco são tratados como "mesmo bloco"
    pares_unificados = list(pares_mesmo_horario) + list(pares_mesmo_bloco)
    grupos, grupo_por_no = construir_grupos(nos, pares_unificados)

    # --- Checagem de conflito intra-grupo (arestas dentro do grupo) ---
    for lid, mems in grupos.items():
        for m in mems:
            for viz in grafo[m]:
                if viz in mems:
                    msg = (f"Grupo {lid} impossível: '{m}' e '{viz}' são do mesmo grupo e são vizinhos.")
                    if hard_fail:
                        raise ValueError(msg)
                    else:
                        print("[AVISO]", msg)

    # --- Domínio por GRUPO = interseção dos domínios dos membros (ou todos os blocos se ninguém tiver domínio) ---
    todos_blocos = set(range(num_blocos))
    dominios_grupo = {}
    for lid, mems in grupos.items():
        doms = []
        for m in mems:
            if m in dominios_por_no:
                doms.append(set(dominios_por_no[m]))
        if doms:
            inter = set.intersection(*doms)
            if not inter:
                msg = f"Domínio vazio no grupo {lid}: interseção de dias/slots ficou vazia."
                if hard_fail:
                    raise ValueError(msg)
                else:
                    print("[AVISO]", msg)
            dominios_grupo[lid] = inter
        else:
            dominios_grupo[lid] = set(todos_blocos)  # sem restrição de dia

    # --- Propaga fixos dentro do grupo e checa compatibilidade com domínio ---
    fixo_por_grupo = {}
    for lid, membros in grupos.items():
        blocos_dos_membros = {fixos[m] for m in membros if m in fixos}
        if len(blocos_dos_membros) > 1:
            msg = f"Conflito de fixos dentro do grupo {lid}: blocos {sorted(blocos_dos_membros)}."
            if hard_fail:
                raise ValueError(msg)
            else:
                print("[AVISO]", msg)
        if len(blocos_dos_membros) == 1:
            bloco = next(iter(blocos_dos_membros))
            # checa se o bloco fixo está no domínio do grupo (dia correto)
            if bloco not in dominios_grupo[lid]:
                msg = f"Fixo incompatível com domínio do grupo {lid}: bloco {bloco} fora do dia permitido."
                if hard_fail:
                    raise ValueError(msg)
                else:
                    print("[AVISO]", msg)
            fixo_por_grupo[lid] = bloco

    # --- Checa conflito entre fixos vizinhos ---
    for a in fixos:
        for b in grafo.neighbors(a):
            if b in fixos and fixos[a] == fixos[b]:
                msg = f"Conflito: '{a}' e '{b}' são vizinhos e estão fixos no mesmo bloco {fixos[a]}."
                if hard_fail:
                    raise ValueError(msg)
                else:
                    print("[AVISO]", msg)

    # --- Estruturas de alocação ---
    cores = {}
    blocos_ocupados = defaultdict(set)
    blocos_contagem = [0] * num_blocos

    # --- Semeia fixos por grupo ---
    for lid, membros in grupos.items():
        if lid in fixo_por_grupo:
            bloco = fixo_por_grupo[lid]
            if bloco >= num_blocos:
                if not allow_extra_blocks:
                    raise ValueError(f"Bloco fixo {bloco} fora do limite num_blocos={num_blocos}.")
                while bloco >= len(blocos_contagem):
                    blocos_contagem.append(0)
            for m in membros:
                cores[m] = bloco
                blocos_ocupados[bloco].add(m)
            blocos_contagem[bloco] += len(membros)

    # --- Ordenação de grupos sem fixo (por “força”, determinística) ---
    def grau_grupo(lid):
        return sum(grafo.degree[n] for n in grupos[lid])

    grupos_nao_fixos = [lid for lid in grupos if lid not in fixo_por_grupo]
    # critério determinístico: grau, tamanho, menor rótulo
    grupos_ordenados = sorted(
        grupos_nao_fixos,
        key=lambda lid: (grau_grupo(lid), len(grupos[lid]), min(grupos[lid])),
        reverse=True
    )

    # --- Meta de equilíbrio ---
    total_nos = grafo.number_of_nodes()
    blocos_alvo = math.ceil(total_nos / num_blocos) if num_blocos > 0 else total_nos

    # --- Função: grupo cabe no bloco sem conflito e respeitando domínio ---
    def grupo_cabe_no_bloco(lid, bloco):
        # respeita domínio do grupo
        if bloco not in dominios_grupo[lid]:
            return False
        mems = grupos[lid]
        for m in mems:
            for viz in grafo[m]:
                if viz in blocos_ocupados[bloco]:
                    return False
        return True

    # --- Alocação por grupos ---
    for lid in grupos_ordenados:
        mems = grupos[lid]
        if any(m in cores for m in mems):
            continue
        alocado = False

        # tenta blocos do DOMÍNIO do grupo em ordem de carga (mais vazios primeiro)
        candidatos = sorted(
            dominios_grupo[lid],
            key=lambda b: blocos_contagem[b] if b < len(blocos_contagem) else 10**9
        )

        # 1) dentro da meta
        for bloco in candidatos:
            if bloco >= num_blocos:
                if not allow_extra_blocks:
                    continue
                while bloco >= len(blocos_contagem):
                    blocos_contagem.append(0)
            if grupo_cabe_no_bloco(lid, bloco) and blocos_contagem[bloco] + len(mems) <= blocos_alvo:
                for m in mems:
                    cores[m] = bloco
                    blocos_ocupados[bloco].add(m)
                blocos_contagem[bloco] += len(mems)
                alocado = True
                break

        # 2) qualquer bloco do domínio
        if not alocado:
            for bloco in candidatos:
                if bloco >= num_blocos and not allow_extra_blocks:
                    continue
                if bloco >= len(blocos_contagem):
                    if allow_extra_blocks:
                        while bloco >= len(blocos_contagem):
                            blocos_contagem.append(0)
                    else:
                        continue
                if grupo_cabe_no_bloco(lid, bloco):
                    for m in mems:
                        cores[m] = bloco
                        blocos_ocupados[bloco].add(m)
                    blocos_contagem[bloco] += len(mems)
                    alocado = True
                    break

        # 3) falhou: DEBUG + erro/aviso
        if not alocado:
            print("\n[DEBUG] Falha ao alocar grupo:", lid, "membros:", sorted(mems))
            print("[DEBUG] Domínio (blocos):", sorted(dominios_grupo[lid]))
            for b in sorted(dominios_grupo[lid]):
                conflitos = set()
                for m in mems:
                    for viz in grafo[m]:
                        if viz in blocos_ocupados.get(b, set()):
                            conflitos.add(viz)
                if conflitos:
                    print(f"[DEBUG]  Bloco {b}: CONFLITO com", ", ".join(sorted(conflitos)))
                else:
                    print(f"[DEBUG]  Bloco {b}: sem conflitos (pode ter falhado por meta/capacidade)")

            msg = f"Sem bloco disponível no domínio (dia) para o grupo {lid}."
            if hard_fail:
                raise RuntimeError(msg)
            else:
                print("[AVISO]", msg)

    return cores
