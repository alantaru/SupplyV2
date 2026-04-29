# Guia de Contribuição — Supply 2026

## Fluxo de Trabalho

1. Crie uma branch: `git checkout -b feature/nome-da-feature`
2. Implemente seguindo os padrões abaixo
3. Garanta que os testes passam: `cd backend && pytest`
4. Abra um Pull Request com descrição detalhada

## Padrões de Código

### Backend (Python)
- Python 3.12+, FastAPI, pytest
- Formatação: `ruff format`
- Linting: `ruff check`
- Testes obrigatórios para toda nova funcionalidade
- Coverage mínimo: 95%

### Frontend (React)
- React 19 + Vite + UnoCSS
- Componentes funcionais com hooks
- Sem `console.log` em produção

## Estrutura de Commits

```
feat: adiciona endpoint de exportação de rotas
fix: corrige dtype mismatch no StockService
test: adiciona testes E2E para fluxo de entrega
docs: atualiza README com instruções de deploy
refactor: extrai lógica de mapeamento para helper
```

## Testes

```bash
# Unitários e integração
cd backend && pytest

# E2E (requer servidor rodando)
cd backend && pytest tests/e2e/ -m smoke
```

## Specs

Novas features devem ter spec em `.kiro/specs/{feature-name}/`:
- `requirements.md` — requisitos EARS/INCOSE
- `design.md` — design técnico com POMs e propriedades
- `tasks.md` — plano de implementação
