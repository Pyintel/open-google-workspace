const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".config",
  "open-google-workspace"
);
const TOKEN_PATH = path.join(CONFIG_DIR, "accounts.json");

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
  return requestedAccount || "default@google.com";
}

function getGoogleAuthClient(requestedAccount) {
  const activeAccount = resolveAccount(requestedAccount);
  const store = loadTokenStore();
  const accInfo = store.accounts[activeAccount];

  const clientId = process.env.GOOGLE_CLIENT_ID || "pyintel_arc_client_id";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "pyintel_arc_client_secret";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8080/oauth/callback";

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (accInfo && accInfo.tokens) {
    oauth2Client.setCredentials(accInfo.tokens);
  }

  return { oauth2Client, activeAccount, isConfigured: !!(accInfo && accInfo.tokens) };
}

module.exports = {
  resolveAccount,
  getGoogleAuthClient,

  auth_login: {
    description: "Authenticate a new Google account via OAuth and save tokens.",
    args: {
      account: { type: "string", description: "Email address or account alias to register" },
      code: { type: "string", description: "Authorization code returned from OAuth callback" },
      isDefault: { type: "boolean", description: "Set this account as the default account" }
    },
    async execute({ account, code, isDefault = false }) {
      const { oauth2Client } = getGoogleAuthClient(account);
      const store = loadTokenStore();

      const scopes = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/contacts.readonly"
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
        login_hint: account
      });

      if (code) {
        try {
          const { tokens } = await oauth2Client.getToken(code);
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

      return JSON.stringify({
        status: "pending_authorization",
        account,
        authUrl,
        instructions: `Open the authUrl in your browser to complete Google OAuth consent, then pass the returned code back to auth_login({ account: "${account}", code: "YOUR_CODE" })`
      }, null, 2);
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
        defaultAccount: store.defaultAccount,
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
        store.accounts[account] = { email: account, authenticatedAt: new Date().toISOString(), status: "active" };
      }
      store.defaultAccount = account;
      saveTokenStore(store);
      return JSON.stringify({ status: "success", defaultAccount: account, message: `Set ${account} as default account.` }, null, 2);
    }
  }
};
