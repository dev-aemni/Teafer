import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Safely find the 'public' folder using the Current Working Directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Load API Keys securely on the server side
let apiKeys: string[] = [];
let currentKeyIndex = 0;
const MODEL_NAME = "google/gemini-2.0-flash-001";

try {
    const rawKeys = fs.readFileSync(path.join(process.cwd(), '.API.lock'), 'utf-8');
    apiKeys = rawKeys.split('\n').map(k => k.trim()).filter(k => k);
    if (apiKeys.length === 0) throw new Error("File is empty.");
    console.log(`Loaded ${apiKeys.length} OpenRouter API Keys.`);
} catch (error) {
    console.error("Failed to load \".API.lock.\" Please create it.", error);
    process.exit(1);
}

// Endpoint to fetch the system prompt for the frontend
app.get('/api/system-prompt', (req: express.Request, res: express.Response) => {
    try {
        const prompt = fs.readFileSync(path.join(process.cwd(), 'system-prompt.lock'), 'utf-8');
        res.send(prompt);
    } catch (error) {
        res.status(500).send("Error loading system prompt.");
    }
});

// Endpoint to handle the chat request
app.post('/api/chat', async (req: express.Request, res: express.Response) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
    }

    let success = false;
    let attempts = 0;
    const maxAttempts = apiKeys.length;

    while (!success && attempts < maxAttempts) {
        const apiKey = apiKeys[currentKeyIndex];

        try {
            console.log(`Attempting request with Key #${currentKeyIndex + 1}...`);
            
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messages, 
                    reasoning: { enabled: true } 
                })
            });

            const data: any = await response.json();

            if (!response.ok || data.error) {
                const status = response.status;
                if (status === 402 || status === 429 || JSON.stringify(data).toLowerCase().includes("quota")) {
                    console.warn(`Key #${currentKeyIndex + 1} exhausted. Rotating...`);
                    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                } else {
                    console.error(`❌ OpenRouter Error:`, data.error);
                    return res.status(500).json({ error: data?.error?.message || "Unknown API Error" });
                }
            } else {
                return res.json({ message: data.choices[0].message });
            }
        } catch (error) {
            console.error("Network Error reaching OpenRouter:", error);
        }
        attempts++;
    }

    return res.status(500).json({ error: "All API keys failed or exceeded quota." });
});

app.listen(PORT, () => {
    console.log(`Teafer Server running at http://localhost:${PORT}`);
});