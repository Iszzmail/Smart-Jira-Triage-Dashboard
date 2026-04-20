// ------------- CONFIGURATION --------------------------------------------------------
// 1. Sheet Names
const RAW_JIRA_IMPORT_SHEET_NAME = "JiraRawImport"; 
const DASHBOARD_SHEET_NAME = "JiraDashboardData";

// 2. Columns (MUST MATCH YOUR RAW SHEET HEADERS EXACTLY)
const KEY_COLUMN_HEADER = "Key";
const COMMENT_TEXT_COLUMN_HEADER = "Comment.text";
const ISSUE_UPDATED_DATE_COLUMN_HEADER = "Updated";

// 3. New Columns Created by Script
const REVIEWED_COLUMN_HEADER = "Mark Read"; 
const URL_COLUMN_HEADER = "Jira Link"; 

// 4. Jira URL (For the clickable links)
// !!! IMPORTANT: REPLACE THIS WITH YOUR ACTUAL JIRA URL !!!
const JIRA_INSTANCE_URL = "https://YOUR_DOMAIN.atlassian.net"; 

// 5. Visuals
const NEW_UPDATE_HIGHLIGHT_COLOR = "#008080"; 
const DEFAULT_BACKGROUND_COLOR = null; 
// ------------------------------------------------------------------------------------

function runHourlyDashboardUpdate() {
  Logger.log("Starting dashboard update...");
  processRawJiraImportToDashboard();
  SpreadsheetApp.flush(); 
  highlightNewUpdatesAndHandleCheckbox();
  Logger.log("Update complete.");
}

function processRawJiraImportToDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(RAW_JIRA_IMPORT_SHEET_NAME);
  
  // Safety Checks
  if (!sourceSheet) { Logger.log("Raw sheet not found!"); return; }

  let targetSheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (targetSheet) {
    targetSheet.clearContents().clearFormats(); 
  } else {
    targetSheet = ss.insertSheet(DASHBOARD_SHEET_NAME);
  }

  const sourceDataValues = sourceSheet.getDataRange().getValues();
  if (sourceDataValues.length === 0) return;
  
  const sourceHeaders = sourceDataValues[0].map(header => String(header).trim());
  
  // --- BUILD HEADERS ---
  const targetHeaders = [...sourceHeaders, URL_COLUMN_HEADER, REVIEWED_COLUMN_HEADER];
  targetSheet.appendRow(targetHeaders);
  targetSheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight("bold");

  // --- IDENTIFY COLUMNS ---
  const keyIndex = sourceHeaders.indexOf(KEY_COLUMN_HEADER);
  const commentIndex = sourceHeaders.indexOf(COMMENT_TEXT_COLUMN_HEADER);
  const updatedIndex = sourceHeaders.indexOf(ISSUE_UPDATED_DATE_COLUMN_HEADER);

  if (keyIndex === -1) { Logger.log("Key column missing!"); return; }

  // --- PROCESS DATA (PASS-THROUGH & DEDUPLICATION) ---
  const consolidatedIssues = {};

  for (let i = 1; i < sourceDataValues.length; i++) {
    const currentRow = sourceDataValues[i];
    const issueKey = currentRow[keyIndex];
    
    if (!issueKey || issueKey.toString().trim() === "") continue;

    consolidatedIssues[issueKey] = {
      rowData: [...currentRow], 
      latestCommentText: (commentIndex > -1) ? currentRow[commentIndex] : ""
    };
  }

  // --- OUTPUT DATA & MEMORY CHECK ---
  const outputRows = [];
  const issueKeysSorted = Object.keys(consolidatedIssues).sort(); 
  const scriptProperties = PropertiesService.getScriptProperties(); // Access memory here

  for (const key of issueKeysSorted) {
    const issueEntry = consolidatedIssues[key];
    const outputRow = [...issueEntry.rowData]; 

    // Ensure comment is latest
    if(commentIndex > -1 && commentIndex < outputRow.length) {
        outputRow[commentIndex] = issueEntry.latestCommentText;
    }
    
    // Fill empty cells to match header width
    while (outputRow.length < sourceHeaders.length) outputRow.push("");

    // Add URL
    outputRow.push(`=HYPERLINK("${JIRA_INSTANCE_URL}/browse/${key}", "Open Ticket")`);
    
    // --- MEMORY CHECK FIX ---
    // Check if the current timestamp is older or equal to our last reviewed timestamp
    const dateVal = outputRow[updatedIndex];
    const currentTs = dateVal ? new Date(dateVal).getTime() : 0;
    const lastReviewedTs = parseFloat(scriptProperties.getProperty(`lastReviewedTs_${key}`)) || 0;
    
    const isChecked = (lastReviewedTs > 0 && currentTs <= lastReviewedTs);
    outputRow.push(isChecked); // Now pushes true if already read, false if new!

    outputRows.push(outputRow);
  }

  // Write to sheet
  if (outputRows.length > 0) {
    const dataRange = targetSheet.getRange(2, 1, outputRows.length, targetHeaders.length);
    dataRange.setValues(outputRows);
    targetSheet.getRange(2, targetHeaders.length, outputRows.length, 1).insertCheckboxes();
    
    targetSheet.getDataRange().setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); 
    
    try { targetSheet.autoResizeColumns(1, targetHeaders.length); } catch(e) {}
  }
}

