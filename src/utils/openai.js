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
  const services = [];

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
    services.push({ name: 'General Labor', hours: 4 });
  }
  return { services, materials };
}

export async function parseServicesAndMaterials(history) {
  const userMessage = history[history.length - 1]?.content || '';
  try {
    const result = await callOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ]);
    const parsed = JSON.parse(result);
    return parsed;
  } catch (error) {
    console.warn('OpenAI failed, using fallback parser', error);
    toast(`AI unavailable: ${error.message}. Using offline parser.`, 'warning');
    return fallbackParse(userMessage);
  }
}
