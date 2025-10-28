import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { nanoid } from "nanoid";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EAS_BASE_URL = process.env.EAS_BASE_URL || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.CLIENT_ID || "tableau-client";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "supersecret";

console.log("✅ EAS rodando em:", EAS_BASE_URL);

// Armazena códigos temporários
const fakeAuthCodes = {};

// ✅ Endpoint de saúde
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API rodando com sucesso 🚀",
    timestamp: new Date().toISOString(),
  });
});

// ========================================================
// 1️⃣ Endpoint de descoberta (.well-known)
// ========================================================
app.get("/.well-known/openid-configuration", (req, res) => {
  const config = {
    issuer: EAS_BASE_URL,
    authorization_endpoint: `${EAS_BASE_URL}/authorize`,
    token_endpoint: `${EAS_BASE_URL}/token`,
    jwks_uri: `${EAS_BASE_URL}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["HS256"],
  };

  console.log("\n📡 [DISCOVERY] Retornando configuração OIDC:");
  console.log(config);

  res.json(config);
});

// ========================================================
// 2️⃣ JWKS - chave pública simulada
// ========================================================
app.get("/.well-known/jwks.json", (req, res) => {
  const jwks = {
    keys: [
      {
        kty: "oct",
        alg: "HS256",
        kid: "simulated-key",
        use: "sig",
        k: Buffer.from(CLIENT_SECRET).toString("base64"),
      },
    ],
  };

  console.log("\n🔑 [JWKS] Enviando chave simulada");
  res.json(jwks);
});

// ========================================================
// 3️⃣ Autorização (simula login do usuário Gov.br)
// ========================================================
app.get("/authorize", (req, res) => {
  const { client_id, redirect_uri, state } = req.query;

  console.log("\n🚪 [AUTHORIZE] Solicitação recebida:");
  console.log("client_id:", client_id);
  console.log("redirect_uri:", redirect_uri);
  console.log("state:", state);

  if (client_id !== CLIENT_ID) {
    console.error("❌ Client ID inválido");
    return res.status(400).send("Client ID inválido");
  }

  const code = nanoid(8);
  fakeAuthCodes[code] = { client_id, redirect_uri };

  console.log("✅ Login simulado concluído. Código gerado:", code);

  res.send(`
    <h2>Login bem-sucedido via GOV.BR (simulado)</h2>
    <p>Usuário autenticado com sucesso.</p>
    <p><b>Código gerado:</b> ${code}</p>
    <form action="${redirect_uri}" method="get">
      <input type="hidden" name="code" value="${code}">
      <input type="hidden" name="state" value="${state}">
      <button type="submit">Continuar para Tableau</button>
    </form>
  `);
});

// ========================================================
// 4️⃣ Troca de código por token
// ========================================================
app.post("/token", (req, res) => {
  console.log("\n🔄 [TOKEN] Requisição recebida:");
  console.log(req.body);

  const { code, client_id, client_secret, redirect_uri } = req.body;

  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET) {
    console.error("❌ Credenciais inválidas");
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  if (!fakeAuthCodes[code]) {
    console.error("❌ Código inválido ou expirado");
    return res.status(400).json({ error: "Código inválido ou expirado" });
  }

  const now = Math.floor(Date.now() / 1000);

  const id_token = jwt.sign(
    {
      iss: EAS_BASE_URL,
      sub: "user123",
      aud: CLIENT_ID,
      email: "usuario@gov.br",
      name: "Usuário Gov.br Simulado",
      iat: now,
      exp: now + 3600,
    },
    CLIENT_SECRET,
    { algorithm: "HS256", keyid: "simulated-key" }
  );

  delete fakeAuthCodes[code];

  const response = {
    access_token: "fake_access_token",
    id_token,
    token_type: "Bearer",
    expires_in: 3600,
  };

  console.log("✅ [TOKEN] Enviando resposta:");
  console.log(response);

  res.json(response);
});

// ========================================================
// Inicializa servidor
// ========================================================
app.listen(PORT, () => {
  console.log(`🚀 EAS simulado rodando em ${EAS_BASE_URL}`);
  console.log(`📘 Endpoint de descoberta: ${EAS_BASE_URL}/.well-known/openid-configuration`);
});
