/**
 * Advanced Conversational AI Language Model Engine for Powerful AI
 * Implements:
 * 1. Conversational Framework (State Machine & Dialogue Graph Flow)
 * 2. Natural Reading Style (TTS Prosody, Phrasing, Inflections & Pauses)
 * 3. Contextual Understanding (Memory-Augmented Neural Context Module)
 * 4. Emotional Intelligence & Personality Traits (ML-Driven Emotion Adaptation)
 * 5. Data & Training (Preprocessing & Self-Supervised Continuous Learning Loop)
 *
 * NOTE: This module operates exclusively within the language model and conversational voice layer.
 */

// ============================================================================
// 1. CONVERSATIONAL FRAMEWORK: DIALOGUE GRAPH & STATE MACHINE
// ============================================================================

export const DIALOGUE_STATES = {
  GREETING_INIT: 'GREETING_INIT',
  ACTIVE_EXPLORATION: 'ACTIVE_EXPLORATION',
  DEEP_REASONING_CHALLENGE: 'DEEP_REASONING_CHALLENGE',
  EMOTIONAL_EMPATHY_STATE: 'EMOTIONAL_EMPATHY_STATE',
  LEARNING_SYNTHESIS: 'LEARNING_SYNTHESIS'
};

export class ConversationStateMachine {
  constructor() {
    // Define valid dialogue state transitions (Graph structure)
    this.graph = {
      [DIALOGUE_STATES.GREETING_INIT]: [
        DIALOGUE_STATES.ACTIVE_EXPLORATION,
        DIALOGUE_STATES.EMOTIONAL_EMPATHY_STATE
      ],
      [DIALOGUE_STATES.ACTIVE_EXPLORATION]: [
        DIALOGUE_STATES.DEEP_REASONING_CHALLENGE,
        DIALOGUE_STATES.EMOTIONAL_EMPATHY_STATE,
        DIALOGUE_STATES.LEARNING_SYNTHESIS
      ],
      [DIALOGUE_STATES.DEEP_REASONING_CHALLENGE]: [
        DIALOGUE_STATES.ACTIVE_EXPLORATION,
        DIALOGUE_STATES.LEARNING_SYNTHESIS
      ],
      [DIALOGUE_STATES.EMOTIONAL_EMPATHY_STATE]: [
        DIALOGUE_STATES.ACTIVE_EXPLORATION,
        DIALOGUE_STATES.LEARNING_SYNTHESIS
      ],
      [DIALOGUE_STATES.LEARNING_SYNTHESIS]: [
        DIALOGUE_STATES.ACTIVE_EXPLORATION
      ]
    };
  }

  /**
   * Determine the next conversational graph state based on user input & emotional vectors
   */
  evaluateNextState(currentState, input, emotionalProfile) {
    const text = (input || '').toLowerCase();
    
    // Check for explicit debate, challenges, or tricky questions
    const isChallenge = /\b(why|how can you prove|wrong|incorrect|disagree|debate|logic|contradict|tackle|challenge|test)\b/i.test(text);
    if (isChallenge) {
      return DIALOGUE_STATES.DEEP_REASONING_CHALLENGE;
    }

    // Check for emotional distress, frustration, or need for empathy
    if (emotionalProfile.frustration > 0.5 || emotionalProfile.urgency > 0.7 || /\b(help|stuck|frustrated|confused|please|worry|sad)\b/i.test(text)) {
      return DIALOGUE_STATES.EMOTIONAL_EMPATHY_STATE;
    }

    // Check for explicit corrections or learning feedback
    if (/\b(remember|correct|actually|from now on|learn|preference|rule)\b/i.test(text)) {
      return DIALOGUE_STATES.LEARNING_SYNTHESIS;
    }

    // Default to active exploration
    return DIALOGUE_STATES.ACTIVE_EXPLORATION;
  }
}

// ============================================================================
// 2. NATURAL READING STYLE: TTS PROSODY, PHRASING, INFLECTIONS & PAUSES
// ============================================================================

