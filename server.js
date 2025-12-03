const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { exec } = require('child_process');

const app = express();
const PORT = 8183;

app.use(cors());
app.use(express.json());

// WebSocket Server
const wss = new WebSocket.Server({ port: 8184 });

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

// Get available printers
app.get('/printers', async (req, res) => {
  try {
    const printers = await getPrinters();
    res.json(printers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Print content
app.post('/print', async (req, res) => {
  try {
    const { printerName, content } = req.body;
    await printContent(printerName, content);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Cliente conectado');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.action === 'getPrinters') {
        const printers = await getPrinters();
        ws.send(JSON.stringify({ action: 'printers', data: printers }));
      }
      
      if (data.action === 'print') {
        try {
          await printContent(data.printerName, data.content);
          ws.send(JSON.stringify({ action: 'printSuccess' }));
        } catch (error) {
          ws.send(JSON.stringify({ action: 'printError', error: error.message }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({ action: 'error', error: error.message }));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Printer Middleware rodando na porta ${PORT}`);
  console.log(`WebSocket rodando na porta 8184`);
});