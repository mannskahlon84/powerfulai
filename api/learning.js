/**
 * Continuous Learning and Self-Improvement System Backend & Database Schema
 * 
 * DATABASE SCHEMA & PERSISTENCE ARCHITECTURE:
 * -------------------------------------------------------------------------
 * 1. user_interactions (table / collection):
 *    - id (UUID / string): Unique interaction ID
 *    - userId (string): Identifier for the user session or account
 *    - sessionId (string): Active chat or voice session ID
 *    - prompt (text): Raw user input prompt or transcribed voice utterance
 *    - response (text): Generated AI response
 *    - mode (string): "chat" | "voice"
 *    - language (string): Detected language (e.g., "en-US", "hi-IN", "pa-IN")
 *    - timestamp (ISO string): Timestamp of interaction
 * 
 * 2. feedback_logs (table / collection):
 *    - id (UUID / string): Unique feedback ID
 *    - interactionId (string): Foreign key linking to user_interactions.id
 *    - userId (string): User identifier
 *    - rating (string): "up" | "down" | "correction"
 *    - correctionNote (text): Explicit user correction or suggested improvement
 *    - category (string): e.g., "pronunciation", "grammar", "formatting", "factual", "style"
 *    - timestamp (ISO string): Timestamp of feedback submission
 * 
 * 3. user_learning_profile (table / collection):
 *    - userId (string): Unique user identifier (Primary Key)
 *    - preferredLanguages (array of strings): Primary languages used (e.g., ["hi-IN", "pa-IN", "en-US"])
 *    - successfulPatterns (array of objects): Recorded successful conversational patterns & formatting styles
 *    - errorCorrections (array of objects): Explicit correction rules to prevent repeating mistakes
 *    - lastUpdated (ISO string): Last profile update timestamp
 * -------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import { SelfSupervisedTrainingLoop } from './utils/languageModelEngine.js';

// In serverless/local environments without an active SQL DB, we maintain persistent JSON store + Firebase ready hooks
const DB_FILE = path.join(process.cwd(), '.system_learning_store.json');

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const db = JSON.parse(raw);
      if (!db.self_supervised_samples) db.self_supervised_samples = [];
      return db;
    }
  } catch (err) {
    console.warn("Failed to load local DB, initializing new store:", err.message);
  }
  return {
    user_interactions: [],
    feedback_logs: [],
    user_learning_profile: {},
    self_supervised_samples: []
  };
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn("Could not save to DB_FILE:", err.message);
  }
}

export default async function handler(req, res) {
  // CORS & method verification
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, userId = 'default_user', sessionId, prompt, response, mode = 'chat', language = 'en', interactionId, rating, correctionNote, category = 'general' } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action parameter is required' });
  }

  const db = loadDatabase();

  try {
    // 1. Log user interaction & persistence
    if (action === 'log_interaction') {
      const newInteraction = {
        id: `inter_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        sessionId: sessionId || 'session_default',
        prompt,
        response,
        mode,
        language,
        timestamp: new Date().toISOString()
      };
      db.user_interactions.push(newInteraction);

      // Record self-supervised fine-tuning dataset sample
      if (prompt && response) {
        const sample = SelfSupervisedTrainingLoop.generateFineTuningSample(prompt, response, 1.0);
        db.self_supervised_samples.push(sample);
        if (db.self_supervised_samples.length > 250) {
          db.self_supervised_samples = db.self_supervised_samples.slice(-250);
        }
      }

      // Trim interactions to keep store efficient
      if (db.user_interactions.length > 500) {
        db.user_interactions = db.user_interactions.slice(-500);
      }
      saveDatabase(db);

      return res.status(200).json({ success: true, interactionId: newInteraction.id });
    }

    // 2. Submit user feedback & update user learning profile
    if (action === 'submit_feedback') {
      const feedbackEntry = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        interactionId: interactionId || null,
        userId,
        rating, // "up", "down", or "correction"
        correctionNote: correctionNote || '',
        category,
        timestamp: new Date().toISOString()
      };
      db.feedback_logs.push(feedbackEntry);

      // Ensure user profile exists
      if (!db.user_learning_profile[userId]) {
        db.user_learning_profile[userId] = {
          userId,
          preferredLanguages: [],
          successfulPatterns: [],
          errorCorrections: [],
          lastUpdated: new Date().toISOString()
        };
      }

      const profile = db.user_learning_profile[userId];
      profile.lastUpdated = new Date().toISOString();

      // If thumbs up, store successful interaction pattern
      if (rating === 'up' && interactionId) {
        const inter = db.user_interactions.find(i => i.id === interactionId);
        if (inter && !profile.successfulPatterns.some(p => p.prompt === inter.prompt)) {
          profile.successfulPatterns.push({
            prompt: inter.prompt,
            responseSummary: inter.response.substring(0, 200),
            mode: inter.mode,
            language: inter.language,
            timestamp: new Date().toISOString()
          });
          if (profile.successfulPatterns.length > 25) profile.successfulPatterns.shift();
        }
      }

      // If correction or downvote with correctionNote, store explicit correction rule
      if ((rating === 'correction' || rating === 'down') && correctionNote) {
        const inter = db.user_interactions.find(i => i.id === interactionId);
        profile.errorCorrections.push({
          rule: correctionNote,
          originalPrompt: inter ? inter.prompt : 'General rule',
          category,
          timestamp: new Date().toISOString()
        });
        if (profile.errorCorrections.length > 25) profile.errorCorrections.shift();
      }

      saveDatabase(db);
      return res.status(200).json({ success: true, profileUpdated: true, feedbackId: feedbackEntry.id });
    }

    // 3. Contextual Learning & Memory Retrieval (RAG / Feedback Injection)
    if (action === 'retrieve_context') {
      const profile = db.user_learning_profile[userId] || {
        successfulPatterns: [],
        errorCorrections: [],
        preferredLanguages: []
      };

      // Lightweight similarity / recency retrieval based on prompt keywords
      const promptKeywords = (prompt || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const relevantPatterns = profile.successfulPatterns.filter(p => {
        if (!prompt) return true;
        const pText = (p.prompt + ' ' + p.responseSummary).toLowerCase();
        return promptKeywords.some(kw => pText.includes(kw));
      }).slice(-5);

      const recentCorrections = profile.errorCorrections.slice(-10);

      // Search recent interactions for this user
      const recentInteractions = db.user_interactions
        .filter(i => i.userId === userId)
        .slice(-6);

      return res.status(200).json({
        success: true,
        context: {
          successfulPatterns: relevantPatterns.length > 0 ? relevantPatterns : profile.successfulPatterns.slice(-3),
          errorCorrections: recentCorrections,
          recentInteractions: recentInteractions.map(i => ({ prompt: i.prompt, response: i.response.substring(0, 150), mode: i.mode })),
          languagePreferences: profile.preferredLanguages
        }
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error("Learning endpoint error:", err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
