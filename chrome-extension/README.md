# Leitor Mangás — Chrome Extension (v0.2)

Extensão Chrome (Manifest V3) que abre um **Side Panel nativo** para captura e envio de capítulos
ao backend do projeto Leitor. Ao clicar no ícone da extensão o painel lateral abre e permanece
visível durante toda a navegação — não fecha ao trocar de aba nem ao clicar fora.

## Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| **Side Panel persistente** | Abre ao clicar no ícone; sobrevive a navegação e troca de abas |
| **Seleção de container** | Modo visual com hover highlight (borda laranja) e overlay informando quantidade de imagens |
| **Extração de imagens** | `<img>`, `<source>`, `srcset`, `data-src`, e `background-image` (inline + computed) |
| **Thumbnails + drag-to-reorder** | Lista de imagens com preview, reordenação via arrastar, e remoção individual |
| **Scroll-to-image** | Clique na thumbnail ou URL para rolar a página até a imagem correspondente (highlight azul por 2s) |
| **Atualizar seleção** | Botão "Atualizar" reaplica o seletor CSS salvo para recapturar imagens do mesmo container |
| **Auto-refresh de URL** | Detecta navegações SPA (`pushState`, `replaceState`, `popstate`, `hashchange`) e atualiza a URL automaticamente |
| **Auto-increment capítulo** | Após envio com sucesso o número do capítulo incrementa em 1 |
| **Pipeline automático** | Ao enviar, o backend inicia download + extração OCR automaticamente em background |
| **Dark mode** | Segue `prefers-color-scheme` do sistema operacional |
| **Configurações** | Botão de engrenagem para alterar o servidor base (salvo em `chrome.storage.sync`) |
| **Persistência** | Obra padrão e última seleção são salvos em `chrome.storage.local` |

## Arquitetura

```
chrome-extension/
├── manifest.json      ← MV3, sidePanel permission
├── background.js      ← Service worker: abre Side Panel, proxy fetch, persiste seleção
├── content.js         ← Injected em todas as páginas: seleção, extração, history emitter, scroll-to-image
├── shared.js          ← Módulo utilitário (Leitor.*): loadObras, sendChapter, renderTags…
├── sidebar.html       ← UI do Side Panel
├── sidebar.css        ← Design system: Inter, CSS variables, dark mode
├── sidebar.js         ← Lógica do Side Panel (usa Leitor.*)
├── icons/             ← Ícones da extensão (16, 48, 128px)
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Endpoints utilizados no backend

| Método | URL | Descrição |
|--------|-----|-----------|
| `GET`  | `{server}/obras` | Lista obras — retorna JSON array `[{ id, title, slug }, …]` |
| `POST` | `{server}/api/chapters/submit` | Envia capítulo: `{ obra_id, capitulo_numero, url, imagens_url: [] }` |

## Instalação

1. Abra `chrome://extensions/`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação** e selecione a pasta `chrome-extension/`
4. O ícone do Leitor (livro azul) aparece na toolbar — clique para abrir o Side Panel

## Uso

1. Navegue até uma página com imagens de capítulo
2. No Side Panel, selecione a **obra** e preencha o **nº do capítulo**
3. Clique em **Selecionar** e clique no container de imagens na página
4. Revise as imagens (remova, reordene com drag-and-drop, clique para navegar)
5. Use **Atualizar** para recapturar imagens do mesmo container (útil em paginação lazy-load)
6. Clique em **Enviar capítulo**
7. O número do capítulo incrementa automaticamente — repita para o próximo

## Configuração

- **Servidor**: clique no ícone de engrenagem (⚙) no cabeçalho do painel e informe a URL base
  (padrão: `http://localhost:3000`). O valor é salvo em `chrome.storage.sync`.
- **CORS**: o fetch de obras é feito via proxy no service worker (`background.js`) para evitar
  problemas de CORS/mixed-content. O envio de capítulo é feito direto do Side Panel.

## Notas técnicas

- `host_permissions: ["<all_urls>"]` é necessário para injetar o content script e fazer proxy
  de fetch. Antes de publicar, restrinja aos domínios necessários.
- A seleção salva um **CSS selector** do container para permitir atualização sem resselecionar.
  Classes Tailwind com caracteres especiais (ex: `md:w-[800px]`) são filtradas automaticamente.
- O content script detecta navegações SPA e notifica o painel via `chrome.runtime.sendMessage`.
- Ao enviar um capítulo, o backend dispara o pipeline automático (download → OCR) em background.


