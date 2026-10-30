# 🧬 Simulador de Ecossistema e Evolução Natural

> Uma simulação interativa de vida artificial onde criaturas, vegetais e parasitas evoluem sob rigorosos custos energéticos, seleção natural, seleção sexual e adaptação climática em um ecossistema com estações do ano e solos dinâmicos.

---

## 📌 Documentos do Projeto

O projeto possui duas documentações complementares salvas neste repositório:

1. **[Especificação Técnica Completa](DOCUMENTACAO-PROJETO-SIMULACAO-EVOLUCAO.md)**: Documento técnico e formal com todos os modelos matemáticos, fórmulas metabólicas, tabela de biomas e regras detalhadas para entrega acadêmica.
2. **[Documento Vivo de Brainstorm](projeto-simulacao-evolucao.md)**: Histórico de todas as 26 decisões aprovadas e 18 alternativas descartadas durante o processo de design.

---

## 🏗️ Arquitetura do Sistema

O projeto é dividido em uma arquitetura **Cliente-Servidor (Java + Web Canvas)**:

```mermaid
graph TD
    subgraph Backend ["Backend (Java)"]
        A[Grid 2D de Células & Biomas] --> B[Dinâmica do Solo & 4 Estações]
        B --> C[Plantas com Trade-offs Energéticos]
        C --> D[Animais & Metabolismo Dinâmico]
        D --> E[Parasitas Ativos & Carcaças]
        E --> F[Herança Genética, Seleção Sexual & Especiação]
        F --> G[Modo Salto de Gerações em Lote]
    end

    subgraph Frontend ["Frontend (HTML5 / Canvas / JS)"]
        H[Renderização 2D em Canvas]
        I[Sprites Compostos Modulares em PNG & Importação]
        J[Teia Alimentar Dinâmica]
        K[Árvore Filogenética em Modal]
        L[Gráficos de População e Genes]
        M[Painel de Controle: 1x a 10x]
    end

    Backend -->|Streaming JSON / WebSocket| Frontend
```

- **Backend (Java):** Responsável por toda a matemática pesada, geração de mapas, ciclo das 4 estações, simulação física e avanço de gerações em lote.
- **Frontend (Web/Canvas):** Interface visual fluida no navegador, com controles de tempo, sprites compostos em camadas (com suporte a importação de imagens customizadas) e painéis científicos modais.
