const path = require("path");
const fs = require("fs");

if (typeof module !== "undefined" && module.paths) {
  module.paths.push(path.join(__dirname, "..", "node_modules"));
}

module.exports = {
  gmail_send: {
    description: "Send an email via Gmail API.",
    args: {
      account: { type: "string", description: "Sender email account address" },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body content" },
      confirm: { type: "boolean", description: "Explicit safety confirmation to send without drafting" }
    },
    async execute({ account, to, subject, body, confirm }) {
      if (!confirm) {
        return JSON.stringify({
          status: "drafted",
          note: "Safety gate active. Email drafted instead of sent directly. Set confirm: true to send immediately.",
          account, to, subject
        }, null, 2);
      }
      return JSON.stringify({ status: "sent", account, to, subject, timestamp: new Date().toISOString() }, null, 2);
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
      return JSON.stringify({ status: "draft_created", account, to, subject, draftId: `draft_${Date.now()}` }, null, 2);
    }
  },

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
      return JSON.stringify({ status: "event_created", account, summary, startTime, endTime, timezone, eventId: `evt_${Date.now()}` }, null, 2);
    }
  },

  calendar_list: {
    description: "List upcoming events from Google Calendar.",
    args: {
      account: { type: "string", description: "Calendar account address" },
      maxResults: { type: "number", description: "Maximum number of events to return" }
    },
    async execute({ account, maxResults = 10 }) {
      return JSON.stringify({ status: "success", account, eventsCount: maxResults, events: [] }, null, 2);
    }
  },

  sheets_append: {
    description: "Append rows of data to a Google Sheets spreadsheet.",
    args: {
      account: { type: "string", description: "Google account address" },
      spreadsheetId: { type: "string", description: "Target Spreadsheet ID" },
      range: { type: "string", description: "Sheet range (e.g. Sheet1!A:E)" },
      values: { type: "array", description: "Row data array to append" }
    },
    async execute({ account, spreadsheetId, range, values }) {
      return JSON.stringify({ status: "appended", spreadsheetId, rowsAdded: values.length }, null, 2);
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
      return JSON.stringify({ status: "success", spreadsheetId, range, values: [] }, null, 2);
    }
  },

  docs_get: {
    description: "Retrieve content and text structure from a Google Doc.",
    args: {
      account: { type: "string", description: "Google account address" },
      documentId: { type: "string", description: "Google Doc ID" }
    },
    async execute({ account, documentId }) {
      return JSON.stringify({ status: "success", documentId, title: "Sample Document", content: "" }, null, 2);
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
      return JSON.stringify({ status: "doc_created", title, documentId: `doc_${Date.now()}` }, null, 2);
    }
  },

  drive_upload: {
    description: "Upload a file to Google Drive.",
    args: {
      account: { type: "string", description: "Google account address" },
      filePath: { type: "string", description: "Local file path to upload" },
      folderId: { type: "string", description: "Target Google Drive folder ID" }
    },
    async execute({ account, filePath, folderId }) {
      return JSON.stringify({ status: "uploaded", filePath, fileId: `drive_${Date.now()}` }, null, 2);
    }
  },

  drive_list: {
    description: "List files and folders in Google Drive.",
    args: {
      account: { type: "string", description: "Google account address" },
      query: { type: "string", description: "Search query" }
    },
    async execute({ account, query }) {
      return JSON.stringify({ status: "success", account, query, files: [] }, null, 2);
    }
  }
};
