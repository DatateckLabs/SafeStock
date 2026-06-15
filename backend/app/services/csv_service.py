import csv
import io
import math
import re
from datetime import date


def _sanitize_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)[:40]


def gerar_csv_oc(itens: list[dict], fornecedor: str, tipo: str) -> tuple[str, bytes]:
    data_str = date.today().strftime("%Y%m%d")
    fornecedor_safe = _sanitize_filename(fornecedor)
    filename = f"OC_{tipo.upper()}_{fornecedor_safe}_{data_str}.csv"

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["CPD", "DESCRICAO", "QUANTIDADE", "UNIDADE", "FORNECEDOR", "OBSERVACAO"])

    for item in itens:
        writer.writerow([
            item.get("cpd", ""),
            item.get("descricao", ""),
            item.get("quantidade", ""),
            item.get("unidade", ""),
            item.get("fornecedor", ""),
            item.get("observacao", ""),
        ])

    # UTF-8-BOM para compatibilidade Excel
    content = b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
    return filename, content


def calcular_quantidade_oc(
    estoque_atual: float,
    estoque_maximo: float,
    moq: float,
    mpq: float,
    quantidade_pendente_oc: float,
) -> float:
    qtd_base = max(estoque_maximo - estoque_atual, moq if moq > 0 else 1)
    qtd = qtd_base - quantidade_pendente_oc

    if qtd <= 0:
        return 0.0

    if mpq > 0:
        qtd = math.ceil(qtd / mpq) * mpq

    return round(qtd, 2)
