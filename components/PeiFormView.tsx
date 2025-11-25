
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { fieldOrderForPreview, disciplineOptions } from '../constants.tsx';
import { TextAreaWithActions } from './TextAreaWithActions.tsx';
import { callGenerativeAI, setModelProgressCallback } from '../services/geminiService.ts';
import { savePei, getPeiById, getAllRagFiles, addActivitiesToBank } from '../services/storageService.ts';
import { Modal } from './Modal.tsx';
import { Activity, PeiData, NewPeiRecordData } from '../types.ts';

const helpTexts = {
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

export const PeiFormView = (props) => {
    const { editingPeiId, onSaveSuccess } = props;
    const [currentPeiId, setCurrentPeiId] = useState(editingPeiId);
    const [peiData, setPeiData] = useState<PeiData>({});
    const [loadingStates, setLoadingStates] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', content: null, footer: null });
    
    const [isGeneratingFullPei, setIsGeneratingFullPei] = useState(false);
    const [isFullPeiModalOpen, setIsFullPeiModalOpen] = useState(false);
    const [fullPeiContent, setFullPeiContent] = useState('');

    // NEW: State to track AI model loading progress
    const [modelProgress, setModelProgress] = useState<string>('');

    const [aiGeneratedFields, setAiGeneratedFields] = useState(new Set<string>());
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editModalData, setEditModalData] = useState(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [refinementInstruction, setRefinementInstruction] = useState('');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [smartAnalysisResults, setSmartAnalysisResults] = useState({});
    const [openSmartAnalysis, setOpenSmartAnalysis] = useState({});
    const [errors, setErrors] = useState({});
    const [autoSaveStatus, setAutoSaveStatus] = useState('ocioso'); // 'ocioso', 'salvando', 'salvo'

    // Auto-save logic
    const autoSaveDataRef = useRef({ peiData, aiGeneratedFields, smartAnalysisResults, currentPeiId });

    useEffect(() => {
        // Register the callback to update progress state
        setModelProgressCallback((progress) => {
            setModelProgress(progress);
        });
    }, []);

    useEffect(() => {
        autoSaveDataRef.current = { peiData, aiGeneratedFields, smartAnalysisResults, currentPeiId };
    }, [peiData, aiGeneratedFields, smartAnalysisResults, currentPeiId]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const {
                peiData: currentPeiData,
                aiGeneratedFields: currentAiFields,
                smartAnalysisResults: currentSmartResults,
                currentPeiId: currentId,
            } = autoSaveDataRef.current;
            
            const studentName = currentPeiData['aluno-nome']?.trim();

            if (studentName) {
                setAutoSaveStatus('salvando');
                const recordData: NewPeiRecordData = {
                    data: currentPeiData,
                    aiGeneratedFields: Array.from(currentAiFields),
                    smartAnalysisResults: currentSmartResults,
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
            alert('Por favor, preencha todos os campos obrigatórios destacados.');
        }
        return isValid;
    };

    const handleInputChange = useCallback((e) => {
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

    const handleTextAreaChange = useCallback((id, value) => {
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
    
    const buildAiContext = (fieldIdToExclude) => {
        // Context limits
        const MAX_FILE_CHARS = 3000;
        const MAX_TOTAL_RAG_CHARS = 10000;
        const MAX_FORM_CONTEXT_CHARS = 6000;

        const allRagFiles = getAllRagFiles();
        const selectedFiles = allRagFiles.filter(f => f.selected);
        let ragContext = '';
        
        if (selectedFiles.length > 0) {
            let currentRagLength = 0;
            const ragContent = selectedFiles.map(f => {
                if (currentRagLength >= MAX_TOTAL_RAG_CHARS) return '';

                let content = f.content || '';
                if (content.length > MAX_FILE_CHARS) {
                    content = content.substring(0, MAX_FILE_CHARS) + '\n...[Conteúdo truncado]...';
                }

                const fileString = `Ficheiro: ${f.name}\nConteúdo:\n${content}\n\n`;
                currentRagLength += fileString.length;
                return fileString;
            }).join('');

            ragContext = '--- INÍCIO DOS FICHEIROS DE APOIO ---\n\n' + ragContent + '--- FIM DOS FICHEIROS DE APOIO ---\n\n';
        }

        let formContextString = fieldOrderForPreview
            .flatMap(section => section.fields)
            .map(field => {
                const value = peiData[field.id];
                return value && field.id !== fieldIdToExclude ? `${field.label}: ${value}` : null;
            })
            .filter(Boolean)
            .join('\n');

        if (formContextString.length > MAX_FORM_CONTEXT_CHARS) {
            formContextString = formContextString.substring(0, MAX_FORM_CONTEXT_CHARS) + '\n...[Contexto truncado]...';
        }

        const formContext = '--- INÍCIO DO CONTEXTO DO PEI ATUAL ---\n\n' + formContextString + '\n--- FIM DO CONTEXTO DO PEI ATUAL ---\n\n';

        return { ragContext, formContext };
    };

    // Helper to display loading progress overlay or text
    const LoadingIndicator = () => (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <span className="text-sm font-medium text-indigo-700">
                {modelProgress.includes('%') || modelProgress.includes('Loading') ? 'Preparando IA Local...' : 'Gerando...'}
            </span>
            {modelProgress && (
                <p className="text-xs text-gray-500 mt-1 max-w-[200px] text-center truncate px-2">
                    {modelProgress}
                </p>
            )}
        </div>
    );

    const handleActionClick = async (fieldId, action) => {
        if (action === 'ai' && !areRequiredFieldsFilled) {
            validateForm();
            return;
        }

        setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: true }));
        setModelProgress(''); // Reset progress

        try {
            const { ragContext, formContext } = buildAiContext(fieldId);
            let response = '';
            
            const studentInfoForSimpleActions = `
                Aluno: ${peiData['aluno-nome'] || 'Não informado'}
                Diagnóstico: ${peiData['id-diagnostico'] || 'Não informado'}
            `;
    
            switch (action) {
                case 'ai':
                    const fieldLabelAi = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                    const aiPrompt = `Aja como um especialista em educação inclusiva. Sua tarefa é preencher o campo "${fieldLabelAi}" de um Plano Educacional Individualizado (PEI).
                    
Para garantir coesão e coerência, analise CUIDADOSAMENTE os ficheiros de apoio (se houver) e os campos já preenchidos.

${ragContext}
${formContext}
                    
Agora, gere o conteúdo para o campo: "${fieldLabelAi}".
Sua resposta deve ser apenas o texto para este campo, sem introduções ou títulos.`;

                    response = await callGenerativeAI(aiPrompt);
                    setPeiData(prev => ({ ...prev, [fieldId]: response }));
                    setAiGeneratedFields(prev => new Set(prev).add(fieldId));
                    break;
                    
                case 'smart':
                    const goalText = peiData[fieldId] || '';
                    if (!goalText) {
                        alert('Por favor, preencha o campo da meta antes de solicitar a análise SMART.');
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
                        alert("A IA retornou uma resposta em um formato inesperado. Tente novamente.");
                    }
                    break;
    
                case 'suggest':
                    const isDuaField = fieldId === 'dua-content';
                    const isGoalField = ['metas-curto', 'metas-medio', 'metas-longo'].includes(fieldId);

                    let promptContext = '';
                    let promptSubject = '';
                    
                    if (isGoalField) {
                        const goalTextForSuggest = peiData[fieldId] || '';
                        if (!goalTextForSuggest.trim()) {
                            alert('Por favor, preencha o campo da meta antes de solicitar sugestões.');
                            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
                            return;
                        }
                        promptContext = `Informações do Aluno: ${studentInfoForSimpleActions}`;
                        promptSubject = `na seguinte meta de um PEI: "${goalTextForSuggest}"`;
                    } else {
                        if (!areRequiredFieldsFilled) {
                            validateForm();
                            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
                            return;
                        }
                        promptContext = `${ragContext}\n${formContext}`;
                        promptSubject = 'no contexto completo do PEI fornecido';
                    }

                    const duaInstruction = isDuaField ? 'Com base nos princípios do Desenho Universal para a Aprendizagem (DUA) e' : 'Com base';

                    const suggestPrompt = `${duaInstruction} ${promptSubject}, sugira 3 a 5 atividades educacionais adaptadas.
                    
Contexto:
${promptContext}

Sua resposta DEVE ser um array de objetos JSON válido, sem nenhum texto adicional antes ou depois. Use a seguinte estrutura:
[
  {
    "title": "...",
    "description": "...",
    "discipline": "...",
    "skills": ["...", "..."],
    "needs": ["...", "..."],
    "goalTags": [${isDuaField ? '"DUA"' : '"..."'}]
  }
]`;
                    response = await callGenerativeAI(suggestPrompt);
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

                        if (isDuaField) {
                            activities = activities.map(act => ({ ...act, isDUA: true }));
                        }

                        const handleSaveActivities = () => {
                            addActivitiesToBank(activities, currentPeiId);
                            alert(`${activities.length} atividades foram salvas com sucesso no Banco de Atividades!`);
                            setIsModalOpen(false);
                        };
                        
                        const fieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
                        
                        setModalContent({
                            title: `Atividades Sugeridas para "${fieldLabel}"`,
                            content: renderSuggestedActivities(activities),
                            footer: (
                                <>
                                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                                        Fechar
                                    </button>
                                    <button onClick={handleSaveActivities} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                                        <i className="fa-solid fa-plus"></i> Adicionar ao Banco
                                    </button>
                                </>
                            )
                        });
                        setIsModalOpen(true);
                    } catch(e) {
                        console.error("Failed to parse suggested activities JSON:", e, "Raw response:", response);
                        alert("A IA retornou uma resposta em um formato inesperado. Tente novamente.");
                    }
                    break;
            }
    
        } catch (error) {
            console.error(`Error during '${action}' action for '${fieldId}':`, error);
            const errorMessage = error instanceof Error ? error.message : "Verifique o console para mais detalhes.";
            alert(`Ocorreu um erro ao executar a ação de IA. ${errorMessage}`);
        } finally {
            setLoadingStates(prev => ({ ...prev, [`${fieldId}-${action}`]: false }));
            setModelProgress('');
        }
    };

    const handleGenerateFullPei = async () => {
        if (!validateForm()) {
            return;
        }

        setIsGeneratingFullPei(true);
        setFullPeiContent('');
        setModelProgress('');

        try {
            const { ragContext, formContext } = buildAiContext('');

            const prompt = `
                Aja como um especialista em educação especial e psicopedagogia.
                Com base nos dados de ficheiros de apoio e do formulário, elabore um Plano Educacional Individualizado (PEI) completo, coeso e profissional.
                
                ${ragContext}
                ${formContext}

                Elabore o PEI completo a seguir.
            `;

            const response = await callGenerativeAI(prompt);
            setFullPeiContent(response);
            setIsFullPeiModalOpen(true);

        } catch (error) {
            console.error('Error generating full PEI:', error);
            alert(`Ocorreu um erro ao gerar o PEI completo. ${error.message || 'Tente novamente.'}`);
        } finally {
            setIsGeneratingFullPei(false);
            setModelProgress('');
        }
    };
    
    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditModalData(null);
        setRefinementInstruction('');
    };

    const handleEditModalRegenerate = async () => {
        if (!editModalData) return;
        setIsRegenerating(true);
        setModelProgress('');
        try {
            const { fieldId, label, text } = editModalData;
            const instruction = refinementInstruction || 'Por favor, refine e aprimore este texto.';
            const { ragContext, formContext } = buildAiContext(fieldId);

            const prompt = `Aja como um especialista em educação. O usuário está editando o campo "${label}" de um PEI.
            
            Texto Atual:
            ---
            ${text}
            ---

            Instrução: "${instruction}".

            Contexto do PEI:
            ${ragContext}
            ${formContext}

            Refine o texto atual com base na instrução e no contexto. Devolva apenas o texto aprimorado.`;

            const response = await callGenerativeAI(prompt);
            setEditModalData(prev => prev ? { ...prev, text: response } : null);
            setAiGeneratedFields(prev => new Set(prev).add(fieldId));
            setRefinementInstruction(''); 
        } catch (error) {
            console.error('Error during regeneration:', error);
            alert('Ocorreu um erro ao refinar o conteúdo.');
        } finally {
            setIsRegenerating(false);
            setModelProgress('');
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
        setAiGeneratedFields(new Set<string>());
        setSmartAnalysisResults({});
        setOpenSmartAnalysis({});
        setErrors({});
        setCurrentPeiId(null);
    }, []);

    const handleSavePei = (e) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }

        const recordData: NewPeiRecordData = {
            data: peiData,
            aiGeneratedFields: Array.from(aiGeneratedFields),
            smartAnalysisResults: smartAnalysisResults,
        };

        const studentName = peiData['aluno-nome'] || 'PEI sem nome';
        const savedRecord = savePei(recordData, currentPeiId, studentName);
        setCurrentPeiId(savedRecord.id);
        
        alert('PEI salvo com sucesso!');
        onSaveSuccess();
    };

    const renderSmartAnalysis = (analysis) => {
        const criteriaMap = {
            isSpecific: "Específica (Specific)", isMeasurable: "Mensurável (Measurable)",
            isAchievable: "Atingível (Achievable)", isRelevant: "Relevante (Relevant)", isTimeBound: "Temporal (Time-Bound)",
        };
        return (
            <div className="space-y-4 text-sm">
                {Object.entries(analysis).map(([key, value]: [string, any]) => (
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

    const handleEditClick = (fieldId) => {
        if (aiGeneratedFields.has(fieldId)) {
            const fieldLabel = fieldOrderForPreview.flatMap(s => s.fields).find(f => f.id === fieldId)?.label || '';
            setEditModalData({
                fieldId,
                label: fieldLabel,
                text: peiData[fieldId] || '',
            });
            setIsEditModalOpen(true);
        } else {
            const textarea = document.getElementById(fieldId) as HTMLTextAreaElement;
            if (textarea) {
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            }
        }
    };
    
    const renderField = (field) => {
        const { id, label } = field;
        const hasError = !!errors[id];
        const textAreaFields = [
            'id-diagnostico', 'id-contexto', 'aval-habilidades', 'aval-social', 'aval-coord',
            'metas-curto', 'metas-medio', 'metas-longo', 'est-adaptacoes', 'est-metodologias',
            'est-parcerias', 'resp-regente', 'resp-coord', 'resp-familia', 'resp-apoio',
            'revisao', 'revisao-ajustes', 'atividades-content', 'dua-content'
        ];

        const goalFields = ['metas-curto', 'metas-medio', 'metas-longo'];
        const activitySuggestionFields = ['atividades-content', 'dua-content'];

        if (textAreaFields.includes(id)) {
            const isGoal = goalFields.includes(id);
            const canSuggestActivities = isGoal || activitySuggestionFields.includes(id);
            const isLoadingAny = loadingStates[`${id}-ai`] || loadingStates[`${id}-smart`] || loadingStates[`${id}-suggest`];

            return (
                <div key={id} className="md:col-span-2 relative">
                    {/* Progress Overlay for this field */}
                    {isLoadingAny && modelProgress && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                <span className="text-xs font-semibold text-indigo-700 block mb-1">
                                    {modelProgress.includes('%') ? 'Baixando Modelo IA...' : 'Gerando Resposta...'}
                                </span>
                                <span className="text-[10px] text-gray-500 max-w-[150px] block truncate">{modelProgress}</span>
                            </div>
                        </div>
                    )}

                    <TextAreaWithActions
                        id={id}
                        label={label}
                        value={peiData[id] || ''}
                        onChange={(value) => handleTextAreaChange(id, value)}
                        onAiClick={() => handleActionClick(id, 'ai')}
                        onSmartClick={isGoal ? () => handleActionClick(id, 'smart') : undefined}
                        onSuggestClick={canSuggestActivities ? () => handleActionClick(id, 'suggest') : undefined}
                        onEditClick={() => handleEditClick(id)}
                        isAiLoading={loadingStates[`${id}-ai`]}
                        isSmartLoading={loadingStates[`${id}-smart`]}
                        isSuggestLoading={loadingStates[`${id}-suggest`]}
                        isGoal={canSuggestActivities}
                        placeholder={`Descreva sobre "${label}" aqui...`}
                        rows={isGoal ? 4 : 5}
                        helpText={helpTexts[id]}
                        error={errors[id]}
                        isAiActionDisabled={!areRequiredFieldsFilled}
                    />
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
                                <div id={`smart-analysis-${id}`} className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
                                    {renderSmartAnalysis(smartAnalysisResults[id])}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (id === 'disciplina') {
            return (
                 <div key={id}>
                    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
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

        const inputType = id.includes('-nasc') || id.includes('-data-elab') ? 'date' : 'text';
        
        return (
            <div key={id}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                    type={inputType}
                    id={id}
                    value={peiData[id] || ''}
                    onChange={handleInputChange}
                    className={`w-full p-2.5 border rounded-lg bg-gray-50 transition-all duration-200 focus:outline-none
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
                id="full-pei-modal"
                title="PEI Gerado por IA"
                isOpen={isFullPeiModalOpen}
                onClose={() => setIsFullPeiModalOpen(false)}
                footer={
                    <>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(fullPeiContent);
                                alert('Texto copiado para a área de transferência!');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Copiar Texto
                        </button>
                        <button
                            onClick={() => setIsFullPeiModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                            Fechar
                        </button>
                    </>
                }
                wide
            >
                <div className="relative">
                    {isGeneratingFullPei && modelProgress && (
                        <div className="absolute inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center z-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-3"></div>
                            <p className="text-green-700 font-medium">Gerando PEI Completo...</p>
                            <p className="text-xs text-gray-500 mt-1">{modelProgress}</p>
                        </div>
                    )}
                    <div className="prose max-w-none whitespace-pre-wrap font-serif text-gray-800 p-2 bg-gray-50 rounded-md min-h-[300px]">
                        {fullPeiContent}
                    </div>
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
                                onClick={closeEditModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditModalSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                            >
                                Salvar Alterações
                            </button>
                        </>
                    }
                    wide
                >
                    <div className="relative">
                        {isRegenerating && modelProgress && (
                            <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-20 rounded-lg">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                <p className="text-indigo-700 font-medium text-sm">Refinando...</p>
                                <p className="text-xs text-gray-500">{modelProgress}</p>
                            </div>
                        )}
                        <textarea
                            value={editModalData.text}
                            onChange={(e) => setEditModalData(prev => prev ? { ...prev, text: e.target.value } : null)}
                            className="w-full h-64 p-2.5 border rounded-lg transition-all duration-200 bg-gray-50 text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            placeholder="Edite o conteúdo aqui..."
                        />
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <input
                            type="text"
                            value={refinementInstruction}
                            onChange={(e) => setRefinementInstruction(e.target.value)}
                            className="flex-grow p-2.5 border rounded-lg bg-white text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            placeholder="Instrução para refinar (ex: 'torne mais formal', 'adicione um exemplo')"
                        />
                        <button 
                            onClick={handleEditModalRegenerate} 
                            disabled={isRegenerating}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2"
                            style={{minWidth: '120px'}}
                        >
                            {isRegenerating ? '...' : <><i className="fa-solid fa-wand-magic-sparkles"></i> Refinar</>}
                        </button>
                    </div>
                </Modal>
            )}

            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 tracking-tight">{editingPeiId ? 'Editando PEI' : 'Editor de PEI'}</h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded border border-green-200 flex items-center gap-1">
                        <i className="fa-solid fa-microchip"></i> IA Local (iPhone 13 Ready)
                    </span>
                </div>
                <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
                    {editingPeiId ? `Você está editando o PEI de ${peiData['aluno-nome'] || 'aluno'}.` : 'Preencha os campos abaixo para criar um novo Plano Educacional Individualizado.'}
                </p>
            </div>

            <form onSubmit={handleSavePei} className="space-y-6">
                {fieldOrderForPreview.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-4">{section.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {section.fields.map(field => renderField(field))}
                        </div>
                    </div>
                ))}

                <div className="bg-white p-4 rounded-xl shadow-md mt-6 border border-gray-200 flex flex-wrap justify-end items-center gap-3">
                    <div className="mr-auto text-sm text-gray-500 italic pl-2 transition-opacity duration-500">
                        {autoSaveStatus === 'salvando' && 'Salvando...'}
                        {autoSaveStatus === 'salvo' && <span className="text-green-600 font-medium">Salvo automaticamente</span>}
                    </div>
                    <button 
                        type="button" 
                        onClick={handleGenerateFullPei} 
                        disabled={isGeneratingFullPei || !areRequiredFieldsFilled}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 relative overflow-hidden"
                        title={!areRequiredFieldsFilled ? "Preencha os campos obrigatórios para habilitar" : "Gerar PEI completo com IA"}
                    >
                        {isGeneratingFullPei && (
                            <div className="absolute bottom-0 left-0 h-1 bg-green-800 transition-all duration-300" style={{ width: '100%' }}></div>
                        )}
                        {isGeneratingFullPei ? (
                            <>Gerando...</>
                        ) : (
                            <>
                                <i className="fa-solid fa-file-invoice"></i>
                                Gerar PEI Completo com IA
                            </>
                        )}
                    </button>
                    <button type="button" onClick={handleClearForm} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-trash-can"></i>
                        Limpar Formulário
                    </button>
                    <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-floppy-disk"></i>
                        Salvar PEI
                    </button>
                </div>
            </form>
        </div>
    );
};
