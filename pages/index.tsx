import { useState } from "react";

const ASSISTANT_PATH = "mcp/assistants/icp-pulse-assistant"; // from your URL

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role:"user"|"assistant",content:string}[]>([]);

  async function send() {
    const userMsg = { role: "user" as const, content: input };
    setMessages(m => [...m, userMsg]);
    setInput("");

    const resp = await fetch(`/api/pinecone?path=${encodeURIComponent(ASSISTANT_PATH)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [...messages, userMsg] })
      // ^ Adjust body schema to whatever your MCP endpoint expects
    });

    const text = await resp.text(); // keep simple; adapt if JSON
    setMessages(m => [...m, { role: "assistant" as const, content: text }]);
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
