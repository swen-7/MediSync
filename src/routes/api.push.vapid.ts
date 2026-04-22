import { createFileRoute } from "@tanstack/react-router";

/**
 * Exposes the VAPID public key to the browser so it can subscribe via
 * PushManager. The private key never leaves the server.
 */
export const Route = createFileRoute("/api/push/vapid")({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
        return new Response(JSON.stringify({ publicKey }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});