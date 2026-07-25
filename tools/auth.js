const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec } = require("child_process");
const { google } = require("googleapis");

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".config",
  "open-google-workspace"
);
const TOKEN_PATH = path.join(CONFIG_DIR, "accounts.json");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

let activeAuthServer = null;

function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (key && val && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(CONFIG_DIR, ".env"));

function ensureTokenStore() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(TOKEN_PATH)) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ defaultAccount: "", accounts: {} }, null, 2));
  }
}

function loadTokenStore() {
  ensureTokenStore();
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    return { defaultAccount: "", accounts: {} };
  }
}

function saveTokenStore(store) {
  ensureTokenStore();
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(store, null, 2));
}

function loadCredentials() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const localCredsPath = path.join(__dirname, "..", "credentials.json");
  const targetCredsPath = fs.existsSync(localCredsPath) ? localCredsPath : CREDENTIALS_PATH;

  if (fs.existsSync(targetCredsPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(targetCredsPath, "utf8"));
      const installed = creds.installed || creds.web || creds;
      clientId = clientId || installed.client_id;
      clientSecret = clientSecret || installed.client_secret;
      if (!redirectUri && installed.redirect_uris && installed.redirect_uris.length > 0) {
        redirectUri = installed.redirect_uris[0];
      }
    } catch {}
  }

  redirectUri = redirectUri || "http://localhost:8080/oauth/callback";

  return { clientId, clientSecret, redirectUri };
}

function openBrowser(url) {
  try {
    const startCmd = process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
    exec(startCmd);
  } catch {}
}

function extractCode(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsedUrl = new URL(trimmed);
      const code = parsedUrl.searchParams.get("code");
      if (code) return code;
    } catch {}
  }
  return trimmed;
}

function resolveAccount(requestedAccount) {
  const store = loadTokenStore();
  if (requestedAccount && store.accounts[requestedAccount]) {
    return requestedAccount;
  }
  if (store.defaultAccount && store.accounts[store.defaultAccount]) {
    return store.defaultAccount;
  }
  const accounts = Object.keys(store.accounts);
  if (accounts.length > 0) return accounts[0];
  return requestedAccount || null;
}

function getGoogleAuthClient(requestedAccount, customRedirectUri) {
  const activeAccount = resolveAccount(requestedAccount);
  const store = loadTokenStore();
  const accInfo = activeAccount ? store.accounts[activeAccount] : null;

  const { clientId, clientSecret, redirectUri: defaultRedirect } = loadCredentials();
  const redirectUri = customRedirectUri || defaultRedirect;

  const isCredentialsMissing = !clientId || !clientSecret;

  const oauth2Client = new google.auth.OAuth2(
    clientId || "missing_client_id",
    clientSecret || "missing_client_secret",
    redirectUri
  );

  if (accInfo && accInfo.tokens) {
    oauth2Client.setCredentials(accInfo.tokens);
  }

  const scopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly"
  ];

  const authUrl = isCredentialsMissing ? "" : oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    ...(activeAccount ? { login_hint: activeAccount } : {})
  });

  return {
    oauth2Client,
    activeAccount,
    isCredentialsMissing,
    isConfigured: !!(accInfo && accInfo.tokens),
    requiresLogin: !accInfo || !accInfo.tokens,
    authUrl,
    redirectUri
  };
}

function startLoopbackListener(account, port = 8080) {
  if (activeAuthServer) {
    try { activeAuthServer.close(); } catch {}
  }

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);
      const code = reqUrl.searchParams.get("code");
      const redirectUri = `http://localhost:${port}/oauth/callback`;

      if (code) {
        try {
          const { oauth2Client } = getGoogleAuthClient(account, redirectUri);
          const { tokens } = await oauth2Client.getToken(code);
          const store = loadTokenStore();
          store.accounts[account] = {
            email: account,
            authenticatedAt: new Date().toISOString(),
            status: "active",
            tokens
          };
          if (!store.defaultAccount) store.defaultAccount = account;
          saveTokenStore(store);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Pyintel Arc — Authentication Successful</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: rgba(18, 20, 29, 0.8); border: 1px solid rgba(255,255,255,0.12); padding: 40px; border-radius: 24px; text-align: center; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
                h1 { color: #10b981; font-size: 26px; margin-bottom: 12px; }
                p { color: #9ca3af; font-size: 15px; line-height: 1.6; }
                .badge { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 6px 14px; border-radius: 99px; font-weight: 600; font-size: 13px; display: inline-block; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="badge">✓ Google OAuth Authenticated</div>
                <h1>⚡ Welcome back!</h1>
                <p>Successfully authenticated <strong>${account}</strong> for Pyintel Arc.</p>
                <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">You may now close this browser tab and return to your terminal.</p>
              </div>
            </body>
            </html>
          `);

          setTimeout(() => {
            try { server.close(); } catch {}
          }, 1500);

        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`<h1>Authentication Failed</h1><p>${err.message}</p>`);
        }
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>No authorization code found in request</h1>");
      }
    });

    server.listen(port, "127.0.0.1", () => {
      activeAuthServer = server;
      resolve(`http://localhost:${port}/oauth/callback`);
    }).on("error", () => {
      resolve(null);
    });
  });
}

