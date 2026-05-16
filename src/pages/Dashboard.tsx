import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ChevronRight,
  ArrowRight,
  MoveHorizontal,
  Check,
  X as CloseIcon,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { cn, formatDate } from '../lib/utils';
import MessageModal from '../components/MessageModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<{id: number, name: string}[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    pending: 0,
    maintenance: 0,
    logs: [] as any[],
    transfers: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  // Helper to translate department IDs to names
  const getDeptNames = (ids: string) => {
    if (!ids) return '未分配部门';
    if (!departments.length) return ids; // Fallback if depts not loaded yet
    const idArray = ids.split(',').map(id => id.trim());
    return idArray.map(id => {
      const dept = departments.find(d => String(d.id) === id);
      return dept ? dept.name : `部门${id}`;
    }).join(', ');
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const requests = [
        fetch('/api/assets', { headers }),
        fetch('/api/logs', { headers }),
        fetch('/api/departments', { headers })
      ];

      if (user?.role === 'admin') {
        requests.push(fetch('/api/transfers', { headers }));
      }

      const statsResults = await Promise.all(requests);
      
      const assetsRes = statsResults[0];
      const logsRes = statsResults[1];
      const deptsRes = statsResults[2];
      
      const assetsData = assetsRes.ok ? await assetsRes.json() : [];
      const logsData = logsRes.ok ? await logsRes.json() : [];
      const deptsData = deptsRes.ok ? await deptsRes.json() : [];
      
      const assets = Array.isArray(assetsData) ? assetsData : [];
      const logs = Array.isArray(logsData) ? logsData : [];
      const depts = Array.isArray(deptsData) ? deptsData : [];
      
      setDepartments(depts);

      let transfers = [];
      if (user?.role === 'admin' && statsResults[3]) {
        const transfersRes = statsResults[3];
        const transfersData = transfersRes.ok ? await transfersRes.json() : [];
        transfers = Array.isArray(transfersData) ? transfersData : [];
      }
      
      setStats({
        total: assets.length,
        normal: assets.filter((a: any) => a.status === '已盘点' || a.status === '正常').length,
        pending: assets.filter((a: any) => a.status === '待盘点' || !a.status).length,
        maintenance: assets.filter((a: any) => a.status === '维修' || a.status === '损坏' || a.status === '报废').length,
        logs: logs.slice(0, 5),
        transfers
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleTransferDecision = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/transfers/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        showModal('处理成功', data.message, 'success');
        fetchDashboardData(); // Refresh
      } else {
        showModal('操作失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作超时', 'error');
    }
  };

  const statCards = [
    { title: '资产总数', value: stats.total, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: '状态正常', value: stats.normal, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { title: '待盘点', value: stats.pending, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: '维修中/异常', value: stats.maintenance, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <MessageModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      <div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">您好, {user?.username}</h1>
            <p className="text-gray-500 text-sm font-medium">
              {user?.role === 'admin' ? '全域资产实时监控' : '所辖部门资产统计'}
            </p>
          </div>
          {user?.role === 'operator' && (
            <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 text-sm">
                <Shield className="h-4 w-4" />
                <span className="font-bold">管辖范围:</span>
                <span className="max-w-[200px] truncate" title={getDeptNames(user.departments)}>
                  {getDeptNames(user.departments)}
                </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className={cn("p-2 rounded-lg w-fit mb-4", card.bg)}>
              <card.icon className={cn("h-5 w-5", card.color)} />
            </div>
            <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions & Pending Transfers */}
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">快捷操作</h2>
            <div className="space-y-3">
               <Link 
                to="/scan" 
                className="flex items-center justify-between p-4 bg-indigo-600 text-white rounded-2xl shadow-md hover:bg-indigo-700 transition-all active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 opacity-80" />
                  <span className="font-bold">立即扫码核查</span>
                </div>
                <ChevronRight className="h-5 w-5 opacity-60" />
              </Link>
              
              <Link 
                to="/assets" 
                className="flex items-center justify-between p-4 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-gray-400" />
                  <span className="font-semibold">查看清单</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300" />
              </Link>

              {user?.role === 'admin' && (
                <Link 
                  to="/logs" 
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="font-semibold">查看历史审计</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300" />
                </Link>
              )}
            </div>
          </div>

          {user?.role === 'admin' && stats.transfers.length > 0 && (
             <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 inline-flex items-center gap-2">
                    调拨待处理
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{stats.transfers.length}</span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {stats.transfers.map(tr => (
                    <div key={tr.id} className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{tr.asset_name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{tr.asset_code}</p>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">待审</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] text-gray-600 bg-white/60 p-2 rounded-lg">
                        <span className="px-1.5 py-0.5 bg-gray-200 rounded truncate max-w-[80px]" title={tr.from_dept_name}>{tr.from_dept_name || '未知'}</span>
                        <MoveHorizontal className="h-3 w-3 text-gray-400" />
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold truncate max-w-[80px]" title={tr.to_dept_name}>{tr.to_dept_name}</span>
                      </div>
                      
                      <p className="text-xs text-gray-500 italic bg-white/40 p-2 rounded-lg break-all">“{tr.reason}”</p>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleTransferDecision(tr.id, 'rejected')}
                          className="flex-1 bg-white border border-gray-200 text-gray-400 hover:text-red-500 py-2 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleTransferDecision(tr.id, 'approved')}
                          className="flex-[2] bg-indigo-600 text-white py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-md shadow-indigo-100 hover:bg-indigo-700"
                        >
                          <Check className="h-4 w-4" />
                          批准调入
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">最近动态</h2>
            <Link to="/logs" className="text-indigo-600 text-sm font-medium hover:underline flex items-center">
              查看全部 <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {stats.logs.map((log: any) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                   <div className={cn(
                     "p-2 rounded-full",
                     log.action === 'CREATE' ? "bg-green-50 text-green-600" : 
                     log.action === 'UPDATE' ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                   )}>
                     <Clock className="h-4 w-4" />
                   </div>
                   <div>
                     <p className="text-sm font-bold text-gray-900">
                       {log.action === 'CREATE' ? '新增资产' : '更新资产'}: {log.asset_name || log.asset_code}
                     </p>
                     <p className="text-xs text-gray-500">{log.username} • {formatDate(log.timestamp)}</p>
                   </div>
                </div>
                <Link to={`/assets/${log.asset_id}`} className="text-gray-400 hover:text-indigo-600">
                   <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            ))}
            {stats.logs.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm">暂无记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
