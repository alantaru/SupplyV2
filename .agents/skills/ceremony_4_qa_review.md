# Skill: Auditoria QA & Sprint Review (O Método Red Team - Cerimônia 4)

## Objective
Desencadear a mecânica Red Team pelo @QA_Engineer para tentar caçar lógicas quebradiças nos módulos que o @Frontend_Dev/@Backend_Dev acabaram de criar.

## Regras
- O @QA_Engineer não confia nas outras personas. Ataca o código impiedosamente.
- Protocolo de Rollback: Na ausência da possibilidade de um fix simples, reverte-se o código ao estado puro.

## Instructions (Condition of Done Absoluto)
1. Certifique-se de que a Sprint não comete violações extremas do "Supply 2026":
   - Zero `console.log` vazado na UI.
   - Respostas unificadas (e tipagem clara via schemas) do Backend.
   - Ausência completa de mágica ou inferências de pastas.
2. Destrua lógicas. Valide agressivamente.
3. Entregue os resultados em um sumário de testes (`walkthrough.md`) evidenciando a robustez criada.
4. Formalize a entrega para deploy do @DevOps.
