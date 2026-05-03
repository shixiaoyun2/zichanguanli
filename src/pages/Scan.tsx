import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Scan, X, AlertCircle, Search, Plus, Settings, Check, Zap, ZapOff } from 'lucide-react';
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
    if (isTransitioning.current) return;
    if (scannerRef.current && (scannerRef.current as any).isScanning) {
      isTransitioning.current = true;
      try {
        await scannerRef.current.stop();
        setTorchEnabled(false);
      } catch (e) {
        console.warn("Soft failed to stop scanner (likely already stopping):", e);
      } finally {
        isTransitioning.current = false;
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!isMounted.current || isTransitioning.current) return;
    
    // 1. 环境安全检查 (Camera requires HTTPS or localhost)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError("扫码功能需要 HTTPS 环境。请确保您的网站已配置 SSL 证书，或在本地使用 localhost 访问。");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("您的浏览器不支持或禁用了摄像头访问 API。");
      return;
    }

    isTransitioning.current = true;
    
    try {
      // 1. Ensure any existing scanner is physically stopped
      if (scannerRef.current && (scannerRef.current as any).isScanning) {
        await scannerRef.current.stop();
      }

      // 2. Clear container to prevent DOM conflicts
      const container = document.getElementById('reader');
      if (container) container.innerHTML = ""; 

      // 3. Clear state
      setIsScanning(true);
      setError(null);
      setNotFound(false);
      setScanResult(null);

      // 4. New instance if needed
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
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
          // Success case
          if (scannerRef.current && (scannerRef.current as any).isScanning) {
            await scannerRef.current.stop();
          }
          if (isMounted.current) {
            setScanResult(decodedText);
            setIsScanning(false);
            checkAsset(decodedText);
          }
        },
        () => { /* ignore silent failure during scan */ }
      );

      // Check torch support
      try {
        const caps = scannerRef.current.getRunningTrackCapabilities();
        if (caps && (caps as any).torch) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch (e) {
        setTorchSupported(false);
      }

    } catch (err: any) {
      console.error("Scanner start error:", err);
      const errMsg = err?.toString() || "";
      if (errMsg.includes("NotAllowedError")) {
         setError("摄像头权限被拒绝，请检查浏览器权限设置。");
      } else if (errMsg.includes("NotFoundError")) {
         setError("未找到摄像头设备，请确保已连接。");
      } else if (errMsg.includes("NotSupportedError") || errMsg.includes("not supported")) {
         setError("浏览器版本过低或处于不安全环境（需要 HTTPS）。");
      } else {
         setError("启动失败。请刷新重试或检查摄像头是否被占用。");
      }
      setIsScanning(false);
    } finally {
      isTransitioning.current = false;
    }
  }, [settings, navigate]);

  useEffect(() => {
    isMounted.current = true;
    
    const init = async () => {
      // Delay slightly to ensure DOM is ready and previous effect's stop is processed
      await new Promise(r => setTimeout(r, 100));
      if (isMounted.current) {
        startScanner();
      }
    };
    
    init();
    
    return () => {
      isMounted.current = false;
      // We don't await stop in cleanup as it's fire-and-forget for unmount
      if (scannerRef.current && (scannerRef.current as any).isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [settings, startScanner]);

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

  const saveSettings = (newSettings: ScannerSettings) => {
    setSettings(newSettings);
    localStorage.setItem('scanner_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const checkAsset = async (code: string) => {
    try {
      const res = await fetch(`/api/assets/${code}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        navigate(`/assets/${data.id}`);
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setError('查询资产时出错');
      }
    } catch (err) {
      setError('网络故障，请检查您的连接');
    }
  };

  const handleManualSearch = () => {
    if (scanResult) {
       navigate(`/assets?search=${scanResult}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <style>{`
        #reader {
          border: none !important;
          border-radius: 1.5rem;
          overflow: hidden;
        }
        #reader video {
          border-radius: 1.5rem;
          object-fit: cover;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
      
      <div className="text-center relative">
        <h1 className="text-2xl font-bold text-gray-900">扫码核查</h1>
        <p className="text-sm text-gray-500 mt-1">请将条形码或二维码放入对焦框内</p>
        
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition-colors"
          type="button"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative min-h-[300px] flex items-center justify-center">
        <div id="reader" className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden relative">
        </div>

        {/* Loading Spinner - Outside of reader to avoid library conflicts */}
        {!isScanning && !scanResult && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20 rounded-3xl">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Custom Overlays */}
        {isScanning && (
          <>
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none z-10 rounded-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-indigo-400/50 rounded-2xl pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
              
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-[scan_2s_infinite]" />
            </div>

            {/* Torch Toggle */}
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={cn(
                  "absolute top-8 right-8 z-20 p-3 rounded-full backdrop-blur-md transition-all",
                  torchEnabled ? "bg-yellow-400 text-white shadow-lg shadow-yellow-200" : "bg-black/20 text-white hover:bg-black/40"
                )}
                type="button"
              >
                {torchEnabled ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
              </button>
            )}
          </>
        )}

        <style>{`
          @keyframes scan {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
          }
        `}</style>

        {/* Success State (Processing) */}
        <AnimatePresence>
          {!isScanning && scanResult && !notFound && !error && (
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center p-8 text-center"
             >
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                <p className="font-bold text-gray-900">识别成功</p>
                <p className="text-xs text-gray-500 mt-2">正在查询资产库: {scanResult}</p>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center flex-col items-center gap-4">
         <button 
          onClick={startScanner}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
          type="button"
        >
          重新扫描
        </button>
      </div>

      {/* Not Found Modal */}
      <AnimatePresence>
        {notFound && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setNotFound(false);
                setScanResult(null);
                startScanner();
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="bg-amber-50 p-4 rounded-full w-fit mx-auto mb-4 border border-amber-100">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">未找到资产</h3>
              <p className="text-sm text-gray-500 mt-2 mb-6">
                识别码: <span className="font-mono font-bold text-gray-800">{scanResult}</span><br/>
                该编码未在资产数据库中找到。
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleManualSearch}
                  className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center gap-2"
                  type="button"
                >
                  <Search className="h-4 w-4" />
                  以此内容手动搜索
                </button>
                
                <button 
                  onClick={() => navigate(`/assets/new?code=${scanResult}`)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  以此编码新增资产
                </button>
                
                <button 
                  onClick={() => {
                    setNotFound(false);
                    setScanResult(null);
                    startScanner();
                  }}
                  className="w-full py-2 text-gray-400 text-sm font-medium"
                  type="button"
                >
                  取消并重新扫码
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700"
          >
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm flex-1">{error}</p>
            <button onClick={startScanner} className="underline text-xs font-bold" type="button">点击重试</button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">扫码器设置</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400" type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">支持的条码格式</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto px-1">
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
                          "flex items-center justify-between px-4 py-2 rounded-xl text-sm transition-all border",
                          settings.formats.includes(option.value)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {option.label}
                        {settings.formats.includes(option.value) && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">提示：锁定特定格式可以显著提高识别效率</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">解码引擎</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, engine: 'default' })}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                        settings.engine === 'default'
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "bg-gray-50 border-gray-100 text-gray-600"
                      )}
                    >
                      默认引擎 (Zxing)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, engine: 'native' })}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                        settings.engine === 'native'
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "bg-gray-50 border-gray-100 text-gray-600"
                      )}
                    >
                      原生引擎 (Browser)
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">提示：原生引擎速度更快，但在某些设备上兼容性较差</p>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => saveSettings(settings)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                    type="button"
                  >
                    保存并应用更改
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
