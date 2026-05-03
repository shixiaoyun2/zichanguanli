import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { cn, formatDate } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    pending: 0,
    maintenance: 0,
    logs: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [assetsRes, logsRes] = await Promise.all([
          fetch('/api/assets', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch('/api/logs', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        ]);
        
        if (assetsRes.ok && logsRes.ok) {
          const assets = await assetsRes.json();
          const logs = await logsRes.json();
          
          setStats({
            total: assets.length,
            normal: assets.filter((a: any) => a.status === '正常' || a.status === '已盘点').length,
            pending: assets.filter((a: any) => a.status === '待盘点').length,
            maintenance: assets.filter((a: any) => a.status === '维修').length,
            logs: logs.slice(0, 5)
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const statCards = [
    { title: '资产总数', value: stats.total, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: '状态正常', value: stats.normal, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { title: '待盘点', value: stats.pending, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: '维修中/异常', value: stats.maintenance, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">您好, {user?.username}</h1>
        <p className="text-gray-500 mt-1">欢迎回来，这是您的资产管理概览</p>
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
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
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
