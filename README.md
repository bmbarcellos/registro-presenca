# Formulários de Registro de Presença — SERP

Núcleo compartilhado + uma pasta por período. Deploy: copiar esta pasta para o repositório GitHub `bmbarcellos/registro-presenca` (raiz do GitHub Pages).

## Estrutura
```
formulario/
├── styles.css           ← estilos comuns
├── shared.js            ← lógica comum (fingerprint, sessão, geo, submit)
├── 6/index.html         ← 6º período (config inline)
├── 7/index.html         ← 7º período (config inline, substitui index_11.html)
└── 8/index.html         ← 8º período (config inline)
```

## URLs finais (GitHub Pages)
- 6º: `https://bmbarcellos.github.io/registro-presenca/6/`
- 7º: `https://bmbarcellos.github.io/registro-presenca/7/`
- 8º: `https://bmbarcellos.github.io/registro-presenca/8/`

## Rota interna do SERP
`/qrcode/:periodo` (ex.: `/qrcode/6`, `/qrcode/7`, `/qrcode/8`) redireciona automaticamente para o formulário correspondente.
A rota antiga `/qrcode` continua funcionando e aponta para o 7º período (compatibilidade).

## Como adicionar um novo período
1. Duplicar a pasta `7/` para `N/`.
2. Ajustar `PERIODO_CONFIG` no `index.html`: `periodoLabel`, `periodoValor`, `modulosPorDisciplina`, `turnoPorDisciplina`.
3. Nenhuma outra alteração necessária.

## Novo campo enviado ao webhook
Todos os formulários agora enviam também `periodo` (string: "6", "7" ou "8") para permitir roteamento/segmentação no n8n.
