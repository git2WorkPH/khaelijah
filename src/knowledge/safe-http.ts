import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { checkServerIdentity } from "node:tls";

/** Conservative public IPv4-only transport. IPv6-only sources are explicitly unsupported. */
export function isPublicIPv4(address: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(address)) return false;
  const parts = address.split(".").map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b, c] = parts as [number, number, number, number];
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function canonicalSourceUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.hostname.endsWith(".") ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.includes(":")
  )
    throw new Error(
      "Only credential-free HTTPS public IPv4-capable URLs without fragments/ports are supported.",
    );
  if (/^[\d.]+$/.test(url.hostname) && !isPublicIPv4(url.hostname))
    throw new Error("Blocked network address.");
  return url.href;
}

export async function resolvePublicAddress(
  hostname: string,
  resolve = async (host: string) =>
    (await lookup(host, { all: true, family: 4, verbatim: true })).map(
      (a) => a.address,
    ),
): Promise<string> {
  const addresses = await resolve(hostname);
  if (!addresses.length || addresses.some((address) => !isPublicIPv4(address)))
    throw new Error("DNS resolved to blocked/non-public address.");
  return addresses[0]!;
}

export function assertPinnedPeer(address: string, remoteAddress: string | undefined): void {
  if (!isPublicIPv4(address) || remoteAddress?.replace(/^::ffff:/, "") !== address) throw new Error("Connection target differs from approved public address.");
}

/** Pinned connection: DNS cannot change the destination between policy check and connect. */
export const safePublicFetch: typeof fetch = async (input, init) => {
  const url = new URL(canonicalSourceUrl(String(input)));
  const signal = init?.signal;
  if (!signal) throw new Error("Safe fetch requires a deadline signal.");
  signal.throwIfAborted();
  const address = await Promise.race([
    resolvePublicAddress(url.hostname),
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new Error("Network deadline/cancellation.")),
        { once: true },
      );
    }),
  ]);
  signal.throwIfAborted();
  return new Promise<Response>((resolve, reject) => {
    const req = request(
      {
        hostname: address,
        port: 443,
        servername: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        agent: false,
        signal,
        checkServerIdentity: (_host, cert) =>
          checkServerIdentity(url.hostname, cert),
        headers: {
          host: url.host,
          "user-agent": "jc-model-knowledge-ingester/0.2",
          "accept-encoding": "identity",
          accept: "text/html,text/plain;q=0.9",
        },
      },
      (res) => {
        if (
          res.headers["content-encoding"] &&
          res.headers["content-encoding"] !== "identity"
        ) {
          res.destroy();
          reject(
            new Error(
              "Compressed responses are unsupported; refusing decompression risk.",
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            res.destroy(new Error("Response exceeds size limit."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          try {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers))
            if (value !== undefined)
              headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          const status = res.statusCode ?? 500;
          resolve(
            new Response(
              [204, 205, 304].includes(status) ? null : Buffer.concat(chunks),
              { status, headers },
            ),
          );
          } catch (error) { reject(error); }
        });
      },
    );
    req.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        try { assertPinnedPeer(address, socket.remoteAddress); } catch (error) { req.destroy(error as Error); }
      });
    });
    req.on("error", reject);
    req.end();
  });
};
