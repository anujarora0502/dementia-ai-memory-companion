import os
import json
import logging
import requests
import numpy as np
try:
    import librosa
except ImportError:
    librosa = None
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Config
SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")  # Or service role key for backend

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# Stage 1: ASR (Sarvam Saaras v3)
# ==========================================
def run_asr_pipeline(audio_filepath: str):
    """
    Run the same audio through 3 modes.
    Note: Sarvam API endpoint requires multipart/form-data.
    Since we don't have exact endpoints for 'verbatim' vs 'translate', we simulate the distinct calls
    based on the specification requirements.
    """
    logger.info(f"Stage 1: Running ASR on {audio_filepath}")
    
    # In a real environment, we would use the actual endpoints/parameters.
    # We will return mocked data here so it's independently testable without hitting the live ASR 
    # API for every run (which is slow/expensive).
    
    return {
        "verbatim": "Umm... hello? Yes, I went to the park, uh, with Akash.",
        "translate": "Hello? Yes, I went to the park with Akash.",
        "transcribe": "नमस्ते? हाँ, मैं आकाश के साथ पार्क गई थी।"
    }

# ==========================================
# Stage 2: Signals
# ==========================================
def compute_prosody(audio_filepath: str):
    """
    Computes pause_ratio, speech_rate, and pitch_variance to determine effort.
    """
    logger.info(f"Stage 2a: Computing prosody for {audio_filepath}")
    
    if librosa is None:
        logger.warning("librosa not installed. Returning default prosody.")
        return {"pause_ratio": 0.1, "speech_rate": 2.5, "pitch_variance": 50, "effort_signal": "recalled"}
        
    try:
        y, sr = librosa.load(audio_filepath, sr=None)
        
        # 1. Pitch Variance
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = pitches[magnitudes > np.median(magnitudes)]
        pitch_variance = float(np.var(pitch_values)) if len(pitch_values) > 0 else 0.0
        
        # 2. Pause Ratio
        # Split non-silent intervals
        intervals = librosa.effects.split(y, top_db=20)
        total_duration = librosa.get_duration(y=y, sr=sr)
        speech_duration = sum([(end - start) / sr for start, end in intervals])
        pause_ratio = (total_duration - speech_duration) / total_duration if total_duration > 0 else 0
        
        # 3. Speech Rate (Approximation based on envelope peaks)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        peaks = librosa.util.peak_pick(onset_env, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
        speech_rate = len(peaks) / total_duration if total_duration > 0 else 0

        # Effort Logic
        if pause_ratio > 0.4 or speech_rate < 1.0:
            effort_signal = "partial" # High effort
        elif len(peaks) == 0:
            effort_signal = "none"
        else:
            effort_signal = "recalled" # Low effort

        return {
            "pause_ratio": float(pause_ratio),
            "speech_rate": float(speech_rate),
            "pitch_variance": pitch_variance,
            "effort_signal": effort_signal
        }
    except Exception as e:
        logger.error(f"Error computing prosody: {e}")
        return {"pause_ratio": 0, "speech_rate": 0, "pitch_variance": 0, "effort_signal": "none"}

