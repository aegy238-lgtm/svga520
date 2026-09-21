import { MessageCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function WhatsAppWidget() {
  const { whatsappNumber } = useStore();
  
  // Clean the number for the WhatsApp link (remove spaces, plus, dashes, etc.)
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  
  return (
    <a 
      href={`https://wa.me/${cleanNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 hover:bg-[#1ebe57] transition-all duration-300 flex items-center justify-center"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-8 h-8" />
      <span className="absolute -top-2 -right-2 flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
      </span>
    </a>
  );
}
