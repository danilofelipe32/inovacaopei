
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { create } from 'zustand';

// Declare global libraries loaded via script tags for TypeScript
declare const mammoth: any;
declare const pdfjsLib: any;

// --- Resilient PDF.js Worker Initialization ---
if (typeof pdfjsLib !== 'undefined') {
    const PDF_JS_VERSION = (pdfjsLib as any).version;
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.js`;
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof pdfjsLib !== 'undefined') {
             const PDF_JS_VERSION = (pdfjsLib as any).version;
             (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.js`;
        } else {
            console.warn("A biblioteca pdf.js não foi encontrada. O processamento de PDF estará desativado.");
        }
    });
}

// --- MERGED FROM types.ts ---
type ViewType = 'pei-form-view' | 'activity-bank-view' | 'pei-list-view' | 'files-view' | 'privacy-policy-view' | 'activity-detail-view';

interface PeiFormField {
    id: string;
    label: string;
}

interface PeiFormSection {
    title: string;
    fields: PeiFormField[];
}

interface PeiData {
    [key: string]: string;
}

interface PeiRecord {
    id: string;
    alunoNome: string;
    data: PeiData;
    timestamp: string;
    aiGeneratedFields?: string[];
    smartAnalysisResults?: Record<string, any | null>;
    goalActivities?: Record<string, Activity[]>;
}

type NewPeiRecordData = Omit<PeiRecord, 'id' | 'timestamp' | 'alunoNome'>;

interface RagFile {
    name: string;
    type: 'text' | 'image';
    mimeType: string;
    content: string; // text content or base64 data for images
    selected: boolean;
}

interface Activity {
    id: string;
    title: string;
    description: string;
    discipline: string;
    skills: string[] | string;
    needs: string[] | string;
    goalTags: string[];
    isFavorited: boolean;
    rating: 'like' | 'dislike' | null;
    comments: string;
    sourcePeiId: string | null;
    isDUA?: boolean;
    createdAt: string;
}


// --- MERGED FROM constants.tsx ---
const BrainIcon = () => <i className="fa-solid fa-brain"></i>;
const EditorIcon = () => <i className="fa-solid fa-file-lines"></i>;
const ActivityIcon = () => <i className="fa-solid fa-lightbulb"></i>;
const ArchiveIcon = () => <i className="fa-solid fa-box-archive"></i>;
const PaperclipIcon = () => <i className="fa-solid fa-paperclip"></i>;
const ShieldIcon = () => <i className="fa-solid fa-shield-halved"></i>;

const disciplineOptions = [
    "Língua Portuguesa", "Matemática", "História", "Geografia", "Ciências", "Artes", "Educação Física", "Inglês",
    "Filosofia", "Sociologia", "Química", "Física", "Biologia"
];

const fieldOrderForPreview = [
    { title: "1. Identificação do Estudante", fields: [
        { id: 'aluno-nome', label: 'Aluno' }, { id: 'aluno-nasc', label: 'Data de Nascimento' },
        { id: 'aluno-ano', label: 'Ano Escolar' }, { id: 'aluno-escola', label: 'Escola' },
        { id: 'aluno-prof', label: 'Professores do PEI' }, { id: 'prof-responsavel', label: 'Professor Responsável' }, { id: 'aluno-data-elab', label: 'Data de Criação' },
        { id: 'disciplina', label: 'Disciplina' },
        { id: 'conteudos-bimestre', label: 'Conteúdos do bimestre' },
        { id: 'restricoes-evitar', label: 'Estratégias a evitar (Restrições)' },
        { id: 'id-diagnostico', label: 'Diagnóstico e Necessidades Específicas' }, { id: 'id-contexto', label: 'Contexto Familiar e Escolar' }
    ]},
    { title: "2. Avaliação Inicial", fields: [
        { id: 'aval-habilidades', label: 'Habilidades Acadêmicas' }, { id: 'aval-social', label: 'Aspectos Sociais e Comportamentais' },
        { id: 'aval-coord', label: 'Coordenação Motora e Autonomia' }
    ]},
    { title: "3. Metas e Objetivos", fields: [
        { id: 'metas-curto', label: 'Curto Prazo (3 meses)' }, { id: 'metas-medio', label: 'Médio Prazo (6 meses)' },
        { id: 'metas-longo', label: 'Longo Prazo (1 ano)' }
    ]},
    { title: "4. Recursos e Estratégias", fields: [
        { id: 'est-adaptacoes', label: 'Adaptações Curriculares' }, { id: 'est-metodologias', label: 'Metodologias e Estratégias' },
        { id: 'est-parcerias', label: 'Parcerias e Acompanhamento' }
    ]},
    { title: "5. Responsáveis pela Implementação", fields: [
        { id: 'resp-regente', label: 'Professor(a) Regente' }, { id: 'resp-coord', label: 'Coordenador(a) Pedagógico(a)' },
        { id: 'resp-familia', label: 'Família' }, { id: 'resp-apoio', label: 'Profissionais de Apoio' }
    ]},
    { title: "6. Revisão do PEI", fields: [
        { id: 'revisao-data', label: 'Última Revisão' },
        { id: 'revisao', label: 'Frequência e Critérios de Revisão' },
        { id: 'revisao-ajustes', label: 'Ajustes Realizados' }
    ]},
    { title: "7. Atividades Adaptadas", fields: [
        { id: 'atividades-content', label: 'Atividades Sugeridas' }
    ]},
    { title: "8. Desenho Universal para a Aprendizagem (DUA)", fields: [
        { id: 'dua-content', label: 'Atividades baseadas no DUA' }
    ]}
];

const labelToIdMap = fieldOrderForPreview.flatMap(s => s.fields).reduce((acc, field) => {
    acc[field.label] = field.id;
    return acc;
}, {});


// --- MERGED FROM store.ts ---
interface AppState {
  currentView: ViewType;
  editingPeiId: string | null;
  viewingActivityId: string | null;
  isThinkingModeEnabled: boolean;
  hasAgreedToPrivacy: boolean;
  navigateToView: (view: ViewType) => void;
  navigateToEditPei: (peiId: string) => void;
  navigateToNewPei: () => void;
  navigateToActivityDetail: (activityId: string) => void;
  toggleThinkingMode: () => void;
  setHasAgreedToPrivacy: (agreed: boolean) => void;
}

const getInitialView = (): ViewType => {
    const params = new URLSearchParams(window.location.search);
    const viewFromUrl = params.get('view') as ViewType;
    const validViews: ViewType[] = ['pei-form-view', 'activity-bank-view', 'pei-list-view', 'files-view', 'privacy-policy-view'];
    
    if (viewFromUrl && validViews.includes(viewFromUrl)) {
        window.history.replaceState({}, document.title, window.location.pathname);
        return viewFromUrl;
    }
    return 'pei-form-view';
};

const useAppStore = create<AppState>((set) => ({
  currentView: getInitialView(),
  editingPeiId: null,
  viewingActivityId: null,
  isThinkingModeEnabled: false,
  hasAgreedToPrivacy: (() => {
    try {
        return localStorage.getItem('privacyPolicyAgreed') === 'true';
    } catch (e) {
        console.warn('Não foi possível acessar o localStorage. O aceite da política de privacidade não será persistido.', e);
        return false;
    }
  })(),
  navigateToView: (view) => set({ 
      currentView: view, 
      editingPeiId: view === 'pei-form-view' ? null : undefined,
      viewingActivityId: null
  }),
  navigateToEditPei: (peiId) => set({ 
      currentView: 'pei-form-view', 
      editingPeiId: peiId 
  }),
  navigateToNewPei: () => set({ 
      currentView: 'pei-form-view', 
      editingPeiId: null 
  }),
  navigateToActivityDetail: (activityId) => set({
      currentView: 'activity-detail-view',
      viewingActivityId: activityId
  }),
  toggleThinkingMode: () => set((state) => ({ isThinkingModeEnabled: !state.isThinkingModeEnabled })),
  setHasAgreedToPrivacy: (agreed) => {
    if (agreed) {
        try {
            localStorage.setItem('privacyPolicyAgreed', 'true');
        } catch (e) {
            console.warn('Não foi possível acessar o localStorage. O aceite da política de privacidade não será persistido.', e);
        }
    }
    set({ hasAgreedToPrivacy: agreed });
  },
}));


// --- ApiFreeLLM Service ---

// Interface for compatibility
interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

// Global queue variables for Rate Limiting
let requestQueue = Promise.resolve();
let lastRequestTime = 0;
// ApiFreeLLM limit is 1 req/5s. We use 5.5s to be safe.
const RATE_LIMIT_DELAY = 5500; 

const callGenerativeAI = async (prompt: string | Part[]): Promise<string> => {
    // Adapter: ApiFreeLLM supports only text.
    let messageContent = '';
    
    if (typeof prompt === 'string') {
        messageContent = prompt;
    } else if (Array.isArray(prompt)) {
        // Extract text parts. Warn if images are present.
        messageContent = prompt
            .map(p => p.text || '')
            .join('\n');
            
        const hasImages = prompt.some(p => p.inlineData);
        if (hasImages) {
            console.warn("ApiFreeLLM: Imagens foram ignoradas (suporte apenas texto na versão Free).");
        }
    }

    const systemInstruction = "Você é um assistente especializado em educação, focado na criação de Planos Educacionais Individualizados (PEI). Suas respostas devem ser profissionais, bem estruturadas e direcionadas para auxiliar educadores. Sempre que apropriado, considere e sugira estratégias baseadas nos princípios do Desenho Universal para a Aprendizagem (DUA).";
    const finalMessage = `${systemInstruction}\n\n${messageContent}`;

    // Queue execution for rate limiting
    const currentOperation = requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLast = now - lastRequestTime;
        
        if (timeSinceLast < RATE_LIMIT_DELAY) {
            const waitTime = RATE_LIMIT_DELAY - timeSinceLast;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        lastRequestTime = Date.now();

        try {
            // Include headers to prevent Cloudflare/WAF blocking where possible
            const response = await fetch('https://apifreellm.com/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    message: finalMessage
                })
            });

            // Check for non-JSON responses (often HTML error pages from Cloudflare)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("ApiFreeLLM Non-JSON Response:", text);
                
                if (response.status === 403 || text.includes("Cloudflare")) {
                     throw new Error("Acesso bloqueado. Se estiver usando uma VPN ou bloqueador de anúncios, tente desativá-los.");
                }
                throw new Error(`Resposta inválida da API (Status ${response.status}).`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                return data.response;
            } else {
                throw new Error(data.error || 'Erro desconhecido da ApiFreeLLM');
            }
        } catch (error) {
            console.error("ApiFreeLLM Service Error:", error);
            const msg = String(error);
            // Handle "Failed to fetch" which usually means blocked by client (AdBlock, etc)
            if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
                throw new Error("Falha na conexão. Possível bloqueio por extensão (AdBlock, uBlock) ou firewall. Tente desativar bloqueadores para este site.");
            }
            throw new Error(`Falha na comunicação com a IA: ${msg}`);
        }
    });

    // Keep queue alive
    requestQueue = currentOperation.catch(() => {});

    return currentOperation;
};


// --- MERGED FROM services/storageService.ts ---
const PEI_STORAGE_KEY = 'peiRecords';
const RAG_FILES_KEY = 'ragFiles';
const ACTIVITY_BANK_KEY = 'activityBank';

const getAllPeis = (): PeiRecord[] => {
    try {
        const recordsJson = localStorage.getItem(PEI_STORAGE_KEY);
        if (recordsJson) {
            const records = JSON.parse(recordsJson);
            return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
    } catch (error) {
        console.error("Failed to parse PEIs from localStorage", error);
    }
    return [];
};

const getPeiById = (id: string): PeiRecord | undefined => {
    const allPeis = getAllPeis();
    return allPeis.find(pei => pei.id === id);
};

const savePei = (recordData: NewPeiRecordData, id: string | null, studentName: string): PeiRecord => {
    const allPeis = getAllPeis();

    if (id) {
        const peiIndex = allPeis.findIndex(p => p.id === id);
        if (peiIndex > -1) {
            const updatedPei: PeiRecord = {
                ...allPeis[peiIndex],
                ...recordData,
                alunoNome: studentName,
                timestamp: new Date().toISOString()
            };
            allPeis[peiIndex] = updatedPei;
            localStorage.setItem(PEI_STORAGE_KEY, JSON.stringify(allPeis));
            return updatedPei;
        }
    }

    const newPei: PeiRecord = {
        ...recordData,
        id: crypto.randomUUID(),
        alunoNome: studentName,
        timestamp: new Date().toISOString()
    };
    const updatedList = [...allPeis, newPei];
    localStorage.setItem(PEI_STORAGE_KEY, JSON.stringify(updatedList));
    return newPei;
};

const deletePei = (id: string) => {
    const allPeis = getAllPeis();
    const updatedList = allPeis.filter(p => p.id !== id);
    localStorage.setItem(PEI_STORAGE_KEY, JSON.stringify(updatedList));
};

const getAllRagFiles = (): RagFile[] => {
    try {
        const filesJson = localStorage.getItem(RAG_FILES_KEY);
        return filesJson ? JSON.parse(filesJson) : [];
    } catch (error) {
        console.error("Failed to parse RAG files from localStorage", error);
        return [];
    }
};

const saveRagFiles = (files: RagFile[]) => {
    try {
        const filesJson = JSON.stringify(files);
        localStorage.setItem(RAG_FILES_KEY, filesJson);
    } catch (error) {
        console.error("Failed to save RAG files to localStorage", error);
    }
};

const getAllActivities = (): Activity[] => {
    try {
        const activitiesJson = localStorage.getItem(ACTIVITY_BANK_KEY);
        return activitiesJson ? JSON.parse(activitiesJson) : [];
    } catch (error) {
        console.error("Failed to parse Activities from localStorage", error);
        return [];
    }
};

const saveActivities = (activities: Activity[]) => {
    try {
        localStorage.setItem(ACTIVITY_BANK_KEY, JSON.stringify(activities));
    } catch (error) {
        console.error("Failed to save Activities to localStorage", error);
    }
};

const addActivitiesToBank = (generatedActivities: Omit<Activity, 'id' | 'createdAt' | 'isFavorited' | 'rating' | 'comments' | 'sourcePeiId'>[], sourcePeiId: string | null) => {
    const existingActivities = getAllActivities();
    const newActivities: Activity[] = generatedActivities.map(act => ({
        ...act,
        id: crypto.randomUUID(),
        isFavorited: false,
        rating: null,
        comments: '',
        sourcePeiId: sourcePeiId,
        createdAt: new Date().toISOString(),
    }));
    const updatedActivities = [...existingActivities, ...newActivities];
    saveActivities(updatedActivities);
};

const addActivityToPei = (peiId: string, activity: Activity): PeiRecord | undefined => {
    const pei = getPeiById(peiId);
    if (pei) {
        const currentActivitiesText = pei.data['atividades-content'] || '';
        const newActivityText = `\n\n--- Atividade Adicionada do Banco ---\n\nTítulo: ${activity.title}\nDescrição: ${activity.description}\n-----------------------------------\n`;
        
        pei.data['atividades-content'] = (currentActivitiesText + newActivityText).trim();
        
        const { id, timestamp, alunoNome, ...recordData } = pei;
        return savePei(recordData as NewPeiRecordData, id, alunoNome);
    }
    return undefined;
};


// --- MERGED FROM components/Modal.tsx ---
const Modal = (props) => {
  const { id, title, isOpen, onClose, children, footer, wide = false } = props;
  if (!isOpen) return null;

  return (
    <div
      id={id}
      className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] ${wide ? 'w-full max-w-3xl' : 'w-full max-w-xl'} animate-slide-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <i className="fa-solid fa-times text-2xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        <div className="flex justify-end flex-wrap gap-3 p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          {footer}
        </div>
      </div>
    </div>
  );
};


