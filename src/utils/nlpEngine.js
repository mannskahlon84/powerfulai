/**
 * Advanced Natural Language Processing (NLP) Engine for Powerful AI
 * Integrates syntax tokenization, named entity recognition (NER), part-of-speech (POS) tagging,
 * and sentiment/tone analysis inspired by spaCy, NLTK, and Stanford CoreNLP.
 */

import nlp from 'compromise';

/**
 * Perform comprehensive NLP analysis on text input
 * @param {string} text - User prompt or chat message
 * @returns {Object} Structured NLP metadata (entities, pos, sentiment, complexity)
 */
export function analyzeTextNLP(text) {
  if (!text || typeof text !== 'string') {
    return {
      tokens: 0,
      nouns: [],
      verbs: [],
      adjectives: [],
      entities: { people: [], places: [], organizations: [], dates: [] },
      sentiment: 'neutral',
      complexityScore: 1.0
    };
  }

  try {
    const doc = nlp(text);

    // Part of Speech (POS) Tagging
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('array');
    const adjectives = doc.adjectives().out('array');

    // Named Entity Recognition (NER)
    const people = doc.people().out('array');
    const places = doc.places().out('array');
    const organizations = doc.organizations().out('array');
    const dates = doc.dates().out('array');

    // Basic Sentiment & Mood assessment
    const isQuestion = text.trim().endsWith('?') || doc.questions().length > 0;
    const hasUrgency = /\b(fast|quick|immediately|now|hurry|urgent|asap)\b/i.test(text);
    const hasPositiveTone = /\b(great|awesome|thank|love|good|best|excellent|beautiful)\b/i.test(text);
    const hasNegativeTone = /\b(bad|error|bug|wrong|fail|broken|problem|not working)\b/i.test(text);

    let sentiment = 'neutral';
    if (hasPositiveTone && !hasNegativeTone) sentiment = 'positive';
    else if (hasNegativeTone) sentiment = 'negative';
    else if (isQuestion) sentiment = 'inquiring';

    // Sentence Complexity Metric (Word Count + Average Word Length)
    const words = text.trim().split(/\s+/);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
    const complexityScore = Number((words.length * 0.05 + avgWordLength * 0.15).toFixed(2));

    return {
      tokens: words.length,
      nouns: nouns.slice(0, 10),
      verbs: verbs.slice(0, 10),
      adjectives: adjectives.slice(0, 10),
      entities: {
        people: people.slice(0, 5),
        places: places.slice(0, 5),
        organizations: organizations.slice(0, 5),
        dates: dates.slice(0, 5)
      },
      sentiment,
      isQuestion,
      hasUrgency,
      complexityScore
    };
  } catch (error) {
    console.warn('NLP Engine analysis fallback:', error.message);
    const words = text.trim().split(/\s+/);
    return {
      tokens: words.length,
      nouns: [],
      verbs: [],
      adjectives: [],
      entities: { people: [], places: [], organizations: [], dates: [] },
      sentiment: 'neutral',
      complexityScore: 1.0
    };
  }
}

/**
 * Enhance and expand a prompt using NLP keyword extraction
 * @param {string} prompt - Raw input prompt
 * @returns {string} Enriched prompt with semantic context
 */
export function enhancePromptNLP(prompt) {
  if (!prompt || typeof prompt !== 'string') return prompt;

  try {
    const analysis = analyzeTextNLP(prompt);
    let enriched = prompt.trim();

    // If it's an image prompt and missing descriptive adjectives, inject cinematic detail
    if (/\b(create|generate|picture|photo|image|draw)\b/i.test(prompt)) {
      if (analysis.adjectives.length <= 1) {
        enriched += ', highly detailed 8k photorealistic composition, vibrant color depth, cinematic studio lighting';
      }
    }

    return enriched;
  } catch (e) {
    return prompt;
  }
}

/**
 * Analyze grammar structure for Language Tutor syntax coaching
 * @param {string} text - Language learner utterance
 * @returns {Object} Grammatical breakdown
 */
export function analyzeGrammarStructure(text) {
  const analysis = analyzeTextNLP(text);
  return {
    wordCount: analysis.tokens,
    structureSummary: `Detected ${analysis.nouns.length} nouns, ${analysis.verbs.length} verbs, and ${analysis.adjectives.length} modifiers.`,
    feedbackScore: analysis.tokens > 3 ? 95 : 75
  };
}
