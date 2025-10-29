import { store } from '../state/store.js';
import { toast } from './toast.js';
import { SYSTEM_PROMPT } from '../constants/systemPrompt.js';

async function callOpenAI(messages) {
  const { settings } = store.state;
  if (!settings.openAiKey) {
    throw new Error('Add an OpenAI API key in Settings before starting the chat.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openAiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Unable to reach OpenAI.');
  }

  const data = await response.json();
  if (!data?.output?.[0]?.content?.[0]?.text) {
    throw new Error('OpenAI response was empty.');
  }
  return data.output[0].content[0].text;
}

function fallbackParse(description) {
  const lines = description.split(/\n|,|;/).map((line) => line.trim()).filter(Boolean);
  const materials = [];
  let services = [];

  lines.forEach((line) => {
    const hoursMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)/i);
    const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:gallons?|lbs?|pieces?|units?|bags?|boxes?)/i);
    if (hoursMatch) {
      services.push({
        name: line.replace(hoursMatch[0], '').trim() || 'Service',
        hours: Number(hoursMatch[1]),
      });
    }
    if (qtyMatch) {
      materials.push({
        name: line.replace(qtyMatch[0], '').trim() || 'Material',
        quantity: Number(qtyMatch[1]),
        unit: qtyMatch[0].replace(qtyMatch[1], '').trim() || 'unit',
      });
    }
  });

  if (services.length === 0) {
    services.push({ name: 'General Labor', hours: 4, rate: 75 });
  } else {
    services = services.map((service) => ({
      rate: 75,
      ...service,
    }));
  }
  return { services, materials };
}

function extractJsonPayload(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch (error) {
    // fall through
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (error) {
      // fall through
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }
  return null;
}

export async function parseServicesAndMaterials(history) {
  const userMessage = history[history.length - 1]?.content || '';
  try {
    const assistantMessage = await callOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ]);
    const parsed = extractJsonPayload(assistantMessage);
    if (!parsed) {
      throw new Error('AI response missing structured JSON.');
    }
    return { assistantMessage, parsed };
  } catch (error) {
    console.warn('OpenAI failed, using fallback parser', error);
    toast(`AI unavailable: ${error.message}. Using offline parser.`, 'warning');
    const parsed = fallbackParse(userMessage);
    const assistantMessage = `I could not reach the AI service. Based on your description I suggest the following.\n\nServices:\n${parsed.services
      .map((service) => `• ${service.name} – ${service.hours} h @ $${service.rate || 75}/h`)
      .join('\n')}\n\nMaterials:\n${parsed.materials
      .map((material) => `• ${material.name} – ${material.quantity} ${material.unit}`)
      .join('\n') || '• None listed'}`;
    return { assistantMessage, parsed };
  }
}
