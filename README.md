# HandyManny Calculator

HandyManny Calculator is a client-side web application that helps handyman teams transform job descriptions into professional, shareable quotes. The experience runs entirely in the browser – no servers or databases are required.

## Tech Stack

- **Vanilla JavaScript (ES Modules)** for interactivity and state management.
- **Custom state store + localStorage** persistence for drafts and settings.
- **Web Workers** for material price lookups (Home Depot & Tractor Supply).
- **jsPDF (CDN)** for PDF export.
- **Custom micro test harness** (Vitest-style) executed via Node.

## Getting Started Locally

1. **Install Node.js 18+**.
2. Clone the repository and install no dependencies (everything is committed).
3. Start the lightweight dev server:

   ```bash
   npm run preview
   ```

4. Visit [http://localhost:4173](http://localhost:4173) in your browser.

> The application can also be opened directly via `index.html` if you prefer double-click/dragging into the browser.

## Running Tests

Unit tests cover the core cost and profit calculations and run without external packages:

```bash
npm test
```

## Deploying to Netlify

1. Create a new Netlify site and connect this repository.
2. Use **“No build command”**. Set the publish directory to the repository root (`/`).
3. Ensure `index.html` is treated as the entry file. Optional: enable pretty URLs.

Netlify will serve the static bundle directly.

## OpenAI API

The AI service chat requires an OpenAI API key (stored locally only). Add it under **Settings → OpenAI API Key**. Without a key, the app falls back to an offline parser.

## Default Terms & Conditions

The default terms constant (editable in Settings):

```
**Handyman Quote – Terms & Conditions**

1. **Validity**: This quote is valid for 30 days from the date above.
2. **Payment**: 50 % deposit upon acceptance, balance due upon completion.
3. **Materials**: Prices based on current Home Depot / Tractor Supply rates; subject to change if unavailable.
4. **Labor**: Rates include travel; fuel calculated at $0.20/mi.
5. **Changes**: Any client-requested changes after approval require a revised quote.
6. **Warranty**: Workmanship guaranteed for 90 days; materials per manufacturer warranty.
7. **Cancellation**: Deposits non-refundable once work has begun.

[Special conditions added by user appear here]
```

## AI System Prompt

```
You are HandyManny Quote Builder. You convert free-form handyman job descriptions into JSON with services and materials.
Return strictly valid JSON with this shape:
{
  "services": [
    { "name": string, "hours": number, "rate": number }
  ],
  "materials": [
    { "name": string, "quantity": number, "unit": string }
  ]
}
Rules:
- Estimate hours realistically; default service hourly rate = 75.
- Materials quantities must be numeric.
- Never add commentary, only JSON.
```

## Folder Structure

```text
.
├── index.html
├── styles.css
├── package.json
├── scripts/
│   ├── dev-server.js
│   └── runTests.js
├── src/
│   ├── constants/
│   │   ├── systemPrompt.js
│   │   └── terms.js
│   ├── state/
│   │   └── store.js
│   ├── utils/
│   │   ├── calculations.js
│   │   ├── openai.js
│   │   ├── priceResearch.js
│   │   ├── quoteFactory.js
│   │   └── toast.js
│   ├── views/
│   │   └── appView.js
│   ├── workers/
│   │   └── priceWorker.js
│   └── main.js
├── tests/
│   └── calculations.test.js
└── README.md
```

## LocalStorage Keys

- `handymanny-calculator-state-v1` – serialized app state (drafts, settings, company profile).

## Price Lookup Worker

The worker fetches search results from Home Depot and Tractor Supply and returns the best prices to the UI. When requests fail (e.g., offline, blocked by CORS), the UI prompts users to enter manual prices.

## PDF Generation

The preview modal uses jsPDF (loaded from CDN) to export a print-friendly PDF with materials, labor, totals, and terms. Generated PDFs are cached in-session for repeated downloads.

## Clearing Drafts

Use **Settings → Clear All Drafts** to wipe localStorage and reset to defaults.

Enjoy building professional quotes!
