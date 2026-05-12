# Simulador de Memória Virtual (SO)

Este projeto implementa, em **HTML + JavaScript puro**, um simulador didático de paginação dividido em duas partes:

1. **Tradução de endereços (Parte 1)**
2. **Page Fault, alocação sob demanda, swap e substituição manual (Parte 2)**

## O que o simulador faz

- Mostra o mapeamento entre páginas lógicas e quadros físicos.
- Exibe o papel do **PTBR** (offset da tabela de páginas por processo).
- Simula memória com:
  - **RAM**: quadros `0..15`
  - **SWAP**: quadros simulados `16..23`
- Trata três estados de página:
  - `INV` (inválida, nunca alocada)
  - `RAM` (residente em memória)
  - `SWAP` (fora da RAM, com cópia na swap)
- Simula eventos:
  - Tradução normal
  - Page fault de página inválida
  - Page fault de página em swap
  - Substituição manual de página vítima
  - Regra de proteção do kernel (frame 1 reservado)

## Modelo implementado

- **Tamanho da página**: 1 KiB (`1024` bytes)
- **Espaço virtual por processo**: 4 páginas (`0..3`)
- **Processos**: `P1`, `P2`, `P3`
- **PTBR (offset) inicial**:
  - `P1 = 0x0000`
  - `P2 = 0x0100`
  - `P3 = 0x0200`
- **RAM**:
  - `frame 0`: tabelas de páginas
  - `frame 1`: kernel/protegido
  - `frames 2..15`: dados dos processos
- **SWAP**: `16..23`

## Fluxo de tradução

Ao acessar uma variável (ou endereço lógico):

1. MMU decompõe em `página` e `deslocamento`.
2. Consulta entrada da tabela de páginas do processo ativo.
3. Se estado for:
   - `RAM`: tradução normal, `end_físico = frame * 1024 + deslocamento`.
   - `INV`: gera page fault e pede quadro RAM para alocar.
   - `SWAP`: gera page fault e pede quadro RAM para swap-in.
4. Se não houver quadro livre, o usuário escolhe uma vítima para substituir.

## Interface

A tela possui três painéis:

- **Esquerda**: seleção de processo, PTBR e variáveis por página.
- **Centro**: passos da MMU e log de eventos.
- **Direita**: visão dos frames de RAM e blocos da área de swap.

Ao acessar uma página em RAM, o quadro correspondente pisca para destacar o acesso.

## Como rodar

### Opção 1 (mais simples)
Abra o arquivo `index.html` no navegador.

### Opção 2 (recomendada)
Suba um servidor HTTP local:

```bash
python3 -m http.server 8000
```

Depois acesse:

`http://localhost:8000`

## Estrutura do projeto

- `index.html`: estrutura da aplicação.
- `styles.css`: estilos e layout dos painéis/frames.
- `app.js`: lógica de simulação (MMU, RAM, swap, page faults, substituição).

---

Projeto focado em fins didáticos para Sistemas Operacionais.
