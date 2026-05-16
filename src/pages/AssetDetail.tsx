import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Camera, 
  Shield,
  Image as ImageIcon, 
  Trash2, 
  Info,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  RefreshCcw,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import MessageModal from '../components/MessageModal';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { user } = useAuth();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [options, setOptions] = useState<{ organizations: string[], departments: {id: number, name: string}[], locations: string[], models: string[], currentModel?: string }>({
    organizations: [],
    departments: [],
    locations: [],
    models: []
  });
  const [ocrData, setOcrData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const [formData, setFormData] = useState({
    name: '',
    asset_code: '',
    card_code: '',
    barcode: '',
    org_name: '',
    dept_name: '',
    user: '',
    status: '待盘点',
    location_name: '',
    remarks: '',
    model: '',
    updated_at: ''
  });

  // Permissions logic
  const isOperator = user?.role === 'admin' ? false : true;
  const userDeptIds = user?.deptIds || [];
  const deptId = (formData as any).dept_id;
  const hasDeptAccess = user?.role === 'admin' || (deptId !== undefined && deptId !== null && userDeptIds.includes(Number(deptId)));
  const canEdit = user?.role === 'admin' || (user?.role === 'operator' && !isNew && hasDeptAccess);
  
  const currentDeptName = (formData as any).dept_name || 
    (options.departments.find(d => Number(d.id) === Number(deptId))?.name) || 
    (deptId ? `部门 ID: ${deptId}` : '未公开');

  const permissionMessage = isOperator && isNew 
    ? '操作员禁止录入新资产，请联系管理员。' 
    : isOperator && !hasDeptAccess && !isNew && !(formData as any).limited
      ? `您无权编辑此资产。当前归属：${currentDeptName}`
      : '';

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchOptions();
    
    // Clear transient state when asset ID changes
    setPreviewUrl(null);
    setSelectedFile(null);
    setError('');
    setSuccess('');

    if (isNew) {
      const code = new URLSearchParams(location.search).get('code');
      if (code) {
        setFormData(prev => ({ ...prev, asset_code: code }));
      }
      setLoading(false);
    } else {
      fetchAsset();
    }
  }, [id, isNew, location.search]);

  // Handle OCR data from navigation state and manage its lifecycle
  useEffect(() => {
    if (location.state?.ocrData) {
      setOcrData(location.state.ocrData);
      setUseAI(true);
      // Note: We deliberately avoid mutating window.history to prevent React Router 
      // lifecycle bugs in Strict Mode when navigating from Scan page.
    } else {
      // Clear OCR data if navigating to a page without OCR state 
      // (e.g. clicking "New Asset" while already on new asset page, or jumping to another asset)
      setOcrData(null);
    }
  }, [location.key, location.state]);

  useEffect(() => {
    if (ocrData && !loading) {
      setFormData(prev => {
        const newData = { ...prev };
        let modified = false;
        
        // Fields to map from OCR to FormData
        const fields = ['asset_code', 'name', 'model', 'org_name', 'dept_name', 'location_name', 'user', 'remarks', 'card_code', 'barcode'];
        fields.forEach(field => {
          // Only update if OCR data provides a value AND it's different from current
          // Use loose equality or trim to be more robust
          const ocrVal = String(ocrData[field] || '').trim();
          const currentVal = String((prev as any)[field] || '').trim();
          
          if (ocrVal && ocrVal !== currentVal) {
            (newData as any)[field] = ocrVal;
            modified = true;
          }
        });
        
        return modified ? newData : prev;
      });
    }
  }, [ocrData, loading]);

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/assets/metadata/options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setOptions(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch metadata options');
    }
  };

  const fetchAsset = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        setOriginalData(data); // Store for diff
        if (data.image_path) {
          setPreviewUrl(data.image_path);
        }
      } else {
        setError('加载资产失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setSuccess('资产已成功删除');
        setTimeout(() => navigate('/assets'), 1500);
      } else {
        const data = await res.json();
        setError(data.message || '删除失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const resetField = (fieldName: string) => {
    if (originalData) {
      setFormData(prev => ({ ...prev, [fieldName]: (originalData as any)[fieldName] || '' }));
    } else {
      setFormData(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const isFieldDifferent = (fieldName: string) => {
    // If no OCR data involved, no highlight
    if (!ocrData) return false;
    
    const currentVal = (formData as any)[fieldName] ?? '';
    const originalVal = (originalData as any)?.[fieldName] ?? '';
    
    // Highlight if the current form value is different from the database value
    // This covers both: 
    // 1. OCR automatic filling changed the value
    // 2. User manually changed it while comparing with OCR results
    return String(currentVal) !== String(originalVal);
  };

  const renderInputField = (label: string, name: string, placeholder?: string, listId?: string) => {
    const isDiff = isFieldDifferent(name);
    const origVal = (originalData as any)?.[name];
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center px-1">
          <label className={cn("text-[10px] font-bold uppercase tracking-wider transition-colors", isDiff ? "text-indigo-600" : "text-gray-500")}>
            {label}
            {isDiff && <Sparkles className="h-3 w-3 inline ml-1 animate-pulse" />}
          </label>
          {isDiff && (
            <div className="flex items-center gap-1 overflow-hidden">
              {!isNew && origVal !== undefined && origVal !== null && (
                <button
                  type="button"
                  onClick={() => resetField(name)}
                  className="text-[9px] text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-0.5 bg-gray-50 px-1 rounded border border-gray-100"
                  title="点击恢复原始值"
                >
                  <span className="line-through opacity-80">原:{String(origVal)}</span>
                  <RefreshCcw className="h-2 w-2" />
                </button>
              )}
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, [name]: '' }))}
                className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                title="清空字段"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <input 
          type="text" 
          name={name} 
          value={(formData as any)[name] || ''} 
          onChange={handleInputChange}
          disabled={!canEdit}
          list={listId}
          placeholder={placeholder}
          className={cn(
            "w-full px-4 py-2 border rounded-xl text-sm transition-all outline-none",
            isDiff 
              ? "bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm" 
              : "bg-gray-50/50 border-gray-200 focus:border-indigo-400 focus:bg-white",
            !canEdit && "opacity-50 grayscale-[0.5]"
          )}
        />
        {listId && (
          <datalist id={listId}>
            {(options as any)[listId.replace('_list', '')]?.map((opt: any, i: number) => (
              <option key={i} value={typeof opt === 'object' ? opt.name : opt} />
            ))}
          </datalist>
        )}
      </div>
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      
      if (useAI) {
        setSaving(true);
        setError('正在识别标签内容...');
        try {
          // 1. Client-side compression
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
            // Instead of directly updating formData, set ocrData to trigger the 
            // comparison logic and highlighting in the UI
            setOcrData(data);
            setSuccess('AI 识别填充完成，请核对信息');
          } else {
            setError('AI 识别失败');
          }
        } catch (err) {
          setError('AI 服务连接失败');
        } finally {
          setSaving(false);
        }
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
          if (key === 'updated_at') {
              submitData.append('last_updated_at', value as string);
          } else {
              submitData.append(key, value as string);
          }
      }
    });
    if (selectedFile) {
      submitData.append('image', selectedFile);
    }

    try {
      const url = isNew ? '/api/assets' : `/api/assets/${id}`;
      const method = isNew ? 'POST' : 'PATCH';
      
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: submitData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(isNew ? '资产创建成功' : '资产信息更新成功');
        // Clear success message after 3s
        setTimeout(() => setSuccess(''), 3000);
        
        if (isNew) {
          setTimeout(() => navigate(`/assets/${data.id}`), 1500);
        } else {
          fetchAsset(); // Refresh
        }
      } else if (res.status === 409) {
        showModal('版本冲突', '该资产已被他人更新，请刷新页面加载最新数据。', 'warning');
      } else {
        showModal('保存失败', data.message || '系统无法保存您的更改', 'error');
      }
    } catch (err) {
      showModal('网络错误', '无法连接到服务器，请检查网络设置', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [targetDeptId, setTargetDeptId] = useState('');

  const handleTransferRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          asset_id: formData.id,
          to_dept_id: targetDeptId,
          reason: transferReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        showModal('申请已提交', data.message, 'success');
        setIsTransferModalOpen(false);
        setTransferReason('');
      } else {
        showModal('提交失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作超时，请稍后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if ((formData as any).limited) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-10">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </button>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-amber-100 text-center space-y-6">
          <div className="bg-amber-50 p-4 rounded-full w-fit mx-auto border border-amber-100 text-amber-600">
            <Shield className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">权限受限</h2>
            <p className="text-gray-500 mt-2">
              您正在查看资产 <span className="font-bold text-indigo-600">{(formData as any).name}</span> ({ (formData as any).asset_code })
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium">
              当前归属：{ (formData as any).dept_name || options.departments.find(d => d.id === Number((formData as any).dept_id))?.name || '未公开' }
            </div>
          </div>
          
          <div className="p-4 bg-amber-50/50 rounded-2xl text-sm text-amber-800 border border-amber-100">
            { (formData as any).message }
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
             <button 
              onClick={() => navigate(-1)}
              className="flex-1 py-3.5 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-200"
            >
              稍后再说
            </button>
            <button 
              onClick={() => {
                if (options.departments.length > 0) {
                  setTargetDeptId(String(options.departments[0].id));
                }
                setIsTransferModalOpen(true);
              }}
              className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              申请调拨至本部门
            </button>
          </div>
        </div>

        {/* Transfer Modal */}
        <AnimatePresence>
          {isTransferModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsTransferModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4">申请跨部门调拨</h3>
                <form onSubmit={handleTransferRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">目标接收部门</label>
                    <select 
                      required
                      value={targetDeptId}
                      onChange={(e) => setTargetDeptId(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                    >
                      {options.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">调拨事由</label>
                    <textarea 
                      required
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      rows={3}
                      placeholder="请向管理员说明调拨原因..."
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-3 text-sm text-gray-500 font-bold">取消</button>
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? '正在提交...' : '确认申请'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <MessageModal 
          isOpen={modal.isOpen} 
          onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
          title={modal.title}
          message={modal.message}
          type={modal.type}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </button>
        <div className="flex items-center gap-2">
          {!isNew && user?.role === 'admin' && (
             <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="查看变更记录">
                <History className="h-5 w-5" />
             </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-32">
        {/* Messages */}
        {permissionMessage && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-700">
            <Shield className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{permissionMessage}</p>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]"
            >
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-bold">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-6">
          {/* Form Fields Area */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full border-b border-gray-50 pb-2 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-700">基础信息</h3>
                </div>
                {options.currentModel && (
                  <span className="text-[9px] text-gray-400 font-mono tracking-tighter opacity-60">AI: {options.currentModel}</span>
                )}
              </div>
              
              <div className="col-span-full">
                {renderInputField('资产名称', 'name', '请输入资产名称')}
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('规格型号', 'model', '如：2023款 16G+512G', 'models_list')}
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('位置名称', 'location_name', '如：北京总部 A座 302', 'locations_list')}
              </div>

              <div className="col-span-full md:col-span-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">资产状态</label>
                <select 
                  name="status" value={formData.status || '待盘点'} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 cursor-pointer transition-all outline-none"
                >
                  <option value="待盘点">待盘点</option>
                  <option value="已盘点">已盘点</option>
                  <option value="损坏">损坏</option>
                  <option value="维修">维修</option>
                  <option value="报废">报废</option>
                </select>
              </div>

              <div className="col-span-full md:col-span-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">最后修改时间</label>
                <div className="px-4 py-2 bg-gray-100/30 border border-transparent rounded-xl text-sm text-gray-500 cursor-not-allowed">
                  {formData.updated_at ? formatDate(formData.updated_at) : (isNew ? '新建中' : '-')}
                </div>
              </div>
            </div>

            {/* Belonging Management */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full border-b border-gray-50 pb-2 mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-700">归属与识别</h3>
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('资产组织', 'org_name', '选择或输入组织', 'organizations_list')}
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('管理部门', 'dept_name', '选择或输入部门', 'departments_list')}
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('使用人', 'user', '领用人姓名')}
              </div>

              <div className="col-span-full md:col-span-1">
                {renderInputField('资产编码', 'asset_code', '唯一识别码')}
              </div>

              <div className="col-span-full md:col-span-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">条形码</label>
                <input 
                  type="text" name="barcode" value={formData.barcode || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 outline-none"
                />
              </div>

              <div className="col-span-full md:col-span-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">卡片编号</label>
                <input 
                  type="text" name="card_code" value={formData.card_code || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 outline-none"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">备注</label>
                <textarea 
                  name="remarks" value={formData.remarks || ''} onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  disabled={!canEdit}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 resize-none outline-none"
                  placeholder="在此输入其他备注信息..."
                />
              </div>
            </div>
          </div>

          {/* Image Upload Area */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-700">资产照片</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OCR</span>
                  <button 
                    type="button"
                    onClick={() => setUseAI(!useAI)}
                    disabled={!canEdit}
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                      useAI ? "bg-indigo-600" : "bg-gray-200",
                      !canEdit && "opacity-50"
                    )}
                  >
                    <span className={cn("pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", useAI ? "translate-x-3" : "translate-x-0")} />
                  </button>
                </div>
              </div>
              <div className="aspect-video md:aspect-[21/9] bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative group">
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canEdit}
                        className="p-3 bg-white rounded-full text-gray-700 hover:text-indigo-600 disabled:opacity-50 shadow-xl"
                      >
                        <RefreshCcw className="h-6 w-6" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">点击或拖拽上传资产图片</p>
                    <p className="text-[10px] text-gray-400 mt-1">清晰的照片有助于 AI 精准识别</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 w-full h-full cursor-pointer z-0 opacity-0"
                  aria-label="Upload image"
                />
              </div>
              <div className="flex gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.setAttribute('capture', 'environment');
                      fileInputRef.current?.click();
                    }}
                    disabled={!canEdit}
                    className="flex-1 inline-flex justify-center items-center px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    拍照识别
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.removeAttribute('capture');
                      fileInputRef.current?.click();
                    }}
                    disabled={!canEdit}
                    className="flex-1 inline-flex justify-center items-center px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm"
                  >
                    <ImageIcon className="h-5 w-5 mr-2" />
                    相册选图
                  </button>
              </div>
            </div>
          </div>

        {/* Action Bar */}
        <div className="md:mt-12 md:pt-8 md:border-t flex flex-row items-center justify-end gap-3 fixed bottom-[72px] left-0 right-0 md:relative bg-white/90 backdrop-blur-md md:bg-transparent border-t md:border-none p-4 md:p-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none">
          {!isNew && user?.role === 'admin' && (
            <button 
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 md:flex-none inline-flex justify-center items-center px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              删除资产
            </button>
          )}
          <button 
            type="submit"
            disabled={saving || !canEdit}
            className="flex-[2] md:flex-none inline-flex justify-center items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? '正在保存...' : (isNew ? '创建资产' : '保存修改')}
            {!saving && <Save className="h-3.5 w-3.5 ml-1.5" />}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="bg-red-50 p-4 rounded-full w-fit mx-auto mb-4 border border-red-100 text-red-600">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">确认删除？</h3>
              <p className="text-sm text-gray-500 mt-2 mb-8">
                该操作将永久删除资产 <span className="font-bold text-gray-700">{formData.name}</span>，且无法撤销。
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3.5 text-gray-600 font-bold text-sm bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MessageModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
