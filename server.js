
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

// Function to get the machine's best IP, prioritizing Public over Private
const getBestIP = () => {
    const interfaces = os.networkInterfaces();
    let privateIP = null;
    let publicIP = null;

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-ipv4
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.').map(Number);
                
                // Check if IP is in private ranges (RFC 1918)
                // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                const isPrivate = 
                    (parts[0] === 10) ||
                    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
                    (parts[0] === 192 && parts[1] === 168);

                if (!isPrivate) {
                    publicIP = iface.address; // Found a Public IP!
                } else if (!privateIP) {
                    privateIP = iface.address; // Keep as backup
                }
            }
        }
    }
    
    // Return Public IP if found, otherwise Network IP, otherwise wildcard
    return publicIP || privateIP || '0.0.0.0';
};

const HOST = getBestIP();

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
    // CORS headers - Allow everything
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
    
    if (HOST.startsWith('192.168') || HOST.startsWith('10.') || HOST.startsWith('172.')) {
        console.log(`\n⚠️  NOTE: Bound to Network IP (${HOST}) because no direct Public IP was found on the network card.`);
        console.log(`   If you are behind a router, this IS correct. Use Port Forwarding on your router to expose this IP.`);
    } else {
        console.log(`\n✅ Bound to Public/Direct IP: ${HOST}`);
    }
});
