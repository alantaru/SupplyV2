"""
BIService — Executive BI Dashboard analytics engine.
Loads all 6 CSVs and computes all analytics sections.
"""
from __future__ import annotations

import pandas as pd
from datetime import datetime, date
from typing import Optional

try:
    from ... import database
    from .. import adapters
except (ImportError, ValueError):
    try:
        import database
        from core import adapters
    except (ImportError, ValueError):
        import database
        import adapters

SLA_WINDOW = 3          # days
TONER_ALERT_THRESHOLD = 20.0  # percent


class BIService:
    def __init__(self, contract_id: str):
        self.contract_id = str(contract_id)

    # ─── Public entry point ──────────────────────────────────────────────────

    def compute(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
        """Load all CSVs, apply filters, compute all sections, return full response."""

        # Load all 6 CSVs (graceful empty on missing)
        df_entregas = self._load("entregas")
        df_mapa = self._load("mapa")
        df_contadores = self._load("contadores")
        df_papel = self._load("papel")
        df_estoque = self._load("estoque")
        df_lancamentos = self._load("estoque_lancamentos")

        # Apply date filter to entregas
        df_entregas_filtered = self._apply_date_filter(df_entregas, start_date, end_date)

        # Exclude cancelled from delivery metrics
        df_active = self._exclude_cancelled(df_entregas_filtered)

        return {
            "delivery": self._compute_delivery(df_entregas_filtered, df_active),
            "supply": self._compute_supply(df_active),
            "equipment": self._compute_equipment(df_mapa, df_contadores, df_active),
            "stock": self._compute_stock(df_estoque, df_lancamentos),
            "operational": self._compute_operational(df_active),
            "predictive": self._compute_predictive(df_contadores, df_papel, df_active),
            "meta": {
                "contract_id": self.contract_id,
                "start_date": start_date,
                "end_date": end_date,
                "generated_at": datetime.now(tz=__import__('datetime').timezone.utc).isoformat(),
            },
        }

    # ─── CSV loaders ─────────────────────────────────────────────────────────

    def _load(self, name: str) -> pd.DataFrame:
        """Load a CSV by name, normalize it, return empty DataFrame on any error."""
        loaders = {
            "entregas": database.load_entregas,
            "mapa": database.load_mapa,
            "contadores": database.load_contadores,
            "papel": database.load_papel,
            "estoque": database.load_estoque,
            "estoque_lancamentos": database.load_estoque_lancamentos,
        }
        try:
            raw = loaders[name](self.contract_id)
            if raw is None or raw.empty:
                return pd.DataFrame()
            records = adapters.normalize_dataframe(raw)
            return pd.DataFrame(records) if records else pd.DataFrame()
        except Exception:
            return pd.DataFrame()

    # ─── Filters ─────────────────────────────────────────────────────────────

    def _apply_date_filter(self, df: pd.DataFrame, start_date: Optional[str], end_date: Optional[str]) -> pd.DataFrame:
        if df.empty or (not start_date and not end_date):
            return df
        dates = pd.to_datetime(df.get("DataEntrega", pd.Series(dtype=str)), dayfirst=True, errors="coerce")
        data_col = pd.to_datetime(df.get("Data", pd.Series(dtype=str)), dayfirst=True, errors="coerce")
        effective_date = dates.fillna(data_col)
        mask = pd.Series(True, index=df.index)
        if start_date:
            mask &= effective_date >= pd.to_datetime(start_date)
        if end_date:
            mask &= effective_date <= pd.to_datetime(end_date)
        return df[mask]

    def _exclude_cancelled(self, df: pd.DataFrame) -> pd.DataFrame:
        if "Cancelado" not in df.columns:
            return df
        return df[df["Cancelado"].astype(str).str.upper().str.strip() != "SIM"]

    # ─── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _safe_int(val) -> int:
        try:
            v = float(str(val).replace(",", "."))
            return int(v) if not pd.isna(v) else 0
        except Exception:
            return 0

    @staticmethod
    def _col_sum(df: pd.DataFrame, col: str) -> int:
        if col not in df.columns or df.empty:
            return 0
        return int(pd.to_numeric(df[col], errors="coerce").fillna(0).sum())

    @staticmethod
    def _top_n(series: pd.Series, n: int = 10) -> list:
        return series.nlargest(n).reset_index().rename(columns={"index": "name", 0: "value"}).to_dict("records")

    @staticmethod
    def _value_counts_list(series: pd.Series, n: int = None) -> list:
        vc = series.dropna().astype(str).str.strip()
        vc = vc[vc != ""].value_counts()
        if n:
            vc = vc.head(n)
        return [{"name": k, "value": int(v)} for k, v in vc.items()]


    # ─── Delivery section ────────────────────────────────────────────────────

    def _compute_delivery(self, df_all: pd.DataFrame, df_active: pd.DataFrame) -> dict:
        """Compute all delivery metrics. df_all includes cancelled; df_active excludes them."""
        if df_active.empty and df_all.empty:
            return self._empty_delivery()

        total = len(df_active)
        total_all = len(df_all)

        # Cancellation rate uses ALL records (including cancelled)
        cancelled_count = 0
        if not df_all.empty and "Cancelado" in df_all.columns:
            cancelled_count = int((df_all["Cancelado"].astype(str).str.upper().str.strip() == "SIM").sum())
        cancellation_rate = round(cancelled_count / total_all * 100, 2) if total_all > 0 else 0.0

        # Pending vs delivered (from active records)
        delivered_count = 0
        pending_count = 0
        if not df_active.empty and "DataEntrega" in df_active.columns:
            has_delivery = df_active["DataEntrega"].astype(str).str.strip().replace("", pd.NA).notna()
            delivered_count = int(has_delivery.sum())
            pending_count = total - delivered_count

        # Avg delivery days
        avg_delivery_days = 0.0
        if not df_active.empty and "DataEntrega" in df_active.columns and "Data" in df_active.columns:
            d_data = pd.to_datetime(df_active["Data"], dayfirst=True, errors="coerce")
            d_entrega = pd.to_datetime(df_active["DataEntrega"], dayfirst=True, errors="coerce")
            days = (d_entrega - d_data).dt.days
            valid = days.dropna()
            if len(valid) > 0:
                avg_delivery_days = round(float(valid.mean()), 2)

        # Time series
        by_month = self._time_series_month(df_active)
        by_week = self._time_series_week(df_active)

        # Breakdowns
        def breakdown(col, n=None):
            if col not in df_active.columns:
                return []
            return self._value_counts_list(df_active[col], n)

        return {
            "total_entregas": total,
            "cancellation_rate": cancellation_rate,
            "avg_delivery_days": avg_delivery_days,
            "pending_count": pending_count,
            "delivered_count": delivered_count,
            "by_month": by_month,
            "by_week": by_week,
            "by_channel": breakdown("Solicitacao"),
            "by_city": breakdown("Cidade"),
            "by_empresa": breakdown("Empresa", 10),
            "by_model": breakdown("Modelo", 10),
            "by_solicitante": breakdown("Solicitante", 10),
            "by_area": breakdown("Area", 10),
            "by_competencia": breakdown("Competencia"),
            "by_contrato": breakdown("Contrato"),
            "pending_vs_delivered": {
                "pending": pending_count,
                "delivered": delivered_count,
                "cancelled": cancelled_count,
            },
        }

    def _empty_delivery(self) -> dict:
        return {
            "total_entregas": 0, "cancellation_rate": 0.0, "avg_delivery_days": 0.0,
            "pending_count": 0, "delivered_count": 0,
            "by_month": [], "by_week": [], "by_channel": [], "by_city": [],
            "by_empresa": [], "by_model": [], "by_solicitante": [], "by_area": [],
            "by_competencia": [], "by_contrato": [],
            "pending_vs_delivered": {"pending": 0, "delivered": 0, "cancelled": 0},
        }

    def _time_series_month(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []
        date_col = self._effective_date_series(df)
        if date_col is None:
            return []
        periods = date_col.dropna().dt.to_period("M").astype(str)
        vc = periods.value_counts().sort_index()
        return [{"period": k, "count": int(v)} for k, v in vc.items()]

    def _time_series_week(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []
        date_col = self._effective_date_series(df)
        if date_col is None:
            return []
        periods = date_col.dropna().dt.to_period("W").astype(str)
        vc = periods.value_counts().sort_index()
        return [{"period": k, "count": int(v)} for k, v in vc.items()]

    def _effective_date_series(self, df: pd.DataFrame) -> Optional[pd.Series]:
        if "DataEntrega" in df.columns:
            dates = pd.to_datetime(df["DataEntrega"], dayfirst=True, errors="coerce")
        else:
            dates = pd.Series(pd.NaT, index=df.index)
        if "Data" in df.columns:
            data_col = pd.to_datetime(df["Data"], dayfirst=True, errors="coerce")
            dates = dates.fillna(data_col)
        if dates.isna().all():
            return None
        return dates


    # ─── Supply section ──────────────────────────────────────────────────────

    def _compute_supply(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return self._empty_supply()

        total_a4 = self._col_sum(df, "A4")
        total_a3 = self._col_sum(df, "A3")
        total_bk = self._col_sum(df, "TonerPreto")
        total_cy = self._col_sum(df, "TonerCiano")
        total_mg = self._col_sum(df, "TonerMagenta")
        total_yw = self._col_sum(df, "TonerAmarelo")

        # Avg A4 per delivery (only deliveries with A4 > 0)
        if "A4" in df.columns:
            a4_series = pd.to_numeric(df["A4"], errors="coerce").fillna(0)
            deliveries_with_a4 = int((a4_series > 0).sum())
            avg_a4 = round(total_a4 / deliveries_with_a4, 2) if deliveries_with_a4 > 0 else 0.0
        else:
            deliveries_with_a4 = 0
            avg_a4 = 0.0

        # Consumption by month
        consumption_by_month = self._supply_by_month(df)

        # Top equipment by A4
        top_a4 = self._top_equipment_supply(df, "A4", "total_a4")
        top_toner = self._top_equipment_toner(df)
        top_locations = self._top_locations_a4(df)

        # Paper vs toner mix
        mix = self._paper_toner_mix(df)

        return {
            "total_a4": total_a4,
            "total_a3": total_a3,
            "total_toner_bk": total_bk,
            "total_toner_cy": total_cy,
            "total_toner_mg": total_mg,
            "total_toner_yw": total_yw,
            "avg_a4_per_delivery": avg_a4,
            "consumption_by_month": consumption_by_month,
            "top_equipment_a4": top_a4,
            "top_equipment_toner": top_toner,
            "top_locations_a4": top_locations,
            "paper_vs_toner_mix": mix,
        }

    def _empty_supply(self) -> dict:
        return {
            "total_a4": 0, "total_a3": 0,
            "total_toner_bk": 0, "total_toner_cy": 0, "total_toner_mg": 0, "total_toner_yw": 0,
            "avg_a4_per_delivery": 0.0,
            "consumption_by_month": [],
            "top_equipment_a4": [], "top_equipment_toner": [], "top_locations_a4": [],
            "paper_vs_toner_mix": {"paper_only": 0, "toner_only": 0, "both": 0, "neither": 0},
        }

    def _supply_by_month(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []
        date_col = self._effective_date_series(df)
        if date_col is None:
            return []
        tmp = df.copy()
        tmp["_period"] = date_col.dt.to_period("M").astype(str)
        a4 = pd.to_numeric(tmp.get("A4", 0), errors="coerce").fillna(0)
        toner_cols = [c for c in ["TonerPreto", "TonerCiano", "TonerMagenta", "TonerAmarelo"] if c in tmp.columns]
        toner_total = sum(pd.to_numeric(tmp[c], errors="coerce").fillna(0) for c in toner_cols) if toner_cols else pd.Series(0, index=tmp.index)
        tmp["_a4"] = a4
        tmp["_toner"] = toner_total
        grouped = tmp.groupby("_period").agg(a4=("_a4", "sum"), toner=("_toner", "sum")).reset_index()
        grouped = grouped.sort_values("_period")
        return [{"period": row["_period"], "a4": int(row["a4"]), "toner": int(row["toner"])} for _, row in grouped.iterrows()]

    def _top_equipment_supply(self, df: pd.DataFrame, col: str, out_key: str, n: int = 10) -> list:
        if df.empty or col not in df.columns:
            return []
        tmp = df.copy()
        tmp["_val"] = pd.to_numeric(tmp[col], errors="coerce").fillna(0)
        serie_col = "Serie" if "Serie" in tmp.columns else None
        fila_col = "Fila" if "Fila" in tmp.columns else None
        if not serie_col:
            return []
        group_cols = [c for c in [serie_col, fila_col] if c]
        agg = tmp.groupby(group_cols)["_val"].sum().reset_index()
        agg = agg.sort_values("_val", ascending=False).head(n)
        result = []
        for _, row in agg.iterrows():
            entry = {"serie": str(row.get("Serie", "")), out_key: int(row["_val"])}
            if fila_col:
                entry["fila"] = str(row.get("Fila", ""))
            result.append(entry)
        return result

    def _top_equipment_toner(self, df: pd.DataFrame, n: int = 10) -> list:
        if df.empty:
            return []
        tmp = df.copy()
        toner_cols = [c for c in ["TonerPreto", "TonerCiano", "TonerMagenta", "TonerAmarelo"] if c in tmp.columns]
        if not toner_cols:
            return []
        tmp["_toner"] = sum(pd.to_numeric(tmp[c], errors="coerce").fillna(0) for c in toner_cols)
        if "Serie" not in tmp.columns:
            return []
        group_cols = [c for c in ["Serie", "Fila"] if c in tmp.columns]
        agg = tmp.groupby(group_cols)["_toner"].sum().reset_index()
        agg = agg.sort_values("_toner", ascending=False).head(n)
        result = []
        for _, row in agg.iterrows():
            entry = {"serie": str(row.get("Serie", "")), "total_toner": int(row["_toner"])}
            if "Fila" in row:
                entry["fila"] = str(row.get("Fila", ""))
            result.append(entry)
        return result

    def _top_locations_a4(self, df: pd.DataFrame, n: int = 10) -> list:
        if df.empty or "A4" not in df.columns:
            return []
        tmp = df.copy()
        tmp["_a4"] = pd.to_numeric(tmp["A4"], errors="coerce").fillna(0)
        loc_col = next((c for c in ["LocalInstalacao", "Empresa"] if c in tmp.columns), None)
        if not loc_col:
            return []
        agg = tmp.groupby(loc_col)["_a4"].sum().reset_index()
        agg = agg.sort_values("_a4", ascending=False).head(n)
        return [{"location": str(row[loc_col]), "total_a4": int(row["_a4"])} for _, row in agg.iterrows()]

    def _paper_toner_mix(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {"paper_only": 0, "toner_only": 0, "both": 0, "neither": 0}
        a4 = pd.to_numeric(df.get("A4", 0), errors="coerce").fillna(0) if "A4" in df.columns else pd.Series(0, index=df.index)
        a3 = pd.to_numeric(df.get("A3", 0), errors="coerce").fillna(0) if "A3" in df.columns else pd.Series(0, index=df.index)
        toner_cols = [c for c in ["TonerPreto", "TonerCiano", "TonerMagenta", "TonerAmarelo"] if c in df.columns]
        toner = sum(pd.to_numeric(df[c], errors="coerce").fillna(0) for c in toner_cols) if toner_cols else pd.Series(0, index=df.index)
        has_paper = (a4 + a3) > 0
        has_toner = toner > 0
        return {
            "paper_only": int((has_paper & ~has_toner).sum()),
            "toner_only": int((~has_paper & has_toner).sum()),
            "both": int((has_paper & has_toner).sum()),
            "neither": int((~has_paper & ~has_toner).sum()),
        }


    # ─── Equipment section ───────────────────────────────────────────────────

    def _compute_equipment(self, df_mapa: pd.DataFrame, df_contadores: pd.DataFrame, df_entregas: pd.DataFrame) -> dict:
        fleet_size = len(df_mapa) if not df_mapa.empty else 0

        # Status distribution
        status_dist = []
        if not df_mapa.empty:
            col = next((c for c in ["Status", "STATUS"] if c in df_mapa.columns), None)
            if col:
                status_dist = self._value_counts_list(df_mapa[col])

        # Model distribution (top 10)
        model_dist = []
        if not df_mapa.empty:
            col = next((c for c in ["ModeloSimpress", "Modelo"] if c in df_mapa.columns), None)
            if col:
                model_dist = self._value_counts_list(df_mapa[col], 10)

        # Color vs mono (from contadores)
        color_vs_mono = self._color_vs_mono(df_contadores)

        # Toner level distribution
        toner_dist = self._toner_level_distribution(df_contadores)

        # Rankings from entregas
        top_deliveries = self._top_by_deliveries(df_entregas)
        top_a4 = self._top_equipment_supply(df_entregas, "A4", "total_a4")
        top_incidents = self._top_by_flag(df_entregas, "ComDefeito", "Sim")
        top_recolhas = self._top_by_flag(df_entregas, "Recolha", "Sim")

        # Days since last delivery
        days_since = self._days_since_delivery(df_entregas)

        # Counter production
        counter_prod = self._counter_production(df_entregas)

        return {
            "fleet_size": fleet_size,
            "status_distribution": status_dist,
            "model_distribution": model_dist,
            "color_vs_mono": color_vs_mono,
            "toner_level_distribution": toner_dist,
            "top_by_deliveries": top_deliveries,
            "top_by_a4": top_a4,
            "top_by_incidents": top_incidents,
            "top_by_recolhas": top_recolhas,
            "days_since_delivery": days_since,
            "counter_production": counter_prod,
        }

    def _color_vs_mono(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {"color": 0, "mono": 0}
        color_cols = [c for c in ["toner_cy_pct", "toner_mg_pct", "toner_yw_pct"] if c in df.columns]
        if not color_cols:
            return {"color": 0, "mono": int(len(df))}
        is_color = pd.Series(False, index=df.index)
        for c in color_cols:
            vals = pd.to_numeric(df[c], errors="coerce").fillna(0)
            is_color = is_color | (vals > 0)
        return {"color": int(is_color.sum()), "mono": int((~is_color).sum())}

    def _toner_level_distribution(self, df: pd.DataFrame) -> dict:
        buckets = [("0-20", 0, 20), ("21-50", 21, 50), ("51-80", 51, 80), ("81-100", 81, 100)]
        result = {}
        col_map = {"bk": "toner_bk_pct", "cy": "toner_cy_pct", "mg": "toner_mg_pct", "yw": "toner_yw_pct"}
        for key, col in col_map.items():
            dist = []
            for label, lo, hi in buckets:
                if not df.empty and col in df.columns:
                    vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
                    count = int(((vals >= lo) & (vals <= hi)).sum())
                else:
                    count = 0
                dist.append({"range": label, "count": count})
            result[key] = dist
        return result

    def _top_by_deliveries(self, df: pd.DataFrame, n: int = 10) -> list:
        if df.empty or "Serie" not in df.columns:
            return []
        group_cols = [c for c in ["Serie", "Fila", "Modelo"] if c in df.columns]
        agg = df.groupby(group_cols).size().reset_index(name="count")
        agg = agg.sort_values("count", ascending=False).head(n)
        result = []
        for _, row in agg.iterrows():
            entry = {"serie": str(row.get("Serie", "")), "count": int(row["count"])}
            if "Fila" in row:
                entry["fila"] = str(row.get("Fila", ""))
            if "Modelo" in row:
                entry["modelo"] = str(row.get("Modelo", ""))
            result.append(entry)
        return result

    def _top_by_flag(self, df: pd.DataFrame, col: str, value: str, n: int = 10) -> list:
        if df.empty or col not in df.columns or "Serie" not in df.columns:
            return []
        flagged = df[df[col].astype(str).str.strip().str.lower() == value.lower()]
        if flagged.empty:
            return []
        group_cols = [c for c in ["Serie", "Fila"] if c in flagged.columns]
        agg = flagged.groupby(group_cols).size().reset_index(name="count")
        agg = agg.sort_values("count", ascending=False).head(n)
        result = []
        for _, row in agg.iterrows():
            entry = {"serie": str(row.get("Serie", "")), "count": int(row["count"])}
            if "Fila" in row:
                entry["fila"] = str(row.get("Fila", ""))
            result.append(entry)
        return result

    def _days_since_delivery(self, df: pd.DataFrame) -> list:
        if df.empty or "Serie" not in df.columns or "DataEntrega" not in df.columns:
            return []
        tmp = df.copy()
        tmp["_entrega_dt"] = pd.to_datetime(tmp["DataEntrega"], dayfirst=True, errors="coerce")
        delivered = tmp.dropna(subset=["_entrega_dt"])
        if delivered.empty:
            return []
        today = pd.Timestamp(date.today())
        group_cols = [c for c in ["Serie", "Fila", "Modelo"] if c in delivered.columns]
        agg = delivered.groupby(group_cols)["_entrega_dt"].max().reset_index()
        agg["days"] = (today - agg["_entrega_dt"]).dt.days
        agg = agg.sort_values("days", ascending=False)
        result = []
        for _, row in agg.iterrows():
            entry = {
                "serie": str(row.get("Serie", "")),
                "last_delivery": str(row["_entrega_dt"].date()),
                "days": int(row["days"]),
            }
            if "Fila" in row:
                entry["fila"] = str(row.get("Fila", ""))
            if "Modelo" in row:
                entry["modelo"] = str(row.get("Modelo", ""))
            result.append(entry)
        return result

    def _counter_production(self, df: pd.DataFrame) -> list:
        if df.empty or "Serie" not in df.columns:
            return []
        tmp = df.copy()
        ci = pd.to_numeric(tmp.get("ContadorInicial", pd.Series(dtype=float)), errors="coerce")
        cf = pd.to_numeric(tmp.get("ContadorFinal", pd.Series(dtype=float)), errors="coerce")
        tmp["_prod"] = cf - ci
        valid = tmp.dropna(subset=["_prod"])
        if valid.empty:
            return []
        agg = valid.groupby("Serie")["_prod"].sum().reset_index()
        agg = agg.sort_values("_prod", ascending=False)
        return [{"serie": str(row["Serie"]), "total_production": int(row["_prod"])} for _, row in agg.iterrows()]


    # ─── Stock section ───────────────────────────────────────────────────────

    def _compute_stock(self, df_estoque: pd.DataFrame, df_lancamentos: pd.DataFrame) -> dict:
        # Current levels
        items = []
        by_category = []
        zero_stock = []

        if not df_estoque.empty:
            tmp = df_estoque.copy()
            estoque_col = next((c for c in ["EstoqueAtual", "estoque_atual"] if c in tmp.columns), None)
            cat_col = next((c for c in ["Categoria", "categoria"] if c in tmp.columns), None)
            tipo_col = next((c for c in ["TipoModelo", "tipo_modelo"] if c in tmp.columns), None)
            alt_col = next((c for c in ["UltimaAlteracao", "ultima_alteracao"] if c in tmp.columns), None)

            for _, row in tmp.iterrows():
                tipo = str(row.get(tipo_col, "")) if tipo_col else ""
                estoque = self._safe_int(row.get(estoque_col, 0)) if estoque_col else 0
                cat = str(row.get(cat_col, "")) if cat_col else ""
                alt = str(row.get(alt_col, "")) if alt_col else ""
                items.append({"tipo_modelo": tipo, "estoque_atual": estoque, "categoria": cat, "ultima_alteracao": alt})
                if estoque <= 0:
                    zero_stock.append({"tipo_modelo": tipo, "estoque_atual": estoque, "categoria": cat})

            if cat_col and estoque_col:
                tmp["_estoque"] = pd.to_numeric(tmp[estoque_col], errors="coerce").fillna(0)
                cat_agg = tmp.groupby(cat_col)["_estoque"].sum().reset_index()
                by_category = [{"name": str(row[cat_col]), "value": int(row["_estoque"])} for _, row in cat_agg.iterrows()]

        # Movements
        movements_by_month = []
        movements_by_type = []
        turnover = []

        if not df_lancamentos.empty:
            tmp_l = df_lancamentos.copy()
            date_col = next((c for c in ["DataLancamento", "data_lancamento"] if c in tmp_l.columns), None)
            tipo_col = next((c for c in ["TipoLancamento", "tipo_lancamento"] if c in tmp_l.columns), None)
            qty_col = next((c for c in ["Quantidade", "quantidade"] if c in tmp_l.columns), None)

            if date_col:
                tmp_l["_dt"] = pd.to_datetime(tmp_l[date_col], dayfirst=True, errors="coerce")
                tmp_l["_period"] = tmp_l["_dt"].dt.to_period("M").astype(str)
                if qty_col:
                    tmp_l["_qty"] = pd.to_numeric(tmp_l[qty_col], errors="coerce").fillna(0)
                    if tipo_col:
                        entrada = tmp_l[tmp_l[tipo_col].astype(str).str.lower().str.contains("entrada", na=False)]
                        saida = tmp_l[tmp_l[tipo_col].astype(str).str.lower().str.contains("saída|saida", na=False)]
                        e_agg = entrada.groupby("_period")["_qty"].sum().rename("entrada")
                        s_agg = saida.groupby("_period")["_qty"].sum().rename("saida")
                        merged = pd.concat([e_agg, s_agg], axis=1).fillna(0).reset_index()
                        merged = merged.sort_values("_period")
                        movements_by_month = [
                            {"period": row["_period"], "entrada": int(row["entrada"]), "saida": int(row["saida"])}
                            for _, row in merged.iterrows()
                        ]

            if tipo_col:
                movements_by_type = self._value_counts_list(tmp_l[tipo_col])

            # Turnover by item
            if qty_col and tipo_col:
                mat_col = next((c for c in ["TipoMaterial", "TipoModelo"] if c in tmp_l.columns), None)
                if mat_col:
                    saida_rows = tmp_l[tmp_l[tipo_col].astype(str).str.lower().str.contains("saída|saida", na=False)]
                    if not saida_rows.empty:
                        saida_rows = saida_rows.copy()
                        saida_rows["_qty"] = pd.to_numeric(saida_rows[qty_col], errors="coerce").fillna(0)
                        agg = saida_rows.groupby(mat_col)["_qty"].sum().reset_index()
                        turnover = [{"tipo_modelo": str(row[mat_col]), "turnover_rate": float(row["_qty"])} for _, row in agg.iterrows()]

        return {
            "items": items,
            "by_category": by_category,
            "zero_stock_items": zero_stock,
            "movements_by_month": movements_by_month,
            "movements_by_type": movements_by_type,
            "turnover_by_item": turnover,
        }


    # ─── Operational section ─────────────────────────────────────────────────

    def _compute_operational(self, df: pd.DataFrame) -> dict:
        sla_rate = self._compute_sla(df)
        sla_by_month = self._sla_by_month(df)

        # Avg counter production
        avg_counter = 0.0
        if not df.empty and "ContadorInicial" in df.columns and "ContadorFinal" in df.columns:
            ci = pd.to_numeric(df["ContadorInicial"], errors="coerce")
            cf = pd.to_numeric(df["ContadorFinal"], errors="coerce")
            prod = cf - ci
            valid = prod.dropna()
            if len(valid) > 0:
                avg_counter = round(float(valid.mean()), 2)

        # Correlations
        paper_vs_counter = self._paper_vs_counter(df)
        toner_vs_counter = self._toner_vs_counter(df)

        # Personnel
        by_func = self._value_counts_list(df["Funcionario"], 10) if not df.empty and "Funcionario" in df.columns else []
        by_alm = self._value_counts_list(df["Almoxarifado"]) if not df.empty and "Almoxarifado" in df.columns else []

        return {
            "sla_compliance_rate": sla_rate,
            "sla_window_days": SLA_WINDOW,
            "sla_by_month": sla_by_month,
            "avg_counter_production": avg_counter,
            "paper_vs_counter": paper_vs_counter,
            "toner_vs_counter": toner_vs_counter,
            "by_funcionario": by_func,
            "by_almoxarifado": by_alm,
        }

    def _compute_sla(self, df: pd.DataFrame) -> float:
        if df.empty or "DataEntrega" not in df.columns:
            return 0.0
        delivered = df[df["DataEntrega"].astype(str).str.strip() != ""].copy()
        if delivered.empty:
            return 0.0
        delivered["_data_dt"] = pd.to_datetime(delivered.get("Data", pd.Series(dtype=str)), dayfirst=True, errors="coerce")
        delivered["_entrega_dt"] = pd.to_datetime(delivered["DataEntrega"], dayfirst=True, errors="coerce")
        delivered["_days"] = (delivered["_entrega_dt"] - delivered["_data_dt"]).dt.days
        valid = delivered.dropna(subset=["_days"])
        if valid.empty:
            return 0.0
        compliant = int((valid["_days"] <= SLA_WINDOW).sum())
        return round(compliant / len(valid) * 100, 2)

    def _sla_by_month(self, df: pd.DataFrame) -> list:
        if df.empty or "DataEntrega" not in df.columns:
            return []
        delivered = df[df["DataEntrega"].astype(str).str.strip() != ""].copy()
        if delivered.empty:
            return []
        delivered["_data_dt"] = pd.to_datetime(delivered.get("Data", pd.Series(dtype=str)), dayfirst=True, errors="coerce")
        delivered["_entrega_dt"] = pd.to_datetime(delivered["DataEntrega"], dayfirst=True, errors="coerce")
        delivered["_days"] = (delivered["_entrega_dt"] - delivered["_data_dt"]).dt.days
        delivered["_period"] = delivered["_entrega_dt"].dt.to_period("M").astype(str)
        valid = delivered.dropna(subset=["_days", "_period"])
        if valid.empty:
            return []
        result = []
        for period, group in valid.groupby("_period"):
            rate = round((group["_days"] <= SLA_WINDOW).sum() / len(group) * 100, 2)
            result.append({"period": str(period), "rate": rate})
        return sorted(result, key=lambda x: x["period"])

    def _paper_vs_counter(self, df: pd.DataFrame) -> list:
        if df.empty or "Serie" not in df.columns:
            return []
        tmp = df.copy()
        a4 = pd.to_numeric(tmp.get("A4", 0), errors="coerce").fillna(0) if "A4" in tmp.columns else pd.Series(0, index=tmp.index)
        ci = pd.to_numeric(tmp.get("ContadorInicial", pd.Series(dtype=float)), errors="coerce")
        cf = pd.to_numeric(tmp.get("ContadorFinal", pd.Series(dtype=float)), errors="coerce")
        tmp["_a4"] = a4
        tmp["_prod"] = cf - ci
        valid = tmp.dropna(subset=["_prod"])
        if valid.empty:
            return []
        agg = valid.groupby("Serie").agg(a4_total=("_a4", "sum"), counter_production=("_prod", "sum")).reset_index()
        return [{"serie": str(row["Serie"]), "a4_total": int(row["a4_total"]), "counter_production": int(row["counter_production"])} for _, row in agg.iterrows()]

    def _toner_vs_counter(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []
        tmp = df.copy()
        toner_cols = [c for c in ["TonerPreto", "TonerCiano", "TonerMagenta", "TonerAmarelo"] if c in tmp.columns]
        if not toner_cols:
            return []
        tmp["_toner"] = sum(pd.to_numeric(tmp[c], errors="coerce").fillna(0) for c in toner_cols)
        ci = pd.to_numeric(tmp.get("ContadorInicial", pd.Series(dtype=float)), errors="coerce")
        cf = pd.to_numeric(tmp.get("ContadorFinal", pd.Series(dtype=float)), errors="coerce")
        tmp["_prod"] = cf - ci
        model_col = next((c for c in ["Modelo", "ModeloSimpress"] if c in tmp.columns), None)
        if not model_col:
            return []
        valid = tmp.dropna(subset=["_prod"])
        if valid.empty:
            return []
        agg = valid.groupby(model_col).agg(toner_total=("_toner", "sum"), avg_counter=("_prod", "mean")).reset_index()
        return [{"model": str(row[model_col]), "toner_total": int(row["toner_total"]), "avg_counter": round(float(row["avg_counter"]), 2)} for _, row in agg.iterrows()]


    # ─── Predictive section ──────────────────────────────────────────────────

    def _compute_predictive(self, df_contadores: pd.DataFrame, df_papel: pd.DataFrame, df_entregas: pd.DataFrame) -> dict:
        toner_alerts = self._toner_alerts(df_contadores, df_entregas)
        paper_alerts = self._paper_alerts(df_papel, df_entregas)
        return {"toner_alerts": toner_alerts, "paper_alerts": paper_alerts}

    def _toner_alerts(self, df_contadores: pd.DataFrame, df_entregas: pd.DataFrame) -> list:
        if df_contadores.empty:
            return []
        tmp = df_contadores.copy()
        toner_map = {
            "bk": "toner_bk_pct",
            "cy": "toner_cy_pct",
            "mg": "toner_mg_pct",
            "yw": "toner_yw_pct",
        }
        # Get last delivery per serie
        last_delivery_map = {}
        if not df_entregas.empty and "Serie" in df_entregas.columns and "DataEntrega" in df_entregas.columns:
            tmp_e = df_entregas.copy()
            tmp_e["_dt"] = pd.to_datetime(tmp_e["DataEntrega"], dayfirst=True, errors="coerce")
            delivered = tmp_e.dropna(subset=["_dt"])
            if not delivered.empty:
                last = delivered.groupby("Serie")["_dt"].max()
                last_delivery_map = {k: str(v.date()) for k, v in last.items()}

        alerts = []
        for _, row in tmp.iterrows():
            pcts = {}
            for key, col in toner_map.items():
                if col in row:
                    try:
                        pcts[key] = float(str(row[col]).replace("%", "").strip())
                    except Exception:
                        pcts[key] = 100.0
                else:
                    pcts[key] = 100.0

            min_pct = min(pcts.values())
            if min_pct < TONER_ALERT_THRESHOLD:
                serie = str(row.get("Serie", ""))
                alerts.append({
                    "serie": serie,
                    "fila": str(row.get("Fila", "")),
                    "modelo": str(row.get("ModeloSimpress", row.get("Modelo", ""))),
                    "local": str(row.get("LocalInstalacao", "")),
                    "last_delivery": last_delivery_map.get(serie, ""),
                    "bk_pct": pcts["bk"],
                    "cy_pct": pcts["cy"],
                    "mg_pct": pcts["mg"],
                    "yw_pct": pcts["yw"],
                    "min_toner_pct": min_pct,
                })

        alerts.sort(key=lambda x: x["min_toner_pct"])
        return alerts

    def _paper_alerts(self, df_papel: pd.DataFrame, df_entregas: pd.DataFrame) -> list:
        if df_papel.empty or df_entregas.empty:
            return []

        # Get last A4 delivery per serie
        if "Serie" not in df_entregas.columns or "A4" not in df_entregas.columns:
            return []

        tmp_e = df_entregas.copy()
        tmp_e["_a4"] = pd.to_numeric(tmp_e["A4"], errors="coerce").fillna(0)
        tmp_e["_dt"] = pd.to_datetime(tmp_e.get("DataEntrega", pd.Series(dtype=str)), dayfirst=True, errors="coerce")
        a4_delivered = tmp_e[(tmp_e["_a4"] > 0) & tmp_e["_dt"].notna()]

        if a4_delivered.empty:
            return []

        last_a4 = a4_delivered.sort_values("_dt").groupby("Serie").last()[["_a4", "_dt"]].reset_index()
        last_a4.columns = ["Serie", "last_a4_qty", "last_a4_dt"]

        today = pd.Timestamp(date.today())
        last_a4["days_since"] = (today - last_a4["last_a4_dt"]).dt.days

        # Merge with papel for Media
        serie_col = next((c for c in ["Serie", "serie"] if c in df_papel.columns), None)
        media_col = next((c for c in ["Media", "media"] if c in df_papel.columns), None)

        if not serie_col or not media_col:
            return []

        papel_slim = df_papel[[serie_col, media_col]].copy()
        papel_slim.columns = ["Serie", "Media"]
        merged = last_a4.merge(papel_slim, on="Serie", how="left")
        merged["Media"] = pd.to_numeric(merged["Media"], errors="coerce").fillna(0)

        alerts = []
        for _, row in merged.iterrows():
            remaining = self._estimate_remaining_sheets(
                int(row["last_a4_qty"]),
                int(row["days_since"]),
                float(row["Media"]),
            )
            if remaining < 500:  # less than 1 ream equivalent
                alerts.append({
                    "serie": str(row["Serie"]),
                    "fila": "",
                    "modelo": "",
                    "local": "",
                    "last_a4_delivery": str(row["last_a4_dt"].date()),
                    "estimated_remaining_sheets": round(remaining, 2),
                    "days_since_last_delivery": int(row["days_since"]),
                })

        return alerts

    @staticmethod
    def _estimate_remaining_sheets(last_a4_qty: int, days_since: int, media_monthly: float) -> float:
        """estimated_remaining = last_A4_delivered × 500 − (days_since × (Media / 30))"""
        daily_consumption = media_monthly / 30.0 if media_monthly > 0 else 0
        return max(0.0, last_a4_qty * 500 - days_since * daily_consumption)
