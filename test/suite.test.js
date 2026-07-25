const assert = require("assert");
const fs = require("fs");
const path = require("path");

const gwsTools = require("../tools/gws.js");
const authTools = require("../tools/auth.js");

async function runGoogleWorkspaceTestSuite() {
  console.log("🔥 Running Enterprise 38-Tool Suite & Multi-User OAuth Test for open-google-workspace...\n");

  const artifactDir = path.join(__dirname, "artifacts");
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  let totalTested = 0;
  let passed = 0;

  // -------------------------------------------------------------
  // 1. MULTI-USER OAUTH AUTHENTICATION TESTS
  // -------------------------------------------------------------
  console.log("--- 🔑 SECTION 1: Multi-User OAuth Authentication ---");
  
  // Test 1: auth_login (Work Account OAuth Generation)
  totalTested++;
  const resAuth1 = JSON.parse(await authTools.auth_login.execute({ account: "rites@oakland.edu", isDefault: true }));
  assert.ok(resAuth1.status === "pending_authorization" || resAuth1.status === "authenticated");
  assert.ok(resAuth1.authUrl || resAuth1.message);
  passed++;
  console.log("  ✅ Tool 1/38: auth_login (Work Account OAuth URL Generation) PASSED");

  // Test 2: auth_login (Personal Account)
  totalTested++;
  const resAuth2 = JSON.parse(await authTools.auth_login.execute({ account: "ritesh.personal@gmail.com", isDefault: false }));
  assert.ok(resAuth2.status === "pending_authorization" || resAuth2.status === "authenticated");
  passed++;
  console.log("  ✅ Tool 2/38: auth_login (Personal Account OAuth URL Generation) PASSED");

  // Test 3: auth_list_accounts
  totalTested++;
  const resAuthList = JSON.parse(await authTools.auth_list_accounts.execute({}));
  assert.strictEqual(resAuthList.status, "success");
  assert.strictEqual(resAuthList.totalAccounts, 2);
  assert.strictEqual(resAuthList.defaultAccount, "rites@oakland.edu");
  passed++;
  console.log("  ✅ Tool 3/38: auth_list_accounts PASSED");

  // Test 4: auth_set_default
  totalTested++;
  const resAuthDef = JSON.parse(await authTools.auth_set_default.execute({ account: "ritesh.personal@gmail.com" }));
  assert.strictEqual(resAuthDef.status, "success");
  assert.strictEqual(resAuthDef.defaultAccount, "ritesh.personal@gmail.com");
  passed++;
  console.log("  ✅ Tool 4/38: auth_set_default PASSED");

  // Restore default work account
  await authTools.auth_set_default.execute({ account: "rites@oakland.edu" });

  // -------------------------------------------------------------
  // 2. GMAIL TOOLS (5 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📬 SECTION 2: Gmail Tools ---");

  // Tool 5: gmail_draft
  totalTested++;
  const resDraft = JSON.parse(await gwsTools.gmail_draft.execute({ account: "rites@oakland.edu", to: "colleague@pyintel.cc", subject: "Q3 System Architecture", body: "Draft content..." }));
  assert.strictEqual(resDraft.status, "draft_created");
  passed++;
  console.log("  ✅ Tool 5/38: gmail_draft PASSED");

  // Tool 6: gmail_send (Safety Gate)
  totalTested++;
  const resSendGate = JSON.parse(await gwsTools.gmail_send.execute({ account: "rites@oakland.edu", to: "colleague@pyintel.cc", subject: "Safety Check", body: "Test body" }));
  assert.strictEqual(resSendGate.status, "drafted");
  passed++;
  console.log("  ✅ Tool 6/38: gmail_send (Safety Gate) PASSED");

  // Tool 7: gmail_send (Confirmed)
  totalTested++;
  const resSend = JSON.parse(await gwsTools.gmail_send.execute({ account: "rites@oakland.edu", to: "colleague@pyintel.cc", subject: "Release Notes", body: "Test body", confirm: true }));
  assert.strictEqual(resSend.status, "sent");
  passed++;
  console.log("  ✅ Tool 7/38: gmail_send (Confirmed) PASSED");

  // Tool 8: gmail_search_threads
  totalTested++;
  const resSearchThread = JSON.parse(await gwsTools.gmail_search_threads.execute({ account: "rites@oakland.edu", query: "is:unread" }));
  assert.strictEqual(resSearchThread.status, "success");
  passed++;
  console.log("  ✅ Tool 8/38: gmail_search_threads PASSED");

  // Tool 9: gmail_get_thread
  totalTested++;
  const resGetThread = JSON.parse(await gwsTools.gmail_get_thread.execute({ account: "rites@oakland.edu", threadId: "thread_101" }));
  assert.strictEqual(resGetThread.status, "success");
  passed++;
  console.log("  ✅ Tool 9/38: gmail_get_thread PASSED");

  // Tool 10: gmail_reply
  totalTested++;
  const resReply = JSON.parse(await gwsTools.gmail_reply.execute({ account: "rites@oakland.edu", threadId: "thread_101", body: "Replying to thread..." }));
  assert.strictEqual(resReply.status, "reply_sent");
  passed++;
  console.log("  ✅ Tool 10/38: gmail_reply PASSED");

  // -------------------------------------------------------------
  // 3. PEOPLE & CONTACTS API (2 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 👥 SECTION 3: People & Contacts API ---");

  // Tool 11: contacts_search
  totalTested++;
  const resContact = JSON.parse(await gwsTools.contacts_search.execute({ account: "rites@oakland.edu", query: "Nithin" }));
  assert.strictEqual(resContact.status, "success");
  assert.strictEqual(resContact.contacts[0].name, "Nithin");
  passed++;
  console.log("  ✅ Tool 11/38: contacts_search PASSED");

  // Tool 12: contacts_list_frequent
  totalTested++;
  const resFreqContact = JSON.parse(await gwsTools.contacts_list_frequent.execute({ account: "rites@oakland.edu" }));
  assert.strictEqual(resFreqContact.status, "success");
  passed++;
  console.log("  ✅ Tool 12/38: contacts_list_frequent PASSED");

  // -------------------------------------------------------------
  // 4. GOOGLE TASKS API (3 Tools)
  // -------------------------------------------------------------
  console.log("\n--- ✅ SECTION 4: Google Tasks API ---");

  // Tool 13: tasks_create
  totalTested++;
  const resTaskCreate = JSON.parse(await gwsTools.tasks_create.execute({ account: "rites@oakland.edu", title: "Review Open-Source CI Pipeline", due: "2026-08-01T12:00:00Z", notes: "Ensure all 38 tools pass." }));
  assert.strictEqual(resTaskCreate.status, "task_created");
  passed++;
  console.log("  ✅ Tool 13/38: tasks_create PASSED");

  // Tool 14: tasks_list
  totalTested++;
  const resTaskList = JSON.parse(await gwsTools.tasks_list.execute({ account: "rites@oakland.edu" }));
  assert.strictEqual(resTaskList.status, "success");
  passed++;
  console.log("  ✅ Tool 14/38: tasks_list PASSED");

  // Tool 15: tasks_complete
  totalTested++;
  const resTaskComp = JSON.parse(await gwsTools.tasks_complete.execute({ account: "rites@oakland.edu", taskId: resTaskCreate.taskId }));
  assert.strictEqual(resTaskComp.status, "task_completed");
  passed++;
  console.log("  ✅ Tool 15/38: tasks_complete PASSED");

  // -------------------------------------------------------------
  // 5. CALENDAR TOOLS (5 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📅 SECTION 5: Google Calendar Tools ---");

  // Tool 16: calendar_create
  totalTested++;
  const resCalCreate = JSON.parse(await gwsTools.calendar_create.execute({ account: "rites@oakland.edu", summary: "Pyintel Core Architecture Sync", startTime: "2026-08-02T14:00:00Z", endTime: "2026-08-02T15:00:00Z" }));
  assert.strictEqual(resCalCreate.status, "event_created");
  passed++;
  console.log("  ✅ Tool 16/38: calendar_create PASSED");

  // Tool 17: calendar_list
  totalTested++;
  const resCalList = JSON.parse(await gwsTools.calendar_list.execute({ account: "rites@oakland.edu" }));
  assert.strictEqual(resCalList.status, "success");
  passed++;
  console.log("  ✅ Tool 17/38: calendar_list PASSED");

  // Tool 18: calendar_freebusy
  totalTested++;
  const resCalFB = JSON.parse(await gwsTools.calendar_freebusy.execute({ account: "rites@oakland.edu", timeMin: "2026-08-02T00:00:00Z", timeMax: "2026-08-02T23:59:59Z" }));
  assert.strictEqual(resCalFB.status, "success");
  passed++;
  console.log("  ✅ Tool 18/38: calendar_freebusy PASSED");

  // Tool 19: calendar_update
  totalTested++;
  const resCalUpdate = JSON.parse(await gwsTools.calendar_update.execute({ account: "rites@oakland.edu", eventId: resCalCreate.eventId, summary: "Pyintel Core Sync (Rescheduled)" }));
  assert.strictEqual(resCalUpdate.status, "event_updated");
  passed++;
  console.log("  ✅ Tool 19/38: calendar_update PASSED");

  // Tool 20: calendar_delete
  totalTested++;
  const resCalDel = JSON.parse(await gwsTools.calendar_delete.execute({ account: "rites@oakland.edu", eventId: resCalCreate.eventId }));
  assert.strictEqual(resCalDel.status, "event_deleted");
  passed++;
  console.log("  ✅ Tool 20/38: calendar_delete PASSED");

  // -------------------------------------------------------------
  // 6. DRIVE, DOCS & SHEETS TOOLS (10 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📁 SECTION 6: Drive, Docs & Sheets Tools ---");

  // Tool 21: drive_upload
  totalTested++;
  const resDriveUp = JSON.parse(await gwsTools.drive_upload.execute({ account: "rites@oakland.edu", filePath: "./README.md" }));
  assert.strictEqual(resDriveUp.status, "uploaded");
  passed++;
  console.log("  ✅ Tool 21/38: drive_upload PASSED");

  // Tool 22: drive_list
  totalTested++;
  const resDriveList = JSON.parse(await gwsTools.drive_list.execute({ account: "rites@oakland.edu", query: "type:document" }));
  assert.strictEqual(resDriveList.status, "success");
  passed++;
  console.log("  ✅ Tool 22/38: drive_list PASSED");

  // Tool 23: drive_activity_list
  totalTested++;
  const resDriveAct = JSON.parse(await gwsTools.drive_activity_list.execute({ account: "rites@oakland.edu", itemName: "items/doc_101" }));
  assert.strictEqual(resDriveAct.status, "success");
  passed++;
  console.log("  ✅ Tool 23/38: drive_activity_list PASSED");

  // Tool 24: drive_labels_get
  totalTested++;
  const resDriveLbl = JSON.parse(await gwsTools.drive_labels_get.execute({ account: "rites@oakland.edu", fileId: "doc_101" }));
  assert.strictEqual(resDriveLbl.status, "success");
  passed++;
  console.log("  ✅ Tool 24/38: drive_labels_get PASSED");

  // Tool 25: docs_create
  totalTested++;
  const resDocCreate = JSON.parse(await gwsTools.docs_create.execute({ account: "rites@oakland.edu", title: "Pyintel Technical Spec", content: "Initial specification text." }));
  assert.strictEqual(resDocCreate.status, "doc_created");
  passed++;
  console.log("  ✅ Tool 25/38: docs_create PASSED");

  // Tool 26: docs_get
  totalTested++;
  const resDocGet = JSON.parse(await gwsTools.docs_get.execute({ account: "rites@oakland.edu", documentId: resDocCreate.documentId }));
  assert.strictEqual(resDocGet.status, "success");
  passed++;
  console.log("  ✅ Tool 26/38: docs_get PASSED");

  // Tool 27: docs_append_text
  totalTested++;
  const resDocApp = JSON.parse(await gwsTools.docs_append_text.execute({ account: "rites@oakland.edu", documentId: resDocCreate.documentId, text: "\nAdditional section appended." }));
  assert.strictEqual(resDocApp.status, "text_appended");
  passed++;
  console.log("  ✅ Tool 27/38: docs_append_text PASSED");

  // Tool 28: sheets_append
  totalTested++;
  const resSheetApp = JSON.parse(await gwsTools.sheets_append.execute({ account: "rites@oakland.edu", spreadsheetId: "sheet_101", range: "Sheet1!A:E", values: [["2026-07-25", "User Login", "Success"]] }));
  assert.strictEqual(resSheetApp.status, "appended");
  passed++;
  console.log("  ✅ Tool 28/38: sheets_append PASSED");

  // Tool 29: sheets_read
  totalTested++;
  const resSheetRead = JSON.parse(await gwsTools.sheets_read.execute({ account: "rites@oakland.edu", spreadsheetId: "sheet_101", range: "Sheet1!A:E" }));
  assert.strictEqual(resSheetRead.status, "success");
  passed++;
  console.log("  ✅ Tool 30/38: sheets_read PASSED");

  // Tool 30: sheets_batch_update
  totalTested++;
  const resSheetBatch = JSON.parse(await gwsTools.sheets_batch_update.execute({ account: "rites@oakland.edu", spreadsheetId: "sheet_101", requests: [{ updateCells: {} }] }));
  assert.strictEqual(resSheetBatch.status, "batch_updated");
  passed++;
  console.log("  ✅ Tool 30/38: sheets_batch_update PASSED");

  // -------------------------------------------------------------
  // 7. CHAT, KEEP, FORMS, SLIDES, MEET, APPS SCRIPT (8 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 💬 SECTION 7: Chat, Keep, Forms, Slides, Meet & Apps Script ---");

  // Tool 31: chat_send_message
  totalTested++;
  const resChatMsg = JSON.parse(await gwsTools.chat_send_message.execute({ account: "rites@oakland.edu", spaceName: "spaces/AAAA123", message: "Deployment complete!" }));
  assert.strictEqual(resChatMsg.status, "message_sent");
  passed++;
  console.log("  ✅ Tool 31/38: chat_send_message PASSED");

  // Tool 32: chat_list_spaces
  totalTested++;
  const resChatSpaces = JSON.parse(await gwsTools.chat_list_spaces.execute({ account: "rites@oakland.edu" }));
  assert.strictEqual(resChatSpaces.status, "success");
  passed++;
  console.log("  ✅ Tool 32/38: chat_list_spaces PASSED");

  // Tool 33: keep_create_note
  totalTested++;
  const resKeepNote = JSON.parse(await gwsTools.keep_create_note.execute({ account: "rites@oakland.edu", title: "Architecture Ideas", text: "Integrate vector database with local SQLite." }));
  assert.strictEqual(resKeepNote.status, "note_created");
  passed++;
  console.log("  ✅ Tool 33/38: keep_create_note PASSED");

  // Tool 34: forms_get_responses
  totalTested++;
  const resFormResp = JSON.parse(await gwsTools.forms_get_responses.execute({ account: "rites@oakland.edu", formId: "form_101" }));
  assert.strictEqual(resFormResp.status, "success");
  passed++;
  console.log("  ✅ Tool 34/38: forms_get_responses PASSED");

  // Tool 35: slides_create_presentation
  totalTested++;
  const resSlidePres = JSON.parse(await gwsTools.slides_create_presentation.execute({ account: "rites@oakland.edu", title: "Apex Arc Pitch Deck" }));
  assert.strictEqual(resSlidePres.status, "presentation_created");
  passed++;
  console.log("  ✅ Tool 35/38: slides_create_presentation PASSED");

  // Tool 36: meet_create_space
  totalTested++;
  const resMeetSpace = JSON.parse(await gwsTools.meet_create_space.execute({ account: "rites@oakland.edu", description: "Design Review" }));
  assert.strictEqual(resMeetSpace.status, "space_created");
  passed++;
  console.log("  ✅ Tool 36/38: meet_create_space PASSED");

  // Tool 37: apps_script_run
  totalTested++;
  const resAppsScript = JSON.parse(await gwsTools.apps_script_run.execute({ account: "rites@oakland.edu", scriptId: "script_101", functionName: "syncSheet" }));
  assert.strictEqual(resAppsScript.status, "executed");
  passed++;
  console.log("  ✅ Tool 37/38: apps_script_run PASSED");

  // Tool 38: cloud_search_query
  totalTested++;
  const resCloudSearch = JSON.parse(await gwsTools.cloud_search_query.execute({ account: "rites@oakland.edu", query: "Pyintel Architecture" }));
  assert.strictEqual(resCloudSearch.status, "success");
  passed++;
  console.log("  ✅ Tool 38/38: cloud_search_query PASSED");

  console.log(`\n🎉 ENTERPRISE TEST SUITE SUMMARY: Passed All ${passed}/${totalTested} Tools!`);
}

runGoogleWorkspaceTestSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
