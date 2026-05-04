import React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export default function MessageModal({ isOpen, onClose, title, message, type = 'info' }: MessageModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'error': return <AlertCircle className="h-6 w-6 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      default: return <Info className="h-6 w-6 text-indigo-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'success': return "bg-green-600 hover:bg-green-700 shadow-green-100";
      case 'error': return "bg-red-600 hover:bg-red-700 shadow-red-100";
      case 'warning': return "bg-amber-600 hover:bg-amber-700 shadow-amber-100";
      default: return "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full text-gray-400"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-3 bg-gray-50 rounded-2xl">
                {getIcon()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{message}</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className={cn(
                "w-full py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95",
                getButtonClass()
              )}
            >
              确定
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
