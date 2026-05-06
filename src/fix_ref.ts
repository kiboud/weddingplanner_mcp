import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const service = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID!;

  // Fetch formulas from Detailed budget
  const response = await service.spreadsheets.values.get({
    spreadsheetId,
    range: 'Detailed budget!B1:D',
    valueRenderOption: 'FORMULA',
  });
  const values = response.data.values || [];
  
  const cTotals = [];
  const dTotals = [];
  
  // Find all block totals by looking for ='Budget estimator'!$C$...
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[0] && typeof row[0] === 'string' && row[0].includes('Budget estimator') && row[0].includes('$C$')) {
      cTotals.push(`C${i + 1}`);
      dTotals.push(`D${i + 1}`);
    }
  }
  
  // Find the row that has #REF!
  let refRowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[1] && typeof row[1] === 'string' && row[1].includes('#REF!')) {
      refRowIndex = i + 1;
      break;
    }
  }
  
  if (refRowIndex !== -1 && cTotals.length > 0) {
    const cFormula = `=${cTotals.join('+')}`;
    const dFormula = `=${dTotals.join('+')}`;
    
    await service.spreadsheets.values.update({
      spreadsheetId,
      range: `Detailed budget!C${refRowIndex}:D${refRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[cFormula, dFormula]]
      }
    });
    console.log(`Fixed #REF! at row ${refRowIndex} with formulas: ${cFormula}, ${dFormula}`);
  } else {
    console.log("No #REF! row found or no totals found.");
  }
}

main().catch(console.error);
