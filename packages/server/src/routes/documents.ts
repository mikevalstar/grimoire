import type { FastifyInstance } from "fastify";
import { listDocuments, getDocument, resolveDocumentId } from "@grimoire-ai/core";

const VALID_TYPES = ["feature", "requirement", "task", "decision"] as const;
type DocType = (typeof VALID_TYPES)[number];

function isValidType(t: string): t is DocType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

export async function documentRoutes(
  fastify: FastifyInstance,
  opts: { cwd: string },
): Promise<void> {
  fastify.get<{
    Params: { type: string };
    Querystring: { status?: string; priority?: string; sort?: string };
  }>("/api/documents/:type", async (request, reply) => {
    const { type } = request.params;
    if (!isValidType(type)) {
      return reply.status(400).send({ error: `Invalid document type: ${type}` });
    }
    const { status, priority, sort } = request.query;
    return listDocuments({
      type,
      status: status || undefined,
      priority: priority || undefined,
      sort: sort || "updated",
      cwd: opts.cwd,
    });
  });

  fastify.get<{ Params: { type: string; id: string } }>(
    "/api/documents/:type/:id",
    async (request, reply) => {
      const { type, id } = request.params;
      if (!isValidType(type)) {
        return reply.status(400).send({ error: `Invalid document type: ${type}` });
      }
      try {
        const resolvedId = await resolveDocumentId(opts.cwd, type, id);
        return getDocument({
          type,
          id: resolvedId,
          metadataOnly: false,
          noChangelog: false,
          cwd: opts.cwd,
        });
      } catch {
        return reply.status(404).send({ error: `Document not found: ${id}` });
      }
    },
  );
}
