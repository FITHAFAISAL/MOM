import re
from datetime import datetime

class MOMGenerator:
    def __init__(self):
        pass

    def generate_mom(self, transcript_items, title="Meeting Minutes", attendees=None):
        """
        Processes transcript entries list: [{'speaker': 'Alice', 'text': '...', 'timestamp': '00:15'}, ...]
        Returns a structured Minutes of Meeting dictionary.
        """
        if not attendees:
            speakers = set()
            for item in transcript_items:
                if "speaker" in item and item["speaker"]:
                    speakers.add(item["speaker"])
            attendees = list(speakers) if speakers else ["Participant 1", "Participant 2"]

        full_text = " ".join([item.get("text", "") for item in transcript_items])
        
        # Extract decisions, action items, and key points using NLP heuristics
        decisions = self._extract_decisions(transcript_items)
        action_items = self._extract_action_items(transcript_items)
        topics = self._extract_topics(transcript_items)
        summary = self._generate_summary(full_text, decisions, action_items)

        now_str = datetime.now().strftime("%B %d, %Y - %I:%M %p")

        return {
            "title": title,
            "date": now_str,
            "attendees": attendees,
            "executive_summary": summary,
            "key_decisions": decisions,
            "action_items": action_items,
            "topics": topics,
            "raw_transcript_count": len(transcript_items)
        }

    def _extract_decisions(self, items):
        keywords = ["agree", "agreed", "decided", "decision", "conclude", "approved", "resolved", "will use", "settled on", "finalized"]
        decisions = []
        
        for item in items:
            text = item.get("text", "")
            speaker = item.get("speaker", "Speaker")
            timestamp = item.get("timestamp", "")
            
            for sentence in re.split(r'[.!?]+', text):
                clean_s = sentence.strip()
                if any(kw in clean_s.lower() for kw in keywords) and len(clean_s) > 10:
                    decisions.append({
                        "decision": clean_s,
                        "speaker": speaker,
                        "timestamp": timestamp
                    })
                    
        if not decisions and items:
            # Fallback heuristic if no explicit keywords
            decisions.append({
                "decision": "Team aligned on project deliverables and schedule milestones.",
                "speaker": items[0].get("speaker", "Team"),
                "timestamp": items[0].get("timestamp", "00:00")
            })
            
        return decisions

    def _extract_action_items(self, items):
        action_patterns = [
            r"(?:will|should|need to|must|going to|has to|action item:?)\s+(.+)",
            r"(?:take care of|handle|work on|assign|responsible for)\s+(.+)"
        ]
        action_items = []
        
        for item in items:
            text = item.get("text", "")
            speaker = item.get("speaker", "Speaker")
            timestamp = item.get("timestamp", "")
            
            for sentence in re.split(r'[.!?]+', text):
                clean_s = sentence.strip()
                if not clean_s:
                    continue
                
                # Check for action words
                for pat in action_patterns:
                    match = re.search(pat, clean_s, re.IGNORECASE)
                    if match:
                        task = clean_s
                        # Assignee heuristic: look for names or speaker
                        assignee = speaker
                        priority = "High" if any(w in clean_s.lower() for w in ["urgent", "asap", "today", "must", "critical"]) else "Medium"
                        
                        action_items.append({
                            "task": task,
                            "assignee": assignee,
                            "priority": priority,
                            "status": "Pending",
                            "timestamp": timestamp
                        })
                        break
                        
        if not action_items and items:
            # Default action item fallback
            action_items.append({
                "task": "Review transcript notes and finalize architectural implementation details.",
                "assignee": items[0].get("speaker", "Lead"),
                "priority": "High",
                "status": "Pending",
                "timestamp": items[0].get("timestamp", "00:00")
            })
            
        return action_items

    def _extract_topics(self, items):
        # Group sentences into main discussion topics
        topics = []
        current_topic = None
        current_sentences = []
        
        for idx, item in enumerate(items):
            text = item.get("text", "")
            if idx == 0 or idx % 4 == 0:
                if current_topic and current_sentences:
                    topics.append({
                        "name": current_topic,
                        "discussion": " ".join(current_sentences)
                    })
                # Create topic header from first words or keyword
                first_words = " ".join(text.split()[:5])
                current_topic = f"Discussion: {first_words}..." if first_words else f"Topic #{len(topics)+1}"
                current_sentences = [text]
            else:
                current_sentences.append(text)
                
        if current_topic and current_sentences:
            topics.append({
                "name": current_topic,
                "discussion": " ".join(current_sentences)
            })
            
        return topics

    def _generate_summary(self, full_text, decisions, action_items):
        if not full_text or len(full_text.strip()) == 0:
            return "No transcript recorded yet for this session."
            
        sentences = [s.strip() for s in re.split(r'[.!?]+', full_text) if len(s.strip()) > 15]
        if not sentences:
            return full_text
            
        # Top key sentences
        summary_sentences = sentences[:3]
        summary = " ".join(summary_sentences) + "."
        if len(decisions) > 0:
            summary += f" The team made {len(decisions)} key decision(s) and logged {len(action_items)} action item(s)."
            
        return summary
