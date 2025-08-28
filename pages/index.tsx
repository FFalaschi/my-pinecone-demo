import { useState } from "react";

const ASSISTANT_PATH = "assistant/chat/icp-pulse-assistant"; // Use chat API instead of MCP

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role:"user"|"assistant",content:string}[]>([]);

  async function send() {
    const userMsg = { role: "user" as const, content: input };
    setMessages(m => [...m, userMsg]);
    setInput("");

    try {
      const resp = await fetch(`/api/pinecone?path=${encodeURIComponent(ASSISTANT_PATH)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content
          })),
          stream: false
        })
      });

      const contentType = resp.headers.get("content-type");
      let responseText = "";
      
      if (contentType?.includes("text/event-stream")) {
        // Handle streaming response
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            responseText += decoder.decode(value, { stream: true });
          }
        }
      } else {
        // Handle regular response
        responseText = await resp.text();
        try {
          const json = JSON.parse(responseText);
          // Handle Pinecone Assistant chat completion response format
          if (json.chat_completion?.choices?.[0]?.message?.content) {
            responseText = json.chat_completion.choices[0].message.content;
          } else if (json.answer) {
            responseText = json.answer;
          } else if (json.message) {
            responseText = json.message;
          } else {
            responseText = JSON.stringify(json, null, 2);
          }
        } catch {
          // Keep responseText as is if not JSON
        }
      }
      
      setMessages(m => [...m, { role: "assistant" as const, content: responseText }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(m => [...m, { role: "assistant" as const, content: "Error: Failed to get response" }]);
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto p-6 font-sans">
      <h1 style={{fontSize:24, fontWeight:700}}>ICP Pulse Assistant (Demo)</h1>
      <div style={{flex:1, overflowY:"auto", border:"1px solid #eee", borderRadius:8, padding:12, marginTop:12}}>
        {messages.map((m,i)=>(
          <div key={i} style={{margin:"8px 0"}}>
            <strong>{m.role === "user" ? "You" : "Assistant"}:</strong> <span>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex", gap:8, marginTop:12}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Ask something…"
          style={{flex:1, padding:10, border:"1px solid #ddd", borderRadius:8}}
          onKeyDown={e=>{ if(e.key==="Enter") send(); }}
        />
        <button onClick={send} style={{padding:"10px 16px", borderRadius:8, border:"1px solid #222"}}>Send</button>
      </div>
    </div>
  );
}
