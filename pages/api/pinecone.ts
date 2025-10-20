// pages/api/pinecone.ts
// Trigger fresh deployment via GitHub webhook - 2025-10-20T10:24:00Z
import type { NextApiRequest, NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";

const API_KEY = process.env.PINECONE_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Input validation
  if (!req.body) {
    return res.status(400).json({ error: "No request body provided" });
  }

  if (!API_KEY) {
    console.error("Missing PINECONE_API_KEY environment variable");
    return res.status(500).json({
      error: "Server not configured properly. PINECONE_API_KEY is missing."
    });
  }

  try {
    // Extract assistant name from path query parameter
    // Expected format: "assistant/chat/{assistant-name}" or "assistants/chat/{assistant-name}"
    const { path = "" } = req.query;
    const pathStr = Array.isArray(path) ? path.join("/") : path;

    console.log("Received path:", pathStr);

    // Parse assistant name from path
    // Supports both "assistant/chat/name" and "assistants/chat/name"
    const pathMatch = pathStr.match(/assistants?\/chat\/([^\/]+)/);
    if (!pathMatch || !pathMatch[1]) {
      return res.status(400).json({
        error: "Invalid path format. Expected: assistant/chat/{assistant-name} or assistants/chat/{assistant-name}",
        receivedPath: pathStr
      });
    }

    const assistantName = pathMatch[1];
    console.log("Assistant name:", assistantName);

    // Validate request body has messages
    const { messages, stream = false } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Request body must include 'messages' array"
      });
    }

    // Initialize Pinecone client
    const pc = new Pinecone({ apiKey: API_KEY });

    // Get the assistant
    const assistant = pc.Assistant(assistantName);

    console.log("Calling Pinecone Assistant chat with messages:", JSON.stringify(messages, null, 2));

    // Call assistant chat (non-streaming for now)
    // Use chatCompletion for OpenAI-compatible format
    const chatResponse = await assistant.chatCompletion({
      messages: messages,
    });

    console.log("Assistant response:", JSON.stringify(chatResponse, null, 2));

    // Return the response in a format compatible with the frontend
    // The chatCompletion response has format: { id, choices, model, usage }
    // Extract the assistant's message from choices[0].message
    res.status(200).json({
      message: chatResponse.choices?.[0]?.message || {
        role: "assistant",
        content: "No response generated"
      },
      id: chatResponse.id,
      model: chatResponse.model,
      usage: chatResponse.usage
    });

  } catch (e: any) {
    console.error("Pinecone Assistant Error:", {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
      status: e?.status
    });

    // Check if it's a Pinecone API error with status
    const statusCode = e?.status || 500;

    res.status(statusCode).json({
      error: e?.message || "Failed to process assistant chat request",
      type: e?.name || "PineconeError",
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
