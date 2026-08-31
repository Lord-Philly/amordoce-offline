# Amor Doce — Offline

Versão 100% local/offline (prova de conceito) do jogo web **Amor Doce**, baseada na auditoria técnica e reutilizando a arquitetura da recriação de referência `FlatCategory/amordoce-ep-0`.

> **Uso pessoal.** Todo o código do motor foi reescrito do zero em JavaScript puro (módulos ES), sem dependências. Os assets gráficos e as falas do tutorial do Episódio 0 vêm da recriação de referência e pertencem à **Beemoov** (todos os direitos reservados a Beemoov). Não redistribua.

## Como funciona

- **Zero backend** — o jogo inteiro é HTML/CSS/JS + arquivos JSON locais. Nenhum request para `amordoce.com` durante a execução.
- **Motor separado do conteúdo**:
  - `engine/` → lógica reutilizável (diálogo, escolhas, cenas, navegação, inventário, economia, relacionamento, save)
  - `data/` → conteúdo (episódios, personagens, itens, catálogo) em JSON
  - `assets/` → imagens, fontes, vídeo
- **Salvamento local** com auto-save + export/import de arquivo `.json` (backup).

## Como rodar

Como usa módulos ES + `fetch` em caminhos relativos, precisa de um servidor HTTP estático (não abra direto por `file://`):

```bash
# opção 1 — servidor incluído (Node)
node server.js          # abre http://localhost:8080

# opção 2 — qualquer servidor estático (python, npx serve, etc.)
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Estrutura de dados dos episódios

Um episódio é um arquivo `data/episodes/ep-XX.json` registrado no `data/index.json`:

```jsonc
{
  "episode": { "id": "ep-00", "number": 0, "name": "..." },
  "locations": { "corredor": { "id": "corredor", "name": "...", "image": "assets/img/..." } },
  "actors": { "ChiNoMimi": { "emotions": { "happy": "chinomimi-1.webp", "default": "..." } } },
  "storyline": [
    { "id": "0", "type": "bubble", "character": "ChiNoMimi", "emotion": "happy",
      "text": "...", "x": 8, "y": 26, "maxWidth": 28, "place": "corredor" },
    { "id": "1", "type": "dialog",
      "responses": [
        { "text": "Sim!", "goto": "2", "set": { "chinomimi_love": "+3" }, "condition": { "var": "x", "op": ">=", "value": 1 } },
        { "text": "Não.", "goto": "0" }
      ] },
    { "id": "9", "type": "move", "place": "corredor", "moves": [ { "goto": "10", "top": 40, "left": 70, "label": "Entrar no Grêmio" } ] },
    { "id": "31", "type": "move", "place": "gremio", "items": [ { "item": "1", "top": 50, "left": 20 } ],
      "moves": [ { "goto": "32", "top": 75, "left": 85, "label": "Voltar", "requiredItem": "1", "failedMessage": "..." } ] },
    { "id": "32", "type": "pickup", "item": "1", "received": ["Objeto recebido: ..."], "auto": "33" },
    { "id": "8", "type": "objective", "objectives": [ { "text": "Objetivo", "id": "8-1" } ], "place": "corredor" },
    { "id": "47", "type": "dialog-end", "responses": [ { "text": "FIM.", "goto": "48" } ] },
    { "id": "48", "type": "end-episode", "nextEpisode": "ep-01" }
  ]
}
```

### Tipos de entrada (`type`)
| Tipo | Função |
|------|--------|
| `bubble` | Balão de fala do NPC (+ sprite no canvas) |
| `dialog` / `dialog-end` | Escolhas do jogador (com `set` e `condition`) |
| `move` | Hotspots de navegação no cenário (+ coleta de itens) |
| `pickup` | Coleta de item, avança automaticamente |
| `objective` | Define objetivos do episódio |
| `end-episode` | Fim do episódio, aponta para o próximo |

### Efeitos disponíveis em `set`
- `"pa"` / `"golds"` → economias (`"+N"`, `"-N"`, `"=N"`)
- `"<char>_love"` → relacionamento/amorômetro
- `"item"` / `"removeItem"` → inventário
- qualquer outra chave → variável de estado (usada em `condition`)

## Testes

```bash
node test/integration.test.mjs   # roda a suíte (estado, integridade dos dados, simulação de fluxo, save)
```

## Sistema de save

- Auto-save a cada transição de cena (`localStorage`).
- **Exportar/Importar** em `Saves → Perfil` (arquivo `.json`, para backup/migração entre dispositivos).
- Multi-perfis possíveis separando o arquivo de save exportado.

## Roadmap já implementado
1. ✅ Engine base (módulos ES)
2. ✅ Sistema de diálogo
3. ✅ Sistema de escolhas (com variáveis/condições/consequências)
4. ✅ Sistema de eventos (objetivos, pickup)
5. ✅ Save (auto + export/import)
6. ✅ Primeiro episódio (ep-00, ponta-a-ponta)
7. ✅ Navegação/mapa (move hotspots + mudança de lugar)
8. ✅ Personagens (render por emoção)
9. ✅ Inventário
10. ✅ Relacionamentos (loveômetro funcional)
11. ✅ Economia (PA/Gold funcionais)

## Android
Como é frontend puro, pode ser empacotado como PWA (Capacitor/Cordova/TWA) para rodar offline em Android. O diretório completo (sem `node_modules`) é o bundle.
