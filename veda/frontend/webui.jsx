// Render the VEDA landing page and report APK generation only when backend supports it.
import React from 'react';

export default function WebUI() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
        
        .ambient-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle at center, rgba(79, 70, 229, 0.15) 0%, rgba(0,0,0,0) 60%);
            z-index: 0;
            pointer-events: none;
        }

        .scene { width: 200px; height: 200px; perspective: 800px; margin: 0 auto; }
        .cube { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; animation: rotate4D 12s infinite linear; }
        .cube-inner { width: 50%; height: 50%; position: absolute; top: 25%; left: 25%; transform-style: preserve-3d; animation: rotate4DReverse 8s infinite linear; }
        .face { position: absolute; width: 200px; height: 200px; background: rgba(99, 102, 241, 0.05); border: 2px solid rgba(99, 102, 241, 0.8); box-shadow: 0 0 20px rgba(99, 102, 241, 0.5), inset 0 0 20px rgba(99, 102, 241, 0.5); }
        .face-inner { position: absolute; width: 100px; height: 100px; background: rgba(236, 72, 153, 0.05); border: 2px solid rgba(236, 72, 153, 0.8); box-shadow: 0 0 15px rgba(236, 72, 153, 0.5), inset 0 0 15px rgba(236, 72, 153, 0.5); }
        
        .front  { transform: rotateY(0deg) translateZ(100px); }
        .back   { transform: rotateY(180deg) translateZ(100px); }
        .right  { transform: rotateY(90deg) translateZ(100px); }
        .left   { transform: rotateY(-90deg) translateZ(100px); }
        .top    { transform: rotateX(90deg) translateZ(100px); }
        .bottom { transform: rotateX(-90deg) translateZ(100px); }
        
        .in-front  { transform: rotateY(0deg) translateZ(50px); }
        .in-back   { transform: rotateY(180deg) translateZ(50px); }
        .in-right  { transform: rotateY(90deg) translateZ(50px); }
        .in-left   { transform: rotateY(-90deg) translateZ(50px); }
        .in-top    { transform: rotateX(90deg) translateZ(50px); }
        .in-bottom { transform: rotateX(-90deg) translateZ(50px); }

        @keyframes rotate4D {
            0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
            100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
        }
        @keyframes rotate4DReverse {
            0% { transform: rotateX(360deg) rotateY(0deg) rotateZ(360deg); }
            100% { transform: rotateX(0deg) rotateY(360deg) rotateZ(0deg); }
        }

        .particles {
            position: absolute;
            width: 100%;
            height: 100%;
            z-index: 0;
            background-image: 
                radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 1px, transparent 1px),
                radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.15) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: moveParticles 20s infinite linear;
        }
        @keyframes moveParticles {
            0% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.05); }
            100% { transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Animated Background */}
      <div className="ambient-glow"></div>
      <div className="particles"></div>

      {/* Main Container */}
      <main className="container relative z-10 mx-auto px-6 py-12 flex flex-col-reverse lg:flex-row items-center justify-between gap-16 lg:gap-8">
        
        {/* Left: Text & Download Buttons */}
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DESKTOP AGENT · MOBILE CONTROLLER
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight">
            Secure. Smart. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">
              Ecosystem.
            </span>
          </h1>

          <p className="text-gray-400 text-lg max-w-lg leading-relaxed">
            Keep automation on your laptop, then use your phone as a secure screen and input controller on the same network.
          </p>

          <div className="flex flex-col sm:flex-row w-full gap-4 mt-6">
            
            {/* Desktop Download */}
            <a
              id="desktop-download"
              href="https://github.com/HaniDwivedi/VEDA/releases/latest/download/VEDA-Desktop-Setup-1.0.10.exe"
              className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.7)] hover:-translate-y-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] uppercase tracking-wider opacity-75 leading-none">Latest release</span>
                <span className="text-lg leading-tight">Windows x64 (.exe)</span>
              </div>
            </a>

            {/* Android APK Download */}
            <a
              id="android-download"
              href="https://github.com/HaniDwivedi/VEDA/releases/latest/download/app-debug.apk"
              className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-gray-900 border border-gray-700 rounded-2xl font-semibold transition-all duration-300 hover:border-pink-400 hover:-translate-y-1"
            >
              <svg className="w-6 h-6 text-gray-300 group-hover:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] uppercase tracking-wider opacity-75 leading-none text-gray-400">Latest release</span>
                <span className="text-lg leading-tight text-white">Android APK (.apk)</span>
              </div>
            </a>

          </div>

          <p className="text-xs text-gray-600 font-mono mt-4">The APK is published with each VEDA release.</p>
        </div>

        {/* Right: 4D Animation */}
        <div className="w-full lg:w-1/2 flex justify-center items-center h-[300px] lg:h-[500px]">
          <div className="scene">
            <div className="cube">
              <div className="face front"></div>
              <div className="face back"></div>
              <div className="face right"></div>
              <div className="face left"></div>
              <div className="face top"></div>
              <div className="face bottom"></div>
              <div className="cube-inner">
                <div className="face-inner in-front"></div>
                <div className="face-inner in-back"></div>
                <div className="face-inner in-right"></div>
                <div className="face-inner in-left"></div>
                <div className="face-inner in-top"></div>
                <div className="face-inner in-bottom"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-6 w-full text-center text-xs text-gray-600">
        &copy; 2026 V.E.D.A. Desktop automation stays on your computer.
      </footer>
    </div>
  );
}