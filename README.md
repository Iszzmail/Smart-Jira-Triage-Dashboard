# 📊 Smart Jira Triage Dashboard

An automated, stateful tracking dashboard built on Google Sheets and Google Apps Script to manage high volumes of Jira tickets.

## 🚀 Overview

When tracking multiple bug reports and feature requests in Jira, native notifications can become noisy. Standard data exports often create cluttered, duplicate rows every time a developer drops a new comment. 

This project solves that bottleneck by transforming a chaotic raw Jira data export into a clean, actionable, real-time alert system. It acts as a middleware layer within Google Sheets, enforcing deduplication, managing state, and providing visual alerts for new engineer comments.

## ✨ Features

* **Intelligent Deduplication:** Automatically groups raw Jira data by Issue Key, strictly enforcing a "One Row Per Ticket" rule and extracting only the absolute latest comment.
* **Stateful "Memory" & Visual Alerts:** Uses Google Apps Script's `PropertiesService` to remember the exact timestamp a ticket was last reviewed. If an engineer updates the ticket, the script instantly highlights the row in teal.
* **Zero-Latency UX (Interactive UI):** Features an interactive "Mark Read" checkbox column powered by `onEdit` triggers. Clicking the checkbox instantly removes the highlight and commits the new timestamp to memory—no waiting for the next hourly data sync.
* **Dynamic Deep Linking:** Automatically generates clickable hyperlinks to the exact Jira ticket for seamless navigation.

## 🛠️ Tech Stack

* **Google Apps Script (JavaScript):** Core automation, data parsing, and persistent state management.
* **Google Sheets API:** The lightweight, accessible front-end UI.
* **Jira Cloud:** Source of truth for ticket data (ingested via a 3rd-party Google Sheets Jira connector).

## ⚙️ Setup & Installation

To run this dashboard yourself, you will need a Google Sheet connected to your Jira instance (using a tool like the *Jira Cloud for Sheets* add-on).

### 1. Prepare Your Google Sheet
1. Create a sheet named `JiraRawImport`.
2. Configure your Jira connector to pull data into this sheet. Ensure you are importing the following columns at minimum: `Key`, `Comment.text` (or equivalent), and `Updated` (the Jira issue updated timestamp).

### 2. Add the Apps Script
1. In your Google Sheet, navigate to **Extensions > Apps Script**.
2. Delete any code in the default `Code.gs` file and paste the JavaScript code from this repository.
3. Save the project.

### 3. Configure the Variables
At the top of the `Code.gs` file, update the configuration block to match your specific setup:

### 4. Set Up Automation (Triggers)
To make the dashboard run automatically:

In the Apps Script editor, click the Triggers icon (the clock) on the left sidebar.

Click + Add Trigger.

Choose which function to run: runHourlyDashboardUpdate.

Select event source: Time-driven.

Select type of time based trigger: Hour timer (or your preferred frequency).

Save the trigger.

```javascript
// MUST MATCH YOUR RAW SHEET HEADERS EXACTLY
const KEY_COLUMN_HEADER = "Key";
const COMMENT_TEXT_COLUMN_HEADER = "Comment.text";
const ISSUE_UPDATED_DATE_COLUMN_HEADER = "Updated";

// Replace with your actual Jira URL
const JIRA_INSTANCE_URL = "https://YOUR_DOMAIN.atlassian.net";

.

📖 How to Use
Open your Google Sheet. The custom menu Jira Dashboard Tools will appear at the top.

Click Jira Dashboard Tools > Run Update to manually force a sync.

Switch to the JiraDashboardData sheet.

Any ticket with a new comment or update since you last checked will be highlighted.

Read the comment, then click the Mark Read checkbox. The highlight will instantly disappear, and the system will log that you have reviewed it up to that specific timestamp.
