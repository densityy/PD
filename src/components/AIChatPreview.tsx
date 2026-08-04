import { Send, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface AIChatPreviewProps {
  onSend?: (message: string) => void;
}

const SAMPLE_EXCHANGE = [
  { sender: 'ai', text: 'Hei! Jeg er Nora, din AI-tannlegereisjonist. Hva kan jeg hjelpe deg med i dag?' },
  { sender: 'patient', text: 'Hei, jeg har hatt vondt i en tann siden i går. Det verker veldig.' },
  { sender: 'ai', text: 'Beklager å høre det! Kan du beskrive smerten litt nærmere? Er det konstant smerte, eller kommer og går den?' },
  { sender: 'patient', text: 'Den er ganske konstant, og det er vondt å bite.' },
  { sender: 'ai', text: 'Det høres ut som at du bør se en tannlege ganske snart. Basert på symptomene dine vil jeg anbefale deg til Tannklinikken Sentrum — de har ledig time i dag. Vil du at jeg booker det for deg?' },
];

export default function AIChatPreview({ onSend }: AIChatPreviewProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(SAMPLE_EXCHANGE);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { sender: 'patient', text: input.trim() }]);
    onSend?.(input.trim());
    setInput('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Takk for meldingen! Jeg videresender dette til vår klinikkpartner og følger opp med deg innen kort tid.',
        },
      ]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* AI Character header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#0d1e3d] to-[#143a6e] rounded-t-2xl">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#14c8d4]/50 flex-shrink-0">
            <img
              src="/logo_web.png"
              alt="Pia AI"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-white font-semibold text-sm">Nora</p>
            <Sparkles size={12} className="text-[#14c8d4]" />
          </div>
          <p className="text-white/50 text-xs">AI-resepsjonist · Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.sender === 'ai' && (
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 mt-auto">
                <img src="/logo_web.png" alt="Pia" className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className={`max-w-[80%] text-xs px-3 py-2 rounded-2xl leading-relaxed ${
                msg.sender === 'ai'
                  ? 'bg-white text-gray-700 rounded-bl-sm shadow-sm border border-gray-100'
                  : 'bg-[#14c8d4] text-white rounded-br-sm shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100 rounded-b-2xl">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-[#14c8d4] transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Skriv en testmelding..."
            className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-6 h-6 bg-[#14c8d4] rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-[#0fb3be] transition-colors"
          >
            <Send size={12} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
