"""Coordinate speech recognition, local macros, and the desktop agent runtime."""
import os
import sys
import queue
import json
import time
import re
import subprocess
import threading
import sounddevice as sd
import pyautogui
from vosk import Model, KaldiRecognizer

# External module internal hooks
from voice import listen_live_groq, speak  
from agent_runtime import AgentRuntime

# Optional AI Analysis Failover Engine
try:
    from ai_engine import analyze_user_intent_and_screen  
except ImportError:
    analyze_user_intent_and_screen = None
    print("⚠️ Warning: ai_engine module nahi mila. Cloud AI functionality fallback standard par rahegi.")

def handle_local_system_commands(user_input):
    """
    Dynamically processes system requests like closing apps or scaling scrolls 
    without manual endless if-else conditioning loops. Supports Hinglish/Hindi.
    """
    command = user_input.lower().strip()
    if not command:
        return False

    call_match = re.match(
        r"^(?:nexus\s+)?(?:call|phone)\s+(?P<name>.+?)(?:\s+ko)?\s*(?:call\s*)?(?:karo|kar do|please)?$",
        command,
        
    )
    if not call_match:
        call_match = re.match(
            r"^(?:nexus\s+)?(?P<name>.+?)\s+ko\s+(?:call|phone)\s+(?:karo|kar do|please)$",
            command,
        )
    if call_match:
        contact_name = call_match.group("name").strip()
        try:
            from tools.phone import call_contact
        except ImportError:
            speak("Phone calling is not configured on this device.")
            return True
        speak(call_contact(contact_name))
        return True
        
    # 1. --- DYNAMIC APP CLOSER BLOCK (Hinglish/Hindi Added) ---
    # Saare close karne wale keywords yahan handle honge
    close_keywords = ["close", "exit", "terminate", "kill", "band karo", "band_karo", "close karo", "band"]
    
    if any(keyword in command for keyword in close_keywords):
        app_target = command
        # Filler words ko remove karke clean app name nikalna
        for keyword in close_keywords + ["my", "the", "app", "software", "program", "karo"]:
            app_target = app_target.replace(keyword, "")
        app_target = app_target.strip()
        
        if app_target:
            # Match mappings for casual speech tokens
            process_map = {
                "vs code": "Code.exe",
                "vscode": "Code.exe",
                "vs": "Code.exe",          # 💡 Added "vs" shortcut
                "chrome": "chrome.exe",
                "browser": "chrome.exe",
                "spotify": "Spotify.exe",
                "notepad": "notepad.exe",
                "discord": "Discord.exe"
            }
            
            process_name = process_map.get(app_target)
            if not process_name:
                speak(f"{app_target} is not in the supported close list.")
                return True

            result = subprocess.run(
                ["taskkill", "/f", "/im", process_name],
                capture_output=True,
                check=False,
            )

            if result.returncode == 0:
                print(f"Nexus (Local Exec): Successfully terminated process -> {process_name}")
                speak(f"Ok boss, {app_target} band kar diya hai.")
                return True
            else:
                print(f"Nexus (Local Exec): Checked for '{process_name}', but app wasn't running.")
                
    # 2. --- DYNAMIC SCROLL CONTEXT LAYER ---
    if "scroll" in command:
        digits = re.findall(r'\d+', command)
        scroll_amount = int(digits[0]) * 300 if digits else 500
        
        if any(word in command for word in ["down", "niche", "neeche"]):
            import pyautogui
            pyautogui.scroll(-scroll_amount)
            print(f"Nexus (Local): Scrolled down by {scroll_amount} points.")
            return True
        elif any(word in command for word in ["up", "upar"]):
            import pyautogui
            pyautogui.scroll(scroll_amount)
            print(f"Nexus (Local): Scrolled up by {scroll_amount} points.")
            return True

    return False


def execute_local_macro(command_text):
    """Real-time instant keystroke operations parsed via Vosk Partial Streams"""
    if not command_text:
        return False

    if any(word in command_text for word in ["next", "down", "niche", "doosra", "neeche"]):
        pyautogui.press("down")
        return True
    if any(word in command_text for word in ["go back", "vapas", "wapas"]):
        pyautogui.hotkey("alt", "left")
        return True
    elif any(word in command_text for word in ["back", "up", "previous", "upar", "pichla", "upper", "upr"]):
        pyautogui.press("up")
        return True
    elif any(word in command_text for word in ["enter", "click", "kholo", "ok"]):
        pyautogui.press("enter")
        return True
    elif any(word in command_text for word in ["open new tab", "naya tab kholo"]):
        pyautogui.hotkey("ctrl", "t")
        return True
    elif any(word in command_text for word in ["close tab", "tab band karo"]):
        pyautogui.hotkey("ctrl", "w")
        return True
    elif any(word in command_text for word in ["refresh", "reload", "dobara kholo"]):
        pyautogui.hotkey("ctrl", "r")   
        return True
        
    return False

