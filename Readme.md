# Leitor Mangás

Sistema completo para **download, extração de texto (OCR), tradução e leitura** de mangás e manhwas. Composto por um servidor web Node.js e uma extensão Chrome para captura de capítulos diretamente de qualquer site.

---

## Funcionalidades

### Servidor Web
- **Cadastro de obras** — cria pasta no disco com slug do título e registra no banco de dados.
- **Cadastro de capítulos** — via extensão Chrome (API REST).
- **Download de imagens** — download com concorrência configurável, retry automático e progresso em tempo real.
- **Pipeline automático** — ao enviar capítulo pela extensão, o download e extração OCR rodam automaticamente em background.
- **Extração de texto (OCR)** — Google Cloud Vision API para detectar blocos de texto, posição, idioma e confiança.
- **Tradução** — Google Cloud Translation API para traduzir os textos extraídos (pt-BR, en, es, etc.).
- **Leitor web** — visualização do capítulo com overlays de tradução posicionados sobre os textos originais, navegação entre capítulos, controles de largura, atalhos de teclado e fullscreen.
- **Polling em tempo real** — página da obra atualiza badges de status (download, pipeline, extração, tradução) a cada 5 segundos sem recarregar.
- **Controle de leitura** — capítulos marcados como lidos automaticamente ao abrir o reader.
- **Tema claro/escuro** — alternância com persistência no `localStorage`.

### Extensão Chrome (Side Panel)
- **Captura de imagens** — selecione qualquer container de imagens em uma página com um clique.
- **Drag & drop** — reordene as imagens antes de enviar.
- **Scroll-to-image** — clique na thumbnail para navegar até a imagem na página.
- **Envio direto** — envia capítulo + URLs de imagens ao servidor pela API.
- **Atualização de seleção** — reaplica o seletor CSS salvo para capturar novas imagens do mesmo container.
- **Auto-incremento** — número do capítulo incrementa automaticamente após cada envio.

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Node.js, Express 4, EJS |
| Banco de dados | MySQL 5.7+, Sequelize 6 |
| OCR | Google Cloud Vision API |
| Tradução | Google Cloud Translation API v2 |
| HTTP | Axios |
| Extensão | Chrome Extension Manifest V3, Side Panel API |

---

## Pré-requisitos

- **Node.js** >= 16
- **MySQL** 5.7+
- **Google Cloud** — Service Account com Vision API e Translation API habilitadas
- **Google Chrome** (para a extensão)

---

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/leitor-mangas.git
cd leitor-mangas
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
DB_USER=root
DB_PASS=sua_senha
DB_NAME=leitor_db
DB_HOST=127.0.0.1
DB_PORT=3306
PORT=3000
```

### 4. Configurar Google Cloud

Coloque o arquivo de credenciais em `config/service-account.json`. A Service Account precisa ter as roles:
- Cloud Vision API User
- Cloud Translation API User

### 5. Criar o banco de dados

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS leitor_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

O Sequelize sincroniza automaticamente as tabelas ao iniciar o servidor.

### 6. Iniciar o servidor

```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`.

---

## Extensão Chrome

### Instalação

1. Acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension/`

### Uso

1. Clique no ícone da extensão na toolbar para abrir o Side Panel
2. Selecione a **obra** no dropdown
3. Informe o **número do capítulo**
4. Clique em **Selecionar** e clique no container de imagens na página
5. Reordene as imagens se necessário (drag & drop)
6. Clique em **Enviar capítulo**

O pipeline automático inicia o download e extração OCR em background.

---

## Estrutura do Projeto

```
├── config/                  # Configuração do banco e credenciais
│   ├── config.js
│   └── service-account.json
├── chrome-extension/        # Extensão Chrome (MV3 Side Panel)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── shared.js
│   ├── sidebar.html/js/css
│   └── icons/
├── migrations/              # Migrations Sequelize
├── obras/                   # Imagens baixadas (slug/cap_N/)
├── src/
│   ├── app.js               # Entry point Express
│   ├── downloader.js         # Download com concorrência e retry
│   ├── pipeline.js           # Pipeline automático (download → OCR)
│   ├── translator.js         # OCR + tradução via Google Cloud
│   ├── models/               # Sequelize models (Obra, Capitulo, Imagem, Extraction)
│   ├── routes/
│   │   ├── api.js            # API REST para extensão
│   │   ├── capitulos.js      # CRUD capítulos + download/extract/translate
│   │   ├── obras.js          # CRUD obras
│   │   └── ui.js             # Rotas das views EJS

│   ├── views/                # Templates EJS
│   └── public/               # CSS e JS do frontend
└── package.json
```

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor na porta 3000 |
| `npm run dev` | Inicia em modo desenvolvimento |
| `npm run migrate` | Executa migrations pendentes |
| `npm test` | Executa testes com Jest |

---

## API

### `POST /api/chapters/submit`

Endpoint usado pela extensão Chrome para enviar capítulos.

```json
{
  "obra_id": "1",
  "capitulo_numero": 5,
  "url": "https://site.com/manga/cap-5",
  "imagens_url": [
    "https://site.com/img/001.jpg",
    "https://site.com/img/002.jpg"
  ]
}
```

**Resposta:** `201 Created` com o capítulo e imagens criados. O pipeline de download + OCR inicia automaticamente em background.

---

## Licença

MIT