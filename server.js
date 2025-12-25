
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

const DB_FILE = path.join(publicDir, 'database.json');
const PORT = 3000;

// Function to get the machine's specific Network IP (not localhost)
const getNetworkIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-ipv4
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback
};

const HOST = getNetworkIP(); // Bind specifically to the network IP

// Initialize DB file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        users: [],
        conversations: [],
        roles: [],
        ads: [],
        countryBans: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    console.log("Created new database.json");
}

const server = http.createServer((req, res) => {
    // CORS headers - Allow everything for local P2P dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API: Get Database
    if (req.url === '/api/database' && req.method === 'GET') {
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error("Error reading DB:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read database' }));
                return;
            }
            // Add no-cache headers to ensure clients get latest messages
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(data);
        });
        return;
    }

    // API: Save Database
    if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                // Validate JSON
                const parsed = JSON.parse(body);
                // Basic validation
                if (!parsed.users || !parsed.conversations) {
                     throw new Error("Invalid DB structure");
                }
                
                fs.writeFile(DB_FILE, body, (err) => {
                    if (err) {
                        console.error('Error writing file:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to write to file' }));
                        return;
                    }
                    console.log(`[${new Date().toLocaleTimeString()}] Database saved (${body.length} bytes)`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                console.error("Invalid save request:", e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, HOST, () => {
    console.log(`\n🚀 Database Server running at http://${HOST}:${PORT}`);
    console.log(`📂 Database file: ${DB_FILE}`);
    console.log(`⚠️  Note: If you strictly bound to IP, localhost access may not work. Use the IP above in your app settings.`);
});
