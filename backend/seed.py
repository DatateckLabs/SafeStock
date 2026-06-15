#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.models.user_profile import UserProfile
from app.models.parametro_global import ParametroGlobal

PARAMS_DEFAULT = [
    ("subgrupos_insumos",     "ETIQUETA,RIBBON", "Subgrupos do BQ monitorados pelo Módulo 1"),
    ("threshold_inatividade", "10",              "Volume mínimo de consumo para gerar OC (abaixo disso = item inativo)"),
    ("cobertura_meses_padrao","2",               "Cobertura de segurança padrão em meses (usado quando fornecedor não tem ConfigFornecedor)"),
    ("email_destino_oc",      "",                "E-mail de destino para envio das OCs geradas"),
    ("smtp_host",             "",                "Servidor SMTP para envio de e-mails"),
    ("smtp_port",             "587",             "Porta SMTP"),
    ("smtp_user",             "",                "Usuário SMTP"),
    # Disparo semanal
    ("email_operacional",     "",                "E-mail do operador que recebe o Excel para importar no ERP"),
    ("email_gestor",          "",                "E-mail do gestor que recebe o dashboard executivo semanal"),
    ("cron_dia_semana",       "mon",             "Dia da semana para disparo automático (mon/tue/wed/thu/fri/sat/sun)"),
    ("cron_hora",             "08:00",           "Hora do disparo automático no formato HH:MM"),
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
