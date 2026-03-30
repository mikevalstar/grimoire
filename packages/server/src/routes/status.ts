import type { FastifyInstance } from "fastify";
import { status } from "@grimoire-ai/core";

export async function statusRoutes(fastify: FastifyInstance, opts: { cwd: string }): Promise<void> {
  fastify.get("/api/status", async () => {
    return status({ cwd: opts.cwd });
  });
}
