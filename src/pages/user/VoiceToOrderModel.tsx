import { useEffect, useRef, useState } from 'react';
import { Mic, X, Upload } from 'lucide-react';
import { Product } from '../../lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onAddItems: (items: { product: Product; quantity: number }[]) => void;
}

const numberMap: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export default function VoiceToOrderModal({ open, onClose, products, onAddItems }: Props) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition for live mic
  useEffect(() => {
    if (!open) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(' ');
      setText(transcript.toLowerCase());
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
  }, [open]);

  // Start live microphone speech
  const startListening = () => {
    if (!recognitionRef.current) return;
    setText('');
    setListening(true);
    recognitionRef.current.start();
  };

  // Parse transcript to cart items
  const parseOrder = () => {
    const cleanText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  
    // Split orders by 'and'
    const parts = cleanText.split(/\band\b|,/);
  
    const results: { product: Product; quantity: number }[] = [];
  
    parts.forEach((part) => {
      const words = part.trim().split(' ');
  
      if (!words.length) return;
  
      // Detect quantity
      let quantity = 1;
  
      words.forEach((w) => {
        if (!isNaN(Number(w))) quantity = Number(w);
        if (numberMap[w]) quantity = numberMap[w];
      });
  
      // Remove quantity words
      const productWords = words.filter(
        (w) => isNaN(Number(w)) && !numberMap[w]
      );
  
      const productText = productWords.join(' ');
  
      // Fuzzy match product
      let bestMatch: Product | null = null;
      let bestScore = 0;
  
      products.forEach((product) => {
        const name = product.name.toLowerCase();
  
        let score = 0;
  
        productWords.forEach((pw) => {
          if (name.includes(pw)) score++;
        });
  
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      });
  
      if (bestMatch) {
        results.push({ product: bestMatch, quantity });
      }
    });
  
    if (results.length === 0) {
      alert('No matching product found');
      return;
    }
  
    onAddItems(results);
    onClose();
  };

  // Handle voice file upload
  const handleVoiceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setText('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];

      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64 }),
        });

        const data = await res.json();
        if (data.transcript) setText(data.transcript.toLowerCase());
        else alert('Failed to transcribe voice file');
      } catch (err) {
        console.error(err);
        alert('Error uploading file');
      } finally {
        setLoading(false);
      }
    };
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X />
        </button>

        <h2 className="text-xl font-bold mb-4">🎤 Voice to Order</h2>

        {/* Transcript display */}
        <div className="border rounded-lg p-3 mb-4 min-h-[60px] text-gray-700 bg-gray-50">
          {loading
            ? 'Transcribing...'
            : text || (listening ? '🎧 Listening...' : 'Click Start or Upload a voice file')}
        </div>

        {/* Start Speaking */}
        <button
          onClick={startListening}
          disabled={listening}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition mb-3"
        >
          <Mic />
          {listening ? 'Listening...' : 'Start Speaking'}
        </button>

        {/* Upload voice file */}
        <label className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-800 py-3 rounded-lg cursor-pointer hover:bg-gray-300 transition mb-3">
          <Upload />
          Upload Voice File
          <input type="file" accept="audio/*" onChange={handleVoiceFile} className="hidden" />
        </label>

        {/* Create Order */}
        <button
          onClick={parseOrder}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          🛒 Create Order
        </button>
      </div>
    </div>
  );
}
