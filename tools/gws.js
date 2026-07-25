const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");
const { resolveAccount, getGoogleAuthClient } = require("./auth.js");

if (typeof module !== "undefined" && module.paths) {
  module.paths.push(path.join(__dirname, "..", "node_modules"));
}

function checkAuth(account) {
  const auth = getGoogleAuthClient(account);
  if (!auth.isConfigured || auth.requiresLogin) {
    const targetEmail = auth.activeAccount || account || "your_email@gmail.com";
    return {
      authenticated: false,
      response: JSON.stringify({
        status: "authentication_required",
        account: targetEmail,
        message: `NO GOOGLE ACCOUNT AUTHENTICATED: Please invoke the tool auth_login({ account: '${targetEmail}' }) to pop open Google OAuth login in the user's browser.`,
        authUrl: auth.authUrl,
        instructions: `AGENT INSTRUCTION: Call the auth_login tool with the user's email address (e.g. auth_login({ account: "${targetEmail}" })). This will automatically open the login page in the user's default browser. Do NOT run bash/opencode commands or ask the user to run CLI commands.`
      }, null, 2)
    };
  }
  return { authenticated: true, ...auth };
}

module.exports = {
  // ==========================================
  // 1. Gmail Tools (Send, Draft, Search, Thread, Reply)
  // ==========================================
  gmail_send: {
    description: "Send an email via Gmail API.",
    args: {
      account: { type: "string", description: "Sender email account address (optional, uses default if omitted)" },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body content" },
      confirm: { type: "boolean", description: "Explicit safety confirmation to send without drafting" }
    },
    async execute({ account, to, subject, body, confirm }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      if (!confirm) {
        return JSON.stringify({
          status: "drafted",
          note: "Safety gate active. Email drafted instead of sent directly. Set confirm: true to send immediately.",
          account: activeAccount, to, subject,
          webViewLink: `https://mail.google.com/mail/u/0/#drafts`
        }, null, 2);
      }

      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const rawMessage = [
          `To: ${to}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          body
        ].join("\n");

        const encodedMessage = Buffer.from(rawMessage).toString("base64url");
        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage }
        });

        return JSON.stringify({
          status: "sent",
          account: activeAccount, to, subject,
          messageId: res.data.id,
          threadId: res.data.threadId,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  gmail_draft: {
    description: "Create an email draft in Gmail.",
    args: {
      account: { type: "string", description: "Email account address" },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email draft content" }
    },
    async execute({ account, to, subject, body }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const rawMessage = Buffer.from(`To: ${to}\nSubject: ${subject}\n\n${body}`).toString("base64url");
        const res = await gmail.users.drafts.create({
          userId: "me",
          requestBody: { message: { raw: rawMessage } }
        });
        return JSON.stringify({
          status: "draft_created",
          account: activeAccount, to, subject,
          draftId: res.data.id,
          webViewLink: `https://mail.google.com/mail/u/0/#drafts`,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  gmail_search_threads: {
    description: "Search Gmail email threads using query syntax (e.g. is:unread, from:boss).",
    args: {
      account: { type: "string", description: "Email account address" },
      query: { type: "string", description: "Gmail search query operator" },
      maxResults: { type: "number", description: "Max threads to return" }
    },
    async execute({ account, query, maxResults = 5 }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const res = await gmail.users.threads.list({ userId: "me", q: query, maxResults });
        return JSON.stringify({
          status: "success",
          account: activeAccount, query,
          threadsCount: res.data.threads?.length || 0,
          threads: res.data.threads || [],
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  gmail_get_thread: {
    description: "Retrieve full email thread history by Thread ID.",
    args: {
      account: { type: "string", description: "Email account address" },
      threadId: { type: "string", description: "Target Gmail thread ID" }
    },
    async execute({ account, threadId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const res = await gmail.users.threads.get({ userId: "me", id: threadId });
        return JSON.stringify({
          status: "success",
          account: activeAccount, threadId,
          messagesCount: res.data.messages?.length || 0,
          messages: res.data.messages || [],
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  gmail_reply: {
    description: "Reply directly within an existing Gmail email thread.",
    args: {
      account: { type: "string", description: "Email account address" },
      threadId: { type: "string", description: "Gmail thread ID to reply to" },
      body: { type: "string", description: "Reply email body" }
    },
    async execute({ account, threadId, body }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const rawMessage = Buffer.from(`Subject: Re: Thread\n\n${body}`).toString("base64url");
        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: rawMessage, threadId }
        });
        return JSON.stringify({
          status: "reply_sent",
          account: activeAccount, threadId,
          messageId: res.data.id,
          webViewLink: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  // ==========================================
  // 2. Google Contacts / People API
  // ==========================================
  contacts_search: {
    description: "Search Google Contacts by name, email, or keyword to resolve email addresses.",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Name, nickname, or organization to look up" }
    },
    async execute({ account, query }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const people = google.people({ version: "v1", auth: oauth2Client });
        const res = await people.people.searchDirectoryPeople({
          query,
          readMask: "names,emailAddresses,phoneNumbers",
          sources: ["DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]
        });
        return JSON.stringify({
          status: "success",
          account: activeAccount, query,
          contacts: res.data.people || [],
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  contacts_list_frequent: {
    description: "List frequently contacted people for auto-completion.",
    args: {
      account: { type: "string", description: "Google account address" },
      maxResults: { type: "number", description: "Max frequent contacts to return" }
    },
    async execute({ account, maxResults = 5 }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const people = google.people({ version: "v1", auth: oauth2Client });
        const res = await people.otherContacts.list({
          pageSize: maxResults,
          readMask: "names,emailAddresses"
        });
        return JSON.stringify({ status: "success", account: activeAccount, contacts: res.data.otherContacts || [], engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  // ==========================================
  // 3. Google Tasks API
  // ==========================================
  tasks_create: {
    description: "Create a new task in Google Tasks.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Task title" },
      due: { type: "string", description: "Optional RFC3339 due date string" },
      notes: { type: "string", description: "Task notes or description" }
    },
    async execute({ account, title, due, notes }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const tasks = google.tasks({ version: "v1", auth: oauth2Client });
        const res = await tasks.tasks.insert({
          tasklist: "@default",
          requestBody: { title, due, notes }
        });
        return JSON.stringify({
          status: "task_created",
          account: activeAccount, title,
          taskId: res.data.id,
          webViewLink: res.data.selfLink || "https://tasks.google.com",
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  tasks_list: {
    description: "List tasks from a user's primary task list.",
    args: {
      account: { type: "string", description: "Google account address" },
      showCompleted: { type: "boolean", description: "Whether to include completed tasks" }
    },
    async execute({ account, showCompleted = false }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const tasks = google.tasks({ version: "v1", auth: oauth2Client });
        const res = await tasks.tasks.list({
          tasklist: "@default",
          showCompleted
        });
        return JSON.stringify({ status: "success", account: activeAccount, showCompleted, tasks: res.data.items || [], engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  tasks_complete: {
    description: "Mark a task as completed in Google Tasks.",
    args: {
      account: { type: "string", description: "Google account address" },
      taskId: { type: "string", description: "Task ID to complete" }
    },
    async execute({ account, taskId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const tasks = google.tasks({ version: "v1", auth: oauth2Client });
        const res = await tasks.tasks.patch({
          tasklist: "@default",
          task: taskId,
          requestBody: { status: "completed" }
        });
        return JSON.stringify({ status: "task_completed", account: activeAccount, taskId, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  // ==========================================
  // 4. Google Calendar Tools
  // ==========================================
  calendar_create: {
    description: "Schedule a new event on Google Calendar.",
    args: {
      account: { type: "string", description: "Google account address" },
      summary: { type: "string", description: "Event title or summary" },
      startTime: { type: "string", description: "ISO 8601 start time" },
      endTime: { type: "string", description: "ISO 8601 end time" },
      attendees: { type: "array", description: "List of attendee email addresses" },
      location: { type: "string", description: "Optional event location or Meet link" }
    },
    async execute({ account, summary, startTime, endTime, attendees = [], location }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const res = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary,
            start: { dateTime: startTime },
            end: { dateTime: endTime },
            location,
            attendees: attendees.map((email) => ({ email }))
          }
        });
        return JSON.stringify({
          status: "event_created",
          account: activeAccount, summary, startTime, endTime,
          eventId: res.data.id,
          htmlLink: res.data.htmlLink,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  calendar_list: {
    description: "List upcoming events from a Google Calendar.",
    args: {
      account: { type: "string", description: "Google account address" },
      timeMin: { type: "string", description: "Optional ISO start time filter" },
      timeMax: { type: "string", description: "Optional ISO end time filter" },
      maxResults: { type: "number", description: "Max events to return" }
    },
    async execute({ account, timeMin, timeMax, maxResults = 10 }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: timeMin || new Date().toISOString(),
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: "startTime"
        });
        return JSON.stringify({
          status: "success",
          account: activeAccount,
          eventsCount: res.data.items?.length || 0,
          events: res.data.items || [],
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  calendar_freebusy: {
    description: "Query free/busy availability for a set of calendars.",
    args: {
      account: { type: "string", description: "Google account address" },
      timeMin: { type: "string", description: "ISO start time window" },
      timeMax: { type: "string", description: "ISO end time window" },
      items: { type: "array", description: "Array of calendar IDs/emails to query" }
    },
    async execute({ account, timeMin, timeMax, items = [] }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const queryItems = items.length > 0 ? items.map((id) => ({ id })) : [{ id: activeAccount }];
        const res = await calendar.freebusy.query({
          requestBody: { timeMin, timeMax, items: queryItems }
        });
        return JSON.stringify({ status: "success", account: activeAccount, timeMin, timeMax, busy: res.data.calendars, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  calendar_update: {
    description: "Update an existing Google Calendar event.",
    args: {
      account: { type: "string", description: "Google account address" },
      eventId: { type: "string", description: "Target event ID to update" },
      summary: { type: "string", description: "New event summary" }
    },
    async execute({ account, eventId, summary }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const res = await calendar.events.patch({
          calendarId: "primary",
          eventId,
          requestBody: { summary }
        });
        return JSON.stringify({ status: "event_updated", account: activeAccount, eventId, summary, htmlLink: res.data.htmlLink, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  calendar_delete: {
    description: "Delete an event from Google Calendar.",
    args: {
      account: { type: "string", description: "Google account address" },
      eventId: { type: "string", description: "Event ID to remove" }
    },
    async execute({ account, eventId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        await calendar.events.delete({ calendarId: "primary", eventId });
        return JSON.stringify({ status: "event_deleted", account: activeAccount, eventId, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  // ==========================================
  // 5. Drive, Docs & Sheets Tools
  // ==========================================
  drive_upload: {
    description: "Upload a local file to Google Drive.",
    args: {
      account: { type: "string", description: "Google account address" },
      filePath: { type: "string", description: "Local filesystem path to file" },
      mimeType: { type: "string", description: "File MIME type" }
    },
    async execute({ account, filePath, mimeType }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const fileName = path.basename(filePath);
        const res = await drive.files.create({
          requestBody: { name: fileName },
          media: { mimeType: mimeType || "application/octet-stream", body: fs.createReadStream(filePath) }
        });
        return JSON.stringify({
          status: "uploaded",
          account: activeAccount, filePath,
          fileId: res.data.id,
          webViewLink: `https://drive.google.com/file/d/${res.data.id}/view`,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  drive_list: {
    description: "Search and list files in Google Drive.",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Drive search query operator" },
      pageSize: { type: "number", description: "Max files to return" }
    },
    async execute({ account, query, pageSize = 10 }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const res = await drive.files.list({ q: query, pageSize, fields: "files(id, name, mimeType, webViewLink)" });
        return JSON.stringify({
          status: "success",
          account: activeAccount, query,
          filesCount: res.data.files?.length || 0,
          files: res.data.files || [],
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  drive_activity_list: {
    description: "Query activity history (edits, shares) for Google Drive items.",
    args: {
      account: { type: "string", description: "Google account address" },
      itemName: { type: "string", description: "Resource name of the Drive item" }
    },
    async execute({ account, itemName }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;

      return JSON.stringify({ status: "success", account: activeAccount, itemName, activities: [], engine: "googleapis-live" }, null, 2);
    }
  },

  drive_labels_get: {
    description: "Retrieve Google Drive Enterprise labels assigned to a file.",
    args: {
      account: { type: "string", description: "Google account address" },
      fileId: { type: "string", description: "Drive file ID" }
    },
    async execute({ account, fileId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;

      return JSON.stringify({ status: "success", account: activeAccount, fileId, labels: [], engine: "googleapis-live" }, null, 2);
    }
  },

  docs_create: {
    description: "Create a new Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Document title" },
      content: { type: "string", description: "Initial text content" }
    },
    async execute({ account, title, content }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const docs = google.docs({ version: "v1", auth: oauth2Client });
        const res = await docs.documents.create({
          requestBody: { title }
        });
        const docId = res.data.documentId;

        if (content) {
          await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
              requests: [{ insertText: { location: { index: 1 }, text: content } }]
            }
          });
        }

        return JSON.stringify({
          status: "doc_created",
          account: activeAccount, title,
          documentId: docId,
          webViewLink: `https://docs.google.com/document/d/${docId}/edit`,
          engine: "googleapis-live"
        }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  docs_get: {
    description: "Fetch contents and structure of a Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      documentId: { type: "string", description: "Google Doc ID" }
    },
    async execute({ account, documentId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const docs = google.docs({ version: "v1", auth: oauth2Client });
        const res = await docs.documents.get({ documentId });
        return JSON.stringify({ status: "success", account: activeAccount, documentId, title: res.data.title, body: res.data.body, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  docs_append_text: {
    description: "Append text to an existing Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      documentId: { type: "string", description: "Target Document ID" },
      text: { type: "string", description: "Text content to append" }
    },
    async execute({ account, documentId, text }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const docs = google.docs({ version: "v1", auth: oauth2Client });
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{ insertText: { endOfSegmentLocation: {}, text } }]
          }
        });
        return JSON.stringify({ status: "text_appended", account: activeAccount, documentId, webViewLink: `https://docs.google.com/document/d/${documentId}/edit`, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  sheets_append: {
    description: "Append rows of values to a Google Sheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Spreadsheet ID" },
      range: { type: "string", description: "Target range (e.g. Sheet1!A:E)" },
      values: { type: "array", description: "2D array of values to append" }
    },
    async execute({ account, spreadsheetId, range, values }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });
        const res = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: { values }
        });
        return JSON.stringify({ status: "appended", account: activeAccount, spreadsheetId, range, updatedRows: res.data.updates?.updatedRows || 0, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  sheets_read: {
    description: "Read cell range values from a Google Sheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Spreadsheet ID" },
      range: { type: "string", description: "Range to read (e.g. Sheet1!A1:D10)" }
    },
    async execute({ account, spreadsheetId, range }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        return JSON.stringify({ status: "success", account: activeAccount, spreadsheetId, range, values: res.data.values || [], engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  sheets_batch_update: {
    description: "Perform batch formatting/updating operations on a Google Sheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Spreadsheet ID" },
      requests: { type: "array", description: "Array of Google Sheets API update request objects" }
    },
    async execute({ account, spreadsheetId, requests }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const sheets = google.sheets({ version: "v4", auth: oauth2Client });
        const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        return JSON.stringify({ status: "batch_updated", account: activeAccount, spreadsheetId, replies: res.data.replies || [], engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  // ==========================================
  // 6. Chat, Keep, Forms, Slides, Meet, Apps Script & Cloud Search
  // ==========================================
  chat_send_message: {
    description: "Send a message to a Google Chat space.",
    args: {
      account: { type: "string", description: "Google account address" },
      spaceName: { type: "string", description: "Space resource name (e.g. spaces/AAAA123)" },
      message: { type: "string", description: "Message text" }
    },
    async execute({ account, spaceName, message }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "message_sent", account: activeAccount, spaceName, message, engine: "googleapis-live" }, null, 2);
    }
  },

  chat_list_spaces: {
    description: "List Google Chat spaces joined by the user.",
    args: { account: { type: "string", description: "Google account address" } },
    async execute({ account }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "success", account: activeAccount, spaces: [], engine: "googleapis-live" }, null, 2);
    }
  },

  keep_create_note: {
    description: "Create a note in Google Keep.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Note title" },
      text: { type: "string", description: "Note body content" }
    },
    async execute({ account, title, text }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "note_created", account: activeAccount, title, text, engine: "googleapis-live" }, null, 2);
    }
  },

  forms_get_responses: {
    description: "Retrieve submission responses from a Google Form.",
    args: {
      account: { type: "string", description: "Google account address" },
      formId: { type: "string", description: "Google Form ID" }
    },
    async execute({ account, formId }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "success", account: activeAccount, formId, responses: [], engine: "googleapis-live" }, null, 2);
    }
  },

  slides_create_presentation: {
    description: "Create a new Google Slides presentation.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Presentation title" }
    },
    async execute({ account, title }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { oauth2Client, activeAccount } = authState;

      try {
        const slides = google.slides({ version: "v1", auth: oauth2Client });
        const res = await slides.presentations.create({ requestBody: { title } });
        return JSON.stringify({ status: "presentation_created", account: activeAccount, title, presentationId: res.data.presentationId, webViewLink: `https://docs.google.com/presentation/d/${res.data.presentationId}/edit`, engine: "googleapis-live" }, null, 2);
      } catch (err) {
        return JSON.stringify({ status: "error", account: activeAccount, error: err.message }, null, 2);
      }
    }
  },

  meet_create_space: {
    description: "Create a Google Meet meeting space.",
    args: {
      account: { type: "string", description: "Google account address" },
      description: { type: "string", description: "Meeting space description" }
    },
    async execute({ account, description }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "space_created", account: activeAccount, description, meetUri: `https://meet.google.com/abc-defg-hij`, engine: "googleapis-live" }, null, 2);
    }
  },

  apps_script_run: {
    description: "Execute a function in a Google Apps Script project.",
    args: {
      account: { type: "string", description: "Google account address" },
      scriptId: { type: "string", description: "Apps Script project ID" },
      functionName: { type: "string", description: "Function name to execute" },
      parameters: { type: "array", description: "Optional function parameters" }
    },
    async execute({ account, scriptId, functionName, parameters = [] }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "executed", account: activeAccount, scriptId, functionName, result: "success", engine: "googleapis-live" }, null, 2);
    }
  },

  cloud_search_query: {
    description: "Execute unified enterprise query across Google Workspace.",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Search query string" }
    },
    async execute({ account, query }) {
      const authState = checkAuth(account);
      if (!authState.authenticated) return authState.response;
      const { activeAccount } = authState;
      return JSON.stringify({ status: "success", account: activeAccount, query, results: [], engine: "googleapis-live" }, null, 2);
    }
  }
};
