import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const DEPARTAMENTOS = [
  'Obra Civil','Proyectos','Diseño','Acabados','Eléctricos',
  'HVAC','Hidrosanitarios','Sistemas','Contabilidad','Finanzas',
  'Recursos Humanos','Jurídico','Compras','Costos','Operaciones',
  'Mantenimiento','Almacén','Marketing','Restaurantes','Berry Yum'
];

export default function ForoModule() {
  const { user } = useAuth();
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
  const messagesEndRef = useRef(null);

  // Helper: detectar si una URL es de imagen
  const isImage = (url) => /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url || '');
  // Helper: formatear tamaño de archivo
  const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  // Cargar grupos iniciales
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if ((isCreatingGroup || isEditingGroup) && allUsers.length === 0) {
      axios.get('/api/users').then(res => setAllUsers(res.data)).catch(console.error);
    }
  }, [isCreatingGroup, isEditingGroup]);

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

  // Polling para mensajes del grupo seleccionado
  useEffect(() => {
    if (!selectedGroup) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [selectedGroup]);

  // Scroll to bottom cuando hay nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/forums');
      setGroups(res.data);
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
      setGroups([res.data, ...groups]);
      setIsCreatingGroup(false);
      setNewGroupForm({ name: '', description: '', access_type: 'all', access_list: [] });
      setSelectedGroup(res.data);
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
      setGroups(groups.map(g => g.id === selectedGroup.id ? res.data : g));
      setSelectedGroup(res.data);
      setIsEditingGroup(false);
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el grupo');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${selectedGroup.name}" y todos sus mensajes? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/forums/${selectedGroup.id}`);
      setGroups(groups.filter(g => g.id !== selectedGroup.id));
      setSelectedGroup(null);
      setIsEditingGroup(false);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el grupo');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() && !fileInput) return;

    const formData = new FormData();
    formData.append('user_id', user.id);
    formData.append('content', messageInput);
    if (fileInput) {
      formData.append('file', fileInput);
    }

    try {
      await axios.post(`/api/forums/${selectedGroup.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessageInput('');
      setFileInput(null);
      fetchMessages();
    } catch (err) {
      console.error(err);
      alert('Error al enviar mensaje');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-260px)] min-h-[400px] lg:h-[calc(100vh-140px)] lg:min-h-0 lg:gap-6 animate-fade-in">
      {/* Columna Izquierda: Lista de Grupos */}
      <div className={`w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex-col overflow-hidden ${selectedGroup ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 lg:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="font-display font-medium text-navy-950 text-base lg:text-lg">Foro & Equipos</h2>
            <p className="text-xs text-navy-500 mt-0.5">Grupos de Trabajo</p>
          </div>
          <button
            onClick={() => setIsCreatingGroup(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                    <h3 className={`font-bold text-sm truncate ${selectedGroup?.id === g.id ? 'text-white' : 'text-navy-950'}`}>
                      # {g.name}
                    </h3>
                    <p className={`text-xs truncate mt-0.5 ${selectedGroup?.id === g.id ? 'text-navy-200' : 'text-navy-500'}`}>
                      {g.description || 'Sin descripción'}
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
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-navy-950 text-base lg:text-lg flex items-center gap-2 truncate">
                  <span className="text-gold flex-shrink-0">#</span><span className="truncate">{selectedGroup.name}</span>
                </h3>
                <p className="text-xs text-navy-500 mt-0.5 truncate">{selectedGroup.description}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="hidden lg:flex -space-x-2 mr-2">
                  {/* Simulated active users indicator */}
                  <div className="w-8 h-8 rounded-full bg-navy-100 border-2 border-white flex items-center justify-center text-xs font-bold text-navy-600">A</div>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-600">S</div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">+</div>
                </div>
                {user?.role === 'superadmin' || selectedGroup.created_by === user?.id ? (
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
                            {m.content && <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
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
                  disabled={!messageInput.trim() && !fileInput}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gold text-white disabled:opacity-50 hover:bg-yellow-500 transition-colors shadow-md"
                >
                  <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            <p className="font-medium">Selecciona o crea un grupo para comenzar a chatear</p>
          </div>
        )}
      </div>

      {/* Modal Crear Grupo */}
      {isCreatingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-navy-950 text-lg">Nuevo Grupo de Trabajo</h3>
              <button onClick={() => setIsCreatingGroup(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Nombre del Grupo</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newGroupForm.name}
                  onChange={e => setNewGroupForm({...newGroupForm, name: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-black font-medium focus:outline-none focus:border-gold transition-colors"
                  placeholder="Ej. Proyecto Alpha"
                />
              </div>
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Descripción</label>
                <textarea 
                  value={newGroupForm.description}
                  onChange={e => setNewGroupForm({...newGroupForm, description: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-black font-medium focus:outline-none focus:border-gold transition-colors resize-none"
                  placeholder="Objetivo de este equipo..."
                  rows={2}
                />
              </div>
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Tipo de Acceso</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewGroupForm({...newGroupForm, access_type: 'all', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${newGroupForm.access_type === 'all' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Todos</button>
                  <button type="button" onClick={() => setNewGroupForm({...newGroupForm, access_type: 'department', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${newGroupForm.access_type === 'department' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Depto.</button>
                  <button type="button" onClick={() => setNewGroupForm({...newGroupForm, access_type: 'users', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${newGroupForm.access_type === 'users' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Usuarios</button>
                </div>
                
                {newGroupForm.access_type === 'department' && (
                  <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2 pr-1 mt-3">
                    {DEPARTAMENTOS.map(d => (
                      <button type="button" key={d} onClick={() => toggleAccessList(d)} className={`text-left px-3 py-2 rounded-lg border text-[10px] font-bold truncate ${newGroupForm.access_list.includes(d) ? 'border-gold bg-gold/10 text-gold shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {newGroupForm.access_type === 'users' && (
                  <div className="max-h-32 overflow-y-auto grid grid-cols-1 gap-2 pr-1 mt-3">
                    {allUsers.map(u => (
                      <button type="button" key={u.id} onClick={() => toggleAccessList(u.id)} className={`text-left px-3 py-2 rounded-lg border text-[11px] font-bold flex justify-between items-center ${newGroupForm.access_list.includes(u.id) ? 'border-gold bg-gold/10 text-gold shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <span>{u.name} {u.apellido}</span>
                        <span className="text-[9px] opacity-60 uppercase">{u.departamento || 'Sin Depto'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreatingGroup(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-navy-600 font-bold text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!newGroupForm.name} className="flex-1 py-2.5 rounded-xl bg-gold text-white font-bold text-sm hover:bg-yellow-500 disabled:opacity-50 transition-colors shadow-md">
                  Crear Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Grupo */}
      {isEditingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-navy-950 text-lg">Configuración del Grupo</h3>
              <button onClick={() => setIsEditingGroup(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleUpdateGroup} className="p-6 space-y-4">
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Nombre del Grupo</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={editGroupForm.name}
                  onChange={e => setEditGroupForm({...editGroupForm, name: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-black font-medium focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Descripción</label>
                <textarea 
                  value={editGroupForm.description}
                  onChange={e => setEditGroupForm({...editGroupForm, description: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-black font-medium focus:outline-none focus:border-gold transition-colors resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="font-label font-bold text-navy-900 text-[10px] tracking-wider uppercase mb-1.5 block">Tipo de Acceso</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditGroupForm({...editGroupForm, access_type: 'all', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${editGroupForm.access_type === 'all' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Todos</button>
                  <button type="button" onClick={() => setEditGroupForm({...editGroupForm, access_type: 'department', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${editGroupForm.access_type === 'department' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Depto.</button>
                  <button type="button" onClick={() => setEditGroupForm({...editGroupForm, access_type: 'users', access_list: []})} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${editGroupForm.access_type === 'users' ? 'bg-gold/10 border-gold text-gold' : 'border-gray-200 text-gray-500'}`}>Usuarios</button>
                </div>
                
                {editGroupForm.access_type === 'department' && (
                  <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2 pr-1 mt-3">
                    {DEPARTAMENTOS.map(d => (
                      <button type="button" key={d} onClick={() => toggleAccessList(d, true)} className={`text-left px-3 py-2 rounded-lg border text-[10px] font-bold truncate ${editGroupForm.access_list.includes(d) ? 'border-gold bg-gold/10 text-gold shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {editGroupForm.access_type === 'users' && (
                  <div className="max-h-32 overflow-y-auto grid grid-cols-1 gap-2 pr-1 mt-3">
                    {allUsers.map(u => (
                      <button type="button" key={u.id} onClick={() => toggleAccessList(u.id, true)} className={`text-left px-3 py-2 rounded-lg border text-[11px] font-bold flex justify-between items-center ${editGroupForm.access_list.includes(u.id) ? 'border-gold bg-gold/10 text-gold shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <span>{u.name} {u.apellido}</span>
                        <span className="text-[9px] opacity-60 uppercase">{u.departamento || 'Sin Depto'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsEditingGroup(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-navy-600 font-bold text-sm hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={!editGroupForm.name} className="flex-1 py-2.5 rounded-xl bg-gold text-white font-bold text-sm hover:bg-yellow-500 disabled:opacity-50 transition-colors shadow-md">
                    Guardar
                  </button>
                </div>
                <button type="button" onClick={handleDeleteGroup} className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-colors mt-2">
                  Eliminar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
