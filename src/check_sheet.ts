import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID!;

  // Guest list - full headers and more rows
  console.log("=== Guest list A1:T20 ===");
  const r1 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Guest list!A1:T20' });
  (r1.data.values || []).forEach((row, i) => console.log(`  Row ${i+1}: ${JSON.stringify(row)}`));

  // Guest list - check how many guests exist
  const r1b = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Guest list!C6:C149' });
  const guestCount = (r1b.data.values || []).filter(r => r[0] && r[0].trim()).length;
  console.log(`\n  Total guests with names: ${guestCount}`);

  // Invitations - full structure
  console.log("\n=== Invitations A1:Q19 ===");
  const r2 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Invitations!A1:Q19' });
  (r2.data.values || []).forEach((row, i) => console.log(`  Row ${i+1}: ${JSON.stringify(row)}`));
}

main().catch(console.error);
