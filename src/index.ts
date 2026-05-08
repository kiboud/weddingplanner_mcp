import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { GoogleSheetsService, parseDate } from "./google-sheets.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const port = process.env.PORT || 8080;

let sheetsService: GoogleSheetsService;
try {
  sheetsService = new GoogleSheetsService();
} catch (e: any) {
  console.error("Failed to initialize GoogleSheetsService:", e.message);
  // Continue server start to allow debugging later, even if sheets fails to init due to missing credentials initially.
}

// Track active transports per session
const activeTransports = new Map<string, StreamableHTTPServerTransport>();

function createServer() {
  return new Server({
    name: "wedding-planner-mcp",
    version: "1.0.0"
  }, {
    capabilities: { tools: {} }
  });
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport | undefined;

  if (sessionId && activeTransports.has(sessionId)) {
    transport = activeTransports.get(sessionId);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        console.log(`MCP session initialized: ${sid}`);
        activeTransports.set(sid, transport!);
      },
    });

    transport.onclose = () => {
      if (transport!.sessionId) {
        console.log(`MCP session closed: ${transport!.sessionId}`);
        activeTransports.delete(transport!.sessionId);
      }
    };

    const server = createServer();
    setupHandlers(server);
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
    return;
  }

  await transport!.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !activeTransports.has(sessionId)) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  const transport = activeTransports.get(sessionId)!;
  await transport.handleRequest(req, res);
};

app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

