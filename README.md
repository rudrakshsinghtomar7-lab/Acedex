# Acedex MVP

This repository now contains a frontend-only MVP with direct AI integration.

## What was implemented

- React + Vite starter app.
- Prompt UI with one-click call to OpenAI Responses API.
- AI response rendering and error handling.
- No backend yet (deferred intentionally).

## Run locally

```bash
npm install
npm run dev
```

Then open the app in your browser and provide an OpenAI API key in the form.

## Important MVP note

For speed, the API key is entered in the frontend for now. In the next phase we should move this to a backend proxy for key safety, rate limiting, logging, and usage controls.
