import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { createDefaultEntityService, type BundledEntityLabel } from "../../src/server/services/entity";

const labelSchema = z.object({
  address: z.string().regex(/^0x[0-9a-f]{40}$/),
  chain: z.enum(["base", "bsc", "robinhood"]),
  kind: z.enum(["CEX", "BRIDGE", "ROUTER", "CONTRACT", "HUMAN"]),
  name: z.string().min(1),
  isTerminal: z.boolean(),
  notes: z.string().optional(),
});

const datasetPath = fileURLToPath(new URL("./entity-labels.json", import.meta.url));

async function main(): Promise<void> {
  const labels = labelSchema.array().parse(JSON.parse(await readFile(datasetPath, "utf8"))) as BundledEntityLabel[];
  const result = await (await createDefaultEntityService()).seedBundled(labels);
  console.log(JSON.stringify(result));
}

void main();