module.exports = {
  resolveAccount,
  getGoogleAuthClient,
  loadCredentials,

  auth_login: {
    description: "Initiate or complete Google OAuth login for a user's email address. Automatically launches a local loopback server to catch authentication callbacks without manual code copying.",
    args: {
      account: { type: "string", description: "Email address or account alias to register (e.g. user@gmail.com)" },
      code: { type: "string", description: "Authorization code OR full redirect URL returned from Google OAuth browser login" },
      isDefault: { type: "boolean", description: "Set this account as the default account" }
    },
    async execute({ account, code, isDefault = false }) {
      if (!account) {
        return JSON.stringify({
          status: "error",
          error: "Please specify an email address to log in (e.g. auth_login({ account: 'user@gmail.com' }))"
        }, null, 2);
      }

      const store = loadTokenStore();
      const extractedCode = extractCode(code);

      if (extractedCode) {
        const { oauth2Client } = getGoogleAuthClient(account);
        try {
          const { tokens } = await oauth2Client.getToken(extractedCode);
          store.accounts[account] = {
            email: account,
            authenticatedAt: new Date().toISOString(),
            status: "active",
            tokens
          };
          if (isDefault || !store.defaultAccount) {
            store.defaultAccount = account;
          }
          saveTokenStore(store);
          return JSON.stringify({
            status: "authenticated",
            account,
            isDefault: store.defaultAccount === account,
            message: `Tokens obtained and saved successfully for ${account}.`
          }, null, 2);
        } catch (err) {
          return JSON.stringify({ status: "error", error: `Failed to exchange auth code: ${err.message}` }, null, 2);
        }
      }

      // Start zero-touch loopback listener on port 8080 or fallback to static redirect
      const loopbackRedirect = await startLoopbackListener(account, 8080);
      const { authUrl } = getGoogleAuthClient(account, loopbackRedirect || undefined);

      store.accounts[account] = store.accounts[account] || {
        email: account,
        authenticatedAt: new Date().toISOString(),
        status: "pending_oauth"
      };
      if (isDefault || !store.defaultAccount) store.defaultAccount = account;
      saveTokenStore(store);

      openBrowser(authUrl);

      return JSON.stringify({
        status: "pending_authorization",
        account,
        authUrl,
        browserOpened: true,
        zeroTouchLoopback: !!loopbackRedirect,
        instructions: loopbackRedirect
          ? `Opened Google OAuth Login in your browser. Once you click Allow, Arc will automatically complete login without you needing to paste any code!`
          : `Opened Google OAuth Login in your browser. Copy the redirect URL or code and pass it back to auth_login({ account: "${account}", code: "YOUR_CODE" })`
      }, null, 2);
    }
  },

  auth_logout: {
    description: "Log out and remove stored OAuth tokens for a specific Google account (or all accounts). Does NOT delete client credentials.json.",
    args: {
      account: { type: "string", description: "Email address to log out (optional, removes specified or default account)" },
      all: { type: "boolean", description: "Set true to log out all stored accounts" }
    },
    async execute({ account, all = false }) {
      const store = loadTokenStore();
      if (all) {
        store.accounts = {};
        store.defaultAccount = "";
        saveTokenStore(store);
        return JSON.stringify({ status: "success", message: "Logged out all accounts. User tokens cleared." }, null, 2);
      }
      const target = account || store.defaultAccount;
      if (target && store.accounts[target]) {
        delete store.accounts[target];
        if (store.defaultAccount === target) {
          store.defaultAccount = Object.keys(store.accounts)[0] || "";
        }
        saveTokenStore(store);
        return JSON.stringify({ status: "success", account: target, message: `Logged out ${target}.` }, null, 2);
      }
      return JSON.stringify({ status: "error", error: "No matching account found to log out." }, null, 2);
    }
  },

  auth_list_accounts: {
    description: "List all authenticated Google accounts and show the current default account.",
    args: {},
    async execute() {
      const store = loadTokenStore();
      const accountList = Object.keys(store.accounts).map((email) => ({
        email,
        isDefault: email === store.defaultAccount,
        status: store.accounts[email].status,
        authenticatedAt: store.accounts[email].authenticatedAt,
        hasLiveTokens: !!store.accounts[email].tokens
      }));
      return JSON.stringify({
        status: "success",
        defaultAccount: store.defaultAccount || null,
        totalAccounts: accountList.length,
        accounts: accountList
      }, null, 2);
    }
  },

  auth_set_default: {
    description: "Set the default Google account for Workspace tool executions.",
    args: {
      account: { type: "string", description: "Email address to set as default" }
    },
    async execute({ account }) {
      const store = loadTokenStore();
      if (!store.accounts[account]) {
        return JSON.stringify({ status: "error", error: `Account ${account} has not been logged in yet. Run auth_login first.` }, null, 2);
      }
      store.defaultAccount = account;
      saveTokenStore(store);
      return JSON.stringify({ status: "success", defaultAccount: account, message: `Set ${account} as default account.` }, null, 2);
    }
  }
};
