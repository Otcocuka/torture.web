const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Прокси для DeepSeek
app.post('/api/deepseek/chat/completions', (req, res) => {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.headers['api-key'];

    if (!apiKey) {
        console.log('❌ Ошибка: Нет API ключа для DeepSeek');
        return res.status(400).json({ error: "API Key missing" });
    }

    console.log('\n[Proxy] DeepSeek request received');
    console.log('[Proxy] Payload:', JSON.stringify(req.body, null, 2).substring(0, 500) + '...');

    const payload = JSON.stringify(req.body);

    const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        console.log(`[Proxy] DeepSeek Status: ${proxyRes.statusCode}`);
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            console.log(`[Proxy] DeepSeek Response (first 500 chars):`, data.substring(0, 500));
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(data);
        });
    });

    proxyReq.on('error', (e) => {
        console.error(`[Proxy] DeepSeek Error: ${e.message}`);
        res.status(500).json({ error: 'DeepSeek Proxy Error', message: e.message });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    console.log(`🤖 DeepSeek: http://localhost:${PORT}/api/deepseek/chat/completions`);
});

app.post('/api/feedback', (req, res) => {
    const data = req.body;
    const logFile = 'feedback.json';
    let logs = [];
    try {
        if (fs.existsSync(logFile)) {
            logs = JSON.parse(fs.readFileSync(logFile));
        }
    } catch(e) {}
    logs.push({ timestamp: Date.now(), ...data });
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    res.json({ success: true });
});