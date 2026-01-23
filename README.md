# Alocação de Horário (EngComp)

Sistema para montagem/geração de grade de horários usando coloração de grafo (backend FastAPI) e interface web (frontend React/Vite).

## Estrutura
- `backend/` → API FastAPI + lógica (grafo, geração, importação de CSV, exportação)
- `frontend/` → Interface em React/Vite (wizard, restrições, visualização da grade)

## Requisitos
- Python 3.10+ (recomendado)
- Node.js 18+ (recomendado)

## Como rodar (modo desenvolvimento)

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
