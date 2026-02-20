import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Calendar as CalendarIcon, 
  BarChart2, 
  User, 
  Check, 
  Flame, 
  Droplets, 
  Pill, 
  AlertCircle, 
  ChevronRight,
  ArrowLeft,
  ZapOff,
  Frown,
  Coffee,
  Share
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Configuração do Firebase protegida
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'endo-app-default';

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Erro ao iniciar Firebase:", error);
}

// --- PALETA DE CORES ORCHI ---
const theme = {
  main: '#76587A',      // Roxo Escuro Principal
  sec1: '#BEA9C1',      // Lilás
  sec2: '#FFDF7E',      // Amarelo Pastel
  alert: '#F09B92',     // Rosa Salmão para Dor/Alerta
  textMuted: '#9B8D9D', // Texto Secundário
  textDark: '#2C2D3E',  // Texto Principal
  bgLight: '#FCFAFC',   // Fundo Geral
  bgGradient: 'linear-gradient(180deg, #F9F3F6 0%, #FCFAFC 40%)' 
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  
  // Estados do Formulário
  const [quickFeeling, setQuickFeeling] = useState(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [medStatus, setMedStatus] = useState('took'); 
  const [sosMed, setSosMed] = useState('');
  
  // Dados e Estado
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(new Date());

  // 1. Auth Effect (Fallback para LocalStorage)
  useEffect(() => {
    if (!auth) {
      setUser({ uid: 'local-offline-user' });
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Firebase ou LocalStorage)
  useEffect(() => {
    if (!user) return;
    
    if (!db || user.uid === 'local-offline-user') {
      const localData = JSON.parse(localStorage.getItem('endo_logs') || '[]');
      setHistory(localData);
      setLoading(false);
      return;
    }

    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setHistory(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar dados:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const toggleSymptom = (sym) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const handleSaveLog = async () => {
    setSaving(true);
    
    let painLevel = 0;
    if (selectedSymptoms.includes('Cólicas Fortes')) painLevel = 8;
    else if (selectedSymptoms.includes('Cólicas Leves')) painLevel = 4;
    else if (quickFeeling === 'cramps') painLevel = 6;

    let bleeding = 'none';
    if (selectedSymptoms.includes('Escape (Spotting)')) bleeding = 'spotting';
    else if (selectedSymptoms.includes('Fluxo Intenso')) bleeding = 'heavy';

    const todayISO = new Date().toISOString().split('T')[0];

    const newLog = {
      dateISO: todayISO,
      dateLabel: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date()),
      pain: painLevel,
      bleeding,
      daily: medStatus === 'took',
      feeling: quickFeeling,
      symptoms: selectedSymptoms,
      sos: sosMed || null,
      timestamp: { seconds: Math.floor(Date.now() / 1000) }
    };

    // Salvar Local
    if (!db || user.uid === 'local-offline-user') {
      const localData = JSON.parse(localStorage.getItem('endo_logs') || '[]');
      const logWithId = { id: Date.now().toString(), ...newLog };
      
      // Atualiza o registo se for do mesmo dia, ou adiciona novo
      const filteredData = localData.filter(l => l.dateISO !== todayISO);
      const updated = [logWithId, ...filteredData].sort((a,b) => b.timestamp.seconds - a.timestamp.seconds);
      
      localStorage.setItem('endo_logs', JSON.stringify(updated));
      setHistory(updated);
      
      setTimeout(() => {
        setQuickFeeling(null);
        setSelectedSymptoms([]);
        setMedStatus('took');
        setSosMed('');
        setSaving(false);
        setView('home');
      }, 500);
      return;
    }

    // Salvar Firebase (se estiver configurado)
    try {
      const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
      await addDoc(logsRef, { ...newLog, timestamp: serverTimestamp() });
      setTimeout(() => {
        setQuickFeeling(null);
        setSelectedSymptoms([]);
        setMedStatus('took');
        setSosMed('');
        setSaving(false);
        setView('home');
      }, 500);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setSaving(false);
    }
  };

  // Exportação para WhatsApp
  const exportToWhatsApp = () => {
    let text = `*Relatório EndoTrack*\n`;
    text += `Paciente: Mariana\n`;
    text += `Tratamento: Elani 28 (Contínuo)\n`;
    text += `Dias registados: ${history.length}\n\n`;
    
    const avgPain = history.length ? (history.reduce((a, b) => a + b.pain, 0) / history.length).toFixed(1) : 0;
    const spottingDays = history.filter(h => h.bleeding !== 'none').length;
    
    text += `*Resumo Geral:*\n`;
    text += `- Média de dor pélvica: ${avgPain}/10\n`;
    text += `- Dias com escape/fluxo: ${spottingDays}\n\n`;
    
    text += `*Últimos 7 dias de registo:*\n`;
    history.slice(0, 7).forEach(log => {
      const bleedText = log.bleeding === 'none' ? 'Sem escape' : (log.bleeding === 'spotting' ? 'Escape leve' : 'Fluxo intenso');
      text += `- ${log.dateLabel}: Dor ${log.pain}/10 | ${bleedText} | SOS: ${log.sos || 'Não'}\n`;
    });
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // --- LÓGICA DO CALENDÁRIO ---
  const currentMonth = selectedDateObj.getMonth();
  const currentYear = selectedDateObj.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); 
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const selectedISODate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDateObj.getDate()).padStart(2, '0')}`;
  const logForSelectedDate = history.find(log => log.dateISO === selectedISODate);

  const currentTreatmentDay = history.length + 1;
  let treatmentPhase = "Fase de Adaptação";
  if (currentTreatmentDay > 30) treatmentPhase = "Fase de Estabilização";
  if (currentTreatmentDay > 90) treatmentPhase = "Fase de Controlo";

  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.bgLight, color: theme.main }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>
        <div className="animate-pulse font-semibold tracking-widest text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>A Carregar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 relative overflow-x-hidden selection:bg-[#BEA9C1]/30" style={{ background: theme.bgGradient, fontFamily: "'Poppins', sans-serif", color: theme.textDark }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* --- VIEW: HOME (DASHBOARD) --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="px-6 pt-14 pb-4 flex justify-between items-start">
            <div>
              <p className="text-[13px] font-medium mb-1 tracking-wide" style={{ color: theme.textMuted }}>Olá, Mariana</p>
              <h1 className="text-[26px] font-bold tracking-tight leading-tight mt-1" style={{ color: theme.textDark }}>
                Pronta para um<br/>bom dia ?
              </h1>
            </div>
            <div className="w-14 h-14 rounded-full overflow-hidden border-[3px] shadow-sm flex items-center justify-center bg-[#FFF1ED]" style={{ borderColor: '#FFF' }}>
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Mariana&backgroundColor=FFF1ED" alt="Avatar" className="w-full h-full object-cover scale-110 translate-y-1" />
            </div>
          </header>

          <div className="px-6 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar">
            {(() => {
              const current = currentTreatmentDay;
              let startDay = current - 2;
              if (startDay < 1) startDay = 1;
              const days = [];
              for (let i = 0; i < 5; i++) {
                const dayNum = startDay + i;
                if (dayNum < current) days.push({ id: `d${dayNum}`, label: `Dia ${dayNum}`, state: 'past' });
                else if (dayNum === current) days.push({ id: `today`, label: 'Hoje', state: 'today' });
                else days.push({ id: `d${dayNum}`, label: `Dia ${dayNum}`, state: 'future' });
              }
              return days;
            })().map((d, i) => (
              <div key={i} className="flex flex-col items-center justify-center min-w-[56px] h-[80px] rounded-full transition-all shadow-sm"
                   style={{ 
                     backgroundColor: d.state === 'today' ? theme.main : '#FFFFFF',
                     border: d.state === 'today' ? 'none' : '1px solid #F0EAF1',
                     opacity: d.state === 'future' ? 0.6 : 1
                   }}>
                <span className="text-[11px] font-medium mb-2" style={{ color: d.state === 'today' ? '#FFF' : theme.textDark }}>
                  {d.label}
                </span>
                {d.state === 'today' ? (
                  <div className="w-[22px] h-[22px] rounded-full border border-dashed flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.8)' }}>
                    <div className="w-[10px] h-[10px] bg-white rounded-full"></div>
                  </div>
                ) : d.state === 'past' ? (
                  <div className="w-[22px] h-[22px] rounded-full bg-[#F4EFF5] flex items-center justify-center">
                    <Check size={12} style={{ color: theme.textDark }} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center">
                    <Check size={12} style={{ color: '#EBE5EC' }} strokeWidth={3} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-6 mt-6">
            <div className="w-full bg-white rounded-[2rem] p-6 pb-8 relative overflow-hidden shadow-[0_10px_40px_rgba(118,88,122,0.06)]">
              <div className="relative w-full aspect-[2/1] overflow-hidden mb-6 flex items-end justify-center">
                <svg viewBox="0 0 200 100" className="absolute top-0 w-full h-full drop-shadow-sm">
                  <path d="M 20 90 A 70 70 0 0 1 180 90" fill="none" stroke="#F4EFF5" strokeWidth="14" strokeLinecap="round" />
                  <path d="M 20 90 A 70 70 0 0 1 60 35" fill="none" stroke={theme.main} strokeWidth="14" strokeLinecap="round" strokeDasharray="90 200" />
                  <path d="M 60 35 A 70 70 0 0 1 130 23" fill="none" stroke={theme.alert} strokeWidth="14" strokeLinecap="round" strokeDasharray="80 200" />
                  <path d="M 130 23 A 70 70 0 0 1 180 90" fill="none" stroke={theme.sec1} strokeWidth="14" strokeLinecap="round" strokeDasharray="90 200" />
                  
                  {(() => {
                    const maxDays = 90; 
                    const progress = Math.min(currentTreatmentDay / maxDays, 1);
                    const angle = -75 + (progress * 150); 
                    return (
                      <polygon 
                        points="100,18 90,0 110,0" 
                        fill={theme.textDark} 
                        className="drop-shadow-md transition-all duration-1000" 
                        style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 90px' }} 
                      />
                    );
                  })()}
                </svg>
                <div className="text-center z-10 mb-[-10px]">
                  <h2 className="text-[32px] font-bold tracking-tight" style={{ color: theme.textDark }}>Dia {currentTreatmentDay}</h2>
                  <p className="text-[13px] font-medium mt-0" style={{ color: theme.textMuted }}>{treatmentPhase}</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 flex-wrap mt-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.main }}></div><span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>Adaptação</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.alert }}></div><span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>Estabilização</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.sec1 }}></div><span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>Controlo</span></div>
              </div>
            </div>
          </div>

          <div className="px-6 mt-8">
            <button 
              onClick={() => setView('log')}
              className="w-full py-4 rounded-full text-[16px] font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: theme.textDark, boxShadow: `0 8px 25px rgba(44,45,62,0.2)` }}
            >
              Registar Sintomas
            </button>
          </div>
        </div>
      )}

      {/* --- VIEW: SMART CALENDAR --- */}
      {view === 'calendar' && (
        <div className="animate-in fade-in duration-300">
          <header className="px-6 pt-14 pb-2 flex items-center justify-between sticky top-0 z-10">
            <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-black/5">
              <ArrowLeft size={24} style={{ color: theme.textDark }} />
            </button>
            <h2 className="text-[17px] font-semibold" style={{ color: theme.textDark }}>Calendário</h2>
            <div className="w-10"></div>
          </header>

          <div className="px-6 pt-4 pb-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(118,88,122,0.06)] mb-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[18px] font-bold" style={{ color: theme.textDark }}>
                  {selectedDateObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                </span>
                <div className="flex gap-4">
                  <button onClick={() => setSelectedDateObj(new Date(currentYear, currentMonth - 1, 1))} className="text-[#9B8D9D] hover:text-[#2C2D3E]"><ChevronLeft size={20} /></button>
                  <button onClick={() => setSelectedDateObj(new Date(currentYear, currentMonth + 1, 1))} className="text-[#9B8D9D] hover:text-[#2C2D3E]"><ChevronRight size={20} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-6 mb-4 text-center">
                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, idx) => (
                  <span key={idx} className="text-[11px] font-medium" style={{ color: theme.textMuted }}>{day}</span>
                ))}

                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  
                  const isSelected = day === selectedDateObj.getDate();
                  const dateISO = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const hasLog = history.find(l => l.dateISO === dateISO);
                  
                  return (
                    <div 
                      key={day} 
                      onClick={() => setSelectedDateObj(new Date(currentYear, currentMonth, day))}
                      className="relative flex flex-col items-center justify-center cursor-pointer"
                    >
                      <div className={`w-[32px] h-[32px] rounded-full flex items-center justify-center text-[14px] transition-all ${isSelected ? 'border border-dashed' : ''}`}
                           style={{ 
                             borderColor: isSelected ? theme.main : 'transparent',
                             color: isSelected ? theme.main : theme.textDark,
                             fontWeight: isSelected ? '700' : '500'
                           }}>
                        {day}
                      </div>
                      
                      <div className="absolute -bottom-2 flex gap-1">
                        {hasLog?.daily && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: theme.sec1 }}></div>}
                        {hasLog?.pain > 4 && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: theme.alert }}></div>}
                        {hasLog?.bleeding !== 'none' && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: theme.main }}></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="animate-in slide-in-from-bottom-4">
              <h3 className="text-[18px] font-bold mb-4" style={{ color: theme.textDark }}>
                {selectedDateObj.toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              
              {!logForSelectedDate ? (
                <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-[#F4EFF5] text-center">
                  <p className="text-[14px]" style={{ color: theme.textMuted }}>Nenhum registo neste dia.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_5px_15px_rgba(118,88,122,0.04)]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#F8F4F9' }}><Pill size={16} color={theme.main} /></div>
                      <span className="text-[12px] font-bold" style={{ color: theme.textDark }}>Tratamento</span>
                    </div>
                    <p className="text-[12px]" style={{ color: theme.textMuted }}>{logForSelectedDate.daily ? 'Pílula tomada' : 'Esquecimento'}</p>
                    {logForSelectedDate.sos && <p className="text-[11px] mt-1 font-bold" style={{ color: theme.alert }}>SOS: {logForSelectedDate.sos}</p>}
                  </div>

                  <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_5px_15px_rgba(118,88,122,0.04)]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#FFF2F5' }}><Flame size={16} color={theme.alert} /></div>
                      <span className="text-[12px] font-bold" style={{ color: theme.textDark }}>Dor Pélvica</span>
                    </div>
                    <p className="text-[12px]" style={{ color: theme.textMuted }}>Nível: {logForSelectedDate.pain}/10</p>
                  </div>

                  <div className="col-span-2 bg-white rounded-[1.5rem] p-4 shadow-[0_5px_15px_rgba(118,88,122,0.04)]">
                    <span className="text-[12px] font-bold mb-2 block" style={{ color: theme.textDark }}>Sintomas & Escapes</span>
                    <div className="flex flex-wrap gap-2">
                      {logForSelectedDate.bleeding !== 'none' && (
                        <span className="px-3 py-1.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: theme.main }}>
                          {logForSelectedDate.bleeding === 'spotting' ? 'Escape leve' : 'Fluxo intenso'}
                        </span>
                      )}
                      {logForSelectedDate.symptoms?.map(s => (
                        <span key={s} className="px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: '#F8F4F9', color: theme.textDark }}>
                          {s}
                        </span>
                      ))}
                      {(!logForSelectedDate.symptoms?.length && logForSelectedDate.bleeding === 'none') && (
                        <span className="text-[12px]" style={{ color: theme.textMuted }}>Sem sintomas físicos registados.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: ANALYTICS --- */}
      {view === 'analytics' && (
        <div className="animate-in fade-in duration-300">
          <header className="px-6 pt-14 pb-4 sticky top-0 bg-[#FCFAFC]/90 backdrop-blur-md z-10">
            <h2 className="text-[24px] font-bold tracking-tight" style={{ color: theme.textDark }}>Análise de Dados</h2>
          </header>

          <div className="px-6 space-y-6 pb-24">
            <div className="flex bg-white p-1 rounded-full shadow-sm border border-[#F4EFF5]">
              {['1 mês', '3 meses', '6 meses'].map((t, i) => (
                <button key={t} className={`flex-1 py-2 rounded-full text-[12px] font-bold transition-all ${i === 0 ? 'bg-[#76587A] text-white shadow-md' : 'text-[#9B8D9D]'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div>
              <h3 className="text-[16px] font-bold mb-3" style={{ color: theme.textDark }}>Insights gerados para ti</h3>
              <div className="bg-white p-5 rounded-[1.5rem] shadow-[0_5px_15px_rgba(118,88,122,0.05)] border border-[#F4EFF5] flex gap-4 items-center">
                <div className="w-16 h-16 rounded-[1rem] bg-[#FFF2F5] flex items-center justify-center text-2xl">🌿</div>
                <div className="flex-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#FFDF7E]/50 text-[#76587A] mb-1 inline-block">Dica Médica</span>
                  <p className="text-[13px] font-bold leading-tight mt-1" style={{ color: theme.textDark }}>
                    {history.length > 3 ? 'A tua dor pélvica tem estabilizado na última semana.' : 'Continua a registar para desbloquear padrões.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-[0_5px_15px_rgba(118,88,122,0.05)] border border-[#F4EFF5]">
              <h3 className="text-[16px] font-bold mb-6" style={{ color: theme.textDark }}>Nível de Dor Pélvica</h3>
              <div className="h-32 flex items-end justify-between gap-2">
                {[...history.slice(0, 7).reverse(), ...Array(Math.max(0, 7 - history.length)).fill({ pain: 0 })].map((val, idx) => (
                  <div key={idx} className="w-full bg-[#F4EFF5] rounded-t-md relative flex items-end justify-center group" style={{ height: '100%' }}>
                    <div className="w-full rounded-t-md transition-all duration-1000" style={{ height: `${(val.pain || 0) * 10}%`, backgroundColor: (val.pain || 0) > 5 ? theme.alert : theme.sec1 }}></div>
                    <span className="absolute -bottom-5 text-[10px] font-bold text-[#9B8D9D]">D{idx+1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-4 border-t border-[#F4EFF5] flex justify-between items-center">
                <span className="text-[12px] font-medium text-[#9B8D9D]">Média da semana:</span>
                <span className="text-[16px] font-bold" style={{ color: theme.main }}>
                  {history.length ? (history.slice(0, 7).reduce((a, b) => a + b.pain, 0) / Math.min(history.length, 7)).toFixed(1) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: PROFILE --- */}
      {view === 'profile' && (
        <div className="animate-in fade-in duration-300">
          <header className="px-6 pt-14 pb-4 sticky top-0 bg-[#FCFAFC]/90 backdrop-blur-md z-10">
            <h2 className="text-[24px] font-bold tracking-tight" style={{ color: theme.textDark }}>Perfil Clínico</h2>
          </header>

          <div className="px-6 space-y-6 pb-24">
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_5px_15px_rgba(118,88,122,0.05)] border border-[#F4EFF5]">
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full overflow-hidden border-[3px] shadow-sm flex items-center justify-center bg-[#FFF1ED]" style={{ borderColor: '#FFF' }}>
                  <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Mariana&backgroundColor=FFF1ED" alt="Avatar" className="w-full h-full object-cover scale-110" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: theme.textDark }}>Mariana</h3>
                  <p className="text-[12px] font-medium" style={{ color: theme.textMuted }}>Tratamento: Elani 28</p>
                </div>
              </div>
              
              <button 
                onClick={exportToWhatsApp}
                className="w-full py-4 rounded-full text-[14px] font-bold text-white mb-4 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ backgroundColor: '#25D366', boxShadow: '0 8px 20px rgba(37,211,102,0.3)' }} 
              >
                <Share size={18} /> Exportar Relatório (WhatsApp)
              </button>

            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: LOG SYMPTOMS (FORM) --- */}
      {view === 'log' && (
        <div className="animate-in slide-in-from-right-4 duration-300 min-h-screen absolute top-0 left-0 w-full z-50 pb-24 bg-white">
          <header className="px-4 pt-14 pb-2 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
            <button onClick={() => setView('home')} className="p-2 rounded-full hover:bg-black/5">
              <ArrowLeft size={24} style={{ color: theme.textDark }} />
            </button>
            <h2 className="text-[17px] font-semibold" style={{ color: theme.textDark }}>Registo Diário</h2>
            <div className="w-10"></div>
          </header>

          <div className="px-6 pt-4 space-y-8">
            <section>
              <h1 className="text-[24px] font-bold leading-tight mb-2" style={{ color: theme.textDark }}>Como te sentes<br/>hoje?</h1>
              <p className="text-[13px] mb-6" style={{ color: theme.textMuted }}>O teu corpo fala todos os dias — foca-te nos teus sintomas reais.</p>
              
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {[
                  { id: 'cramps', icon: <Flame size={24} strokeWidth={1.5}/>, label: 'Cólicas' },
                  { id: 'low_energy', icon: <ZapOff size={24} strokeWidth={1.5}/>, label: 'Sem Energia' },
                  { id: 'irritable', icon: <Frown size={24} strokeWidth={1.5}/>, label: 'Irritada' },
                  { id: 'comfort', icon: <Coffee size={24} strokeWidth={1.5}/>, label: 'Preciso de mimo' }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setQuickFeeling(item.id)}
                    className="flex flex-col items-center gap-3 min-w-[72px]"
                  >
                    <div 
                      className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all"
                      style={{ 
                        backgroundColor: quickFeeling === item.id ? theme.main : '#F8F4F9',
                        color: quickFeeling === item.id ? '#FFF' : theme.main,
                        boxShadow: quickFeeling === item.id ? `0 8px 20px ${theme.main}40` : 'none'
                      }}
                    >
                      {item.icon}
                    </div>
                    <span className="text-[12px] font-medium text-center leading-tight" style={{ color: quickFeeling === item.id ? theme.textDark : theme.textMuted }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[17px] font-bold mb-4" style={{ color: theme.textDark }}>Sintomas Físicos</h3>
              <div className="flex flex-wrap gap-3">
                {['Tudo bem', 'Cólicas Leves', 'Cólicas Fortes', 'Escape (Spotting)', 'Fluxo Intenso', 'Dor Lombar', 'Inchaço', 'Enxaqueca'].map(sym => {
                  const isSelected = selectedSymptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => toggleSymptom(sym)}
                      className="px-5 py-3 rounded-full text-[14px] font-medium transition-all"
                      style={{
                        backgroundColor: isSelected ? theme.sec1 : '#F8F4F9',
                        color: isSelected ? '#FFF' : theme.textMuted,
                        border: `1px solid ${isSelected ? theme.sec1 : 'transparent'}`
                      }}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-[17px] font-bold mb-4" style={{ color: theme.textDark }}>Tratamento (Elani 28)</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setMedStatus('took')}
                  className="flex-1 py-4 rounded-[1.2rem] text-[14px] font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    backgroundColor: medStatus === 'took' ? theme.main : '#F8F4F9',
                    color: medStatus === 'took' ? '#FFF' : theme.textMuted
                  }}
                >
                  <Pill size={18} /> Tomei a hora
                </button>
                <button
                  onClick={() => setMedStatus('missed')}
                  className="flex-1 py-4 rounded-[1.2rem] text-[14px] font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    backgroundColor: medStatus === 'missed' ? theme.sec1 : '#F8F4F9',
                    color: medStatus === 'missed' ? '#FFF' : theme.textMuted
                  }}
                >
                  Esqueci
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-[17px] font-bold mb-4" style={{ color: theme.textDark }}>Medicação SOS Extra</h3>
              <div className="bg-[#F8F4F9] rounded-[1.5rem] p-4 flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Ex: Ponstan, Buscopan..." 
                  value={sosMed}
                  onChange={(e) => setSosMed(e.target.value)}
                  className="bg-white px-5 py-4 rounded-[1rem] text-[14px] font-medium outline-none shadow-sm"
                  style={{ color: theme.textDark }}
                />
              </div>
            </section>

            <div className="pt-4 pb-10">
              <button 
                onClick={handleSaveLog}
                disabled={saving}
                className="w-full py-[18px] rounded-full text-[16px] font-bold text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: theme.main, opacity: saving ? 0.7 : 1, boxShadow: `0 8px 25px ${theme.main}50` }}
              >
                {saving ? 'A Guardar...' : 'Registar Sintomas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BOTTOM NAVIGATION --- */}
      {view !== 'log' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-[#F0EAF1] pb-6 pt-3 px-8 rounded-t-[2.5rem]">
          <div className="max-w-md mx-auto flex justify-between items-center">
            
            <button onClick={() => setView('home')} className="flex flex-col items-center gap-1.5 w-16">
              <div className="py-1 px-4 rounded-full transition-all" style={{ backgroundColor: view === 'home' ? theme.textDark : 'transparent' }}>
                <Home size={22} style={{ color: view === 'home' ? '#FFF' : theme.textMuted }} strokeWidth={view === 'home' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: view === 'home' ? theme.textDark : theme.textMuted }}>Home</span>
            </button>
            
            <button onClick={() => setView('calendar')} className="flex flex-col items-center gap-1.5 w-16">
              <div className="py-1 px-4 rounded-full transition-all" style={{ backgroundColor: view === 'calendar' ? theme.textDark : 'transparent' }}>
                <CalendarIcon size={22} style={{ color: view === 'calendar' ? '#FFF' : theme.textMuted }} strokeWidth={view === 'calendar' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: view === 'calendar' ? theme.textDark : theme.textMuted }}>Calendário</span>
            </button>
            
            <button onClick={() => setView('analytics')} className="flex flex-col items-center gap-1.5 w-16">
              <div className="py-1 px-4 rounded-full transition-all" style={{ backgroundColor: view === 'analytics' ? theme.textDark : 'transparent' }}>
                <BarChart2 size={22} style={{ color: view === 'analytics' ? '#FFF' : theme.textMuted }} strokeWidth={view === 'analytics' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: view === 'analytics' ? theme.textDark : theme.textMuted }}>Analytics</span>
            </button>

            <button onClick={() => setView('profile')} className="flex flex-col items-center gap-1.5 w-16">
              <div className="py-1 px-4 rounded-full transition-all" style={{ backgroundColor: view === 'profile' ? theme.textDark : 'transparent' }}>
                <User size={22} style={{ color: view === 'profile' ? '#FFF' : theme.textMuted }} strokeWidth={view === 'profile' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: view === 'profile' ? theme.textDark : theme.textMuted }}>Perfil</span>
            </button>

          </div>
        </nav>
      )}
    </div>
  );
}

const ChevronLeft = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color }}>
    <path d="m15 18-6-6 6-6"/>
  </svg>
);