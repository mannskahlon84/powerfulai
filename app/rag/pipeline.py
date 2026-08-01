import os
import re
import math
from collections import Counter
from pathlib import Path
from typing import List, Dict, Optional
from app.core.config import settings
from app.core.schemas import PolicyDocument


class RAGPipeline:
    """
    RAG Pipeline for Qatar Labour Law HR Policies.
    Parses Markdown policy documents, chunks by headings, and performs
    semantic/keyword hybrid vector similarity search.
    """
    def __init__(self, docs_dir: Optional[Path] = None):
        self.docs_dir = docs_dir or settings.POLICY_DOCS_DIR
        self.documents: List[PolicyDocument] = []
        self._doc_vectors: List[Counter] = []
        self._df: Counter = Counter()
        self._num_docs = 0
        self.ingest_policies()

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r"\b[a-z0-9]{2,}\b", text.lower())
        # Strip common stopwords
        stopwords = {
            "the", "and", "of", "to", "a", "in", "for", "is", "on", "that", "by", "this",
            "with", "as", "be", "are", "from", "at", "or", "an", "will", "shall", "must",
            "may", "not", "any", "which", "per", "their", "have", "been", "it", "under"
        }
        return [w for w in words if w not in stopwords]

    def _compute_tfidf(self, words: List[str]) -> Counter:
        tf = Counter(words)
        vec = Counter()
        for w, count in tf.items():
            idf = math.log((self._num_docs + 1) / (self._df[w] + 1)) + 1
            vec[w] = count * idf
        return vec

    def _cosine_similarity(self, vec1: Counter, vec2: Counter) -> float:
        intersection = set(vec1.keys()) & set(vec2.keys())
        numerator = sum(vec1[w] * vec2[w] for w in intersection)
        sum1 = sum(val**2 for val in vec1.values())
        sum2 = sum(val**2 for val in vec2.values())
        denominator = math.sqrt(sum1) * math.sqrt(sum2)
        if not denominator:
            return 0.0
        return numerator / denominator

    def ingest_policies(self):
        """
        Loads all Markdown files from the policy_docs directory,
        splits into semantic chunks by headers, and indexes them.
        """
        self.documents = []
        if not self.docs_dir.exists():
            print(f"[RAGPipeline] Policy directory not found: {self.docs_dir}")
            return

        doc_idx = 0
        for md_file in sorted(self.docs_dir.glob("*.md")):
            try:
                content = md_file.read_text(encoding="utf-8")
                filename = md_file.name
                category = "Qatar Labour Law"
                
                # Split by primary markdown headings (## or #)
                sections = re.split(r"\n(?=#{1,2}\s)", content)
                for i, sec in enumerate(sections):
                    sec_clean = sec.strip()
                    if not sec_clean:
                        continue
                    
                    lines = sec_clean.splitlines()
                    header = lines[0].lstrip("#").strip() if lines else f"Section {i+1}"
                    body = "\n".join(lines[1:]).strip() if len(lines) > 1 else sec_clean
                    
                    doc_id = f"{md_file.stem}-sec{i+1}"
                    doc = PolicyDocument(
                        id=doc_id,
                        title=f"{header} ({filename})",
                        category=category,
                        content=body or header,
                        source=filename
                    )
                    self.documents.append(doc)
                    doc_idx += 1
            except Exception as e:
                print(f"[RAGPipeline] Error ingesting {md_file}: {e}")

        # Build vocabulary DF
        self._num_docs = len(self.documents)
        self._df = Counter()
        for doc in self.documents:
            unique_words = set(self._tokenize(doc.title + " " + doc.content))
            for w in unique_words:
                self._df[w] += 1

        # Compute TF-IDF vectors
        self._doc_vectors = []
        for doc in self.documents:
            words = self._tokenize(doc.title + " " + doc.content)
            self._doc_vectors.append(self._compute_tfidf(words))
            
        print(f"[RAGPipeline] Successfully indexed {self._num_docs} policy document sections.")

    def search_policy(self, query: str, top_k: int = 3, category: Optional[str] = None) -> List[PolicyDocument]:
        """
        Retrieves top-k most relevant policy chunks for the user query.
        """
        if not self.documents:
            return []

        query_words = self._tokenize(query)
        if not query_words:
            return self.documents[:top_k]

        query_vec = self._compute_tfidf(query_words)
        
        scored_docs = []
        for doc, vec in zip(self.documents, self._doc_vectors):
            if category and doc.category.lower() != category.lower():
                continue
            sim = self._cosine_similarity(query_vec, vec)
            
            # Boost score if query tokens appear in title
            title_lower = doc.title.lower()
            if any(w in title_lower for w in query_words):
                sim += 0.15
                
            scored_docs.append((sim, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scored_docs[:top_k]:
            doc_copy = doc.model_copy()
            doc_copy.similarity_score = round(score, 3)
            results.append(doc_copy)
            
        return results


# Global RAG singleton
rag_pipeline = RAGPipeline()
