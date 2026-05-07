import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID!;

  // Check all totals rows to see column shifts
  console.log("=== Detailed budget B90:F105 (FORMULA) - Last blocks ===");
  const r1 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Detailed budget!B90:F105', valueRenderOption: 'FORMULA' });
  (r1.data.values || []).forEach((row, i) => console.log(`  Row ${90+i}: ${JSON.stringify(row)}`));
}
main().catch(console.error);