# Resolve model files both from source runs and PyInstaller bundles.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCE_DIR = getattr(sys, "_MEIPASS", BASE_DIR)
model_path = os.path.join(RESOURCE_DIR, "model", "vosk-model-small-en-in-0.4")

audio_queue = queue.Queue()
stop_event = threading.Event()
rec = None
is_ai_processing = False


def _update_agent_state(snapshot):
    global is_ai_processing
    is_ai_processing = snapshot["state"] in {"queued", "running", "retrying"}
    print(f"Nexus task [{snapshot['state']}]: {snapshot['detail']}")


agent_runtime = AgentRuntime(workers=3, on_change=_update_agent_state)


def get_agent_status():
    return agent_runtime.snapshot()


def report_engine_failure(error):
    """Expose background audio startup failures to the floating widget."""
    agent_runtime._set_state("failed", str(error))
    print(f"Audio engine failed: {error}", file=sys.stderr)


def audio_callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    audio_queue.put(bytes(indata))

def run_complex_ai_task(update):
    """Capture a spoken request and dispatch it to local or AI-backed handlers."""
    try:
        update("Listening for your request")
        speak("ji sir ?")
        user_query = listen_live_groq("🎙️ Heavy Query Active. Speak now...")
        
        if user_query and len(user_query.strip()) > 1:
            print(f"🗣️ Advanced Query: {user_query}")
            update(f"Planning: {user_query}")
            
            # Local Dynamic bypass validation checking step
            if handle_local_system_commands(user_query):
                return "Local task completed"
                
            if analyze_user_intent_and_screen:
                update("Executing planned action")
                return analyze_user_intent_and_screen(user_query)
            else:
                return "AI command routing is not configured."
        return "I did not hear a request"
    except Exception as e:
        print(f"Error caught inside complex cloud AI segment: {e}")
        raise
    finally:
        if rec is not None:
            rec.Reset()
        with audio_queue.mutex:
            audio_queue.queue.clear()
        time.sleep(0.2)
        print("\n🔄 Fast-Track Active. Speak scroll commands or say 'Nexus'...")

def trigger_ai_manually():
    """Manual trigger handler accessible to dashboard widgets and floating UI layouts"""
    print("Aesthetic UI Click/Trigger Registered! Dispatched to agent runtime...")
    agent_runtime.submit("Voice request", run_complex_ai_task, attempts=2)

def main_loop():
    global is_ai_processing, rec
    stop_event.clear()
    print("\n🚀 NEXUS ULTIMATE HYBRID ENGINE ACTIVE 🚀")
    print("👉 Pure Local Operations (No Quota Loss): up, down, go back, close tab, refresh, close [app]")
    print("👉 Cloud Heavyweight AI System: State wake-word 'Nexus' directly anytime.\n")
    
    if not os.path.isdir(model_path):
        raise FileNotFoundError(f"Vosk model directory not found: {model_path}")
    print("Loading offline speech recognition model...")
    rec = KaldiRecognizer(Model(model_path), 16000)
    speak("Welcome. How can I help?")

    with sd.RawInputStream(samplerate=16000, blocksize=4000, dtype='int16',
                            channels=1, callback=audio_callback):
        
        while not stop_event.is_set():
            try:
                data = audio_queue.get(timeout=0.25)
            except queue.Empty:
                continue
            
            # Context-Lock active. Ignore tracking during external active processes
            if is_ai_processing:
                with audio_queue.mutex:
                    audio_queue.queue.clear()
                continue
                
            # 1. --- FULL COMPLETED SENTENCE EXTRACTION LAYER ---
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                command = result.get("text", "").lower().strip()
                
                if not command:
                    continue
                    
                # High-Priority Guard-rail: Check if executable can be wiped locally without cloud API calls
                if handle_local_system_commands(command):
                    rec.Reset()
                    continue
                
                if "nexus" in command:
                    trigger_ai_manually()
                    continue
                    
                if any(word in command for word in ["stop engine", "kill engine", "exit system"]):
                    speak("Offline backend pipeline disengaged. Powering down.")
                    break
            else:
                # 2. --- REAL-TIME PARTIAL STREAM READING (Macros Execution Layer) ---
                partial_res = json.loads(rec.PartialResult())
                partial_command = partial_res.get("partial", "").lower().strip()
                
                if execute_local_macro(partial_command):
                    rec.Reset()


def request_shutdown():
    """Stop audio capture and prevent new manual tasks during UI shutdown."""
    stop_event.set()
    agent_runtime.shutdown()


if __name__ == "__main__":
    main_loop()