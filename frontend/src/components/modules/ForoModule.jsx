import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import { useCatalog } from '../../hooks/useCatalog';

const groupInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-navy-950 placeholder:text-slate-400 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 transition-colors';

const groupSectionTitle = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400';

export default function ForoModule() {
  const { user } = useAuth();
  const { departments } = useCatalog();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '', access_type: 'all', access_list: [] });
  const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '', access_type: 'all', access_list: [] });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // Vinculación de tickets/reuniones
  const [availableTickets, setAvailableTickets] = useState([]);
  const [availableMeetings, setAvailableMeetings] = useState([]);
  const [pickerType, setPickerType] = useState(null); // 'ticket' | 'meeting' | null
  const [pickerSearch, setPickerSearch] = useState('');
  const [pendingRef, setPendingRef] = useState(null); // { type, id, title }
  const [viewingRef, setViewingRef] = useState(null); // { type, data }
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef(null);

  const [joinRequests, setJoinRequests] = useState([]);
  const [showJoinRequestsPanel, setShowJoinRequestsPanel] = useState(false);

  // Helper: obtener los usuarios con acceso al grupo seleccionado (incluye aprobados por solicitud)
  const getGroupMembers = (group) => {
    if (!group || allUsers.length === 0) return [];
    let extraIds = [];
    try {
      extraIds =
        typeof group.extra_allowed_user_ids === 'string'
          ? JSON.parse(group.extra_allowed_user_ids || '[]')
          : group.extra_allowed_user_ids || [];
    } catch {
      extraIds = [];
    }
    const extraUsers = allUsers.filter((u) => extraIds.some((id) => Number(id) === Number(u.id)));

    const accessType = group.access_type || 'all';
    let accessList = [];
    try {
      accessList =
        typeof group.access_list === 'string'
          ? JSON.parse(group.access_list || '[]')
          : group.access_list || [];
    } catch {
      accessList = [];
    }

    if (accessType === 'all') {
      const byId = new Map(allUsers.map((u) => [u.id, u]));
      extraUsers.forEach((u) => byId.set(u.id, u));
      return Array.from(byId.values());
    }
    let base = [];
    if (accessType === 'department') {
      base = allUsers.filter((u) => accessList.includes(u.departamento));
    } else if (accessType === 'users') {
      base = allUsers.filter((u) => accessList.some((id) => Number(id) === Number(u.id)));
    }
    const byId = new Map(base.map((u) => [u.id, u]));
    extraUsers.forEach((u) => {
      if (!byId.has(u.id)) byId.set(u.id, u);
    });
    return Array.from(byId.values());
  };
  const accessTypeLabel = (type) => {
    if (type === 'department') return 'Por departamento';
    if (type === 'users') return 'Usuarios seleccionados';
    return 'Todo el equipo';
  };

  // Helper: detectar si una URL es de imagen
  const isImage = (url) => /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url || '');
  // Helper: formatear tamaño de archivo
  const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  // Helper: extraer referencias [[BOSA-REF:TYPE:ID]] del contenido
  const parseMessageContent = (content) => {
    if (!content) return { text: '', refs: [] };
    const refRegex = /\[\[BOSA-REF:(TICKET|MEETING):(\d+)\]\]/g;
    const refs = [];
    let m;
    while ((m = refRegex.exec(content)) !== null) {
      refs.push({ type: m[1].toLowerCase(), id: parseInt(m[2], 10) });
    }
    return { text: content.replace(refRegex, '').trim(), refs };
  };
  // Helper: obtener datos de una referencia
  const getRefData = (ref) => {
    if (ref.type === 'ticket') return availableTickets.find(t => t.id === ref.id);
    if (ref.type === 'meeting') return availableMeetings.find(m => m.id === ref.id);
    return null;
  };

  // Cargar grupos iniciales + tickets y reuniones para vincular
  useEffect(() => {
    fetchGroups();
    axios.get('/api/tickets').then(r => setAvailableTickets(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get('/api/meetings').then(r => setAvailableMeetings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  // Refrescar lista cuando se abre el selector
  useEffect(() => {
    if (pickerType === 'ticket') {
      axios.get('/api/tickets').then(r => setAvailableTickets(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    } else if (pickerType === 'meeting') {
      axios.get('/api/meetings').then(r => setAvailableMeetings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }
  }, [pickerType]);

  // Cargar todos los usuarios al montar (para mostrar miembros con acceso)
  useEffect(() => {
    axios.get('/api/users').then(res => setAllUsers(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const toggleAccessList = (item, isEdit = false) => {
    if (isEdit) {
      setEditGroupForm(f => ({
        ...f,
        access_list: f.access_list.includes(item) 
          ? f.access_list.filter(i => i !== item)
          : [...f.access_list, item]
      }));
    } else {
      setNewGroupForm(f => ({
        ...f,
        access_list: f.access_list.includes(item) 
          ? f.access_list.filter(i => i !== item)
          : [...f.access_list, item]
      }));
    }
  };

  // Polling para mensajes solo si hay acceso al foro
  useEffect(() => {
    setShowMembers(false); // cerrar popover al cambiar de grupo
    if (!selectedGroup || !selectedGroup.has_access) {
      setMessages([]);
      return;
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [selectedGroup]);

  // Solicitudes pendientes (creador / superadmin)
  useEffect(() => {
    if (!selectedGroup?.id || !selectedGroup.has_access) {
      setJoinRequests([]);
      setShowJoinRequestsPanel(false);
      return;
    }
    const isOwner =
      Number(selectedGroup.created_by) === Number(user?.id) || user?.role === 'superadmin';
    if (!isOwner) {
      setJoinRequests([]);
      return;
    }
    const load = () => {
      axios
        .get(`/api/forums/${selectedGroup.id}/join-requests`)
        .then((r) => setJoinRequests(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [selectedGroup?.id, selectedGroup?.has_access, selectedGroup?.created_by, user?.id, user?.role]);

  useEffect(() => {
    if (joinRequests.length === 0) setShowJoinRequestsPanel(false);
  }, [joinRequests.length]);

  // Scroll to bottom cuando hay nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/forums');
      const data = Array.isArray(res.data) ? res.data : [];
      setGroups(data);
      setSelectedGroup((prev) => {
        if (!prev) return prev;
        const up = data.find((g) => g.id === prev.id);
        return up || prev;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    try {
      const res = await axios.get(`/api/forums/${selectedGroup.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name) return;
    try {
      const res = await axios.post('/api/forums', {
        name: newGroupForm.name,
        description: newGroupForm.description,
        created_by: user.id,
        access_type: newGroupForm.access_type,
        access_list: newGroupForm.access_list
      });
      const created = { ...res.data, has_access: true, pending_join_request: false };
      setGroups([created, ...groups]);
      setIsCreatingGroup(false);
      setNewGroupForm({ name: '', description: '', access_type: 'all', access_list: [] });
      setSelectedGroup(created);
      PushEvents.forumGroupNew(res.data.name);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroupForm.name) return;
    try {
      const res = await axios.put(`/api/forums/${selectedGroup.id}`, {
        name: editGroupForm.name,
        description: editGroupForm.description,
        access_type: editGroupForm.access_type,
        access_list: editGroupForm.access_list
      });
      const updated = { ...res.data, has_access: true, pending_join_request: false };
      setGroups(groups.map((g) => (g.id === selectedGroup.id ? updated : g)));
      setSelectedGroup(updated);
      setIsEditingGroup(false);
      PushEvents.forumGroupEdit(res.data.name);
      fetchGroups();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el grupo');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${selectedGroup.name}" y todos sus mensajes? Esta acción no se puede deshacer.`)) return;
    try {
      const gName = selectedGroup.name;
      await axios.delete(`/api/forums/${selectedGroup.id}`);
      setGroups(groups.filter(g => g.id !== selectedGroup.id));
      setSelectedGroup(null);
      setIsEditingGroup(false);
      PushEvents.forumGroupDel(gName);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el grupo');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() && !fileInput && !pendingRef) return;

    let finalContent = messageInput.trim();
    if (pendingRef) {
      const refTag = `[[BOSA-REF:${pendingRef.type.toUpperCase()}:${pendingRef.id}]]`;
      finalContent = finalContent ? `${finalContent}\n${refTag}` : refTag;
    }

    const formData = new FormData();
    formData.append('user_id', user.id);
    formData.append('content', finalContent);
    if (fileInput) {
      formData.append('file', fileInput);
    }

    try {
      await axios.post(`/api/forums/${selectedGroup.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessageInput('');
      setFileInput(null);
      setPendingRef(null);
      fetchMessages();
      PushEvents.forumMessage(selectedGroup?.name || 'foro');
    } catch (err) {
      console.error(err);
      alert('Error al enviar mensaje');
    }
  };

  const handleSendJoinRequest = async () => {
    if (!selectedGroup) return;
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-request`);
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo enviar la solicitud');
    }
  };

  const handleApproveJoin = async (requestId) => {
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-requests/${requestId}/approve`);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo aceptar la solicitud');
    }
  };

  const handleRejectJoin = async (requestId) => {
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-requests/${requestId}/reject`);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo rechazar la solicitud');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-260px)] min-h-[400px] lg:h-[calc(100vh-140px)] lg:min-h-0 lg:gap-6 animate-fade-in">
      {/* Columna Izquierda: Lista de Grupos */}
      <div className={`w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex-col overflow-hidden ${selectedGroup ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 lg:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="font-display font-medium text-navy-950 text-base lg:text-lg">Foro & Equipos</h2>
            <p className="text-xs text-navy-500 mt-0.5">Comunidad · todos los foros visibles</p>
          </div>
          <button
            onClick={() => setIsCreatingGroup(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {groups.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No hay grupos creados</div>
          ) : (
            groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g)}
                className={`w-full text-left p-3 lg:p-4 rounded-xl transition-all border ${
                  selectedGroup?.id === g.id
                    ? 'bg-navy-900 border-navy-900 shadow-md lg:transform lg:scale-[1.02]'
                    : 'bg-white border-gray-100 hover:border-gold/30 hover:bg-gold/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-display font-bold text-lg ${
                    selectedGroup?.id === g.id ? 'bg-white/10 text-gold' : 'bg-navy-50 text-navy-900'
                  }`}>
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm truncate flex items-center gap-1.5 ${selectedGroup?.id === g.id ? 'text-white' : 'text-navy-950'}`}>
                      {g.has_access === false && (
                        <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} title="Sin acceso">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      <span className="truncate"># {g.name}</span>
                    </h3>
                    <p className={`text-xs truncate mt-0.5 ${selectedGroup?.id === g.id ? 'text-navy-200' : 'text-navy-500'}`}>
                      {g.has_access === false ? 'Restringido · solicita acceso al entrar' : (g.description || 'Sin descripción')}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Columna Derecha: Chat Area */}
      <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex-col overflow-hidden ${selectedGroup ? 'flex' : 'hidden lg:flex'}`}>
        {selectedGroup ? (
          selectedGroup.has_access ? (
          <>
            <div className="p-3 lg:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center gap-2">
              {/* Botón "regresar" — solo móvil */}
              <button
                onClick={() => setSelectedGroup(null)}
                className="lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors"
                title="Volver a la lista de grupos"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {joinRequests.length > 0 &&
                (user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id)) && (
                  <button
                    type="button"
                    onClick={() => setShowJoinRequestsPanel((s) => !s)}
                    className={`lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border text-[10px] font-black relative ${
                      showJoinRequestsPanel
                        ? 'bg-gold border-gold text-navy-950'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                    title="Solicitudes de ingreso"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-navy-950 text-gold text-[8px] flex items-center justify-center px-0.5">
                      {joinRequests.length}
                    </span>
                  </button>
                )}
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-navy-950 text-base lg:text-lg flex items-center gap-2 truncate">
                  <span className="text-gold flex-shrink-0">#</span><span className="truncate">{selectedGroup.name}</span>
                </h3>
                <p className="text-xs text-navy-500 mt-0.5 truncate">{selectedGroup.description}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {(() => {
                  const members = getGroupMembers(selectedGroup);
                  const visibleCount = 3;
                  const visible = members.slice(0, visibleCount);
                  const remaining = members.length - visible.length;
                  return (
                    <div className="hidden lg:block relative mr-2">
                      <button
                        type="button"
                        onClick={() => setShowMembers(s => !s)}
                        className="flex -space-x-2 hover:opacity-80 transition-opacity"
                        title="Ver miembros con acceso"
                      >
                        {visible.map((u, i) => (
                          <div
                            key={u.id}
                            title={`${u.name || ''} ${u.apellido || ''}${u.puesto ? ' · ' + u.puesto : ''}`}
                            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 hover:z-10 ${
                              i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-navy-100 text-navy-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                            style={{ zIndex: visibleCount - i }}
                          >
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {remaining > 0 && (
                          <div
                            title={`Y ${remaining} más`}
                            className="w-8 h-8 rounded-full bg-navy-950 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gold"
                          >
                            +{remaining}
                          </div>
                        )}
                        {members.length === 0 && (
                          <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-400">
                            0
                          </div>
                        )}
                      </button>

                      {showMembers && (
                        <>
                          {/* Click-outside backdrop */}
                          <div className="fixed inset-0 z-40" onClick={() => setShowMembers(false)} />
                          {/* Popover */}
                          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                              <div>
                                <h4 className="font-display font-bold text-navy-950 text-sm">Miembros con acceso</h4>
                                <p className="text-[10px] text-navy-600 mt-0.5 font-medium">{accessTypeLabel(selectedGroup.access_type)}</p>
                              </div>
                              <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded">{members.length}</span>
                            </div>
                            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                              {members.length === 0 ? (
                                <p className="text-center text-xs text-navy-500 py-6">Sin miembros con acceso</p>
                              ) : (
                                members.map(u => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gold/5 transition-colors text-left"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-700 flex-shrink-0">
                                      {(u.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-navy-950 truncate">
                                        {u.name} {u.apellido || ''}
                                      </p>
                                      <p className="text-[10px] text-navy-600 truncate">
                                        {u.puesto || u.departamento || u.email || '—'}
                                      </p>
                                    </div>
                                    {u.id === user?.id && (
                                      <span className="text-[8px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0">Tú</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                {joinRequests.length > 0 &&
                  (user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id)) && (
                    <button
                      type="button"
                      onClick={() => setShowJoinRequestsPanel((s) => !s)}
                      className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        showJoinRequestsPanel
                          ? 'bg-gold text-navy-950 border-gold'
                          : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      Solicitudes
                      <span className="min-w-[1.25rem] h-5 rounded-full bg-navy-950 text-gold text-[9px] flex items-center justify-center px-1">
                        {joinRequests.length}
                      </span>
                    </button>
                  )}
                {user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id) ? (
                  <button 
                    onClick={() => {
                      setEditGroupForm({
                        name: selectedGroup.name,
                        description: selectedGroup.description,
                        access_type: selectedGroup.access_type || 'all',
                        access_list: selectedGroup.access_list ? JSON.parse(selectedGroup.access_list) : []
                      });
                      setIsEditingGroup(true);
                    }}
                    className="text-gray-400 hover:text-gold transition-colors p-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                ) : null}
              </div>
            </div>

            {showJoinRequestsPanel && joinRequests.length > 0 && (
              <div className="border-b border-amber-200 bg-amber-50/90 px-3 py-3 lg:px-5 max-h-40 overflow-y-auto space-y-2">
                <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Solicitudes de ingreso</p>
                {joinRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-navy-950 truncate">
                        {r.name} {r.apellido || ''}
                      </p>
                      <p className="text-[10px] text-navy-500 truncate">{r.departamento || r.email || '—'}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveJoin(r.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectJoin(r.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-navy-700 text-[10px] font-black uppercase tracking-wide hover:bg-gray-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6 bg-[url('/pattern.png')] bg-repeat opacity-95">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                  <svg className="w-12 h-12 opacity-50 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  <p className="font-medium text-sm">Comienza la conversación en el grupo</p>
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 lg:gap-3 max-w-[85%] lg:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && (
                          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
                            {m.user_name.charAt(0)}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && <span className="text-[10px] font-bold text-navy-500 mb-1 ml-1">{m.user_name}</span>}
                          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isMe ? 'bg-navy-900 text-white rounded-br-none' : 'bg-white border border-gray-100 text-navy-900 rounded-bl-none'
                          }`}>
                            {(() => {
                              const { text, refs } = parseMessageContent(m.content);
                              return (
                                <>
                                  {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
                                  {refs.map((ref, idx) => {
                                    const data = getRefData(ref);
                                    const isTicket = ref.type === 'ticket';
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => data && setViewingRef({ type: ref.type, data })}
                                        className={`mt-2 first:mt-0 ${text ? 'mt-2' : ''} flex items-stretch gap-3 rounded-lg overflow-hidden text-left min-w-[220px] max-w-[280px] transition hover:opacity-90 ${
                                          isMe ? 'bg-navy-800/60 border border-gold/30' : 'bg-gray-50 border border-gray-200'
                                        }`}
                                      >
                                        <div className={`w-1 flex-shrink-0 ${isTicket ? 'bg-gold' : 'bg-emerald-500'}`} />
                                        <div className="flex-1 min-w-0 py-2 pr-2">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            {isTicket ? (
                                              <svg className={`w-3 h-3 ${isMe ? 'text-gold' : 'text-navy-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                                              </svg>
                                            ) : (
                                              <svg className={`w-3 h-3 ${isMe ? 'text-emerald-300' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                              </svg>
                                            )}
                                            <span className={`text-[9px] font-bold tracking-widest uppercase ${isMe ? 'text-gold' : 'text-navy-500'}`}>
                                              {isTicket ? `Ticket #${ref.id}` : 'Reunión'}
                                            </span>
                                          </div>
                                          {data ? (
                                            <>
                                              <p className={`text-xs font-bold leading-tight line-clamp-2 ${isMe ? 'text-white' : 'text-navy-950'}`}>
                                                {data.title || '—'}
                                              </p>
                                              <p className={`text-[10px] mt-0.5 truncate ${isMe ? 'text-white/60' : 'text-navy-500'}`}>
                                                {isTicket
                                                  ? `${(data.priority || '').toUpperCase()} · ${(data.status || '').replace('_',' ').toUpperCase()}`
                                                  : (data.start_time
                                                      ? `${new Date(data.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()} · ${new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                      : 'Sin fecha')
                                                }
                                              </p>
                                            </>
                                          ) : (
                                            <p className={`text-xs italic ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                              {isTicket ? 'Ticket no disponible' : 'Reunión no disponible'}
                                            </p>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </>
                              );
                            })()}
                            {m.file_url && (
                              <div className={m.content ? 'mt-2' : ''}>
                                {isImage(m.file_url) ? (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(m.file_url)}
                                    className="block group"
                                  >
                                    <img
                                      src={m.file_url}
                                      alt={m.file_name || 'imagen'}
                                      className="w-full max-w-[220px] lg:max-w-[280px] max-h-[280px] rounded-lg object-cover cursor-zoom-in border border-black/5 group-hover:opacity-90 transition"
                                    />
                                  </button>
                                ) : (
                                  <a
                                    href={m.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={m.file_name}
                                    className={`flex items-center gap-3 text-xs font-bold p-2.5 rounded-lg border min-w-[200px] hover:opacity-90 transition ${isMe ? 'bg-navy-800 border-navy-700 text-gold' : 'bg-gray-50 border-gray-200 text-navy-700'}`}
                                  >
                                    <div className={`w-9 h-9 flex-shrink-0 rounded flex items-center justify-center ${isMe ? 'bg-gold/15' : 'bg-navy-100'}`}>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="truncate">{m.file_name || 'Archivo'}</p>
                                      <p className={`text-[9px] font-normal ${isMe ? 'text-gold/70' : 'text-navy-400'}`}>Descargar</p>
                                    </div>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 mx-1">
                            {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 lg:p-4 bg-white border-t border-gray-100">
              {pendingRef && (
                <div className="mb-3 flex items-center gap-3 bg-navy-50 border border-navy-200 rounded-lg px-3 py-2 w-fit max-w-full">
                  <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${pendingRef.type === 'ticket' ? 'bg-gold/15 text-gold' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pendingRef.type === 'ticket' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-navy-500 tracking-widest uppercase">
                      {pendingRef.type === 'ticket' ? `Ticket #${pendingRef.id} vinculado` : 'Reunión vinculada'}
                    </p>
                    <p className="text-xs font-bold text-navy-900 truncate">{pendingRef.title || '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingRef(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Quitar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {fileInput && (
                <div className="mb-3 flex items-center gap-3 bg-gold/5 border border-gold/30 rounded-lg px-3 py-2 w-fit max-w-full">
                  {fileInput.type?.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(fileInput)}
                      alt="preview"
                      className="w-12 h-12 rounded object-cover border border-gold/40 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-navy-50 border border-navy-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-navy-900 truncate">{fileInput.name}</p>
                    <p className="text-[10px] font-medium text-navy-500">{formatSize(fileInput.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileInput(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Quitar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                {/* Botón Foto */}
                <label
                  title="Adjuntar foto"
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gold/10 text-gold hover:bg-gold hover:text-white cursor-pointer transition-colors border border-gold/30"
                >
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFileInput(e.target.files[0])} />
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </label>
                {/* Botón Archivo */}
                <label
                  title="Adjuntar archivo"
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-50 text-navy-500 hover:bg-navy-900 hover:text-gold cursor-pointer transition-colors border border-gray-200"
                >
                  <input type="file" className="hidden" onChange={(e) => setFileInput(e.target.files[0])} />
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </label>
                {/* Botón Vincular Ticket */}
                <button
                  type="button"
                  title="Vincular ticket"
                  onClick={() => { setPickerType('ticket'); setPickerSearch(''); }}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-50 text-navy-500 hover:bg-gold hover:text-white cursor-pointer transition-colors border border-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                  </svg>
                </button>
                {/* Botón Vincular Reunión */}
                <button
                  type="button"
                  title="Vincular reunión"
                  onClick={() => { setPickerType('meeting'); setPickerSearch(''); }}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-50 text-navy-500 hover:bg-emerald-500 hover:text-white cursor-pointer transition-colors border border-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </button>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-black font-medium focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold focus:bg-white transition-all max-h-32"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() && !fileInput && !pendingRef}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gold text-white disabled:opacity-50 hover:bg-yellow-500 transition-colors shadow-md"
                >
                  <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </>
          ) : (
            <>
              <div className="p-3 lg:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center gap-2">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors"
                  title="Volver a la lista de grupos"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-navy-950 text-base lg:text-lg flex items-center gap-2 truncate">
                    <span className="text-gold flex-shrink-0">#</span>
                    <span className="truncate">{selectedGroup.name}</span>
                  </h3>
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mt-0.5">
                    Foro restringido · sin acceso al chat
                  </p>
                  <p className="text-xs text-navy-500 mt-0.5 truncate">{selectedGroup.description}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[url('/pattern.png')] bg-repeat text-center gap-5">
                <div className="w-16 h-16 rounded-full bg-navy-900/90 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm text-navy-800 font-medium max-w-md leading-relaxed">
                  Este foro existe en la comunidad, pero solo quien tiene permiso puede ver los mensajes. Pide acceso al creador; cuando te acepte, el chat se desbloqueará aquí.
                </p>
                {selectedGroup.pending_join_request ? (
                  <p className="text-xs font-black text-gold uppercase tracking-widest bg-gold/10 border border-gold/30 px-4 py-2 rounded-xl">
                    Solicitud enviada · pendiente de aprobación
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendJoinRequest}
                    className="btn-gold px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-gold/20"
                  >
                    Solicitar acceso
                  </button>
                )}
              </div>
            </>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            <p className="font-medium">Selecciona o crea un grupo para comenzar a chatear</p>
          </div>
        )}
      </div>

      {/* Modal Crear Grupo */}
      {isCreatingGroup &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={() => setIsCreatingGroup(false)}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,42rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="foro-new-group-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                    <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.598 1.185 1.985l.383.179m.383-.179a23.97 23.97 0 011.503-.05c2.357 0 4.686.172 6.988.504 1.242.19 2.25-.982 2.25-2.213V10.013c0-1.23-.998-2.403-2.24-2.213a24.035 24.035 0 01-6.988-.504M16.5 13.36V7.86l-4.5 2.56v5.5l4.5-2.56z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Foro colaborativo</p>
                      <h2 id="foro-new-group-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                        Nuevo grupo de trabajo
                      </h2>
                      <p className="mt-1.5 text-sm text-white/55">Nombre, descripción y quién puede entrar al chat.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateGroup}>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
                  <section>
                    <h3 className={groupSectionTitle}>Identidad del grupo</h3>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre *</span>
                        <input
                          type="text"
                          autoFocus
                          required
                          value={newGroupForm.name}
                          onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                          className={groupInputClass}
                          placeholder="Ej. Proyecto Alpha"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Descripción</span>
                        <textarea
                          value={newGroupForm.description}
                          onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                          className={`${groupInputClass} min-h-[4.5rem] resize-y`}
                          placeholder="Objetivo del equipo o contexto del foro…"
                          rows={2}
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h3 className={groupSectionTitle}>Acceso al foro</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewGroupForm({ ...newGroupForm, access_type: 'all', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          newGroupForm.access_type === 'all'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Todo el equipo
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGroupForm({ ...newGroupForm, access_type: 'department', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          newGroupForm.access_type === 'department'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Departamentos
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGroupForm({ ...newGroupForm, access_type: 'users', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          newGroupForm.access_type === 'users'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Usuarios
                      </button>
                    </div>

                    {newGroupForm.access_type === 'department' && (
                      <div className="mt-4 max-h-40 grid grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-2">
                        {departments.map((d) => (
                          <button
                            type="button"
                            key={d}
                            onClick={() => toggleAccessList(d)}
                            className={`truncate rounded-lg border px-3 py-2 text-left text-[10px] font-semibold transition-all sm:text-[11px] ${
                              newGroupForm.access_list.includes(d)
                                ? 'border-gold bg-white text-gold shadow-sm ring-1 ring-gold/15'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}

                    {newGroupForm.access_type === 'users' && (
                      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        {allUsers.map((u) => (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => toggleAccessList(u.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold transition-all ${
                              newGroupForm.access_list.includes(u.id)
                                ? 'border-gold bg-white text-gold shadow-sm ring-1 ring-gold/15'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="min-w-0 truncate">
                              {u.name} {u.apellido}
                            </span>
                            <span className="shrink-0 text-[9px] uppercase text-slate-500">{u.departamento || 'Sin depto.'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newGroupForm.name}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 disabled:opacity-50 sm:min-w-[10rem]"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Crear grupo
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Editar Grupo */}
      {isEditingGroup &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={() => setIsEditingGroup(false)}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="foro-edit-group-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                    <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Configuración</p>
                      <h2 id="foro-edit-group-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                        Grupo de trabajo
                      </h2>
                      <p className="mt-1.5 text-sm text-white/55">Ajusta nombre, descripción y permisos de acceso.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingGroup(false)}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleUpdateGroup}>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
                  <section>
                    <h3 className={groupSectionTitle}>Identidad del grupo</h3>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre *</span>
                        <input
                          type="text"
                          autoFocus
                          required
                          value={editGroupForm.name}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                          className={groupInputClass}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Descripción</span>
                        <textarea
                          value={editGroupForm.description}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })}
                          className={`${groupInputClass} min-h-[4.5rem] resize-y`}
                          rows={2}
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h3 className={groupSectionTitle}>Acceso al foro</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, access_type: 'all', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          editGroupForm.access_type === 'all'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Todo el equipo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, access_type: 'department', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          editGroupForm.access_type === 'department'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Departamentos
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, access_type: 'users', access_list: [] })}
                        className={`flex-1 rounded-xl border py-3 text-[10px] font-bold uppercase tracking-wide transition-all sm:text-xs ${
                          editGroupForm.access_type === 'users'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Usuarios
                      </button>
                    </div>

                    {editGroupForm.access_type === 'department' && (
                      <div className="mt-4 max-h-40 grid grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-2">
                        {departments.map((d) => (
                          <button
                            type="button"
                            key={d}
                            onClick={() => toggleAccessList(d, true)}
                            className={`truncate rounded-lg border px-3 py-2 text-left text-[10px] font-semibold transition-all sm:text-[11px] ${
                              editGroupForm.access_list.includes(d)
                                ? 'border-gold bg-white text-gold shadow-sm ring-1 ring-gold/15'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}

                    {editGroupForm.access_type === 'users' && (
                      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        {allUsers.map((u) => (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => toggleAccessList(u.id, true)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold transition-all ${
                              editGroupForm.access_list.includes(u.id)
                                ? 'border-gold bg-white text-gold shadow-sm ring-1 ring-gold/15'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="min-w-0 truncate">
                              {u.name} {u.apellido}
                            </span>
                            <span className="shrink-0 text-[9px] uppercase text-slate-500">{u.departamento || 'Sin depto.'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="shrink-0 space-y-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-8">
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingGroup(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!editGroupForm.name}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 disabled:opacity-50 sm:min-w-[9rem]"
                    >
                      Guardar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-xs font-bold uppercase tracking-widest text-red-700 transition-colors hover:bg-red-100"
                  >
                    Eliminar grupo
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Selector — Vincular Ticket o Reunión */}
      {pickerType && (() => {
        const isTicket = pickerType === 'ticket';
        const items = isTicket ? availableTickets : availableMeetings;
        const filtered = items.filter(it => {
          const q = pickerSearch.trim().toLowerCase();
          if (!q) return true;
          return (it.title || '').toLowerCase().includes(q) || String(it.id).includes(q);
        });
        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setPickerType(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="font-display font-bold text-navy-950 text-base">
                    Vincular {isTicket ? 'ticket' : 'reunión'}
                  </h3>
                  <p className="text-xs text-navy-500 mt-0.5">Selecciona uno para adjuntarlo al mensaje</p>
                </div>
                <button onClick={() => setPickerType(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 pt-3 pb-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={isTicket ? "Buscar por título o #ID..." : "Buscar por título..."}
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy-900 outline-none focus:border-gold transition-colors"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">
                    {items.length === 0 ? `No hay ${isTicket ? 'tickets' : 'reuniones'} disponibles` : 'Sin resultados'}
                  </div>
                ) : (
                  filtered.map(it => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setPendingRef({ type: pickerType, id: it.id, title: it.title });
                        setPickerType(null);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 bg-white hover:border-gold/40 hover:bg-gold/5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${isTicket ? 'bg-gold/15 text-gold' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isTicket ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-bold tracking-widest uppercase text-navy-400">
                              {isTicket ? `#${it.id}` : new Date(it.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()}
                            </span>
                            {isTicket && it.priority && (
                              <span className="text-[9px] font-bold tracking-wider uppercase text-navy-500">{it.priority}</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-navy-950 leading-tight line-clamp-2">{it.title}</p>
                          <p className="text-[10px] text-navy-500 mt-1 truncate">
                            {isTicket
                              ? (it.category || 'Sin departamento')
                              : (it.start_time ? `${new Date(it.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(it.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '')
                            }
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Detalle — vista de un ticket o reunión vinculados */}
      {viewingRef && (() => {
        const isTicket = viewingRef.type === 'ticket';
        const data = viewingRef.data;
        return (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setViewingRef(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="bg-navy-950 px-6 py-5">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isTicket ? 'text-gold' : 'text-emerald-400'}`}>
                    {isTicket ? `Ticket #${data.id}` : 'Reunión'}
                  </span>
                  <button onClick={() => setViewingRef(null)} className="text-white/40 hover:text-white transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <h3 className="text-lg font-display font-medium text-white leading-tight">{data.title || '—'}</h3>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {data.description && (
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Descripción</p>
                    <p className="text-sm text-navy-800 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                      {data.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {isTicket ? (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Estado</p>
                        <p className="text-xs font-bold text-navy-950 capitalize">{(data.status || '').replace('_',' ')}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Prioridad</p>
                        <p className="text-xs font-bold text-navy-950 capitalize">{data.priority || '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Departamento</p>
                        <p className="text-xs font-bold text-navy-950">{data.category || '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Asignado</p>
                        <p className="text-xs font-bold text-navy-950 truncate">{data.assigned_name || 'Sin asignar'}</p>
                      </div>
                      {data.due_date && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Fecha límite</p>
                          <p className="text-xs font-bold text-navy-950">
                            {new Date(data.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Fecha</p>
                        <p className="text-xs font-bold text-navy-950">
                          {data.start_time ? new Date(data.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Horario</p>
                        <p className="text-xs font-bold text-navy-950">
                          {data.start_time ? `${new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(data.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                        </p>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Participantes</p>
                        <p className="text-xs font-bold text-navy-950">{Array.isArray(data.attendees) ? data.attendees.length : 0} asistentes</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setViewingRef(null)}
                  className="px-5 py-2 rounded-lg bg-navy-950 text-gold text-[10px] font-black uppercase tracking-widest hover:bg-navy-900 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox para imágenes */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="vista ampliada"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <a
            href={lightboxUrl}
            download
            onClick={e => e.stopPropagation()}
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Descargar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
