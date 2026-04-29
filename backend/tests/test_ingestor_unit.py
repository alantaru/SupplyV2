import pytest
import pandas as pd
import os
from tempfile import NamedTemporaryFile
from core.refinery.ingestor import RefineryIngestor

def create_temp_file(content, encoding='utf-8'):
    tmp = NamedTemporaryFile(delete=False, suffix='.csv', mode='w', encoding=encoding)
    tmp.write(content)
    tmp.close()
    return tmp.name

def test_ingestor_delimiter_detection_semicolon():
    content = "Header1;Header2;Header3\nval1;val2;val3\nval4;val5;val6"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert ingestor.delimiter == ";"
        assert len(df.columns) == 3
        assert len(df) == 2
    finally:
        os.unlink(path)

def test_ingestor_delimiter_detection_comma():
    content = "Header1,Header2,Header3\nval1,val2,val3"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert ingestor.delimiter == ","
        assert len(df.columns) == 3
    finally:
        os.unlink(path)

def test_ingestor_delimiter_detection_tab():
    content = "Header1\tHeader2\tHeader3\nval1\tval2\tval3"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert ingestor.delimiter == "\t"
        assert len(df.columns) == 3
    finally:
        os.unlink(path)

def test_ingestor_header_detection_with_noise():
    content = "Title of the file\nGenerated on 2023-01-01\n\nSerie;Modelo;Cidade\nSN123;M1;City1\nSN456;M2;City2"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert "Serie" in df.columns
        assert len(df) == 2
        assert df.iloc[0]["Serie"] == "SN123"
    finally:
        os.unlink(path)

def test_ingestor_boost_logic():
    content = "Noise1;Noise2\nIP_Address;Email_Address\n192.168.1.1;test@example.com"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert "IP_Address" in df.columns
        assert df.iloc[0]["IP_Address"] == "192.168.1.1"
    finally:
        os.unlink(path)

def test_ingestor_empty_file():
    path = create_temp_file("")
    try:
        ingestor = RefineryIngestor(path)
        with pytest.raises(Exception):
            ingestor.ingest()
    finally:
        os.unlink(path)

def test_ingestor_no_header_found():
    content = "aksjdhf;aksjdhf\nzmxncv;qpwoeir"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert len(df.columns) == 2
    finally:
        os.unlink(path)

def test_ingestor_deep_scan_boost():
    content = "Random;Fields\nData;Valor\n20/03/2024;R$ 1.200,50"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        cols = [c.lower() for c in df.columns]
        assert "data" in cols
        assert "valor" in cols
    finally:
        os.unlink(path)

def test_ingestor_encoding_latin1():
    content = "Série;Descrição;Preço\nSN123;Aparelho;100"
    # Create file with Latin-1 encoding
    tmp = NamedTemporaryFile(delete=False, suffix='.csv', mode='wb')
    tmp.write(content.encode('latin1'))
    tmp.close()
    path = tmp.name
    try:
        ingestor = RefineryIngestor(path)
        df = ingestor.ingest()
        assert "Série" in df.columns
        # cp1252 is detected instead of latin1 because the file has high bytes
        # (cp1252 is a superset of latin1 and is the correct choice for PT-BR Windows files)
        assert ingestor.encoding in ("latin1", "cp1252")
    finally:
        os.unlink(path)

def test_ingestor_invalid_path():
    ingestor = RefineryIngestor("non_existent_file.csv")
    with pytest.raises(ValueError):
        ingestor.ingest()

def test_ingestor_pandas_failure():
    # To trigger line 249: Pandas ingestion failed
    # We can use a file that causes read_csv to explode even with on_bad_lines='skip'
    # Actually, if we use a broken file and force header to something impossible?
    # Or just mock pd.read_csv
    from unittest.mock import patch
    content = "a;b;c\n1;2;3"
    path = create_temp_file(content)
    try:
        ingestor = RefineryIngestor(path)
        with patch('pandas.read_csv') as mocked:
            mocked.side_effect = Exception("Pandas error")
            with pytest.raises(Exception):
                ingestor.ingest()
    finally:
        os.unlink(path)