def compute_llm_valence(text: str):
    """
    Writes memories.emotional_weight (valence -1..1) and emotion_label.
    """
    logger.info("Stage 2b: Computing LLM valence")
    
    if not SARVAM_API_KEY:
        return {"valence": 0.5, "emotion_label": "Neutral"}

    headers = {"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY}
    payload = {
        "model": "sarvam-30b",
        "messages": [
            {"role": "system", "content": "You are a sentiment analyzer. Analyze the text and return ONLY strict JSON: {\"valence\": float_between_-1_and_1, \"emotion_label\": \"string\"}. No markdown or reasoning."},
            {"role": "user", "content": text}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    }
    
    try:
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", headers=headers, json=payload)
        data = res.json()
        content = data['choices'][0]['message']['content']
        # Strip potential markdown
        content = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(content)
        return parsed
    except Exception as e:
        logger.error(f"Error computing valence: {e}")
        return {"valence": 0.0, "emotion_label": "Unknown"}

# ==========================================
# Stage 3: Consolidation
# ==========================================
def segment_into_episodes(full_cleaned_transcript: str):
    """
    Pass A: Segment by TOPIC BOUNDARY into episodes.
    Requires full transcript to resolve coreference.
    """
    logger.info("Stage 3, Pass A: Segmenting transcript into episodes")
    
    if not SARVAM_API_KEY:
        return [full_cleaned_transcript]

    headers = {"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY}
    prompt = """
    You are a transcript segmenter. Read the entire transcript and split it into distinct topical episodes.
    An episode is one complete story, regardless of length. Resolve coreferences (e.g., 'he' means 'Akash').
    Return ONLY a strict JSON array of strings, where each string is an episode's text. No markdown.
    """
    
    payload = {
        "model": "sarvam-30b",
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": full_cleaned_transcript}
        ],
        "temperature": 0.2,
        "max_tokens": 2000
    }
    
    try:
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", headers=headers, json=payload)
        content = res.json()['choices'][0]['message']['content']
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception as e:
        logger.error(f"Error segmenting episodes: {e}")
        return [full_cleaned_transcript]

def extract_episode_data(episode_text: str):
    """
    Pass B: Parallel extraction of entities, memory_entities, assertions.
    """
    logger.info(f"Stage 3, Pass B: Extracting data for episode: {episode_text[:50]}...")
    
    if not SARVAM_API_KEY:
        return {"entities": [], "assertions": []}
        
    headers = {"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY}
    prompt = """
    Extract structured data from the episode.
    Return ONLY strict JSON matching this schema:
    {
      "entities": [{"name": "Akash", "type": "person", "description": "grandson"}],
      "assertions": [{"subject": "Sheela", "predicate": "visited", "object": "park", "confidence": 0.9}]
    }
    """
    
    payload = {
        "model": "sarvam-30b",
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": episode_text}
        ],
        "temperature": 0.1,
        "max_tokens": 1000
    }
    
    try:
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", headers=headers, json=payload)
        content = res.json()['choices'][0]['message']['content']
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception as e:
        logger.error(f"Error extracting data: {e}")
        return {"entities": [], "assertions": []}

def get_embedding(text: str):
    # Mocking embedding for hackathon (would use Sarvam or OpenAI embeddings here)
    return np.random.rand(1536).tolist()

# ==========================================
# Stage 4: Deduplication & Insertion
# ==========================================
def dedupe_and_insert(episode_text: str, extracted_data: dict, prosody_signals: dict, valence_data: dict, profile_id: str):
    """
    Cosine similarity > 0.85 -> Reinforce (do not insert)
    else -> Insert
    """
    logger.info("Stage 4: Dedupe and Insert into Supabase")
    
    if not SUPABASE_URL:
        logger.error("Supabase credentials missing.")
        return
        
    supabase = get_supabase()
    embedding = get_embedding(episode_text)
    
    # 1. Match existing memories
    try:
        matches = supabase.rpc('match_memories', {
            'query_embedding': embedding,
            'match_threshold': 0.85,
            'match_count': 1
        }).execute()
        
        if matches.data and len(matches.data) > 0:
            # DEDUPE CAUGHT! Update existing memory.
            matched_memory = matches.data[0]
            mem_id = matched_memory['id']
            logger.info(f"Duplicate found (Similarity > 0.85). Reinforcing memory {mem_id}")
            
            # Update metrics
            new_times = matched_memory.get('times_discussed', 1) + 1
            new_interval = matched_memory.get('interval_days', 1) * 2.2
            
            supabase.table('memories').update({
                'times_discussed': new_times,
                'interval_days': new_interval,
                'last_discussed_at': 'now()'
            }).eq('id', mem_id).execute()
            
            # Log cue attempt
            supabase.table('cue_attempts').insert({
                'memory_id': mem_id,
                'outcome': prosody_signals.get('effort_signal', 'recalled'),
                'cue_type': 'spontaneous'
            }).execute()
            
            return {"status": "merged", "memory_id": mem_id}
            
        else:
            # INSERT NEW
            logger.info("No duplicates found. Inserting new memory.")
            
            new_mem = supabase.table('memories').insert({
                'profile_id': profile_id,
                'title': episode_text[:50] + '...',
                'description': episode_text,
                'embedding': embedding,
                'times_discussed': 1,
                'interval_days': 1.0,
                'emotional_weight': valence_data.get('valence', 0),
                'memory_type': 'story'
            }).execute()
            
            mem_id = new_mem.data[0]['id']
            
            # Insert assertions append-only
            for assertion in extracted_data.get('assertions', []):
                supabase.table('assertions').insert({
                    'memory_id': mem_id,
                    'subject': assertion.get('subject'),
                    'predicate': assertion.get('predicate'),
                    'object': assertion.get('object')
                }).execute()
                
            return {"status": "inserted", "memory_id": mem_id}
            
    except Exception as e:
        logger.error(f"Database operation failed: {e}")
        return {"status": "error", "error": str(e)}

# ==========================================
# Main Pipeline Runner
# ==========================================
def run_pipeline(audio_filepath: str, profile_id: str):
    logger.info(f"--- Starting Post-Conversation Pipeline for {profile_id} ---")
    
    # 1. ASR
    asr_results = run_asr_pipeline(audio_filepath)
    
    # 2. Signals
    prosody = compute_prosody(audio_filepath)
    
    # 3. Consolidation (Pass A)
    episodes = segment_into_episodes(asr_results["translate"])
    
    results = []
    # Process each episode (Pass B & Dedupe)
    for ep in episodes:
        valence = compute_llm_valence(ep)
        extracted = extract_episode_data(ep)
        
        # 4. Dedupe & Insert
        result = dedupe_and_insert(ep, extracted, prosody, valence, profile_id)
        results.append(result)
        
    logger.info("--- Pipeline Complete ---")
    return results

if __name__ == "__main__":
    # Test runner for a dummy file
    dummy_file = "test_audio.wav"
    if not os.path.exists(dummy_file):
        # Create a tiny dummy wav just so librosa doesn't crash on file not found during tests
        # or we can rely on librosa throwing an exception caught by our try/except block.
        pass
        
    # Example execution:
    print(run_pipeline(dummy_file, "user-123"))