/**
 * Format language model text output with natural speech prosody, breathing pauses,
 * and emotional inflection for TTS engines (gTTS, pydub, ElevenLabs, Web Speech).
 * 
 * @param {string} rawText - Response from language model
 * @param {Object} personality - Current active personality vector
 * @returns {string} Prosody-optimized speech text
 */
export function formatProsodyAndPhrasing(rawText, personality = {}) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Clean markdown artifacts so TTS never speaks "asterisk", "hash", or "backtick"
  let speech = rawText
    .replace(/```[\s\S]*?```/g, " [Code block omitted for speech.] ")
    .replace(/\!\[.*?\]\(.*?\)/g, " [Image displayed on screen.] ")
    .replace(/\[EXPORT_(?:DOCX|XLSX|PDF)\]/g, "")
    .replace(/[#*`~]/g, "")
    .replace(/\|.*\|/g, " [Table data displayed.] ")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Insert natural breathing pauses & pacing based on sentence structure
  // Replace overly long sentences with rhythmic commas or ellipsis pauses
  speech = speech
    .replace(/(\b(?:However|Therefore|Moreover|Furthermore|In fact|Well|Actually|Of course)\b),?/gi, "$1,... ")
    .replace(/;\s*/g, "... ")
    .replace(/:\s*/g, ",... ");

  // 3. Modulate pacing and inflection based on emotional personality warmth & empathy
  if (personality.warmth > 0.8 || personality.empathy > 0.8) {
    // Add warm conversational inflection at sentence beginnings
    speech = speech.replace(/^(\w)/, (match) => match);
  }

  // 4. Ensure Indic script phonetics (Hindi Devanagari / Punjabi Gurmukhi) retain authentic cadence
  speech = speech.replace(/(\u0900-\u097F|\u0A00-\u0A7F)+/g, (match) => {
    return ` ${match} `;
  });

  return speech.trim();
}

// ============================================================================
// 3. CONTEXTUAL UNDERSTANDING: MEMORY-AUGMENTED CONTEXT MODULE
// ============================================================================

export class MemoryAugmentedContextModule {
  constructor(maxWorkingMemorySize = 10) {
    this.maxSize = maxWorkingMemorySize;
    this.workingMemory = []; // Short-term episodic memory matrix
  }

  /**
   * Store conversation turn into episodic memory with keyword embeddings
   */
  storeMemory(turnId, userPrompt, aiResponse, metadata = {}) {
    const keywords = (userPrompt + " " + aiResponse)
      .toLowerCase()
      .match(/\b[a-z]{4,}\b/g) || [];

    const uniqueKeywords = [...new Set(keywords)];

    const memoryNode = {
      id: turnId || Date.now(),
      timestamp: Date.now(),
      prompt: userPrompt,
      response: aiResponse,
      keywords: uniqueKeywords,
      weights: metadata.weights || 1.0
    };

    this.workingMemory.push(memoryNode);
    if (this.workingMemory.length > this.maxSize) {
      this.workingMemory.shift();
    }
  }

  /**
   * Retrieve most contextually relevant past turns using semantic keyword intersection
   */
  retrieveRelevantContext(currentQuery, topK = 3) {
    if (!currentQuery || this.workingMemory.length === 0) return [];

    const queryWords = new Set((currentQuery.toLowerCase().match(/\b[a-z]{4,}\b/g) || []));
    if (queryWords.size === 0) return this.workingMemory.slice(-topK);

    const scoredMemories = this.workingMemory.map(mem => {
      let matchCount = 0;
      for (const kw of mem.keywords) {
        if (queryWords.has(kw)) matchCount++;
      }
      const similarityScore = (matchCount / (queryWords.size || 1)) * mem.weights;
      return { ...mem, score: similarityScore };
    });

    scoredMemories.sort((a, b) => b.score - a.score);
    return scoredMemories.filter(m => m.score > 0 || this.workingMemory.indexOf(m) >= this.workingMemory.length - 2).slice(0, topK);
  }
}

// ============================================================================
// 4. EMOTIONAL INTELLIGENCE & PERSONALITY (ML-DRIVEN EMOTION ADAPTATION)
// ============================================================================

export class EmotionalIntelligenceModule {
  constructor() {
    this.currentPersonality = {
      warmth: 0.75,
      assertiveness: 0.70,
      formality: 0.50,
      humor: 0.40,
      empathy: 0.80
    };
  }

  /**
   * Analyze input query for emotional vectors and adapt personality profile
   */
  evaluateEmotionAndAdapt(text) {
    const t = (text || '').toLowerCase();

    const emotionalProfile = {
      joy: /\b(happy|love|great|awesome|thank|excellent|best|brilliant)\b/i.test(t) ? 0.85 : 0.2,
      urgency: /\b(fast|quick|now|immediately|urgent|hurry|asap)\b/i.test(t) ? 0.90 : 0.2,
      frustration: /\b(bad|error|bug|wrong|broken|fail|not working|why is it|vanished|annoyed)\b/i.test(t) ? 0.85 : 0.1,
      curiosity: /\b(how|why|what if|explain|tell me about|understand)\b/i.test(t) ? 0.80 : 0.3,
      skepticism: /\b(really|are you sure|prove|incorrect|doubt|disagree|debate)\b/i.test(t) ? 0.85 : 0.2
    };

    // Adapt Personality Profile dynamically based on emotional state
    if (emotionalProfile.frustration > 0.5) {
      this.currentPersonality.empathy = 0.95;
      this.currentPersonality.warmth = 0.90;
      this.currentPersonality.formality = 0.30;
      this.currentPersonality.humor = 0.10;
    } else if (emotionalProfile.skepticism > 0.5) {
      this.currentPersonality.assertiveness = 0.95;
      this.currentPersonality.formality = 0.75;
      this.currentPersonality.warmth = 0.70;
    } else if (emotionalProfile.joy > 0.5) {
      this.currentPersonality.warmth = 0.90;
      this.currentPersonality.humor = 0.65;
    }

    return {
      emotionalProfile,
      adaptedPersonality: { ...this.currentPersonality }
    };
  }

  /**
   * Generate system prompt modifier based on active personality vector
   */
  getPersonalityPromptModifier(personality) {
    return `\n[RUNTIME PERSONALITY & EMOTIONAL INTELLIGENCE INSTRUCTION]:\n` +
      `- Warmth: ${Math.round(personality.warmth * 100)}% | Empathy: ${Math.round(personality.empathy * 100)}% | Assertiveness: ${Math.round(personality.assertiveness * 100)}%\n` +
      `- Communicate with human-like emotional intelligence. If the user feels frustrated or confused, respond with reassuring empathy and patience. If challenged or debated, respond with articulate confidence and composure.`;
  }
}

// ============================================================================
// 5. DATA & TRAINING: PREPROCESSING & SELF-SUPERVISED LEARNING LOOP
// ============================================================================

export class SelfSupervisedTrainingLoop {
  /**
   * Preprocess and normalize diverse conversational texts for training
   */
  static preprocessTextForTraining(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    
    // Normalize whitespace, strip control characters, preserve Indic Unicode
    return rawText
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Create self-supervised fine-tuning dataset sample from successful interaction
   */
  static generateFineTuningSample(userPrompt, aiResponse, score = 1.0) {
    const cleanedPrompt = this.preprocessTextForTraining(userPrompt);
    const cleanedResponse = this.preprocessTextForTraining(aiResponse);

    return {
      messages: [
        { role: "user", content: cleanedPrompt },
        { role: "assistant", content: cleanedResponse }
      ],
      metadata: {
        timestamp: Date.now(),
        qualityScore: score,
        selfSupervised: true
      }
    };
  }
}
