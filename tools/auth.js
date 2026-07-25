const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".config",
  "open-google-workspace",
  "accounts.json"
);

function ensureTokenStore() {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

module.exports = {
  resolveAccount,
  auth_login: {
    description: "Authenticate a new Google account via OAuth and save tokens.",
    args: {
      account: { type: "string", description: "Email address or account alias to register" },
      isDefault: { type: "boolean", description: "Set this account as the default account" }
    },
    async execute({ account, isDefault = false }) {
      const store = loadTokenStore();
      store.accounts[account] = {
        email: account,
        authenticatedAt: new Date().toISOString(),
        status: "active",
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
      };
      if (isDefault || !store.defaultAccount) {
        store.defaultAccount = account;
      }
      saveTokenStore(store);
      return JSON.stringify({
        status: "authenticated",
        account,
        isDefault: store.defaultAccount === account,
        authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=pyintel_arc&redirect_uri=http://localhost:8080/oauth/callback&login_hint=${encodeURIComponent(account)}`,
        message: `Account ${account} registered successfully in multi-user token store.`
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
        authenticatedAt: store.accounts[email].authenticatedAt
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
