import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const service = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID!;

  const res = await service.spreadsheets.get({ spreadsheetId });
  const detailedSheetId = res.data.sheets?.find(s => s.properties?.title === 'Detailed budget')?.properties?.sheetId!;
  const estSheetId = res.data.sheets?.find(s => s.properties?.title === 'Budget estimator')?.properties?.sheetId!;

  // Delete Pre-wedding block in Detailed budget (rows 103-108)
  await service.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: detailedSheetId,
            dimension: "ROWS",
            startIndex: 102, // Row 103 (empty separator)
            endIndex: 108    // Row 108 (totals) — exclusive = 109
          }
        }
      }]
    }
  });

  // Delete Budget estimator row 23 (Pre-wedding)
  await service.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: estSheetId,
            dimension: "ROWS",
            startIndex: 22, // Row 23
            endIndex: 23
          }
        }
      }]
    }
  });

  console.log("Cleaned up Pre-wedding from both sheets. Ready for re-test.");
}

main().catch(console.error);
