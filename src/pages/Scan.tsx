import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Scan, X, AlertCircle, Search, Plus, Settings, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ScannerSettings {
  formats: Html5QrcodeSupportedFormats[];
  engine: 'default' | 'native';
}

const DEFAULT_SETTINGS: ScannerSettings = {
  formats: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.QR_CODE],
  engine: 'default'
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
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
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

  const isMounted = useRef(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    isMounted.current = true;
    
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: "environment",
          // @ts-ignore - some browsers support focusMode in constraints
          focusMode: "continuous"
        },
        formatsToSupport: settings.formats.length > 0 ? settings.formats : undefined,
        useBarCodeDetectorIfSupported: settings.engine === 'native'
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText: string) => {
      // Avoid clearing manually here to prevent race conditions with component unmount/cleanup
      // The cleanup function will handle it.
      if (isMounted.current) {
        setIsScanning(false);
        setScanResult(decodedText);
        checkAsset(decodedText);
      }
    };

    const onScanFailure = (error: any) => {
      // ignore failures as they are frequent while searching for codes
    };

    // Focus Hack: Attempt to apply focus when video element is ready
    const setupFocusOnVideo = () => {
      if (!isMounted.current) return null;
      const video = document.querySelector('#reader video') as HTMLVideoElement;
      if (video) {
        const handleFocusClick = async (e: MouseEvent) => {
          const stream = video.srcObject as MediaStream;
          if (!stream) return;
          const [track] = stream.getVideoTracks();
          
          if (track && 'applyConstraints' in track) {
            try {
              // Attempt to trigger auto-focus by re-applying constraints
              // @ts-ignore
              await track.applyConstraints({ focusMode: 'continuous' });
            } catch (err) {
              console.warn("Manual focus not supported by browser", err);
            }
          }

          // Visual feedback
          const rect = video.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const box = document.createElement('div');
          box.className = 'focus-box-animation';
          box.style.left = `${x}px`;
          box.style.top = `${y}px`;
          video.parentElement?.appendChild(box);
          setTimeout(() => {
            if (isMounted.current) box.remove();
          }, 600);
        };

        video.addEventListener('click', handleFocusClick);
        return () => video.removeEventListener('click', handleFocusClick);
      }
      return null;
    };

    scanner.render(onScanSuccess, onScanFailure);

    // Poll for video element to attach listener
    const focusTimer = setInterval(() => {
      if (!isMounted.current) {
        clearInterval(focusTimer);
        return;
      }
      const cleanup = setupFocusOnVideo();
      if (cleanup) clearInterval(focusTimer);
    }, 500);

    return () => {
      isMounted.current = false;
      clearInterval(focusTimer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {
          console.warn("Scanner cleanup failed (safe to ignore if unmounting):", e);
        });
        scannerRef.current = null;
      }
    };
  }, [settings]);

  const saveSettings = (newSettings: ScannerSettings) => {
    setSettings(newSettings);
    localStorage.setItem('scanner_settings', JSON.stringify(newSettings));
    setShowSettings(false);
    // Restart scanner logic is handled by setting dependency in useEffect
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
      setError('网络错误');
    }
  };

  const handleManualSearch = () => {
    if (scanResult) {
       navigate(`/assets?search=${scanResult}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <style>{`
        #reader__status_span { display: none; }
        #reader button {
          background-color: #f3f4f6 !important;
          color: #374151 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.75rem !important;
          padding: 0.5rem 1rem !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }
        #reader button:hover {
          background-color: #e5e7eb !important;
        }
        #reader__dashboard_section_csr button:first-child {
          font-size: 0 !important;
        }
        #reader__dashboard_section_csr button:first-child::after {
          content: '请求摄像头权限' !important;
          font-size: 0.875rem !important;
        }
        #reader__dashboard_section_swaplink {
          font-size: 0 !important;
          color: #4f46e5 !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }
        #reader__dashboard_section_swaplink::after {
          content: '上传图片识别' !important;
          font-size: 0.875rem !important;
        }
        #reader__camera_selection {
          padding: 0.5rem !important;
          border-radius: 0.5rem !important;
          border: 1px solid #e5e7eb !important;
          margin-bottom: 1rem !important;
          width: 100% !important;
        }
        #reader__scan_region img {
          display: none !important;
        }
        #html5-qrcode-button-camera-stop {
          font-size: 0 !important;
        }
        #html5-qrcode-button-camera-stop::after {
          content: '停止扫描' !important;
          font-size: 0.875rem !important;
        }
        #html5-qrcode-button-file-selection {
          font-size: 0 !important;
        }
        #html5-qrcode-button-file-selection::after {
          content: '浏览本地图片' !important;
          font-size: 0.875rem !important;
        }
        .focus-box-animation {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 2px solid #4f46e5;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: focus-ping 0.6s ease-out forwards;
          pointer-events: none;
          z-index: 10;
        }
        @keyframes focus-ping {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      `}</style>
      <div className="text-center relative">
        <h1 className="text-2xl font-bold text-gray-900">扫码核查</h1>
        <p className="text-sm text-gray-500 mt-1">请将条形码或二维码放入对焦框内</p>
        
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition-colors"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
        <div id="reader" className="w-full rounded-2xl overflow-hidden"></div>
        
        <AnimatePresence>
          {!isScanning && !notFound && !error && (
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-8 text-center"
             >
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                <p className="font-bold text-gray-900">扫描成功</p>
                <p className="text-xs text-gray-500 mt-2">正在查询资产库: {scanResult}</p>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center flex-col items-center gap-4">
         <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200"
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
              onClick={() => setNotFound(false)}
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
                >
                  <Search className="h-4 w-4" />
                  以此内容手动搜索
                </button>
                
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => navigate(`/assets/new?code=${scanResult}`)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    以此编码新增资产
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    setNotFound(false);
                    window.location.reload();
                  }}
                  className="w-full py-2 text-gray-400 text-sm font-medium"
                >
                  取消并重新扫码
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
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
                <button onClick={() => setShowSettings(false)} className="text-gray-400">
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
