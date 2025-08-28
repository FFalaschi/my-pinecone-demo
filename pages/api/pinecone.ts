// pages/api/pinecone.ts
import type { NextApiRequest, NextApiResponse } from "next";

const HOST = process.env.PINECONE_HOST!; // e.g. https://prod-1-data.ke.pinecone.io
const API_KEY = process.env.PINECONE_API_KEY!; // set in Vercel env

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = "" } = req.query;
    if (!HOST || !API_KEY) {
      res.status(500).json({ error: "Server not configured" });
      return;
    }
    const url = `${HOST}/${Array.isArray(path) ? path.join("/") : path}`;

    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Api-Key": API_KEY, // Keep both headers for compatibility
      },
      body: ["GET","HEAD"].includes(req.method || "") ? undefined : req.body as any,
    });

    // stream back transparently
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === "transfer-encoding") return;
      res.setHeader(k, v);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "Proxy error" });
  }
}

export const config = {
  api: { bodyParser: false }, // lets us pass through streaming if needed
};
