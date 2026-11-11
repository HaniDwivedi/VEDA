# jarvis/memory.py
from collections import deque
from pyexpat.errors import messages

class NexusMemory:
    def __init__(self, max_turns=5):
        # max_turns=5 matlab last 5 baatein yaad rakhega (10 messages total)
        self.chat_history = deque(maxlen=max_turns * 2)
        
        # Hinglish aur Noob persona ka system prompt
        self.system_prompt = (
            "You are Nexus, a casual coding friend. Speak strictly in Hinglish "
            "(Hindi keywords in Roman script). Don't act like a genius professor. "
            "Talk like a peer. Keep responses short, direct, and under 3-4 lines "
            "so it sounds good in voice output. Never give full code answers unless forced."
        )

    def build_payload(self, current_code_state, user_speech_text):
        """Har baar naya fresh payload banayega bina history ko ganda kiye"""
        messages = [{"role": "system", "content": self.system_prompt}]
        
        # Fresh code context jo sirf ISI turn ke liye LLM ke paas jayega
        code_context = f"Current LeetCode Code Box State:\n```python\n{current_code_state}\n```"
        messages.append({"role": "system", "content": code_context})
        
        # Purani conversation history (is me sirf baatein hain, code nahi)
        messages.extend(list(self.chat_history))
        
        # User ka naya sawaal
        messages.append({"role": "user", "content": user_speech_text})
        return messages

    def update_history(self, user_msg, assistant_msg):
        """Sirf baaton ko history me daalo, code block ko nahi"""
        self.chat_history.append({"role": "user", "content": user_msg})
        self.chat_history.append({"role": "assistant", "content": assistant_msg})