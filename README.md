# Printer Middleware

Middleware para impressão local que substitui o QZ Tray.

## Instalação

1. Navegue até a pasta do middleware:
```bash
cd printer-middleware
```

2. Instale as dependências:
```bash
npm install
```

3. Execute o middleware:
```bash
npm start
```

## Funcionalidades

- **Porta HTTP**: 8183 (API REST)
- **Porta WebSocket**: 8184 (Comunicação em tempo real)
- **Detecção automática** de impressoras do sistema
- **Impressão silenciosa** sem pop-ups
- **API REST** para listagem e impressão

## Endpoints

### GET /printers
Retorna lista de impressoras disponíveis

### POST /print
Envia conteúdo para impressão
```json
{
  "printerName": "Nome da Impressora",
  "content": "Conteúdo a ser impresso"
}
```

## WebSocket

Conecte em `ws://localhost:8184` para comunicação em tempo real.

Mensagens suportadas:
- `getPrinters`: Solicita lista de impressoras
- `print`: Envia para impressão

## Requisitos

- Node.js 14+
- Windows (para detecção de impressoras)