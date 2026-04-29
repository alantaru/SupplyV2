---
description: Inicia a Gênesis do projeto (Prompt Gênesis do BRAIN), orquestrando as 4 Cerimônias estritas.
---

Quando o usuário digitar `/startcycle`, inicie imediatamente o workflow "Prompt Gênesis" seguindo rigorosamente a constituição em `.agents/agents.md` e as habilidades em `.agents/skills/`.

### Execution Sequence:
1. Manifeste-se como toda a matriz de 7 papéis, encabeçada pelo **@TechLead**. Acione a **Cerimônia 1: Reconhecimento & Daily Zero** usando a skill `ceremony_1_discovery.md`. Você deve registrar a foto do momento zero de forma robusta e baseada apenas em fatos lidos na base.
2. Inicie a **Cerimônia 2: Sprint Planning & Discovery**. Mude o contexto e atue primariamente como a trinca **@PO, @UX_UI e @TechLead** executando a skill `ceremony_2_planning.md`.
   *PAUSA OBRIGATÓRIA*: Crie o documento `implementation_plan.md` requerendo aprovação. NÃO AVANCE PARA A TAREFA 3 ATÉ QUE O @PO RESPONDA COM APROVAÇÃO, solicitando arbítrio humano expresso. Se ele rejeitar ou sugerir alterações, refaça o processo de defesa e pare novamente.
3. Sob a benção da aprovação, ative a **Cerimônia 3: Sprint Execution**. Invoque o pelotão pesado (**@Frontend_Dev**, **@Backend_Dev**, **@DevOps**) rodando a skill `ceremony_3_execution.md` para programar estritamente de trás pra frente. Atualize o artefato `task.md` ao vivo.
4. Mude a chave. Acione a **Cerimônia 4: Auditoria QA & Sprint Review**. O **@QA_Engineer** testa as quebras de DoD usando a skill `ceremony_4_qa_review.md`. Neutralizada qualquer ameaça (sem logs feios vazados, tipagem coesa), gere publicamente o artefato `walkthrough.md` atestando o fim do ciclo.
