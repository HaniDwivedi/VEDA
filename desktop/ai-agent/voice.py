"""Handle Windows text-to-speech and optional Groq speech transcription."""
import json
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
from vosk import KaldiRecognizer, Model

APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) \
    else Path(__file__).resolve().parent
RESOURCE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
VOSK_MODEL_PATH = RESOURCE_DIR / "model" / "vosk-model-small-en-in-0.4"
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
    max_duration: int = 60,
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


def get_groq_client():
    return client


def _transcribe_vosk(audio_path: str) -> str:
    if not VOSK_MODEL_PATH.is_dir():
        raise FileNotFoundError(f"Vosk model directory not found: {VOSK_MODEL_PATH}")

    segments = []
    with wave.open(audio_path, "rb") as wav_file:
        if wav_file.getnchannels() != CHANNELS or wav_file.getsampwidth() != 2 or \
                wav_file.getframerate() != RATE:
            raise ValueError("Recorded audio format is not supported by the local speech model.")

        recognizer = KaldiRecognizer(Model(str(VOSK_MODEL_PATH)), RATE)
        while data := wav_file.readframes(4000):
            if recognizer.AcceptWaveform(data):
                segments.append(json.loads(recognizer.Result()).get("text", ""))
        segments.append(json.loads(recognizer.FinalResult()).get("text", ""))
    return " ".join(segment for segment in segments if segment).strip()


def listen_live(prompt_msg: str = "Speak now...") -> str:
    """Transcribe one bounded recording with Groq, falling back to local Vosk."""
    print(prompt_msg)
    audio_path = record_audio()
    try:
        if client is not None:
            try:
                with open(audio_path, "rb") as audio_file:
                    transcription = client.audio.transcriptions.create(
                        file=(Path(audio_path).name, audio_file.read()),
                        model="whisper-large-v3",
                        prompt="Nexus, LeetCode, Hinglish, coding, loop, array, scroll down, upar karo, niche karo",
                    )
                return transcription.text.strip()
            except Exception as error:
                print(f"Groq transcription failed; trying local Vosk: {error}", file=sys.stderr)
        return _transcribe_vosk(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
