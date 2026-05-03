import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useAI, setUseAI] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    asset_code: '',
    card_code: '',
    barcode: '',
    org_name: '',
    dept_name: '',
    user: '',
    status: '待盘点',
    updated_at: ''
  });

  // Permissions logic
  const userDepts = (user?.departments || '').split(',').map(d => d.trim()).filter(Boolean);
  const isOperator = user?.role === 'operator';
  const hasDeptAccess = !isOperator || userDepts.includes(formData.dept_name);
  const canEdit = user?.role === 'admin' || (isOperator && !isNew && hasDeptAccess);
  const permissionMessage = isOperator && isNew 
    ? '操作员禁止录入新资产，请联系管理员。' 
    : isOperator && !hasDeptAccess 
      ? `您无权编辑隶属于“${formData.dept_name || '未定义'}”的资产。您的管辖范围：${userDepts.join(', ') || '无'}`
      : '';

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isNew) {
      fetchAsset();
    }
  }, [id]);

  const fetchAsset = async () => {
    try {
      const res = await fetch(`/api/assets/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
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
          const body = new FormData();
          body.append('image', file);
          const res = await fetch('/api/ai/ocr', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body
          });
          if (res.ok) {
            const data = await res.json();
            setFormData(prev => ({
              ...prev,
              name: data.name || prev.name,
              asset_code: data.asset_code || prev.asset_code,
              card_code: data.card_code || prev.card_code,
              barcode: data.barcode || prev.barcode,
              org_name: data.org_name || prev.org_name,
              dept_name: data.dept_name || prev.dept_name,
              user: data.user || prev.user
            }));
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
        setSuccess(isNew ? '资产创建成功' : '资产更新成功');
        if (isNew) {
          setTimeout(() => navigate(`/assets/${data.id}`), 1500);
        } else {
          fetchAsset(); // Refresh
        }
      } else if (res.status === 409) {
        setError('数据冲突：该资产已被他人更新，请刷新页面加载最新数据。');
      } else {
        setError(data.message || '保存失败');
      }
    } catch (err) {
      setError('网络错误');
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
             <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="查看变更记录">
                <History className="h-5 w-5" />
             </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
            <Sparkles className="h-3 w-3" />
            AI OCR
            <button 
              onClick={() => setUseAI(!useAI)}
              disabled={!canEdit}
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ml-1",
                useAI ? "bg-indigo-600" : "bg-gray-200",
                !canEdit && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                useAI ? "translate-x-3" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
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
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Upload Area */}
          <div className="lg:col-span-1 space-y-4">
            <div className="aspect-square bg-white border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative group">
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canEdit}
                      className="p-2 bg-white rounded-full text-gray-700 hover:text-indigo-600 disabled:opacity-50"
                    >
                      <RefreshCcw className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">点击上传资产图片</p>
                  <p className="text-[10px] text-gray-400 mt-1">支持拍照或相册</p>
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
            <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.setAttribute('capture', 'environment');
                    fileInputRef.current?.click();
                  }}
                  disabled={!canEdit}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  去拍照
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.removeAttribute('capture');
                    fileInputRef.current?.click();
                  }}
                  disabled={!canEdit}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  相册
                </button>
            </div>
          </div>

          {/* Form Fields Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full border-b border-gray-50 pb-2 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-700">基础信息</h3>
              </div>
              
              <div className="col-span-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">资产名称</label>
                <input 
                  type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">资产编码 (唯一)</label>
                <input 
                  type="text" name="asset_code" value={formData.asset_code} onChange={handleInputChange} required
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">条形码</label>
                <input 
                  type="text" name="barcode" value={formData.barcode || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">卡片编码</label>
                <input 
                  type="text" name="card_code" value={formData.card_code || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">当前状态</label>
                <select 
                  name="status" value={formData.status} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <option value="待盘点">待盘点</option>
                  <option value="已盘点">已盘点</option>
                  <option value="正常">正常</option>
                  <option value="维修">维修</option>
                  <option value="报废">报废</option>
                </select>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full border-b border-gray-50 pb-2 mb-2 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-700">归属管理</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">资产组织</label>
                <input 
                  type="text" name="org_name" value={formData.org_name || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">管理部门</label>
                <input 
                  type="text" name="dept_name" value={formData.dept_name || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">使用人</label>
                <input 
                  type="text" name="user" value={formData.user || ''} onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 md:relative bg-white border-t md:border-none p-4 md:p-0 flex justify-end gap-3 z-20">
          {!isNew && user?.role === 'admin' && (
            <button 
              type="button"
              className="flex-1 md:flex-none inline-flex justify-center items-center px-6 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除资产
            </button>
          )}
          <button 
            type="submit"
            disabled={saving || !canEdit}
            className="flex-[2] md:flex-none inline-flex justify-center items-center px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? '正在保存...' : '保存修改'}
            {!saving && <Save className="h-4 w-4 ml-2" />}
          </button>
        </div>
      </form>
    </div>
  );
}
