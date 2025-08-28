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

    // Get request body properly
    let bodyData = null;
    if (!["GET","HEAD"].includes(req.method || "")) {
      bodyData = JSON.stringify(req.body);
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Api-Key": API_KEY, // Assistant API uses Api-Key header
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
    console.error("Pinecone API Error:", e);
    res.status(500).json({ 
      error: e?.message || "Proxy error", 
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined 
    });
  }
}

export const config = {
  api: { 
    bodyParser: {
      sizeLimit: '1mb',
    }
  },
};
