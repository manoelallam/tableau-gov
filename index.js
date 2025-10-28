import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const CLIENT_ID = "tableau-client";
const CLIENT_SECRET = "secret123";
const REDIRECT_URI = "http://localhost:3000/auth/callback";
const ISSUER = "http://localhost:3000";

// --- Página inicial simulando o Tableau ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "tableau.html"));
});

// --- Endpoint que o Tableau chamaria para iniciar o login OpenID ---
app.get("/auth/openid/login", (req, res) => {
  const authUrl = `${ISSUER}/govbr/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=openid%20profile`;
  res.redirect(authUrl);
});

// --- Página de login do GOV.BR (simulada) ---
app.get("/govbr/authorize", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "govbr-login.html"));
});

// --- Login do GOV.BR e redirecionamento ---
app.post("/govbr/login", (req, res) => {
  const { username } = req.body;
  const redirect_uri = REDIRECT_URI;
  const code = Buffer.from(username).toString("base64");
  res.redirect(`${redirect_uri}?code=${code}`);
});

// --- Endpoint de token (como o GOV.BR devolveria) ---
app.post("/govbr/token", (req, res) => {
  const { code, client_id, client_secret } = req.body;
  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET) {
    return res.status(401).json({ error: "invalid_client" });
  }

  const username = Buffer.from(code, "base64").toString("utf8");
  const token = jwt.sign(
    { sub: username, name: username, iss: ISSUER },
    "mock_secret",
    { expiresIn: "1h" }
  );

  res.json({
    access_token: token,
    id_token: token,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

// --- Endpoint userinfo ---
app.get("/govbr/userinfo", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "missing_token" });

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, "mock_secret");
    res.json({ sub: decoded.sub, name: decoded.name });
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
});

// --- Configuração OpenID (para o Tableau descobrir os endpoints) ---
// app.get("/.well-known/openid-configuration", (req, res) => {
//   res.json({
//     issuer: ISSUER,
//     authorization_endpoint: `${ISSUER}/govbr/authorize`,
//     token_endpoint: `${ISSUER}/govbr/token`,
//     userinfo_endpoint: `${ISSUER}/govbr/userinfo`,
//     response_types_supported: ["code"],
//     subject_types_supported: ["public"],
//     id_token_signing_alg_values_supported: ["HS256"],
//   });
// });


const EAS_BASE_URL = "https://bb1a65d82103.ngrok-free.app";

app.get("/.well-known/openid-configuration", (req, res) => {
  res.json({
    issuer: EAS_BASE_URL,
    authorization_endpoint: `${EAS_BASE_URL}/auth/authorize`,
    token_endpoint: `${EAS_BASE_URL}/exchange-token`,
    jwks_uri: `${EAS_BASE_URL}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["HS256"]
  });
});

// --- Callback final (Tableau receberia o código aqui) ---
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  // Em um caso real, o Tableau trocaria o code pelo token.
  // Aqui faremos isso manualmente.
  res.send(`
    <h2>Login bem-sucedido via GOV.BR (simulado)</h2>
    <p>Código de autorização recebido: <b>${code}</b></p>
    <form action="/exchange-token" method="POST">
      <input type="hidden" name="code" value="${code}" />
      <button type="submit">Trocar por Token</button>
    </form>
  `);

  
});

// --- Endpoint auxiliar para simular a troca do code pelo token ---
app.post("/exchange-token", bodyParser.urlencoded({ extended: true }), async (req, res) => {
  const { code } = req.body;

  const response = await fetch("http://localhost:3000/govbr/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await response.json();

  res.send(`
    <h3>Token obtido com sucesso!</h3>
    <pre>${JSON.stringify(tokenData, null, 2)}</pre>
  `);
});

app.listen(PORT, () =>
  console.log(`✅ Servidor OIDC simulado rodando em http://localhost:${PORT}`)
);
