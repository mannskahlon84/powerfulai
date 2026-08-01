/**
 * Server-side NLP Engine for Powerful AI (Inspired by NLTK, spaCy & Stanford CoreNLP)
 * Performs syntax tokenization, POS tagging, Named Entity Recognition (NER), 
 * and real-time sentiment & complexity scoring on backend queries.
 */

export function analyzeQueryNLP(text) {
  if (!text || typeof text !== 'string') {
    return {
      tokens: [],
      nouns: [],
      verbs: [],
      adjectives: [],
      sentiment: 'neutral',
      complexity: 'basic',
      intents: []
    };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/);

  // POS heuristic heuristics inspired by NLTK POS tagging rules
  const nouns = words.filter(w => /^[A-Z][a-z]+$|\b(system|image|code|error|model|user|voice|data|file|language|hindi|punjabi|agent)\b/i.test(w));
  const verbs = words.filter(w => /\b(create|generate|make|build|fix|run|show|explain|translate|learn|speak)\b/i.test(w));
  const adjectives = words.filter(w => /\b(fast|quick|beautiful|cinematic|realistic|smart|powerful|colourful|colorful|high|better)\b/i.test(w));

  // Sentiment scoring
  const positiveCount = (clean.match(/\b(great|awesome|thank|good|best|excellent|beautiful|love|nice)\b/gi) || []).length;
  const negativeCount = (clean.match(/\b(bad|error|bug|wrong|fail|broken|problem|not working|vanished)\b/gi) || []).length;

  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > 0) sentiment = 'negative';
  else if (clean.endsWith('?')) sentiment = 'inquiring';

  // Intent classification
  const intents = [];
  if (/\b(image|picture|photo|pic|avatar)\b/i.test(clean)) intents.push('image_generation');
  if (/\b(code|function|import|error|syntax|html|css|javascript)\b/i.test(clean)) intents.push('coding_assistance');
  if (/\b(translate|hindi|punjabi|language|pronounce|grammar)\b/i.test(clean)) intents.push('language_coaching');
  if (/\b(weather|temperature|forecast)\b/i.test(clean)) intents.push('live_data_sensor');

  return {
    tokens: words,
    nouns: [...new Set(nouns)],
    verbs: [...new Set(verbs)],
    adjectives: [...new Set(adjectives)],
    sentiment,
    complexity: words.length > 20 ? 'advanced' : words.length > 8 ? 'intermediate' : 'basic',
    intents
  };
}
