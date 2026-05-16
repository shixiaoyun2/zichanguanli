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
  Users,
  AlertCircle,
  PlusCircle,
  Edit2,
  Trash,
  GitMerge,
  Save,
  Combine
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import MessageModal from '../components/MessageModal';

interface UserData {
  id: number;
  username: string;
  role: 'admin' | 'operator';
  departments: string; // Comma separated IDs
}

interface Department {
  id: number;
  name: string;
}

export default function PeopleManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'operator'>('operator');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  
  // Dept management states
  const [isDeptAdding, setIsDeptAdding] = useState(false);
  const [deptNameInput, setDeptNameInput] = useState('');
  const [deptRenamingId, setDeptRenamingId] = useState<number | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeNewName, setMergeNewName] = useState('');

  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

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
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDept = async () => {
    if (!deptNameInput.trim()) return;
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ name: deptNameInput })
      });
      if (res.ok) {
        setDeptNameInput('');
        setIsDeptAdding(false);
        fetchDepts();
      } else {
        const data = await res.json();
        showModal('添加失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作失败', 'error');
    }
  };

  const handleRenameDept = async (id: number) => {
    if (!deptNameInput.trim()) return;
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ name: deptNameInput })
      });
      if (res.ok) {
        setDeptNameInput('');
        setDeptRenamingId(null);
        fetchDepts();
      } else {
        const data = await res.json();
        showModal('更名失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作失败', 'error');
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm('确定要删除该部门吗？')) return;
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchDepts();
      } else {
        const data = await res.json();
        showModal('删除失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作失败', 'error');
    }
  };

  const handleMergeDepts = async () => {
    if (!mergeNewName.trim()) return;
    try {
      const res = await fetch('/api/departments/merge', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ 
          sourceIds: selectedDeptIds.map(Number),
          newName: mergeNewName
        })
      });
      if (res.ok) {
        setMergeNewName('');
        setIsMergeModalOpen(false);
        setSelectedDeptIds([]);
        fetchDepts();
        fetchUsers();
        showModal('合并成功', '部门及资产关联已成功合并', 'success');
      } else {
        const data = await res.json();
        showModal('合并失败', data.message, 'error');
      }
    } catch (err) {
      showModal('网络错误', '无法完成合并', 'error');
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchDepts()]).finally(() => setLoading(false));
  }, []);

  const handleOpenEdit = (user: UserData) => {
    setEditingUser(user);
    setUsername(user.username);
    setRole(user.role);
    setSelectedDeptIds(user.departments ? user.departments.split(',') : []);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('operator');
    setSelectedDeptIds([]);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';
    
    const body = editingUser 
      ? { role, departments: selectedDeptIds.join(',') }
      : { username, password, role, departments: selectedDeptIds.join(',') };

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
        showModal('操作失败', data.message || '保存用户信息时出错', 'error');
      }
    } catch (err) {
      showModal('网络错误', '无法连接到服务器，请重试', 'error');
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
        showModal('删除失败', data.message || '无法删除该用户', 'error');
      }
    } catch (err) {
      showModal('网络错误', '连接服务失败', 'error');
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
        showModal('成功', '密码已重置', 'success');
        setIsResetModalOpen(false);
        setNewPassword('');
      } else {
        showModal('重置失败', '无法重置用户密码', 'error');
      }
    } catch (err) {
      showModal('网络错误', '操作超时，请重试', 'error');
    }
  };

  const toggleDept = (deptId: string) => {
    setSelectedDeptIds(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const getDeptName = (id: string) => {
    return departments.find(d => String(d.id) === id)?.name || `Dept ${id}`;
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
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 sm:hidden">
            {users.map((u) => (
              <div key={u.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{u.username}</span>
                        {u.id === currentUser?.id && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded leading-none">自己</span>
                        )}
                      </div>
                      <div className="mt-1">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            <Shield className="h-3 w-3 mr-1" />
                            管理员
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            操作员
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleOpenEdit(u)}
                      className="p-2 text-indigo-600 bg-indigo-50 rounded-lg active:scale-95 transition-transform"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingUser(u);
                        setIsResetModalOpen(true);
                      }}
                      className="p-2 text-amber-600 bg-amber-50 rounded-lg active:scale-95 transition-transform"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(u.id)}
                      disabled={u.id === currentUser?.id}
                      className="p-2 text-red-600 bg-red-50 rounded-lg disabled:opacity-30 active:scale-95 transition-transform"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">管辖部门</p>
                  <div className="flex flex-wrap gap-1.5">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-gray-400 italic">全系统权限</span>
                    ) : u.departments ? (
                      u.departments.split(',').map(did => (
                        <span key={did} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-100">
                          {getDeptName(did)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-amber-500 font-medium">无管辖部门</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                          u.departments.split(',').map(did => (
                            <span key={did} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                              {getDeptName(did)}
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
                          <Edit2 className="h-4 w-4" />
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
        </>
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
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="block text-sm font-medium text-gray-700">
                          管辖部门 (多选)
                          <span className="text-[10px] text-gray-400 font-normal ml-2">勾选后该用户可编辑对应部门资产</span>
                        </label>
                        <div className="flex items-center gap-2">
                           {selectedDeptIds.length >= 2 && (
                             <button 
                              type="button" 
                              onClick={() => setIsMergeModalOpen(true)}
                              className="inline-flex items-center text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold hover:bg-amber-100"
                            >
                              <GitMerge className="h-3 w-3 mr-1" />
                              合并选中
                            </button>
                           )}
                           <button 
                            type="button" 
                            onClick={() => {
                              setIsDeptAdding(true);
                              setDeptNameInput('');
                              setDeptRenamingId(null);
                            }}
                            className="text-indigo-600 hover:text-indigo-700 p-1"
                            title="新增部门"
                          >
                            <PlusCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        {(isDeptAdding || deptRenamingId) && (
                          <div className="p-3 bg-indigo-50/50 border-b border-indigo-100 flex gap-2">
                             <input 
                              type="text" 
                              autoFocus
                              placeholder={isDeptAdding ? "输入新部门名称..." : "输入新部门名称..."}
                              value={deptNameInput}
                              onChange={e => setDeptNameInput(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-sm bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                             />
                             <button 
                              type="button" 
                              onClick={isDeptAdding ? handleCreateDept : () => handleRenameDept(deptRenamingId!)}
                              className="bg-indigo-600 text-white p-2 rounded-lg"
                             >
                               <Save className="h-4 w-4" />
                             </button>
                             <button 
                              type="button" 
                              onClick={() => {
                                setIsDeptAdding(false);
                                setDeptRenamingId(null);
                              }}
                              className="text-gray-400 p-2"
                             >
                               <X className="h-4 w-4" />
                             </button>
                          </div>
                        )}
                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                          {departments.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">
                              暂无部门数据，请在资产录入时新增部门
                            </div>
                          ) : (
                            departments.map(dept => {
                              const sId = String(dept.id);
                              return (
                                <div key={dept.id} className="flex items-center px-4 py-2 hover:bg-gray-50 group/item">
                                  <label className="flex items-center flex-1 cursor-pointer py-1">
                                    <input 
                                      type="checkbox"
                                      checked={selectedDeptIds.includes(sId)}
                                      onChange={() => toggleDept(sId)}
                                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <span className="ml-3 text-sm text-gray-700 flex-1">{dept.name}</span>
                                    {selectedDeptIds.includes(sId) && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                                  </label>
                                  <div className="hidden group-hover/item:flex items-center gap-1 ml-2">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setDeptRenamingId(dept.id);
                                        setDeptNameInput(dept.name);
                                        setIsDeptAdding(false);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteDept(dept.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded"
                                    >
                                      <Trash className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
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
      {/* Merge Departments Modal */}
      <AnimatePresence>
        {isMergeModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMergeModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                  <Combine className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">合并部门</h3>
                  <p className="text-xs text-gray-500">将选中的 {selectedDeptIds.length} 个部门合并</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">新部门名称</label>
                  <input 
                    type="text" 
                    required 
                    autoFocus
                    placeholder="请输入合并后的名称..."
                    value={mergeNewName}
                    onChange={e => setMergeNewName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    注意：合并后原部门的所有资产将更新为新名称。
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsMergeModalOpen(false)} className="flex-1 py-3 text-sm text-gray-500 font-bold">取消</button>
                  <button 
                    onClick={handleMergeDepts}
                    disabled={!mergeNewName.trim()}
                    className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    开始合并
                  </button>
                </div>
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
