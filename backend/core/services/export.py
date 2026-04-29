import pandas as pd
from io import BytesIO
try:
    from .protocol import ProtocolService
    from .stock import StockService
    from .route import RouteService
    from .equipment import EquipmentService
    from ... import database
except (ImportError, ValueError):
    try:
        from protocol import ProtocolService
        from stock import StockService
        from route import RouteService
        from equipment import EquipmentService
        import database
    except (ImportError, ValueError):
        pass

# ─── Mapeamento de nomes amigáveis (renomeia sem descartar) ───────────────────
FRIENDLY_NAMES = {
    # Protocolo / Entrega
    'Protocolo': 'Nº Pedido',
    'Serie': 'Número de Série',
    'Modelo': 'Modelo',
    'Fila': 'Fila / Hostname',
    'Solicitacao': 'Canal de Solicitação',
    'Status': 'Status',
    'Empresa': 'Empresa / Unidade',
    'PlantaInstalada': 'Planta Instalada',
    'Cidade': 'Cidade',
    'Contrato': 'Contrato',
    'Horario': 'Horário',
    'ContatoSetor': 'Contato do Setor',
    'LocalInstalacao': 'Local de Instalação',
    'RuaRef': 'Rua / Referência',
    'Area': 'Área / Setor',
    'ContadorInicial': 'Contador Inicial',
    'ContadorFinal': 'Contador Final',
    'Producao': 'Produção (folhas)',
    'ProducaoResmas': 'Produção (resmas)',
    'A4': 'Papel A4 (resmas)',
    'A3': 'Papel A3 (resmas)',
    'TonerPreto': 'Toner Preto (BK)',
    'TonerCiano': 'Toner Ciano (CY)',
    'TonerAmarelo': 'Toner Amarelo (YW)',
    'TonerMagenta': 'Toner Magenta (MG)',
    'Data': 'Data do Pedido',
    'DataEntrega': 'Data de Entrega',
    'Solicitante': 'Solicitante',
    'Ramal': 'Ramal',
    'Obs': 'Observações',
    'IncidenteRds': 'Nº do Chamado',
    'Emprestimo': 'Empréstimo',
    'EmprestadoDoContrato': 'Origem / Destino',
    'AnaliseFV': 'Análise Física/Visual',
    'Recolha': 'Recolher Equipamento',
    'ComDefeito': 'Com Defeito',
    'StatusEmprestimo': 'Status Empréstimo',
    'RecebidoPor': 'Recebido Por',
    'Funcionario': 'Funcionário',
    'Cancelado': 'Cancelado',
    'A4Entregue': 'A4 Entregue',
    'Competencia': 'Competência',
    'Almoxarifado': 'Almoxarifado',
    'PorcentagemBK': '% Toner BK (no pedido)',
    'PorcentagemCY': '% Toner CY (no pedido)',
    'PorcentagemMG': '% Toner MG (no pedido)',
    'PorcentagemYW': '% Toner YW (no pedido)',
    'IP': 'Endereço IP',
    'StatusEquipamento': 'Status do Equipamento',
    'Marca': 'Marca',
    'UF': 'UF',
    'CentroCusto': 'Centro de Custo',
    'Gerencia': 'Gerência',
    # Estoque
    'TipoModelo': 'Item / Modelo',
    'Codigo': 'Código',
    'EstoqueAtual': 'Estoque Atual',
    'UltimaAlteracao': 'Última Alteração',
    'Cor': 'Cor',
    'Categoria': 'Categoria',
    'ModeloEquipamento': 'Modelo do Equipamento',
    'TipoToner': 'Tipo de Toner',
    # Lançamentos
    'DataLancamento': 'Data',
    'TipoMaterial': 'Tipo de Movimento',
    'TipoLancamento': 'Ação',
    'Quantidade': 'Quantidade',
    'ProtocoloOUPedido': 'Referência',
    'FilaImpressao': 'Fila',
    'Colaborador': 'Usuário',
    # Rotas
    'name': 'Rota',
    'last_delivery': 'Última Entrega',
    'series_count': 'Qtd Equipamentos',
    'days_elapsed': 'Dias Corridos',
    'status': 'Status',
    'data_agendada': 'Data Agendada',
    'notes': 'Notas',
    # Análise de rota
    'Local': 'Local',
    'Contador_Atual': 'Contador Atual',
    'Estoque_Estimado': 'Estoque Estimado (folhas)',
    'Sugestao_A4': 'Sugestão A4',
    'Status_Calculado': 'Status Calculado',
    'TonerLevel_BK': '% Toner BK',
    'TonerLevel_CY': '% Toner CY',
    'TonerLevel_MG': '% Toner MG',
    'TonerLevel_YW': '% Toner YW',
    'Ultima_Entrega_A4': 'Última Entrega A4',
    'Media_Mensal': 'Média Mensal (folhas)',
    'Toner_Alerts': 'Alertas de Toner',
    # Equipamentos (MAPA)
    'ModeloSimpress': 'Modelo',
    'STATUS': 'Status',
    'toner_bk': '% Toner BK',
    'toner_cy': '% Toner CY',
    'toner_mg': '% Toner MG',
    'toner_yw': '% Toner YW',
    'toner_bk_pct': '% Toner BK',
    'toner_cy_pct': '% Toner CY',
    'toner_mg_pct': '% Toner MG',
    'toner_yw_pct': '% Toner YW',
}


