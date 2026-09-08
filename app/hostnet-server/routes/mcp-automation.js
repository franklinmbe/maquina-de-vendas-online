const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { buildServer } = require('../lib/mcp-automation-server');

// Endpoint MCP da rotina de geração automática (ver lib/mcp-automation-server.js
// pro porquê disso existir). Protegido por um token próprio na própria URL
// (AUTOMATION_MCP_TOKEN, .env da VPS) — mesmo padrão que a Postiz usa nos
// conectores dela (chave na URL do conector, nunca em texto de prompt).
// Stateless: cada chamada MCP cria seu próprio McpServer/transport, não
// precisa manter sessão entre chamadas.
module.exports = async function handler(req, res) {
  const token = req.params.token;
  if (!process.env.AUTOMATION_MCP_TOKEN || token !== process.env.AUTOMATION_MCP_TOKEN) {
    res.status(404).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST' });
    return;
  }

  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
