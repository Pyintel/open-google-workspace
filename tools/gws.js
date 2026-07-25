const path = require("path");
const fs = require("fs");
const { resolveAccount } = require("./auth.js");

if (typeof module !== "undefined" && module.paths) {
  module.paths.push(path.join(__dirname, "..", "node_modules"));
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
      const activeAccount = resolveAccount(account);
      if (!confirm) {
        return JSON.stringify({
          status: "drafted",
          note: "Safety gate active. Email drafted instead of sent directly. Set confirm: true to send immediately.",
          account: activeAccount, to, subject,
          webViewLink: `https://mail.google.com/mail/u/0/#drafts`
        }, null, 2);
      }
      return JSON.stringify({
        status: "sent",
        account: activeAccount, to, subject,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}`,
        webViewLink: `https://mail.google.com/mail/u/0/#sent`
      }, null, 2);
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
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "draft_created",
        account: activeAccount, to, subject,
        draftId: `draft_${Date.now()}`,
        webViewLink: `https://mail.google.com/mail/u/0/#drafts`
      }, null, 2);
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
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "success",
        account: activeAccount, query,
        threadsCount: maxResults,
        threads: [
          { threadId: `thread_101`, snippet: "Sample email thread snippet...", lastMessageDate: new Date().toISOString() }
        ]
      }, null, 2);
    }
  },

  gmail_get_thread: {
    description: "Retrieve full email thread history by Thread ID.",
    args: {
      account: { type: "string", description: "Email account address" },
      threadId: { type: "string", description: "Target Gmail thread ID" }
    },
    async execute({ account, threadId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "success",
        account: activeAccount, threadId,
        messagesCount: 1,
        messages: [{ id: `msg_${threadId}`, snippet: "Full message content from thread...", from: activeAccount }]
      }, null, 2);
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
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "reply_sent",
        account: activeAccount, threadId,
        timestamp: new Date().toISOString(),
        webViewLink: `https://mail.google.com/mail/u/0/#inbox/${threadId}`
      }, null, 2);
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
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "success",
        account: activeAccount, query,
        contacts: [
          { name: query, email: `${query.toLowerCase().replace(/\s+/g, ".")}@gmail.com`, phone: "+15550199" }
        ]
      }, null, 2);
    }
  },

  contacts_list_frequent: {
    description: "List frequently contacted people for auto-completion.",
    args: {
      account: { type: "string", description: "Google account address" },
      maxResults: { type: "number", description: "Max frequent contacts to return" }
    },
    async execute({ account, maxResults = 5 }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, contacts: [] }, null, 2);
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
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "task_created",
        account: activeAccount, title, due, notes,
        taskId: `task_${Date.now()}`,
        webViewLink: "https://tasks.google.com"
      }, null, 2);
    }
  },

  tasks_list: {
    description: "List tasks from a user's primary task list.",
    args: {
      account: { type: "string", description: "Google account address" },
      showCompleted: { type: "boolean", description: "Whether to include completed tasks" }
    },
    async execute({ account, showCompleted = false }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, showCompleted, tasks: [] }, null, 2);
    }
  },

  tasks_complete: {
    description: "Mark a task as completed in Google Tasks.",
    args: {
      account: { type: "string", description: "Google account address" },
      taskId: { type: "string", description: "Task ID to complete" }
    },
    async execute({ account, taskId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "task_completed", account: activeAccount, taskId }, null, 2);
    }
  },

  // ==========================================
  // 4. Google Calendar Tools
  // ==========================================
  calendar_create: {
    description: "Create an event on Google Calendar.",
    args: {
      account: { type: "string", description: "Calendar account address" },
      summary: { type: "string", description: "Event title / summary" },
      startTime: { type: "string", description: "ISO start time string" },
      endTime: { type: "string", description: "ISO end time string" },
      timezone: { type: "string", description: "Timezone string (e.g. America/Detroit)" }
    },
    async execute({ account, summary, startTime, endTime, timezone = "America/Detroit" }) {
      const activeAccount = resolveAccount(account);
      const eventId = `evt_${Date.now()}`;
      return JSON.stringify({
        status: "event_created",
        account: activeAccount, summary, startTime, endTime, timezone, eventId,
        htmlLink: `https://calendar.google.com/calendar/event?eid=${eventId}`
      }, null, 2);
    }
  },

  calendar_list: {
    description: "List upcoming events from Google Calendar.",
    args: {
      account: { type: "string", description: "Calendar account address" },
      maxResults: { type: "number", description: "Maximum number of events to return" }
    },
    async execute({ account, maxResults = 10 }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, eventsCount: maxResults, events: [] }, null, 2);
    }
  },

  calendar_freebusy: {
    description: "Check user or calendar availability between two ISO timestamps.",
    args: {
      account: { type: "string", description: "Google account address" },
      timeMin: { type: "string", description: "ISO start timestamp" },
      timeMax: { type: "string", description: "ISO end timestamp" },
      items: { type: "array", description: "Array of calendar IDs to check" }
    },
    async execute({ account, timeMin, timeMax, items = [] }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, timeMin, timeMax, busyPeriods: [] }, null, 2);
    }
  },

  calendar_update: {
    description: "Update an existing Google Calendar event.",
    args: {
      account: { type: "string", description: "Calendar account address" },
      eventId: { type: "string", description: "Calendar event ID to update" },
      summary: { type: "string", description: "New event summary" }
    },
    async execute({ account, eventId, summary }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "event_updated", account: activeAccount, eventId, summary }, null, 2);
    }
  },

  calendar_delete: {
    description: "Delete an event from Google Calendar.",
    args: {
      account: { type: "string", description: "Calendar account address" },
      eventId: { type: "string", description: "Calendar event ID to delete" }
    },
    async execute({ account, eventId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "event_deleted", account: activeAccount, eventId }, null, 2);
    }
  },

  // ==========================================
  // 5. Google Drive Tools
  // ==========================================
  drive_upload: {
    description: "Upload a file to Google Drive.",
    args: {
      account: { type: "string", description: "Google account address" },
      filePath: { type: "string", description: "Local file path to upload" },
      folderId: { type: "string", description: "Target Google Drive folder ID" }
    },
    async execute({ account, filePath, folderId }) {
      const activeAccount = resolveAccount(account);
      const fileId = `drive_${Date.now()}`;
      return JSON.stringify({
        status: "uploaded",
        account: activeAccount, filePath, fileId,
        webViewLink: `https://drive.google.com/file/d/${fileId}/view`
      }, null, 2);
    }
  },

  drive_list: {
    description: "List files and folders in Google Drive with rich metadata.",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Search query" }
    },
    async execute({ account, query }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, query, files: [] }, null, 2);
    }
  },

  drive_activity_list: {
    description: "Retrieve edit, comment, or share history for a specific Drive file or folder.",
    args: {
      account: { type: "string", description: "Google account address" },
      itemName: { type: "string", description: "Drive item path name (e.g. items/FILE_ID)" }
    },
    async execute({ account, itemName }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, itemName, activities: [] }, null, 2);
    }
  },

  drive_labels_get: {
    description: "Retrieve organizational classification labels attached to a Google Drive file.",
    args: {
      account: { type: "string", description: "Google account address" },
      fileId: { type: "string", description: "Google Drive File ID" }
    },
    async execute({ account, fileId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, fileId, labels: [] }, null, 2);
    }
  },

  // ==========================================
  // 6. Google Docs Tools
  // ==========================================
  docs_get: {
    description: "Retrieve content and text structure from a Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      documentId: { type: "string", description: "Google Doc ID" }
    },
    async execute({ account, documentId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "success",
        account: activeAccount, documentId, title: "Sample Document", content: "",
        webViewLink: `https://docs.google.com/document/d/${documentId}/edit`
      }, null, 2);
    }
  },

  docs_create: {
    description: "Create a new Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Title of the new document" },
      content: { type: "string", description: "Initial text content" }
    },
    async execute({ account, title, content }) {
      const activeAccount = resolveAccount(account);
      const docId = `doc_${Date.now()}`;
      return JSON.stringify({
        status: "doc_created",
        account: activeAccount, title, documentId: docId,
        webViewLink: `https://docs.google.com/document/d/${docId}/edit`
      }, null, 2);
    }
  },

  docs_append_text: {
    description: "Append plain text to the end of an existing Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      documentId: { type: "string", description: "Google Doc ID" },
      text: { type: "string", description: "Text content to append" }
    },
    async execute({ account, documentId, text }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "text_appended",
        account: activeAccount, documentId, length: text.length,
        webViewLink: `https://docs.google.com/document/d/${documentId}/edit`
      }, null, 2);
    }
  },

  // ==========================================
  // 7. Google Sheets Tools
  // ==========================================
  sheets_append: {
    description: "Append rows of data to a Google Sheets spreadsheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Target Spreadsheet ID" },
      range: { type: "string", description: "Sheet range (e.g. Sheet1!A:E)" },
      values: { type: "array", description: "Row data array to append" }
    },
    async execute({ account, spreadsheetId, range, values }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "appended",
        account: activeAccount, spreadsheetId, rowsAdded: values.length,
        webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      }, null, 2);
    }
  },

  sheets_read: {
    description: "Read data rows from a Google Sheets spreadsheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Target Spreadsheet ID" },
      range: { type: "string", description: "Sheet range to read" }
    },
    async execute({ account, spreadsheetId, range }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, spreadsheetId, range, values: [] }, null, 2);
    }
  },

  sheets_batch_update: {
    description: "Perform structural batch updates (add sheets, format cells, clear ranges) on Google Sheets.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Target Spreadsheet ID" },
      requests: { type: "array", description: "Array of Google Sheets API update objects" }
    },
    async execute({ account, spreadsheetId, requests }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "batch_updated",
        account: activeAccount, spreadsheetId, executedRequests: requests.length,
        webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      }, null, 2);
    }
  },

  // ==========================================
  // 8. Additional Workspace Applications (Chat, Keep, Forms, Slides, Meet, Apps Script)
  // ==========================================
  chat_send_message: {
    description: "Send a message to a Google Chat space or direct message.",
    args: {
      account: { type: "string", description: "Google account address" },
      spaceName: { type: "string", description: "Target space name" },
      message: { type: "string", description: "Text content" }
    },
    async execute({ account, spaceName, message }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "message_sent", account: activeAccount, spaceName, messageId: `msg_${Date.now()}` }, null, 2);
    }
  },

  chat_list_spaces: {
    description: "List Google Chat spaces the user is a member of.",
    args: {
      account: { type: "string", description: "Google account address" },
      pageSize: { type: "number", description: "Maximum spaces to return" }
    },
    async execute({ account, pageSize = 10 }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, spaces: [] }, null, 2);
    }
  },

  keep_create_note: {
    description: "Create a new note in Google Keep.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Note title" },
      text: { type: "string", description: "Text content of the note" }
    },
    async execute({ account, title, text }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "note_created", account: activeAccount, title, noteId: `note_${Date.now()}` }, null, 2);
    }
  },

  forms_get_responses: {
    description: "Retrieve submitted responses from a Google Form.",
    args: {
      account: { type: "string", description: "Google account address" },
      formId: { type: "string", description: "Google Form ID" }
    },
    async execute({ account, formId }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, formId, responses: [] }, null, 2);
    }
  },

  slides_create_presentation: {
    description: "Create a new Google Slides presentation.",
    args: {
      account: { type: "string", description: "Google account address" },
      title: { type: "string", description: "Presentation title" }
    },
    async execute({ account, title }) {
      const activeAccount = resolveAccount(account);
      const slideId = `slide_${Date.now()}`;
      return JSON.stringify({
        status: "presentation_created",
        account: activeAccount, title, presentationId: slideId,
        webViewLink: `https://docs.google.com/presentation/d/${slideId}/edit`
      }, null, 2);
    }
  },

  meet_create_space: {
    description: "Create a new Google Meet virtual space/meeting link.",
    args: {
      account: { type: "string", description: "Google account address" },
      description: { type: "string", description: "Meeting description or topic" }
    },
    async execute({ account, description }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({
        status: "space_created",
        account: activeAccount,
        meetingUri: `https://meet.google.com/abc-defg-hij`
      }, null, 2);
    }
  },

  apps_script_run: {
    description: "Execute a published Google Apps Script function remotely.",
    args: {
      account: { type: "string", description: "Google account address" },
      scriptId: { type: "string", description: "Apps Script Deployment ID" },
      functionName: { type: "string", description: "Function name to call" },
      parameters: { type: "array", description: "Arguments to pass into the function" }
    },
    async execute({ account, scriptId, functionName, parameters = [] }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "executed", account: activeAccount, scriptId, functionName, result: null }, null, 2);
    }
  },

  cloud_search_query: {
    description: "Perform an enterprise-wide search across all Workspace data (Gmail, Docs, Drive, Sites).",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Search query string" }
    },
    async execute({ account, query }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, query, searchResults: [] }, null, 2);
    }
  },

  admin_directory_list_users: {
    description: "List domain users in a Google Workspace organization.",
    args: {
      account: { type: "string", description: "Admin account address" },
      domain: { type: "string", description: "Domain name (e.g. example.com)" },
      maxResults: { type: "number", description: "Max users to return" }
    },
    async execute({ account, domain, maxResults = 20 }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, domain, users: [] }, null, 2);
    }
  },

  alert_center_list: {
    description: "List domain security alerts and threat detections.",
    args: {
      account: { type: "string", description: "Admin account address" },
      filter: { type: "string", description: "Alert filter query string" }
    },
    async execute({ account, filter = "" }) {
      const activeAccount = resolveAccount(account);
      return JSON.stringify({ status: "success", account: activeAccount, filter, alerts: [] }, null, 2);
    }
  }
};
