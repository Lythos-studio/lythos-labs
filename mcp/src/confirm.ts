/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { explain, type GuardOptions } from "@lythos-labs/airlock/core";

/**
 * Asks the person through MCP elicitation: the client shows the question to the user, not to the model.
 * A client without elicitation cannot ask, so the answer is no (fail closed).
 */
export function elicitConfirm(server: McpServer): NonNullable<GuardOptions["confirm"]> {
  return async ({ tool, args, reasons }) => {
    if (!server.server.getClientCapabilities()?.elicitation) return "unavailable";
    const details = Object.entries(args)
      .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
      .join("\n");
    const why = explain(tool, { status: "ask", reasons }).split("\n").slice(1, -1).join("\n");
    const answer = await server.server.elicitInput({
      mode: "form",
      message: `Your agent wants to run ${tool}.\n\n${details}\n\n${why}\n\nApprove only if you asked for exactly this.`,
      requestedSchema: { type: "object", properties: { approve: { type: "boolean", title: "Approve this action" } }, required: ["approve"] },
    });
    return answer.action === "accept" && answer.content?.approve === true;
  };
}
