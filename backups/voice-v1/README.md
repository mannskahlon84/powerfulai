# Voice Agent v1 System Backup & Versioning

This directory contains a complete, functional snapshot of the Voice Agent v1 system architecture, duplicated and preserved to prepare for Voice Agent v2 development without altering existing functionality.

## 1. Git Version Control Snapshot
* **Backup Branch Created**: `backup/voice-agent-v1`
* Preserves the exact state of `main` at the completion of Voice Agent v1.

## 2. File-Level Snapshot (`backups/voice-v1/`)
The following files have been mirrored into `backups/voice-v1/` for direct reference during v2 development:

### Client Hooks
* `hooks/useGeminiLive.v1.js` — Core Voice Agent v1 orchestrator (Streaming STT, real-time conversational turns, barge-in interruption, and streaming voice connection playback).
* `hooks/useSpeech.v1.js` — Push-to-talk speech assistant helper hook.

### Client UI Components
* `components/ChatScreen.v1.jsx` — Core UI component housing the interactive voice call modal and live voice controls.

### Backend Routes & Utilities
* `api/tts.v1.js` — Multi-engine TTS cascade with Priority 1 Language-Based Router, ElevenLabs, OpenAI Nova, Tacotron 2 + MelGAN, and Google Neural.
* `api/voice-stream.v1.js` — Real-time HTTP chunked streaming voice connection (`application/x-ndjson`).
* `api/chat.v1.js` — Main conversational LLM router and voice session endpoint.
* `api/utils/languageModelEngine.v1.js` — Prosody, phrasing, and cadence formatting engine.
* `api/utils/tacotronMelgan.v1.js` — Acoustic spectrogram and GAN waveform synthesis classes.
