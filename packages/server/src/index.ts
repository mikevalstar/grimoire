import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { statusRoutes } from "./routes/status.ts";
import { documentRoutes } from "./routes/documents.ts";

export interface ServerOptions {
  cwd: string;
  port?: number;
  staticDir?: string;
}

export async function createServer(options: ServerOptions) {
  const { cwd, port = 4444, staticDir } = options;

  const fastify = Fastify({ logger: false });

  await fastify.register(fastifyCors, { origin: true });

  await fastify.register(statusRoutes, { cwd });
  await fastify.register(documentRoutes, { cwd });

  if (staticDir) {
    await fastify.register(fastifyStatic, {
      root: staticDir,
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler((_request, reply) => {
      return reply.sendFile("index.html");
    });
  }

  return {
    async start(): Promise<string> {
      const address = await fastify.listen({ port, host: "127.0.0.1" });
      return address;
    },
    async close(): Promise<void> {
      await fastify.close();
    },
  };
}

export async function startServer(options: ServerOptions) {
  const server = await createServer(options);
  const address = await server.start();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { address, close: () => server.close() };
}
