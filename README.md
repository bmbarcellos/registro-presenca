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

## Campos enviados ao webhook

Além dos campos do formulário, todos os períodos enviam:

| Campo | Origem | Para que serve |
|---|---|---|
| `periodo` | `PERIODO_CONFIG.periodoValor` | Roteamento e segmentação no n8n. Formato: `"6º periodo"`, `"7º periodo"`, `"8º periodo"` |
| `token_sessao` | `/webhook/iniciar-sessao` | Sessão de uso único, válida por 5 minutos |
| `device_hash` | `gerarDeviceHash()` | Hash de atributos do **modelo** do aparelho |
| `device_id` | `obterDeviceId()` | UUID por **instalação**, guardado no `localStorage` |
| `lat`, `lng`, `accuracy` | Geolocalização do navegador | Geofence e avaliação da qualidade do GPS |

### Por que `device_hash` e `device_id` coexistem

Eles resolvem problemas opostos e nenhum substitui o outro.

O **`device_hash`** deriva de características do modelo (user agent, resolução,
fuso, núcleos). Dois alunos com o mesmo celular produzem o mesmo hash — foi o que
gerou 71 acusações falsas de duplicidade no semestre passado, 38% do total. Em
compensação, ele não some quando o usuário limpa os dados do navegador, e por
isso continua servindo como **indício** de aparelho reaproveitado.

O **`device_id`** é um UUID único por instalação. Serve para **amarrar o token de
sessão** ao navegador que o solicitou, onde o que importa é unicidade. Mas é
apagável pelo usuário, então não pode ser a única defesa contra duplicidade.

A regra de duplicidade usa os dois com pesos diferentes: `device_id` igual entre
alunos distintos na mesma aula é evidência forte e bloqueia; apenas o
`device_hash` coincidindo é indício fraco e vira observação para o professor.

Em navegação anônima o `localStorage` pode estar bloqueado. Nesse caso o
`device_id` vai vazio e a validação recai sobre o `device_hash`.
