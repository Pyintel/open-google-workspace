import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { google } from "googleapis";
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".config",
  "open-google-workspace"
);
const TOKEN_PATH = path.join(CONFIG_DIR, "accounts.json");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

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

export function loadCredentials() {
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

  redirectUri = redirectUri || "http://localhost";

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

export function resolveAccount(requestedAccount) {
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

export function getGoogleAuthClient(requestedAccount, customRedirectUri) {
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

const __exports = {
  resolveAccount,
  getGoogleAuthClient,
  loadCredentials,

  auth_login: {
    description: "Initiate or complete Google OAuth login for a user's email address. Automatically uses authorized redirect URI matching credentials.json.",
    args: {
      account: { type: "string", description: "Email address or account alias to register (e.g. user@gmail.com)" },
      code: { type: "string", description: "Authorization code OR full redirect URL returned from Google OAuth browser login" },
      redirectUri: { type: "string", description: "Optional custom redirect URI override (e.g. https://auth.pyintel.cc/oauth/callback or http://localhost)" },
      isDefault: { type: "boolean", description: "Set this account as the default account" }
    },
    async execute({ account, code, redirectUri, isDefault = false }) {
      if (!account) {
        return JSON.stringify({
          status: "error",
          error: "Please specify an email address to log in (e.g. auth_login({ account: 'user@gmail.com' }))"
        }, null, 2);
      }

      const { oauth2Client, authUrl, isCredentialsMissing, redirectUri: activeRedirect } = getGoogleAuthClient(account, redirectUri);

      if (isCredentialsMissing) {
        return JSON.stringify({
          status: "credentials_required",
          error: "Google Cloud OAuth Client Credentials required.",
          message: `To connect to Google's real servers, you need a Google Cloud OAuth Client ID.`,
          setupInstructions: [
            "1. Paste your downloaded Google OAuth Client ID and Client Secret into environment variables or .env file.",
            "2. Or place your downloaded JSON file into: " + CREDENTIALS_PATH,
            "3. .gitignore is configured to guarantee no credentials will ever be pushed to git."
          ],
          credentialsPath: CREDENTIALS_PATH
        }, null, 2);
      }

      const store = loadTokenStore();
      const extractedCode = extractCode(code);

      if (extractedCode) {
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
        activeRedirect,
        browserOpened: true,
        instructions: `Opened Google OAuth Login in your default browser (using redirect ${activeRedirect})! Once authorized, copy the code/URL from your browser and pass it back to auth_login({ account: "${account}", code: "YOUR_URL_OR_CODE" })`
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

export const auth_login = __exports.auth_login;
export const auth_logout = __exports.auth_logout;
export const auth_list_accounts = __exports.auth_list_accounts;
export const auth_set_default = __exports.auth_set_default;
