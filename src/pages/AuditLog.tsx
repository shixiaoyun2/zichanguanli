import React, { useState, useEffect } from 'react';
import { 
  History, 
  User as UserIcon, 
  ArrowRight, 
  RotateCcw, 
  Maximize2,
  Package,
  Calendar,
  AlertCircle,
  X
} from 'lucide-react';
import { formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import MessageModal from '../components/MessageModal';

interface AuditLog {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_code: string;
  username: string;
  action: string;
  before_data: string;
  after_data: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRollback = async (logId: number) => {
    if (!confirm('确定要回滚到此状态吗？这将覆盖当前资产数据。')) return;
    
    setRollbackLoading(true);
    try {
      const res = await fetch(`/api/logs/rollback/${logId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        showModal('成功', '资产数据已成功回滚', 'success');
        fetchLogs();
        setSelectedLog(null);
      } else {
        const data = await res.json();
        showModal('回滚失败', data.message || '系统无法执行回滚', 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作超时，请检查网络连接', 'error');
    } finally {
      setRollbackLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-green-600 bg-green-50 border-green-100';
      case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'DELETE': return 'text-red-600 bg-red-50 border-red-100';
      case 'ROLLBACK': return 'text-purple-600 bg-purple-50 border-purple-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <MessageModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
          <p className="text-sm text-gray-500 mt-1">系统操作与资产变动历史</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
            <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无任何操作记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getActionColor(log.action))}>
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {log.asset_name || '已删除资产'} 
        <span className="text-xs font-mono font-normal text-gray-500 ml-2">({log.asset_code || '-'})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <UserIcon className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{log.username}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  <button 
                    onClick={() => setSelectedLog(log)}
                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                    查看差异
                  </button>
                  {log.action !== 'CREATE' && log.action !== 'DELETE' && log.action !== 'ROLLBACK' && (
                    <button 
                      onClick={() => handleRollback(log.id)}
                      disabled={rollbackLoading}
                      className="inline-flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      回滚
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="font-bold text-gray-900">变更差异对比</h3>
                  <p className="text-xs text-gray-500">ID: {selectedLog.id} • {selectedLog.username} • {formatDate(selectedLog.timestamp)}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-200 rounded-full">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedLog.action === 'CREATE' ? (
                  <div className="text-center py-10">
                    <AlertCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600">这是资产的初始创建记录，无对比项。</p>
                  </div>
                ) : (
                  <DiffViewer 
                    before={JSON.parse(selectedLog.before_data || '{}')} 
                    after={JSON.parse(selectedLog.after_data || '{}')} 
                  />
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  关闭
                </button>
                {selectedLog.action === 'UPDATE' && (
                  <button 
                    onClick={() => handleRollback(selectedLog.id)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-lg"
                  >
                    回滚到此状态
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiffViewer({ before, after }: { before: any, after: any }) {
  const fields = [
    { label: '资产姓名', key: 'name' },
    { label: '资产编码', key: 'asset_code' },
    { label: '状态', key: 'status' },
    { label: '使用人', key: 'user' },
    { label: '条形码', key: 'barcode' },
    { label: '卡片编码', key: 'card_code' },
    { label: '组织ID', key: 'org_id' },
    { label: '部门ID', key: 'dept_id' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
        <div>修改前 (Before)</div>
        <div>修改后 (After)</div>
      </div>
      {fields.map(field => {
        const valBefore = before[field.key];
        const valAfter = after[field.key];
        const hasChanged = valBefore !== valAfter;

        return (
          <div key={field.key} className={cn("grid grid-cols-2 gap-4 rounded-lg p-2 transition-colors", hasChanged ? "bg-amber-50/50" : "")}>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">{field.label}</label>
              <div className={cn("text-sm break-all", hasChanged ? "text-red-600 line-through opacity-70" : "text-gray-600")}>
                {valBefore || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">&nbsp;</label>
              <div className={cn("text-sm break-all", hasChanged ? "text-green-700 font-bold" : "text-gray-600")}>
                {valAfter || '-'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
