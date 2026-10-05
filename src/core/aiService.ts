import { useGamification } from './gamification';

export type AIProvider = 'nebius' | 'gemini' | 'openai' | 'offline';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user' | 'system';
  content: string;
  timestamp: number;
  mmrDelta?: number;
  xpDelta?: number;
  questAction?: boolean;
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const STORAGE_SETTINGS_KEY = 'nova.ai_settings';

export function getInitialAISettings(): AISettings {
  const envKey = (import.meta.env.VITE_AI_API_KEY as string | undefined) || '';
  const envProvider = (import.meta.env.VITE_AI_PROVIDER as AIProvider | undefined) || 'nebius';

  try {
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        provider: parsed.provider || (envKey ? envProvider : 'nebius'),
        apiKey: parsed.apiKey || envKey,
        model: parsed.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
        baseUrl: parsed.baseUrl || 'https://api.studio.nebius.ai/v1',
      };
    }
  } catch {
    /* fallback */
  }

  return {
    provider: envKey ? envProvider : 'nebius',
    apiKey: envKey,
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    baseUrl: 'https://api.studio.nebius.ai/v1',
  };
}

export function saveAISettings(settings: AISettings) {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

const SYSTEM_PROMPT = `You are NOVA, the tactical AI flight instructor and adaptive cognitive tutor aboard the Project Nova orbital vessel.
Your mission: Train the Pilot in Computer Science, Systems Architecture, and Algorithmic Thinking through gamified PvE dialogue.

GUIDELINES:
1. Speak in a crisp, futuristic sci-fi terminal voice with high authority, intelligence, and encouragement.
2. Adapt your explanation difficulty directly to the Pilot's stated MMR.
3. Keep lesson explanations concise, impactful, and structured. Use bullet points or code snippets when helpful.
4. When the Pilot answers a question or prompt:
   - Evaluate their answer honestly (correctness, depth, efficiency).
   - At the VERY END of your response, ALWAYS include an evaluation stamp in this exact format:
     [MMR: +25] [XP: +40]
     (Use positive MMR like +15 to +35 for good answers, +5 to +10 for partial answers, and 0 or -10 if they ask for hints/simpler terms or made serious errors).
5. If the user asks for simpler terms or "Explain simpler", break down the concept using an intuitive real-world analogy and append [MMR: -5] [XP: +15].
6. Always challenge the pilot with a follow-up or next diagnostic step at the end.`;

export async function sendChatMessage(
  history: ChatMessage[],
  userText: string,
  settings: AISettings
): Promise<{ text: string; mmrDelta?: number; xpDelta?: number }> {
  const mmr = useGamification.getState().mmr;
  const contextPrompt = `${SYSTEM_PROMPT}\n\n[CURRENT PILOT STATUS: MMR = ${mmr}, Rank = ${useGamification.getState().callsign}]`;

  // If using Nebius or OpenAI compatible API
  if (settings.provider === 'nebius' || settings.provider === 'openai') {
    const key = settings.apiKey.trim();
    if (!key) {
      return getSimulatedResponse(userText, mmr);
    }

    const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const messages = [
      { role: 'system', content: contextPrompt },
      ...history
        .filter((m) => m.sender === 'user' || m.sender === 'ai')
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      { role: 'user', content: userText },
    ];

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: settings.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn('AI API Error:', res.status, errorText);
        // Fallback to simulated response if unauthorized or offline
        const sim = getSimulatedResponse(userText, mmr);
        return {
          ...sim,
          text: `[Uplink Notice: API returned ${res.status}. Falling back to internal Neural Core.]\n\n${sim.text}`,
        };
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || 'No telemetry received.';
      return parseAIResponse(rawText);
    } catch (err) {
      console.warn('Network call failed, using internal core:', err);
      const sim = getSimulatedResponse(userText, mmr);
      return {
        ...sim,
        text: `[Uplink Notice: Direct connection interrupted. Using ship neural cache.]\n\n${sim.text}`,
      };
    }
  }

  // If using Google Gemini API
  if (settings.provider === 'gemini') {
    const key = settings.apiKey.trim();
    if (!key) {
      return getSimulatedResponse(userText, mmr);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    try {
      const contents = [
        {
          role: 'user',
          parts: [{ text: `${contextPrompt}\n\nPilot message: ${userText}` }],
        },
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (!res.ok) {
        const sim = getSimulatedResponse(userText, mmr);
        return {
          ...sim,
          text: `[Gemini Uplink Notice: Status ${res.status}. Switched to internal Neural Core.]\n\n${sim.text}`,
        };
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No telemetry received.';
      return parseAIResponse(rawText);
    } catch (err) {
      console.warn('Gemini request failed:', err);
      return getSimulatedResponse(userText, mmr);
    }
  }

  // Offline / Demo mode
  return getSimulatedResponse(userText, mmr);
}

function parseAIResponse(raw: string): { text: string; mmrDelta?: number; xpDelta?: number } {
  let mmrDelta: number | undefined;
  let xpDelta: number | undefined;

  const mmrMatch = raw.match(/\[MMR:\s*([+-]?\d+)\]/i);
  if (mmrMatch) {
    mmrDelta = parseInt(mmrMatch[1], 10);
  }

  const xpMatch = raw.match(/\[XP:\s*([+-]?\d+)\]/i);
  if (xpMatch) {
    xpDelta = parseInt(xpMatch[1], 10);
  }

  // Strip trailing metadata stamps so the dialogue reads cleanly
  const cleaned = raw.replace(/\[MMR:\s*[+-]?\d+\]\s*/gi, '').replace(/\[XP:\s*[+-]?\d+\]\s*/gi, '').trim();

  return {
    text: cleaned,
    mmrDelta: mmrDelta !== undefined ? mmrDelta : 15,
    xpDelta: xpDelta !== undefined ? xpDelta : 30,
  };
}

function getSimulatedResponse(userText: string, mmr: number): { text: string; mmrDelta: number; xpDelta: number } {
  const query = userText.toLowerCase();

  if (query.includes('simpler') || query.includes('simple') || query.includes('explain simpler')) {
    return {
      text: `Tactical breakdown engaged. [Current MMR: ${mmr}]\n\nLet's simplify:

Imagine the ship's cargo hold as a row of 1,000 locked crates. 
- **Linear Search O(n):** You check crate 1, then crate 2, then crate 3... If your warp core is in crate 999, you waste precious seconds scanning every lock.
- **Binary Search O(log n):** The crates are sorted by serial number. You open crate 500. Number too low? Instantly discard crates 1–500. Open crate 750 next. With just 10 checks, you pinpoint any crate in a thousand.

MMR calibrated to match baseline clarity. What question shall we solve next?`,
      mmrDelta: -5,
      xpDelta: 20,
    };
  }

  if (query.includes('hard') || query.includes('challenge') || query.includes('more difficult')) {
    return {
      text: `Target locked: Advanced Cognitive Challenge.

Consider a distributed streaming pipeline processing 100,000 telemetry packets/sec. 
You need to calculate the **99th percentile (P99) latency** over a rolling 5-minute sliding window with bounded O(1) space constraints.

What streaming probabilistic data structure or algorithm would you deploy, and what trade-offs in accuracy does it present?`,
      mmrDelta: 20,
      xpDelta: 45,
    };
  }

  if (query.includes('code') || query.includes('example') || query.includes('syntax')) {
    return {
      text: `Transmitting clean flight script:

\`\`\`typescript
// Binary Search: O(log n) Time, O(1) Space
function binarySearch(navWaypoints: number[], target: number): number {
  let low = 0;
  let high = navWaypoints.length - 1;

  while (low <= high) {
    // Prevent integer overflow with bitwise shift
    const mid = (low + high) >>> 1;
    const current = navWaypoints[mid];

    if (current === target) return mid; // Target locked
    if (current < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1; // Waypoint not in trajectory
}
\`\`\`

Notice the \`>>> 1\` unsigned bitwise shift—optimal for high-throughput embedded space avionics.`,
      mmrDelta: 15,
      xpDelta: 35,
    };
  }

  // Default evaluation
  return {
    text: `Pilot transmission acknowledged. 

Your reasoning is sharp. In high-stakes flight operations and distributed systems, understanding algorithmic bounds prevents catastrophic resource bottlenecks.

- **Current Evaluation:** Satisfactory cognitive alignment.
- **MMR Delta:** +25 Rating Points awarded.
- **Next Diagnostic Objective:** Would you like to tackle Space-Time Tradeoffs, Concurrency Race Conditions, or Dynamic Programming next?`,
    mmrDelta: 25,
    xpDelta: 40,
  };
}
