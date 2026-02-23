/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Image as ImageIcon, 
  Eraser, 
  Sparkles, 
  Download, 
  RotateCcw, 
  Layers,
  Check,
  Loader2,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Gemini API setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface EditHistory {
  id: string;
  url: string;
  timestamp: number;
}

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bgPrompt, setBgPrompt] = useState('');
  const [history, setHistory] = useState<EditHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setOriginalImage(reader.result as string);
        setProcessedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const processImage = async (mode: 'remove' | 'replace', customPrompt?: string) => {
    if (!originalImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64Data = originalImage.split(',')[1];
      const mimeType = originalImage.split(';')[0].split(':')[1];

      const activePrompt = customPrompt || bgPrompt;
      const prompt = mode === 'remove' 
        ? "Remove the background from this image. Keep only the main subject. Return the image with a clean, solid white background."
        : `Remove the background from this image and replace it with a professional background based on this description: ${activePrompt}. Ensure the lighting on the subject matches the new background.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const newImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setProcessedImage(newImageUrl);
          setHistory(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            url: newImageUrl,
            timestamp: Date.now()
          }, ...prev]);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("No image was generated. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = `lumina-edit-${Date.now()}.png`;
    link.click();
  };

  const reset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setBgPrompt('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-[#D2D2D7]/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Lumina Studio</h1>
        </div>
        
        {originalImage && (
          <button 
            onClick={reset}
            className="text-sm font-medium text-[#0066CC] hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor */}
        <div className="lg:col-span-8 space-y-6">
          {!originalImage ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "aspect-[4/3] w-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer group",
                isDragActive ? "border-[#0066CC] bg-blue-50/50" : "border-[#D2D2D7] bg-white hover:border-[#86868B]"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-[#F5F5F7] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-[#86868B] w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Drop your photo here</p>
              <p className="text-[#86868B] text-sm mt-1">or click to browse files</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] w-full bg-[#E8E8ED] rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={processedImage || originalImage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    src={processedImage || originalImage} 
                    className="max-w-full max-h-full object-contain"
                    alt="Preview"
                  />
                </AnimatePresence>
                
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-[#0066CC] animate-spin mb-4" />
                    <p className="text-lg font-medium animate-pulse">Enhancing your image...</p>
                  </div>
                )}

                {processedImage && !isProcessing && (
                  <div className="absolute bottom-6 right-6 flex gap-2">
                    <button 
                      onClick={downloadImage}
                      className="bg-black text-white px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-[#1D1D1F] transition-colors shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
              </div>

              {/* Comparison Toggle (Simple) */}
              {processedImage && (
                <div className="flex justify-center gap-4">
                  <button 
                    onMouseDown={() => setProcessedImage(null)}
                    onMouseUp={() => setProcessedImage(processedImage)}
                    className="text-xs font-semibold uppercase tracking-widest text-[#86868B] hover:text-black transition-colors"
                  >
                    Hold to see original
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3">
              <X className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-[#D2D2D7]/30">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Edit Tools
            </h2>

            <div className="space-y-4">
              <button 
                disabled={!originalImage || isProcessing}
                onClick={() => processImage('remove')}
                className="w-full group flex items-center justify-between p-4 rounded-2xl bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Eraser className="w-5 h-5 text-[#0066CC]" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Remove Background</p>
                    <p className="text-xs text-[#86868B]">Isolate the subject</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#D2D2D7] group-hover:text-[#86868B] transition-colors" />
              </button>

              <div className="pt-4 border-t border-[#D2D2D7]/30">
                <label className="block text-sm font-medium text-[#86868B] mb-2 px-1">
                  Presets
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { name: 'Studio White', prompt: 'Clean professional studio background, pure white, soft shadows' },
                    { name: 'Modern Office', prompt: 'Blurred modern office interior, bright natural light, professional' },
                    { name: 'Nature Park', prompt: 'Beautiful sunny park background, soft bokeh, green trees' },
                    { name: 'Cyberpunk', prompt: 'Neon city at night, futuristic vibes, purple and blue lighting' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setBgPrompt(preset.prompt);
                        processImage('replace', preset.prompt);
                      }}
                      disabled={!originalImage || isProcessing}
                      className="text-xs font-medium p-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-transparent hover:border-[#D2D2D7] transition-all text-left"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-medium text-[#86868B] mb-2 px-1">
                  Custom Background
                </label>
                <textarea 
                  value={bgPrompt}
                  onChange={(e) => setBgPrompt(e.target.value)}
                  placeholder="e.g. Minimalist marble surface with soft sunlight..."
                  className="w-full p-4 rounded-2xl bg-[#F5F5F7] border-none focus:ring-2 focus:ring-[#0066CC] transition-all resize-none h-24 text-sm"
                  disabled={!originalImage || isProcessing}
                />
                <button 
                  disabled={!originalImage || isProcessing || !bgPrompt.trim()}
                  onClick={() => processImage('replace')}
                  className="w-full mt-3 bg-[#0066CC] text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-[#0071E3] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Scene
                </button>
              </div>
            </div>
          </section>

          {/* History */}
          {history.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4 px-1">
                Recent Edits
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {history.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setProcessedImage(item.url)}
                    className="aspect-square rounded-xl overflow-hidden border border-[#D2D2D7]/30 hover:border-[#0066CC] transition-all group relative"
                  >
                    <img src={item.url} className="w-full h-full object-cover" alt="History item" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Tips */}
          <section className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100/50">
            <h4 className="text-sm font-semibold text-[#0066CC] mb-2">Pro Tip</h4>
            <p className="text-xs text-[#0066CC]/80 leading-relaxed">
              For best results, use high-resolution photos with clear subjects. 
              When replacing backgrounds, describe the lighting and texture for a more realistic blend.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#D2D2D7]/30 text-center">
        <p className="text-sm text-[#86868B]">
          Powered by Gemini 2.5 Flash • Free for everyone, every time.
        </p>
      </footer>
    </div>
  );
}
