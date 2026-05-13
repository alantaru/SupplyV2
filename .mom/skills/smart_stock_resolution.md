# Skill: SmartStock Item Resolution

## Objective
Correctly link a protocol delivery (e.g., "Toner Preto" for "Xerox B215") to the physical stock item.

## Logic Flow
1. **Identify Type**: Is it A4, A3, or Toner?
2. **Model Extraction**: Get `ModeloSimpress` or `Modelo` from the protocol.
3. **Category Match**:
   - If Toner: Search Stock for `Categoria='toner'` AND `TipoToner='BK/CY/MG/YW'` AND `ModeloEquipamento=modelo`.
   - If Paper: Search Stock for `TipoModelo='A4 (RESMAS)'`.
4. **Resolution**:
   - Match Found -> Decrement `EstoqueAtual`.
   - No Match -> Create new item with negative balance (Audit trail priority).

## Constraints
- Always use `database.DB_LOCK` for stock updates to prevent race conditions.
- Never delete stock history (`ESTOQUE_LANCAMENTOS`).
