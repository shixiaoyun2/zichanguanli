import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Shield, 
  User, 
  MoreVertical, 
  Trash2, 
  Key, 
  X,
  Building,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  departments: string; // Comma separated
}

export default function PeopleManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'operator'>('operator');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepts = async () => {
    try {
      const res = await fetch('/api/users/departments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.map((d: any) => d.name));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchDepts()]).finally(() => setLoading(false));
  }, []);

  const handleOpenEdit = (user: UserData) => {
    setEditingUser(user);
    setUsername(user.username);
    setRole(user.role);
    setSelectedDepts(user.departments ? user.departments.split(',') : []);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('operator');
    setSelectedDepts([]);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';
    
    const body = editingUser 
      ? { role, departments: selectedDepts.join(',') }
      : { username, password, role, departments: selectedDepts.join(',') };

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || '操作失败');
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该用户吗？此操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || '删除失败');
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}/reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (res.ok) {
        alert('密码重置成功');
        setIsResetModalOpen(false);
        setNewPassword('');
      } else {
        alert('重置失败');
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">人员管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理系统用户信息及管辖部门权限</p>
        </div>
        
        <button 
          onClick={handleOpenCreate}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          新增人员
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">管辖部门</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-indigo-50 rounded-full flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{u.username}</span>
                      {u.id === currentUser?.id && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded leading-none">自己</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Shield className="h-3 w-3 mr-1" />
                        管理员
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        操作员
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-gray-400 italic">全系统权限</span>
                      ) : u.departments ? (
                        u.departments.split(',').map(d => (
                          <span key={d} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-amber-500 font-medium">无管辖部门</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="编辑资料"
                      >
                        <User className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingUser(u);
                          setIsResetModalOpen(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        title="重置密码"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === currentUser?.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30"
                        title="删除账号"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">{editingUser ? '编辑人员' : '新增人员'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <input 
                      type="text" 
                      required 
                      disabled={!!editingUser}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:bg-gray-100"
                    />
                  </div>

                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">初始密码</label>
                      <input 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">系统身份</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('operator')}
                        className={cn(
                          "px-4 py-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center gap-2",
                          role === 'operator' 
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-500/20" 
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <Users className="h-5 w-5" />
                        普通操作员
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={cn(
                          "px-4 py-3 rounded-xl border text-sm font-bold transition-all flex flex-col items-center gap-2",
                          role === 'admin' 
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-500/20" 
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <Shield className="h-5 w-5" />
                        系统管理员
                      </button>
                    </div>
                  </div>

                  {role === 'operator' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        管辖部门 (多选)
                        <span className="text-[10px] text-gray-400 font-normal ml-2">勾选后该用户可编辑对应部门资产</span>
                      </label>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                          {departments.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">
                              暂无部门数据，请在资产录入时新增部门
                            </div>
                          ) : (
                            departments.map(dept => (
                              <label key={dept} className="flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={selectedDepts.includes(dept)}
                                  onChange={() => toggleDept(dept)}
                                  className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-3 text-sm text-gray-700 flex-1">{dept}</span>
                                {selectedDepts.includes(dept) && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium">取消</button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    保存提交
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {isResetModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6"
            >
              <h3 className="font-bold text-gray-900 border-b pb-3 mb-4">重置用户密码</h3>
              <p className="text-xs text-gray-500 mb-4">
                正在为 <span className="font-bold text-gray-800">{editingUser.username}</span> 设置新密码
              </p>
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">新密码</label>
                  <input 
                    type="password" 
                    required 
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsResetModalOpen(false)} className="text-sm text-gray-500 px-3">取消</button>
                  <button 
                    type="submit"
                    className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-200"
                  >
                    确认修改
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