// --- MERGED FROM components/TextAreaWithActions.tsx ---
const TextAreaWithActions = ({
  id,
  label,
  rows = 4,
  placeholder = "",
  value,
  onChange,
  onAiClick,
  onSmartClick,
  onSuggestClick,
  onSuggestNeedsClick,
  onSuggestAdaptationsClick,
  onEditClick,
  isAiLoading = false,
  isSmartLoading = false,
  isSuggestLoading = false,
  isSuggestNeedsLoading = false,
  isSuggestAdaptationsLoading = false,
  isGoal = false,
  helpText,
  error,
  isAiActionDisabled = false,
  isAiGenerated = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;

  return (
    <div className="mb-4">
      <div className="flex items-center mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        {isAiGenerated && (
            <div className="relative group ml-2">
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-xs"></i>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                    Conteúdo gerado por IA
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-700"></div>
                </div>
            </div>
        )}
        {helpText && (
          <div className="relative group ml-2">
            <i className="fa-regular fa-circle-question text-gray-400 cursor-help"></i>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 transform">
              {helpText}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-700"></div>
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full p-2.5 pr-12 border rounded-lg transition-all duration-200 bg-gray-50 text-gray-800 appearance-none min-w-0
            focus:outline-none focus:ring-2
            ${hasError 
                ? 'border-red-500 focus:ring-red-300 focus:border-red-500'
                : 'border-gray-300 focus:ring-indigo-300 focus:border-indigo-500'
            }
            ${isFocused && (hasError ? 'ring-2 ring-red-200' : 'ring-2 ring-indigo-200')}
          `}
        />
        <div className="absolute top-2.5 right-2 flex flex-col space-y-1">
            {onAiClick && (
                <button
                  type="button"
                  disabled={isAiLoading || isAiActionDisabled}
                  onClick={onAiClick}
                  className="w-7 h-7 flex items-center justify-center text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  title={isAiActionDisabled ? "Preencha os campos obrigatórios (seções 1 e 2) para habilitar a IA" : "Gerar com IA"}
                >
                    {isAiLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div> : <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>}
                </button>
            )}
             {onSuggestNeedsClick && (
                <button
                  type="button"
                  disabled={isSuggestNeedsLoading || isAiActionDisabled}
                  onClick={onSuggestNeedsClick}
                  className="w-7 h-7 flex items-center justify-center text-cyan-500 hover:text-cyan-700 hover:bg-cyan-100 rounded-full transition-colors disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  title={isAiActionDisabled ? "Preencha os campos obrigatórios para habilitar a IA" : "Sugerir Necessidades Específicas"}
                >
                    {isSuggestNeedsLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-600"></div> : <i className="fa-solid fa-person-circle-question text-xs"></i>}
                </button>
            )}
            {onSuggestAdaptationsClick && (
                <button
                  type="button"
                  disabled={isSuggestAdaptationsLoading || isAiActionDisabled}
                  onClick={onSuggestAdaptationsClick}
                  className="w-7 h-7 flex items-center justify-center text-purple-500 hover:text-purple-700 hover:bg-purple-100 rounded-full transition-colors disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  title={isAiActionDisabled ? "Preencha os campos obrigatórios para habilitar a IA" : "Sugerir Adaptações Curriculares"}
                >
                    {isSuggestAdaptationsLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div> : <i className="fa-solid fa-sliders text-xs"></i>}
                </button>
            )}
            {isGoal && onSmartClick && (
                 <button type="button" disabled={isSmartLoading} onClick={onSmartClick} className="w-7 h-7 flex items-center justify-center text-green-500 hover:text-green-700 hover:bg-green-100 rounded-full transition-colors" title="Análise SMART">
                    {isSmartLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div> : <i className="fa-solid fa-clipboard-check text-xs"></i>}
                </button>
            )}
            {isGoal && onSuggestClick && (
                 <button type="button" disabled={isSuggestLoading} onClick={onSuggestClick} className="w-7 h-7 flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full transition-colors" title="Sugerir atividades">
                    {isSuggestLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div> : <i className="fa-solid fa-lightbulb text-xs"></i>}
                </button>
            )}
            <button type="button" onClick={onEditClick} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors" title="Editar">
                <i className="fa-solid fa-pencil text-xs"></i>
            </button>
        </div>
      </div>
      {hasError && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};


// --- MERGED FROM components/ActivityCard.tsx ---
const Tag = (props) => {
    const { children, colorClass, title } = props;
    return (
        <span title={title} className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {children}
        </span>
    );
};

const ActivityCard = (props) => {
    const { activity, onDelete, onToggleFavorite, onAddToPei, onShare, onEdit, onViewDetails, onRate } = props;
    const cardBaseStyle = "bg-white p-5 rounded-xl shadow-md border transition-shadow hover:shadow-lg";
    const duaStyle = "bg-blue-50 border-blue-200 hover:shadow-blue-100";
    const normalStyle = "border-gray-200";

    const handleActionClick = (e, action) => {
        e.stopPropagation(); // Prevent card click from firing
        action();
    };

    const skillsArray = Array.isArray(activity.skills) ? activity.skills : [];
    const needsArray = Array.isArray(activity.needs) ? activity.needs : [];
    const remainingSkillsCount = skillsArray.length > 3 ? skillsArray.length - 3 : 0;
    const remainingNeedsCount = needsArray.length > 3 ? needsArray.length - 3 : 0;


    return (
        <div
            className={`${cardBaseStyle} ${activity.isDUA ? duaStyle : normalStyle}`}
        >
            <div 
                className="cursor-pointer"
                onClick={onViewDetails}
            >
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-800 pr-4 flex-1">{activity.title}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            type="button"
                            onClick={(e) => handleActionClick(e, () => onToggleFavorite(activity.id))}
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors
                                ${activity.isFavorited
                                    ? 'text-amber-500 bg-amber-100 hover:bg-amber-200'
                                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                }`}
                            title={activity.isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        >
                            <i className={`fa-solid fa-star ${activity.isFavorited ? '' : 'fa-regular'}`}></i>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleActionClick(e, () => onEdit(activity))}
                            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors"
                            title="Editar atividade"
                        >
                            <i className="fa-solid fa-pencil"></i>
                        </button>
                         <button
                            type="button"
                            onClick={(e) => handleActionClick(e, () => onAddToPei(activity))}
                            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-indigo-600 rounded-full transition-colors"
                            title="Adicionar ao PEI atual"
                        >
                            <i className="fa-solid fa-plus"></i>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleActionClick(e, () => onShare(activity))}
                            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-green-600 rounded-full transition-colors"
                            title="Compartilhar atividade"
                        >
                            <i className="fa-solid fa-arrow-up-from-bracket"></i>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleActionClick(e, () => onDelete(activity.id))}
                            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-red-600 rounded-full transition-colors"
                            title="Excluir atividade"
                        >
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{activity.description}</p>

                <div className="flex flex-wrap gap-2">
                    {activity.isDUA && <Tag colorClass="bg-blue-200 text-blue-800 font-bold">DUA</Tag>}
                    <Tag colorClass="bg-indigo-100 text-indigo-800">{activity.discipline}</Tag>
                    
                    {skillsArray.slice(0, 3).map(skill => (
                        <Tag key={skill} colorClass="bg-green-100 text-green-800" title={skill}>{skill}</Tag>
                    ))}
                    {remainingSkillsCount > 0 && (
                        <Tag colorClass="bg-gray-200 text-gray-700" title={`${remainingSkillsCount} mais habilidades`}>
                            +{remainingSkillsCount}
                        </Tag>
                    )}

                    {needsArray.slice(0, 3).map(need => (
                        <Tag key={need} colorClass="bg-sky-100 text-sky-800" title={need}>{need}</Tag>
                    ))}
                    {remainingNeedsCount > 0 && (
                        <Tag colorClass="bg-gray-200 text-gray-700" title={`${remainingNeedsCount} mais necessidades`}>
                            +{remainingNeedsCount}
                        </Tag>
                    )}
                </div>
            </div>
             <div className="border-t mt-4 pt-3 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => onRate(activity.id, 'like')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        activity.rating === 'like'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Gostei"
                >
                    <i className="fa-solid fa-thumbs-up"></i>
                </button>
                <button
                    type="button"
                    onClick={() => onRate(activity.id, 'dislike')}
                     className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        activity.rating === 'dislike'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Não gostei"
                >
                    <i className="fa-solid fa-thumbs-down"></i>
                </button>
            </div>
        </div>
    );
};


