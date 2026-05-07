import { google, sheets_v4 } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

// --- Date normalization utility ---
// Accepts many formats: "10 Mei 2026", "2026-05-10", "10/5/2026", "5/10/2026", "10 May 2026", etc.
// Returns MM/DD/YYYY which Google Sheets always parses correctly as a date serial.
const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
};

export function parseDate(input: string): string {
  if (!input || input.trim() === '') return '';
  const s = input.trim();

  // Already MM/DD/YYYY or M/D/YYYY → pass through
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${parseInt(iso[2])}/${parseInt(iso[3])}/${iso[1]}`;

  // "10 Mei 2026" or "10 May 2026" (Indonesian/English month name)
  const named = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const day = parseInt(named[1]);
    const monthStr = named[2].toLowerCase();
    const year = parseInt(named[3]);
    // Try Indonesian first, then English via Date.parse
    const idMonth = INDONESIAN_MONTHS[monthStr];
    if (idMonth) return `${idMonth}/${day}/${year}`;
    const parsed = new Date(`${named[2]} ${day} ${year}`);
    if (!isNaN(parsed.getTime())) return `${parsed.getMonth() + 1}/${day}/${year}`;
  }

  // DD/MM/YYYY (common in Indonesia) — heuristic: if first number > 12, it must be day
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const a = parseInt(dmy[1]), b = parseInt(dmy[2]);
    if (a > 12) return `${b}/${a}/${dmy[3]}`; // definitely DD/MM/YYYY
    return s; // ambiguous — return as-is (Sheets will handle it)
  }

  // Fallback: try JS Date parse and reformat
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

  return s; // give up, pass as-is
}

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = process.env.SPREADSHEET_ID || '';
    if (!this.spreadsheetId) {
      throw new Error("SPREADSHEET_ID environment variable is missing.");
    }
  }

  async getTodos() {
    // Reads starting from row 6 under B5:E5
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'To-do!B6:E',
    });
    return response.data.values || [];
  }

  async addTodo(todo: string[]) {
    // todo = [task, dueDate (already normalized), progress, notes]
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'To-do!B6:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [todo],
      },
    });
    return response.data;
  }

  async updateTodoRow(rowIndex: number, todo: string[]) {
    // rowIndex is the absolute row number on the sheet
    const range = `To-do!B${rowIndex}:E${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [todo],
      },
    });
    return response.data;
  }

  async deleteTodoRow(rowIndex: number) {
    // Clears the content of the specified row
    const range = `To-do!B${rowIndex}:E${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return response.data;
  }

  // --- Coordination Sheet Methods ---

  async getCoordination() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Coordination!B6:H',
    });
    return response.data.values || [];
  }

  async addCoordinationRow(data: string[]) {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Coordination!B6:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
    return response.data;
  }

  async updateCoordinationRow(rowIndex: number, data: string[]) {
    const range = `Coordination!B${rowIndex}:H${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
    return response.data;
  }

  async deleteCoordinationRow(rowIndex: number) {
    const range = `Coordination!B${rowIndex}:H${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return response.data;
  }

  // --- Schedule Sheet Methods ---

  async getSchedule() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Schedule!B6:E',
    });
    return response.data.values || [];
  }

  async addScheduleRow(data: string[]) {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Schedule!B6:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
    return response.data;
  }

  async updateScheduleRow(rowIndex: number, data: string[]) {
    const range = `Schedule!B${rowIndex}:E${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
    return response.data;
  }

  async deleteScheduleRow(rowIndex: number) {
    const range = `Schedule!B${rowIndex}:E${rowIndex}`;
    const response = await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return response.data;
  }

  // --- Budget Methods ---

  async getSheetId(title: string): Promise<number> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    const sheet = response.data.sheets?.find(s => s.properties?.title === title);
    if (!sheet || sheet.properties?.sheetId == null) {
      throw new Error(`Sheet with title ${title} not found`);
    }
    return sheet.properties.sheetId as number;
  }

  async getBudgetSummary() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Budget estimator!B9:E30',
    });
    return response.data.values || [];
  }

  async getDetailedBudget() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B4:E',
    });
    return response.data.values || [];
  }

  async addBudgetItem(category: string, item: string, vendor: string, actual: number) {
    const detailedSheetId = await this.getSheetId('Detailed budget');
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
    });
    const values = response.data.values?.map(v => v[0] || "") || [];
    
    const catIndex = values.indexOf(category);
    if (catIndex === -1) throw new Error(`Category '${category}' not found in Detailed budget`);
    
    let plannedIndex = -1;
    for (let i = catIndex + 1; i < values.length; i++) {
      if (values[i] === "Planned budget") {
        plannedIndex = i;
        break;
      }
    }
    if (plannedIndex === -1) throw new Error(`Could not find 'Planned budget' row for category '${category}'`);
    
    // Find empty item rows
    let emptyRows = [];
    for (let i = catIndex + 1; i < plannedIndex; i++) {
      if (values[i] === "") emptyRows.push(i);
    }

    let isInsert = false;
    let newRowIndex = plannedIndex;
    
    // We must preserve at least 1 empty boundary row at the bottom for the sum formula.
    if (emptyRows.length > 1) {
      newRowIndex = emptyRows[0]; // Overwrite the first empty row
    } else {
      isInsert = true;
      newRowIndex = plannedIndex - 1; // Insert ABOVE the boundary row
    }
    
    if (isInsert) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: detailedSheetId,
                dimension: "ROWS",
                startIndex: newRowIndex,
                endIndex: newRowIndex + 1
              },
              inheritFromBefore: true
            }
          }]
        }
      });
    }

    const rowNum = newRowIndex + 1; // 1-indexed
    const vlookupFormula = `=IFNA(VLOOKUP(C${rowNum}, Vendors!B:H, 7, FALSE), "")`;
    const range = `Detailed budget!B${rowNum}:E${rowNum}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[item, vendor || "Vendor name", vlookupFormula, actual]],
      },
    });

    return { success: true, row: rowNum };
  }

  async updateBudgetItem(category: string, oldItemName: string, newItemName: string, vendor?: string, actual?: number) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
    });
    const values = response.data.values?.map(v => v[0] || "") || [];
    
    const catIndex = values.indexOf(category);
    if (catIndex === -1) throw new Error(`Category '${category}' not found`);
    
    let plannedIndex = -1;
    for (let i = catIndex + 1; i < values.length; i++) {
      if (values[i] === "Planned budget") {
        plannedIndex = i;
        break;
      }
    }
    if (plannedIndex === -1) throw new Error(`Could not find 'Planned budget' row for category '${category}'`);

    let itemIndex = -1;
    for (let i = catIndex + 1; i < plannedIndex; i++) {
      if (values[i] === oldItemName) {
        itemIndex = i;
        break;
      }
    }
    if (itemIndex === -1) throw new Error(`Item '${oldItemName}' not found in category '${category}'`);

    const rowNum = itemIndex + 1;

    // Read current values to preserve unchanged fields
    const currentRow = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `Detailed budget!B${rowNum}:E${rowNum}`,
    });
    const current = currentRow.data.values?.[0] || ['', '', '', ''];

    const vlookupFormula = `=IFNA(VLOOKUP(C${rowNum}, Vendors!B:H, 7, FALSE), "")`;
    const range = `Detailed budget!B${rowNum}:E${rowNum}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          newItemName || current[0],
          vendor !== undefined ? vendor : current[1],
          vlookupFormula,
          actual !== undefined ? actual : current[3]
        ]],
      },
    });
    
    return { success: true, row: rowNum };
  }

  async deleteBudgetItem(category: string, itemName: string) {
    const detailedSheetId = await this.getSheetId('Detailed budget');
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
    });
    const values = response.data.values?.map(v => v[0] || "") || [];
    
    const catIndex = values.indexOf(category);
    if (catIndex === -1) throw new Error(`Category '${category}' not found`);
    
    let plannedIndex = -1;
    for (let i = catIndex + 1; i < values.length; i++) {
      if (values[i] === "Planned budget") {
        plannedIndex = i;
        break;
      }
    }

    let itemIndex = -1;
    for (let i = catIndex + 1; i < (plannedIndex === -1 ? values.length : plannedIndex); i++) {
      if (values[i] === itemName) {
        itemIndex = i;
        break;
      }
    }
    if (itemIndex === -1) throw new Error(`Item '${itemName}' not found in category '${category}'`);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: detailedSheetId,
                dimension: "ROWS",
                startIndex: itemIndex,
                endIndex: itemIndex + 1
              }
            }
          }
        ]
      }
    });

    return { success: true, deletedRow: itemIndex + 1 };
  }
  async deleteBudgetCategory(categoryName: string) {
    // Guard: prevent deleting built-in categories
    const protectedCategories = [
      'Ceremony', 'Reception', 'Decoration', 'Invitations', 'Attire',
      'Flowers', 'Music', 'Photo & video', 'Photography', 'Entertainment', 'Misc',
      'Food & Beverages', 'Transport', 'Venue'
    ];
    if (protectedCategories.some(c => c.toLowerCase() === categoryName.toLowerCase())) {
      throw new Error(`Cannot delete protected built-in category '${categoryName}'. Only custom categories can be deleted.`);
    }

    const detailedSheetId = await this.getSheetId('Detailed budget');
    const estSheetId = await this.getSheetId('Budget estimator');

    // 1. Find category in Budget estimator
    const estResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Budget estimator!B1:B',
    });
    const estValues = estResponse.data.values?.map(v => v[0] || "") || [];
    const estIndex = estValues.indexOf(categoryName);
    if (estIndex === -1) throw new Error(`Category '${categoryName}' not found in Budget estimator`);
    const estRowNum = estIndex + 1; // 1-indexed

    // 2. Find category block in Detailed budget using FORMULA to locate the header
    const detResponseFormula = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
      valueRenderOption: 'FORMULA',
    });
    const detFormulas = detResponseFormula.data.values?.map(v => v[0] || "") || [];

    // Find the header row that references this Budget estimator row
    let headerIndex = -1;
    const refPattern = `$B$${estRowNum}`;
    for (let i = 0; i < detFormulas.length; i++) {
      if (typeof detFormulas[i] === 'string' && detFormulas[i].includes(refPattern)) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) throw new Error(`Could not find Detailed budget block for '${categoryName}'`);

    // Find the totals row (the row after "Planned budget" within this block)
    const detValues = (await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
    })).data.values?.map(v => v[0] || "") || [];

    let totalsIndex = -1;
    for (let i = headerIndex + 1; i < detValues.length; i++) {
      if (detValues[i] === "Planned budget") {
        totalsIndex = i + 1; // The row after "Planned budget" labels is the totals row
        break;
      }
    }
    if (totalsIndex === -1) throw new Error(`Could not find totals row for '${categoryName}'`);

    // 3. Delete the block from Detailed budget (including the empty separator row before it)
    const deleteStart = Math.max(0, headerIndex - 1); // Include empty separator
    const deleteEnd = totalsIndex + 1; // Include totals row (exclusive)

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: detailedSheetId,
              dimension: "ROWS",
              startIndex: deleteStart,
              endIndex: deleteEnd
            }
          }
        }]
      }
    });

    // 4. Delete the row from Budget estimator
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: estSheetId,
              dimension: "ROWS",
              startIndex: estIndex,
              endIndex: estIndex + 1
            }
          }
        }]
      }
    });

    return { success: true, categoryName, deletedEstRow: estRowNum, deletedDetailedRows: `${deleteStart + 1}-${deleteEnd}` };
  }

  async updateBudgetCategory(oldName: string, newName: string, estimate?: number) {
    // Find category in Budget estimator
    const estResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Budget estimator!B1:B',
    });
    const estValues = estResponse.data.values?.map(v => v[0] || "") || [];
    
    const estIndex = estValues.indexOf(oldName);
    if (estIndex === -1) throw new Error(`Category '${oldName}' not found in Budget estimator`);
    const estRowNum = estIndex + 1; // 1-indexed

    // Check if new name conflicts with existing category
    if (oldName !== newName && estValues.includes(newName)) {
      throw new Error(`Category '${newName}' already exists in Budget estimator`);
    }

    // Update name in Budget estimator (Detailed budget header auto-updates via formula reference)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Budget estimator!B${estRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newName]],
      },
    });

    // Update estimate if provided
    if (estimate !== undefined) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Budget estimator!C${estRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[estimate]],
        },
      });
    }

    return { success: true, oldName, newName, estRowNum, estimateUpdated: estimate !== undefined };
  }

  async addBudgetCategory(categoryName: string) {
    const estSheetId = await this.getSheetId('Budget estimator');
    
    // 1. Find available slot in Budget estimator
    const estResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Budget estimator!B1:B',
    });
    const estValues = estResponse.data.values?.map(v => v[0] || "") || [];

    // Check for duplicate
    if (estValues.includes(categoryName)) {
      throw new Error(`Category '${categoryName}' already exists in Budget estimator`);
    }
    
    // Header is row 8 (Totals). Items start at row 9.
    let targetEstIndex = -1;
    let lastItemIndex = -1;
    for (let i = 8; i < estValues.length; i++) {
      if (estValues[i] === "") break; // end of table
      lastItemIndex = i;
      if (targetEstIndex === -1 && (estValues[i].startsWith("Custom category") || estValues[i] === "Post reception" /* wait, just look for custom category or empty but within table */)) {
        if (estValues[i].startsWith("Custom category")) {
          targetEstIndex = i;
        }
      }
    }
    
    let estRowNum = -1;
    let needsEstInsert = false;
    
    if (targetEstIndex !== -1) {
      estRowNum = targetEstIndex + 1; // 1-indexed
    } else {
      // Table is full, we must insert a new row at lastItemIndex + 1
      needsEstInsert = true;
      targetEstIndex = lastItemIndex; 
      estRowNum = lastItemIndex + 2; // the new row will be inserted here
    }

    // 2. Prepare Budget estimator update
    if (needsEstInsert) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: estSheetId,
                  dimension: "ROWS",
                  startIndex: estRowNum - 1,
                  endIndex: estRowNum
                },
                inheritFromBefore: true
              }
            },
            {
              copyPaste: {
                source: {
                  sheetId: estSheetId,
                  startRowIndex: estRowNum - 2, // Copy the row above
                  endRowIndex: estRowNum - 1,
                  startColumnIndex: 1, // B
                  endColumnIndex: 5 // F (covers B, C, D, E)
                },
                destination: {
                  sheetId: estSheetId,
                  startRowIndex: estRowNum - 1,
                  endRowIndex: estRowNum,
                  startColumnIndex: 1,
                  endColumnIndex: 5
                },
                pasteType: "PASTE_NORMAL",
                pasteOrientation: "NORMAL"
              }
            }
          ]
        }
      });
      // We also need to clear C and D
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Budget estimator!C${estRowNum}:D${estRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [["", ""]],
        },
      });
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Budget estimator!B${estRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[categoryName]],
      },
    });

    // 3. Find the last block in Detailed budget
    const detailedSheetId = await this.getSheetId('Detailed budget');
    const detResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
    });
    const detValues = detResponse.data.values?.map(v => v[0] || "") || [];
    
    let lastPlannedIndex = -1;
    for (let i = detValues.length - 1; i >= 0; i--) {
      if (detValues[i] === "Planned budget") {
        lastPlannedIndex = i;
        break;
      }
    }
    if (lastPlannedIndex === -1) throw new Error("Could not find any 'Planned budget' blocks to clone");
    
    // Fetch formulas to accurately find the block header
    const detResponseFormula = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Detailed budget!B1:B',
      valueRenderOption: 'FORMULA',
    });
    const detFormulas = detResponseFormula.data.values?.map(v => v[0] || "") || [];

    let headerIndex = -1;
    for (let i = lastPlannedIndex; i >= 0; i--) {
      if (typeof detFormulas[i] === 'string' && detFormulas[i].includes('Budget estimator')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) headerIndex = 3; 
    
    const blockEndIndex = lastPlannedIndex + 1; // Totals row
    const blockLength = blockEndIndex - headerIndex + 1;
    
    const newHeaderIndex = blockEndIndex + 2; // Leave 1 empty row
    const newPlannedIndex = newHeaderIndex + (lastPlannedIndex - headerIndex);
    
    // Calculate how many extra rows to delete from the cloned block
    // We want exactly 2 item rows: 1 cleared item (for formatting) and 1 empty boundary row (for sum expansion).
    const rowsBetween = lastPlannedIndex - headerIndex - 1;
    const rowsToDelete = Math.max(0, rowsBetween - 2);
    
    // 4. Insert rows at the bottom and CopyPaste
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: detailedSheetId,
                dimension: "ROWS",
                startIndex: blockEndIndex + 1,
                endIndex: blockEndIndex + 1 + blockLength + 2
              },
              inheritFromBefore: false
            }
          },
          {
            copyPaste: {
              source: {
                sheetId: detailedSheetId,
                startRowIndex: headerIndex,
                endRowIndex: blockEndIndex + 1,
                startColumnIndex: 1, // B
                endColumnIndex: 5 // F (covers B, C, D, E)
              },
              destination: {
                sheetId: detailedSheetId,
                startRowIndex: newHeaderIndex,
                endRowIndex: newHeaderIndex + blockLength,
                startColumnIndex: 1,
                endColumnIndex: 5
              },
              pasteType: "PASTE_NORMAL",
              pasteOrientation: "NORMAL"
            }
          },
          ...(rowsToDelete > 0 ? [{
            deleteDimension: {
              range: {
                sheetId: detailedSheetId,
                dimension: "ROWS",
                // Delete from the second item row onwards (leaving the first item and the last empty item if possible)
                startIndex: newHeaderIndex + 2,
                endIndex: newHeaderIndex + 2 + rowsToDelete
              }
            }
          }] : [])
        ]
      }
    });

    const adjustedPlannedIndex = newPlannedIndex - rowsToDelete;

    // After deletion, the new block structure should be:
    // newHeaderIndex     : header row (='Budget estimator'!$B$N)
    // newHeaderIndex + 1 : first item row (cleared to empty)
    // newHeaderIndex + 2 : empty boundary row (for sum expansion)
    // adjustedPlannedIndex : "Planned budget" labels row
    // adjustedPlannedIndex + 1 : totals row (='Budget estimator'!$C$N, =sum(...), =sum(...))
    
    const headerRowNum = newHeaderIndex + 1;        // 1-indexed
    const firstItemRowNum = newHeaderIndex + 2;      // 1-indexed
    const boundaryRowNum = newHeaderIndex + 3;       // 1-indexed  
    const totalRowNum = adjustedPlannedIndex + 2;    // 1-indexed

    // 5a. Fix header reference
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Detailed budget!B${headerRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[`='Budget estimator'!$B$${estRowNum}`]],
      },
    });

    // 5b. Fix totals row: planned budget reference + sum formulas as RANGE
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Detailed budget!B${totalRowNum}:E${totalRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          `='Budget estimator'!$C$${estRowNum}`,
          '',
          `=sum(D${firstItemRowNum}:D${boundaryRowNum})`,
          `=sum(E${firstItemRowNum}:E${boundaryRowNum})`
        ]],
      },
    });

    // 5c. Clear item row (leave formatting, set vendor placeholder)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Detailed budget!B${firstItemRowNum}:E${firstItemRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [["", "Vendor name", `=IFNA(VLOOKUP(C${firstItemRowNum}, Vendors!B:H, 7, FALSE), "")`, 0]],
      },
    });

    // 5d. Clear boundary row
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Detailed budget!B${boundaryRowNum}:E${boundaryRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [["", "", "", ""]],
      },
    });

    // 6. Fix Budget estimator Actual column (Column D references Detailed budget col E)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Budget estimator!D${estRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[`='Detailed budget'!E${totalRowNum}`]],
      },
    });

    return { success: true, categoryName, estRowNum, newDetailedRow: headerRowNum };
  }

  // --- Vendors Sheet Methods ---

  async getVendors() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Vendors!B5:I',
    });
    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0]; // Row 5: headers
    return rows.slice(1) // Row 6+: data
      .filter(row => row.some(cell => cell && cell.toString().trim() !== ''))
      .map((row, i) => {
        const obj: any = { rowNumber: i + 6 };
        headers.forEach((h, j) => {
          obj[h] = row[j] || '';
        });
        return obj;
      });
  }

  async addVendor(data: Record<string, any>) {
    const fieldMap: Record<string, number> = {
      name: 0, contact: 1, phone: 2, email: 3, website: 4, address: 5, cost: 6, notes: 7
    };

    // Find first empty row
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Vendors!B6:B',
    });
    const values = response.data.values || [];
    let emptyIndex = values.findIndex(row => !row[0] || row[0].toString().trim() === '');
    const rowNumber = emptyIndex !== -1 ? emptyIndex + 6 : values.length + 6;

    const row = new Array(8).fill('');
    for (const [key, colIdx] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) row[colIdx] = data[key];
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Vendors!B${rowNumber}:I${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return { success: true, rowNumber };
  }

  async updateVendor(rowNumber: number, data: Record<string, any>) {
    const fieldMap: Record<string, number> = {
      name: 0, contact: 1, phone: 2, email: 3, website: 4, address: 5, cost: 6, notes: 7
    };

    // Read current values
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `Vendors!B${rowNumber}:I${rowNumber}`,
    });
    const current = response.data.values?.[0] || new Array(8).fill('');

    for (const [key, colIdx] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) current[colIdx] = data[key];
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Vendors!B${rowNumber}:I${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [current] },
    });

    return { success: true, rowNumber };
  }

  async deleteVendor(rowNumber: number) {
    const sheetId = await this.getSheetId('Vendors');
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }]
      }
    });
    return { success: true, deletedRow: rowNumber };
  }

  // --- Guest List Methods ---

  async getGuestList() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Guest list!C5:S',
    });
    const rows = response.data.values || [];
    if (rows.length === 0) return [];
    
    const headers = rows[0]; // Row 5 = headers
    return rows.slice(1).map((row, i) => {
      const guest: Record<string, string> = { rowNumber: String(i + 6) }; // Data starts at row 6
      headers.forEach((h: string, j: number) => {
        if (h && row[j]) guest[h] = row[j];
      });
      return guest;
    }).filter(g => g['First Name(s)'] || g['Last Name(s)']); // Only return rows with names
  }

  async addGuest(data: {
    firstName: string; lastName?: string; address?: string; email?: string;
    invitedBy?: string; saveTheDate?: string; invitation?: string; response?: string;
    attending?: number; children?: number; rehearsalInvited?: number; rehearsalGoing?: number;
    dietaryRestrictions?: string; tableNumber?: number; giftDescription?: string;
    thankYouSent?: string; notes?: string;
  }) {
    // Find first empty row
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Guest list!C6:C',
    });
    const values = response.data.values || [];
    let emptyIndex = values.findIndex(v => !v[0] || v[0].trim() === '');
    const rowNum = emptyIndex === -1 ? values.length + 6 : emptyIndex + 6;

    const row = [
      data.firstName || '', data.lastName || '', data.address || '', data.email || '',
      data.invitedBy || '', data.saveTheDate || '', data.invitation || '', data.response || '',
      data.attending ?? '', data.children ?? '', data.rehearsalInvited ?? '', data.rehearsalGoing ?? '',
      data.dietaryRestrictions || '', data.tableNumber ?? '', data.giftDescription || '',
      data.thankYouSent || '', data.notes || ''
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Guest list!C${rowNum}:S${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return { success: true, rowNumber: rowNum };
  }

  async updateGuest(rowNumber: number, data: Record<string, any>) {
    // Map field names to column letters
    const fieldMap: Record<string, string> = {
      firstName: 'C', lastName: 'D', address: 'E', email: 'F',
      invitedBy: 'G', saveTheDate: 'H', invitation: 'I', response: 'J',
      attending: 'K', children: 'L', rehearsalInvited: 'M', rehearsalGoing: 'N',
      dietaryRestrictions: 'O', tableNumber: 'P', giftDescription: 'Q',
      thankYouSent: 'R', notes: 'S'
    };

    for (const [field, value] of Object.entries(data)) {
      const col = fieldMap[field];
      if (!col) continue;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Guest list!${col}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    }

    return { success: true, rowNumber };
  }

  async deleteGuest(rowNumber: number) {
    const sheetId = await this.getSheetId('Guest list');
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }]
      }
    });
    return { success: true, deletedRow: rowNumber };
  }

  async searchGuests(query: string) {
    const guests = await this.getGuestList();
    const q = query.toLowerCase();
    return guests.filter(g => {
      return Object.values(g).some(v => typeof v === 'string' && v.toLowerCase().includes(q));
    });
  }

  async getGuestSummary() {
    const guests = await this.getGuestList();
    const total = guests.length;
    const attending = guests.filter(g => g['Attending']).reduce((sum, g) => sum + (parseInt(g['Attending']) || 0), 0);
    const responded = guests.filter(g => g['Response']).length;
    const accepted = guests.filter(g => g['Response']?.toLowerCase() === 'yes' || g['Response']?.toLowerCase() === 'accepted').length;
    const maybe = guests.filter(g => g['Response']?.toLowerCase() === 'maybe').length;
    const declined = guests.filter(g => g['Response']?.toLowerCase() === 'no' || g['Response']?.toLowerCase() === 'declined').length;
    const noResponse = total - responded;

    const byInvitedBy: Record<string, number> = {};
    guests.forEach(g => {
      const by = g['Invited by...'] || 'Unknown';
      byInvitedBy[by] = (byInvitedBy[by] || 0) + 1;
    });

    return { total, attending, responded, accepted, maybe, declined, noResponse, byInvitedBy };
  }

  // --- Invitations Methods ---

  async getInvitations() {
    // Get summary counts
    const summaryRes = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Invitations!B3:H4',
    });
    const summaryRows = summaryRes.data.values || [];

    // Get vendor table
    const vendorRes = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Invitations!B7:P19',
    });
    const vendorRows = vendorRes.data.values || [];
    const headers = vendorRows[0] || [];
    const vendors = vendorRows.slice(1).map((row, i) => {
      const vendor: Record<string, string> = { rowNumber: String(i + 8) };
      headers.forEach((h: string, j: number) => {
        if (h && row[j]) vendor[h] = row[j];
      });
      return vendor;
    }).filter(v => v['Name']);

    return {
      summary: {
        invitations: summaryRows[0]?.[1] || '0',
        rsvpCards: summaryRows[0]?.[3] || '0',
        thankYous: summaryRows[0]?.[5] || '0',
        programs: summaryRows[1]?.[1] || '0',
        placecards: summaryRows[1]?.[3] || '0',
      },
      vendors
    };
  }

  async addInvitationVendor(data: {
    name: string; phone?: string; email?: string; website?: string;
    invitationCost?: number; rsvpCost?: number; thankYouCost?: number;
    programCost?: number; placecardCost?: number;
  }) {
    // Find first empty row in vendor table
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Invitations!B8:B19',
    });
    const values = response.data.values || [];
    let emptyIndex = values.findIndex(v => !v[0] || v[0].trim() === '');
    const rowNum = emptyIndex === -1 ? values.length + 8 : emptyIndex + 8;

    // Columns: B=Name, C=Phone, D=Email, E=Website, F=Invitation cost
    // H=RSVP cost, J=Thank-you cost, L=Program cost, N=Placecard cost
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Invitations!B${rowNum}:E${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[data.name, data.phone || '', data.email || '', data.website || '']]
      },
    });

    // Set costs in their respective columns (F, H, J, L, N)
    const costUpdates: [string, number][] = [
      [`F${rowNum}`, data.invitationCost ?? 0],
      [`H${rowNum}`, data.rsvpCost ?? 0],
      [`J${rowNum}`, data.thankYouCost ?? 0],
      [`L${rowNum}`, data.programCost ?? 0],
      [`N${rowNum}`, data.placecardCost ?? 0],
    ];

    for (const [cell, value] of costUpdates) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Invitations!${cell}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    }

    return { success: true, rowNumber: rowNum };
  }

  async updateInvitationVendor(rowNumber: number, data: Record<string, any>) {
    const fieldMap: Record<string, string> = {
      name: 'B', phone: 'C', email: 'D', website: 'E',
      invitationCost: 'F', rsvpCost: 'H', thankYouCost: 'J',
      programCost: 'L', placecardCost: 'N'
    };

    for (const [field, value] of Object.entries(data)) {
      const col = fieldMap[field];
      if (!col) continue;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Invitations!${col}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    }

    return { success: true, rowNumber };
  }

  async deleteInvitationVendor(rowNumber: number) {
    const sheetId = await this.getSheetId('Invitations');
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }]
      }
    });
    return { success: true, deletedRow: rowNumber };
  }
}
