const { exec } = require('child_process');
const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// WebSocket connection to backend
let stompClient = null;
let sessionId = null;

function connectToBackend() {
  const socket = new SockJS(`${BACKEND_URL}/ws`);
  stompClient = Stomp.over(socket);
  
  stompClient.connect({}, (frame) => {
    console.log('Conectado ao backend:', frame);
    
    // Register this middleware session
    stompClient.send('/app/printer/connect', {}, JSON.stringify({}));
    
    // Subscribe to printer messages
    stompClient.subscribe('/printer/middleware', (message) => {
      handleBackendMessage(JSON.parse(message.body));
    });
  }, (error) => {
    console.error('Erro na conexão com backend:', error);
    setTimeout(connectToBackend, 5000);
  });
}

function handleBackendMessage(data) {
  if (data.action === 'getPrinters') {
    getPrinters().then(printers => {
      stompClient.send('/app/printer/response', {}, JSON.stringify({
        action: 'printersResponse',
        requestId: data.requestId,
        printers: printers
      }));
    });
  } else if (data.action === 'print') {
    printContent(data.printerName, data.content).then(() => {
      stompClient.send('/app/printer/response', {}, JSON.stringify({
        action: 'printResponse',
        requestId: data.requestId,
        success: true
      }));
    }).catch(() => {
      stompClient.send('/app/printer/response', {}, JSON.stringify({
        action: 'printResponse',
        requestId: data.requestId,
        success: false
      }));
    });
  }
}

// Connect to backend on startup
connectToBackend();

// Get available printers using PowerShell
function getPrinters() {
  return new Promise((resolve, reject) => {
    exec('powershell "Get-Printer | Select-Object Name | ConvertTo-Json"', (error, stdout) => {
      if (error) {
        console.error('Erro ao buscar impressoras:', error);
        resolve([{ id: 'Microsoft Print to PDF', name: 'Microsoft Print to PDF' }]);
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        const printers = Array.isArray(result) 
          ? result.map(p => ({ id: p.Name, name: p.Name }))
          : [{ id: result.Name, name: result.Name }];
        
        resolve(printers.length > 0 ? printers : [{ id: 'Microsoft Print to PDF', name: 'Microsoft Print to PDF' }]);
      } catch (parseError) {
        console.error('Erro ao processar impressoras:', parseError);
        resolve([{ id: 'Microsoft Print to PDF', name: 'Microsoft Print to PDF' }]);
      }
    });
  });
}

// Print using PowerShell with thermal printer formatting
function printContent(printerName, content) {
  return new Promise((resolve, reject) => {
    const tempFile = `temp_${Date.now()}.txt`;
    const fs = require('fs');
    
    // Format content for 58mm thermal printer (32 characters width)
    const formattedContent = content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => {
        if (line.length > 32) {
          return line.substring(0, 32);
        }
        return line;
      })
      .join('\n');
    
    fs.writeFileSync(tempFile, formattedContent);
    
    const psCommand = `Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Printing; $printer = New-Object System.Drawing.Printing.PrintDocument; $printer.PrinterSettings.PrinterName = '${printerName}'; $content = Get-Content '${tempFile}' -Raw; $printer.add_PrintPage({param($sender, $e) $font = New-Object System.Drawing.Font('Courier New', 8); $e.Graphics.DrawString($content, $font, [System.Drawing.Brushes]::Black, 0, 0)}); $printer.Print()`;
    
    exec(`powershell "${psCommand}"`, (error) => {
      fs.unlinkSync(tempFile);
      
      if (error) {
        console.error('Erro na impressão:', error);
        resolve();
      } else {
        resolve();
      }
    });
  });
}

console.log(`Printer Middleware iniciado`);
console.log(`Conectando ao backend: ${BACKEND_URL}`);