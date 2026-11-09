"""Render the floating Nexus widget and connect voice and paired-device agents."""
import os
import sys
from pathlib import Path

import customtkinter as ctk
import threading
from dotenv import load_dotenv

APP_DIR = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).parent
load_dotenv(APP_DIR / ".env")

import main
from remote_bridge import RemoteAgentBridge

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

class NexusWidget(ctk.CTk):
    def __init__(self):
        super().__init__()
        server_url = os.getenv("VEDA_SERVER_URL", "http://localhost:5000")
        allowed_origins = {
            origin.strip()
            for origin in os.getenv(
                "VEDA_DESKTOP_ORIGINS",
                "http://localhost:5173,http://localhost:5174,http://localhost:3000",
            ).split(",")
            if origin.strip()
        }
        self.remote_bridge = RemoteAgentBridge(server_url, allowed_origins)
        self.remote_bridge.start()

        # Window Settings (Futuristic Compact Floating Panel)
        self.title("ZR Nexus")
        self.geometry("280x90+50+50") 
        self.overrideredirect(True) # Removes window borders and standard title bar
        self.wm_attributes("-topmost", True) # Keep floating widget always on top
        self.config(bg='#1A1A1A') 
        
        # Window Dragging Logic (Screen par mouse se kahi bhi move karne ke liye)
        self.bind("<Button-1>", self.start_drag)
        self.bind("<B1-Motion>", self.drag_window)

        # Main Frame Design (Cyber-Industrial Black with Premium Gold Border)
        self.main_frame = ctk.CTkFrame(self, fg_color="#0A0A0A", border_color="#D4AF37", border_width=1.5, corner_radius=15)
        self.main_frame.pack(fill="both", expand=True, padx=3, pady=3)

        # Status Indicator Light (Real-time state glowing dot)
        self.status_light = ctk.CTkLabel(self.main_frame, text="●", font=("Consolas", 18), text_color="#2ECC71")
        self.status_light.place(x=15, y=12)

        # Title Label (Zerythron Ecosystem Minimalist Branding)
        self.title_label = ctk.CTkLabel(self.main_frame, text="NEXUS HYBRID", font=("Segoe UI", 12, "bold"), text_color="#FFFFFF")
        self.title_label.place(x=38, y=10)

        # Dynamic Status Text Line
        self.status_label = ctk.CTkLabel(self.main_frame, text="System Online | Fast-Track Active", font=("Consolas", 10), text_color="#A0A0A0")
        self.status_label.place(x=15, y=35)

        # Quick Manual Trigger Button
        self.mic_btn = ctk.CTkButton(
            self.main_frame, 
            text="🎙️ Tap", 
            width=70, 
            height=26, 
            corner_radius=8,
            fg_color="#1E3F20", # Deep Matrix Green
            hover_color="#2A5C2D", 
            text_color="#D4AF37", # Matte Gold
            font=("Segoe UI", 10, "bold"),
            command=self.manual_trigger
        )
        self.mic_btn.place(x=190, y=10)

        # Close Button
        self.close_btn = ctk.CTkButton(
            self.main_frame, text="×", width=20, height=20, fg_color="transparent", 
            hover_color="#FF4D4D", text_color="#888888", font=("Arial", 12), command=self.quit_widget
        )
        self.close_btn.place(x=250, y=50)

        self.after(200, self.monitor_state)

    def start_drag(self, event):
        self.x = event.x
        self.y = event.y

    def drag_window(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.winfo_x() + deltax
        y = self.winfo_y() + deltay
        self.geometry(f"+{x}+{y}")

    def manual_trigger(self):
        """Main module ke naye structural handler ko safely trigger karega"""
        main.trigger_ai_manually()

    def monitor_state(self):
        """Update Tk widgets on Tk's own event loop from agent task state."""
        status = main.get_agent_status()
        if status["state"] in {"queued", "running", "retrying"}:
            self.status_light.configure(text_color="#F39C12")
            self.status_label.configure(text=f"{status['state'].title()}: {status['detail'][:32]}", text_color="#F39C12")
            self.mic_btn.configure(state="disabled", fg_color="#3A3A3A")
        elif status["state"] == "failed":
            self.status_light.configure(text_color="#E74C3C")
            self.status_label.configure(text=f"Failed: {status['detail'][:30]}", text_color="#E74C3C")
            self.mic_btn.configure(state="normal", fg_color="#1E3F20")
        else:
            self.status_light.configure(text_color="#2ECC71")
            self.status_label.configure(text="Ready | Say 'Nexus'", text_color="#A0A0A0")
            self.mic_btn.configure(state="normal", fg_color="#1E3F20")
        self.after(200, self.monitor_state)

    def quit_widget(self):
        self.remote_bridge.stop()
        main.request_shutdown()
        self.destroy()


def run_backend():
    try:
        main.main_loop()
    except Exception as error:
        main.report_engine_failure(error)

if __name__ == "__main__":
    print("🚀 Starting Nexus with Floating Widget...")
    
    # Background Thread me core engine (Vosk listening state) call kiya
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    backend_thread.start()
    
    # CustomTkinter UI loop block window initialize
    app = NexusWidget()
    app.mainloop()

    