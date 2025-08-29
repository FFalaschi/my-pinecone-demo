import type { NextApiRequest, NextApiResponse } from "next";

const HOST = process.env.PINECONE_HOST!;
const API_KEY = process.env.PINECONE_API_KEY!;

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
    const { assistantPath, instructions } = req.body;
    
    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({ error: 'Instructions are required' });
    }

    // Extract assistant name from path (e.g., "assistant/chat/icp-pulse-assistant" -> "icp-pulse-assistant")
    const assistantName = assistantPath.split('/').pop();
    
    // Update assistant instructions
    const updateUrl = `${HOST}/assistant/${assistantName}`;
    
    console.log("Updating assistant instructions:", updateUrl);
    console.log("New instructions:", instructions);

    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        "Content-Type": "application/json",
        "Api-Key": API_KEY,
      },
      body: JSON.stringify({
        instructions: instructions,
        metadata: {
          lastUpdated: new Date().toISOString(),
          updatedBy: 'wynter-ui',
          version: Date.now()
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to update instructions:", response.status, errorText);
      return res.status(response.status).json({
        error: `Failed to update instructions: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const result = await response.json();
    console.log("Instructions updated successfully:", result);
    
    res.status(200).json({ 
      success: true, 
      updatedAt: new Date().toISOString(),
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