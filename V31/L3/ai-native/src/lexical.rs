//! Lexical retrieval for the Hiranyagarbha RAG pipeline.
//!
//! A BM25 index (k1 = 1.2, b = 0.75) over `(id, text)` documents. The
//! tokenizer lowercases, folds Czech diacritics to ASCII, splits on
//! non-alphanumeric characters and drops tokens shorter than 2 chars. This
//! replaces the placeholder dense-vector retrieval for text search; the
//! `VectorStore` is still populated alongside for compatibility.

use std::collections::{HashMap, HashSet};

const K1: f32 = 1.2;
const B: f32 = 0.75;
const MIN_TOKEN_CHARS: usize = 2;

/// Fold Czech diacritics to their ASCII base letters. Input is expected to
/// be already lowercased.
fn fold_czech(c: char) -> char {
    match c {
        'á' => 'a',
        'č' => 'c',
        'ď' => 'd',
        'é' | 'ě' => 'e',
        'í' => 'i',
        'ň' => 'n',
        'ó' => 'o',
        'ř' => 'r',
        'š' => 's',
        'ť' => 't',
        'ú' | 'ů' => 'u',
        'ý' => 'y',
        'ž' => 'z',
        other => other,
    }
}

/// Lowercase → fold Czech diacritics → split on non-alphanumeric → drop
/// tokens shorter than 2 chars.
pub fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    for c in text.chars().flat_map(char::to_lowercase) {
        let c = fold_czech(c);
        if c.is_alphanumeric() {
            current.push(c);
        } else if current.chars().count() >= MIN_TOKEN_CHARS {
            tokens.push(std::mem::take(&mut current));
        } else {
            current.clear();
        }
    }
    if current.chars().count() >= MIN_TOKEN_CHARS {
        tokens.push(current);
    }
    tokens
}

/// A BM25 index over a fixed set of documents.
pub struct Bm25Index {
    docs: Vec<(String, String)>,
    /// Term frequency per document.
    doc_tf: Vec<HashMap<String, u32>>,
    /// Document frequency per term.
    doc_freq: HashMap<String, u32>,
    doc_lens: Vec<usize>,
    avg_doc_len: f32,
}

impl Bm25Index {
    pub fn build(docs: Vec<(String, String)>) -> Self {
        let mut doc_tf = Vec::with_capacity(docs.len());
        let mut doc_lens = Vec::with_capacity(docs.len());
        let mut doc_freq: HashMap<String, u32> = HashMap::new();

        for (_, text) in &docs {
            let tokens = tokenize(text);
            doc_lens.push(tokens.len());
            let mut tf: HashMap<String, u32> = HashMap::new();
            for t in tokens {
                *tf.entry(t).or_insert(0) += 1;
            }
            for term in tf.keys() {
                *doc_freq.entry(term.clone()).or_insert(0) += 1;
            }
            doc_tf.push(tf);
        }

        let avg_doc_len = if doc_lens.is_empty() {
            0.0
        } else {
            doc_lens.iter().sum::<usize>() as f32 / doc_lens.len() as f32
        };

        Self {
            docs,
            doc_tf,
            doc_freq,
            doc_lens,
            avg_doc_len,
        }
    }

    /// BM25 search. Returns `(doc index, score)` pairs with score > 0,
    /// sorted by score descending, ties by index.
    pub fn search(&self, query: &str, k: usize) -> Vec<(usize, f32)> {
        if k == 0 || self.docs.is_empty() {
            return Vec::new();
        }
        let query_terms: HashSet<String> = tokenize(query).into_iter().collect();
        if query_terms.is_empty() {
            return Vec::new();
        }

        let n_docs = self.docs.len() as f32;
        let mut scored: Vec<(usize, f32)> = Vec::new();

        for (idx, tf) in self.doc_tf.iter().enumerate() {
            let mut score = 0.0_f32;
            let dl = self.doc_lens[idx] as f32;
            for term in &query_terms {
                let df = *self.doc_freq.get(term).unwrap_or(&0) as f32;
                if df == 0.0 {
                    continue;
                }
                let f = *tf.get(term).unwrap_or(&0) as f32;
                if f == 0.0 {
                    continue;
                }
                // Robertson/Lucene idf, always positive.
                let idf = (1.0 + (n_docs - df + 0.5) / (df + 0.5)).ln();
                let denom = f + K1 * (1.0 - B + B * dl / self.avg_doc_len.max(f32::EPSILON));
                score += idf * (f * (K1 + 1.0)) / denom;
            }
            if score > 0.0 {
                scored.push((idx, score));
            }
        }

        scored.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
        scored.truncate(k);
        scored
    }

    /// `(id, text)` of the document at `idx`.
    pub fn doc(&self, idx: usize) -> (&str, &str) {
        (self.docs[idx].0.as_str(), self.docs[idx].1.as_str())
    }

    pub fn len(&self) -> usize {
        self.docs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.docs.is_empty()
    }
}

/// Truncate `s` to at most `max_chars` characters, on a char boundary.
pub fn truncate_chars(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        Some((byte_idx, _)) => &s[..byte_idx],
        None => s,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn docs(entries: &[(&str, &str)]) -> Vec<(String, String)> {
        entries
            .iter()
            .map(|(id, t)| (id.to_string(), t.to_string()))
            .collect()
    }

    #[test]
    fn bm25_ranks_relevant_doc_first() {
        let index = Bm25Index::build(docs(&[
            ("a", "kuchyne kocka spani domov"),
            (
                "b",
                "ZION blockchain pouziva proof of work konsenzus a tezbu",
            ),
            ("c", "recept na buchty mouka cukr mleko vejce"),
        ]));
        let hits = index.search("proof of work konsenzus", 3);
        assert!(!hits.is_empty());
        assert_eq!(hits[0].0, 1);
    }

    #[test]
    fn diacritics_folding_both_directions() {
        let index = Bm25Index::build(docs(&[("d", "tezba zion bloku na gpu")]));
        let hits = index.search("těžba", 3);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, 0);

        let index2 = Bm25Index::build(docs(&[("d", "těžba bloku na gpu")]));
        let hits2 = index2.search("tezba", 3);
        assert_eq!(hits2.len(), 1);
        assert_eq!(hits2[0].0, 0);
    }

    #[test]
    fn empty_and_stopword_query_no_hits() {
        let index = Bm25Index::build(docs(&[("d", "zion blockchain")]));
        assert!(index.search("", 3).is_empty());
        assert!(index.search("a   - /", 3).is_empty());
        assert!(index.search("x", 3).is_empty()); // single-char token dropped
    }

    #[test]
    fn truncate_chars_is_char_boundary_safe() {
        let s = "ěščřžýáíé".repeat(200);
        let t = truncate_chars(&s, 100);
        assert_eq!(t.chars().count(), 100);
        let _ = t; // must not panic — boundary-safe slice
        assert_eq!(truncate_chars("abc", 10), "abc");
        assert_eq!(truncate_chars("", 5), "");
    }
}
