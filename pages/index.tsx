import { useState, useEffect } from "react";

const ASSISTANT_PATH = "assistant/chat/icp-pulse-assistant"; // Use chat API instead of MCP

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role:"user"|"assistant",content:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState("You are an AI assistant that helps analyze survey data and research insights. Be helpful, accurate, and concise in your responses.");
  const [instructionsLoading, setInstructionsLoading] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const chatContainer = document.querySelector('[data-chat-container]');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages, loading]);

  // Animated loading dots
  useEffect(() => {
    if (!loading) {
      setDots("");
      return;
    }
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  async function updateInstructions() {
    if (instructionsLoading || !instructions.trim()) return;
    
    setInstructionsLoading(true);
    try {
      const response = await fetch('/api/update-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assistantPath: ASSISTANT_PATH,
          instructions: instructions.trim() 
        })
      });
      
      if (response.ok) {
        setMessages(m => [...m, { 
          role: "assistant" as const, 
          content: "✅ Instructions updated successfully! Try asking a question to see the new behavior." 
        }]);
      } else {
        throw new Error(`Failed to update: ${response.status}`);
      }
    } catch (error) {
      setMessages(m => [...m, { 
        role: "assistant" as const, 
        content: `❌ Failed to update instructions: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }]);
    } finally {
      setInstructionsLoading(false);
    }
  }

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
          // Handle Pinecone Assistant response format
          // Based on actual response: { message: { role: "assistant", content: "..." }, ... }
          const messageContent = json.message?.content;
          const answer = json.answer;
          const error = json.error;
          
          if (typeof messageContent === 'string' && messageContent.trim()) {
            responseText = messageContent;
          } else if (typeof answer === 'string' && answer.trim()) {
            responseText = answer;
          } else if (typeof error === 'string') {
            throw new Error(error);
          } else if (error && typeof error === 'object') {
            throw new Error(JSON.stringify(error));
          } else {
            // ✅ Fallback: show formatted JSON if unexpected format
            console.log("Unexpected response format:", json);
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
      
      // ✅ Ensure responseText is always a string before setState
      const safeResponseText = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);
      setMessages(m => [...m, { role: "assistant" as const, content: safeResponseText }]);
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
    <div style={{
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#fafafa",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "16px 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{
          maxWidth: "800px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <img 
            src="https://cdn.prod.website-files.com/615addcd910b6e8f65bde306/615addcd910b6e31f6bde33e_default.svg"
            alt="Wynter Logo"
            style={{
              height: "32px",
              width: "auto",
              objectFit: "contain"
            }}
          />
          <h1 style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1f2937",
            margin: 0
          }}>Chat with your data</h1>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              color: "#6b7280",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            ⚙️ {showInstructions ? "Hide" : "Edit"} Instructions
          </button>
        </div>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <div style={{
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px"
        }}>
          <div style={{
            maxWidth: "800px",
            margin: "0 auto"
          }}>
            <div style={{
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151"
            }}>
              Assistant Instructions
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter instructions for how the assistant should behave..."
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none"
              }}
            />
            <div style={{
              display: "flex",
              gap: "8px",
              marginTop: "12px",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{
                fontSize: "12px",
                color: "#6b7280"
              }}>
                Changes apply immediately to future conversations
              </div>
              <button
                onClick={updateInstructions}
                disabled={instructionsLoading || !instructions.trim()}
                style={{
                  backgroundColor: (instructionsLoading || !instructions.trim()) ? "#e5e7eb" : "#002BFF",
                  color: (instructionsLoading || !instructions.trim()) ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: (instructionsLoading || !instructions.trim()) ? "not-allowed" : "pointer"
                }}
              >
                {instructionsLoading ? "Updating..." : "Update Instructions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        maxWidth: "800px",
        margin: "0 auto",
        width: "100%",
        padding: "0 24px"
      }}>
        {/* Messages */}
        <div data-chat-container style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 0",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          {messages.map((m,i)=>(
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "8px"
            }}>
              <div style={{
                maxWidth: "75%",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  textAlign: m.role === "user" ? "right" : "left",
                  marginLeft: m.role === "user" ? "0" : "8px",
                  marginRight: m.role === "user" ? "8px" : "0"
                }}>
                  {m.role === "user" ? "You" : "🤖 Assistant"}
                </div>
                <div style={{
                  backgroundColor: m.role === "user" ? "#002BFF" : "#f8fafc",
                  color: m.role === "user" ? "white" : "#1f2937",
                  padding: "12px 16px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  border: m.role === "user" ? "none" : "1px solid #e5e7eb",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap"
                }}>
                  {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {loading && (
            <div style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: "8px"
            }}>
              <div style={{
                maxWidth: "75%",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginLeft: "8px"
                }}>
                  🤖 Assistant
                </div>
                <div style={{
                  backgroundColor: "#f8fafc",
                  color: "#6b7280",
                  padding: "12px 16px",
                  borderRadius: "16px 16px 16px 4px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  fontStyle: "italic"
                }}>
                  Thinking{dots}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{display:"flex", gap:"8px", alignItems: "flex-end"}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              placeholder="Ask about ICP research, pain points, or any insights…"
              disabled={loading}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "14px",
                fontFamily: "inherit",
                padding: "8px 0",
                backgroundColor: "transparent",
                color: "#1f2937",
                opacity: loading ? 0.6 : 1
              }}
              onKeyDown={e=>{ 
                if(e.key==="Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(); 
                }
              }}
            />
            <button 
              onClick={send} 
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: (loading || !input.trim()) ? "#e5e7eb" : "#002BFF",
                color: (loading || !input.trim()) ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: (loading || !input.trim()) ? "not-allowed" : "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {loading ? "Sending" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
