import type { NextApiRequest, NextApiResponse } from "next";

const API_KEY = process.env.PINECONE_API_KEY!;
const HOST = process.env.PINECONE_HOST!;
const CONTROL_PLANE_URL = "https://api.pinecone.io";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!HOST || !API_KEY) {
    return res.status(500).json({ 
      error: "Server not configured properly. Environment variables missing."
    });
  }

  try {
    const { assistantName, instructions } = req.body;
    
    if (!assistantName || !instructions) {
      return res.status(400).json({ 
        error: 'assistantName and instructions are required' 
      });
    }

    console.log("Creating custom assistant:", assistantName);
    console.log("Instructions:", instructions);

    const response = await fetch(`${CONTROL_PLANE_URL}/assistants`, {
      method: 'POST',
      headers: {
        "Api-Key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assistant_name: assistantName,
        instructions: instructions,
        region: "us",
        metadata: {
          createdBy: "wynter-poc",
          purpose: "survey-chat",
          createdAt: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to create assistant:", response.status, errorText);
      return res.status(response.status).json({
        error: `Failed to create assistant: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const result = await response.json();
    console.log("Assistant created:", result);
    
    res.status(200).json(result);

  } catch (error: any) {
    console.error("Error creating assistant:", error);
    res.status(500).json({ 
      error: error?.message || "Failed to create assistant"
    });
  }
}