// --- PDF Generation Utility ---
const generateAndPrintPdf = (peiRecord: PeiRecord | { alunoNome: string, data: PeiData }) => {
    if (!peiRecord || !peiRecord.data) {
        alert('Dados do PEI não encontrados para gerar o PDF.');
        return;
    }

    const studentName = peiRecord.alunoNome || 'PEI';

    const htmlContent = fieldOrderForPreview.map(section => {
        const fieldsHtml = section.fields.map(field => {
            const value = peiRecord.data[field.id] || '';
            const sanitizedValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const displayValue = sanitizedValue.trim() ? sanitizedValue.replace(/\n/g, '<br />') : '<span class="italic">Não preenchido</span>';
            
            return `
                <div style="margin-bottom: 1rem;">
                    <h3 style="font-weight: 600; margin-bottom: 0.25rem;">${field.label}</h3>
                    <div style="white-space: pre-wrap; word-wrap: break-word; background-color: #f9fafb; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e7eb;">
                        ${displayValue}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 1.5rem; page-break-inside: avoid;">
                <h2 style="font-size: 1.5rem; font-weight: bold; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-top: 1.5rem; margin-bottom: 1rem;">${section.title}</h2>
                <div style="display: grid; gap: 1rem;">${fieldsHtml}</div>
            </div>
        `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>PEI - ${studentName}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
                        h1, h2, h3 { color: #111; }
                        h1 { font-size: 2em; text-align: center; margin-bottom: 0.5em; }
                        h2 { font-size: 1.5em; font-weight: bold; border-bottom: 2px solid #eee; padding-bottom: 0.5em; margin-top: 1.5em; margin-bottom: 1em; }
                        h3 { font-size: 1.1em; font-weight: 600; margin-bottom: 0.25em; }
                        .italic { font-style: italic; color: #888; }
                    </style>
                </head>
                <body>
                    <h1>Plano Educacional Individualizado (PEI)</h1>
                    <h2 style="text-align: center; margin-bottom: 2rem;">Aluno(a): ${studentName}</h2>
                    ${htmlContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 250);
    } else {
        alert('Não foi possível abrir a janela de impressão. Por favor, desative o bloqueador de pop-ups para este site e tente novamente.');
    }
};


// --- Accordion Component for PeiFormView ---
const AccordionSection = (props) => {
    const { title, isOpen, onToggle, children, color, progress } = props;
    const numberMatch = title.match(/^(\d+)\./);
    const number = numberMatch ? numberMatch[1] : null;
    const cleanTitle = numberMatch ? title.replace(/^\d+\.\s*/, '') : title;

    const isComplete = progress === 100;
    const progressBarColor = isComplete ? 'bg-green-500' : 'bg-blue-500';

    return (
        <div className="rounded-xl shadow-md border border-blue-200 overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className={`w-full flex items-start p-4 text-left transition-colors duration-200 min-h-24 ${isOpen ? 'bg-blue-100' : 'bg-blue-50 hover:bg-blue-100'}`}
                aria-expanded={isOpen}
            >
                {number && (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mr-4 mt-1 ${color}`}>
                        <span className="text-white font-bold">{number}</span>
                    </div>
                )}
                <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-blue-900">{cleanTitle}</h3>
                    {progress !== undefined && (
                        <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-4 relative">
                                <div
                                    className={`${progressBarColor} h-full rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-300 ease-in-out`}
                                    style={{ width: `${progress}%` }}
                                >
                                    {progress > 10 && <span>{Math.round(progress)}%</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 ml-4 mt-1 ${isOpen ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-800'}`}>
                    <i className={`fa-solid ${isOpen ? 'fa-minus' : 'fa-plus'}`}></i>
                </div>
            </button>
            <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px]' : 'max-h-0'}`}
            >
                <div className="p-6 border-t border-blue-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
};


// --- MERGED FROM components/PeiFormView.tsx ---
const PeiFormView = (props) => {
    const { editingPeiId, onSaveSuccess } = props;
    const { isThinkingModeEnabled, toggleThinkingMode } = useAppStore();
    const { navigateToView } = useAppStore();
    const [currentPeiId, setCurrentPeiId] = useState<string | null>(editingPeiId);
    const [peiData, setPeiData] = useState<PeiData>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', content: null, footer: null });
    
    const [isGeneratingFullPei, setIsGeneratingFullPei] = useState(false);
    const [isFullPeiModalOpen, setIsFullPeiModalOpen] = useState(false);
    const [fullPeiContent, setFullPeiContent] = useState('');

    const [aiGeneratedFields, setAiGeneratedFields] = useState(new Set<string>());
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editModalData, setEditModalData] = useState<{fieldId: string, label: string, text: string} | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [refinementInstruction, setRefinementInstruction] = useState('');
    const [isRefinementInputVisible, setIsRefinementInputVisible] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [smartAnalysisResults, setSmartAnalysisResults] = useState<Record<string, any>>({});
    const [goalActivities, setGoalActivities] = useState<Record<string, Activity[]>>({});
    const [openSmartAnalysis, setOpenSmartAnalysis] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [autoSaveStatus, setAutoSaveStatus] = useState('ocioso'); // 'ocioso', 'salvando', 'salvo'
    const [isAnalyzingPei, setIsAnalyzingPei] = useState(false);
    const [isSmartAnalysisModalOpen, setIsSmartAnalysisModalOpen] = useState(false);
    const [smartAnalysisData, setSmartAnalysisData] = useState(null);
    const [openAccordionSection, setOpenAccordionSection] = useState<number | null>(0);
    const [approvalModalData, setApprovalModalData] = useState({
        isOpen: false,
        fieldId: '',
        label: '',
        content: '',
        isAppending: false
    });


    const handleAccordionToggle = (index: number) => {
        setOpenAccordionSection(prevIndex => (prevIndex === index ? null : index));
    };
    
    const circleColors = [
        'bg-red-500', 
        'bg-orange-500', 
        'bg-amber-500', 
        'bg-yellow-400', 
        'bg-lime-500', 
        'bg-green-500', 
        'bg-emerald-500', 
        'bg-teal-500'
    ];

    const helpTexts = {
        'aluno-nome': 'Insira o nome completo do aluno para identificação do plano.',
        'aluno-nasc': 'Selecione a data de nascimento do aluno.',
        'aluno-ano': 'Indique o ano ou série escolar que o aluno está cursando.',
        'aluno-escola': 'Nome da instituição de ensino onde o aluno está matriculado.',
        'aluno-prof': 'Liste o(s) nome(s) do(s) professor(es) responsável(is) pelo acompanhamento do PEI.',
        'prof-responsavel': 'Indique o nome do professor principal responsável pela implementação e acompanhamento deste PEI.',
        'aluno-data-elab': 'Data em que este Plano Educacional Individualizado foi criado ou iniciado.',
        'disciplina': 'Selecione a disciplina principal abordada neste PEI.',
        'conteudos-bimestre': 'Liste os principais conteúdos ou tópicos que serão trabalhados no bimestre/trimestre.',
        'restricoes-evitar': 'Descreva estratégias ou abordagens que se mostraram ineficazes ou que devem ser evitadas com o aluno, com base em experiências anteriores.',
        'revisao-data': 'Selecione a data da última revisão oficial do PEI, se houver.',
        'id-diagnostico': 'Descreva o diagnóstico do aluno (se houver) e as necessidades educacionais específicas decorrentes dele. Ex: TDAH, Dislexia, TEA.',
        'id-contexto': 'Apresente um breve resumo do contexto familiar e da trajetória escolar do aluno. Fatores relevantes podem incluir apoio familiar, mudanças de escola, etc.',
        'aval-habilidades': 'Detalhe as competências e dificuldades do aluno em áreas acadêmicas como leitura, escrita e matemática. Use exemplos concretos.',
        'aval-social': 'Descreva como o aluno interage com colegas e professores, seu comportamento em sala e habilidades de comunicação.',
        'aval-coord': 'Aborde aspectos da coordenação motora fina e grossa, bem como a autonomia do aluno em atividades diárias e escolares.',
        'metas-curto': "Defina um objetivo específico e alcançável para os próximos 3 meses. Ex: 'Ler e interpretar frases simples com 80% de precisão'.",
        'metas-medio': 'Estabeleça uma meta para os próximos 6 meses, que represente um avanço em relação à meta de curto prazo.',
        'metas-longo': 'Descreva o objetivo principal a ser alcançado ao final do ano letivo. Deve ser uma meta ampla e significativa.',
        'est-adaptacoes': 'Liste as adaptações necessárias em materiais, avaliações e no ambiente para facilitar o aprendizado. Ex: Provas com fonte ampliada, tempo extra.',
        'est-metodologias': 'Descreva as abordagens pedagógicas que serão utilizadas. Ex: Aulas expositivas com apoio visual, aprendizado baseado em projetos, gamificação.',
        'est-parcerias': 'Indique como será a colaboração com a família, terapeutas e outros profissionais que acompanham o aluno.',
        'resp-regente': 'Descreva as responsabilidades do professor regente na implementação e acompanhamento do PEI.',
        'resp-coord': 'Detalhe o papel do coordenador pedagógico, como supervisão, apoio ao professor e articulação com a família.',
        'resp-familia': 'Especifique como a família participará do processo, apoiando as atividades em casa e mantendo a comunicação com a escola.',
        'resp-apoio': 'Liste outros profissionais (psicólogos, fonoaudiólogos, etc.) e suas respectivas atribuições no plano.',
        'revisao': 'Defina a periodicidade (ex: bimestral, trimestral) e os critérios que serão usados para avaliar o progresso do aluno e a necessidade de ajustes no plano.',
        'revisao-ajustes': 'Resuma as principais modificações feitas no PEI desde a última revisão. Ex: "A meta de curto prazo foi ajustada para focar na interpretação de textos", "Novas estratégias visuais foram incorporadas".',
        'atividades-content': 'Use a IA para sugerir atividades com base nas metas ou descreva suas próprias propostas de atividades adaptadas.',
        'dua-content': 'Descreva como os princípios do Desenho Universal para a Aprendizagem (DUA) serão aplicados para remover barreiras e promover a inclusão.'
    };

    const requiredFields = [
        ...fieldOrderForPreview.find(s => s.title.startsWith("1."))!.fields.map(f => f.id),
        ...fieldOrderForPreview.find(s => s.title.startsWith("2."))!.fields.map(f => f.id)
    ];

    const autoSaveDataRef = useRef({ peiData, aiGeneratedFields, smartAnalysisResults, goalActivities, currentPeiId });

    useEffect(() => {
        autoSaveDataRef.current = { peiData, aiGeneratedFields, smartAnalysisResults, goalActivities, currentPeiId };
    }, [peiData, aiGeneratedFields, smartAnalysisResults, goalActivities, currentPeiId]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const {
                peiData: currentPeiData,
                aiGeneratedFields: currentAiFields,
                smartAnalysisResults: currentSmartResults,
                goalActivities: currentGoalActivities,
                currentPeiId: currentId,
            } = autoSaveDataRef.current;
            
            const studentName = currentPeiData['aluno-nome']?.trim();

            if (studentName) {
                setAutoSaveStatus('salvando');
                const recordData: NewPeiRecordData = {
                    data: currentPeiData,
                    aiGeneratedFields: Array.from(currentAiFields),
                    smartAnalysisResults: currentSmartResults,
                    goalActivities: currentGoalActivities,
                };
                
                const savedRecord = savePei(recordData, currentId, studentName);
                
                if (!currentId && savedRecord.id) {
                    setCurrentPeiId(savedRecord.id);
                }

                setTimeout(() => {
                    setAutoSaveStatus('salvo');
                    setTimeout(() => setAutoSaveStatus('ocioso'), 2000);
                }, 500);
            }
        }, 5000); // 5 seconds

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (editingPeiId) {
            const peiToLoad = getPeiById(editingPeiId);
            if (peiToLoad) {
                setCurrentPeiId(peiToLoad.id);
                setPeiData(peiToLoad.data);
                setAiGeneratedFields(new Set(peiToLoad.aiGeneratedFields || []));
                setSmartAnalysisResults(peiToLoad.smartAnalysisResults || {});
                setGoalActivities(peiToLoad.goalActivities || {});
                setOpenSmartAnalysis({});
            }
        } else {
            handleClearForm();
        }
    }, [editingPeiId]);


    const areRequiredFieldsFilled = useMemo(() => {
        return requiredFields.every(fieldId => peiData[fieldId]?.trim());
    }, [peiData]);

    const validateForm = () => {
        const newErrors = {};
        let isValid = true;
        for (const fieldId of requiredFields) {
            if (!peiData[fieldId]?.trim()) {
                newErrors[fieldId] = 'Este campo é obrigatório.';
                isValid = false;
            }
        }
        setErrors(newErrors);
        if (!isValid) {
            const firstErrorField = document.getElementById(Object.keys(newErrors)[0]);
            firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setOpenAccordionSection(0); // Open the first section where errors are likely to be
            alert('Por favor, preencha todos os campos obrigatórios destacados.');
        }
        return isValid;
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setPeiData(prev => ({ ...prev, [id]: value }));
        if (errors[id]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    }, [errors]);

    const handleTextAreaChange = useCallback((id: string, value: string) => {
        setPeiData(prev => ({ ...prev, [id]: value }));
        setAiGeneratedFields(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        if (errors[id]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    }, [errors]);
    
    const buildRagParts = (): Part[] => {
        const allRagFiles = getAllRagFiles();
        const selectedFiles = allRagFiles.filter(f => f.selected);
        const parts: Part[] = [];

        selectedFiles.forEach(file => {
            // Note: ApiFreeLLM Free tier ignores inlineData (images) based on our service implementation
            // but we keep the structure for compatibility.
            if (file.type === 'text') {
                parts.push({ text: `\n\n--- INÍCIO DO FICHEIRO DE APOIO: ${file.name} ---\n\n${file.content}\n\n--- FIM DO FICHEIRO DE APOIO: ${file.name} ---\n\n` });
            } else if (file.type === 'image') {
                parts.push({ text: `A imagem a seguir, intitulada "${file.name}", serve como contexto visual:` });
                parts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: file.content // which is base64 string
                    }
                });
            }
        });
        return parts;
    };

    const buildFormContextAsText = (fieldIdToExclude: string): string => {
        let rawFormContent = fieldOrderForPreview
            .flatMap(section => section.fields)
            .map(field => {
                const value = peiData[field.id];
                return value && field.id !== fieldIdToExclude ? `${field.label}: ${value}` : null;
            })
            .filter(Boolean)
            .join('\n');

        const FORM_CONTEXT_CHAR_LIMIT = 10000;
        if (rawFormContent.length > FORM_CONTEXT_CHAR_LIMIT) {
             console.warn(`O contexto do formulário excedeu ${FORM_CONTEXT_CHAR_LIMIT} caracteres e foi truncado.`);
            rawFormContent = rawFormContent.substring(0, FORM_CONTEXT_CHAR_LIMIT);
            rawFormContent += "\n\n... (O conteúdo do formulário foi truncado por exceder o limite de tamanho)";
        }

        return rawFormContent;
    };

    const buildFeedbackContext = (): string => {
        const allActivities = getAllActivities();
        const likedActivities = allActivities.filter(a => a.rating === 'like');
        const dislikedActivities = allActivities.filter(a => a.rating === 'dislike');
    
        if (likedActivities.length === 0 && dislikedActivities.length === 0) {
            return '';
        }
    
        const formatActivityForPrompt = (act: Activity) => `- Título: ${act.title}\n  Descrição: ${act.description.substring(0, 150)}...`;
    
        let feedbackText = "\n\n--- PREFERÊNCIAS DO USUÁRIO ---\nPara te ajudar a gerar sugestões melhores, aqui estão exemplos de atividades que o usuário gostou e não gostou. Leve estas preferências em consideração.\n";
    
        if (likedActivities.length > 0) {
            feedbackText += "\nEXEMPLOS DE ATIVIDADES QUE O USUÁRIO GOSTOU (gere atividades com estilo semelhante):\n";
            feedbackText += likedActivities.slice(0, 5).map(formatActivityForPrompt).join('\n');
            feedbackText += "\n";
        }
    
        if (dislikedActivities.length > 0) {
            feedbackText += "\nEXEMPLOS DE ATIVIDADES QUE O USUÁRIO NÃO GOSTOU (EVITE gerar atividades com este estilo):\n";
            feedbackText += dislikedActivities.slice(0, 5).map(formatActivityForPrompt).join('\n');
            feedbackText += "\n";
        }
    
        feedbackText += "--- FIM DAS PREFERÊNCIAS ---\n\n";
        return feedbackText;
    };

    const handleActionClick = async (fieldId: string, action: 'ai' | 'smart' | 'suggest' | 'suggest-needs' | 'suggest-adaptations') => {
        if ((action === 'ai' || action === 'suggest-needs' || action === 'suggest-adaptations') && !areRequiredFieldsFilled) {
            validateForm();
            return;
        }

        setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: true }));
        try {
            let response = '';
            
            const studentInfoForSimpleActions = `
                Aluno: ${peiData['aluno-nome'] || 'Não informado'}
                Diagnóstico: ${peiData['id-diagnostico'] || 'Não informado'}
            `;
    
            switch (action) {
                case 'ai': {
                    const fieldLabelAi = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                    
                    // For ApiFreeLLM (Chat based), simplify prompt structure
                    const formContext = buildFormContextAsText(fieldId);
                    const aiInstruction = { text: `Aja como um especialista em educação inclusiva. Sua tarefa é preencher o campo "${fieldLabelAi}" de um Plano Educacional Individualizado (PEI).
                    
Para garantir coesão e coerência, analise CUIDADOSAMENTE os campos já preenchidos do PEI (e arquivos de apoio se houver) antes de gerar sua resposta.

--- INÍCIO DO CONTEXTO DO PEI ATUAL ---
${formContext}
--- FIM DO CONTEXTO DO PEI ATUAL ---
                        
Agora, com base no contexto, gere o conteúdo para o campo: "${fieldLabelAi}".
Sua resposta deve ser apenas o texto para este campo, sem introduções ou títulos.` };

                    const ragParts = buildRagParts();
                    // Combined parts
                    const aiParts: Part[] = [aiInstruction, ...ragParts];
                    response = await callGenerativeAI(aiParts);
                    
                    setApprovalModalData({
                        isOpen: true,
                        fieldId: fieldId,
                        label: fieldLabelAi,
                        content: response,
                        isAppending: false
                    });
                    break;
                }
                
                case 'suggest-needs': {
                    const diagnosisTextForNeeds = peiData['id-diagnostico'] || '';
                    const skillsTextForNeeds = peiData['aval-habilidades'] || 'Não informado';
                    const ragPartsForNeeds = buildRagParts();
                    const formContextForNeeds = buildFormContextAsText(fieldId);
                    
                    const suggestNeedsInstruction = { text: `
                        Aja como um psicopedogo especialista.
                        Com base no diagnóstico, nas habilidades do aluno e nos ficheiros de apoio, sugira uma lista de necessidades educacionais específicas a serem abordadas no PEI.

                        Contexto do Aluno:
                        ---
                        Diagnóstico e/ou Descrição Atual: ${diagnosisTextForNeeds}
                        Habilidades Acadêmicas Atuais: ${skillsTextForNeeds}
                        ---
                        Contexto do PEI:
                        ---
                        ${formContextForNeeds}
                        ---

                        Liste as necessidades específicas.
                        Sua resposta deve ser uma lista de itens, cada um em uma nova linha, começando com um hífen (-).
                        Exemplo:
                        - Apoio visual para instruções
                        - Tempo extra para avaliações
                        - Mediação em interações sociais

                        Gere apenas a lista, sem introduções ou conclusões.
                    `};
                    const suggestNeedsParts: Part[] = [suggestNeedsInstruction, ...ragPartsForNeeds];
                    response = await callGenerativeAI(suggestNeedsParts);
                    
                    const fieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                    
                    setApprovalModalData({
                        isOpen: true,
                        fieldId: fieldId,
                        label: fieldLabel,
                        content: response,
                        isAppending: true,
                    });
                    break;
                }

                case 'suggest-adaptations': {
                    const diagnosisForAdapt = peiData['id-diagnostico'] || 'Não informado';
                    const shortGoal = peiData['metas-curto'] || 'Não informado';
                    const mediumGoal = peiData['metas-medio'] || 'Não informado';
                    const longGoal = peiData['metas-longo'] || 'Não informado';
                    const ragPartsForAdapt = buildRagParts();
                    const formContextForAdapt = buildFormContextAsText(fieldId);

                    const suggestAdaptationsInstruction = { text: `
                        Aja como um especialista em educação inclusiva e psicopedagogia.
                        Com base no diagnóstico, necessidades, metas do aluno e ficheiros de apoio, sugira uma lista detalhada de adaptações curriculares.

                        Contexto do Aluno:
                        ---
                        Diagnóstico e Necessidades Específicas: ${diagnosisForAdapt}
                        Meta de Curto Prazo: ${shortGoal}
                        Meta de Médio Prazo: ${mediumGoal}
                        Meta de Longo Prazo: ${longGoal}
                        ---
                        Contexto do PEI:
                        ---
                        ${formContextForAdapt}
                        ---

                        Forneça sugestões práticas para adaptações em:
                        1.  **Materiais:** (ex: textos com fontes maiores, uso de audiolivros)
                        2.  **Atividades:** (ex: instruções segmentadas, tempo extra)
                        3.  **Avaliações:** (ex: provas orais, questões de múltipla escolha)
                        4.  **Ambiente:** (ex: sentar próximo ao professor, reduzir estímulos visuais)

                        Gere uma lista bem estruturada e formatada com clareza.
                        Sua resposta deve ser apenas a lista, sem introduções ou conclusões.
                    `};
                    const suggestAdaptationsParts: Part[] = [suggestAdaptationsInstruction, ...ragPartsForAdapt];
                    response = await callGenerativeAI(suggestAdaptationsParts);
                    
                    const adaptationsFieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                    
                    setApprovalModalData({
                        isOpen: true,
                        fieldId: fieldId,
                        label: adaptationsFieldLabel,
                        content: response,
                        isAppending: true,
                    });
                    break;
                }

                case 'smart': {
                    const goalText = peiData[fieldId] || '';
                    if (!goalText) {
                        alert('Por favor, preencha o campo da meta antes de solicitar la análise SMART.');
                        setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
                        return;
                    }
                    const smartPrompt = `Analise a seguinte meta de um PEI com base nos critérios SMART (Específica, Mensurável, Atingível, Relevante, Temporal). Forneça uma crítica construtiva e uma sugestão de melhoria para cada critério.
    
Meta para Análise: "${goalText}"

Sua resposta DEVE ser um objeto JSON válido, sem nenhum texto adicional antes ou depois. Use a seguinte estrutura:
{
  "isSpecific": { "critique": "...", "suggestion": "..." },
  "isMeasurable": { "critique": "...", "suggestion": "..." },
  "isAchievable": { "critique": "...", "suggestion": "..." },
  "isRelevant": { "critique": "...", "suggestion": "..." },
  "isTimeBound": { "critique": "...", "suggestion": "..." }
}`;
                    response = await callGenerativeAI(smartPrompt);
                    try {
                        const startIndex = response.indexOf('{');
                        const endIndex = response.lastIndexOf('}');
                        if (startIndex === -1 || endIndex === -1) {
                            throw new Error("Valid JSON object not found in response.");
                        }
                        const jsonString = response.substring(startIndex, endIndex + 1);
                        const analysis = JSON.parse(jsonString);
                        setSmartAnalysisResults(prev => ({ ...prev, [fieldId]: analysis }));
                        setOpenSmartAnalysis(prev => ({ ...prev, [fieldId]: true }));
                    } catch (e) {
                        console.error("Failed to parse SMART analysis JSON:", e, "Raw response:", response);
                        alert("A API retornou uma resposta em um formato inesperado para la análise SMART. Por favor, tente novamente.");
                    }
                    break;
                }
    
                case 'suggest': {
                    const isDuaField = fieldId === 'dua-content';
                    const isGoalField = ['metas-curto', 'metas-medio', 'metas-longo'].includes(fieldId);

                    let promptContextText = '';
                    let promptSubject = '';
                    
                    if (isGoalField) {
                        const goalTextForSuggest = peiData[fieldId] || '';
                        if (!goalTextForSuggest.trim()) {
                            alert('Por favor, preencha o campo da meta antes de solicitar sugestões de atividades.');
                            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
                            return;
                        }
                        promptContextText = `Informações do Aluno: ${studentInfoForSimpleActions}`;
                        promptSubject = `na seguinte meta de um PEI: "${goalTextForSuggest}"`;
                    } else {
                        if (!areRequiredFieldsFilled) {
                            validateForm();
                            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
                            return;
                        }
                        promptContextText = `--- INÍCIO DO CONTEXTO DO PEI ATUAL ---\n\n${buildFormContextAsText(fieldId)}\n--- FIM DO CONTEXTO DO PEI ATUAL ---`;
                        promptSubject = 'no contexto completo do PEI fornecido';
                    }

                    const duaInstruction = isDuaField ? 'Com base nos princípios do Desenho Universal para a Aprendizagem (DUA) e' : 'Com base';
                    const feedbackContext = buildFeedbackContext();
                    const ragPartsForSuggest = buildRagParts();

                    const structureExample = isDuaField
                        ? `[
  {
    "title": "...",
    "description": "...",
    "discipline": "...",
    "skills": ["...", "..."],
    "needs": ["...", "..."],
    "goalTags": ["DUA"],
    "isDUA": true
  }
]`
                        : `[
  {
    "title": "...",
    "description": "...",
    "discipline": "...",
    "skills": ["...", "..."],
    "needs": ["...", "..."],
    "goalTags": ["..."]
  }
]`;

                    const suggestInstruction = { text: `${duaInstruction} ${promptSubject}, sugira 3 a 5 atividades educacionais adaptadas.
                    
Contexto Adicional:
${promptContextText}
${feedbackContext}
Sua resposta DEVE ser um array de objetos JSON válido, sem nenhum texto adicional antes ou depois. Use a seguinte estrutura:
${structureExample}`};
                    
                    const suggestParts: Part[] = [suggestInstruction, ...ragPartsForSuggest];
                    response = await callGenerativeAI(suggestParts);

                    try {
                        const startIndex = response.indexOf('[');
                        const endIndex = response.lastIndexOf(']');
                        if (startIndex === -1 || endIndex === -1) {
                            throw new Error("Valid JSON array not found in response.");
                        }
                        const jsonString = response.substring(startIndex, endIndex + 1);
                        let activities = JSON.parse(jsonString);

                        if (!Array.isArray(activities)) {
                            throw new Error("Response is not an array.");
                        }

                        const goalTypeMap = {
                            'metas-curto': 'Curto Prazo',
                            'metas-medio': 'Médio Prazo',
                            'metas-longo': 'Longo Prazo'
                        };
                        const goalTag = goalTypeMap[fieldId];

                        activities = activities.map(act => {
                            const newTags = new Set(Array.isArray(act.goalTags) ? act.goalTags : []);
                            let isNowDUA = act.isDUA || false;

                            if (isDuaField) {
                                newTags.add('DUA');
                                isNowDUA = true;
                            }
                            if (goalTag) {
                                newTags.add(goalTag);
                            }
                            
                            return {
                                ...act,
                                isDUA: isNowDUA,
                                goalTags: Array.from(newTags)
                            };
                        });
                        
                        if (isGoalField || isDuaField) {
                            setGoalActivities(prev => ({ ...prev, [fieldId]: activities }));
                        }

                        const handleSaveActivities = () => {
                            addActivitiesToBank(activities, currentPeiId);
                            alert(`${activities.length} atividades foram salvas com sucesso no Banco de Atividades!`);
                            setIsModalOpen(false);
                        };
                        
                        const fieldLabelSuggest = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                        
                        setModalContent({
                            title: `Atividades Sugeridas para "${fieldLabelSuggest}"`,
                            content: renderSuggestedActivities(activities),
                            footer: (
                                <>
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                                        Fechar
                                    </button>
                                    <button type="button" onClick={handleSaveActivities} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                                        <i className="fa-solid fa-plus"></i> Adicionar ao Banco
                                    </button>
                                </>
                            )
                        });
                        setIsModalOpen(true);
                    } catch(e) {
                        console.error("Failed to parse suggested activities JSON:", e, "Raw response:", response);
                        alert("A API retornou uma resposta em um formato inesperado para as sugestões de atividades. Por favor, tente novamente.");
                    }
                    break;
                }
            }
    
        } catch (error) {
            console.error(`Error during '${action}' action for '${fieldId}':`, error);
            const errorMessage = error instanceof Error ? error.message : "Verifique o console para mais detalhes.";
            alert(`Ocorreu um erro ao executar a ação de IA. ${errorMessage}`);
        } finally {
            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
        }
    };

    const handleGenerateFullPei = async () => {
        if (!validateForm()) {
            return;
        }

        setIsGeneratingFullPei(true);
        setFullPeiContent('');

        try {
            const ragParts = buildRagParts();
            const formContext = buildFormContextAsText('');

            const instruction = { text: `
                Aja como um especialista em educação especial e psicopedagogia.
                Com base nos dados de ficheiros de apoio e do formulário, elabore um Plano Educacional Individualizado (PEI) completo, coeso e profissional.
                O documento final deve ser bem estruturado, com parágrafos claros e uma linguagem técnica, mas compreensível.
                Conecte as diferentes seções de forma lógica (ex: as metas devem refletir o diagnóstico e a avaliação, e as atividades devem estar alinhadas às metas).
                Se houver campos não preenchidos, use seu conhecimento para fazer inferências razoáveis.
                O tom deve ser formal e respeitoso.

                Contexto do PEI:
                ---
                ${formContext}
                ---

                Elabore o PEI completo a seguir.
            `};
            
            const fullPeiParts: Part[] = [instruction, ...ragParts];
            const response = await callGenerativeAI(fullPeiParts);
            setFullPeiContent(response);
            setIsFullPeiModalOpen(true);

        } catch (error) {
            console.error('Error generating full PEI:', error);
            alert('Ocorreu um erro ao gerar o PEI completo. Tente novamente.');
        } finally {
            setIsGeneratingFullPei(false);
        }
    };
    
    const handleIntelligentAnalysis = async () => {
        if (!validateForm()) {
            return;
        }
        setIsAnalyzingPei(true);
        setSmartAnalysisData(null);
        try {
            const ragParts = buildRagParts();
            const formContext = buildFormContextAsText('');
            const instruction = { text: `
Aja como uma equipe multidisciplinar de especialistas em educação composta por um pedagogo e um psicopedogo.
Sua tarefa é realizar uma análise completa e aprofundada do seguinte Plano Educacional Individualizado (PEI).

Analise o PEI fornecido e retorne um objeto JSON válido, sem nenhum texto ou formatação adicional antes ou depois. A estrutura do JSON deve ser a seguinte:

{
  "strengths": ["Liste aqui os pontos fortes do PEI, como a clareza das metas, a adequação das estratégias, etc."],
  "weaknesses": ["Liste aqui os pontos fracos ou áreas que precisam de mais detalhes, como metas vagas, falta de estratégias específicas, etc."],
  "goalAnalysis": "Forneça uma análise detalhada das metas (curto, médio, longo prazo), avaliando se são SMART (Específica, Mensuráveis, Atingíveis, Relevantes, Temporais) e se estão alinhadas com o perfil do aluno.",
  "pedagogicalAnalysis": "Do ponto de vista pedagógico, analise as estratégias, adaptações curriculares e metodologias. Elas são adequadas para as necessidades do aluno? Estão alinhadas com as boas práticas de educação inclusiva?",
  "psychopedagogicalAnalysis": "Do ponto de vista psicopedagogico, analise a coerência entre o diagnóstico, a avaliação inicial e as propostas de intervenção. O plano considera os aspectos cognitivos, sociais e emocionais do aluno de forma integrada?",
  "suggestions": ["Liste sugestões práticas e acionáveis para melhorar o PEI, abordando os pontos fracos identificados. Seja específico nas suas recomendações."]
}

Certifique-se de que sua análise seja construtiva, profissional e baseada em evidências do próprio PEI.`};
            
            const analysisParts: Part[] = [instruction, { text: `Contexto do PEI:\n---\n${formContext}\n---` }, ...ragParts];
            const response = await callGenerativeAI(analysisParts);
             try {
                const startIndex = response.indexOf('{');
                const endIndex = response.lastIndexOf('}');
                if (startIndex === -1 || endIndex === -1) {
                    throw new Error("Objeto JSON válido não encontrado na resposta.");
                }
                const jsonString = response.substring(startIndex, endIndex + 1);
                const analysis = JSON.parse(jsonString);
                setSmartAnalysisData(analysis);
                setIsSmartAnalysisModalOpen(true);
            } catch (e) {
                console.error("Falha ao analisar JSON da Análise Inteligente:", e, "Resposta bruta:", response);
                alert("A API retornou uma resposta em um formato inesperado para a análise. Por favor, tente novamente.");
            }
        } catch (error) {
            console.error('Erro ao gerar Análise Inteligente:', error);
            alert('Ocorreu um erro ao gerar a análise. Tente novamente.');
        } finally {
            setIsAnalyzingPei(false);
        }
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditModalData(null);
        setRefinementInstruction('');
        setIsRefinementInputVisible(false);
    };

    const handleApproveSuggestion = () => {
        const { fieldId, content, isAppending } = approvalModalData;
        if (isAppending) {
            const existingText = peiData[fieldId] || '';
            const newText = `${existingText}\n\n--- Sugestões Aprovadas ---\n${content}`.trim();
            setPeiData(prev => ({ ...prev, [fieldId]: newText }));
        } else {
            setPeiData(prev => ({ ...prev, [fieldId]: content }));
        }
        setAiGeneratedFields(prev => new Set(prev).add(fieldId));
        setApprovalModalData({ isOpen: false, fieldId: '', label: '', content: '', isAppending: false });
    };

    const handleEditModalRegenerate = async () => {
        if (!editModalData) return;
        setIsRegenerating(true);
        try {
            const { fieldId, label, text } = editModalData;
            const instruction = refinementInstruction || 'Por favor, refine e aprimore este texto.';
            const ragParts = buildRagParts();
            const formContext = buildFormContextAsText(fieldId);

            const instructionPart: Part = { text: `Aja como um especialista em educação. O usuário está editando o campo "${label}" de um PEI.
            
            Texto Atual:
            ---
            ${text}
            ---

            O usuário forneceu a seguinte instrução para refinar o texto: "${instruction}".

            Considere também o seguinte contexto de documentos de apoio e do restante do PEI para manter a coerência.
            
            Contexto do PEI:
            ---
            ${formContext}
            ---
            
            Refine o texto atual com base na instrução e no contexto. Mantenha o propósito original, mas aprimore a clareza e a estrutura. Devolva apenas o texto aprimorado.`};

            const regenerateParts: Part[] = [instructionPart, ...ragParts];
            const response = await callGenerativeAI(regenerateParts);
            setEditModalData(prev => prev ? { ...prev, text: response } : null);
            setAiGeneratedFields(prev => new Set(prev).add(fieldId));
        } catch (error) {
            console.error('Error during regeneration:', error);
            alert('Ocorreu um erro ao refinar o conteúdo.');
        } finally {
            setIsRegenerating(false);
            setIsRefinementInputVisible(false);
            setRefinementInstruction('');
        }
    };

    const handleEditModalSave = () => {
        if (editModalData) {
            setPeiData(prev => ({ ...prev, [editModalData.fieldId]: editModalData.text }));
        }
        closeEditModal();
    };
    
    const handleClearForm = useCallback(() => {
        setPeiData({});
        // FIX: Explicitly type the new Set to Set<string> to avoid type inference issues, resolving a type error where `Array.from` would create `unknown[]` instead of `string[]`.
        setAiGeneratedFields(new Set<string>());
        setSmartAnalysisResults({});
        setGoalActivities({});
        setOpenSmartAnalysis({});
        setErrors({});
        setCurrentPeiId(null);
    }, []);

    const handleSavePei = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }

        const recordData: NewPeiRecordData = {
            data: peiData,
            aiGeneratedFields: Array.from(aiGeneratedFields),
            smartAnalysisResults: smartAnalysisResults,
            goalActivities: goalActivities,
        };

        const studentName = peiData['aluno-nome'] || 'PEI sem nome';
        const savedRecord = savePei(recordData, currentPeiId, studentName);
        setCurrentPeiId(savedRecord.id);
        
        alert('PEI salvo com sucesso!');
        onSaveSuccess();
    };

    const handleDownloadPdf = () => {
        const currentPeiForPdf = {
            alunoNome: peiData['aluno-nome'] || 'PEI',
            data: peiData,
        };
        generateAndPrintPdf(currentPeiForPdf);
    };

    const handleExportXml = () => {
        const peiRecord = {
            alunoNome: peiData['aluno-nome'] || 'PEI_Sem_Nome',
            data: peiData,
        };
    
        let xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xmlString += `<pei aluno-nome="${peiRecord.alunoNome.replace(/"/g, '&quot;')}">\n`;
    
        fieldOrderForPreview.forEach(section => {
            xmlString += `  <secao titulo="${section.title.replace(/"/g, '&quot;')}">\n`;
            section.fields.forEach(field => {
                const value = peiRecord.data[field.id] || '';
                xmlString += `    <campo id="${field.id}" label="${field.label.replace(/"/g, '&quot;')}">`;
                xmlString += `<![CDATA[${value}]]>`;
                xmlString += `</campo>\n`;
            });
            xmlString += `  </secao>\n`;
        });
    
        xmlString += `</pei>`;
    
        const blob = new Blob([xmlString], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PEI_${peiRecord.alunoNome.replace(/\s+/g, '_')}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleShareApp = async () => {
        const shareData = {
            title: 'Assistente PEI com IA',
            text: 'Crie Planos Educacionais Individualizados com a ajuda da IA!',
            url: 'https://editorpei.netlify.app/',
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                alert('Link da aplicação copiado para a área de transferência!');
            }
        } catch (err) {
            console.error('Erro ao compartilhar:', err);
            if (err.name !== 'AbortError') {
                alert('Não foi possível compartilhar a aplicação.');
            }
        }
    };

    const renderSmartAnalysis = (analysis: Record<string, {critique: string; suggestion: string}>) => {
        const criteriaMap = {
            isSpecific: "Específica (Specific)", isMeasurable: "Mensurável (Measurable)",
            isAchievable: "Atingível (Achievable)", isRelevant: "Relevante (Relevant)", isTimeBound: "Temporal (Time-Bound)",
        };
        return (
            <div className="space-y-4 text-sm">
                {Object.entries(analysis).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-gray-800">{criteriaMap[key]}</h4>
                        <p className="text-gray-600 mt-1"><span className="font-medium">Crítica:</span> {value.critique}</p>
                        <p className="text-green-700 mt-1"><span className="font-medium">Sugestão:</span> {value.suggestion}</p>
                    </div>
                ))}
            </div>
        );
    };
    
    const renderSuggestedActivities = (activities) => {
        return (
            <div className="space-y-3">
                {activities.map((activity, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                        <h4 className="font-semibold text-gray-800">{activity.title}</h4>
                        <p className="text-gray-600 mt-1">{activity.description}</p>
                        <div className="mt-2 text-xs flex flex-wrap gap-x-4">
                            <p><span className="font-medium">Disciplina:</span> {activity.discipline}</p>
                            <p><span className="font-medium">Habilidades:</span> {Array.isArray(activity.skills) ? activity.skills.join(', ') : ''}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderIntelligentAnalysisContent = () => {
        if (!smartAnalysisData) return null;
    
        const AnalysisSection = ({ icon, title, content, colorClass = 'indigo' }) => {
            const isList = Array.isArray(content);
            const iconMap = {
                'strengths': 'fa-check-circle',
                'weaknesses': 'fa-exclamation-triangle',
                'goalAnalysis': 'fa-bullseye',
                'pedagogicalAnalysis': 'fa-chalkboard-teacher',
                'psychopedagogicalAnalysis': 'fa-brain',
                'suggestions': 'fa-lightbulb'
            };
            const colorMap = {
                'strengths': { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
                'weaknesses': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
                'suggestions': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
                'default': { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' }
            };
            const colors = colorMap[colorClass] || colorMap['default'];
    
            return (
                <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <h4 className={`text-md font-bold ${colors.text} flex items-center gap-2 mb-2`}>
                        <i className={`fa-solid ${iconMap[icon]}`}></i>
                        {title}
                    </h4>
                    {isList ? (
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                            {content.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
                    )}
                </div>
            );
        };
    
        return (
            <div className="space-y-4">
                <AnalysisSection icon="strengths" title="Pontos Fortes" content={smartAnalysisData.strengths} colorClass="strengths" />
                <AnalysisSection icon="weaknesses" title="Pontos a Melhorar" content={smartAnalysisData.weaknesses} colorClass="weaknesses" />
                <AnalysisSection icon="goalAnalysis" title="Análise de Metas" content={smartAnalysisData.goalAnalysis} colorClass="default" />
                <AnalysisSection icon="pedagogicalAnalysis" title="Análise Pedagógica" content={smartAnalysisData.pedagogicalAnalysis} colorClass="default" />
                <AnalysisSection icon="psychopedagogicalAnalysis" title="Análise Psicopedagógica" content={smartAnalysisData.psychopedagogicalAnalysis} colorClass="default" />
                <AnalysisSection icon="suggestions" title="Sugestões de Melhorias" content={smartAnalysisData.suggestions} colorClass="suggestions" />
            </div>
        );
    };

    const handleEditClick = (fieldId) => {
        const fieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
        setEditModalData({
            fieldId,
            label: fieldLabel,
            text: peiData[fieldId] || '',
        });
        setIsEditModalOpen(true);
    };
    
    const handleViewGoalActivities = (fieldId: string) => {
        const activities = goalActivities[fieldId];
        if (!activities || activities.length === 0) return;

        const fieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';

        setModalContent({
            title: `Atividades para a Meta: "${fieldLabel}"`,
            content: renderSuggestedActivities(activities),
            footer: (
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                    Fechar
                </button>
            )
        });
        setIsModalOpen(true);
    };

    const renderField = (field: PeiFormField) => {
        const { id, label } = field;
        const hasError = !!errors[id];
        const helpText = helpTexts[id];
        const isAiGenerated = aiGeneratedFields.has(id);
        const textAreaFields = [
            'id-diagnostico', 'id-contexto', 'aval-habilidades', 'aval-social', 'aval-coord',
            'metas-curto', 'metas-medio', 'metas-longo', 'est-adaptacoes', 'est-metodologias',
            'est-parcerias', 'resp-regente', 'resp-coord', 'resp-familia', 'resp-apoio',
            'revisao', 'revisao-ajustes', 'atividades-content', 'dua-content',
            'conteudos-bimestre', 'restricoes-evitar'
        ];

        const goalFields = ['metas-curto', 'metas-medio', 'metas-longo'];
        const activitySuggestionFields = ['atividades-content', 'dua-content'];

        if (textAreaFields.includes(id)) {
            const isGoal = goalFields.includes(id);
            const canSuggestActivities = isGoal || activitySuggestionFields.includes(id);
            const isDiagnosisField = id === 'id-diagnostico';
            const isAdaptationsField = id === 'est-adaptacoes';

            return (
                <div key={id} className="md:col-span-2">
                    <TextAreaWithActions
                        id={id}
                        label={label}
                        value={peiData[id] || ''}
                        onChange={(value) => handleTextAreaChange(id, value)}
                        onAiClick={() => handleActionClick(id, 'ai')}
                        onSmartClick={isGoal ? () => handleActionClick(id, 'smart') : undefined}
                        onSuggestClick={canSuggestActivities ? () => handleActionClick(id, 'suggest') : undefined}
                        onSuggestNeedsClick={isDiagnosisField ? () => handleActionClick(id, 'suggest-needs') : undefined}
                        onSuggestAdaptationsClick={isAdaptationsField ? () => handleActionClick(id, 'suggest-adaptations') : undefined}
                        onEditClick={() => handleEditClick(id)}
                        isAiLoading={loadingStates[`${id}-ai`]}
                        isSmartLoading={loadingStates[`${id}-smart`]}
                        isSuggestLoading={loadingStates[`${id}-suggest`]}
                        isSuggestNeedsLoading={loadingStates[`${id}-suggest-needs`]}
                        isSuggestAdaptationsLoading={loadingStates[`${id}-suggest-adaptations`]}
                        isGoal={canSuggestActivities}
                        placeholder={`Descreva sobre "${label}" aqui...`}
                        rows={isGoal ? 6 : 5}
                        helpText={helpText}
                        error={errors[id]}
                        isAiActionDisabled={!areRequiredFieldsFilled}
                        isAiGenerated={isAiGenerated}
                    />
                    {isGoal && goalActivities[id] && goalActivities[id].length > 0 && (
                         <button
                            type="button"
                            onClick={() => handleViewGoalActivities(id)}
                            className="mt-2 px-4 py-2 text-sm font-medium text-blue-800 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                        >
                            <i className="fa-solid fa-list-check"></i>
                            Ver Atividades para a Meta
                        </button>
                    )}
                    {goalFields.includes(id) && smartAnalysisResults[id] && (
                        <div className="mt-2 border border-gray-200 rounded-lg shadow-sm">
                            <button
                                type="button"
                                onClick={() => setOpenSmartAnalysis(prev => ({ ...prev, [id]: !prev[id] }))}
                                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                aria-expanded={!!openSmartAnalysis[id]}
                                aria-controls={`smart-analysis-${id}`}
                            >
                                <span className="font-medium text-sm text-indigo-700">Resultado da Análise SMART</span>
                                <i className={`fa-solid fa-chevron-down text-gray-500 transition-transform duration-200 ${openSmartAnalysis[id] ? 'rotate-180' : ''}`}></i>
                            </button>
                            {openSmartAnalysis[id] && (
                                <div id={`smart-analysis-${id}`} className="p-4 border-t border-gray-200 bg-white rounded-b-lg max-h-60 overflow-y-auto">
                                    {renderSmartAnalysis(smartAnalysisResults[id])}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        const renderLabelWithHelp = () => (
            <div className="flex items-center mb-1">
                <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
                 {isAiGenerated && (
                    <div className="relative group ml-2">
                        <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-xs"></i>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                            Conteúdo gerado por IA
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-700"></div>
                        </div>
                    </div>
                )}
                {helpText && (
                  <div className="relative group ml-2">
                    <i className="fa-regular fa-circle-question text-gray-400 cursor-help"></i>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 transform">
                      {helpText}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-700"></div>
                    </div>
                  </div>
                )}
            </div>
        );

        if (id === 'disciplina') {
            return (
                 <div key={id}>
                    {renderLabelWithHelp()}
                    <select
                        id={id}
                        value={peiData[id] || ''}
                        onChange={handleInputChange}
                        className={`w-full p-2.5 border rounded-lg bg-gray-50 transition-all duration-200 focus:outline-none
                            ${hasError 
                                ? 'border-red-500 focus:ring-2 focus:ring-red-300 focus:border-red-500' 
                                : 'border-gray-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500'
                            }`}
                    >
                        <option value="">Selecione uma disciplina...</option>
                        {disciplineOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    {hasError && <p className="text-red-600 text-xs mt-1">{errors[id]}</p>}
                </div>
            );
        }

        const inputType = id.includes('-nasc') || id.includes('-data-elab') || id.includes('-data') ? 'date' : 'text';
        
        return (
            <div key={id}>
                {renderLabelWithHelp()}
                <input
                    type={inputType}
                    id={id}
                    value={peiData[id] || ''}
                    onChange={handleInputChange}
                    className={`w-full p-2.5 border rounded-lg bg-gray-50 transition-all duration-200 focus:outline-none appearance-none min-w-0
                        ${hasError 
                            ? 'border-red-500 focus:ring-2 focus:ring-red-300 focus:border-red-500' 
                            : 'border-gray-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500'
                        }`}
                />
                {hasError && <p className="text-red-600 text-xs mt-1">{errors[id]}</p>}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto">
            <Modal
                id="ai-results-modal"
                title={modalContent.title}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                footer={modalContent.footer}
                wide
            >
                {modalContent.content}
            </Modal>
            
             <Modal
                id="approval-modal"
                title={`Aprovar Sugestão da IA: ${approvalModalData.label}`}
                isOpen={approvalModalData.isOpen}
                onClose={() => setApprovalModalData({ ...approvalModalData, isOpen: false })}
                footer={<>
                    <button
                        type="button"
                        onClick={() => setApprovalModalData({ ...approvalModalData, isOpen: false })}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                    >
                        Rejeitar
                    </button>
                    <button
                        type="button"
                        onClick={handleApproveSuggestion}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        Aprovar e Utilizar Texto
                    </button>
                </>}
                wide
            >
                <p className="text-sm text-gray-600 mb-2">
                    A sugestão abaixo foi gerada pela IA. Você pode editá-la diretamente no campo abaixo antes de aprovar.
                </p>
                <textarea
                    value={approvalModalData.content}
                    onChange={(e) => setApprovalModalData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-64 p-2.5 border rounded-lg transition-all duration-200 bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                />
            </Modal>


            <Modal
                id="smart-analysis-modal"
                title="Análise Inteligente do PEI"
                isOpen={isSmartAnalysisModalOpen}
                onClose={() => setIsSmartAnalysisModalOpen(false)}
                footer={
                    <button
                        type="button"
                        onClick={() => setIsSmartAnalysisModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        Fechar
                    </button>
                }
                wide
            >
                {renderIntelligentAnalysisContent()}
            </Modal>

            <Modal
                id="full-pei-modal"
                title="PEI Gerado por IA"
                isOpen={isFullPeiModalOpen}
                onClose={() => setIsFullPeiModalOpen(false)}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(fullPeiContent);
                                alert('Texto copiado para a área de transferência!');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Copiar Texto
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsFullPeiModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                            Fechar
                        </button>
                    </>
                }
                wide
            >
                <div className="prose max-w-none whitespace-pre-wrap font-serif text-gray-800 p-2 bg-gray-50 rounded-md">
                    {fullPeiContent}
                </div>
            </Modal>

            <Modal
                id="preview-pei-modal"
                title="Pré-visualização do PEI"
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                footer={
                    <>
                        <button
                            type="button"
                            onClick={handleExportXml}
                            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-file-code"></i>
                            Exportar PEI XML
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-file-pdf"></i>
                            Baixar PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPreviewModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                        >
                            Fechar
                        </button>
                    </>
                }
                wide
            >
                <div id="pei-preview-content" className="prose max-w-none text-gray-800">
                    {fieldOrderForPreview.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-8 last:mb-0">
                            <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4">{section.title}</h2>
                            <div className="space-y-4">
                                {section.fields.map(field => {
                                    const value = peiData[field.id];
                                    return (
                                        <div key={field.id}>
                                            <h3 className="font-semibold text-gray-700">{field.label}</h3>
                                            <div className="mt-1 whitespace-pre-wrap text-gray-600 bg-gray-50 p-3 rounded-md border">
                                                {value || <span className="text-gray-400 italic">Não preenchido</span>}
                                            </div>
                                        </div>
                                    );

                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {editModalData && (
                 <Modal
                    id="edit-ai-modal"
                    title={`Editar: ${editModalData.label}`}
                    isOpen={isEditModalOpen}
                    onClose={closeEditModal}
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEditModalSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                            >
                                Salvar Alterações
                            </button>
                        </>
                    }
                    wide
                >
                    <textarea
                        value={editModalData.text}
                        onChange={(e) => setEditModalData(prev => prev ? { ...prev, text: e.target.value } : null)}
                        className="w-full h-64 p-2.5 border rounded-lg transition-all duration-200 bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                        placeholder="Edite o conteúdo aqui..."
                    />
                    <div className="mt-4">
                        {!isRefinementInputVisible ? (
                             <button
                                type="button"
                                onClick={() => setIsRefinementInputVisible(true)}
                                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 flex items-center gap-2 transition-all duration-200 ease-in-out"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                Assim mas...
                            </button>
                        ) : (
                             <div className="space-y-2 p-4 border border-indigo-200 rounded-lg bg-indigo-50/50 animate-fade-in">
                                <label htmlFor="refinement-instruction" className="block text-sm font-medium text-gray-700">Instrução para Refinamento:</label>
                                <input
                                    type="text"
                                    id="refinement-instruction"
                                    value={refinementInstruction}
                                    onChange={(e) => setRefinementInstruction(e.target.value)}
                                    className="w-full p-2.5 border rounded-lg bg-white text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                                    placeholder="Ex: 'Torne o texto mais formal', 'Adicione um exemplo prático', etc."
                                />
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsRefinementInputVisible(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={handleEditModalRegenerate} 
                                        disabled={isRegenerating}
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2"
                                        style={{minWidth: '90px'}}
                                    >
                                        {isRegenerating ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                            "Enviar"
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            <div className="text-center mb-8">
                {editingPeiId && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                        <button
                            type="button"
                            onClick={() => navigateToView('pei-list-view')}
                            className="hover:text-indigo-600 hover:underline transition-colors flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-arrow-left"></i>
                            PEIs Salvos
                        </button>
                        <span className="text-gray-300">/</span>
                        <span className="font-medium text-gray-700 truncate max-w-xs">{peiData['aluno-nome'] || 'PEI Atual'}</span>
                    </div>
                )}
                <div className="flex items-center justify-center gap-4">
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight">{editingPeiId ? 'Editando PEI' : 'Editor de PEI'}</h2>
                    <button
                        type="button"
                        onClick={handleShareApp}
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                        title="Compartilhar Aplicação"
                    >
                        <i className="fa-solid fa-arrow-up-from-bracket text-xl"></i>
                    </button>
                </div>
                <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
                    {editingPeiId ? `Você está editando o PEI de ${peiData['aluno-nome'] || 'aluno'}.` : 'Preencha os campos abaixo para criar um novo Plano Educacional Individualizado.'}
                </p>
            </div>

            <div id="ai-mode-toggle" className="mb-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                     <div className="relative group h-full">
                         <div
                            className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer h-full flex flex-col bg-amber-50 border-amber-400 shadow-lg`}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <i className="fa-solid fa-bolt text-xl text-amber-500"></i>
                                <i className="fa-solid fa-check text-amber-500 text-lg"></i>
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-semibold text-gray-800">Respostas rápidas de IA</h4>
                            </div>
                        </div>
                        <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 text-center">
                            Usando o modelo ApiFreeLLM para respostas rápidas.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                        </div>
                    </div>
                    
                    <div className="relative group h-full opacity-50 pointer-events-none">
                        <div
                            className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer h-full flex flex-col bg-gray-50 border-gray-200`}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <i className="fa-solid fa-wand-magic-sparkles text-xl text-blue-500"></i>
                            </div>
                             <div className="flex-grow">
                                <h4 className="font-semibold text-gray-800">Modo Avançado</h4>
                            </div>
                        </div>
                         <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 text-center">
                            Indisponível no plano gratuito.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                        </div>
                    </div>
                </div>
            </div>


            <form onSubmit={handleSavePei} className="space-y-4">
                {fieldOrderForPreview.map((section, sectionIndex) => {
                    const totalFields = section.fields.length;
                    const filledFields = totalFields > 0
                        ? section.fields.filter(field => peiData[field.id]?.trim()).length
                        : 0;
                    const progress = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
                    
                    return (
                        <AccordionSection
                            key={sectionIndex}
                            title={section.title}
                            isOpen={openAccordionSection === sectionIndex}
                            onToggle={() => handleAccordionToggle(sectionIndex)}
                            color={circleColors[sectionIndex % circleColors.length]}
                            progress={progress}
                        >
                            {section.fields.map(field => renderField(field))}
                        </AccordionSection>
                    );
                })}

                <div className="bg-white p-6 rounded-xl shadow-md mt-6 border border-gray-200 grid grid-cols-2 gap-3 md:flex md:justify-end md:items-center md:flex-wrap md:gap-4">
                    <div className="col-span-2 text-center md:text-left md:mr-auto md:col-auto text-sm text-gray-500 italic pl-2 transition-opacity duration-500">
                        {autoSaveStatus === 'salvando' && (
                            <span className="flex items-center justify-center md:justify-start gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                Salvando...
                            </span>
                        )}
                        {autoSaveStatus === 'salvo' && (
                            <span className="flex items-center justify-center md:justify-start gap-2 text-green-600 font-medium">
                                <i className="fa-solid fa-check"></i>
                                Salvo automaticamente
                            </span>
                        )}
                    </div>
                    
                    <button
                        type="button"
                        onClick={handleIntelligentAnalysis}
                        disabled={isAnalyzingPei || !areRequiredFieldsFilled}
                        className="col-span-2 px-6 py-2.5 text-sm font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        title={!areRequiredFieldsFilled ? "Preencha os campos obrigatórios para habilitar" : "Executar análise completa do PEI"}
                    >
                        {isAnalyzingPei ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                                Analisando...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-lightbulb"></i>
                                Análise Inteligente
                            </>
                        )}
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={handleGenerateFullPei} 
                        disabled={isGeneratingFullPei || !areRequiredFieldsFilled}
                        className="col-span-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        title={!areRequiredFieldsFilled ? "Preencha os campos obrigatórios para habilitar" : "Gerar PEI completo com IA"}
                    >
                        {isGeneratingFullPei ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Gerando...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-file-invoice"></i>
                                Gerar PEI Completo com IA
                            </>
                        )}
                    </button>
                     <button
                        type="button"
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-eye"></i>
                        Pré-visualizar PEI
                    </button>
                    <button type="button" onClick={handleClearForm} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                        <i className="fa-solid fa-trash-can"></i>
                        Limpar Formulário
                    </button>
                    <button type="submit" className="col-span-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center justify-center gap-2">
                        <i className="fa-solid fa-floppy-disk"></i>
                        Salvar PEI
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- NEW COMPONENT: ActivityDetailView ---
const ActivityDetailView = () => {
    const { viewingActivityId, navigateToView } = useAppStore();
    const [activity, setActivity] = useState<Activity | null>(null);

    useEffect(() => {
        if (viewingActivityId) {
            const allActivities = getAllActivities();
            const foundActivity = allActivities.find(act => act.id === viewingActivityId);
            setActivity(foundActivity || null);
        }
    }, [viewingActivityId]);

    if (!activity) {
        return (
            <div className="text-center py-16">
                <h2 className="text-2xl font-bold text-gray-700">Atividade não encontrada</h2>
                <p className="text-gray-500 mt-2">A atividade que você está procurando não existe ou foi removida.</p>
                <button
                    type="button"
                    onClick={() => navigateToView('activity-bank-view')}
                    className="mt-6 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Voltar ao Banco de Atividades
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-md border border-gray-200">
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-bold text-gray-800 flex-1 pr-4">{activity.title}</h2>
                <button
                    type="button"
                    onClick={() => navigateToView('activity-bank-view')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 flex-shrink-0"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                    Voltar
                </button>
            </div>

            <div className="prose max-w-none text-gray-600 leading-relaxed">
                <p>{activity.description}</p>
            </div>

            <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Detalhes da Atividade</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                        <strong className="block text-gray-500">Disciplina</strong>
                        <p className="text-gray-800">{activity.discipline}</p>
                    </div>
                     <div>
                        <strong className="block text-gray-500">Favorito</strong>
                        <p className="text-gray-800">{activity.isFavorited ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                        <strong className="block text-gray-500">Habilidades Trabalhadas</strong>
                        {Array.isArray(activity.skills) && activity.skills?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {activity.skills.map(skill => <Tag key={skill} colorClass="bg-green-100 text-green-800">{skill}</Tag>)}
                            </div>
                        ) : <p className="text-gray-500 italic">Nenhuma especificada</p>}
                    </div>
                    <div>
                        <strong className="block text-gray-500">Necessidades Específicas</strong>
                        {Array.isArray(activity.needs) && activity.needs?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {activity.needs.map(need => <Tag key={need} colorClass="bg-sky-100 text-sky-800">{need}</Tag>)}
                            </div>
                        ) : <p className="text-gray-500 italic">Nenhuma especificada</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- MERGED FROM components/ActivityBankView.tsx ---
const ACTIVITY_FILTERS_KEY = 'activityBankFilters';

const getInitialFilters = () => {
    try {
        const savedFilters = localStorage.getItem(ACTIVITY_FILTERS_KEY);
        if (savedFilters) {
            return JSON.parse(savedFilters);
        }
    } catch (error) {
        console.warn("Failed to parse filters from localStorage", error);
    }
    return {
        showOnlyFavorites: false,
        disciplineFilter: '',
        skillsFilter: '',
        needsFilter: '',
        sortBy: 'favorites',
    };
};

const ActivityBankView = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState({ visible: false, message: '' });

    const initialFilters = getInitialFilters();
    const [showOnlyFavorites, setShowOnlyFavorites] = useState(initialFilters.showOnlyFavorites);
    const [disciplineFilter, setDisciplineFilter] = useState(initialFilters.disciplineFilter);
    const [skillsFilter, setSkillsFilter] = useState(initialFilters.skillsFilter);
    const [needsFilter, setNeedsFilter] = useState(initialFilters.needsFilter);
    const [sortBy, setSortBy] = useState(initialFilters.sortBy);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [isRefinementInputVisible, setIsRefinementInputVisible] = useState(false);
    const [refinementInstruction, setRefinementInstruction] = useState('');
    const [refinementSuggestion, setRefinementSuggestion] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isSuggestingSkills, setIsSuggestingSkills] = useState(false);
    const [isSuggestingNeeds, setIsSuggestingNeeds] = useState(false);
    
    const { editingPeiId, navigateToEditPei, navigateToActivityDetail } = useAppStore();

    useEffect(() => {
        setActivities(getAllActivities());
    }, []);

    useEffect(() => {
        try {
            const filtersToSave = {
                showOnlyFavorites,
                disciplineFilter,
                skillsFilter,
                needsFilter,
                sortBy,
            };
            localStorage.setItem(ACTIVITY_FILTERS_KEY, JSON.stringify(filtersToSave));
        } catch (error) {
            console.warn("Failed to save filters to localStorage", error);
        }
    }, [showOnlyFavorites, disciplineFilter, skillsFilter, needsFilter, sortBy]);

    const filteredActivities = useMemo(() => {
        let filtered = activities
            .filter(activity => {
                if (showOnlyFavorites && !activity.isFavorited) {
                    return false;
                }
                if (disciplineFilter && activity.discipline !== disciplineFilter) {
                    return false;
                }
                 if (skillsFilter) {
                    const lowerCaseFilter = skillsFilter.toLowerCase().trim();
                    if (lowerCaseFilter) {
                        const skillsArray = Array.isArray(activity.skills) 
                            ? activity.skills 
                            : (typeof activity.skills === 'string' ? activity.skills.split(',').map(s => s.trim()) : []);
                        if (!skillsArray.some(skill => skill.toLowerCase().includes(lowerCaseFilter))) {
                            return false;
                        }
                    }
                }
                if (needsFilter) {
                    const lowerCaseFilter = needsFilter.toLowerCase().trim();
                    if (lowerCaseFilter) {
                        const needsArray = Array.isArray(activity.needs) 
                            ? activity.needs 
                            : (typeof activity.needs === 'string' ? activity.needs.split(',').map(n => n.trim()) : []);
                        if (!needsArray.some(need => need.toLowerCase().includes(lowerCaseFilter))) {
                            return false;
                        }
                    }
                }
                if (searchTerm.trim() === '') {
                    return true;
                }
                const lowerCaseSearch = searchTerm.toLowerCase();
                return (
                    activity.title.toLowerCase().includes(lowerCaseSearch) ||
                    activity.description.toLowerCase().includes(lowerCaseSearch) ||
                    activity.discipline.toLowerCase().includes(lowerCaseSearch)
                );
            });
        
        const sortedActivities = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'discipline':
                    return a.discipline.localeCompare(b.discipline) || a.title.localeCompare(b.title);
                case 'date-desc':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'date-asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'favorites':
                default:
                    const favoriteSort = (b.isFavorited ? 1 : 0) - (a.isFavorited ? 1 : 0);
                    if (favoriteSort !== 0) {
                        return favoriteSort;
                    }
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
        return sortedActivities;
    }, [activities, searchTerm, showOnlyFavorites, disciplineFilter, skillsFilter, needsFilter, sortBy]);

    const favoriteCount = useMemo(() => activities.filter(a => a.isFavorited).length, [activities]);

    const updateAndSaveActivities = (updatedActivities: Activity[]) => {
        setActivities(updatedActivities);
        saveActivities(updatedActivities);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta atividade do banco?')) {
            const updated = activities.filter(a => a.id !== id);
            updateAndSaveActivities(updated);
        }
    };

    const handleToggleFavorite = (id: string) => {
        const updated = activities.map(a => 
            a.id === id ? { ...a, isFavorited: !a.isFavorited } : a
        );
        updateAndSaveActivities(updated);
    };

    const handleRating = (id: string, newRating: 'like' | 'dislike') => {
        const updated = activities.map(a => {
            if (a.id === id) {
                // If the user clicks the same rating again, toggle it off (set to null)
                const finalRating = a.rating === newRating ? null : newRating;
                return { ...a, rating: finalRating };
            }
            return a;
        });
        updateAndSaveActivities(updated);
    };
    
    const handleAddToPei = (activity: Activity) => {
        if (!editingPeiId) {
            alert('Por favor, abra um PEI na tela "PEIs Salvos" ou inicie um novo no "Editor PEI" antes de adicionar uma atividade.');
            return;
        }
        addActivityToPei(editingPeiId, activity);
        
        setToast({ visible: true, message: 'Atividade adicionada ao PEI!' });
        setTimeout(() => {
            setToast({ visible: false, message: '' });
            navigateToEditPei(editingPeiId);
        }, 1500);
    };

    const handleShare = async (activity: Activity) => {
        const shareData = {
            title: `Atividade PEI: ${activity.title}`,
            text: `Confira esta atividade para o PEI:\n\nTítulo: ${activity.title}\n\nDescrição: ${activity.description}`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Erro ao compartilhar:', err);
            }
        } else {
            const subject = encodeURIComponent(shareData.title);
            const body = encodeURIComponent(shareData.text);
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        }
    };

    const handleOpenEditModal = (activity: Activity) => {
        setEditingActivity({ ...activity });
        setIsEditModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setEditingActivity({
            id: 'new',
            title: '',
            description: '',
            discipline: disciplineOptions[0],
            skills: [],
            needs: [],
            isFavorited: false,
            isDUA: false,
            goalTags: [],
            rating: null,
            comments: '',
            sourcePeiId: null,
            createdAt: new Date().toISOString(),
        });
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingActivity(null);
        setIsRefinementInputVisible(false);
        setRefinementInstruction('');
        setRefinementSuggestion(null);
    };

    const handleSaveEditedActivity = () => {
        if (!editingActivity) return;

        const skillsArray = typeof editingActivity.skills === 'string'
            ? (editingActivity.skills).split(',').map(s => s.trim()).filter(Boolean)
            : (Array.isArray(editingActivity.skills) ? editingActivity.skills : []);

        const needsArray = typeof editingActivity.needs === 'string'
            ? (editingActivity.needs).split(',').map(s => s.trim()).filter(Boolean)
            : (Array.isArray(editingActivity.needs) ? editingActivity.needs : []);

        const finalActivity = {
            ...editingActivity,
            skills: skillsArray,
            needs: needsArray,
        };
        
        let updatedActivities;
        if (finalActivity.id === 'new') {
            const newActivity = { 
                ...finalActivity, 
                id: crypto.randomUUID(), 
                sourcePeiId: null 
            };
            updatedActivities = [...activities, newActivity];
        } else {
            updatedActivities = activities.map(a => 
                a.id === finalActivity.id ? finalActivity : a
            );
        }
        
        updateAndSaveActivities(updatedActivities);
        handleCloseEditModal();
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editingActivity) return;
        const { id, value, type, checked } = e.target as HTMLInputElement;

        setEditingActivity(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [id]: type === 'checkbox' ? checked : value
            };
        });
    };

    const handleActivityRefinement = async () => {
        if (!editingActivity || !editingActivity.description) return;
        setIsRegenerating(true);
        setRefinementSuggestion(null);
        try {
            const instruction = refinementInstruction || 'Por favor, refine e aprimore esta descrição.';
            const prompt = `Aja como um especialista em pedagogia. O usuário está editando a descrição de uma atividade educacional.

Atividade:
- Título: ${editingActivity.title}
- Disciplina: ${editingActivity.discipline}

Descrição Atual:
---
${editingActivity.description}
---

O usuário forneceu a seguinte instrução para refinar a descrição: "${instruction}".

Refine a descrição atual com base na instrução e no contexto. Mantenha o propósito original, mas aprimore a clareza, o engajamento e a adequação pedagógica. Devolva apenas o texto da descrição aprimorada, sem títulos ou introduções.`;

            const response = await callGenerativeAI(prompt);
            setRefinementSuggestion(response);
        } catch (error) {
            console.error('Error during activity refinement:', error);
            alert('Ocorreu um erro ao refinar a descrição da atividade.');
        } finally {
            setIsRegenerating(false);
            setIsRefinementInputVisible(false);
            setRefinementInstruction('');
        }
    };
    
    const handleAiSuggestion = async (type: 'skills' | 'needs') => {
        if (!editingActivity) return;
        
        const setLoading = type === 'skills' ? setIsSuggestingSkills : setIsSuggestingNeeds;
        setLoading(true);

        try {
            let peiContext = 'Nenhum PEI aberto para contexto adicional.';
            if (editingPeiId) {
                const pei = getPeiById(editingPeiId);
                if (pei && pei.data) {
                    peiContext = `
                        Diagnóstico do Aluno: ${pei.data['id-diagnostico'] || 'Não informado'}
                        Habilidades Acadêmicas: ${pei.data['aval-habilidades'] || 'Não informado'}
                        Aspectos Sociais e Comportamentais: ${pei.data['aval-social'] || 'Não informado'}
                    `;
                }
            }

            const activityContext = `
                Título da Atividade: ${editingActivity.title || 'Não informado'}
                Descrição da Atividade: ${editingActivity.description || 'Não informado'}
                Disciplina: ${editingActivity.discipline || 'Não informada'}
            `;

            const promptType = type === 'skills' 
                ? 'sugira uma lista de 5 a 7 habilidades específicas que esta atividade pode desenvolver.' 
                : 'sugira uma lista de 3 a 5 necessidades específicas que esta atividade pode atender.';
            
            const example = type === 'skills'
                ? 'Raciocínio lógico, Coordenação motora fina, Interpretação de texto, Resolução de problemas'
                : 'Apoio visual, Instruções segmentadas, Tempo extra, Mediação de conflitos';

            const prompt = `
                Aja como um especialista em psicopedagogia.
                Com base no contexto do aluno e da atividade descrita abaixo, ${promptType}

                Contexto do Aluno:
                ---
                ${peiContext}
                ---

                Contexto da Atividade:
                ---
                ${activityContext}
                ---

                Sua resposta deve ser APENAS uma lista de itens separados por vírgula. Não inclua títulos ou introduções.
                Exemplo: ${example}
            `;
            
            const response = await callGenerativeAI(prompt);
            
            const currentItems = editingActivity[type];
            const existingItems = Array.isArray(currentItems) 
                ? currentItems 
                : (typeof currentItems === 'string' && currentItems.length > 0 ? currentItems.split(',').map(s => s.trim()) : []);

            const suggestedItems = response.split(',').map(s => s.trim()).filter(Boolean);
            
            const combinedItems = [...new Set([...existingItems, ...suggestedItems])];

            setEditingActivity(prev => prev ? { ...prev, [type]: combinedItems.join(', ') } : null);

        } catch (error) {
            console.error(`Error suggesting ${type}:`, error);
            alert(`Ocorreu um erro ao sugerir ${type}.`);
        } finally {
            setLoading(false);
        }
    };

    const handleViewActivity = (activityId: string) => {
        navigateToActivityDetail(activityId);
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Banco de Atividades e Recursos</h2>
                <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Criar Nova Atividade
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex items-center gap-5">
                    <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl">
                        <i className="fa-solid fa-layer-group"></i>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Total de Atividades</p>
                        <p className="text-3xl font-bold text-gray-800">{activities.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex items-center gap-5">
                    <div className="bg-amber-100 text-amber-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl">
                        <i className="fa-solid fa-star"></i>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Atividades Favoritas</p>
                        <p className="text-3xl font-bold text-gray-800">{favoriteCount}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-200">
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                         <label htmlFor="search-activities" className="block text-sm font-medium text-gray-700 mb-1">
                            Pesquisar por Termo
                        </label>
                        <input
                            id="search-activities"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquisar por título, descrição..."
                            className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="discipline-filter" className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
                        <select
                            id="discipline-filter"
                            value={disciplineFilter}
                            onChange={(e) => setDisciplineFilter(e.target.value)}
                            className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                        >
                            <option value="">Todas</option>
                            {disciplineOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="skills-filter" className="block text-sm font-medium text-gray-700 mb-1">Habilidades</label>
                        <input
                            id="skills-filter"
                            type="text"
                            value={skillsFilter}
                            onChange={(e) => setSkillsFilter(e.target.value)}
                            placeholder="Filtrar por habilidade..."
                            className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="needs-filter" className="block text-sm font-medium text-gray-700 mb-1">Necessidades</label>
                        <input
                            id="needs-filter"
                            type="text"
                            value={needsFilter}
                            onChange={(e) => setNeedsFilter(e.target.value)}
                            placeholder="Filtrar por necessidade..."
                            className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex items-center">
                         <input
                            id="filter-favorites"
                            type="checkbox"
                            checked={showOnlyFavorites}
                            onChange={(e) => setShowOnlyFavorites(e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="filter-favorites" className="ml-2 block text-sm font-medium text-gray-700">
                            Favoritos
                        </label>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredActivities.length > 0 ? (
                    filteredActivities.map(activity => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onDelete={handleDelete}
                            onToggleFavorite={handleToggleFavorite}
                            onAddToPei={handleAddToPei}
                            onShare={handleShare}
                            onEdit={handleOpenEditModal}
                            onViewDetails={() => handleViewActivity(activity.id)}
                            onRate={handleRating}
                        />
                    ))
                ) : (
                    <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                        <div className="text-5xl text-gray-400 mb-4"><i className="fa-regular fa-lightbulb"></i></div>
                        <h3 className="text-xl font-semibold text-gray-700">Nenhuma atividade encontrada</h3>
                        <p className="text-gray-500 mt-2">Tente ajustar seus filtros ou adicione novas atividades a partir do Editor PEI.</p>
                    </div>
                )}
            </div>

            {editingActivity && (
                <Modal
                    id="edit-activity-modal"
                    title={editingActivity.id === 'new' ? 'Criar Nova Atividade' : 'Editar Atividade'}
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    footer={
                        <>
                            <button type="button" onClick={handleCloseEditModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                                Cancelar
                            </button>
                            <button type="button" onClick={handleSaveEditedActivity} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                                Salvar
                            </button>
                        </>
                    }
                    wide
                >
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input
                                type="text"
                                id="title"
                                value={editingActivity.title}
                                onChange={handleEditFormChange}
                                className="w-full p-2.5 border rounded-lg bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                            <textarea
                                id="description"
                                rows={5}
                                value={editingActivity.description}
                                onChange={handleEditFormChange}
                                className="w-full p-2.5 border rounded-lg bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            />
                             {refinementSuggestion && (
                                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <h4 className="font-semibold text-sm text-green-800">Sugestão de Refinamento:</h4>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{refinementSuggestion}</p>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setRefinementSuggestion(null)}
                                            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                                        >
                                            Dispensar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingActivity(prev => prev ? { ...prev, description: refinementSuggestion } : null);
                                                setRefinementSuggestion(null);
                                            }}
                                            className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                        >
                                            Aceitar Sugestão
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="mt-4">
                                {!isRefinementInputVisible ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsRefinementInputVisible(true)}
                                        className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 flex items-center gap-2 transition-all duration-200 ease-in-out"
                                    >
                                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                                        Assim mas...
                                    </button>
                                ) : (
                                    <div className="space-y-2 p-4 border border-indigo-200 rounded-lg bg-indigo-50/50 animate-fade-in">
                                        <label htmlFor="refinement-instruction-activity" className="block text-sm font-medium text-gray-700">Instrução para Refinamento:</label>
                                        <input
                                            type="text"
                                            id="refinement-instruction-activity"
                                            value={refinementInstruction}
                                            onChange={(e) => setRefinementInstruction(e.target.value)}
                                            className="w-full p-2.5 border rounded-lg bg-white text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                                            placeholder="Ex: 'Torne o texto mais lúdico', 'Adapte para crianças de 5 anos', etc."
                                        />
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button 
                                                type="button" 
                                                onClick={() => setIsRefinementInputVisible(false)}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleActivityRefinement} 
                                                disabled={isRegenerating}
                                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2"
                                                style={{minWidth: '90px'}}
                                            >
                                                {isRegenerating ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                ) : (
                                                    "Enviar"
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="discipline" className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
                            <select
                                id="discipline"
                                value={editingActivity.discipline}
                                onChange={handleEditFormChange}
                                className="w-full p-2.5 border rounded-lg bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            >
                                {disciplineOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">Habilidades (separadas por vírgula)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    id="skills"
                                    value={Array.isArray(editingActivity.skills) ? editingActivity.skills.join(', ') : editingActivity.skills}
                                    onChange={handleEditFormChange}
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                                />
                                <button type="button" onClick={() => handleAiSuggestion('skills')} disabled={isSuggestingSkills} className="p-2.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50" title="Sugerir Habilidades com IA">
                                     {isSuggestingSkills ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-700"></div> : <i className="fa-solid fa-lightbulb"></i>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="needs" className="block text-sm font-medium text-gray-700 mb-1">Necessidades Específicas (separadas por vírgula)</label>
                             <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    id="needs"
                                    value={Array.isArray(editingActivity.needs) ? editingActivity.needs.join(', ') : editingActivity.needs}
                                    onChange={handleEditFormChange}
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                                />
                                <button type="button" onClick={() => handleAiSuggestion('needs')} disabled={isSuggestingNeeds} className="p-2.5 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 disabled:opacity-50" title="Sugerir Necessidades com IA">
                                     {isSuggestingNeeds ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-700"></div> : <i className="fa-solid fa-lightbulb"></i>}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <input
                                id="isDUA"
                                type="checkbox"
                                checked={!!editingActivity.isDUA}
                                onChange={handleEditFormChange}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isDUA" className="ml-2 block text-sm text-gray-900">
                                Atividade baseada no DUA (Desenho Universal para a Aprendizagem)
                            </label>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};


// --- MERGED FROM components/PeiListView.tsx ---
const PeiListView = () => {
  const [peis, setPeis] = useState<PeiRecord[]>([]);
  const { navigateToEditPei, navigateToNewPei } = useAppStore();
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPeis(getAllPeis());
  }, []);
  
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const xmlString = e.target?.result as string;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");
            
            const parseError = xmlDoc.querySelector("parsererror");
            if (parseError) {
                console.error("Erro ao analisar XML:", parseError.textContent);
                alert("O ficheiro XML é inválido ou está mal formatado.");
                return;
            }

            const peiElement = xmlDoc.querySelector("pei");
            if (!peiElement) {
                alert("Formato de XML inválido. Elemento raiz <pei> não encontrado.");
                return;
            }

            const studentName = peiElement.getAttribute("aluno-nome");
            if (!studentName) {
                alert("Formato de XML inválido. Atributo 'aluno-nome' em <pei> não encontrado.");
                return;
            }
            
            const peiData: PeiData = {};
            const campoElements = xmlDoc.querySelectorAll("campo");
            campoElements.forEach(campo => {
                const id = campo.getAttribute("id");
                const value = campo.textContent || ''; 
                if (id) {
                    peiData[id] = value;
                }
            });

            const newRecordData: NewPeiRecordData = {
                data: peiData,
                aiGeneratedFields: [],
                smartAnalysisResults: {},
                goalActivities: {}
            };
            
            savePei(newRecordData, null, studentName);

            setPeis(getAllPeis());
            alert(`PEI de "${studentName}" importado com sucesso!`);

        } catch (error) {
            console.error("Erro ao importar o ficheiro XML:", error);
            alert("Ocorreu um erro ao processar o ficheiro XML.");
        } finally {
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    reader.readAsText(file);
  };

  const handleImportClick = () => {
      importFileRef.current?.click();
  };


  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este PEI? Esta ação não pode ser desfeita.')) {
        deletePei(id);
        setPeis(getAllPeis()); // Refresh the list from storage
    }
  };

  const handleSharePdf = (id: string) => {
    const peiToPrint = getPeiById(id);
    if (peiToPrint) {
      generateAndPrintPdf(peiToPrint);
    } else {
      alert('Não foi possível encontrar o PEI para gerar o PDF.');
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">PEIs Salvos</h2>
        <div className="flex items-center gap-2">
            <input
                type="file"
                ref={importFileRef}
                onChange={handleFileSelected}
                accept=".xml,application/xml"
                className="hidden"
            />
            <button
                type="button"
                onClick={handleImportClick}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
                <i className="fa-solid fa-upload"></i>
                Importar XML
            </button>
            <button 
                type="button"
                onClick={navigateToNewPei}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
                <i className="fa-solid fa-plus"></i>
                Criar Novo PEI
            </button>
        </div>
      </div>

      {peis.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-white">
            <div className="text-5xl text-gray-400 mb-4"><i className="fa-regular fa-file-lines"></i></div>
            <h3 className="text-xl font-semibold text-gray-700">Nenhum PEI encontrado</h3>
            <p className="text-gray-500 mt-2">Comece a criar um novo Plano Educacional Individualizado.</p>
        </div>
      ) : (
        <div className="space-y-4">
            {peis.map(pei => (
                <div key={pei.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-grow">
                        <h3 className="text-lg font-semibold text-indigo-700">{pei.alunoNome}</h3>
                        <p className="text-sm text-gray-500">Última modificação: {formatDate(pei.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => navigateToEditPei(pei.id)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                            title="Editar PEI"
                        >
                            <i className="fa-solid fa-pencil"></i>
                            <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSharePdf(pei.id)}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                            title="Baixar PDF"
                        >
                            <i className="fa-solid fa-file-pdf"></i>
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDelete(pei.id)}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                            title="Excluir PEI"
                        >
                           <i className="fa-solid fa-trash-can"></i>
                           <span className="hidden sm:inline">Excluir</span>
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};


// --- MERGED FROM components/SupportFilesView.tsx ---
const SupportFilesView = () => {
    const [files, setFiles] = useState<RagFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [filesToPreview, setFilesToPreview] = useState<RagFile[]>([]);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    useEffect(() => {
        setFiles(getAllRagFiles());
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = event.target.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setIsProcessing(true);

        // FIX: Convert FileList to an array to ensure items are correctly typed as `File` objects.
        // FIX: Explicitly type `uploadedFilesArray` as `File[]` to resolve TypeScript errors where properties were being accessed on an `unknown` type.
        const uploadedFilesArray: File[] = Array.from(uploadedFiles);

        // FIX: Add a pre-check to ensure pdf.js is loaded before attempting to process PDF files.
        // This prevents a "pdfjsLib is not defined" error if the library hasn't loaded yet.
        if (uploadedFilesArray.some(f => f.type === 'application/pdf') && (typeof pdfjsLib === 'undefined' || !(pdfjsLib as any).getDocument)) {
            alert("A biblioteca de leitura de PDF (pdf.js) ainda não foi carregada. Por favor, verifique a sua conexão com a internet, aguarde alguns segundos e tente novamente. Se o problema persistir, recarregue a página.");
            setIsProcessing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        const newFilesToPreview: RagFile[] = [];

        // FIX: Iterate over the typed array of files to prevent TypeScript errors where properties were being accessed on an `unknown` type.
        for (const file of uploadedFilesArray) {
            if (files.some(f => f.name === file.name)) {
                console.warn(`Ficheiro duplicado ignorado: ${file.name}`);
                continue; 
            }

            try {
                let content: string = '';
                let mimeType: string = file.type;
                let type: 'text' | 'image' = 'text';

                if (file.type === 'application/pdf') {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
                    }
                    content = fullText.trim();
                } else if (file.name.endsWith('.docx')) {
                     const arrayBuffer = await file.arrayBuffer();
                     const result = await mammoth.extractRawText({ arrayBuffer });
                     content = result.value;
                } else if (file.type.startsWith('image/')) {
                    type = 'image';
                    content = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            if (typeof reader.result === 'string') {
                                resolve(reader.result.split(',')[1]);
                            } else {
                                reject(new Error("Failed to read file as Data URL"));
                            }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                } else {
                    mimeType = 'text/plain';
                    content = await file.text();
                }
                newFilesToPreview.push({ name: file.name, type, mimeType, content, selected: true });
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                // FIX: Provide a more informative error message in the catch block.
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
                alert(`Não foi possível processar o ficheiro ${file.name}. Detalhes: ${errorMessage}`);
            }
        }

        if (newFilesToPreview.length > 0) {
            setFilesToPreview(newFilesToPreview);
            setIsPreviewModalOpen(true);
        }

        setIsProcessing(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleTogglePreviewSelection = (fileName: string) => {
        setFilesToPreview(prevFiles =>
            prevFiles.map(file =>
                file.name === fileName ? { ...file, selected: !file.selected } : file
            )
        );
    };

    const handleConfirmAttachment = () => {
        const selectedForAttachment = filesToPreview.filter(f => f.selected);
        const updatedFiles = [...files, ...selectedForAttachment];
        setFiles(updatedFiles);
        saveRagFiles(updatedFiles);
        setIsPreviewModalOpen(false);
        setFilesToPreview([]);
    };

    const handleToggleSelect = (fileName: string) => {
        const updatedFiles = files.map(file =>
            file.name === fileName ? { ...file, selected: !file.selected } : file
        );
        setFiles(updatedFiles);
        saveRagFiles(updatedFiles);
    };

    const handleDeleteFile = (fileName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir o ficheiro "${fileName}"?`)) {
            const updatedFiles = files.filter(file => file.name !== fileName);
            setFiles(updatedFiles);
            saveRagFiles(updatedFiles);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
             <Modal
                id="file-preview-modal"
                title="Pré-visualizar e Anexar Ficheiros"
                isOpen={isPreviewModalOpen}
                onClose={() => { setIsPreviewModalOpen(false); setFilesToPreview([]); }}
                wide
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => { setIsPreviewModalOpen(false); setFilesToPreview([]); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmAttachment}
                            disabled={filesToPreview.filter(f => f.selected).length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                        >
                            Anexar {filesToPreview.filter(f => f.selected).length || ''} Ficheiro(s)
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Os seguintes ficheiros foram processados. Desmarque aqueles que não deseja anexar.
                    </p>
                    {filesToPreview.map(file => (
                        <div key={file.name} className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                            <div className="flex items-start gap-4">
                                <input
                                    type="checkbox"
                                    checked={file.selected}
                                    onChange={() => handleTogglePreviewSelection(file.name)}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer flex-shrink-0"
                                    aria-label={`Selecionar ${file.name}`}
                                />
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-semibold text-gray-800 break-words">{file.name}</h4>
                                    <div className="mt-2 p-3 bg-white rounded-md border text-sm text-gray-600 max-h-32 overflow-y-auto">
                                        {file.type === 'image' ? (
                                             <img
                                                src={`data:${file.mimeType};base64,${file.content}`}
                                                alt={`Pré-visualização de ${file.name}`}
                                                className="max-w-full h-auto rounded"
                                            />
                                        ) : (
                                            <p className="whitespace-pre-wrap break-words">
                                                {file.content.split(' ').slice(0, 100).join(' ') + (file.content.split(' ').length > 100 ? '...' : '')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>


            <h2 className="text-3xl font-bold text-gray-800 mb-2">Ficheiros de Apoio (RAG)</h2>
            <p className="text-gray-600 mb-6">Anexe ficheiros (.txt, .md, .pdf, .docx, imagens) para dar contexto à IA. Apenas os ficheiros selecionados serão utilizados.</p>
            
            <input
                type="file"
                multiple
                accept=".txt,.md,.pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                disabled={isProcessing}
            />
            
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full mb-6 px-6 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:bg-indigo-400 disabled:cursor-wait"
            >
                {isProcessing ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        A processar...
                    </>
                ) : (
                    <>
                        <i className="fa-solid fa-paperclip"></i>
                        Anexar Ficheiros
                    </>
                )}
            </button>

            {files.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                    <div className="text-5xl text-gray-400 mb-4"><i className="fa-regular fa-folder-open"></i></div>
                    <h3 className="text-xl font-semibold text-gray-700">Nenhum ficheiro de apoio</h3>
                    <p className="text-gray-500 mt-2">Anexe documentos para fornecer contexto adicional à IA.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {files.map(file => (
                        <div key={file.name} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-4 transition-all hover:border-indigo-300 hover:shadow-sm">
                            <label className="flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    checked={file.selected}
                                    onChange={() => handleToggleSelect(file.name)}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </label>
                            {file.type === 'image' ? (
                                <img
                                    src={`data:${file.mimeType};base64,${file.content}`}
                                    alt={`Pré-visualização de ${file.name}`}
                                    className="w-12 h-12 flex-shrink-0 object-cover rounded-md border border-gray-200"
                                />
                            ) : (
                                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-md text-gray-400">
                                    {file.mimeType && file.mimeType.includes('pdf') ? (
                                        <i className="fa-solid fa-file-pdf text-2xl text-red-500"></i>
                                    ) : file.mimeType && (file.mimeType.includes('word') || file.mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) ? (
                                        <i className="fa-solid fa-file-word text-2xl text-blue-500"></i>
                                    ) : (
                                        <i className="fa-solid fa-file-lines text-2xl"></i>
                                    )}
                                </div>
                            )}
                            <div className="flex-grow text-gray-700 font-medium truncate" title={file.name}>
                                {file.name}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDeleteFile(file.name)}
                                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors flex-shrink-0"
                                title="Excluir Ficheiro"
                            >
                               <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- MERGED FROM components/PrivacyPolicyView.tsx ---
const PrivacyPolicyView = () => {
    const { hasAgreedToPrivacy, setHasAgreedToPrivacy, navigateToNewPei } = useAppStore();
    const [isChecked, setIsChecked] = useState(hasAgreedToPrivacy);

    const handleAgree = () => {
        setHasAgreedToPrivacy(true);
        setIsChecked(true);
        alert("Obrigado por aceitar a Política de Privacidade!");
        navigateToNewPei();
    };

    // FIX: Changed component to accept a generic props object to resolve TypeScript errors related to missing 'children' property.
    const SectionTitle = (props) => {
        const { children } = props;
        return (<h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">{children}</h3>);
    };
    
    // FIX: Changed component to accept a generic props object to resolve TypeScript errors related to missing 'children' property.
    const SubTitle = (props) => {
        const { children } = props;
        return (<h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2">{children}</h4>);
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-full max-w-4xl mx-auto">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">Política de Privacidade</h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow text-gray-600 leading-relaxed">
                <p className="text-sm text-gray-500 mb-4">Última atualização: 16 de agosto de 2025</p>
                
                <SectionTitle>1. Introdução</SectionTitle>
                <p>Bem-vindo ao <strong>Assistente de PEI com IA</strong>. Esta aplicação foi criada para auxiliar educadores e profissionais da educação na elaboração de Planos Educacionais Individualizados (PEI).</p>
                <p>A sua privacidade e a segurança dos dados com os quais você trabalha são a nossa maior prioridade. Esta Política de Privacidade explica quais informações são manuseadas, como são utilizadas e, mais importante, como garantimos a sua proteção.</p>

                <SectionTitle>2. Armazenamento de Dados</SectionTitle>
                <p>É fundamental entender que esta aplicação funciona <strong>inteiramente no seu navegador</strong>. Todos os dados que você insere, incluindo PEIs, atividades e ficheiros de apoio, são armazenados localmente no seu dispositivo usando a tecnologia de armazenamento do navegador (LocalStorage). <strong>Nós, como desenvolvedores, não temos acesso, não coletamos nem armazenamos nenhuma dessas informações nos nossos servidores.</strong></p>

                <SectionTitle>3. Uso da IA (ApiFreeLLM)</SectionTitle>
                <p>Para fornecer as funcionalidades de inteligência artificial, a aplicação envia o conteúdo dos campos relevantes do PEI e dos ficheiros de apoio selecionados para o serviço ApiFreeLLM. Os dados são enviados através de uma conexão segura e são utilizados apenas para gerar a resposta solicitada.</p>
                
                <SectionTitle>4. O seu Consentimento</SectionTitle>
                <p>Ao utilizar as funcionalidades de IA da aplicação, você concorda com o envio temporário dos dados do PEI para a API da ApiFreeLLM para fins de processamento. A responsabilidade pelo conteúdo inserido na plataforma, especialmente dados sensíveis de alunos, é inteiramente sua.</p>
            </div>

            {!hasAgreedToPrivacy && (
                <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl mt-auto">
                    <label htmlFor="privacy-agree" className="flex items-center cursor-pointer select-none mb-4">
                        <input 
                            id="privacy-agree"
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => setIsChecked(!isChecked)}
                            className="h-5 w-5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                        />
                        <span className="ml-3 text-sm text-gray-700">Eu li e concordo com a Política de Privacidade.</span>
                    </label>
                    <button 
                        type="button"
                        onClick={handleAgree}
                        disabled={!isChecked}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                        Aceitar e Continuar
                    </button>
                </div>
            )}
        </div>
    );
};

// --- NEW COMPONENT: Interactive Onboarding Tour ---
const OnboardingTour = ({ steps, onComplete }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [elementRect, setElementRect] = useState(null);
    const popoverRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const { navigateToView } = useAppStore();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentStep = steps[stepIndex];

    useEffect(() => {
        if (currentStep.view) {
            navigateToView(currentStep.view);
        }

        const selector = isMobile ? currentStep.mobileSelector : currentStep.desktopSelector;
        if (!selector) {
            setElementRect(null); // For centered steps
            return;
        }

        // Use a timeout to allow the view to re-render after navigation
        const timeoutId = setTimeout(() => {
            const element = document.querySelector(selector);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                // Another timeout to wait for scroll to finish
                const scrollTimeoutId = setTimeout(() => {
                     setElementRect(element.getBoundingClientRect());
                }, 300);
                return () => clearTimeout(scrollTimeoutId);
            } else {
                console.warn(`Onboarding element not found: ${selector}`);
            }
        }, 100);

        return () => clearTimeout(timeoutId);

    }, [stepIndex, isMobile, currentStep.view, navigateToView]);

    const getPopoverPosition = () => {
        if (!elementRect || !popoverRef.current) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

        const popoverHeight = popoverRef.current.offsetHeight;
        const popoverWidth = popoverRef.current.offsetWidth;
        const spaceBelow = window.innerHeight - elementRect.bottom;
        
        let top;
        if (spaceBelow > popoverHeight + 20) {
            top = elementRect.bottom + 10; // Position below
        } else {
            top = elementRect.top - popoverHeight - 10; // Position above
        }

        let left = elementRect.left + (elementRect.width / 2) - (popoverWidth / 2);
        
        // Clamp to screen edges
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth - 10) left = window.innerWidth - popoverWidth - 10;

        return { top: `${top}px`, left: `${left}px` };
    };

    const handleNext = () => {
        if (stepIndex < steps.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (stepIndex > 0) {
            setStepIndex(stepIndex - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100]">
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                style={{
                    clipPath: elementRect 
                        ? `path('M0,0H${window.innerWidth}V${window.innerHeight}H0V0ZM${elementRect.x - 5},${elementRect.y - 5}H${elementRect.x + elementRect.width + 5}V${elementRect.y + elementRect.height + 5}H${elementRect.x - 5}V${elementRect.y - 5}Z')`
                        : 'none',
                }}
            />
            
            <div
                ref={popoverRef}
                className="absolute bg-white rounded-lg shadow-2xl p-5 w-80 animate-slide-in-fast"
                style={getPopoverPosition()}
            >
                <h3 className="text-lg font-bold text-gray-800 mb-2">{currentStep.title}</h3>
                <p className="text-sm text-gray-600">{currentStep.content}</p>
                <div className="flex justify-between items-center mt-4">
                    <span className="text-xs font-medium text-gray-500">{`Passo ${stepIndex + 1} de ${steps.length}`}</span>
                    <div className="flex gap-2">
                        {stepIndex > 0 && (
                            <button onClick={handlePrev} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Anterior</button>
                        )}
                        <button onClick={handleNext} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                            {stepIndex === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SIDEBAR FOR DESKTOP ---
const Sidebar = ({ isSidebarOpen, onNavigate }) => {
    const { currentView } = useAppStore();

    const menuItems = [
        { view: 'pei-form-view', label: 'Editor PEI', icon: EditorIcon, id: 'nav-editor-pei' },
        { view: 'activity-bank-view', label: 'Banco de Atividades', icon: ActivityIcon, id: 'nav-activity-bank' },
        { view: 'pei-list-view', label: 'PEIs Salvos', icon: ArchiveIcon, id: 'nav-pei-list' },
        { view: 'files-view', label: 'Ficheiros', icon: PaperclipIcon, id: 'nav-files' },
        { view: 'privacy-policy-view', label: 'Privacidade', icon: ShieldIcon, id: 'nav-privacy' },
    ];

    return (
        <aside className={`absolute md:relative z-40 md:z-auto w-64 h-full bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                <div className="text-3xl text-indigo-600"><BrainIcon /></div>
                <h1 className="text-xl font-bold text-gray-800">Assistente PEI</h1>
            </div>
            <nav className="flex-grow p-2 space-y-1">
                {menuItems.map(item => (
                    <button
                        key={item.view}
                        id={item.id}
                        onClick={() => onNavigate(item.view)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            currentView === item.view
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200 mt-auto">
                <a href="https://wa.me/5584999780963" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-green-600 transition-colors">
                    <i className="fa-brands fa-whatsapp text-base"></i>
                    <span>Produzido por Danilo Arruda</span>
                </a>
            </div>
        </aside>
    );
};

// --- BOTTOM BAR FOR MOBILE ---
const BottomBar = ({ onNavigate }) => {
    const { currentView } = useAppStore();

    // Reduced set of items for mobile bottom bar
    const menuItems = [
        { view: 'pei-form-view', label: 'Editor', icon: EditorIcon },
        { view: 'activity-bank-view', label: 'Atividades', icon: ActivityIcon },
        { view: 'pei-list-view', label: 'Salvos', icon: ArchiveIcon },
        { view: 'files-view', label: 'Ficheiros', icon: PaperclipIcon },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg flex justify-around p-2 z-30">
            {menuItems.map(item => (
                <button
                    key={item.view}
                    onClick={() => onNavigate(item.view)}
                    className={`flex flex-col items-center justify-center w-1/4 p-2 rounded-lg transition-colors text-xs ${
                        currentView === item.view
                            ? 'text-indigo-600 bg-indigo-50'
                            : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                    <div className="text-xl mb-1"><item.icon /></div>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
};


// --- APP COMPONENT ---
const App = () => {
    const { currentView, editingPeiId, navigateToView, navigateToNewPei } = useAppStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
        if (!hasCompletedOnboarding) {
            setShowOnboarding(true);
        }
    }, []);

    const onboardingSteps = [
        { title: "Bem-vindo!", content: "Vamos fazer um tour rápido pela aplicação.", desktopSelector: null, mobileSelector: null },
        { title: "Editor de PEI", content: "Aqui é onde você cria e edita os Planos Educacionais Individualizados. Preencha as seções para construir seu documento.", view: 'pei-form-view', desktopSelector: '#nav-editor-pei', mobileSelector: '.md\\:hidden > nav > button:nth-child(1)' },
        { title: "Modos de IA", content: "Alterne entre respostas rápidas e a inteligência avançada (não disponível no plano gratuito) para te auxiliar no preenchimento dos campos.", view: 'pei-form-view', desktopSelector: '#ai-mode-toggle', mobileSelector: '#ai-mode-toggle' },
        { title: "Ficheiros de Apoio", content: "Anexe documentos aqui para dar mais contexto à IA. Ficheiros selecionados são usados para gerar respostas mais precisas.", view: 'files-view', desktopSelector: '#nav-files', mobileSelector: '.md\\:hidden > nav > button:nth-child(4)' },
        { title: "Banco de Atividades", content: "Encontre e gerencie todas as atividades sugeridas pela IA ou criadas por você. Adicione-as facilmente aos seus PEIs.", view: 'activity-bank-view', desktopSelector: '#nav-activity-bank', mobileSelector: '.md\\:hidden > nav > button:nth-child(2)' },
        { title: "PEIs Salvos", content: "Todos os seus PEIs salvos ficam aqui. Edite, exclua ou gere um PDF a partir desta lista.", view: 'pei-list-view', desktopSelector: '#nav-pei-list', mobileSelector: '.md\\:hidden > nav > button:nth-child(3)' },
        { title: "Tudo pronto!", content: "Você está pronto para começar. Explore e crie PEIs incríveis!", desktopSelector: null, mobileSelector: null },
    ];
    
    const handleOnboardingFinish = () => {
        localStorage.setItem('hasCompletedOnboarding', 'true');
        setShowOnboarding(false);
    };

    const handleNavigation = (targetView) => {
        if (targetView === 'pei-form-view') {
            navigateToNewPei();
        } else {
            navigateToView(targetView);
        }
        setIsSidebarOpen(false); // Close sidebar on mobile after navigation
    };

    const renderCurrentView = () => {
        switch (currentView) {
            case 'pei-form-view':
                return <PeiFormView 
                            key={editingPeiId || 'new'} 
                            editingPeiId={editingPeiId} 
                            onSaveSuccess={() => navigateToView('pei-list-view')} 
                        />;
            case 'activity-bank-view':
                return <ActivityBankView />;
            case 'pei-list-view':
                return <PeiListView />;
            case 'files-view':
                return <SupportFilesView />;
            case 'privacy-policy-view':
                return <PrivacyPolicyView />;
            case 'activity-detail-view':
                return <ActivityDetailView />;
            default:
                return <PeiFormView 
                            key={'new-default'} 
                            editingPeiId={null} 
                            onSaveSuccess={() => navigateToView('pei-list-view')} 
                        />;
        }
    };

    return (
        <div className="h-screen w-full bg-gray-100 flex flex-col md:flex-row font-sans pb-16 md:pb-0 overflow-x-hidden">
             {showOnboarding && <OnboardingTour steps={onboardingSteps} onComplete={handleOnboardingFinish} />}
            {/* Mobile Header */}
            <header className="md:hidden flex justify-between items-center p-4 bg-white border-b border-gray-200 sticky top-0 z-30">
                 <div className="flex items-center gap-3">
                    <div className="text-2xl text-indigo-600"><BrainIcon /></div>
                    <h1 className="text-xl font-bold text-gray-800">Assistente PEI</h1>
                </div>
                <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
                    <i className="fa-solid fa-bars text-xl"></i>
                </button>
            </header>
            
            <Sidebar 
                isSidebarOpen={isSidebarOpen} 
                onNavigate={handleNavigation}
            />
            {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <main className="flex-1 flex flex-col overflow-hidden">
                 <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100">
                    {renderCurrentView()}
                 </div>
            </main>
            
            <BottomBar onNavigate={handleNavigation} />
        </div>
    );
};

// --- MAIN RENDER LOGIC ---
const Main = () => {
    const { hasAgreedToPrivacy } = useAppStore();

    if (!hasAgreedToPrivacy) {
        return (
            <div className="h-screen w-full bg-gray-100 flex items-center justify-center p-4 overflow-x-hidden">
                <PrivacyPolicyView />
            </div>
        );
    }

    return <App />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<Main />);
