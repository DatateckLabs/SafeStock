#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.models.user_profile import UserProfile
from app.models.parametro_global import ParametroGlobal

PARAMS_DEFAULT = [
    ("subgrupos_insumos",         "ETIQUETA,RIBBON",       "Subgrupos do BQ monitorados pelo Módulo 1"),
    ("janela_consumo_dias",       "90",                    "Janela histórica para cálculo de consumo de ferramentas (dias)"),
    ("fator_k_alta",              "2.05",                  "Fator K para ferramentas de criticidade ALTA (99% nível de serviço)"),
    ("fator_k_media",             "1.65",                  "Fator K para ferramentas de criticidade MÉDIA (95%)"),
    ("fator_k_baixa",             "1.28",                  "Fator K para ferramentas de criticidade BAIXA (90%)"),
    ("threshold_inatividade",     "10",                    "Volume mínimo de consumo para gerar OC (abaixo disso = item inativo)"),
    ("email_destino_oc",          "",                      "E-mail de destino para envio das OCs geradas"),
    ("smtp_host",                 "",                      "Servidor SMTP para envio de e-mails"),
    ("smtp_port",                 "587",                   "Porta SMTP"),
    ("smtp_user",                 "",                      "Usuário SMTP"),
    ("layout_erp_versao",         "v1",                    "Versão do layout do CSV de OC"),
]

db = SessionLocal()
try:
    # Seed admin UserProfile
    if not db.query(UserProfile).filter(UserProfile.username == "admin").first():
        db.add(UserProfile(username="admin", role="admin", is_active=True))
        print("[seed] UserProfile admin criado.")
    else:
        print("[seed] UserProfile admin já existe.")

    # Seed ParametroGlobal
    for chave, valor, descricao in PARAMS_DEFAULT:
        if not db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first():
            db.add(ParametroGlobal(chave=chave, valor=valor, descricao=descricao))
            print(f"[seed] Parâmetro '{chave}' criado.")

    db.commit()
    print("[seed] Concluído.")
finally:
    db.close()
