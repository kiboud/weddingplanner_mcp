import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
    const transport = new SSEClientTransport(new URL("http://localhost:8080/sse"));
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    // === GUEST LIST TESTS ===
    console.log("=== 1. Guest Summary ===");
    const r1 = await client.callTool({ name: "get_guest_summary", arguments: {} });
    console.log(r1.content);

    console.log("\n=== 2. Search guests 'Farah' ===");
    const r2 = await client.callTool({ name: "search_guests", arguments: { query: "Farah" } });
    const results = JSON.parse((r2.content as any)[0].text);
    console.log(`  Found ${results.length} guests invited by Farah`);

    console.log("\n=== 3. Add dummy guest ===");
    const r3 = await client.callTool({ name: "add_guest", arguments: {
        firstName: "Test", lastName: "Dummy", invitedBy: "Bot", attending: 2, notes: "Integration test"
    }});
    console.log(r3.content);
    const addedRow = parseInt((r3.content as any)[0].text.match(/row (\d+)/)?.[1]);

    console.log("\n=== 4. Update dummy guest ===");
    const r4 = await client.callTool({ name: "update_guest", arguments: {
        rowNumber: addedRow, response: "Yes", dietaryRestrictions: "Halal"
    }});
    console.log(r4.content);

    console.log("\n=== 5. Delete dummy guest ===");
    const r5 = await client.callTool({ name: "delete_guest", arguments: { rowNumber: addedRow } });
    console.log(r5.content);

    // === INVITATIONS TESTS ===
    console.log("\n=== 6. Get Invitations ===");
    const r6 = await client.callTool({ name: "get_invitations", arguments: {} });
    console.log(r6.content);

    console.log("\n=== 7. Add dummy vendor ===");
    const r7 = await client.callTool({ name: "add_invitation_vendor", arguments: {
        name: "Test Vendor", phone: "08123456", invitationCost: 5000
    }});
    console.log(r7.content);
    const vendorRow = parseInt((r7.content as any)[0].text.match(/row (\d+)/)?.[1]);

    console.log("\n=== 8. Update vendor ===");
    const r8 = await client.callTool({ name: "update_invitation_vendor", arguments: {
        rowNumber: vendorRow, email: "test@vendor.com"
    }});
    console.log(r8.content);

    console.log("\n=== 9. Delete vendor ===");
    const r9 = await client.callTool({ name: "delete_invitation_vendor", arguments: { rowNumber: vendorRow } });
    console.log(r9.content);

    console.log("\n✅ All tests passed!");
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
