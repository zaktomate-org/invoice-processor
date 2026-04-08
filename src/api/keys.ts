import type { APIKeyInfo, APIKeyWithSecret } from "../types.ts";
import { generateId } from "../utils.ts";

// In-memory key storage
const keyPool = new Map<string, APIKeyWithSecret>();

/**
 * Add a new Gemini API key to the pool
 */
export async function addKey(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { key } = body as { key?: string };

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Must provide a valid API key" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(),
          },
        }
      );
    }

    // Check if key already exists
    for (const [id, info] of keyPool.entries()) {
      if (info.key === key) {
        return new Response(
          JSON.stringify({ error: "Key already exists", id }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders(),
            },
          }
        );
      }
    }

    const id = generateId();
    const keyInfo: APIKeyWithSecret = {
      id,
      key: key.trim(),
      lastUsed: null,
      requestCount: 0,
    };
    keyPool.set(id, keyInfo);

    return new Response(
      JSON.stringify({
        id,
        status: "added",
        requestCount: 0,
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  }
}

/**
 * List all API keys (without exposing the actual key values)
 */
export function listKeys(): Response {
  const keys: APIKeyInfo[] = [];
  for (const [, info] of keyPool.entries()) {
    keys.push({
      id: info.id,
      lastUsed: info.lastUsed,
      requestCount: info.requestCount,
    });
  }

  return new Response(JSON.stringify({ keys, total: keys.length }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

/**
 * Delete an API key by ID
 */
export function deleteKey(keyId: string): Response {
  const deleted = keyPool.delete(keyId);

  if (!deleted) {
    return new Response(
      JSON.stringify({ error: "Key not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  }

  return new Response(
    JSON.stringify({ id: keyId, status: "deleted" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(),
      },
    }
  );
}

/**
 * Get a random API key from the pool with usage tracking
 * Returns null if no keys available
 */
export function getRandomKey(): APIKeyWithSecret | null {
  if (keyPool.size === 0) {
    return null;
  }

  const keys = Array.from(keyPool.values());
  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  // Update usage tracking
  selectedKey.lastUsed = new Date();
  selectedKey.requestCount += 1;

  return selectedKey;
}

/**
 * Get all keys for retry fallback
 */
export function getAllKeys(): APIKeyWithSecret[] {
  return Array.from(keyPool.values());
}

/**
 * CORS headers helper
 */
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