function setupHandlers(server: Server) {

  server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_todos",
        description: "Get all to-do items from the To-do sheet (columns B:E starting from row 6)",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "add_todo",
        description: "Add a new to-do item to the To-do sheet. Date is auto-normalized to MM/DD/YYYY — you can pass any format (e.g. '10 Mei 2026', '2026-05-10', '10/5/2026'). Progress defaults to 'Not started' if not provided.",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", description: "The task description" },
            dueDate: { type: "string", description: "Due date in any format, e.g. '10 Mei 2026', '2026-05-10', '5/10/2026'" },
            progress: { type: "string", description: "Progress status: 'Not started', 'In progress', or 'Done'. Defaults to 'Not started'." },
            notes: { type: "string", description: "Optional notes" }
          },
          required: ["task"]
        }
      },
      {
        name: "update_todo",
        description: "Update an existing to-do item by its row number. Date is auto-normalized to MM/DD/YYYY.",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number in the spreadsheet (e.g. 6)" },
            task: { type: "string", description: "The task description" },
            dueDate: { type: "string", description: "Due date in any format, e.g. '10 Mei 2026', '2026-05-10'" },
            progress: { type: "string", description: "Progress: 'Not started', 'In progress', or 'Done'" },
            notes: { type: "string", description: "Optional notes" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_todo",
        description: "Clear/delete a to-do item by its row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number in the spreadsheet to delete (e.g. 6)" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "get_coordination",
        description: "Get all coordination roles from the Coordination sheet (columns B:H starting from row 6)",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "add_coordination",
        description: "Add a new coordination role to the Coordination sheet",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name (Column B)" },
            role: { type: "string", description: "Role (Column C)" },
            phone: { type: "string", description: "Phone # (Column D)" },
            email: { type: "string", description: "Email (Column E)" },
            website: { type: "string", description: "Website (Column F)" },
            cost: { type: "string", description: "Cost (Column G)" },
            notes: { type: "string", description: "Notes (Column H)" }
          },
          required: ["name", "role"]
        }
      },
      {
        name: "update_coordination",
        description: "Update an existing coordination role by its row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number in the spreadsheet (e.g. 6)" },
            name: { type: "string", description: "Name (Column B)" },
            role: { type: "string", description: "Role (Column C)" },
            phone: { type: "string", description: "Phone # (Column D)" },
            email: { type: "string", description: "Email (Column E)" },
            website: { type: "string", description: "Website (Column F)" },
            cost: { type: "string", description: "Cost (Column G)" },
            notes: { type: "string", description: "Notes (Column H)" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_coordination",
        description: "Clear/delete a coordination item by its row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number to delete (e.g. 6)" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "get_schedule",
        description: "Get all schedule items from the Schedule sheet (columns B:E starting from row 6)",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "add_schedule",
        description: "Add a new schedule item to the Schedule sheet",
        inputSchema: {
          type: "object",
          properties: {
            time: { type: "string", description: "Time (Column B)" },
            item: { type: "string", description: "Item (Column D)" },
            notes: { type: "string", description: "Notes (Column E)" }
          },
          required: ["time", "item"]
        }
      },
      {
        name: "update_schedule",
        description: "Update an existing schedule item by its row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number in the spreadsheet (e.g. 6)" },
            time: { type: "string", description: "Time (Column B)" },
            item: { type: "string", description: "Item (Column D)" },
            notes: { type: "string", description: "Notes (Column E)" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_schedule",
        description: "Clear/delete a schedule item by its row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "The absolute row number to delete (e.g. 6)" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "get_budget_summary",
        description: "Get the budget summary categories and totals from Budget estimator",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_detailed_budget",
        description: "Get all items from Detailed budget",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "add_budget_category",
        description: "Create a new major budget category (Clones formatting and links formulas automatically)",
        inputSchema: {
          type: "object",
          properties: {
            categoryName: { type: "string", description: "Name of the new category" }
          },
          required: ["categoryName"]
        }
      },
      {
        name: "add_budget_item",
        description: "Add a new item to a specific budget category (uses smart row insertion to preserve formulas)",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Exact category name (e.g. 'Ceremony', 'Reception')" },
            item: { type: "string", description: "Item name" },
            vendor: { type: "string", description: "Vendor name (from Vendors sheet). Estimated cost auto-populated via VLOOKUP." },
            actual: { type: "number", description: "Actual cost (default 0)" }
          },
          required: ["category", "item"]
        }
      },
      {
        name: "update_budget_item",
        description: "Update an existing budget item. Estimated cost is auto-populated from Vendors sheet via VLOOKUP.",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Exact category name" },
            oldItemName: { type: "string", description: "Current exact name of the item to update" },
            newItemName: { type: "string", description: "New name for the item (optional)" },
            vendor: { type: "string", description: "Vendor name (from Vendors sheet)" },
            actual: { type: "number", description: "Actual cost" }
          },
          required: ["category", "oldItemName"]
        }
      },
      {
        name: "delete_budget_item",
        description: "Delete an existing budget item from a specific category",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Exact category name" },
            itemName: { type: "string", description: "Exact name of the item to delete" }
          },
          required: ["category", "itemName"]
        }
      },
      {
        name: "delete_budget_category",
        description: "Delete an entire budget category and its block from both Budget estimator and Detailed budget",
        inputSchema: {
          type: "object",
          properties: {
            categoryName: { type: "string", description: "Exact name of the category to delete" }
          },
          required: ["categoryName"]
        }
      },
      {
        name: "update_budget_category",
        description: "Rename a budget category and/or update its estimate. Detailed budget header auto-updates via formula.",
        inputSchema: {
          type: "object",
          properties: {
            oldName: { type: "string", description: "Current exact name of the category" },
            newName: { type: "string", description: "New name for the category" },
            estimate: { type: "number", description: "New estimate amount (optional)" }
          },
          required: ["oldName", "newName"]
        }
      },
      // --- Vendors Tools ---
      {
        name: "get_vendors",
        description: "Get all vendors from the Vendors sheet",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "add_vendor",
        description: "Add a new vendor to the Vendors sheet",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Vendor name" },
            contact: { type: "string", description: "Contact person name" },
            phone: { type: "string" }, email: { type: "string" },
            website: { type: "string" }, address: { type: "string" },
            cost: { type: "number", description: "Cost/price" },
            notes: { type: "string" }
          },
          required: ["name"]
        }
      },
      {
        name: "update_vendor",
        description: "Update a vendor by row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "Row number of vendor" },
            name: { type: "string" }, contact: { type: "string" },
            phone: { type: "string" }, email: { type: "string" },
            website: { type: "string" }, address: { type: "string" },
            cost: { type: "number" }, notes: { type: "string" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_vendor",
        description: "Delete a vendor by row number",
        inputSchema: {
          type: "object",
          properties: { rowNumber: { type: "number", description: "Row number to delete" } },
          required: ["rowNumber"]
        }
      },
      // --- Guest List Tools ---
      {
        name: "get_guest_list",
        description: "Get all guests from the Guest list sheet with their details",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "add_guest",
        description: "Add a new guest to the Guest list",
        inputSchema: {
          type: "object",
          properties: {
            firstName: { type: "string", description: "First name(s)" },
            lastName: { type: "string", description: "Last name(s)" },
            address: { type: "string" }, email: { type: "string" },
            invitedBy: { type: "string", description: "Who invited this guest" },
            saveTheDate: { type: "string", description: "Save the date status (e.g. Sent)" },
            invitation: { type: "string", description: "Invitation status (e.g. Sent)" },
            response: { type: "string", description: "Response (Yes/No/Maybe)" },
            attending: { type: "number", description: "Number of people attending" },
            children: { type: "number" },
            dietaryRestrictions: { type: "string" },
            tableNumber: { type: "number" },
            notes: { type: "string" }
          },
          required: ["firstName"]
        }
      },
      {
        name: "update_guest",
        description: "Update a guest's info by row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "Row number of the guest" },
            firstName: { type: "string" }, lastName: { type: "string" },
            address: { type: "string" }, email: { type: "string" },
            invitedBy: { type: "string" }, saveTheDate: { type: "string" },
            invitation: { type: "string" }, response: { type: "string" },
            attending: { type: "number" }, children: { type: "number" },
            dietaryRestrictions: { type: "string" }, tableNumber: { type: "number" },
            giftDescription: { type: "string" }, thankYouSent: { type: "string" },
            notes: { type: "string" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_guest",
        description: "Delete a guest by row number",
        inputSchema: {
          type: "object",
          properties: { rowNumber: { type: "number", description: "Row number to delete" } },
          required: ["rowNumber"]
        }
      },
      {
        name: "search_guests",
        description: "Search guests by name, invitedBy, notes, or any field",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", description: "Search term" } },
          required: ["query"]
        }
      },
      {
        name: "get_guest_summary",
        description: "Get guest list statistics: total guests, attending count, response breakdown, by invitedBy",
        inputSchema: { type: "object", properties: {} }
      },
      // --- Invitations Tools ---
      {
        name: "get_invitations",
        description: "Get invitations summary (counts) and vendor list",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "add_invitation_vendor",
        description: "Add a new invitation vendor",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Vendor name" },
            phone: { type: "string" }, email: { type: "string" }, website: { type: "string" },
            invitationCost: { type: "number" }, rsvpCost: { type: "number" },
            thankYouCost: { type: "number" }, programCost: { type: "number" },
            placecardCost: { type: "number" }
          },
          required: ["name"]
        }
      },
      {
        name: "update_invitation_vendor",
        description: "Update an invitation vendor by row number",
        inputSchema: {
          type: "object",
          properties: {
            rowNumber: { type: "number", description: "Row number of vendor" },
            name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
            website: { type: "string" }, invitationCost: { type: "number" },
            rsvpCost: { type: "number" }, thankYouCost: { type: "number" },
            programCost: { type: "number" }, placecardCost: { type: "number" }
          },
          required: ["rowNumber"]
        }
      },
      {
        name: "delete_invitation_vendor",
        description: "Delete an invitation vendor by row number",
        inputSchema: {
          type: "object",
          properties: { rowNumber: { type: "number", description: "Row number to delete" } },
          required: ["rowNumber"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!sheetsService) {
      throw new Error("Google Sheets Service is not initialized. Please check credentials configuration.");
    }
    
    if (request.params.name === "get_todos") {
      const todos = await sheetsService.getTodos();
      return {
        content: [{ type: "text", text: JSON.stringify(todos, null, 2) }]
      };
    } else if (request.params.name === "add_todo") {
      const { task, dueDate = "", progress, notes = "" } = request.params.arguments as any;
      const normalizedDate = parseDate(dueDate);
      const normalizedProgress = progress || "Not started";
      await sheetsService.addTodo([task, normalizedDate, normalizedProgress, notes]);
      return {
        content: [{ type: "text", text: `Successfully added to-do: ${task}` }]
      };
    } else if (request.params.name === "update_todo") {
      const { rowNumber, task = "", dueDate = "", progress = "", notes = "" } = request.params.arguments as any;
      const normalizedDate = parseDate(dueDate);
      await sheetsService.updateTodoRow(rowNumber, [task, normalizedDate, progress, notes]);
      return {
        content: [{ type: "text", text: `Successfully updated row ${rowNumber}` }]
      };
    } else if (request.params.name === "delete_todo") {
      const { rowNumber } = request.params.arguments as any;
      await sheetsService.deleteTodoRow(rowNumber);
      return {
        content: [{ type: "text", text: `Successfully deleted row ${rowNumber}` }]
      };
    } else if (request.params.name === "get_coordination") {
      const data = await sheetsService.getCoordination();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } else if (request.params.name === "add_coordination") {
      const { name = "", role = "", phone = "", email = "", website = "", cost = "", notes = "" } = request.params.arguments as any;
      await sheetsService.addCoordinationRow([name, role, phone, email, website, cost, notes]);
      return {
        content: [{ type: "text", text: `Successfully added coordination: ${name} (${role})` }]
      };
    } else if (request.params.name === "update_coordination") {
      const { rowNumber, name = "", role = "", phone = "", email = "", website = "", cost = "", notes = "" } = request.params.arguments as any;
      await sheetsService.updateCoordinationRow(rowNumber, [name, role, phone, email, website, cost, notes]);
      return {
        content: [{ type: "text", text: `Successfully updated coordination row ${rowNumber}` }]
      };
    } else if (request.params.name === "delete_coordination") {
      const { rowNumber } = request.params.arguments as any;
      await sheetsService.deleteCoordinationRow(rowNumber);
      return {
        content: [{ type: "text", text: `Successfully deleted coordination row ${rowNumber}` }]
      };
    } else if (request.params.name === "get_schedule") {
      const data = await sheetsService.getSchedule();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } else if (request.params.name === "add_schedule") {
      const { time = "", item = "", notes = "" } = request.params.arguments as any;
      // Inject empty string for column C
      await sheetsService.addScheduleRow([time, "", item, notes]);
      return {
        content: [{ type: "text", text: `Successfully added schedule: ${time} - ${item}` }]
      };
    } else if (request.params.name === "update_schedule") {
      const { rowNumber, time = "", item = "", notes = "" } = request.params.arguments as any;
      // Inject empty string for column C
      await sheetsService.updateScheduleRow(rowNumber, [time, "", item, notes]);
      return {
        content: [{ type: "text", text: `Successfully updated schedule row ${rowNumber}` }]
      };
    } else if (request.params.name === "delete_schedule") {
      const { rowNumber } = request.params.arguments as any;
      await sheetsService.deleteScheduleRow(rowNumber);
      return {
        content: [{ type: "text", text: `Successfully deleted schedule row ${rowNumber}` }]
      };
    } else if (request.params.name === "get_budget_summary") {
      const data = await sheetsService.getBudgetSummary();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "get_detailed_budget") {
      const data = await sheetsService.getDetailedBudget();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "add_budget_category") {
      const { categoryName } = request.params.arguments as any;
      const res = await sheetsService.addBudgetCategory(categoryName);
      return { content: [{ type: "text", text: `Successfully created new category '${categoryName}'` }] };
    } else if (request.params.name === "add_budget_item") {
      const { category, item, vendor = "", actual = 0 } = request.params.arguments as any;
      const res = await sheetsService.addBudgetItem(category, item, vendor, actual);
      return { content: [{ type: "text", text: `Successfully added '${item}' to category '${category}' at row ${res.row}` }] };
    } else if (request.params.name === "update_budget_item") {
      const { category, oldItemName, newItemName, vendor, actual } = request.params.arguments as any;
      const res = await sheetsService.updateBudgetItem(category, oldItemName, newItemName, vendor, actual);
      return { content: [{ type: "text", text: `Successfully updated item in category '${category}' at row ${res.row}` }] };
    } else if (request.params.name === "delete_budget_item") {
      const { category, itemName } = request.params.arguments as any;
      const res = await sheetsService.deleteBudgetItem(category, itemName);
      return { content: [{ type: "text", text: `Successfully deleted '${itemName}' from category '${category}' at row ${res.deletedRow}` }] };
    } else if (request.params.name === "delete_budget_category") {
      const { categoryName } = request.params.arguments as any;
      const res = await sheetsService.deleteBudgetCategory(categoryName);
      return { content: [{ type: "text", text: `Successfully deleted category '${categoryName}' (estimator row ${res.deletedEstRow}, detailed rows ${res.deletedDetailedRows})` }] };
    } else if (request.params.name === "update_budget_category") {
      const { oldName, newName, estimate } = request.params.arguments as any;
      const res = await sheetsService.updateBudgetCategory(oldName, newName, estimate);
      let msg = `Successfully renamed category '${oldName}' to '${newName}'`;
      if (res.estimateUpdated) msg += ` with estimate updated`;
      return { content: [{ type: "text", text: msg }] };

    // --- Vendors Handlers ---
    } else if (request.params.name === "get_vendors") {
      const data = await sheetsService.getVendors();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "add_vendor") {
      const args = request.params.arguments as any;
      const res = await sheetsService.addVendor(args);
      return { content: [{ type: "text", text: `Successfully added vendor '${args.name}' at row ${res.rowNumber}` }] };
    } else if (request.params.name === "update_vendor") {
      const { rowNumber, ...data } = request.params.arguments as any;
      const res = await sheetsService.updateVendor(rowNumber, data);
      return { content: [{ type: "text", text: `Successfully updated vendor at row ${res.rowNumber}` }] };
    } else if (request.params.name === "delete_vendor") {
      const { rowNumber } = request.params.arguments as any;
      const res = await sheetsService.deleteVendor(rowNumber);
      return { content: [{ type: "text", text: `Successfully deleted vendor at row ${res.deletedRow}` }] };

    // --- Guest List Handlers ---
    } else if (request.params.name === "get_guest_list") {
      const data = await sheetsService.getGuestList();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "add_guest") {
      const args = request.params.arguments as any;
      const res = await sheetsService.addGuest(args);
      return { content: [{ type: "text", text: `Successfully added guest '${args.firstName}' at row ${res.rowNumber}` }] };
    } else if (request.params.name === "update_guest") {
      const { rowNumber, ...data } = request.params.arguments as any;
      const res = await sheetsService.updateGuest(rowNumber, data);
      return { content: [{ type: "text", text: `Successfully updated guest at row ${res.rowNumber}` }] };
    } else if (request.params.name === "delete_guest") {
      const { rowNumber } = request.params.arguments as any;
      const res = await sheetsService.deleteGuest(rowNumber);
      return { content: [{ type: "text", text: `Successfully deleted guest at row ${res.deletedRow}` }] };
    } else if (request.params.name === "search_guests") {
      const { query } = request.params.arguments as any;
      const data = await sheetsService.searchGuests(query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "get_guest_summary") {
      const data = await sheetsService.getGuestSummary();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };

    // --- Invitations Handlers ---
    } else if (request.params.name === "get_invitations") {
      const data = await sheetsService.getInvitations();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } else if (request.params.name === "add_invitation_vendor") {
      const args = request.params.arguments as any;
      const res = await sheetsService.addInvitationVendor(args);
      return { content: [{ type: "text", text: `Successfully added vendor '${args.name}' at row ${res.rowNumber}` }] };
    } else if (request.params.name === "update_invitation_vendor") {
      const { rowNumber, ...data } = request.params.arguments as any;
      const res = await sheetsService.updateInvitationVendor(rowNumber, data);
      return { content: [{ type: "text", text: `Successfully updated vendor at row ${res.rowNumber}` }] };
    } else if (request.params.name === "delete_invitation_vendor") {
      const { rowNumber } = request.params.arguments as any;
      const res = await sheetsService.deleteInvitationVendor(rowNumber);
      return { content: [{ type: "text", text: `Successfully deleted vendor at row ${res.deletedRow}` }] };
    }

    throw new Error(`Tool not found: ${request.params.name}`);
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
      isError: true
    };
  }
  });
}

app.listen(port, () => {
  console.log(`MCP StreamableHTTP Server listening on port ${port}`);
  console.log(`MCP Endpoint: http://localhost:${port}/mcp`);
});
