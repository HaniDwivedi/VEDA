"""Handle Windows text-to-speech and optional Groq speech transcription."""
import math
import os
import struct
import sys
import tempfile
import wave
from pathlib import Path

import pyaudio
import pyttsx3
from dotenv import load_dotenv
from groq import Groq

APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) \
    else Path(__file__).resolve().parent
load_dotenv(APP_DIR / ".env")

groq_key = os.getenv("nexus_ear")
client = Groq(api_key=groq_key) if groq_key else None

FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024


def speak(text: str) -> None:
    if not text.strip():
        return
    try:
        engine = pyttsx3.init("sapi5")
        engine.setProperty("volume", 1.0)
        engine.setProperty("rate", 185)
        voices = engine.getProperty("voices")
        if voices:
            engine.setProperty("voice", voices[0].id)
        engine.say(text)
        engine.runAndWait()
        engine.stop()
    except Exception as error:
        print(f"Text-to-speech failed: {error}", file=sys.stderr)


def record_audio(
    max_duration: int = 30,
    silence_duration: float = 2.0,
    silence_threshold: int = 500,
) -> str:
    """Record speech to a temporary WAV file and return its path."""
    audio = pyaudio.PyAudio()
    stream = None
    frames = []
    try:
        stream = audio.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK,
        )
        speech_started = False
        silent_chunks = 0
        max_chunks = int(RATE / CHUNK * max_duration)
        silence_chunks = max(1, int(RATE / CHUNK * silence_duration))

        for _ in range(max_chunks):
            data = stream.read(CHUNK, exception_on_overflow=False)
            frames.append(data)
            samples = struct.unpack_from(f"<{len(data) // 2}h", data)
            rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
            if rms >= silence_threshold:
                speech_started = True
                silent_chunks = 0
            elif speech_started:
                silent_chunks += 1
                if silent_chunks >= silence_chunks:
                    break

        sample_width = audio.get_sample_size(FORMAT)
    finally:
        if stream is not None:
            stream.stop_stream()
            stream.close()
        audio.terminate()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
        temp_path = temp_audio.name
    try:
        with wave.open(temp_path, "wb") as wav_file:
            wav_file.setnchannels(CHANNELS)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(RATE)
            wav_file.writeframes(b"".join(frames))
    except Exception:
        os.remove(temp_path)
        raise
    return temp_path


def listen_live_groq(prompt_msg: str = "Speak now...") -> str:
    """Transcribe one bounded speech recording with Groq Whisper."""
    print(prompt_msg)
    if client is None:
        raise RuntimeError("Set nexus_ear in the desktop .env file to enable cloud speech.")

    audio_path = record_audio()
    try:
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(Path(audio_path).name, audio_file.read()),
                model="whisper-large-v3",
                prompt="Nexus, LeetCode, Hinglish, coding, loop, array, scroll down, upar karo, niche karo",
            )
        return transcription.text.strip()
    except Exception as error:
        raise RuntimeError("Groq speech transcription failed.") from error
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
