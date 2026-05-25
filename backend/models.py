from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class GeracaoGrade(Base):
    __tablename__ = "geracoes_grade"

    id = Column(Integer, primary_key=True, index=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    qtd_disciplinas = Column(Integer, default=0)
    qtd_restricoes = Column(Integer, default=0)
    total_blocos = Column(Integer, default=0)
    blocos_usados = Column(Integer, default=0)
    total_ocorrencias = Column(Integer, default=0)
    ocorrencias_alocadas = Column(Integer, default=0)

    sucesso = Column(Boolean, default=True)
    erro = Column(String, nullable=True)

    entrada_json = Column(JSON, nullable=True)
    resultado_json = Column(JSON, nullable=True)
