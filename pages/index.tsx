import { useState } from "react";

const ASSISTANT_PATH = "assistant/chat/icp-pulse-assistant"; // Use chat API instead of MCP

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role:"user"|"assistant",content:string}[]>([]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const trimmedInput = input.trim();
    if (loading || !trimmedInput) return;
    
    // ✅ Basic input validation
    if (trimmedInput.length > 1000) {
      setMessages(m => [...m, { 
        role: "assistant" as const, 
        content: "❌ Message too long. Please keep it under 1000 characters." 
      }]);
      return;
    }
    
    const userMsg = { role: "user" as const, content: trimmedInput };
    const currentMessages = [...messages, userMsg]; // ✅ Use computed value
    setMessages(currentMessages);
    setInput("");
    setLoading(true);

    try {
      // ✅ Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const resp = await fetch(`/api/pinecone?path=${encodeURIComponent(ASSISTANT_PATH)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          messages: currentMessages.map(m => ({ // ✅ Use computed messages
            role: m.role,
            content: m.content
          })),
          stream: false
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // ✅ Add proper error checking
      if (!resp.ok) {
        throw new Error(`API Error: ${resp.status} ${resp.statusText}`);
      }

      const contentType = resp.headers.get("content-type");
      let responseText = "";
      
      if (contentType?.includes("text/event-stream")) {
        // Handle streaming response with null checks
        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No response body reader available");
        
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          responseText += decoder.decode(value, { stream: true });
        }
      } else {
        // Handle regular response
        responseText = await resp.text();
        if (!responseText) {
          throw new Error("Empty response from server");
        }
        
        try {
          const json = JSON.parse(responseText);
          // Handle Pinecone Assistant chat completion response format
          if (json.chat_completion?.choices?.[0]?.message?.content) {
            responseText = json.chat_completion.choices[0].message.content;
          } else if (json.answer) {
            responseText = json.answer;
          } else if (json.message) {
            responseText = json.message;
          } else if (json.error) {
            throw new Error(json.error);
          } else {
            responseText = JSON.stringify(json, null, 2);
          }
        } catch (parseError) {
          // If not JSON, check if it's a useful text response
          if (responseText.length < 500 && !responseText.includes('<')) {
            // Keep as is if it's short and not HTML
          } else {
            throw new Error(`Invalid response format: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
          }
        }
      }
      
      setMessages(m => [...m, { role: "assistant" as const, content: responseText }]);
    } catch (error) {
      console.error("Error:", error);
      
      let errorMessage = "Failed to get response";
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "Request timed out after 30 seconds. Please try again.";
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('API Error')) {
          errorMessage = `Server error: ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessages(m => [...m, { 
        role: "assistant" as const, 
        content: `❌ ${errorMessage}` 
      }]);
    } finally {
      setLoading(false);
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
          onKeyDown={e=>{ 
            if(e.key==="Enter" && !e.shiftKey) {
              e.preventDefault();
              send(); 
            }
          }}
        />
        <button 
          onClick={send} 
          disabled={loading}
          style={{
            padding:"10px 16px", 
            borderRadius:8, 
            border:"1px solid #222",
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
