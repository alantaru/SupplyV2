"""
Módulo de Testes: Refinery Ingestor (backend.core.refinery.ingestor)
Descrição: Testes para detecção de encoding, delimitadores e busca de cabeçalho.
Cobertura: RefineryIngestor class (header_hunt, sniff_delimiter, encoding)
Idioma: PT-BR
"""
import pytest
from backend.core.refinery.ingestor import RefineryIngestor

@pytest.mark.unit
def test_sniff_delimiter_semicolon(tmp_path):
    """
    Cenário: CSV com ponto e vírgula.
    Ação: Ingerir arquivo.
    Resultado: Delimitador ';' detectado.
    """
    p = tmp_path / "semi.csv"
    p.write_text("Col1;Col2;Col3\nVal1;Val2;Val3", encoding="utf-8")
    
    ingestor = RefineryIngestor(str(p))
    df = ingestor.ingest()
    
    assert ingestor.delimiter == ";"
    assert len(df.columns) == 3

@pytest.mark.unit
def test_sniff_delimiter_comma(tmp_path):
    """
    Cenário: CSV com vírgula.
    Ação: Ingerir arquivo.
    Resultado: Delimitador ',' detectado.
    """
    p = tmp_path / "comma.csv"
    p.write_text("Col1,Col2,Col3\nVal1,Val2,Val3\nValA,ValB,ValC", encoding="utf-8")
    
    ingestor = RefineryIngestor(str(p))
    df = ingestor.ingest()
    
    assert ingestor.delimiter == ","
    assert "Col1" in df.columns

@pytest.mark.unit
def test_header_hunt_garbage_lines(tmp_path):
    """
    Cenário: Arquivo com lixo nas primeiras linhas.
    Ação: Ingerir.
    Resultado: Header deve ser encontrado na linha correta.
    """
    content = """Lixo do sistema
    Relatório Gerado em 2026
    ------------------------
    serie;modelo;contador
    123;HP;1000
    """.strip()
    
    p = tmp_path / "garbage.csv"
    p.write_text(content, encoding="utf-8")
    
    ingestor = RefineryIngestor(str(p))
    df = ingestor.ingest()
    
    # O header hunt deve ignorar as 3 primeiras linhas
    assert "serie" in df.columns or "modelo" in df.columns
    assert len(df) == 1
    assert df.iloc[0]["modelo"] == "HP"

@pytest.mark.unit
def test_encoding_latin1(tmp_path):
    """
    Cenário: Arquivo em ANSI/Latin-1.
    Ação: Ingerir.
    Resultado: Encoding detectado e conteúdo legível.
    """
    p = tmp_path / "latin.csv"
    # Endereço com 'ç' e 'ã' em latin-1
    content = "Endereço;Descrição\nPraça da Sé;Ação"
    with open(p, "w", encoding="latin-1") as f:
        f.write(content)
        
    ingestor = RefineryIngestor(str(p))
    df = ingestor.ingest()
    
    assert ingestor.encoding == "latin1"
    assert df.iloc[0]["Endereço"] == "Praça da Sé"

@pytest.mark.unit
def test_deep_scan_boost(tmp_path):
    """
    Cenário: Header ambíguo, mas dados com padrões fortes (IP, Email, Money).
    Ação: Utilizar deep scan.
    Resultado: Boost de score deve escolher a linha correta.
    """
    # Linha 0 parece header mas não é (apenas texto)
    # Linha 1 é header real
    # Linha 2 tem dados ricos (R$, IP)
    content = """
    Relatorio Diario de Vendas - Confidencial
    Produto;Preco;IP_Origem
    Impressora;R$ 1.200,00;192.168.0.1
    Toner;R$ 50,00;10.0.0.1
    """.strip()
    
    p = tmp_path / "deep.csv"
    p.write_text(content, encoding="utf-8")
    
    ingestor = RefineryIngestor(str(p))
    ingestor.load_raw()
    
    # Mock manual lines split to verify score mechanic specifically if needed, 
    # but e2e usage of ingest() is better.
    df = ingestor.ingest()
    
    assert "Preco" in df.columns
    assert len(df) == 2

@pytest.mark.unit
def test_empty_file_fails(tmp_path):
    p = tmp_path / "empty.csv"
    p.touch()
    
    ingestor = RefineryIngestor(str(p))
    with pytest.raises(Exception): # ValueError or similar from sniff logic getting empty list
        ingestor.ingest()
