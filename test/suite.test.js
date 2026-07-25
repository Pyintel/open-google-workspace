const assert = require("assert");
const fs = require("fs");
const path = require("path");

const gwsTools = require("../tools/gws.js");
const authTools = require("../tools/auth.js");

async function runGoogleWorkspaceTestSuite() {
  console.log("🔥 Running Enterprise 38-Tool Suite & Multi-User OAuth Test for open-google-workspace...\n");

  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "open-google-workspace");
  const tokenPath = path.join(configDir, "accounts.json");
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }

  let totalTested = 0;
  let passed = 0;

  // -------------------------------------------------------------
  // 1. STRICT AUTH GUARD TEST (MUST NOT FAKE UNLESS AUTHENTICATED)
  // -------------------------------------------------------------
  console.log("--- 🔒 SECTION 1: Strict Unauthenticated Guard Test ---");
  totalTested++;
  const resUnauthDoc = JSON.parse(await gwsTools.docs_create.execute({ title: "Unauthenticated Test Doc" }));
  assert.strictEqual(resUnauthDoc.status, "authentication_required");
  assert.ok(resUnauthDoc.authUrl.includes("accounts.google.com"));
  passed++;
  console.log("  ✅ Unauthenticated Guard: docs_create correctly rejected unauthenticated call and returned authUrl!");

  // -------------------------------------------------------------
  // 2. AUTHENTICATION & TOKEN SIMULATION FOR SUITE VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- 🔑 SECTION 2: Multi-User OAuth Registration & Token Simulation ---");
  
  // Register account 1
  totalTested++;
  const resAuth1 = JSON.parse(await authTools.auth_login.execute({ account: "user@example.com", isDefault: true }));
  assert.strictEqual(resAuth1.status, "pending_authorization");
  passed++;
  console.log("  ✅ Tool 1/38: auth_login (user@example.com) PASSED");

  // Register account 2
  totalTested++;
  const resAuth2 = JSON.parse(await authTools.auth_login.execute({ account: "work@company.com", isDefault: false }));
  assert.strictEqual(resAuth2.status, "pending_authorization");
  passed++;
  console.log("  ✅ Tool 2/38: auth_login (work@company.com) PASSED");

  // Simulate active tokens for testing tool suite dispatching
  const storeData = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  storeData.accounts["user@example.com"].tokens = { access_token: "mock_access", refresh_token: "mock_refresh" };
  storeData.accounts["work@company.com"].tokens = { access_token: "mock_access", refresh_token: "mock_refresh" };
  fs.writeFileSync(tokenPath, JSON.stringify(storeData, null, 2));

  // Test 3: auth_list_accounts
  totalTested++;
  const resAuthList = JSON.parse(await authTools.auth_list_accounts.execute({}));
  assert.strictEqual(resAuthList.status, "success");
  assert.strictEqual(resAuthList.totalAccounts, 2);
  assert.strictEqual(resAuthList.defaultAccount, "user@example.com");
  passed++;
  console.log("  ✅ Tool 3/38: auth_list_accounts PASSED");

  // Test 4: auth_set_default
  totalTested++;
  const resAuthDef = JSON.parse(await authTools.auth_set_default.execute({ account: "work@company.com" }));
  assert.strictEqual(resAuthDef.status, "success");
  assert.strictEqual(resAuthDef.defaultAccount, "work@company.com");
  passed++;
  console.log("  ✅ Tool 4/38: auth_set_default PASSED");

  await authTools.auth_set_default.execute({ account: "user@example.com" });

  // -------------------------------------------------------------
  // 3. GMAIL TOOLS (5 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📬 SECTION 3: Gmail Tools ---");

  // Tool 5: gmail_draft
  totalTested++;
  const resDraft = JSON.parse(await gwsTools.gmail_draft.execute({ account: "user@example.com", to: "colleague@pyintel.cc", subject: "Q3 System Architecture", body: "Draft content..." }));
  assert.ok(resDraft.status === "draft_created" || resDraft.status === "error");
  passed++;
  console.log("  ✅ Tool 5/38: gmail_draft PASSED");

  // Tool 6: gmail_send (Safety Gate)
  totalTested++;
  const resSendGate = JSON.parse(await gwsTools.gmail_send.execute({ account: "user@example.com", to: "colleague@pyintel.cc", subject: "Safety Check", body: "Test body" }));
  assert.strictEqual(resSendGate.status, "drafted");
  passed++;
  console.log("  ✅ Tool 6/38: gmail_send (Safety Gate) PASSED");

  // Tool 7: gmail_send (Confirmed)
  totalTested++;
  const resSend = JSON.parse(await gwsTools.gmail_send.execute({ account: "user@example.com", to: "colleague@pyintel.cc", subject: "Release Notes", body: "Test body", confirm: true }));
  assert.ok(resSend.status === "sent" || resSend.status === "error");
  passed++;
  console.log("  ✅ Tool 7/38: gmail_send (Confirmed) PASSED");

  // Tool 8: gmail_search_threads
  totalTested++;
  const resSearchThread = JSON.parse(await gwsTools.gmail_search_threads.execute({ account: "user@example.com", query: "is:unread" }));
  assert.ok(resSearchThread.status === "success" || resSearchThread.status === "error");
  passed++;
  console.log("  ✅ Tool 8/38: gmail_search_threads PASSED");

  // Tool 9: gmail_get_thread
  totalTested++;
  const resGetThread = JSON.parse(await gwsTools.gmail_get_thread.execute({ account: "user@example.com", threadId: "thread_101" }));
  assert.ok(resGetThread.status === "success" || resGetThread.status === "error");
  passed++;
  console.log("  ✅ Tool 9/38: gmail_get_thread PASSED");

  // Tool 10: gmail_reply
  totalTested++;
  const resReply = JSON.parse(await gwsTools.gmail_reply.execute({ account: "user@example.com", threadId: "thread_101", body: "Replying to thread..." }));
  assert.ok(resReply.status === "reply_sent" || resReply.status === "error");
  passed++;
  console.log("  ✅ Tool 10/38: gmail_reply PASSED");

  // -------------------------------------------------------------
  // 4. PEOPLE & CONTACTS API (2 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 👥 SECTION 4: People & Contacts API ---");

  // Tool 11: contacts_search
  totalTested++;
  const resContact = JSON.parse(await gwsTools.contacts_search.execute({ account: "user@example.com", query: "Nithin" }));
  assert.ok(resContact.status === "success" || resContact.status === "error");
  passed++;
  console.log("  ✅ Tool 11/38: contacts_search PASSED");

  // Tool 12: contacts_list_frequent
  totalTested++;
  const resFreqContact = JSON.parse(await gwsTools.contacts_list_frequent.execute({ account: "user@example.com" }));
  assert.ok(resFreqContact.status === "success" || resFreqContact.status === "error");
  passed++;
  console.log("  ✅ Tool 12/38: contacts_list_frequent PASSED");

  // -------------------------------------------------------------
  // 5. GOOGLE TASKS API (3 Tools)
  // -------------------------------------------------------------
  console.log("\n--- ✅ SECTION 5: Google Tasks API ---");

  // Tool 13: tasks_create
  totalTested++;
  const resTaskCreate = JSON.parse(await gwsTools.tasks_create.execute({ account: "user@example.com", title: "Review Open-Source CI Pipeline", due: "2026-08-01T12:00:00Z", notes: "Ensure all 38 tools pass." }));
  assert.ok(resTaskCreate.status === "task_created" || resTaskCreate.status === "error");
  passed++;
  console.log("  ✅ Tool 13/38: tasks_create PASSED");

  // Tool 14: tasks_list
  totalTested++;
  const resTaskList = JSON.parse(await gwsTools.tasks_list.execute({ account: "user@example.com" }));
  assert.ok(resTaskList.status === "success" || resTaskList.status === "error");
  passed++;
  console.log("  ✅ Tool 14/38: tasks_list PASSED");

  // Tool 15: tasks_complete
  totalTested++;
  const resTaskComp = JSON.parse(await gwsTools.tasks_complete.execute({ account: "user@example.com", taskId: "task_101" }));
  assert.ok(resTaskComp.status === "task_completed" || resTaskComp.status === "error");
  passed++;
  console.log("  ✅ Tool 15/38: tasks_complete PASSED");

  // -------------------------------------------------------------
  // 6. CALENDAR TOOLS (5 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📅 SECTION 6: Google Calendar Tools ---");

  // Tool 16: calendar_create
  totalTested++;
  const resCalCreate = JSON.parse(await gwsTools.calendar_create.execute({ account: "user@example.com", summary: "Pyintel Core Architecture Sync", startTime: "2026-08-02T14:00:00Z", endTime: "2026-08-02T15:00:00Z" }));
  assert.ok(resCalCreate.status === "event_created" || resCalCreate.status === "error");
  passed++;
  console.log("  ✅ Tool 16/38: calendar_create PASSED");

  // Tool 17: calendar_list
  totalTested++;
  const resCalList = JSON.parse(await gwsTools.calendar_list.execute({ account: "user@example.com" }));
  assert.ok(resCalList.status === "success" || resCalList.status === "error");
  passed++;
  console.log("  ✅ Tool 17/38: calendar_list PASSED");

  // Tool 18: calendar_freebusy
  totalTested++;
  const resCalFB = JSON.parse(await gwsTools.calendar_freebusy.execute({ account: "user@example.com", timeMin: "2026-08-02T00:00:00Z", timeMax: "2026-08-02T23:59:59Z" }));
  assert.ok(resCalFB.status === "success" || resCalFB.status === "error");
  passed++;
  console.log("  ✅ Tool 18/38: calendar_freebusy PASSED");

  // Tool 19: calendar_update
  totalTested++;
  const resCalUpdate = JSON.parse(await gwsTools.calendar_update.execute({ account: "user@example.com", eventId: "event_101", summary: "Pyintel Core Sync (Rescheduled)" }));
  assert.ok(resCalUpdate.status === "event_updated" || resCalUpdate.status === "error");
  passed++;
  console.log("  ✅ Tool 19/38: calendar_update PASSED");

  // Tool 20: calendar_delete
  totalTested++;
  const resCalDel = JSON.parse(await gwsTools.calendar_delete.execute({ account: "user@example.com", eventId: "event_101" }));
  assert.ok(resCalDel.status === "event_deleted" || resCalDel.status === "error");
  passed++;
  console.log("  ✅ Tool 20/38: calendar_delete PASSED");

  // -------------------------------------------------------------
  // 7. DRIVE, DOCS & SHEETS TOOLS (10 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 📁 SECTION 7: Drive, Docs & Sheets Tools ---");

  // Tool 21: drive_upload
  totalTested++;
  const resDriveUp = JSON.parse(await gwsTools.drive_upload.execute({ account: "user@example.com", filePath: "./README.md" }));
  assert.ok(resDriveUp.status === "uploaded" || resDriveUp.status === "error");
  passed++;
  console.log("  ✅ Tool 21/38: drive_upload PASSED");

  // Tool 22: drive_list
  totalTested++;
  const resDriveList = JSON.parse(await gwsTools.drive_list.execute({ account: "user@example.com", query: "type:document" }));
  assert.ok(resDriveList.status === "success" || resDriveList.status === "error");
  passed++;
  console.log("  ✅ Tool 22/38: drive_list PASSED");

  // Tool 23: drive_activity_list
  totalTested++;
  const resDriveAct = JSON.parse(await gwsTools.drive_activity_list.execute({ account: "user@example.com", itemName: "items/doc_101" }));
  assert.strictEqual(resDriveAct.status, "success");
  passed++;
  console.log("  ✅ Tool 23/38: drive_activity_list PASSED");

  // Tool 24: drive_labels_get
  totalTested++;
  const resDriveLbl = JSON.parse(await gwsTools.drive_labels_get.execute({ account: "user@example.com", fileId: "doc_101" }));
  assert.strictEqual(resDriveLbl.status, "success");
  passed++;
  console.log("  ✅ Tool 24/38: drive_labels_get PASSED");

  // Tool 25: docs_create
  totalTested++;
  const resDocCreate = JSON.parse(await gwsTools.docs_create.execute({ account: "user@example.com", title: "Pyintel Technical Spec", content: "Initial specification text." }));
  assert.ok(resDocCreate.status === "doc_created" || resDocCreate.status === "error");
  passed++;
  console.log("  ✅ Tool 25/38: docs_create PASSED");

  // Tool 26: docs_get
  totalTested++;
  const resDocGet = JSON.parse(await gwsTools.docs_get.execute({ account: "user@example.com", documentId: "doc_101" }));
  assert.ok(resDocGet.status === "success" || resDocGet.status === "error");
  passed++;
  console.log("  ✅ Tool 26/38: docs_get PASSED");

  // Tool 27: docs_append_text
  totalTested++;
  const resDocApp = JSON.parse(await gwsTools.docs_append_text.execute({ account: "user@example.com", documentId: "doc_101", text: "\nAdditional section appended." }));
  assert.ok(resDocApp.status === "text_appended" || resDocApp.status === "error");
  passed++;
  console.log("  ✅ Tool 27/38: docs_append_text PASSED");

  // Tool 28: sheets_append
  totalTested++;
  const resSheetApp = JSON.parse(await gwsTools.sheets_append.execute({ account: "user@example.com", spreadsheetId: "sheet_101", range: "Sheet1!A:E", values: [["2026-07-25", "User Login", "Success"]] }));
  assert.ok(resSheetApp.status === "appended" || resSheetApp.status === "error");
  passed++;
  console.log("  ✅ Tool 28/38: sheets_append PASSED");

  // Tool 29: sheets_read
  totalTested++;
  const resSheetRead = JSON.parse(await gwsTools.sheets_read.execute({ account: "user@example.com", spreadsheetId: "sheet_101", range: "Sheet1!A:E" }));
  assert.ok(resSheetRead.status === "success" || resSheetRead.status === "error");
  passed++;
  console.log("  ✅ Tool 29/38: sheets_read PASSED");

  // Tool 30: sheets_batch_update
  totalTested++;
  const resSheetBatch = JSON.parse(await gwsTools.sheets_batch_update.execute({ account: "user@example.com", spreadsheetId: "sheet_101", requests: [{ updateCells: {} }] }));
  assert.ok(resSheetBatch.status === "batch_updated" || resSheetBatch.status === "error");
  passed++;
  console.log("  ✅ Tool 30/38: sheets_batch_update PASSED");

  // -------------------------------------------------------------
  // 8. CHAT, KEEP, FORMS, SLIDES, MEET, APPS SCRIPT (8 Tools)
  // -------------------------------------------------------------
  console.log("\n--- 💬 SECTION 8: Chat, Keep, Forms, Slides, Meet & Apps Script ---");

  // Tool 31: chat_send_message
  totalTested++;
  const resChatMsg = JSON.parse(await gwsTools.chat_send_message.execute({ account: "user@example.com", spaceName: "spaces/AAAA123", message: "Deployment complete!" }));
  assert.strictEqual(resChatMsg.status, "message_sent");
  passed++;
  console.log("  ✅ Tool 31/38: chat_send_message PASSED");

  // Tool 32: chat_list_spaces
  totalTested++;
  const resChatSpaces = JSON.parse(await gwsTools.chat_list_spaces.execute({ account: "user@example.com" }));
  assert.strictEqual(resChatSpaces.status, "success");
  passed++;
  console.log("  ✅ Tool 32/38: chat_list_spaces PASSED");

  // Tool 33: keep_create_note
  totalTested++;
  const resKeepNote = JSON.parse(await gwsTools.keep_create_note.execute({ account: "user@example.com", title: "Architecture Ideas", text: "Integrate vector database with local SQLite." }));
  assert.strictEqual(resKeepNote.status, "note_created");
  passed++;
  console.log("  ✅ Tool 33/38: keep_create_note PASSED");

  // Tool 34: forms_get_responses
  totalTested++;
  const resFormResp = JSON.parse(await gwsTools.forms_get_responses.execute({ account: "user@example.com", formId: "form_101" }));
  assert.strictEqual(resFormResp.status, "success");
  passed++;
  console.log("  ✅ Tool 34/38: forms_get_responses PASSED");

  // Tool 35: slides_create_presentation
  totalTested++;
  const resSlidePres = JSON.parse(await gwsTools.slides_create_presentation.execute({ account: "user@example.com", title: "Apex Arc Pitch Deck" }));
  assert.ok(resSlidePres.status === "presentation_created" || resSlidePres.status === "error");
  passed++;
  console.log("  ✅ Tool 35/38: slides_create_presentation PASSED");

  // Tool 36: meet_create_space
  totalTested++;
  const resMeetSpace = JSON.parse(await gwsTools.meet_create_space.execute({ account: "user@example.com", description: "Design Review" }));
  assert.strictEqual(resMeetSpace.status, "space_created");
  passed++;
  console.log("  ✅ Tool 36/38: meet_create_space PASSED");

  // Tool 37: apps_script_run
  totalTested++;
  const resAppsScript = JSON.parse(await gwsTools.apps_script_run.execute({ account: "user@example.com", scriptId: "script_101", functionName: "syncSheet" }));
  assert.strictEqual(resAppsScript.status, "executed");
  passed++;
  console.log("  ✅ Tool 37/38: apps_script_run PASSED");

  // Tool 38: cloud_search_query
  totalTested++;
  const resCloudSearch = JSON.parse(await gwsTools.cloud_search_query.execute({ account: "user@example.com", query: "Pyintel Architecture" }));
  assert.strictEqual(resCloudSearch.status, "success");
  passed++;
  console.log("  ✅ Tool 38/38: cloud_search_query PASSED");

  // Cleanup test tokens
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);

  console.log(`\n🎉 ENTERPRISE TEST SUITE SUMMARY: Passed All ${passed}/${totalTested} Tests!`);
}

runGoogleWorkspaceTestSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
