import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
    const transport = new StreamableHTTPClientTransport(new URL("http://homeminipc:8080/mcp"));
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    console.log("=== Add Budget Item: Makeup → Hair & makeup ===");
    const r = await client.callTool({ name: "add_budget_item", arguments: {
        category: "Hair & makeup",
        item: "Makeup",
        vendor: "Lia Amalia"
    }});
    console.log(r.content);

    console.log("\n✅ Done!");
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