function highlightNewUpdatesAndHandleCheckbox() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!sheet) return;

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  if (data.length < 2) return;

  const headers = data[0].map(header => String(header).trim());
  const keyIndex = headers.indexOf(KEY_COLUMN_HEADER);
  const updatedIndex = headers.indexOf(ISSUE_UPDATED_DATE_COLUMN_HEADER);
  const reviewedIndex = headers.indexOf(REVIEWED_COLUMN_HEADER);

  if (keyIndex === -1 || updatedIndex === -1 || reviewedIndex === -1) return;

  const scriptProperties = PropertiesService.getScriptProperties();

  for (let i = 1; i < data.length; i++) { 
    const currentRowInSheet = i + 1; 
    const issueKey = data[i][keyIndex];
    const dateVal = data[i][updatedIndex];
    const currentTs = dateVal ? new Date(dateVal).getTime() : 0;
    let isReviewed = data[i][reviewedIndex] === true;

    if (!issueKey) continue;

    const tsKey = `lastReviewedTs_${issueKey}`;
    let lastReviewedTs = parseFloat(scriptProperties.getProperty(tsKey)) || 0; 
    const rowRange = sheet.getRange(currentRowInSheet, 1, 1, sheet.getLastColumn());

    if (isReviewed) {
      rowRange.setBackground(DEFAULT_BACKGROUND_COLOR);
      scriptProperties.setProperty(tsKey, currentTs.toString());
    } else {
      if (currentTs > lastReviewedTs) {
        rowRange.setBackground(NEW_UPDATE_HIGHLIGHT_COLOR);
      } else {
        rowRange.setBackground(DEFAULT_BACKGROUND_COLOR);
      }
    }
  }
}

function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DASHBOARD_SHEET_NAME || e.range.getRow() === 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const reviewedIndex = headers.indexOf(REVIEWED_COLUMN_HEADER);
  const keyIndex = headers.indexOf(KEY_COLUMN_HEADER);
  const updatedIndex = headers.indexOf(ISSUE_UPDATED_DATE_COLUMN_HEADER);

  if (e.range.getColumn() === reviewedIndex + 1) { 
    const rowNum = e.range.getRow();
    const issueKey = sheet.getRange(rowNum, keyIndex + 1).getValue();
    const updateDateVal = sheet.getRange(rowNum, updatedIndex + 1).getValue();
    const updatedTs = updateDateVal ? new Date(updateDateVal).getTime() : 0;

    if (e.value === "TRUE" || e.value === true) {
       sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).setBackground(DEFAULT_BACKGROUND_COLOR);
       PropertiesService.getScriptProperties().setProperty(`lastReviewedTs_${issueKey}`, updatedTs.toString());
    }
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Jira Dashboard Tools').addItem('Run Update', 'runHourlyDashboardUpdate').addToUi();
}
