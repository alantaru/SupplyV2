import { AlertTriangle } from 'lucide-react';

export default function AlertPanel({ alerts = [], type = 'toner' }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-slate-400 dark:text-slate-500 gap-2">
        <span>✓</span>
        <span>Nenhum alerta</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs text-slate-800 dark:text-white">{alert.serie}</span>
              {alert.fila && <span className="text-[10px] text-slate-500 dark:text-slate-400">{alert.fila}</span>}
              {alert.modelo && <span className="text-[10px] text-slate-500 dark:text-slate-400">{alert.modelo}</span>}
            </div>
            {alert.local && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{alert.local}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {type === 'toner' && (
                <>
                  {alert.bk_pct !== undefined && <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">BK: {alert.bk_pct?.toFixed(0)}%</span>}
                  {alert.cy_pct !== undefined && <span className="text-[10px] font-bold text-cyan-600">CY: {alert.cy_pct?.toFixed(0)}%</span>}
                  {alert.mg_pct !== undefined && <span className="text-[10px] font-bold text-pink-600">MG: {alert.mg_pct?.toFixed(0)}%</span>}
                  {alert.yw_pct !== undefined && <span className="text-[10px] font-bold text-yellow-600">YW: {alert.yw_pct?.toFixed(0)}%</span>}
                </>
              )}
              {type === 'paper' && alert.estimated_remaining_sheets !== undefined && (
                <span className="text-[10px] font-bold text-amber-600">
                  ~{Math.round(alert.estimated_remaining_sheets)} folhas restantes
                </span>
              )}
              {type === 'stock' && alert.estoque_atual !== undefined && (
                <span className="text-[10px] font-bold text-red-600">
                  Estoque: {alert.estoque_atual}
                </span>
              )}
              {alert.last_delivery && (
                <span className="text-[10px] text-slate-400">Última entrega: {alert.last_delivery}</span>
              )}
              {alert.last_a4_delivery && (
                <span className="text-[10px] text-slate-400">Última entrega A4: {alert.last_a4_delivery}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
