// pages/api/pinecone.ts
import type { NextApiRequest, NextApiResponse } from "next";

const HOST = process.env.PINECONE_HOST!; // e.g. https://prod-1-data.ke.pinecone.io
const API_KEY = process.env.PINECONE_API_KEY!; // set in Vercel env

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Input validation
  if (!req.body) {
    return res.status(400).json({ error: "No request body provided" });
  }
  
  if (!HOST || !API_KEY) {
    console.error("Missing configuration:", { HOST: !!HOST, API_KEY: !!API_KEY });
    return res.status(500).json({ error: "Server not configured properly" });
  }

  try {
    const { path = "" } = req.query;
    const url = `${HOST}/${Array.isArray(path) ? path.join("/") : path}`;
    
    console.log("Making request to:", url);
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const upstream = await fetch(url, {
      method: req.method || 'POST',
      headers: {
        "Content-Type": "application/json",
        "Api-Key": API_KEY,
      },
      body: JSON.stringify(req.body),
    });

    console.log("Response status:", upstream.status);
    
    // ✅ Check for upstream errors
    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error("Upstream error:", upstream.status, errorText);
      return res.status(upstream.status).json({
        error: `Pinecone API error: ${upstream.status} ${upstream.statusText}`,
        details: errorText
      });
    }
    
    // ✅ Handle response simply and safely
    try {
      const data = await upstream.json();
      console.log("Response data:", JSON.stringify(data, null, 2));
      res.status(200).json(data);
    } catch (jsonError) {
      // If not JSON, try to get text
      const text = await upstream.text();
      console.log("Non-JSON response:", text);
      res.status(200).json({ message: text });
    }
  } catch (e: any) {
    console.error("Pinecone API Error:", {
      message: e?.message,
      stack: e?.stack,
      name: e?.name
    });
    
    res.status(500).json({ 
      error: e?.message || "Internal server error", 
      type: e?.name || "UnknownError",
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
