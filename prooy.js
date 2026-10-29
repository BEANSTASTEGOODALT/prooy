const http = require('http');
const https = require('https');
const url = require('url');
const cheerio = require('cheerio');

const PORT = 3000;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Error: Please provide a target URL using ?url=');
        return;
    }

    const targetParsed = new URL(targetUrl);
    const client = targetParsed.protocol === 'https:' ? https : http;

    client.get(targetUrl, (proxyRes) => {
        let body = '';
        
        // Check if it's HTML so we can rewrite links
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            proxyRes.on('data', chunk => { body += chunk; });
            proxyRes.on('end', () => {
                const $ = cheerio.load(body);

                // Rewrite attributes to route through the proxy
                const rewriteUrl = (originalPath) => {
                    if (!originalPath) return originalPath;
                    try {
                        const absolute = new URL(originalPath, targetUrl).toString();
                        return `/?url=${encodeURIComponent(absolute)}`;
                    } catch (e) {
                        return originalPath;
                    }
                };

                $('[href]').each((i, el) => $(el).attr('href', rewriteUrl($(el).attr('href'))));
                $('[src]').each((i, el) => $(el).attr('src', rewriteUrl($(el).attr('src'))));

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end($.html());
            });
        } else {
            // For non-HTML assets (images, CSS, JS), pipe directly
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }
    }).on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Proxy Error: ${err.message}`);
    });
});

server.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
});
