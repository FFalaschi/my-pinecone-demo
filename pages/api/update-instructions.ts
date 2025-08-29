import type { NextApiRequest, NextApiResponse } from "next";

const API_KEY = process.env.PINECONE_API_KEY!;
const HOST = process.env.PINECONE_HOST!;

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
    
    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({ error: 'Instructions are required' });
    }

    if (!assistantName) {
      return res.status(400).json({ error: 'Assistant name is required' });
    }

    console.log("Updating assistant instructions:", assistantName);
    console.log("New instructions:", instructions);

    const response = await fetch(`${HOST}/assistants/${assistantName}`, {
      method: 'PATCH',
      headers: {
        "Api-Key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instructions: instructions,
        metadata: {
          lastUpdated: new Date().toISOString(),
          updatedBy: "wynter-poc"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to update assistant:", response.status, errorText);
      return res.status(response.status).json({
        error: `Failed to update assistant: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const result = await response.json();
    console.log("Assistant updated successfully:", result);
    
    res.status(200).json({ 
      success: true, 
      updatedAt: result.updated_at || new Date().toISOString(),
      assistant: result 
    });

  } catch (error: any) {
    console.error("Error updating instructions:", error);
    res.status(500).json({ 
      error: error?.message || "Failed to update instructions",
      type: error?.name || "UnknownError"
    });
  }
}