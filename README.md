# 💍 Wedding Planner MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that connects AI assistants to a Google Sheets wedding planner template. Manage your wedding budget, guest list, schedule, and more — all through natural language via any MCP-compatible client.

## ✨ Features

### 📋 To-Do & Coordination
| Tool | Description |
|------|-------------|
| `get_todos` | Get all to-do items |
| `add_todo` | Add a new to-do item |
| `update_todo` | Update an existing to-do |
| `delete_todo` | Delete a to-do item |
| `get_coordination` | Get vendor coordination data |
| `update_coordination` | Update vendor coordination |

### 📅 Schedule
| Tool | Description |
|------|-------------|
| `get_schedule` | Get the wedding day schedule |
| `update_schedule` | Update a schedule entry |
| `delete_schedule` | Clear a schedule entry |

### 💰 Budget (Full CRUD + Category Management)
| Tool | Description |
|------|-------------|
| `get_budget_summary` | Budget estimator overview |
| `get_detailed_budget` | All items from Detailed budget |
| `add_budget_category` | Create new category (auto-clones formatting & formulas) |
| `update_budget_category` | Rename category and/or update estimate |
| `delete_budget_category` | Delete custom category (with protection for built-in categories) |
| `add_budget_item` | Add item to a category (smart row insertion) |
| `update_budget_item` | Update an existing budget item |
| `delete_budget_item` | Delete a budget item |

### 👥 Guest List
| Tool | Description |
|------|-------------|
| `get_guest_list` | Get all guests with details |
| `add_guest` | Add a new guest |
| `update_guest` | Update guest info by row |
| `delete_guest` | Delete a guest |
| `search_guests` | Search by name, invitedBy, or any field |
| `get_guest_summary` | Stats: total, attending, responses, by invitedBy |

### 💌 Invitations
| Tool | Description |
|------|-------------|
| `get_invitations` | Get summary counts and vendor list |
| `add_invitation_vendor` | Add a new vendor |
| `update_invitation_vendor` | Update vendor details |
| `delete_invitation_vendor` | Delete a vendor |

### 📆 Google Calendar
| Tool | Description |
|------|-------------|
| `list_calendar_events` | List upcoming or filtered calendar events |
| `get_calendar_event_information` | Get detailed information for one event |
| `create_calendar_event` | Create a timed or all-day calendar event |
| `create_detailed_calendar_event` | Create an event with attendees, recurrence, reminders, visibility, color, and guest permissions |
| `update_calendar_event` | Patch an existing calendar event |
| `add_attendees_to_calendar_event` | Add attendees without removing existing attendees |
| `delete_calendar_event` | Delete a calendar event |

## 🛠 Prerequisites

- **Node.js** ≥ 22
- **Google Cloud Service Account** with Sheets API and Calendar API access
- A Google Sheets spreadsheet based on the wedding planner template
- A Google Calendar shared with the service account if using a non-delegated service account

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/kiboud/weddingplanner_mcp.git
cd weddingplanner_mcp
npm install
```

### 2. Configure

Create a `.env` file:

```env
SPREADSHEET_ID=your_google_spreadsheet_id_here
CALENDAR_ID=your_google_calendar_id_here
CALENDAR_TIME_ZONE=Asia/Jakarta
GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json
PORT=8080
```

Place your GCP service account credentials as `gcp-service-account.json` in the project root.

`CALENDAR_ID` is optional and defaults to `primary`. For service accounts, it is usually better to create or choose a Google Calendar, share it with the service account email, and set that calendar's ID here.

### 3. Build & Run

```bash
npm run build
npm start
```

The server will start on `http://localhost:8080` with:
- **MCP endpoint**: `http://localhost:8080/mcp` (Streamable HTTP transport)

## 🐳 Docker

### Build & Run

```bash
docker compose up -d --build
```

### Build & Run without Compose

```bash
docker build -t weddingplanner-mcp .
docker stop weddingplanner-mcp || true
docker rm weddingplanner-mcp || true
docker run -d \
  --name weddingplanner-mcp \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  -v /path/to/gcp-service-account.json:/root/.openclaw/workspace-mimi/gcp-service-account.json:ro \
  weddingplanner-mcp
```

### docker-compose.yml

The included `docker-compose.yml` mounts the GCP credentials and exposes port 8080. Adjust the volume path to match your credential location:

```yaml
volumes:
  - /path/to/gcp-service-account.json:/root/.openclaw/workspace-wedding/gcp-service-account.json:ro
```

## 🔗 Connect to an MCP Client

### Gemini CLI / Antigravity

Add to your MCP config:

```json
{
  "mcpServers": {
    "wedding-planner": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wedding-planner": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

## 📁 Project Structure

```
weddingplanner_mcp/
├── src/
│   ├── index.ts           # MCP server + tool registry
│   └── google-sheets.ts   # Google Sheets API service layer
├── build/                 # Compiled JS (gitignored)
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
├── package.json
└── .env                   # Config (gitignored)
```

## 🔒 Security Notes

- `.env` and `gcp-service-account.json` are gitignored — never commit secrets
- Built-in budget categories (Ceremony, Reception, etc.) are protected from deletion
- Duplicate category names are rejected

## 📄 License

ISC