class ExportService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id
        self.protocol_service = ProtocolService(contract_id)
        self.stock_service = StockService(contract_id)
        self.route_service = RouteService(contract_id)
        self.equipment_service = EquipmentService(contract_id)

    def _generate_csv(self, df: pd.DataFrame) -> BytesIO:
        """Gera CSV com BOM UTF-8 e separador ponto-e-vírgula (padrão Excel Brasil)."""
        buffer = BytesIO()
        buffer.write(b'\xef\xbb\xbf')
        content = df.to_csv(index=False, sep=';', encoding='utf-8', quoting=1, lineterminator='\r\n')
        buffer.write(content.encode('utf-8'))
        buffer.seek(0)
        return buffer

    def _rename_friendly(self, df: pd.DataFrame) -> pd.DataFrame:
        """Renomeia colunas para nomes amigáveis sem descartar nenhuma."""
        rename = {col: FRIENDLY_NAMES.get(col, col) for col in df.columns}
        return df.rename(columns=rename)

    def _drop_internal_cols(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove colunas puramente internas que não têm valor para o usuário."""
        internal = {'Serie_Norm', 'Protocolo_Num', 'DataEntrega_Dt', 'DataEntrega_Dt_x', 'DataEntrega_Dt_y'}
        cols_to_drop = [c for c in df.columns if c in internal or c.endswith('_Norm') or c.endswith('_fleet') or c.endswith('_papel')]
        return df.drop(columns=cols_to_drop, errors='ignore')

    # ─── 1. Pendências ────────────────────────────────────────────────────────
    def export_pendencias(self, contract_id: str):
        """Exporta TODOS os campos dos pedidos pendentes."""
        protocols = self.protocol_service.get_pending(limit=100000)
        if not protocols:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(protocols)
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)

    # ─── 2. Histórico de Entregas ─────────────────────────────────────────────
    def export_deliveries(self, contract_id: str, filters: dict = None):
        """Exporta TODOS os campos do histórico com filtros aplicados."""
        if filters is None:
            filters = {}
        filters['status'] = filters.get('status', 'all')
        pkgs = self.protocol_service.get_pending(limit=100000, filters=filters)
        if not pkgs:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(pkgs)
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)

    # ─── 3. Inventário de Equipamentos ───────────────────────────────────────
    def export_inventory(self, contract_id: str):
        """Exporta o MAPA completo com todos os campos + dados de toner."""
        try:
            # Carrega o MAPA diretamente do storage para ter TODAS as colunas
            df_mapa = database.load_mapa(contract_id)
            if df_mapa.empty:
                return self._generate_csv(pd.DataFrame())

            # Normaliza via adapters para nomes canônicos
            try:
                from .. import adapters
            except (ImportError, ValueError):
                from core import adapters

            df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))

            # Enriquece com dados de toner do Contadores
            try:
                df_cnt = database.load_contadores(contract_id)
                if not df_cnt.empty:
                    df_cnt_norm = pd.DataFrame(adapters.normalize_dataframe(df_cnt))
                    if 'Serie' in df_cnt_norm.columns and 'Serie' in df_mapa.columns:
                        df_mapa['_serie_key'] = df_mapa['Serie'].apply(adapters.normalize_serie)
                        df_cnt_norm['_serie_key'] = df_cnt_norm['Serie'].apply(adapters.normalize_serie)
                        toner_cols = [c for c in df_cnt_norm.columns if 'toner' in c.lower() or c in ('%BK', '%CY', '%Mg', '%Yw', 'BK', 'CY', 'MG', 'YW')]
                        if toner_cols:
                            merge_cols = ['_serie_key'] + toner_cols
                            df_cnt_slim = df_cnt_norm[merge_cols].drop_duplicates('_serie_key')
                            df_mapa = df_mapa.merge(df_cnt_slim, on='_serie_key', how='left', suffixes=('', '_cnt'))
                        df_mapa = df_mapa.drop(columns=['_serie_key'], errors='ignore')
            except Exception:
                pass

            df_mapa = self._drop_internal_cols(df_mapa)
            df_mapa = self._rename_friendly(df_mapa)
            return self._generate_csv(df_mapa)

        except Exception:
            # Fallback para get_all() se algo falhar
            equipment = self.equipment_service.get_all()
            if not equipment:
                return self._generate_csv(pd.DataFrame())
            df = pd.DataFrame(equipment)
            df = self._drop_internal_cols(df)
            df = self._rename_friendly(df)
            return self._generate_csv(df)

    # ─── 4. Estoque — Posição Atual ───────────────────────────────────────────
    def export_stock_levels(self, contract_id: str):
        """Exporta TODOS os campos da posição atual do estoque."""
        levels = self.stock_service.get_levels()
        if not levels:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(levels)
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)

    # ─── 5. Estoque — Movimentações ───────────────────────────────────────────
    def export_stock_history(self, contract_id: str):
        """Exporta TODOS os campos do histórico de movimentações."""
        history = self.stock_service.get_history()
        if not history:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(history)
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)

    # ─── 6. Planejamento de Rotas ─────────────────────────────────────────────
    def export_route_planning(self, contract_id: str):
        """Exporta o resumo completo do planejamento de rotas."""
        routes = self.route_service.get_planning_summary()
        if not routes:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(routes)
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)

    # ─── 7. Análise de Rota ───────────────────────────────────────────────────
    def export_route_analysis(self, contract_id: str, series_list: list):
        """Exporta a análise completa de uma rota com todos os campos calculados."""
        analysis = self.route_service.analyze_route(series_list)
        if not analysis:
            return self._generate_csv(pd.DataFrame())
        df = pd.DataFrame(analysis)
        # Remove colunas de sufixo interno do merge
        df = self._drop_internal_cols(df)
        df = self._rename_friendly(df)
        return self._generate_csv(df)
