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

    // Parse the request body to pass it properly
    let bodyData = null;
    if (!["GET","HEAD"].includes(req.method || "")) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      bodyData = Buffer.concat(chunks).toString();
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream", // Accept both JSON and streaming
        "Api-Key": API_KEY,
        "X-Pinecone-API-Version": "2024-10", // Use latest API version
      },
      body: bodyData,
    });

    // Handle response
    const contentType = upstream.headers.get("content-type");
    res.status(upstream.status);
    
    if (contentType?.includes("text/event-stream")) {
      // Handle streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const reader = upstream.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      }
      res.end();
    } else {
      // Handle regular JSON response
      upstream.headers.forEach((v, k) => {
        if (k.toLowerCase() === "transfer-encoding") return;
        res.setHeader(k, v);
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    }
  } catch (e:any) {
    res.status(500).json({ error: e?.message || "Proxy error" });
  }
}

export const config = {
  api: { bodyParser: false }, // lets us pass through streaming if needed
};
