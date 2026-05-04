import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Upload, 
  Download,
  Images,
  AlertCircle,
  PackageCheck,
  PackageOpen,
  Wrench,
  Ban,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import MessageModal from '../components/MessageModal';

interface Asset {
  id: number;
  asset_code: string;
  name: string;
  org_name: string;
  dept_name: string;
  user: string;
  status: string;
  image_path: string;
  location_name: string;
  remarks: string;
  model: string;
  updated_at: string;
}

export default function AssetListPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const fetchAssets = async () => {
    // Load from cache first if available
    if (loading) {
        const cached = localStorage.getItem('assets_cache');
        if (cached) {
            setAssets(JSON.parse(cached));
            setLoading(false);
        }
    }

    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (statusFilter) query.append('status', statusFilter);
      
      const res = await fetch(`/api/assets?${query.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
        // Only cache full search if needed, but usually we cache the main list
        if (!search && !statusFilter) {
            localStorage.setItem('assets_cache', JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback message if totally offline and no cache
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [statusFilter]);

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchAssets();
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/excel/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = res.headers.get('Content-Disposition');
        const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/"/g, '') : `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        showModal('导出失败', '导出权限不足或服务器错误', 'error');
      }
    } catch (err) {
      showModal('导出失败', '网络连接异常，请稍后重试', 'error');
    }
  };

  const [exportingImages, setExportingImages] = useState(false);
  const handleImageExport = async () => {
    setExportingImages(true);
    try {
      const res = await fetch('/api/excel/export-images', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = res.headers.get('Content-Disposition');
        const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/"/g, '') : `asset_images_${new Date().toISOString().slice(0, 10)}.zip`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        showModal('图片导出失败', '导出权限不足或服务器错误', 'error');
      }
    } catch (err) {
      showModal('图片导出失败', '整理图片压缩包时出错', 'error');
    } finally {
      setExportingImages(false);
    }
  };

  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/api/excel/import-preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body
      });
      if (res.ok) {
        const data = await res.json();
        setImportPreview(data);
      } else {
        showModal('解析失败', '无法读取该 Excel 文件，请检查格式是否正确', 'error');
      }
    } catch (err) {
      showModal('网络错误', '无法连接到服务器进行文件解析', 'error');
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleCommitImport = async (finalItems: any[]) => {
    setImporting(true);
    try {
      const res = await fetch('/api/excel/import-commit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ items: finalItems })
      });
      if (res.ok) {
        const data = await res.json();
        showModal('导入成功', `操作已完成！\n新增资产: ${data.stats.created}\n更新资产: ${data.stats.updated}\n跳过资产: ${data.stats.skipped}`, 'success');
        setImportPreview(null);
        fetchAssets();
      } else {
        showModal('导入失败', '提交更改到数据库时发生错误，请重试', 'error');
      }
    } catch (err) {
      showModal('网络错误', '提交导入请求时连接中断', 'error');
    } finally {
      setImporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case '正常': return <PackageCheck className="h-4 w-4 text-green-500" />;
      case '维修': return <Wrench className="h-4 w-4 text-orange-500" />;
      case '报废': return <Ban className="h-4 w-4 text-red-500" />;
      case '待盘点': return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default: return <PackageOpen className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case '正常': return cn(base, "bg-green-100 text-green-800");
      case '已盘点': return cn(base, "bg-green-100 text-green-800");
      case '维修': return cn(base, "bg-orange-100 text-orange-800");
      case '报废': return cn(base, "bg-red-100 text-red-800");
      case '待盘点': return cn(base, "bg-blue-100 text-blue-800");
      default: return cn(base, "bg-gray-100 text-gray-800");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资产清单</h1>
          <p className="text-sm text-gray-500 mt-1">共管理 {assets.length} 件资产</p>
        </div>
        
        {user?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <Link 
              to="/assets/new" 
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增资产
            </Link>
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden divide-x divide-gray-200">
              <button 
                onClick={() => importFileRef.current?.click()}
                className="p-2 hover:bg-gray-50 bg-white text-gray-600 disabled:opacity-50" 
                title="批量导入"
                disabled={importing}
              >
                <Upload className={cn("h-4 w-4", importing && "animate-pulse")} />
              </button>
              <input type="file" ref={importFileRef} onChange={handleImportFile} accept=".xlsx,.xls" className="hidden" />
              <button 
                onClick={handleExport}
                className="p-2 hover:bg-gray-50 bg-white text-gray-600" 
                title="批量导出"
              >
                <Download className="h-4 w-4" />
              </button>
              <button 
                onClick={handleImageExport}
                className="p-2 hover:bg-gray-50 bg-white text-gray-600 disabled:opacity-50" 
                title="导出所有图片 (ZIP)"
                disabled={exportingImages}
              >
                <Images className={cn("h-4 w-4", exportingImages && "animate-pulse")} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setImportPreview(null)} />
          <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold">导入预览与冲突解决</h3>
              <button onClick={() => setImportPreview(null)} className="p-1 hover:bg-gray-200 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
               <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-2">资产编码</th>
                      <th className="px-2 py-2">名称</th>
                      <th className="px-2 py-2">型号</th>
                      <th className="px-2 py-2">位置</th>
                      <th className="px-2 py-2">建议操作</th>
                      <th className="px-2 py-2">差异处理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importPreview.map((item, idx) => (
                      <tr key={idx} className={item.type === 'CONFLICT' ? "bg-amber-50" : ""}>
                        <td className="px-2 py-2 font-mono">{item.data.asset_code}</td>
                        <td className="px-2 py-2">{item.data.name}</td>
                        <td className="px-2 py-2 truncate max-w-[80px]">{item.data.model || '-'}</td>
                        <td className="px-2 py-2 truncate max-w-[80px]">{item.data.location_name || '-'}</td>
                        <td className="px-2 py-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            item.type === 'CREATE' ? "bg-green-100 text-green-700" :
                            item.type === 'OVERWRITE' ? "bg-blue-100 text-blue-700" :
                            item.type === 'SKIP' ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                          )}>
                            {item.type === 'CREATE' ? '新增' : 
                             item.type === 'OVERWRITE' ? '自动覆盖(较新)' : 
                             item.type === 'SKIP' ? '跳过(一致)' : '需要确认差异'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                           {item.type === 'CONFLICT' ? (
                             <div className="flex gap-2">
                               <button 
                                 onClick={() => {
                                   const next = [...importPreview];
                                   next[idx].type = 'CONFLICT_RESOLVED';
                                   setImportPreview(next);
                                 }}
                                 className="px-2 py-1 bg-white border border-amber-300 rounded text-amber-700 hover:bg-amber-100"
                               >
                                 覆盖已有
                               </button>
                               <button 
                                 onClick={() => {
                                   const next = [...importPreview];
                                   next[idx].type = 'SKIP';
                                   setImportPreview(next);
                                 }}
                                 className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-500 hover:bg-gray-50"
                               >
                                 保留库中
                               </button>
                             </div>
                           ) : item.type === 'CONFLICT_RESOLVED' ? (
                             <span className="text-green-600">已选覆盖</span>
                           ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm font-medium">取消</button>
              <button 
                onClick={() => handleCommitImport(importPreview)}
                disabled={importing || importPreview.some(i => i.type === 'CONFLICT')}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {importing ? "正在导入..." : "确认并导入"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text"
            placeholder="搜索名称、编号或条码..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyUp={handleSearchKeyPress}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">所有状态</option>
            <option value="正常">正常</option>
            <option value="待盘点">待盘点</option>
            <option value="已盘点">已盘点</option>
            <option value="维修">维修</option>
            <option value="报废">报废</option>
          </select>
          <button 
            onClick={fetchAssets}
            className="p-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MessageModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* List Area */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
            <PackageOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">未找到相关资产</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {assets.map((asset) => (
              <Link 
                key={asset.id} 
                to={`/assets/${asset.id}`}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 active:bg-gray-50 transition-colors"
              >
                <div className="h-20 w-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {asset.image_path ? (
                    <img src={asset.image_path} alt={asset.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <PackageOpen className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono text-gray-500 truncate">{asset.asset_code}</span>
                    <span className={getStatusBadge(asset.status)}>{asset.status}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate mt-1">{asset.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{asset.dept_name || '未定义部门'}</span>
                    <span>使用人: {asset.user || '-'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Table View for Desktop */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">资产信息</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">部门 / 组织</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">使用人</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">最后更新</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                          {asset.image_path ? (
                            <img src={asset.image_path} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                                <PackageOpen className="h-5 w-5 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{asset.asset_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{asset.dept_name || '-'}</div>
                      <div className="text-xs text-gray-500">{asset.org_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {asset.user || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadge(asset.status)}>
                        {getStatusIcon(asset.status)}
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {formatDate(asset.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/assets/${asset.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium text-sm">
                        管理
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
