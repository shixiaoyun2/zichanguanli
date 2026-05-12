import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { 
  Scan, X, AlertCircle, Search, Plus, Settings, 
  Check, Zap, ZapOff, Sparkles, Camera, 
  RefreshCcw, Image as ImageIcon 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ScannerSettings {
  formats: Html5QrcodeSupportedFormats[];
  engine: 'default' | 'native';
}

const DEFAULT_SETTINGS: ScannerSettings = {
  formats: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.QR_CODE],
  engine: 'native'
};

const SUPPORTED_FORMATS_OPTIONS = [
  { label: '商品码 (EAN-13)', value: Html5QrcodeSupportedFormats.EAN_13 },
  { label: '二维码 (QR Code)', value: Html5QrcodeSupportedFormats.QR_CODE },
  { label: '标准128码 (Code 128)', value: Html5QrcodeSupportedFormats.CODE_128 },
  { label: '工业39码 (Code 39)', value: Html5QrcodeSupportedFormats.CODE_39 },
  { label: 'EAN-8', value: Html5QrcodeSupportedFormats.EAN_8 },
  { label: 'UPC-A', value: Html5QrcodeSupportedFormats.UPC_A },
];

export default function ScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Base State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [editableResult, setEditableResult] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // OCR & Mode State
  const [mode, setMode] = useState<'scan' | 'ocr'>('scan');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  
  // Hardware State
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  const [settings, setSettings] = useState<ScannerSettings>(() => {
    const saved = localStorage.getItem('scanner_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const isTransitioning = useRef(false);

  const stopScanner = useCallback(async () => {
    if (isTransitioning.current) {
      console.log("Scanner already transitioning, skipping stop");
      return;
    }
    
    // Check state properly using getState() if possible, or use the lib's internal flag
    if (scannerRef.current) {
      const isScanning = (scannerRef.current as any).isScanning;
      if (isScanning) {
        isTransitioning.current = true;
        try {
          await scannerRef.current.stop();
          setTorchEnabled(false);
          setIsScanning(false);
        } catch (e: any) {
          if (e?.includes && e.includes("already under transition")) {
             // Ignore this specific error as it's harmless if we're already trying to stop
          } else {
            console.warn("Soft failed to stop scanner:", e);
          }
        } finally {
          isTransitioning.current = false;
        }
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!isMounted.current || isTransitioning.current || mode !== 'scan') return;
    
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError("扫码功能需要 HTTPS 环境。");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("您的浏览器不支持摄像头访问。");
      return;
    }

    isTransitioning.current = true;
    
    try {
      // Clear container and reset state
      const container = document.getElementById('reader');
      if (container) container.innerHTML = ""; 

      setIsScanning(true);
      setError(null);
      setNotFound(false);
      setScanResult(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      // Check if it's already scanning and stop it first if so
      if ((scannerRef.current as any).isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (e) {}
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: settings.formats.length > 0 ? settings.formats : undefined,
          useBarCodeDetectorIfSupported: settings.engine === 'native'
        },
        async (decodedText) => {
          if (isMounted.current) {
            setScanResult(decodedText);
            setIsScanning(false);
            
            // Stop scanner immediately upon detection to free camera
            if (scannerRef.current && (scannerRef.current as any).isScanning) {
              isTransitioning.current = true;
              scannerRef.current.stop()
                .catch(() => {})
                .finally(() => { isTransitioning.current = false; });
            }
            
            checkAsset(decodedText);
          }
        },
        () => { /* silent */ }
      );

      try {
        const caps = scannerRef.current.getRunningTrackCapabilities();
        setTorchSupported(!!(caps && (caps as any).torch));
      } catch (e) {
        setTorchSupported(false);
      }

    } catch (err: any) {
      if (isMounted.current) {
        console.error("Scanner start error:", err);
        setError("启动失败。请检查摄像头权限或是否被占用。");
        setIsScanning(false);
      }
    } finally {
      isTransitioning.current = false;
    }
  }, [settings, mode]);

  useEffect(() => {
    isMounted.current = true;
    if (mode === 'scan') {
      const init = async () => {
        await new Promise(r => setTimeout(r, 100));
        if (isMounted.current) startScanner();
      };
      init();
    } else {
      stopScanner();
    }
    
    return () => {
      isMounted.current = false;
      // Use the stop function to respect transitions
      stopScanner();
    };
  }, [settings, startScanner, mode, stopScanner]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    const newState = !torchEnabled;
    try {
      await scannerRef.current.applyVideoConstraints({
        // @ts-ignore
        advanced: [{ torch: newState }]
      });
      setTorchEnabled(newState);
    } catch (e) {
      console.error("Failed to toggle torch", e);
    }
  };

  const [options, setOptions] = useState<any>(null);

  useEffect(() => {
    fetchOptions();
    // ... rest of init
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/assets/metadata/options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setOptions(await res.json());
    } catch (e) {}
  };

  const checkAsset = async (code: string, ocrData?: any) => {
    setError(null);
    try {
      const res = await fetch(`/api/assets/${code}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // If match found, navigate with OCR data for comparison
        navigate(`/assets/${data.id}`, { state: { ocrData } });
      } else if (res.status === 404) {
        setScanResult(code);
        setEditableResult(code);
        setNotFound(true);
        // Store the OCR data globally to pass it when "New Asset" is clicked
        (window as any).lastOcrData = ocrData;
      } else {
        setError('查询资产时出错');
      }
    } catch (err) {
      setError('网络故障，请检查连接');
    }
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      const body = new FormData();
      body.append('image', compressed);
      
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body
      });

      if (res.ok) {
        const data = await res.json();
        if (data.asset_code) {
          checkAsset(data.asset_code, data);
        } else {
          setError('未能识别到有效的资产编码');
        }
      } else {
        const errData = await res.json();
        setError(`AI 识别失败: ${errData.error || '服务器错误'}`);
      }
    } catch (err) {
      setError('处理识别时出现异常');
    } finally {
      setIsOcrProcessing(false);
      if (ocrFileInputRef.current) ocrFileInputRef.current.value = '';
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Compression failed'));
          }, 'image/jpeg', 0.8);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleManualSearch = () => {
    if (editableResult) navigate(`/assets?search=${editableResult}`);
  };

  const handleRetrySearch = () => {
    setNotFound(false);
    checkAsset(editableResult);
  };

  const saveSettings = (newSettings: ScannerSettings) => {
    setSettings(newSettings);
    localStorage.setItem('scanner_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <style>{`
        #reader { border: none !important; border-radius: 1.5rem; overflow: hidden; }
        #reader video { border-radius: 1.5rem; object-fit: cover; width: 100% !important; height: 100% !important; }
      `}</style>
      
      <div className="text-center relative">
        <h1 className="text-2xl font-bold text-gray-900">资产核查</h1>
        <p className="text-sm text-gray-500 mt-1">
          识别资产标签进行快速核查 {options?.currentModel && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-mono ml-1">AI: {options.currentModel}</span>}
        </p>
        
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition-colors"
          type="button"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setMode('scan')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
            mode === 'scan' ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"
          )}
        >
          <Scan className="h-4 w-4" />
          条码/二维码
        </button>
        <button 
          onClick={() => setMode('ocr')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
            mode === 'ocr' ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"
          )}
        >
          <Sparkles className="h-4 w-4" />
          AI 智能识别
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative min-h-[340px] flex items-center justify-center">
        {mode === 'scan' ? (
          <div id="reader" className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden relative z-0"></div>
        ) : (
          <div className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 relative z-0">
            <div className="bg-indigo-100 p-6 rounded-full mb-6 text-indigo-600">
              <Camera className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">拍照识别资产信息</h3>
            <p className="text-sm text-gray-500 text-center mb-8 px-4">支持识别残缺标签、手写文字或异形编码，利用 AI 理解图片内容。</p>
            <button 
              onClick={() => ocrFileInputRef.current?.click()}
              disabled={isOcrProcessing}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {isOcrProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                  智能处理中...
                </div>
              ) : (
                <><Camera className="h-5 w-5" />拍照识别</>
              )}
            </button>
            <input type="file" ref={ocrFileInputRef} onChange={handleOcrFileChange} accept="image/*" capture="environment" className="hidden" />
          </div>
        )}

        {/* Scan Overlays */}
        {mode === 'scan' && isScanning && (
          <>
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none z-10 rounded-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-indigo-400/50 rounded-2xl pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[scan_2s_infinite]" />
            </div>
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={cn(
                  "absolute top-8 right-8 z-20 p-3 rounded-full backdrop-blur-md transition-all",
                  torchEnabled ? "bg-yellow-400 text-white shadow-lg" : "bg-black/20 text-white"
                )}
              >
                {torchEnabled ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
              </button>
            )}
          </>
        )}

        {/* Status Overlays */}
        <AnimatePresence>
          {(isOcrProcessing || (!isScanning && scanResult && !notFound && !error)) && (
             <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center p-8 text-center rounded-3xl"
             >
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4" />
                <p className="font-bold text-gray-900">{isOcrProcessing ? 'AI 正在分析图片' : '识别成功'}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {isOcrProcessing ? '正在理解标签内容，请稍候...' : `正在查询资产库: ${scanResult}`}
                </p>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mode === 'scan' && (
        <div className="flex justify-center flex-col items-center gap-4">
          <button 
            onClick={isScanning ? stopScanner : startScanner}
            className={cn(
              "px-8 py-4 rounded-2xl text-base font-bold shadow-lg transition-all active:scale-95 min-w-[200px]",
              isScanning ? "bg-white border-2 border-gray-200 text-gray-600" : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {isScanning ? "停止扫码" : "开始扫码"}
          </button>
          <button onClick={() => ocrFileInputRef.current?.click()} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1.5 py-2">
            <ImageIcon className="h-4 w-4" />
            或从相册上传图片识别
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={mode === 'scan' ? startScanner : () => ocrFileInputRef.current?.click()} className="underline text-xs font-bold shrink-0">重试</button>
        </motion.div>
      )}

      {/* Not Found Modal */}
      <AnimatePresence>
        {notFound && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNotFound(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
              <div className="bg-amber-50 p-4 rounded-full w-fit mx-auto mb-4 border border-amber-100 text-amber-600">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">未找到资产</h3>
              <p className="text-sm text-gray-500 mt-2 mb-6">数据库中未匹配到此编码。您可以手动修正识别结果后重试。</p>
              
              <div className="mb-8 text-left">
                <label className="block text-[11px] font-bold text-indigo-500 mb-1.5 ml-1">识别结果 (点击修改)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" value={editableResult} onChange={(e) => setEditableResult(e.target.value)}
                    className="flex-1 px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-mono font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none"
                    placeholder="输入编码"
                  />
                  <button onClick={handleRetrySearch} disabled={!editableResult} className="px-4.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 active:scale-90 transition-all disabled:opacity-50">
                    <RefreshCcw className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => navigate(`/assets/new?code=${editableResult}`, { state: { ocrData: (window as any).lastOcrData } })}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                >
                  <Plus className="h-5 w-5" />以此编码新增资产
                </button>
                <button onClick={handleManualSearch} className="w-full py-3.5 text-indigo-700 font-bold text-sm bg-indigo-50 rounded-2xl">
                  手动搜索资产列表
                </button>
                <button onClick={() => setNotFound(false)} className="w-full py-2 text-gray-400 text-sm font-medium mt-2">
                  返回
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-7 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">核查设置</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors" type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-7">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 ml-1">识别条码格式</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto px-1 custom-scrollbar">
                    {SUPPORTED_FORMATS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const newFormats = settings.formats.includes(option.value)
                            ? settings.formats.filter(f => f !== option.value)
                            : [...settings.formats, option.value];
                          setSettings({ ...settings, formats: newFormats });
                        }}
                        className={cn(
                          "flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium transition-all border-2",
                          settings.formats.includes(option.value)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {option.label}
                        {settings.formats.includes(option.value) && <Check className="h-4 w-4 stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2.5 ml-1">🔒 提示：只勾选目前需要识别的格式，可极大提高识别率和防误触</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 ml-1">解码引擎</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'default', label: 'Zxing (全能模式)', sub: '兼容性最好' },
                      { id: 'native', label: 'Native (极速模式)', sub: '浏览器原生' }
                    ].map((engine) => (
                      <button
                        key={engine.id}
                        type="button"
                        onClick={() => setSettings({ ...settings, engine: engine.id as any })}
                        className={cn(
                          "flex-1 py-3 px-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-0.5",
                          settings.engine === engine.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-gray-50 border-gray-100 text-gray-500"
                        )}
                      >
                        <span className="text-[11px] font-bold">{engine.label}</span>
                        <span className={cn("text-[9px] opacity-70", settings.engine === engine.id ? "text-white" : "text-gray-400")}>{engine.sub}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2.5 ml-1">💡 推荐：优先尝试 Native 模式，失效时切换 Zxing</p>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => saveSettings(settings)} 
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                    type="button"
                  >
                    保存并重启扫描器
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
      `}</style>
    </div>
  );
}
